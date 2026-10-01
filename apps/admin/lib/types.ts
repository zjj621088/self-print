export type Merchant = { id: string; name: string; phone: string };

export type PriceRule = {
  paperSize: string;
  colorMode: string;
  duplex: boolean;
  pricePerPage: number;
};

export type Printer = {
  id: string;
  name: string;
  systemName: string;
  status: string;
  supportsColor: boolean;
  supportsDuplex: boolean;
  paperSizes: string;
  lastHeartbeatAt?: string | null;
};

export type AgentToken = {
  id: string;
  name: string;
  tokenHint: string;
  revokedAt?: string | null;
  lastSeenAt?: string | null;
  createdAt: string;
};

export type Store = {
  id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  notice: string;
  status: "active" | "inactive";
  printers?: Printer[];
  priceRules?: PriceRule[];
  agentTokens?: AgentToken[];
  _count?: { printers: number; orders: number };
};

export type OrderItem = {
  id: string;
  fileId: string;
  copies: number;
  colorMode: string;
  duplex: boolean;
  paperSize: string;
  pageRange: string;
  pageCount: number;
  unitPrice: number;
  amount: number;
  file: { id: string; originalName: string; mimeType: string; pageCount: number; size: number };
};

export type PrintJob = {
  id: string;
  status: string;
  copies: number;
  error: string;
  printer: { id: string; name: string; systemName: string } | null;
};

export type Order = {
  id: string;
  orderNo: string;
  status: string;
  totalAmount: number;
  remark: string;
  payChannel: string | null;
  paidAt: string | null;
  createdAt: string;
  store: { id: string; name: string; code: string };
  customer: { id: string; nickname: string };
  items: OrderItem[];
  jobs: PrintJob[];
};

export type Dashboard = {
  todayOrderCount: number;
  todayRevenue: number;
  pendingPrint: number;
  printingCount: number;
  storeCount: number;
  recent: Order[];
};
