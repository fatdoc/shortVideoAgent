import { execFile } from "node:child_process";
import { access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import { promisify } from "node:util";
import crypto from "node:crypto";
import { loadModels, resolveModelTarget } from "@/config/loadModels";
import getPath from "@/utils/getPath";
import {
  inspectBytePlusTtsConfiguration,
  type BytePlusTtsTransport,
} from "./byteplusTts";

export type PilotReadinessStatus = "ready" | "degraded" | "unavailable";
export type PilotCapability = "storage" | "image" | "video" | "tts" | "ffmpeg";

export interface PilotCapabilityReadiness {
  capability: PilotCapability;
  status: PilotReadinessStatus;
  code: string;
  configured: boolean;
  executable: boolean;
  message: string;
  provider?: string;
  model?: string;
  details?: Record<string, boolean | string>;
}

export interface PilotMediaReadiness {
  schemaVersion: "pilot-media-readiness.v1";
  status: "ready" | "degraded" | "blocked";
  code: "PILOT_MEDIA_READY" | "PILOT_MEDIA_DEGRADED" | "PILOT_MEDIA_BLOCKED";
  checkedAt: string;
  checks: PilotCapabilityReadiness[];
}

export interface PilotReadinessDependencies {
  env?: NodeJS.ProcessEnv;
  checkLocalStorage?: () => Promise<boolean>;
  inspectFfmpeg?: () => Promise<{ version: string; hasH264: boolean; hasAac: boolean }>;
  ttsTransports?: readonly BytePlusTtsTransport[];
  now?: () => Date;
}

const execFileAsync = promisify(execFile);

async function checkLocalStorage(): Promise<boolean> {
  const root = getPath("oss");
  await mkdir(root, { recursive: true });
  await access(root, constants.R_OK | constants.W_OK);
  return true;
}

async function inspectFfmpeg(): Promise<{ version: string; hasH264: boolean; hasAac: boolean }> {
  const [versionResult, encoderResult] = await Promise.all([
    execFileAsync("ffmpeg", ["-version"], { timeout: 10_000, maxBuffer: 1024 * 1024 }),
    execFileAsync("ffmpeg", ["-hide_banner", "-encoders"], { timeout: 10_000, maxBuffer: 4 * 1024 * 1024 }),
  ]);
  const version = versionResult.stdout.split("\n")[0]?.trim() || "ffmpeg";
  return {
    version,
    hasH264: /\blibx264\b/.test(encoderResult.stdout),
    hasAac: /^\s*A[\.A-Z]{5}\s+aac\b/m.test(encoderResult.stdout),
  };
}

function hasAll(env: NodeJS.ProcessEnv, names: string[]): boolean {
  return names.every((name) => Boolean(env[name]?.trim()));
}

async function storageReadiness(
  env: NodeJS.ProcessEnv,
  checker: () => Promise<boolean>,
): Promise<PilotCapabilityReadiness> {
  try {
    const localWritable = await checker();
    const trustedAssetTosConfigured = hasAll(env, [
      "ARK_ASSET_ACCESS_KEY",
      "ARK_ASSET_SECRET_KEY",
      "ARK_ASSET_GROUP_ID",
      "ARK_ASSET_TOS_BUCKET",
      "ARK_ASSET_TOS_ENDPOINT",
    ]);
    if (trustedAssetTosConfigured) {
      return {
        capability: "storage",
        status: "ready",
        code: "PILOT_STORAGE_REMOTE_READY",
        configured: true,
        executable: true,
        message: "远程对象存储 Adapter 已实现且所需服务端配置存在；本检查不发起上传请求。",
        provider: "byteplus-tos",
        details: {
          localWritable,
          remoteOutputImplemented: true,
          trustedAssetTosConfigured: true,
          verification: "configuration-and-implementation",
        },
      };
    }
    return {
      capability: "storage",
      status: "degraded",
      code: "PILOT_STORAGE_OUTPUT_LOCAL_ONLY",
      configured: localWritable,
      executable: localWritable,
      message: "生成输出可写入本地媒体目录，但还没有持久化到远程对象存储。",
      provider: "local-filesystem",
      details: {
        localWritable,
        remoteOutputImplemented: false,
        trustedAssetTosConfigured,
      },
    };
  } catch {
    return {
      capability: "storage",
      status: "unavailable",
      code: "PILOT_STORAGE_UNAVAILABLE",
      configured: false,
      executable: false,
      message: "本地媒体目录不可写，生成与导出无法落盘。",
    };
  }
}

function modelReadiness(
  capability: "image" | "video",
  target: ReturnType<typeof resolveModelTarget>,
): PilotCapabilityReadiness {
  const prefix = capability === "image" ? "PILOT_IMAGE" : "PILOT_VIDEO";
  if (!target.apiKey) {
    return {
      capability,
      status: "unavailable",
      code: `${prefix}_CREDENTIAL_MISSING`,
      configured: false,
      executable: true,
      message: `缺少 ${target.apiKeyEnv}，服务端已有真实调用实现但无法发起任务。`,
      provider: target.vendor,
      model: target.model,
    };
  }
  return {
    capability,
    status: "ready",
    code: `${prefix}_READY`,
    configured: true,
    executable: true,
    message: "真实供应商调用已实现且所需服务端配置存在；本检查不产生付费请求。",
    provider: target.vendor,
    model: target.model,
    details: { verification: "configuration-and-implementation" },
  };
}

function unavailableModelReadiness(
  capability: "image" | "video",
  cause: unknown,
): PilotCapabilityReadiness {
  const prefix = capability === "image" ? "PILOT_IMAGE" : "PILOT_VIDEO";
  return {
    capability,
    status: "unavailable",
    code: `${prefix}_CONFIG_INVALID`,
    configured: false,
    executable: true,
    message: cause instanceof Error ? cause.message : "模型配置无法读取。",
  };
}

async function ffmpegReadiness(
  inspector: () => Promise<{ version: string; hasH264: boolean; hasAac: boolean }>,
): Promise<PilotCapabilityReadiness> {
  try {
    const result = await inspector();
    if (!result.hasH264 || !result.hasAac) {
      return {
        capability: "ffmpeg",
        status: "unavailable",
        code: "PILOT_FFMPEG_CODEC_MISSING",
        configured: true,
        executable: false,
        message: "FFmpeg 可执行，但缺少导出所需的 libx264 或 AAC 编码器。",
        details: { version: result.version, hasH264: result.hasH264, hasAac: result.hasAac },
      };
    }
    return {
      capability: "ffmpeg",
      status: "ready",
      code: "PILOT_FFMPEG_READY",
      configured: true,
      executable: true,
      message: "FFmpeg 及当前拼接导出所需编码器可执行。",
      details: { version: result.version, hasH264: true, hasAac: true },
    };
  } catch {
    return {
      capability: "ffmpeg",
      status: "unavailable",
      code: "PILOT_FFMPEG_UNAVAILABLE",
      configured: false,
      executable: false,
      message: "未找到可执行的 FFmpeg。",
    };
  }
}

export async function getPilotMediaReadiness(
  dependencies: PilotReadinessDependencies = {},
): Promise<PilotMediaReadiness> {
  const env = dependencies.env ?? process.env;
  const checks: PilotCapabilityReadiness[] = [
    await storageReadiness(env, dependencies.checkLocalStorage ?? checkLocalStorage),
  ];

  try {
    const config = await loadModels({ env });
    checks.push(modelReadiness("image", resolveModelTarget(config.image.fallback, env)));
    checks.push(modelReadiness("video", resolveModelTarget(config.video, env)));
  } catch (cause) {
    checks.push(unavailableModelReadiness("image", cause));
    checks.push(unavailableModelReadiness("video", cause));
  }

  const tts = inspectBytePlusTtsConfiguration(env, dependencies.ttsTransports);
  checks.push({
    capability: "tts",
    status: tts.code === "BYTEPLUS_TTS_READY" ? "ready" : "unavailable",
    code: `PILOT_${tts.code}`,
    configured: tts.configured,
    executable: tts.executable,
    message: tts.message,
    provider: "byteplus",
    ...(tts.protocol ? { model: tts.protocol } : {}),
    details: {
      enabled: tts.enabled,
      protocolVerified: new Set(["BYTEPLUS_TTS_READY", "BYTEPLUS_TTS_CONFIGURATION_MISSING"]).has(tts.code),
      requiredEnvironment: tts.requiredEnvironment.join(","),
      missingEnvironment: tts.missingEnvironment.join(","),
      verification: tts.code === "BYTEPLUS_TTS_READY"
        ? "configuration-and-implementation"
        : "no-paid-request",
    },
  });
  checks.push(await ffmpegReadiness(dependencies.inspectFfmpeg ?? inspectFfmpeg));

  const hasUnavailable = checks.some((check) => check.status === "unavailable");
  const hasDegraded = checks.some((check) => check.status === "degraded");
  const status = hasUnavailable ? "blocked" : hasDegraded ? "degraded" : "ready";
  const code = status === "blocked"
    ? "PILOT_MEDIA_BLOCKED"
    : status === "degraded"
      ? "PILOT_MEDIA_DEGRADED"
      : "PILOT_MEDIA_READY";
  return {
    schemaVersion: "pilot-media-readiness.v1",
    status,
    code,
    checkedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
    checks,
  };
}

export type PilotInternalTokenResult =
  | { authorized: true }
  | { authorized: false; code: "PILOT_INTERNAL_TOKEN_NOT_CONFIGURED" | "PILOT_INTERNAL_TOKEN_INVALID" };

export function authorizePilotInternalRequest(
  provided: string | undefined,
  env: NodeJS.ProcessEnv = process.env,
): PilotInternalTokenResult {
  const expected = env.STORYCANVAS_INTERNAL_TOKEN?.trim();
  if (!expected || expected.length < 32) {
    return { authorized: false, code: "PILOT_INTERNAL_TOKEN_NOT_CONFIGURED" };
  }
  if (!provided) return { authorized: false, code: "PILOT_INTERNAL_TOKEN_INVALID" };
  const expectedDigest = crypto.createHash("sha256").update(expected).digest();
  const providedDigest = crypto.createHash("sha256").update(provided).digest();
  return crypto.timingSafeEqual(expectedDigest, providedDigest)
    ? { authorized: true }
    : { authorized: false, code: "PILOT_INTERNAL_TOKEN_INVALID" };
}
