import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";
import { CurrentUser } from "../auth/decorators";
import { CustomerGuard, JwtAuthGuard, MerchantGuard } from "../auth/guards";
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
  constructor(@Inject(FilesService) private readonly files: FilesService) {}

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
