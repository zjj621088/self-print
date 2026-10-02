const PRINTABLE_EXT = /\.(pdf|png|jpe?g|webp)$/i;

export function isDirectPrintable(mimeType: string, originalName: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime === "application/pdf" || mime.startsWith("image/") || PRINTABLE_EXT.test(originalName);
}

export function detectPageCount(buffer: Buffer, mimeType: string, originalName: string): number {
  const isPdf = mimeType === "application/pdf" || originalName.toLowerCase().endsWith(".pdf");
  if (!isPdf) return 1;
  const matches = buffer.toString("latin1").match(/\/Type\s*\/Page(?!s)/g);
  if (!matches || matches.length === 0) return 1;
  return Math.min(matches.length, 999);
}
