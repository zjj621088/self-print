import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadEnvFile } from "./env";
import { isDirectPrintable, printFile, type PrintRequest } from "./print";

loadEnvFile(path.join(__dirname, "../.env"));

type Job = {
  id: string;
  orderNo: string;
  pickupCode?: string | null;
  copies: number;
  duplex: boolean;
  paperSize: string;
  colorMode: string;
  pageRange: string;
  file: { originalName: string; mimeType: string };
};

const apiBase = process.env.API_BASE ?? "http://127.0.0.1:3000/api";
const token = process.env.AGENT_TOKEN ?? "";
const printMode = process.env.PRINT_MODE === "system" ? "system" : "mock";
const printers = (process.env.PRINTERS ?? "前台打印机")
  .split(",")
  .map((name) => name.trim())
  .filter(Boolean);
const pollMs = Number(process.env.POLL_MS ?? 3000);
const outDir = path.resolve(process.env.PRINT_OUT_DIR ?? "printed");

if (!token) {
  console.error("缺少 AGENT_TOKEN。演示环境可使用 agt_dev_demo_store_token");
  process.exit(1);
}

let stopped = false;

async function main() {
  console.log(`打印代理已启动 ${apiBase} mode=${printMode} printers=${printers.join(",") || "(none)"}`);
  while (!stopped) {
    try {
      await heartbeat();
      const jobs = (await api("/agent/jobs")) as Job[];
      for (const job of jobs) {
        if (stopped) break;
        await processJob(job);
      }
    } catch (error) {
      console.error(error instanceof Error ? error.message : error);
    }
    await sleep(pollMs);
  }
}

async function heartbeat() {
  const body = { printers: printers.map((name) => ({ name, status: "online" })) };
  const result = (await api("/agent/heartbeat", { method: "POST", body })) as { unknown?: string[] };
  if (result.unknown?.length) {
    console.error(`后台没有这些打印机，请在商家后台用相同名称创建：${result.unknown.join("、")}`);
  }
}

async function processJob(job: Job) {
  const printerName = printers[0];
  if (!printerName) {
    console.error(`跳过 ${job.orderNo}：未配置 PRINTERS`);
    return;
  }
  let systemName = printerName;
  try {
    const claimed = (await api(`/agent/jobs/${job.id}/claim`, {
      method: "POST",
      body: { printerName },
    })) as { printer?: { systemName?: string } };
    if (claimed.printer?.systemName) systemName = claimed.printer.systemName;
  } catch (error) {
    const status = error instanceof ApiError ? error.status : 0;
    if (status === 400 || status === 409) {
      console.error(`跳过 ${job.orderNo}：${error instanceof Error ? error.message : error}`);
      return;
    }
    throw error;
  }

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "selfprint-"));
  const filePath = path.join(tempDir, safeName(job.file.originalName));
  try {
    await api(`/agent/jobs/${job.id}/printing`, { method: "POST", body: {} });
    const bytes = await apiBuffer(`/agent/jobs/${job.id}/file`);
    await writeFile(filePath, bytes);
    if (printMode === "system" && !isDirectPrintable(job.file.mimeType, job.file.originalName)) {
      throw new Error("请上传 PDF 或图片，Office 文档暂不支持直接打印");
    }
    const request: PrintRequest = {
      filePath,
      systemName,
      copies: job.copies,
      duplex: job.duplex,
      paperSize: job.paperSize,
      colorMode: job.colorMode,
      pageRange: job.pageRange,
      orderNo: job.orderNo,
      pickupCode: job.pickupCode,
      originalName: job.file.originalName,
    };
    const summary = await printFile(request, printMode, outDir);
    await api(`/agent/jobs/${job.id}/done`, { method: "POST", body: {} });
    console.log(`已打印 ${job.orderNo}${job.pickupCode ? ` 取件码 ${job.pickupCode}` : ""} ${summary}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "打印失败";
    await api(`/agent/jobs/${job.id}/fail`, { method: "POST", body: { error: message.slice(0, 200) } }).catch(() => undefined);
    console.error(`打印失败 ${job.orderNo}：${message}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function api(pathname: string, options: { method?: string; body?: unknown } = {}) {
  const res = await fetch(`${apiBase}${pathname}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const message = data && typeof data === "object" && "message" in data ? String(data.message) : res.statusText;
    throw new ApiError(message, res.status);
  }
  return data;
}

async function apiBuffer(pathname: string) {
  const res = await fetch(`${apiBase}${pathname}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new ApiError(`下载文件失败 ${res.status}`, res.status);
  return Buffer.from(await res.arrayBuffer());
}

function safeName(name: string) {
  const cleaned = name.replace(/[^\w.\-\u4e00-\u9fa5]+/g, "_").slice(0, 80);
  return cleaned || "file.bin";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});

void mkdir(outDir, { recursive: true }).finally(() => {
  void main();
});
