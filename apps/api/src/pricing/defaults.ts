export const DEFAULT_PRICE_RULES = [
  { paperSize: "A4" as const, colorMode: "bw" as const, duplex: false, pricePerPage: 20 },
  { paperSize: "A4" as const, colorMode: "bw" as const, duplex: true, pricePerPage: 15 },
  { paperSize: "A4" as const, colorMode: "color" as const, duplex: false, pricePerPage: 100 },
  { paperSize: "A4" as const, colorMode: "color" as const, duplex: true, pricePerPage: 80 },
  { paperSize: "A3" as const, colorMode: "bw" as const, duplex: false, pricePerPage: 40 },
  { paperSize: "A3" as const, colorMode: "bw" as const, duplex: true, pricePerPage: 30 },
  { paperSize: "A3" as const, colorMode: "color" as const, duplex: false, pricePerPage: 200 },
  { paperSize: "A3" as const, colorMode: "color" as const, duplex: true, pricePerPage: 160 },
];

export const PRICE_COMBOS = DEFAULT_PRICE_RULES.map(({ paperSize, colorMode, duplex }) => ({
  paperSize,
  colorMode,
  duplex,
}));
