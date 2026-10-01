import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { sha256 } from "../src/common/crypto";
import { DEFAULT_PRICE_RULES } from "../src/pricing/defaults";

const DEMO_PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 1/Kids[3 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  "latin1",
);

const prisma = new PrismaClient();
const DEMO_TOKEN = "agt_dev_demo_store_token";
const DEMO_ORDER_NO = "SPDEMO000001";

async function main() {
  const passwordHash = await bcrypt.hash("admin123", 10);
  const merchant = await prisma.merchant.upsert({
    where: { phone: "13800000000" },
    create: { name: "示例商家", phone: "13800000000", passwordHash },
    update: { name: "示例商家", passwordHash },
  });

  const store = await prisma.store.upsert({
    where: { code: "DEMO01" },
    create: {
      merchantId: merchant.id,
      name: "示例文印店",
      code: "DEMO01",
      address: "示例路 1 号",
      phone: "010-12345678",
      notice: "请到柜台取件，文件保留 24 小时。",
      priceRules: { create: DEFAULT_PRICE_RULES.map((rule) => ({ ...rule })) },
    },
    update: {
      name: "示例文印店",
      address: "示例路 1 号",
      phone: "010-12345678",
      notice: "请到柜台取件，文件保留 24 小时。",
      status: "active",
    },
  });

  const ruleCount = await prisma.priceRule.count({ where: { storeId: store.id } });
  if (ruleCount === 0) {
    await prisma.priceRule.createMany({
      data: DEFAULT_PRICE_RULES.map((rule) => ({ ...rule, storeId: store.id })),
    });
  }

  await prisma.printer.upsert({
    where: { storeId_name: { storeId: store.id, name: "前台打印机" } },
    create: {
      storeId: store.id,
      name: "前台打印机",
      systemName: "Front-Desk",
      supportsColor: true,
      supportsDuplex: true,
      paperSizes: "A4,A3",
    },
    update: {
      systemName: "Front-Desk",
      supportsColor: true,
      supportsDuplex: true,
      paperSizes: "A4,A3",
    },
  });

  await prisma.agentToken.upsert({
    where: { tokenHash: sha256(DEMO_TOKEN) },
    create: {
      storeId: store.id,
      name: "前台代理",
      tokenHash: sha256(DEMO_TOKEN),
      tokenHint: DEMO_TOKEN.slice(-4),
    },
    update: { revokedAt: null, name: "前台代理", storeId: store.id },
  });

  const customer = await prisma.customer.upsert({
    where: { openId: "mock:demo-visitor" },
    create: { openId: "mock:demo-visitor", nickname: "演示顾客" },
    update: { nickname: "演示顾客" },
  });

  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  await mkdir(uploadDir, { recursive: true });
  await writeFile(path.join(uploadDir, "seed-demo-notes.pdf"), DEMO_PDF);

  const existingOrder = await prisma.order.findUnique({ where: { orderNo: DEMO_ORDER_NO } });
  if (!existingOrder) {
    const file = await prisma.fileAsset.upsert({
      where: { storageKey: "seed-demo-notes.pdf" },
      create: {
        customerId: customer.id,
        originalName: "课程笔记.pdf",
        mimeType: "application/pdf",
        size: DEMO_PDF.length,
        storageKey: "seed-demo-notes.pdf",
        pageCount: 1,
      },
      update: {},
    });
    const order = await prisma.order.create({
      data: {
        orderNo: DEMO_ORDER_NO,
        storeId: store.id,
        customerId: customer.id,
        status: "completed",
        totalAmount: 40,
        remark: "演示订单",
        payChannel: "mock",
        paidAt: new Date(),
        items: {
          create: {
            fileId: file.id,
            copies: 2,
            colorMode: "bw",
            duplex: false,
            paperSize: "A4",
            pageRange: "all",
            pageCount: 1,
            unitPrice: 20,
            amount: 40,
          },
        },
      },
      include: { items: true },
    });
    await prisma.printJob.create({
      data: {
        orderId: order.id,
        orderItemId: order.items[0].id,
        storeId: store.id,
        copies: 2,
        status: "done",
        finishedAt: new Date(),
      },
    });
  }

  console.log("Seeded demo merchant 13800000000 / admin123");
  console.log("Store code DEMO01");
  console.log(`Agent token ${DEMO_TOKEN}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
