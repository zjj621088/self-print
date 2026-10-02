import { Module } from "@nestjs/common";
import { MerchantStoresController, PublicStoresController } from "./stores.controller";
import { StoresService } from "./stores.service";

@Module({
  controllers: [PublicStoresController, MerchantStoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
