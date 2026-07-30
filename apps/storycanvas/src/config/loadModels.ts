import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ModelCapability, ModelsConfig, ModelTarget } from "./models.schema";
import { modelsConfigSchema } from "./models.schema";

export interface LoadModelsOptions {
  configPath?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedModelTarget extends ModelTarget {
  baseUrl: string;
  apiKey?: string;
}

export interface RuntimeVendorInputs {
  baseUrl?: string;
  apiKey?: string;
}

const DEFAULT_BASE_URLS: Record<string, string> = {
  LLM_BASE_URL: "https://api.openai.com/v1",
  OPENAI_BASE_URL: "https://api.openai.com/v1",
  ARK_BASE_URL: "https://ark.ap-southeast.bytepluses.com/api/v3",
};

export function resolveModelsConfigPath(options: LoadModelsOptions = {}): string {
  return path.resolve(options.configPath ?? options.env?.MODELS_CONFIG_PATH ?? process.env.MODELS_CONFIG_PATH ?? "config/models.json");
}

export async function loadModels(options: LoadModelsOptions = {}): Promise<ModelsConfig> {
  const configPath = resolveModelsConfigPath(options);
  const source = await readFile(configPath, "utf8");
  let parsed: unknown;

  try {
    parsed = JSON.parse(source);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`模型配置不是有效 JSON（${configPath}）：${message}`);
  }

  const result = modelsConfigSchema.safeParse(parsed);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ");
    throw new Error(`模型配置校验失败（${configPath}）：${details}`);
  }
  return result.data;
}

export function resolveModelTarget(target: ModelTarget, env: NodeJS.ProcessEnv = process.env): ResolvedModelTarget {
  const baseUrl = env[target.baseUrlEnv] || DEFAULT_BASE_URLS[target.baseUrlEnv];
  if (!baseUrl) throw new Error(`缺少模型地址环境变量 ${target.baseUrlEnv}`);

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error(`模型地址环境变量 ${target.baseUrlEnv} 不是有效 URL`);
  }
  if (!new Set(["http:", "https:"]).has(parsedUrl.protocol)) {
    throw new Error(`模型地址环境变量 ${target.baseUrlEnv} 只允许 http/https`);
  }

  const apiKey = env[target.apiKeyEnv]?.trim();
  return {
    ...target,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    ...(apiKey ? { apiKey } : {}),
  };
}

function targetForCapability(config: ModelsConfig, capability: ModelCapability, vendorId: string, modelName: string): ModelTarget | undefined {
  const candidates: ModelTarget[] =
    capability === "text"
      ? [config.llm]
      : capability === "image"
        ? [config.image.primary, config.image.fallback]
        : capability === "video"
          ? [config.video]
          : [];
  return candidates.find((candidate) => candidate.vendor === vendorId && candidate.model === modelName);
}

export function getRuntimeVendorInputs(
  config: ModelsConfig,
  capability: ModelCapability,
  vendorId: string,
  modelName: string,
  env: NodeJS.ProcessEnv = process.env,
): RuntimeVendorInputs {
  const target = targetForCapability(config, capability, vendorId, modelName);
  if (!target) return {};
  const resolved = resolveModelTarget(target, env);
  return {
    baseUrl: resolved.baseUrl,
    ...(resolved.apiKey ? { apiKey: resolved.apiKey } : {}),
  };
}

export function listModelTargets(config: ModelsConfig): Array<{ role: string; target: ModelTarget }> {
  return [
    { role: "llm", target: config.llm },
    { role: "image.primary", target: config.image.primary },
    { role: "image.fallback", target: config.image.fallback },
    { role: "video", target: config.video },
  ];
}
