import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inspect } from "node:util";
import { serializeError } from "serialize-error";

const guardedProcess = process as NodeJS.Process & {
  __storyCanvasErrorHandlersInstalled?: boolean;
};

const OUTPUT_ERROR_CODES = new Set(["EIO", "EPIPE"]);

function isOutputError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return OUTPUT_ERROR_CODES.has(code ?? "") ||
    ((error as NodeJS.ErrnoException).syscall === "write" && /\b(?:EIO|EPIPE)\b/.test(error.message));
}

function getErrorLogPath(): string {
  return process.env.STORYCANVAS_ERROR_LOG_PATH || path.join(os.tmpdir(), "storycanvas-error.log");
}

function appendToErrorLog(message: string): void {
  try {
    const logPath = getErrorLogPath();
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}\n`, "utf8");
  } catch {
    // 错误处理器不能再抛出新异常。
  }
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  if (value instanceof Error) return JSON.stringify(serializeError(value), null, 2);
  return inspect(value, { depth: 6, breakLength: 120 });
}

function safeError(...values: unknown[]): void {
  const message = values.map(formatValue).join(" ");
  appendToErrorLog(message);

  try {
    if (!process.stderr.destroyed && process.stderr.writable) {
      process.stderr.write(`${message}\n`, (error) => {
        if (error && !isOutputError(error)) appendToErrorLog(`[stderr 写入失败] ${formatValue(error)}`);
      });
    }
  } catch (error) {
    if (!isOutputError(error)) appendToErrorLog(`[stderr 写入失败] ${formatValue(error)}`);
  }
}

function guardOutputStream(stream: NodeJS.WriteStream): void {
  stream.on("error", (error) => {
    if (!isOutputError(error)) appendToErrorLog(`[输出流异常] ${formatValue(error)}`);
  });
}

if (!guardedProcess.__storyCanvasErrorHandlersInstalled) {
  guardedProcess.__storyCanvasErrorHandlersInstalled = true;
  guardOutputStream(process.stdout);
  guardOutputStream(process.stderr);

  process.on("unhandledRejection", (reason, promise) => {
    safeError("[未处理的 Promise 拒绝]", reason, "Promise:", promise);
  });

  process.on("uncaughtException", (error) => {
    // 终端或启动器退出后，写入断开的 stdout/stderr 不应触发 Electron 循环弹窗。
    if (isOutputError(error)) return;
    safeError("[未捕获的异常]", error);
  });
}
