import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

export interface BytePlusVideoInput {
  prompt: string;
  referenceImage?: string;
  referenceAssetUris?: string[];
  ratio: "16:9" | "9:16";
  duration: number;
  resolution: "480p" | "720p" | "1080p";
}

export interface BytePlusVideoHooks {
  onTaskCreated?: (taskId: string) => Promise<void> | void;
  onStatus?: (status: string) => Promise<void> | void;
}

interface BytePlusTaskResult {
  id?: string;
  status?: string;
  content?: Record<string, unknown> | Array<Record<string, unknown>>;
  data?: Record<string, unknown>;
  error?: {
    code?: string;
    message?: string;
  };
}

const execFileAsync = promisify(execFile);
const NETWORK_RETRY_COUNT = 4;

class ProviderHttpError extends Error {}

function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const cause = "cause" in error && error.cause ? `; cause=${describeError(error.cause)}` : "";
  return `${error.name}: ${error.message}${cause}`;
}

function isTransientNetworkError(error: unknown): boolean {
  return /fetch failed|network|socket|ECONN|EAI_AGAIN|ENOTFOUND|ETIMEDOUT|timeout|timed out|aborted|UND_ERR/i.test(
    describeError(error),
  );
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}，请先在服务端配置模型密钥。`);
  return value;
}

function getRuntimeConfig() {
  return {
    apiKey: requiredEnvironment("ARK_API_KEY"),
    baseUrl: (process.env.ARK_BASE_URL || "https://ark.ap-southeast.bytepluses.com/api/v3").replace(/\/+$/, ""),
    model: process.env.SEEDANCE_VIDEO_MODEL || "dreamina-seedance-2-0-260128",
    generateAudio: ["1", "true", "yes", "on"].includes(
      (process.env.SEEDANCE_GENERATE_AUDIO || "false").trim().toLowerCase(),
    ),
  };
}

export function buildBytePlusVideoPayload(input: BytePlusVideoInput, model: string, generateAudio = false) {
  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: input.prompt,
    },
  ];

  const trustedAssets = [...new Set(input.referenceAssetUris || [])]
    .filter((value) => value.startsWith("asset://"))
    .slice(0, 9);

  if (trustedAssets.length) {
    for (const assetUri of trustedAssets) {
      content.push({
        type: "image_url",
        image_url: {
          url: assetUri,
        },
        role: "reference_image",
      });
    }
  } else if (input.referenceImage) {
    content.push({
      type: "image_url",
      image_url: {
        url: input.referenceImage,
      },
      role: "first_frame",
    });
  }

  return {
    model,
    content,
    generate_audio: generateAudio,
    ratio: input.ratio,
    duration: input.duration,
    resolution: input.resolution,
    watermark: false,
    return_last_frame: false,
  };
}

async function requestJson<T>(
  url: string,
  init: RequestInit,
  label: string,
  timeoutMs = 60_000,
): Promise<T> {
  for (let attempt = 1; attempt <= NETWORK_RETRY_COUNT; attempt += 1) {
    try {
      const response = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const raw = await response.text();
      let body: unknown;

      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = raw;
      }

      if (!response.ok) {
        throw new ProviderHttpError(
          `${label}失败（HTTP ${response.status}）：${typeof body === "string" ? body : JSON.stringify(body)}`,
        );
      }

      return body as T;
    } catch (error) {
      if (
        error instanceof ProviderHttpError
        || !isTransientNetworkError(error)
        || attempt === NETWORK_RETRY_COUNT
      ) {
        throw error;
      }
      console.warn(`${label}网络异常，第 ${attempt}/${NETWORK_RETRY_COUNT} 次请求失败，准备重试：${describeError(error)}`);
      await wait(attempt * 1_500);
    }
  }

  throw new Error(`${label}失败`);
}

function extractUrl(container: unknown): string | undefined {
  if (!container || typeof container !== "object" || Array.isArray(container)) return undefined;
  const record = container as Record<string, unknown>;
  for (const key of ["video_url", "url", "media_url"]) {
    if (typeof record[key] === "string" && record[key]) return record[key] as string;
  }
  return undefined;
}

export function extractBytePlusVideoUrl(result: BytePlusTaskResult): string | undefined {
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      const url = extractUrl(item);
      if (url) return url;
    }
  }
  return extractUrl(result.content) || extractUrl(result.data);
}

function taskErrorMessage(result: BytePlusTaskResult): string {
  const code = result.error?.code ? `${result.error.code}: ` : "";
  return `${code}${result.error?.message || JSON.stringify(result)}`;
}

export async function generateBytePlusVideo(
  input: BytePlusVideoInput,
  hooks: BytePlusVideoHooks = {},
): Promise<{ taskId: string; videoUrl: string }> {
  const config = getRuntimeConfig();
  const taskUrl = `${config.baseUrl}/contents/generations/tasks`;
  const headers = {
    Authorization: `Bearer ${config.apiKey}`,
    "Content-Type": "application/json",
  };
  const created = await requestJson<BytePlusTaskResult>(
    taskUrl,
    {
      method: "POST",
      headers,
      body: JSON.stringify(buildBytePlusVideoPayload(input, config.model, config.generateAudio)),
    },
    "视频任务提交",
  );
  const taskId = created.id;
  if (!taskId) throw new Error(`视频任务提交成功，但响应中没有任务 ID：${JSON.stringify(created)}`);

  await hooks.onTaskCreated?.(taskId);

  const deadline = Date.now() + 20 * 60_000;
  let previousStatus = "";
  while (Date.now() < deadline) {
    const task = await requestJson<BytePlusTaskResult>(
      `${taskUrl}/${encodeURIComponent(taskId)}`,
      { method: "GET", headers },
      "视频任务查询",
    );
    const status = String(task.status || "unknown").toLowerCase();
    if (status !== previousStatus) {
      previousStatus = status;
      await hooks.onStatus?.(status);
    }

    if (status === "succeeded") {
      const videoUrl = extractBytePlusVideoUrl(task);
      if (!videoUrl) throw new Error(`视频任务成功，但响应中没有视频地址：${JSON.stringify(task)}`);
      return { taskId, videoUrl };
    }

    if (["failed", "cancelled", "expired"].includes(status)) {
      throw new Error(`视频任务生成失败：${taskErrorMessage(task)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(`视频任务等待超时：${taskId}`);
}

function curlBaseArgs(direct: boolean): string[] {
  return [
    ...(direct ? ["--noproxy", "*"] : []),
    "-sS",
    "-L",
    "--fail",
    "--retry",
    "4",
    "--retry-all-errors",
    "--retry-delay",
    "1",
    "--connect-timeout",
    "20",
  ];
}

async function curlDownload(url: string, direct: boolean): Promise<Buffer> {
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "storycanvas-video-"));
  try {
    const probe = await execFileAsync(
      "curl",
      [
        ...curlBaseArgs(direct),
        "--max-time",
        "60",
        "--range",
        "0-0",
        "-D",
        "-",
        "-o",
        "/dev/null",
        url,
      ],
      { timeout: 90_000, maxBuffer: 1024 * 1024 },
    );
    const totalMatch = probe.stdout.match(/content-range:\s*bytes\s+0-0\/(\d+)/i);

    if (!totalMatch) {
      const outputPath = path.join(tempDirectory, "asset.mp4");
      await execFileAsync(
        "curl",
        [...curlBaseArgs(direct), "--max-time", "300", "-o", outputPath, url],
        { timeout: 310_000, maxBuffer: 1024 * 1024 },
      );
      return await readFile(outputPath);
    }

    const totalBytes = Number(totalMatch[1]);
    const chunkSize = 128 * 1024;
    const ranges: Array<{ index: number; start: number; end: number }> = [];
    for (let start = 0, index = 0; start < totalBytes; start += chunkSize, index += 1) {
      ranges.push({
        index,
        start,
        end: Math.min(start + chunkSize - 1, totalBytes - 1),
      });
    }

    const chunks: Buffer[] = new Array(ranges.length);
    let cursor = 0;
    let completed = 0;
    const worker = async () => {
      while (cursor < ranges.length) {
        const range = ranges[cursor];
        cursor += 1;
        const outputPath = path.join(tempDirectory, String(range.index).padStart(5, "0"));
        await execFileAsync(
          "curl",
          [
            ...curlBaseArgs(direct),
            "--max-time",
            "60",
            "--range",
            `${range.start}-${range.end}`,
            "-o",
            outputPath,
            url,
          ],
          { timeout: 310_000, maxBuffer: 1024 * 1024 },
        );
        const chunk = await readFile(outputPath);
        const expectedBytes = range.end - range.start + 1;
        if (chunk.length !== expectedBytes) {
          throw new Error(`视频分片 ${range.index} 大小异常：${chunk.length}/${expectedBytes}`);
        }
        chunks[range.index] = chunk;
        completed += 1;
        if (completed % 10 === 0 || completed === ranges.length) {
          console.log(`视频下载进度：${completed}/${ranges.length}`);
        }
      }
    };
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(16, ranges.length) }, () => worker()),
    );
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure) throw failure.reason;

    const video = Buffer.concat(chunks);
    if (video.length !== totalBytes) {
      throw new Error(`视频合并后大小异常：${video.length}/${totalBytes}`);
    }
    return video;
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function downloadBytePlusVideo(url: string): Promise<Buffer> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  } catch (requestError) {
    try {
      return await curlDownload(url, true);
    } catch (directError) {
      try {
        return await curlDownload(url, false);
      } catch (proxyError) {
        throw new Error(
          `视频下载失败：fetch=${describeError(requestError)}; curl直连=${describeError(directError)}; curl系统网络=${describeError(proxyError)}`,
        );
      }
    }
  }
}
