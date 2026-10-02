import { Module } from "@nestjs/common";
import { AlbumService } from "./album.service";
import { FilesController } from "./files.controller";
import { FilesService } from "./files.service";

@Module({
  controllers: [FilesController],
  providers: [FilesService, AlbumService],
  exports: [FilesService],
})
export class FilesModule {}
