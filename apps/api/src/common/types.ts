import type { Request } from "express";

export type JwtPayload = {
  sub: string;
  role: "merchant" | "customer";
};

export type AgentContext = {
  id: string;
  storeId: string;
  name: string;
};

export type AuthedRequest = Request & {
  user?: JwtPayload;
  agent?: AgentContext;
};
