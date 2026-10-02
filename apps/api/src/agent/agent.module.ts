import { Module } from "@nestjs/common";
import { FilesModule } from "../files/files.module";
import { OrdersModule } from "../orders/orders.module";
import { AgentController } from "./agent.controller";
import { AgentService } from "./agent.service";

@Module({
  imports: [FilesModule, OrdersModule],
  controllers: [AgentController],
  providers: [AgentService],
})
export class AgentModule {}
