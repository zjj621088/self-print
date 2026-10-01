import { createParamDecorator, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import type { AgentContext, AuthedRequest, JwtPayload } from "../common/types";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtPayload => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.user) throw new UnauthorizedException("请先登录");
  return req.user;
});

export const CurrentAgent = createParamDecorator((_data: unknown, ctx: ExecutionContext): AgentContext => {
  const req = ctx.switchToHttp().getRequest<AuthedRequest>();
  if (!req.agent) throw new UnauthorizedException("打印代理未授权");
  return req.agent;
});
