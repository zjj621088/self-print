import { Controller, Get, Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AgentModule } from "./agent/agent.module";
import { AuthModule } from "./auth/auth.module";
import { FilesModule } from "./files/files.module";
import { OrdersModule } from "./orders/orders.module";
import { PrismaModule } from "./prisma.module";
import { StoresModule } from "./stores/stores.module";

@Controller()
class HealthController {
  @Get("health")
  health() {
    return { ok: true };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: [".env", "../../.env"] }),
    PrismaModule,
    AuthModule,
    StoresModule,
    FilesModule,
    OrdersModule,
    AgentModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
