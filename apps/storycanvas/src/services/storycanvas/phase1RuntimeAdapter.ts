import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { appendFile, copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export type RuntimeMode = "DEMO" | "REAL";

export interface RuntimeProviderRequest {
  taskId: string;
  attemptId: string;
  projectId: number;
  shotId: string;
  taskType: "image-generation" | "video-generation";
  model: string;
  resolvedPrompt: string;
  negativePrompt: string;
  inputAssetIds: string[];
  parameters: Record<string, unknown>;
}

export interface RuntimeProviderOutput {
  localPath: string | null;
  remoteUrl: string | null;
  playableUrl: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  providerTaskId: string;
  actualCredit: number;
  sentPrompt: string;
  metadata: Record<string, unknown>;
}

export type RuntimeProviderPollResult =
  | { status: "running"; progress: number }
  | { status: "failed"; errorCode: string; errorMessage: string }
  | { status: "succeeded"; output: RuntimeProviderOutput };

export interface RuntimeProviderAdapter {
  readonly mode: RuntimeMode;
  readonly provider: string;
  submit(request: RuntimeProviderRequest): Promise<{ providerTaskId: string }>;
  poll(providerTaskId: string, request: RuntimeProviderRequest): Promise<RuntimeProviderPollResult>;
  cancel(providerTaskId: string, request: RuntimeProviderRequest): Promise<void>;
}

export interface PlayableAssetValidation {
  status: "valid" | "invalid" | "missing" | "inaccessible";
  playable: boolean;
  durationSeconds: number | null;
  width: number | null;
  height: number | null;
  details: Record<string, unknown>;
}

export type PlayableAssetValidator = (output: RuntimeProviderOutput) => Promise<PlayableAssetValidation>;

export class RealRuntimeAdapterDisabled implements RuntimeProviderAdapter {
  readonly mode = "REAL" as const;
  readonly provider = "REAL_DISABLED";

  async submit(): Promise<{ providerTaskId: string }> {
    throw new Error("REAL_PROVIDER_DISABLED: Phase1 自动化环境禁止真实付费模型调用");
  }

  async poll(): Promise<RuntimeProviderPollResult> {
    throw new Error("REAL_PROVIDER_DISABLED: Phase1 自动化环境禁止真实付费模型轮询");
  }

  async cancel(): Promise<void> {
    throw new Error("REAL_PROVIDER_DISABLED: 没有可取消的真实 Provider 任务");
  }
}

export class DemoFixtureRuntimeAdapter implements RuntimeProviderAdapter {
  readonly mode = "DEMO" as const;
  readonly provider = "StoryCanvasDemoFixture";
  private readonly outputs = new Map<string, RuntimeProviderOutput>();

  constructor(private readonly options: {
    fixturePath: string;
    outputDirectory: string;
    playableBaseUrl?: string;
    actualCredit?: number;
  }) {}

  async submit(request: RuntimeProviderRequest) {
    if (request.taskType !== "video-generation") {
      throw new Error("DEMO_FIXTURE_VIDEO_ONLY: Phase1 DEMO fixture 仅验证视频资产闭环");
    }
    const fixture = await stat(this.options.fixturePath).catch(() => null);
    if (!fixture?.isFile() || fixture.size <= 0) {
      throw new Error("DEMO_FIXTURE_MISSING: 必须配置非空本地视频 fixture");
    }
    await mkdir(this.options.outputDirectory, { recursive: true });
    const providerTaskId = `demo-provider-${crypto.createHash("sha256").update(request.taskId).digest("hex").slice(0, 20)}`;
    const fileName = `${request.taskId}.mp4`;
    const localPath = path.join(this.options.outputDirectory, fileName);
    await copyFile(this.options.fixturePath, localPath);
    await appendFile(localPath, Buffer.from(`\nSTORYCANVAS_DEMO_ATTEMPT:${request.taskId}\n`, "utf8"));
    const playableUrl = this.options.playableBaseUrl
      ? `${this.options.playableBaseUrl.replace(/\/$/, "")}/${fileName}`
      : `file://${localPath}`;
    this.outputs.set(providerTaskId, {
      localPath,
      remoteUrl: null,
      playableUrl,
      mimeType: "video/mp4",
      width: null,
      height: null,
      durationSeconds: null,
      providerTaskId,
      actualCredit: this.options.actualCredit ?? 100,
      sentPrompt: request.resolvedPrompt,
      metadata: { truthMode: "MOCK", fixtureSource: path.basename(this.options.fixturePath) },
    });
    return { providerTaskId };
  }

  async poll(providerTaskId: string): Promise<RuntimeProviderPollResult> {
    const output = this.outputs.get(providerTaskId);
    if (!output) return { status: "failed", errorCode: "DEMO_TASK_NOT_FOUND", errorMessage: "DEMO Provider Task 不存在" };
    return { status: "succeeded", output };
  }

  async cancel(providerTaskId: string): Promise<void> {
    this.outputs.delete(providerTaskId);
  }
}

export const defaultPlayableAssetValidator: PlayableAssetValidator = async (output) => {
  if (!output.localPath && !output.remoteUrl) {
    return { status: "missing", playable: false, durationSeconds: null, width: null, height: null, details: { reason: "NO_MEDIA_LOCATION" } };
  }
  const target = output.localPath || output.remoteUrl!;
  if (output.localPath) {
    const file = await stat(output.localPath).catch(() => null);
    if (!file?.isFile() || file.size <= 0) {
      return { status: "missing", playable: false, durationSeconds: null, width: null, height: null, details: { reason: "LOCAL_FILE_MISSING" } };
    }
  }
  try {
    const { stdout } = await execFileAsync("ffprobe", [
      "-v", "error",
      "-show_entries", "format=duration:stream=codec_type,width,height",
      "-of", "json",
      target,
    ], { timeout: 15_000, maxBuffer: 1_000_000 });
    const probe = JSON.parse(stdout) as {
      format?: { duration?: string };
      streams?: Array<{ codec_type?: string; width?: number; height?: number }>;
    };
    const video = probe.streams?.find((stream) => stream.codec_type === "video");
    const durationSeconds = Number(probe.format?.duration ?? 0);
    if (!video || !Number.isFinite(durationSeconds) || durationSeconds <= 0) {
      return { status: "invalid", playable: false, durationSeconds: null, width: null, height: null, details: { reason: "FFPROBE_NO_PLAYABLE_VIDEO", probe } };
    }
    return {
      status: "valid",
      playable: true,
      durationSeconds,
      width: video.width ?? null,
      height: video.height ?? null,
      details: { validator: "ffprobe", probe },
    };
  } catch (cause) {
    return {
      status: output.remoteUrl ? "inaccessible" : "invalid",
      playable: false,
      durationSeconds: null,
      width: null,
      height: null,
      details: { reason: "FFPROBE_FAILED", message: cause instanceof Error ? cause.message : String(cause) },
    };
  }
};
