import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import { MAX_ORDER_ITEMS } from "../common/limits";
import { PrismaService } from "../prisma.service";
import { FilesService, presentFile } from "./files.service";
import { albumPage } from "./album-page";

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

@Injectable()
export class AlbumService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  async create(customerId: string, roomValue: unknown) {
    const room = readRoom(roomValue);
    const session = await this.prisma.albumSession.create({
      data: {
        token: randomBytes(24).toString("hex"),
        customerId,
        room,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    });
    return { token: session.token, room: session.room };
  }

  async page(token: string) {
    const session = await this.findOpen(token);
    return albumPage(session.token, session.room);
  }

  async upload(token: string, file: Express.Multer.File | undefined) {
    const session = await this.findOpen(token);
    if (session.fileIds.length >= session.room) {
      throw new BadRequestException(`一次最多 ${session.room} 张`);
    }
    const name = (file?.originalname || "").toLowerCase();
    const mime = (file?.mimetype || "").toLowerCase();
    if (name.endsWith(".heic") || name.endsWith(".heif") || mime === "image/heic" || mime === "image/heif") {
      throw new BadRequestException("这张是 HEIC。请在 iPhone 设置里把照片改成兼容格式，或改选 JPG");
    }
    const image =
      mime === "image/png" || mime === "image/jpeg" || mime === "image/webp" || [...IMAGE_EXT].some((ext) => name.endsWith(ext));
    if (!image) throw new BadRequestException("请选择 JPG、PNG 或 WEBP 照片");
    const saved = await this.files.upload(session.customerId, file);
    await this.prisma.albumSession.update({
      where: { id: session.id },
      data: { fileIds: { push: saved.id } },
    });
    return saved;
  }

  async filesForCustomer(customerId: string, token: string) {
    const session = await this.prisma.albumSession.findFirst({ where: { token, customerId } });
    if (!session) throw new NotFoundException("选图记录不存在");
    if (session.fileIds.length === 0) return { files: [] };
    const rows = await this.prisma.fileAsset.findMany({
      where: { id: { in: session.fileIds }, customerId },
    });
    const order = new Map(session.fileIds.map((id, index) => [id, index]));
    rows.sort((left, right) => (order.get(left.id) ?? 0) - (order.get(right.id) ?? 0));
    return { files: rows.map(presentFile) };
  }

  private async findOpen(token: string) {
    const session = await this.prisma.albumSession.findUnique({ where: { token } });
    if (!session || session.expiresAt.getTime() <= Date.now()) throw new NotFoundException("选图已过期，请返回重试");
    return session;
  }
}

function readRoom(value: unknown) {
  const room = Number(value ?? MAX_ORDER_ITEMS);
  if (!Number.isInteger(room) || room < 1) return MAX_ORDER_ITEMS;
  return Math.min(room, MAX_ORDER_ITEMS);
}
