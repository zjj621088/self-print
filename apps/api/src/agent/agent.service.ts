import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrinterStatus } from "@prisma/client";
import type { AgentContext } from "../common/types";
import { OrdersService } from "../orders/orders.service";
import { PrismaService } from "../prisma.service";
import type { ClaimJobDto, FailJobDto, HeartbeatDto } from "./dto";

const jobInclude = {
  order: { select: { orderNo: true, pickupCode: true, remark: true } },
  orderItem: {
    select: {
      copies: true,
      colorMode: true,
      duplex: true,
      paperSize: true,
      pageRange: true,
      pageCount: true,
      file: { select: { id: true, originalName: true, mimeType: true, storageKey: true, pageCount: true } },
    },
  },
  printer: { select: { id: true, name: true, systemName: true } },
} as const;

@Injectable()
export class AgentService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(OrdersService) private readonly orders: OrdersService,
  ) {}

  async heartbeat(agent: AgentContext, dto: HeartbeatDto) {
    const printers = await this.prisma.printer.findMany({ where: { storeId: agent.storeId } });
    const unknown: string[] = [];
    const now = new Date();
    for (const reported of dto.printers) {
      const match = printers.find((printer) => printer.name === reported.name || printer.systemName === reported.name);
      if (!match) {
        unknown.push(reported.name);
        continue;
      }
      await this.prisma.printer.update({
        where: { id: match.id },
        data: { status: reported.status as PrinterStatus, lastHeartbeatAt: now },
      });
    }
    const fresh = await this.prisma.printer.findMany({
      where: { storeId: agent.storeId },
      select: { name: true, systemName: true, status: true, lastHeartbeatAt: true },
      orderBy: { createdAt: "asc" },
    });
    return { ok: true, unknown, printers: fresh };
  }

  async listJobs(agent: AgentContext) {
    const jobs = await this.prisma.printJob.findMany({
      where: { storeId: agent.storeId, status: "queued" },
      include: jobInclude,
      orderBy: { createdAt: "asc" },
      take: 10,
    });
    return jobs.map(presentJob);
  }

  async claim(agent: AgentContext, jobId: string, dto: ClaimJobDto) {
    const job = await this.requireJob(agent.storeId, jobId);
    const printer = await this.prisma.printer.findFirst({
      where: { storeId: agent.storeId, OR: [{ name: dto.printerName }, { systemName: dto.printerName }] },
    });
    if (!printer) throw new NotFoundException("打印机不存在");
    const item = job.orderItem;
    if (item.colorMode === "color" && !printer.supportsColor) {
      throw new BadRequestException("该打印机不支持彩色");
    }
    if (item.duplex && !printer.supportsDuplex) {
      throw new BadRequestException("该打印机不支持双面");
    }
    const papers = printer.paperSizes.split(",");
    if (!papers.includes(item.paperSize)) throw new BadRequestException("该打印机不支持此纸张");

    const updated = await this.prisma.printJob.updateMany({
      where: { id: jobId, storeId: agent.storeId, status: "queued" },
      data: { status: "claimed", claimedAt: new Date(), printerId: printer.id },
    });
    if (updated.count !== 1) throw new ConflictException("任务已被领取");
    await this.orders.syncOrderStatus(job.orderId);
    return this.mustPresent(agent.storeId, jobId);
  }

  async markPrinting(agent: AgentContext, jobId: string) {
    const job = await this.requireJob(agent.storeId, jobId);
    if (job.status !== "claimed" && job.status !== "printing") {
      throw new ConflictException("任务不在打印中");
    }
    await this.prisma.printJob.update({
      where: { id: job.id },
      data: { status: "printing", startedAt: job.startedAt ?? new Date() },
    });
    await this.orders.syncOrderStatus(job.orderId);
    return this.mustPresent(agent.storeId, jobId);
  }

  async markDone(agent: AgentContext, jobId: string) {
    const job = await this.requireJob(agent.storeId, jobId);
    if (job.status !== "claimed" && job.status !== "printing") {
      throw new ConflictException("任务不在打印中");
    }
    await this.prisma.printJob.update({
      where: { id: job.id },
      data: { status: "done", finishedAt: new Date(), error: "" },
    });
    await this.orders.syncOrderStatus(job.orderId);
    return this.mustPresent(agent.storeId, jobId);
  }

  async markFailed(agent: AgentContext, jobId: string, dto: FailJobDto) {
    const job = await this.requireJob(agent.storeId, jobId);
    if (job.status === "done" || job.status === "failed") throw new ConflictException("任务已结束");
    await this.prisma.printJob.update({
      where: { id: job.id },
      data: { status: "failed", finishedAt: new Date(), error: dto.error?.trim() || "打印失败" },
    });
    await this.orders.syncOrderStatus(job.orderId);
    return this.mustPresent(agent.storeId, jobId);
  }

  async fileForJob(agent: AgentContext, jobId: string) {
    const job = await this.requireJob(agent.storeId, jobId);
    if (job.status === "queued") throw new ConflictException("请先领取任务");
    return job.orderItem.file;
  }

  private async requireJob(storeId: string, jobId: string) {
    const job = await this.prisma.printJob.findFirst({
      where: { id: jobId, storeId },
      include: jobInclude,
    });
    if (!job) throw new NotFoundException("打印任务不存在");
    return job;
  }

  private async mustPresent(storeId: string, jobId: string) {
    const job = await this.requireJob(storeId, jobId);
    return presentJob(job);
  }
}

function presentJob(job: {
  id: string;
  status: string;
  copies: number;
  error: string;
  order: { orderNo: string; pickupCode: string | null; remark: string };
  printer: { id: string; name: string; systemName: string } | null;
  orderItem: {
    colorMode: string;
    duplex: boolean;
    paperSize: string;
    pageRange: string;
    pageCount: number;
    file: { id: string; originalName: string; mimeType: string; storageKey: string; pageCount: number };
  };
}) {
  return {
    id: job.id,
    status: job.status,
    copies: job.copies,
    error: job.error,
    orderNo: job.order.orderNo,
    pickupCode: job.order.pickupCode,
    remark: job.order.remark,
    colorMode: job.orderItem.colorMode,
    duplex: job.orderItem.duplex,
    paperSize: job.orderItem.paperSize,
    pageRange: job.orderItem.pageRange,
    pageCount: job.orderItem.pageCount,
    file: {
      id: job.orderItem.file.id,
      originalName: job.orderItem.file.originalName,
      mimeType: job.orderItem.file.mimeType,
    },
    printer: job.printer,
  };
}
