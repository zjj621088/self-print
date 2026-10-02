import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { AgentGuard, CustomerGuard, JwtAuthGuard, MerchantGuard } from "./guards";

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, MerchantGuard, CustomerGuard, AgentGuard],
  exports: [AuthService, JwtModule, JwtAuthGuard, MerchantGuard, CustomerGuard, AgentGuard],
})
export class AuthModule {}
