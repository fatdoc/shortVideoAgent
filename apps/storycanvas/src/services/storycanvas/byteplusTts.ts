import crypto from "node:crypto";

export const BYTEPLUS_TTS_PROVIDER = "byteplus" as const;
export const BYTEPLUS_TTS_ENABLE_ENV = "BYTEPLUS_TTS_ENABLED" as const;
export const BYTEPLUS_TTS_PROTOCOL_ENV = "BYTEPLUS_TTS_PROTOCOL" as const;

export type BytePlusTtsFormat = "mp3" | "wav";
export type BytePlusTtsErrorCode =
  | "TTS_DISABLED"
  | "TTS_PROTOCOL_NOT_CONFIGURED"
  | "TTS_PROTOCOL_UNVERIFIED"
  | "TTS_CONFIGURATION_INVALID"
  | "TTS_INPUT_INVALID"
  | "TTS_IDEMPOTENCY_CONFLICT"
  | "TTS_AUTHENTICATION_FAILED"
  | "TTS_PERMISSION_DENIED"
  | "TTS_RATE_LIMITED"
  | "TTS_PROVIDER_TIMEOUT"
  | "TTS_PROVIDER_UNAVAILABLE"
  | "TTS_PROVIDER_REJECTED"
  | "TTS_RESPONSE_INVALID";

export interface BytePlusTtsInput {
  text: string;
  voice: string;
  format: BytePlusTtsFormat;
  sampleRateHz?: 16_000 | 24_000 | 48_000;
  speechRate?: number;
  pitchRate?: number;
  volume?: number;
  idempotencyKey: string;
}

export interface BytePlusTtsTransportRequest extends BytePlusTtsInput {
  requestDigest: string;
}

export interface BytePlusTtsTransportResult {
  audio: Uint8Array;
  mimeType: "audio/mpeg" | "audio/wav";
  providerRequestId?: string;
}

/**
 * Protocol-specific transports must be implemented from a verified BytePlus
 * contract. The production port deliberately has no built-in guessed HTTP
 * endpoint or authentication schema.
 */
export interface BytePlusTtsTransport {
  protocol: string;
  requiredEnvironment: readonly string[];
  synthesize(
    request: BytePlusTtsTransportRequest,
    configuration: Readonly<Record<string, string>>,
  ): Promise<BytePlusTtsTransportResult>;
}

export interface BytePlusTtsConfigurationStatus {
  enabled: boolean;
  configured: boolean;
  executable: boolean;
  code:
    | "BYTEPLUS_TTS_DISABLED"
    | "BYTEPLUS_TTS_PROTOCOL_NOT_CONFIGURED"
    | "BYTEPLUS_TTS_PROTOCOL_UNVERIFIED"
    | "BYTEPLUS_TTS_CONFIGURATION_MISSING"
    | "BYTEPLUS_TTS_READY";
  protocol?: string;
  requiredEnvironment: string[];
  missingEnvironment: string[];
  message: string;
}

export interface BytePlusTtsResult extends BytePlusTtsTransportResult {
  provider: typeof BYTEPLUS_TTS_PROVIDER;
  requestDigest: string;
}

export interface BytePlusTtsHooks {
  onStarted?: (event: { requestDigest: string }) => Promise<void> | void;
  onSucceeded?: (event: { requestDigest: string; providerRequestId?: string }) => Promise<void> | void;
  onFailed?: (error: BytePlusTtsError) => Promise<void> | void;
}

export interface BytePlusTtsAdapterOptions {
  env?: NodeJS.ProcessEnv;
  transports?: readonly BytePlusTtsTransport[];
  maxIdempotencyEntries?: number;
}

export class BytePlusTtsError extends Error {
  readonly code: BytePlusTtsErrorCode;
  readonly retryable: boolean;

  constructor(code: BytePlusTtsErrorCode, message: string, retryable = false) {
    super(message);
    this.name = "BytePlusTtsError";
    this.code = code;
    this.retryable = retryable;
  }
}

function enabledByEnvironment(env: NodeJS.ProcessEnv): boolean {
  return ["1", "true", "yes", "on"].includes((env[BYTEPLUS_TTS_ENABLE_ENV] || "false").trim().toLowerCase());
}

function normalizeProtocol(value: string | undefined): string | undefined {
  const protocol = value?.trim().toLowerCase();
  return protocol || undefined;
}

function uniqueEnvironmentNames(names: readonly string[]): string[] {
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function selectTransport(
  protocol: string | undefined,
  transports: readonly BytePlusTtsTransport[],
): BytePlusTtsTransport | undefined {
  if (!protocol) return undefined;
  return transports.find((transport) => normalizeProtocol(transport.protocol) === protocol);
}

export function inspectBytePlusTtsConfiguration(
  env: NodeJS.ProcessEnv = process.env,
  transports: readonly BytePlusTtsTransport[] = [],
): BytePlusTtsConfigurationStatus {
  if (!enabledByEnvironment(env)) {
    return {
      enabled: false,
      configured: false,
      executable: false,
      code: "BYTEPLUS_TTS_DISABLED",
      requiredEnvironment: [BYTEPLUS_TTS_ENABLE_ENV, BYTEPLUS_TTS_PROTOCOL_ENV],
      missingEnvironment: [],
      message: "独立 TTS 默认安全关闭；只有显式启用并注册已核验的 BytePlus 协议后才可执行。",
    };
  }

  const protocol = normalizeProtocol(env[BYTEPLUS_TTS_PROTOCOL_ENV]);
  if (!protocol) {
    return {
      enabled: true,
      configured: false,
      executable: false,
      code: "BYTEPLUS_TTS_PROTOCOL_NOT_CONFIGURED",
      requiredEnvironment: [BYTEPLUS_TTS_PROTOCOL_ENV],
      missingEnvironment: [BYTEPLUS_TTS_PROTOCOL_ENV],
      message: "已启用独立 TTS，但尚未指定经核验的 BytePlus TTS 协议。",
    };
  }

  const transport = selectTransport(protocol, transports);
  if (!transport) {
    return {
      enabled: true,
      configured: false,
      executable: false,
      code: "BYTEPLUS_TTS_PROTOCOL_UNVERIFIED",
      protocol,
      requiredEnvironment: [BYTEPLUS_TTS_PROTOCOL_ENV],
      missingEnvironment: [],
      message: `协议 ${protocol} 没有已注册、已核验的服务端 Transport；禁止猜测接口并发起请求。`,
    };
  }

  const requiredEnvironment = uniqueEnvironmentNames(transport.requiredEnvironment);
  const missingEnvironment = requiredEnvironment.filter((name) => !env[name]?.trim());
  if (missingEnvironment.length) {
    return {
      enabled: true,
      configured: false,
      executable: true,
      code: "BYTEPLUS_TTS_CONFIGURATION_MISSING",
      protocol,
      requiredEnvironment,
      missingEnvironment,
      message: `BytePlus TTS 协议 ${protocol} 缺少服务端配置：${missingEnvironment.join(", ")}。`,
    };
  }

  return {
    enabled: true,
    configured: true,
    executable: true,
    code: "BYTEPLUS_TTS_READY",
    protocol,
    requiredEnvironment,
    missingEnvironment: [],
    message: "已注册经核验的 BytePlus TTS Transport，且其服务端配置齐全；本检查不产生付费请求。",
  };
}

function normalizedInput(input: BytePlusTtsInput): BytePlusTtsTransportRequest {
  const text = input.text?.trim();
  const voice = input.voice?.trim();
  const idempotencyKey = input.idempotencyKey?.trim();
  if (!text || text.length > 5_000) {
    throw new BytePlusTtsError("TTS_INPUT_INVALID", "TTS 文本必须为 1 到 5000 个字符。", false);
  }
  if (!voice || voice.length > 200) {
    throw new BytePlusTtsError("TTS_INPUT_INVALID", "TTS 音色标识必须为 1 到 200 个字符。", false);
  }
  if (!new Set(["mp3", "wav"]).has(input.format)) {
    throw new BytePlusTtsError("TTS_INPUT_INVALID", "TTS 输出格式只允许 mp3 或 wav。", false);
  }
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 200) {
    throw new BytePlusTtsError("TTS_INPUT_INVALID", "TTS 幂等键长度必须为 8 到 200 个字符。", false);
  }

  const bounded = (name: string, value: number | undefined, minimum: number, maximum: number) => {
    if (value === undefined) return undefined;
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new BytePlusTtsError("TTS_INPUT_INVALID", `${name} 必须在 ${minimum} 到 ${maximum} 之间。`, false);
    }
    return value;
  };
  const requestWithoutDigest = {
    text,
    voice,
    format: input.format,
    ...(input.sampleRateHz !== undefined
      ? (() => {
        if (![16_000, 24_000, 48_000].includes(input.sampleRateHz)) {
          throw new BytePlusTtsError("TTS_INPUT_INVALID", "sampleRateHz 只允许 16000、24000 或 48000。", false);
        }
        return { sampleRateHz: input.sampleRateHz };
      })()
      : {}),
    ...(input.speechRate !== undefined ? { speechRate: bounded("speechRate", input.speechRate, 0.5, 2) } : {}),
    ...(input.pitchRate !== undefined ? { pitchRate: bounded("pitchRate", input.pitchRate, 0.5, 2) } : {}),
    ...(input.volume !== undefined ? { volume: bounded("volume", input.volume, 0, 1) } : {}),
  };
  const requestDigest = crypto.createHash("sha256").update(JSON.stringify(requestWithoutDigest)).digest("hex");
  return { ...requestWithoutDigest, idempotencyKey, requestDigest };
}

function configurationForTransport(
  env: NodeJS.ProcessEnv,
  transport: BytePlusTtsTransport,
): Readonly<Record<string, string>> {
  return Object.freeze(Object.fromEntries(
    uniqueEnvironmentNames(transport.requiredEnvironment).map((name) => [name, env[name]!.trim()]),
  ));
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== "object") return undefined;
  const record = error as Record<string, unknown>;
  for (const key of ["status", "statusCode"]) {
    if (typeof record[key] === "number") return record[key] as number;
  }
  return undefined;
}

function safeProviderMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/Bearer\s+[^\s,;]+/gi, "Bearer <redacted>")
    .replace(/([?&](?:token|key|secret)=)[^&\s]+/gi, "$1<redacted>")
    .slice(0, 500);
}

export function mapBytePlusTtsError(error: unknown): BytePlusTtsError {
  if (error instanceof BytePlusTtsError) return error;
  const status = errorStatus(error);
  const message = safeProviderMessage(error);
  if (status === 401 || /authentication|unauthorized|invalid (?:api )?key|invalid token/i.test(message)) {
    return new BytePlusTtsError("TTS_AUTHENTICATION_FAILED", "BytePlus TTS 鉴权失败，请检查独立 TTS 凭据。", false);
  }
  if (status === 403 || /permission|forbidden|access denied|not entitled/i.test(message)) {
    return new BytePlusTtsError("TTS_PERMISSION_DENIED", "BytePlus TTS 未授权，请确认已单独开通语音合成权限。", false);
  }
  if (status === 429 || /rate.?limit|too many requests/i.test(message)) {
    return new BytePlusTtsError("TTS_RATE_LIMITED", "BytePlus TTS 请求受限，请稍后重试。", true);
  }
  if (status === 408 || /timeout|timed out|aborted|ETIMEDOUT/i.test(message)) {
    return new BytePlusTtsError("TTS_PROVIDER_TIMEOUT", "BytePlus TTS 请求超时，可使用同一幂等键安全重试。", true);
  }
  if ((status !== undefined && status >= 500) || /ECONN|EAI_AGAIN|ENOTFOUND|network|fetch failed/i.test(message)) {
    return new BytePlusTtsError("TTS_PROVIDER_UNAVAILABLE", "BytePlus TTS 服务暂时不可用，可使用同一幂等键安全重试。", true);
  }
  return new BytePlusTtsError(
    "TTS_PROVIDER_REJECTED",
    "BytePlus TTS 拒绝了请求；供应商原始响应仅可记录在受控服务端日志中。",
    false,
  );
}

function assertTransportResult(result: BytePlusTtsTransportResult): void {
  if (!(result.audio instanceof Uint8Array) || result.audio.byteLength === 0) {
    throw new BytePlusTtsError("TTS_RESPONSE_INVALID", "BytePlus TTS 响应中没有有效音频数据。", false);
  }
  if (!new Set(["audio/mpeg", "audio/wav"]).has(result.mimeType)) {
    throw new BytePlusTtsError("TTS_RESPONSE_INVALID", "BytePlus TTS 返回了不受支持的音频格式。", false);
  }
}

export function createBytePlusTtsAdapter(options: BytePlusTtsAdapterOptions = {}) {
  const env = options.env ?? process.env;
  const transports = options.transports ?? [];
  const maximumEntries = Math.max(1, options.maxIdempotencyEntries ?? 1_000);
  const executions = new Map<string, {
    requestDigest: string;
    promise: Promise<BytePlusTtsResult>;
    settled: boolean;
  }>();

  return {
    inspect: () => inspectBytePlusTtsConfiguration(env, transports),
    async synthesize(input: BytePlusTtsInput, hooks: BytePlusTtsHooks = {}): Promise<BytePlusTtsResult> {
      const status = inspectBytePlusTtsConfiguration(env, transports);
      if (!status.enabled) throw new BytePlusTtsError("TTS_DISABLED", status.message, false);
      if (status.code === "BYTEPLUS_TTS_PROTOCOL_NOT_CONFIGURED") {
        throw new BytePlusTtsError("TTS_PROTOCOL_NOT_CONFIGURED", status.message, false);
      }
      if (status.code === "BYTEPLUS_TTS_PROTOCOL_UNVERIFIED") {
        throw new BytePlusTtsError("TTS_PROTOCOL_UNVERIFIED", status.message, false);
      }
      if (!status.configured || !status.protocol) {
        throw new BytePlusTtsError("TTS_CONFIGURATION_INVALID", status.message, false);
      }

      const request = normalizedInput(input);
      const idempotencyKey = input.idempotencyKey.trim();
      const existing = executions.get(idempotencyKey);
      if (existing) {
        if (existing.requestDigest !== request.requestDigest) {
          throw new BytePlusTtsError(
            "TTS_IDEMPOTENCY_CONFLICT",
            "同一 TTS 幂等键不能用于不同请求内容。",
            false,
          );
        }
        return existing.promise;
      }

      const transport = selectTransport(status.protocol, transports)!;
      const promise = (async () => {
        try {
          await hooks.onStarted?.({ requestDigest: request.requestDigest });
          const result = await transport.synthesize(request, configurationForTransport(env, transport));
          assertTransportResult(result);
          await hooks.onSucceeded?.({
            requestDigest: request.requestDigest,
            providerRequestId: result.providerRequestId,
          });
          return {
            ...result,
            provider: BYTEPLUS_TTS_PROVIDER,
            requestDigest: request.requestDigest,
          };
        } catch (cause) {
          const error = mapBytePlusTtsError(cause);
          await hooks.onFailed?.(error);
          throw error;
        }
      })();

      const entry = { requestDigest: request.requestDigest, promise, settled: false };
      executions.set(idempotencyKey, entry);
      void promise.then(
        () => { entry.settled = true; },
        (error: unknown) => {
          entry.settled = true;
          if (error instanceof BytePlusTtsError && error.retryable && executions.get(idempotencyKey) === entry) {
            executions.delete(idempotencyKey);
          }
        },
      );
      if (executions.size > maximumEntries) {
        const oldestSettled = [...executions.entries()].find(([key, value]) => key !== idempotencyKey && value.settled);
        if (oldestSettled) executions.delete(oldestSettled[0]);
      }
      return promise;
    },
  };
}
