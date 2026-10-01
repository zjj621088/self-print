export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending_payment: "待支付",
  paid: "待打印",
  printing: "打印中",
  printed: "待取件",
  completed: "已完成",
  cancelled: "已取消",
  failed: "打印失败",
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  queued: "排队",
  claimed: "已领取",
  printing: "打印中",
  done: "已打完",
  failed: "失败",
};

export const PRINTER_STATUS_LABEL: Record<string, string> = {
  online: "在线",
  offline: "离线",
  busy: "忙碌",
  error: "故障",
};

export const COLOR_LABEL: Record<string, string> = { bw: "黑白", color: "彩色" };

export const PRICE_ROWS = [
  { paperSize: "A4", colorMode: "bw", duplex: false, label: "A4 黑白 单面" },
  { paperSize: "A4", colorMode: "bw", duplex: true, label: "A4 黑白 双面" },
  { paperSize: "A4", colorMode: "color", duplex: false, label: "A4 彩色 单面" },
  { paperSize: "A4", colorMode: "color", duplex: true, label: "A4 彩色 双面" },
  { paperSize: "A3", colorMode: "bw", duplex: false, label: "A3 黑白 单面" },
  { paperSize: "A3", colorMode: "bw", duplex: true, label: "A3 黑白 双面" },
  { paperSize: "A3", colorMode: "color", duplex: false, label: "A3 彩色 单面" },
  { paperSize: "A3", colorMode: "color", duplex: true, label: "A3 彩色 双面" },
] as const;

export function formatMoney(fen: number) {
  return `¥${(fen / 100).toFixed(2)}`;
}

export function yuanToFen(yuan: string) {
  const value = Number(yuan);
  if (!Number.isFinite(value) || value < 0 || value > 50) return null;
  return Math.round(value * 100);
}

export function formatDate(iso?: string | null) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}
