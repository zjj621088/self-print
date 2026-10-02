import { Module } from "@nestjs/common";
import { CustomerOrdersController, MerchantOrdersController } from "./orders.controller";
import { OrdersService } from "./orders.service";

@Module({
  controllers: [CustomerOrdersController, MerchantOrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
