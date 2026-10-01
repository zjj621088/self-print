import { spawn } from "node:child_process";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export type PrintRequest = {
  filePath: string;
  systemName: string;
  copies: number;
  duplex: boolean;
  paperSize: string;
  colorMode: string;
  pageRange: string;
  orderNo: string;
  originalName: string;
};

export function isDirectPrintable(mimeType: string, originalName: string): boolean {
  const mime = mimeType.toLowerCase();
  return mime === "application/pdf" || mime.startsWith("image/") || /\.(pdf|png|jpe?g|webp)$/i.test(originalName);
}

export function buildLpArgs(job: PrintRequest): string[] {
  const args = ["-d", job.systemName, "-n", String(job.copies)];
  args.push("-o", job.duplex ? "sides=two-sided-long-edge" : "sides=one-sided");
  if (job.paperSize) args.push("-o", `media=${job.paperSize}`);
  args.push("-o", job.colorMode === "color" ? "ColorModel=RGB" : "ColorModel=Gray");
  const range = job.pageRange.trim();
  if (range && range.toLowerCase() !== "all") {
    args.push("-P", range.replace(/，/g, ",").replace(/\s+/g, ""));
  }
  args.push("--", job.filePath);
  return args;
}

export async function printFile(job: PrintRequest, mode: "mock" | "system", outDir: string): Promise<string> {
  const args = buildLpArgs(job);
  if (mode === "mock") {
    await mkdir(outDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const base = `${stamp}-${job.orderNo}`;
    const copied = path.join(outDir, `${base}${path.extname(job.originalName) || ".bin"}`);
    await copyFile(job.filePath, copied);
    await writeFile(
      path.join(outDir, `${base}.json`),
      JSON.stringify({ command: ["lp", ...args], job, output: copied }, null, 2),
    );
    return `mock ${copied}`;
  }
  await runLp(args);
  return `lp ${args.join(" ")}`;
}

function runLp(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("lp", args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `lp exited ${code}`));
    });
  });
}
