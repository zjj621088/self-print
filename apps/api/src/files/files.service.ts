import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { detectPageCount, isDirectPrintable } from "../pricing/pages";
import { PrismaService } from "../prisma.service";

const ALLOWED_EXT = new Set([".pdf", ".png", ".jpg", ".jpeg", ".webp", ".doc", ".docx", ".ppt", ".pptx", ".xls", ".xlsx"]);
const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": ".pptx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
};

@Injectable()
export class FilesService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {}

  async upload(customerId: string, file: Express.Multer.File | undefined, declaredPageCount?: number | string) {
    if (!file || !file.buffer?.length) throw new BadRequestException("请上传文件");
    const declared =
      declaredPageCount == null || declaredPageCount === "" ? undefined : Number(declaredPageCount);
    const originalName = decodeOriginalName(file.originalname);
    const ext = extensionOf(originalName, file.mimetype);
    if (!ALLOWED_EXT.has(ext)) throw new BadRequestException("仅支持 PDF、图片和常见 Office 文档");

    const detected = detectPageCount(file.buffer, file.mimetype, originalName);
    let pageCount = detected;
    if (declared != null && !isDirectPrintable(file.mimetype || extMime(ext), originalName)) {
      if (!Number.isInteger(declared) || declared < 1 || declared > 999) {
        throw new BadRequestException("页数需在 1 到 999 之间");
      }
      pageCount = declared;
    }

    const id = randomUUID();
    const storageKey = `${id}${ext}`;
    const full = this.resolve(storageKey);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, file.buffer);
    try {
      const saved = await this.prisma.fileAsset.create({
        data: {
          id,
          customerId,
          originalName,
          mimeType: file.mimetype || extMime(ext),
          size: file.size,
          storageKey,
          pageCount,
        },
      });
      return presentFile(saved);
    } catch (error) {
      await unlink(full).catch(() => undefined);
      throw error;
    }
  }

  async openForMerchant(merchantId: string, fileId: string) {
    const file = await this.prisma.fileAsset.findFirst({
      where: { id: fileId, items: { some: { order: { store: { merchantId } } } } },
    });
    if (!file) throw new NotFoundException("文件不存在");
    return this.open(file);
  }

  open(file: { storageKey: string; mimeType: string; originalName: string }) {
    const full = this.resolve(file.storageKey);
    if (!existsSync(full)) throw new NotFoundException("文件已丢失");
    return {
      stream: createReadStream(full),
      path: full,
      mimeType: file.mimeType,
      originalName: file.originalName,
    };
  }

  private resolve(storageKey: string) {
    if (!/^[a-zA-Z0-9.-]+$/.test(storageKey)) throw new BadRequestException("文件无效");
    const root = path.resolve(this.uploadDir());
    const full = path.resolve(root, storageKey);
    if (!full.startsWith(root + path.sep)) throw new BadRequestException("文件无效");
    return full;
  }

  private uploadDir() {
    return this.config.get<string>("UPLOAD_DIR") || path.join(process.cwd(), "uploads");
  }
}

export function presentFile(file: {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  pageCount: number;
  createdAt: Date;
}) {
  return {
    id: file.id,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: file.size,
    pageCount: file.pageCount,
    printable: isDirectPrintable(file.mimeType, file.originalName),
    createdAt: file.createdAt,
  };
}

function decodeOriginalName(name: string | undefined) {
  const raw = name || "file";
  const decoded = Buffer.from(raw, "latin1").toString("utf8");
  const chosen = decoded.includes("\uFFFD") ? raw : decoded;
  const cleaned = chosen.replace(/[\r\n"/\\]/g, "_").slice(0, 180).trim();
  return cleaned || "file";
}

function extensionOf(originalName: string, mimeType: string) {
  const fromName = path.extname(originalName).toLowerCase();
  if (ALLOWED_EXT.has(fromName)) return fromName;
  return EXT_BY_MIME[mimeType] ?? "";
}

function extMime(ext: string) {
  const found = Object.entries(EXT_BY_MIME).find(([, value]) => value === ext);
  return found?.[0] ?? "application/octet-stream";
}
