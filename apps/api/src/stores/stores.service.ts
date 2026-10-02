import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { PrinterStatus } from "@prisma/client";
import QRCode from "qrcode";
import { newAgentToken, sha256, storeCodeCandidate } from "../common/crypto";
import { isPrismaUnique } from "../common/http";
import { DEFAULT_PRICE_RULES } from "../pricing/defaults";
import { PrismaService } from "../prisma.service";
import type { CreateAgentTokenDto, CreateStoreDto, PrinterDto, ReplacePricesDto, UpdatePrinterDto, UpdateStoreDto } from "./dto";

const HEARTBEAT_STALE_MS = 45_000;

@Injectable()
export class StoresService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  list(merchantId: string) {
    return this.prisma.store.findMany({
      where: { merchantId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { printers: true, orders: true } } },
    });
  }

  async get(merchantId: string, storeId: string) {
    const store = await this.requireStore(merchantId, storeId);
    const [printers, priceRules, agentTokens] = await Promise.all([
      this.prisma.printer.findMany({ where: { storeId: store.id }, orderBy: { createdAt: "asc" } }),
      this.prisma.priceRule.findMany({
        where: { storeId: store.id },
        orderBy: [{ paperSize: "asc" }, { colorMode: "asc" }, { duplex: "asc" }],
      }),
      this.prisma.agentToken.findMany({
        where: { storeId: store.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          tokenHint: true,
          revokedAt: true,
          lastSeenAt: true,
          createdAt: true,
        },
      }),
    ]);
    return {
      ...store,
      printers: printers.map((printer) => this.presentPrinter(printer)),
      priceRules,
      agentTokens,
    };
  }

  async create(merchantId: string, dto: CreateStoreDto) {
    const code = dto.code?.trim().toUpperCase() || (await this.generateCode());
    try {
      return await this.prisma.store.create({
        data: {
          merchantId,
          name: dto.name.trim(),
          code,
          address: dto.address?.trim() ?? "",
          phone: dto.phone?.trim() ?? "",
          notice: dto.notice?.trim() ?? "",
          priceRules: { create: DEFAULT_PRICE_RULES.map((rule) => ({ ...rule })) },
        },
        include: { priceRules: true, printers: true },
      });
    } catch (error) {
      if (isPrismaUnique(error)) throw new ConflictException("进店码已存在");
      throw error;
    }
  }

  async update(merchantId: string, storeId: string, dto: UpdateStoreDto) {
    await this.requireStore(merchantId, storeId);
    return this.prisma.store.update({
      where: { id: storeId },
      data: {
        name: dto.name?.trim(),
        address: dto.address?.trim(),
        phone: dto.phone?.trim(),
        notice: dto.notice?.trim(),
        status: dto.status,
      },
    });
  }

  async qr(merchantId: string, storeId: string) {
    const store = await this.requireStore(merchantId, storeId);
    const payload = `selfprint:store:${store.code}`;
    const pngDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 360 });
    return {
      code: store.code,
      payload,
      miniProgramPath: `pages/store/index?code=${store.code}`,
      pngDataUrl,
    };
  }

  async addPrinter(merchantId: string, storeId: string, dto: PrinterDto) {
    await this.requireStore(merchantId, storeId);
    try {
      const printer = await this.prisma.printer.create({
        data: {
          storeId,
          name: dto.name.trim(),
          systemName: dto.systemName.trim(),
          supportsColor: dto.supportsColor ?? true,
          supportsDuplex: dto.supportsDuplex ?? true,
          paperSizes: normalizePaperSizes(dto.paperSizes),
        },
      });
      return this.presentPrinter(printer);
    } catch (error) {
      if (isPrismaUnique(error)) throw new ConflictException("打印机名称已存在");
      throw error;
    }
  }

  async updatePrinter(merchantId: string, printerId: string, dto: UpdatePrinterDto) {
    const printer = await this.requirePrinter(merchantId, printerId);
    try {
      const updated = await this.prisma.printer.update({
        where: { id: printer.id },
        data: {
          name: dto.name?.trim(),
          systemName: dto.systemName?.trim(),
          supportsColor: dto.supportsColor,
          supportsDuplex: dto.supportsDuplex,
          paperSizes: dto.paperSizes == null ? undefined : normalizePaperSizes(dto.paperSizes),
        },
      });
      return this.presentPrinter(updated);
    } catch (error) {
      if (isPrismaUnique(error)) throw new ConflictException("打印机名称已存在");
      throw error;
    }
  }

  async removePrinter(merchantId: string, printerId: string) {
    const printer = await this.requirePrinter(merchantId, printerId);
    await this.prisma.printer.delete({ where: { id: printer.id } });
    return { ok: true };
  }

  async replacePrices(merchantId: string, storeId: string, dto: ReplacePricesDto) {
    await this.requireStore(merchantId, storeId);
    const seen = new Set<string>();
    for (const rule of dto.rules) {
      const key = `${rule.paperSize}:${rule.colorMode}:${rule.duplex}`;
      if (seen.has(key)) throw new BadRequestException("价格规格重复");
      seen.add(key);
    }
    await this.prisma.$transaction([
      this.prisma.priceRule.deleteMany({ where: { storeId } }),
      this.prisma.priceRule.createMany({
        data: dto.rules.map((rule) => ({
          storeId,
          paperSize: rule.paperSize,
          colorMode: rule.colorMode,
          duplex: rule.duplex,
          pricePerPage: rule.pricePerPage,
        })),
      }),
    ]);
    return this.prisma.priceRule.findMany({
      where: { storeId },
      orderBy: [{ paperSize: "asc" }, { colorMode: "asc" }, { duplex: "asc" }],
    });
  }

  async createAgentToken(merchantId: string, storeId: string, dto: CreateAgentTokenDto) {
    await this.requireStore(merchantId, storeId);
    const token = newAgentToken();
    const row = await this.prisma.agentToken.create({
      data: {
        storeId,
        name: dto.name?.trim() || "店内代理",
        tokenHash: sha256(token),
        tokenHint: token.slice(-4),
      },
    });
    return {
      id: row.id,
      name: row.name,
      token,
      tokenHint: row.tokenHint,
      createdAt: row.createdAt,
    };
  }

  async revokeAgentToken(merchantId: string, tokenId: string) {
    const row = await this.prisma.agentToken.findFirst({
      where: { id: tokenId, store: { merchantId } },
    });
    if (!row) throw new NotFoundException("代理令牌不存在");
    await this.prisma.agentToken.update({
      where: { id: row.id },
      data: { revokedAt: row.revokedAt ?? new Date() },
    });
    return { ok: true };
  }

  async publicStore(code: string) {
    const store = await this.prisma.store.findUnique({
      where: { code: code.trim().toUpperCase() },
      include: {
        priceRules: { orderBy: [{ paperSize: "asc" }, { colorMode: "asc" }, { duplex: "asc" }] },
        printers: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!store || store.status !== "active") throw new NotFoundException("门店不存在或暂停营业");
    return {
      id: store.id,
      name: store.name,
      code: store.code,
      address: store.address,
      phone: store.phone,
      notice: store.notice,
      priceRules: store.priceRules.map((rule) => ({
        paperSize: rule.paperSize,
        colorMode: rule.colorMode,
        duplex: rule.duplex,
        pricePerPage: rule.pricePerPage,
      })),
      printers: store.printers.map((printer) => {
        const presented = this.presentPrinter(printer);
        return {
          name: presented.name,
          status: presented.status,
          supportsColor: presented.supportsColor,
          supportsDuplex: presented.supportsDuplex,
          paperSizes: presented.paperSizes,
        };
      }),
    };
  }

  private async requireStore(merchantId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({ where: { id: storeId, merchantId } });
    if (!store) throw new NotFoundException("门店不存在");
    return store;
  }

  private async requirePrinter(merchantId: string, printerId: string) {
    const printer = await this.prisma.printer.findFirst({
      where: { id: printerId, store: { merchantId } },
    });
    if (!printer) throw new NotFoundException("打印机不存在");
    return printer;
  }

  private async generateCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const code = storeCodeCandidate();
      const exists = await this.prisma.store.findUnique({ where: { code } });
      if (!exists) return code;
    }
    throw new ConflictException("进店码生成失败，请重试");
  }

  private presentPrinter<T extends { status: PrinterStatus; lastHeartbeatAt: Date | null }>(printer: T) {
    const stale = !printer.lastHeartbeatAt || Date.now() - printer.lastHeartbeatAt.getTime() > HEARTBEAT_STALE_MS;
    const status = printer.status === "online" && stale ? "offline" : printer.status;
    return { ...printer, status, reportedStatus: printer.status };
  }
}

function normalizePaperSizes(value: string | undefined): string {
  const sizes = (value ?? "A4,A3")
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter((item) => item === "A4" || item === "A3");
  const unique = [...new Set(sizes)];
  if (unique.length === 0) throw new BadRequestException("至少选择一种纸张");
  return unique.join(",");
}
