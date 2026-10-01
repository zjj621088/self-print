import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { sha256 } from "../common/crypto";
import type { AuthedRequest, JwtPayload } from "../common/types";
import { PrismaService } from "../prisma.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new UnauthorizedException("请先登录");
    try {
      req.user = this.jwt.verify<JwtPayload>(token);
      return true;
    } catch {
      throw new UnauthorizedException("登录已失效");
    }
  }
}

@Injectable()
export class MerchantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== "merchant") throw new ForbiddenException("需要商家登录");
    return true;
  }
}

@Injectable()
export class CustomerGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    if (req.user?.role !== "customer") throw new ForbiddenException("需要顾客登录");
    return true;
  }
}

@Injectable()
export class AgentGuard implements CanActivate {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!token) throw new UnauthorizedException("打印代理未授权");
    const row = await this.prisma.agentToken.findUnique({ where: { tokenHash: sha256(token) } });
    if (!row || row.revokedAt) throw new UnauthorizedException("打印代理未授权");
    await this.prisma.agentToken.update({
      where: { id: row.id },
      data: { lastSeenAt: new Date() },
    });
    req.agent = { id: row.id, storeId: row.storeId, name: row.name };
    return true;
  }
}
