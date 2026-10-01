import { randomInt } from "node:crypto";
import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ColorMode, OrderStatus, PaperSize, Prisma } from "@prisma/client";
import { makeOrderNo, shanghaiDayStart } from "../common/crypto";
import { isPrismaUnique } from "../common/http";
import { isDirectPrintable } from "../pricing/pages";
import { PricingError, quoteItem, resolveBillingPageCount } from "../pricing/pricing";
import { PrismaService } from "../prisma.service";
import type { ListOrdersQuery, OrderDraftDto } from "./dto";

const orderInclude = {
  store: { select: { id: true, name: true, code: true } },
  customer: { select: { id: true, nickname: true } },
  items: {
    include: {
      file: { select: { id: true, originalName: true, mimeType: true, pageCount: true, size: true } },
    },
  },
  jobs: {
    include: { printer: { select: { id: true, name: true, systemName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.OrderInclude;

type OrderRecord = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

@Injectable()
export class OrdersService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async quote(customerId: string, dto: OrderDraftDto) {
    const prepared = await this.prepare(customerId, dto);
    return {
      store: { id: prepared.store.id, name: prepared.store.name, code: prepared.store.code },
      totalAmount: prepared.totalAmount,
      items: prepared.lines.map(presentLine),
    };
  }

  async create(customerId: string, dto: OrderDraftDto) {
    const prepared = await this.prepare(customerId, dto);
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const order = await this.prisma.$transaction(async (tx) => {
          for (const line of prepared.lines) {
            if (line.declaredPageCount != null) {
              await tx.fileAsset.update({
                where: { id: line.file.id },
                data: { pageCount: line.declaredPageCount },
              });
            }
          }
          return tx.order.create({
            data: {
              orderNo: makeOrderNo(),
              storeId: prepared.store.id,
              customerId,
              status: "pending_payment",
              totalAmount: prepared.totalAmount,
              remark: dto.remark?.trim() ?? "",
              items: {
                create: prepared.lines.map((line) => ({
                  fileId: line.file.id,
                  copies: line.item.copies,
                  colorMode: line.item.colorMode as ColorMode,
                  duplex: line.item.duplex,
                  paperSize: line.item.paperSize as PaperSize,
                  pageRange: line.pageRange,
                  pageCount: line.quoted.pageCount,
                  unitPrice: line.quoted.unitPrice,
                  amount: line.quoted.amount,
                })),
              },
            },
            include: orderInclude,
          });
        });
        return presentOrder(order);
      } catch (error) {
        if (isPrismaUnique(error)) continue;
        throw error;
      }
    }
    throw new BadRequestException("订单创建失败，请重试");
  }

  async mockPay(customerId: string, orderId: string) {
    const existing = await this.prisma.order.findFirst({ where: { id: orderId, customerId } });
    if (!existing) throw new NotFoundException("订单不存在");
    if (existing.status === "cancelled") throw new BadRequestException("订单已取消");
    if (existing.status === "pending_payment") {
      for (let attempt = 0; attempt < 8; attempt += 1) {
        try {
          await this.prisma.$transaction(async (tx) => {
            const pickupCode = await allocatePickupCode(tx, existing.storeId);
            const updated = await tx.order.updateMany({
              where: { id: orderId, customerId, status: "pending_payment" },
              data: { status: "paid", payChannel: "mock", paidAt: new Date(), pickupCode },
            });
            if (updated.count !== 1) return;
            const items = await tx.orderItem.findMany({ where: { orderId } });
            await tx.printJob.createMany({
              data: items.map((item) => ({
                orderId,
                orderItemId: item.id,
                storeId: existing.storeId,
                copies: item.copies,
                status: "queued" as const,
              })),
            });
          });
          break;
        } catch (error) {
          if (isPrismaUnique(error) && attempt < 7) continue;
          throw error;
        }
      }
    }
    return this.getForCustomer(customerId, orderId);
  }

  async listForCustomer(customerId: string, query: ListOrdersQuery) {
    const { page, pageSize } = readPage(query);
    const where: Prisma.OrderWhereInput = { customerId };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(presentOrder), total, page, pageSize };
  }

  async getForCustomer(customerId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, customerId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("订单不存在");
    return { ...presentOrder(order), mockPay: order.payChannel === "mock" || order.status === "pending_payment" };
  }

  async listForMerchant(merchantId: string, query: ListOrdersQuery) {
    const { page, pageSize } = readPage(query);
    if (query.storeId) await this.requireStore(merchantId, query.storeId);
    const where: Prisma.OrderWhereInput = {
      store: { merchantId, ...(query.storeId ? { id: query.storeId } : {}) },
      ...(query.status ? { status: query.status } : {}),
      ...keywordFilter(query.q),
    };
    const [total, rows] = await Promise.all([
      this.prisma.order.count({ where }),
      this.prisma.order.findMany({
        where,
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { items: rows.map(presentOrder), total, page, pageSize };
  }

  async getForMerchant(merchantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, store: { merchantId } },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException("订单不存在");
    return presentOrder(order);
  }

  async cancel(merchantId: string, orderId: string) {
    const order = await this.getOwned(merchantId, orderId);
    if (order.status !== "pending_payment" && order.status !== "paid") {
      throw new BadRequestException("当前状态不能取消");
    }
    await this.prisma.$transaction([
      this.prisma.order.update({ where: { id: order.id }, data: { status: "cancelled" } }),
      this.prisma.printJob.updateMany({
        where: { orderId: order.id, status: "queued" },
        data: { status: "failed", error: "订单已取消", finishedAt: new Date() },
      }),
    ]);
    return this.getForMerchant(merchantId, orderId);
  }

  async complete(merchantId: string, orderId: string) {
    const order = await this.getOwned(merchantId, orderId);
    if (order.status !== "printed") throw new BadRequestException("打印完成并待取件时才能确认取件");
    await this.prisma.order.update({ where: { id: order.id }, data: { status: "completed" } });
    return this.getForMerchant(merchantId, orderId);
  }

  async reprint(merchantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, store: { merchantId } },
      include: { items: true, jobs: true },
    });
    if (!order) throw new NotFoundException("订单不存在");
    if (order.status === "pending_payment" || order.status === "cancelled") {
      throw new BadRequestException("当前状态不能重打");
    }
    const failedItems = new Set(order.jobs.filter((job) => job.status === "failed").map((job) => job.orderItemId));
    const source = failedItems.size > 0 ? order.items.filter((item) => failedItems.has(item.id)) : order.items;
    await this.prisma.$transaction([
      this.prisma.printJob.createMany({
        data: source.map((item) => ({
          orderId: order.id,
          orderItemId: item.id,
          storeId: order.storeId,
          copies: item.copies,
          status: "queued" as const,
        })),
      }),
      this.prisma.order.update({ where: { id: order.id }, data: { status: "paid" } }),
    ]);
    return this.getForMerchant(merchantId, orderId);
  }

  async dashboard(merchantId: string) {
    const start = shanghaiDayStart();
    const storeWhere = { merchantId };
    const [todayOrderCount, revenue, pendingPrint, printingCount, storeCount, recent] = await Promise.all([
      this.prisma.order.count({
        where: { store: storeWhere, createdAt: { gte: start }, status: { not: "cancelled" } },
      }),
      this.prisma.order.aggregate({
        where: {
          store: storeWhere,
          paidAt: { gte: start },
          status: { notIn: ["cancelled", "pending_payment"] },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.printJob.count({ where: { order: { store: storeWhere }, status: "queued" } }),
      this.prisma.printJob.count({
        where: { order: { store: storeWhere }, status: { in: ["claimed", "printing"] } },
      }),
      this.prisma.store.count({ where: storeWhere }),
      this.prisma.order.findMany({
        where: { store: storeWhere },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);
    return {
      todayOrderCount,
      todayRevenue: revenue._sum.totalAmount ?? 0,
      pendingPrint,
      printingCount,
      storeCount,
      recent: recent.map(presentOrder),
    };
  }

  async syncOrderStatus(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { jobs: true },
    });
    if (!order) return;
    if (order.status === "cancelled" || order.status === "completed" || order.status === "pending_payment") return;
    if (order.jobs.length === 0) return;
    const statuses = order.jobs.map((job) => job.status);
    let next: OrderStatus = order.status;
    if (statuses.every((status) => status === "done")) next = "printed";
    else if (statuses.some((status) => status === "claimed" || status === "printing")) next = "printing";
    else if (statuses.some((status) => status === "queued")) next = "paid";
    else if (statuses.some((status) => status === "failed")) next = "failed";
    if (next !== order.status) {
      await this.prisma.order.update({ where: { id: orderId }, data: { status: next } });
    }
  }

  private async prepare(customerId: string, dto: OrderDraftDto) {
    const store = await this.prisma.store.findUnique({
      where: { code: dto.storeCode.trim().toUpperCase() },
      include: { priceRules: true },
    });
    if (!store || store.status !== "active") throw new BadRequestException("门店不存在或暂停营业");

    const lines = [];
    for (const item of dto.items) {
      const file = await this.prisma.fileAsset.findFirst({ where: { id: item.fileId, customerId } });
      if (!file) throw new BadRequestException("有文件不存在或已失效");
      const printable = isDirectPrintable(file.mimeType, file.originalName);
      try {
        const totalPages = resolveBillingPageCount(file, item.pageCount, printable);
        const quoted = quoteItem({
          rules: store.priceRules,
          pageCount: totalPages,
          pageRange: item.pageRange,
          copies: item.copies,
          paperSize: item.paperSize,
          colorMode: item.colorMode,
          duplex: item.duplex,
        });
        lines.push({
          file,
          item,
          quoted,
          pageRange: item.pageRange?.trim() || "all",
          declaredPageCount: !printable && totalPages !== file.pageCount ? totalPages : null,
        });
      } catch (error) {
        if (error instanceof PricingError) throw new BadRequestException(`${file.originalName}：${error.message}`);
        throw error;
      }
    }
    return {
      store,
      lines,
      totalAmount: lines.reduce((sum, line) => sum + line.quoted.amount, 0),
    };
  }

  private async getOwned(merchantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, store: { merchantId } } });
    if (!order) throw new NotFoundException("订单不存在");
    return order;
  }

  private async requireStore(merchantId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) throw new NotFoundException("门店不存在");
    return store;
  }
}

function keywordFilter(q?: string): Prisma.OrderWhereInput {
  const keyword = (q ?? "").trim().slice(0, 32);
  if (!keyword) return {};
  return {
    OR: [
      { orderNo: { contains: keyword, mode: "insensitive" } },
      { pickupCode: { contains: keyword } },
    ],
  };
}

async function allocatePickupCode(tx: Prisma.TransactionClient, storeId: string) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const pickupCode = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const taken = await tx.order.findFirst({ where: { storeId, pickupCode }, select: { id: true } });
    if (!taken) return pickupCode;
  }
  throw new BadRequestException("取件码生成失败，请重试");
}

function readPage(query: { page?: number | string; pageSize?: number | string }) {
  const page = Number(query.page ?? 1);
  const pageSize = Number(query.pageSize ?? 20);
  return {
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    pageSize: Number.isInteger(pageSize) && pageSize >= 1 ? Math.min(pageSize, 50) : 20,
  };
}

function presentLine(line: {
  file: { id: string; originalName: string };
  item: { copies: number; colorMode: string; duplex: boolean; paperSize: string };
  quoted: { pageCount: number; unitPrice: number; amount: number };
  pageRange: string;
}) {
  return {
    fileId: line.file.id,
    originalName: line.file.originalName,
    copies: line.item.copies,
    colorMode: line.item.colorMode,
    duplex: line.item.duplex,
    paperSize: line.item.paperSize,
    pageRange: line.pageRange,
    pageCount: line.quoted.pageCount,
    unitPrice: line.quoted.unitPrice,
    amount: line.quoted.amount,
  };
}

function presentOrder(order: OrderRecord) {
  return {
    id: order.id,
    orderNo: order.orderNo,
    pickupCode: order.pickupCode,
    fulfillment: "instore",
    status: order.status,
    totalAmount: order.totalAmount,
    remark: order.remark,
    payChannel: order.payChannel,
    paidAt: order.paidAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    store: order.store,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      fileId: item.fileId,
      copies: item.copies,
      colorMode: item.colorMode,
      duplex: item.duplex,
      paperSize: item.paperSize,
      pageRange: item.pageRange,
      pageCount: item.pageCount,
      unitPrice: item.unitPrice,
      amount: item.amount,
      file: item.file,
    })),
    jobs: order.jobs.map((job) => ({
      id: job.id,
      status: job.status,
      copies: job.copies,
      error: job.error,
      claimedAt: job.claimedAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      printer: job.printer,
    })),
  };
}
