export const COLOR_MODES = ["bw", "color"] as const;
export const PAPER_SIZES = ["A4", "A3"] as const;

export type ColorMode = (typeof COLOR_MODES)[number];
export type PaperSize = (typeof PAPER_SIZES)[number];

export type PriceRuleInput = {
  paperSize: string;
  colorMode: string;
  duplex: boolean;
  pricePerPage: number;
};

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

const MAX_PAGES = 999;
const MAX_COPIES = 20;

export function parsePageRange(input: string | null | undefined, pageCount: number): number[] {
  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_PAGES) {
    throw new PricingError(`文件页数需在 1 到 ${MAX_PAGES} 之间`);
  }
  const raw = (input ?? "").trim();
  if (raw === "" || raw.toLowerCase() === "all") {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }

  const pages = new Set<number>();
  for (const part of raw.split(/[,，]/)) {
    const token = part.trim();
    if (!token) continue;
    const range = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (start < 1 || end < start || end > pageCount) {
        throw new PricingError(`页码范围超出文件页数（共 ${pageCount} 页）`);
      }
      for (let page = start; page <= end; page += 1) pages.add(page);
      continue;
    }
    if (/^\d+$/.test(token)) {
      const page = Number(token);
      if (page < 1 || page > pageCount) {
        throw new PricingError(`页码 ${page} 超出文件页数（共 ${pageCount} 页）`);
      }
      pages.add(page);
      continue;
    }
    throw new PricingError("页码格式应为 all、1-3 或 1,3,5-7");
  }

  if (pages.size === 0) throw new PricingError("请至少选择一页");
  return [...pages].sort((a, b) => a - b);
}

export function findUnitPrice(
  rules: PriceRuleInput[],
  paperSize: string,
  colorMode: string,
  duplex: boolean,
): number {
  const rule = rules.find(
    (item) => item.paperSize === paperSize && item.colorMode === colorMode && item.duplex === duplex,
  );
  if (!rule) throw new PricingError("该门店未配置此打印规格的价格");
  if (!Number.isInteger(rule.pricePerPage) || rule.pricePerPage < 0 || rule.pricePerPage > 5000) {
    throw new PricingError("价格配置无效");
  }
  return rule.pricePerPage;
}

export function quoteItem(input: {
  rules: PriceRuleInput[];
  pageCount: number;
  pageRange?: string | null;
  copies: number;
  paperSize: string;
  colorMode: string;
  duplex: boolean;
}): { pages: number[]; pageCount: number; unitPrice: number; amount: number } {
  if (!Number.isInteger(input.copies) || input.copies < 1 || input.copies > MAX_COPIES) {
    throw new PricingError(`份数需在 1 到 ${MAX_COPIES} 之间`);
  }
  const pages = parsePageRange(input.pageRange, input.pageCount);
  const unitPrice = findUnitPrice(input.rules, input.paperSize, input.colorMode, input.duplex);
  return {
    pages,
    pageCount: pages.length,
    unitPrice,
    amount: pages.length * input.copies * unitPrice,
  };
}

export function resolveBillingPageCount(
  file: { pageCount: number; mimeType: string; originalName: string },
  requested: number | undefined,
  printable: boolean,
): number {
  if (printable) return file.pageCount;
  if (requested == null) return file.pageCount;
  if (!Number.isInteger(requested) || requested < 1 || requested > MAX_PAGES) {
    throw new PricingError(`请填写 1 到 ${MAX_PAGES} 的页数`);
  }
  return requested;
}
