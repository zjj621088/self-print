import "reflect-metadata";
import "dotenv/config";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { NestFactory } from "@nestjs/core";
import { PrismaClient } from "@prisma/client";
import type { INestApplication } from "@nestjs/common";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { AppModule } from "../src/app.module";
import { setupApp } from "../src/setup";

const prisma = new PrismaClient();
let app: INestApplication;
let base = "";
const phone = `139${Date.now().toString().slice(-8)}`;
let merchantId = "";
let customerId = "";
let fileIds: string[] = [];

const pdf = Buffer.from(
  "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Count 2/Kids[3 0 R 4 0 R]>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\n4 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF",
  "latin1",
);

async function api(pathName: string, options: { method?: string; token?: string; body?: unknown; form?: FormData } = {}) {
  const headers = new Headers();
  if (options.token) headers.set("Authorization", `Bearer ${options.token}`);
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }
  const res = await fetch(`${base}${pathName}`, { method: options.method ?? "GET", headers, body });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  return { status: res.status, data };
}

describe("self-print flow", () => {
  before(async () => {
    app = await NestFactory.create(AppModule, { logger: ["error"] });
    setupApp(app);
    await app.listen(0, "127.0.0.1");
    const address = app.getHttpServer().address();
    assert(address && typeof address === "object");
    base = `http://127.0.0.1:${address.port}/api`;
  });

  after(async () => {
    const files = fileIds.length
      ? await prisma.fileAsset.findMany({ where: { id: { in: fileIds } } })
      : [];
    if (merchantId) await prisma.merchant.delete({ where: { id: merchantId } }).catch(() => undefined);
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => undefined);
    }
    for (const file of files) {
      await unlink(path.join(process.cwd(), "uploads", file.storageKey)).catch(() => undefined);
    }
    await app.close();
    await prisma.$disconnect();
  });

  it("runs scan, upload, mock pay, and agent print", async () => {
    const health = await api("/health");
    assert.equal(health.status, 200);

    const registered = await api("/auth/merchant/register", {
      method: "POST",
      body: { name: "测试文印", phone, password: "secret12" },
    });
    assert.equal(registered.status, 201, JSON.stringify(registered.data));
    merchantId = registered.data.merchant.id;
    const merchantToken = registered.data.token as string;

    const createdStore = await api("/merchant/stores", {
      method: "POST",
      token: merchantToken,
      body: { name: "测试店", code: `T${phone.slice(-5)}`, address: "测试路 8 号" },
    });
    assert.equal(createdStore.status, 201, JSON.stringify(createdStore.data));
    const storeCode = createdStore.data.code as string;

    const printer = await api(`/merchant/stores/${createdStore.data.id}/printers`, {
      method: "POST",
      token: merchantToken,
      body: { name: "前台打印机", systemName: "Front-Desk", supportsColor: true, supportsDuplex: true, paperSizes: "A4,A3" },
    });
    assert.equal(printer.status, 201, JSON.stringify(printer.data));

    const tokenRow = await api(`/merchant/stores/${createdStore.data.id}/agent-tokens`, {
      method: "POST",
      token: merchantToken,
      body: { name: "测试代理" },
    });
    assert.equal(tokenRow.status, 201);
    const agentToken = tokenRow.data.token as string;

    const denied = await api("/merchant/stores", { token: "not-a-jwt" });
    assert.equal(denied.status, 401);

    const customer = await api("/auth/customer/mock-login", {
      method: "POST",
      body: { code: `cust-${phone}` },
    });
    assert.equal(customer.status, 201);
    assert.equal(customer.data.mock, true);
    customerId = customer.data.customer.id;
    const customerToken = customer.data.token as string;

    const forbidden = await api("/merchant/dashboard", { token: customerToken });
    assert.equal(forbidden.status, 403);

    const pub = await api(`/public/stores/${storeCode.toLowerCase()}`);
    assert.equal(pub.status, 200);
    assert.equal(pub.data.name, "测试店");

    const form = new FormData();
    form.append("file", new Blob([pdf], { type: "application/pdf" }), "notes.pdf");
    const uploaded = await api("/customer/files", { method: "POST", token: customerToken, form });
    assert.equal(uploaded.status, 201, JSON.stringify(uploaded.data));
    assert.equal(uploaded.data.pageCount, 2);
    assert.equal(uploaded.data.printable, true);
    fileIds.push(uploaded.data.id);

    const draft = {
      storeCode,
      items: [
        {
          fileId: uploaded.data.id,
          copies: 2,
          colorMode: "bw",
          duplex: false,
          paperSize: "A4",
          pageRange: "1-2",
        },
      ],
    };
    const quote = await api("/customer/orders/quote", { method: "POST", token: customerToken, body: draft });
    assert.equal(quote.status, 201, JSON.stringify(quote.data));
    assert.equal(quote.data.totalAmount, 80);

    const badRange = await api("/customer/orders/quote", {
      method: "POST",
      token: customerToken,
      body: { ...draft, items: [{ ...draft.items[0], pageRange: "9-10" }] },
    });
    assert.equal(badRange.status, 400);

    const order = await api("/customer/orders", { method: "POST", token: customerToken, body: draft });
    assert.equal(order.status, 201, JSON.stringify(order.data));
    assert.equal(order.data.status, "pending_payment");

    const paid = await api(`/customer/orders/${order.data.id}/mock-pay`, { method: "POST", token: customerToken });
    assert.equal(paid.status, 201, JSON.stringify(paid.data));
    assert.equal(paid.data.status, "paid");
    assert.equal(paid.data.jobs.length, 1);

    const paidAgain = await api(`/customer/orders/${order.data.id}/mock-pay`, { method: "POST", token: customerToken });
    assert.equal(paidAgain.status, 201);
    assert.equal(paidAgain.data.jobs.length, 1);

    const beat = await api("/agent/heartbeat", {
      method: "POST",
      token: agentToken,
      body: { printers: [{ name: "前台打印机", status: "online" }] },
    });
    assert.equal(beat.status, 201, JSON.stringify(beat.data));
    assert.deepEqual(beat.data.unknown, []);

    const jobs = await api("/agent/jobs", { token: agentToken });
    assert.equal(jobs.status, 200);
    assert.equal(jobs.data.length, 1);
    const jobId = jobs.data[0].id as string;

    const claimed = await api(`/agent/jobs/${jobId}/claim`, {
      method: "POST",
      token: agentToken,
      body: { printerName: "前台打印机" },
    });
    assert.equal(claimed.status, 201, JSON.stringify(claimed.data));
    assert.equal(claimed.data.status, "claimed");

    const fileRes = await fetch(`${base}/agent/jobs/${jobId}/file`, {
      headers: { Authorization: `Bearer ${agentToken}` },
    });
    assert.equal(fileRes.status, 200);
    const downloaded = Buffer.from(await fileRes.arrayBuffer());
    assert.equal(downloaded.equals(pdf), true);

    const printing = await api(`/agent/jobs/${jobId}/printing`, { method: "POST", token: agentToken });
    assert.equal(printing.status, 201);
    const done = await api(`/agent/jobs/${jobId}/done`, { method: "POST", token: agentToken });
    assert.equal(done.status, 201);
    assert.equal(done.data.status, "done");

    const listed = await api("/merchant/orders?pageSize=1&page=1", { token: merchantToken });
    assert.equal(listed.status, 200, JSON.stringify(listed.data));
    assert.equal(listed.data.pageSize, 1);
    assert.equal(listed.data.items.length, 1);

    const merchantView = await api(`/merchant/orders/${order.data.id}`, { token: merchantToken });
    assert.equal(merchantView.data.status, "printed");
    const completed = await api(`/merchant/orders/${order.data.id}/complete`, { method: "POST", token: merchantToken });
    assert.equal(completed.status, 201);
    assert.equal(completed.data.status, "completed");

    const fileDownload = await fetch(`${base}/merchant/files/${uploaded.data.id}`, {
      headers: { Authorization: `Bearer ${merchantToken}` },
    });
    assert.equal(fileDownload.status, 200);
  });
});
