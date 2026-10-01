import { createHash, randomBytes, randomInt } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function newAgentToken(): string {
  return `agt_${randomBytes(24).toString("hex")}`;
}

export function storeCodeCandidate(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join("");
}

export function makeOrderNo(now = new Date()): string {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(now)
    .replace(/-/g, "");
  return `SP${day}${randomBytes(3).toString("hex").toUpperCase()}`;
}

export function shanghaiDayStart(now = new Date()): Date {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return new Date(`${day}T00:00:00+08:00`);
}
