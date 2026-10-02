import {
  Body,
  Controller,
  Get,
  HttpException,
  Inject,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import type { Response } from "express";
import { CurrentUser } from "../auth/decorators";
import { CustomerGuard, JwtAuthGuard, MerchantGuard } from "../auth/guards";
import { AlbumService } from "./album.service";
import { FilesService } from "./files.service";

class UploadBody {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(999)
  pageCount?: number;
}

@Controller()
export class FilesController {
  constructor(
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(AlbumService) private readonly album: AlbumService,
  ) {}

  @Post("customer/album-sessions")
  @UseGuards(JwtAuthGuard, CustomerGuard)
  createAlbum(@CurrentUser() user: { sub: string }, @Body() body: { room?: number | string }) {
    return this.album.create(user.sub, body?.room);
  }

  @Get("customer/album-sessions/:token")
  @UseGuards(JwtAuthGuard, CustomerGuard)
  albumFiles(@CurrentUser() user: { sub: string }, @Param("token") token: string) {
    return this.album.filesForCustomer(user.sub, token);
  }

  @Get("public/album/:token")
  async albumPage(@Param("token") token: string, @Res() res: Response) {
    try {
      res.type("html").send(await this.album.page(token));
    } catch (error) {
      const status = error instanceof HttpException ? error.getStatus() : 500;
      const message = error instanceof HttpException ? error.message : "页面打不开";
      res.status(status).type("html").send(`<!DOCTYPE html><meta charset="utf-8"><p>${escapeHtml(message)}</p>`);
    }
  }

  @Post("public/album/:token/files")
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadAlbum(@Param("token") token: string, @UploadedFile() file: Express.Multer.File) {
    return this.album.upload(token, file);
  }

  @Post("customer/files")
  @UseGuards(JwtAuthGuard, CustomerGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 20 * 1024 * 1024 } }))
  upload(
    @CurrentUser() user: { sub: string },
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadBody,
  ) {
    return this.files.upload(user.sub, file, body.pageCount);
  }

  @Get("merchant/files/:id")
  @UseGuards(JwtAuthGuard, MerchantGuard)
  async downloadForMerchant(@CurrentUser() user: { sub: string }, @Param("id") id: string) {
    const file = await this.files.openForMerchant(user.sub, id);
    return new StreamableFile(file.stream, {
      type: file.mimeType,
      disposition: contentDisposition(file.originalName),
    });
  }
}

function contentDisposition(filename: string) {
  return `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char] ?? char);
}
