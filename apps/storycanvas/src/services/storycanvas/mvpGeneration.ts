import crypto from "node:crypto";
import u from "@/utils";
import { loadModels, resolveModelTarget } from "@/config/loadModels";
import { downloadBytePlusVideo, generateBytePlusVideo } from "./byteplusVideo";
import { resolveMvpShotContext } from "./continuityMemory";
import { assertImageReplacementAuthorized } from "./imageReplacementGuard";
import { assertTrustedCharacterBindings } from "./characterAssetBinding";

export type MvpGenerationKind = "image" | "video";
export type MvpTaskStatus = "queued" | "running" | "succeeded" | "failed";

export interface MvpGenerationInput {
  kind: MvpGenerationKind;
  shotId: number;
  prompt: string;
  aspectRatio: "16:9" | "9:16";
  duration: number;
  resolution: "480p" | "720p" | "1080p";
  referenceImage?: string;
  referenceImages?: string[];
  contextRevision?: number;
  replaceImageTaskId?: string;
  idempotencyKey: string;
}

interface StoredTaskInput extends MvpGenerationInput {
  model: string;
  localPrompt: string;
  resolvedContext: Awaited<ReturnType<typeof resolveMvpShotContext>>;
}

interface StoredTaskOutput {
  mediaType: MvpGenerationKind;
  mediaUrl: string;
  mediaPath: string;
}

interface TaskRow {
  id: string;
  projectId: number;
  taskType: string;
  provider: string;
  status: MvpTaskStatus;
  progress: number;
  inputJson: string;
  outputJson?: string | null;
  errorJson?: string | null;
  idempotencyKey: string;
  externalTaskId?: string | null;
  createdAt: string;
  updatedAt: string;
}

const MVP_PROJECT_TYPE = "storycanvas-live-mvp";
const SERVICE_STARTED_AT = new Date().toISOString();
let recoveryComplete = false;

function parseJson<T>(source: string | null | undefined): T | undefined {
  if (!source) return undefined;
  try {
    return JSON.parse(source) as T;
  } catch {
    return undefined;
  }
}

function safeErrorMessage(error: unknown): string {
  const message = u.error(error).message || "生成失败";
  if (/AuthenticationError|API key doesn't exist/i.test(message)) {
    return "火山引擎鉴权失败：API Key 不存在、已失效或复制不完整。";
  }
  if (/AccessDenied|PermissionDenied|Forbidden/i.test(message)) {
    return "火山引擎拒绝访问：请确认已开通当前模型并为 API Key 授权。";
  }
  return message.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer <redacted>");
}

export async function toPublicMvpTask(row: TaskRow) {
  const input = parseJson<StoredTaskInput>(row.inputJson);
  const output = parseJson<StoredTaskOutput>(row.outputJson);
  const taskError = parseJson<{ message?: string; code?: string }>(row.errorJson);
  const mediaUrl = output?.mediaPath
    ? await u.oss.getFileUrl(output.mediaPath)
    : output?.mediaUrl;
  return {
    id: row.id,
    projectId: row.projectId,
    kind: input?.kind,
    shotId: input?.shotId,
    model: input?.model,
    status: row.status,
    progress: Number(row.progress),
    mediaType: output?.mediaType,
    mediaUrl,
    contextVersion: input?.resolvedContext?.contextVersion,
    continuityWarnings: input?.resolvedContext?.warnings ?? [],
    error: taskError?.message,
    errorCode: taskError?.code,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function ensureMvpProject(options: { allowLegacyCreate?: boolean } = {}): Promise<number> {
  const d1Mapping = options.allowLegacyCreate
    ? null
    : await u.db("sc_external_mappings")
      .where({
        system: "saas-control-plane",
        entityType: "project",
        externalId: "demo-local-001",
      })
      .first();
  let project = options.allowLegacyCreate
    ? await u.db("o_project").where("projectType", MVP_PROJECT_TYPE).first()
    : d1Mapping
      ? await u.db("o_project").where("id", Number(d1Mapping.localId)).first()
      : null;

  if (!project?.id) {
    if (!options.allowLegacyCreate) {
      throw new Error("CANONICAL_PACKAGE_REQUIRED：未找到 accepted demo-local-001 映射，禁止旁路创建历史南城咖啡项目。");
    }
    const projectId = Date.now();
    await u.db("o_project").insert({
      id: projectId,
      projectType: MVP_PROJECT_TYPE,
      name: "南城咖啡·真实生成 MVP",
      intro: "使用 Seedream 与 Seedance 完成真实图片和视频生成验证。",
      type: "本地生活",
      artStyle: "写实电影感，自然暖色光，适合竖屏短视频",
      videoRatio: "9:16",
      userId: 1,
      imageModel: "volcengine:seedream-5-0-lite-260128",
      videoModel: "byteplus:dreamina-seedance-2-0-260128",
      imageQuality: "2K",
      mode: "live",
      createTime: Date.now(),
    });
    project = { id: projectId };
  }

  const projectId = Number(project.id);
  const now = new Date().toISOString();
  const profile = await u.db("sc_project_profile").where("projectId", projectId).first();
  if (!profile) {
    await u.db("sc_project_profile").insert({
      projectId,
      category: "local-life-food",
      status: "active",
      briefJson: JSON.stringify({
        city: "本地",
        merchantName: "南城咖啡",
        platform: "douyin",
        targetDurationSeconds: 30,
      }),
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!recoveryComplete) {
    recoveryComplete = true;
    await u
      .db("sc_tasks")
      .where("projectId", projectId)
      .whereIn("status", ["queued", "running"])
      .where("createdAt", "<", SERVICE_STARTED_AT)
      .update({
        status: "failed",
        errorJson: JSON.stringify({
          code: "PROCESS_RESTARTED",
          message: "应用在任务执行期间重启，请重新提交该镜头。",
        }),
        updatedAt: now,
      });
  }

  return projectId;
}

export async function getMvpCapabilities() {
  const config = await loadModels();
  const imageTarget = resolveModelTarget(config.image.fallback);
  const videoTarget = resolveModelTarget(config.video);
  return {
    keyConfigured: Boolean(imageTarget.apiKey || videoTarget.apiKey),
    image: {
      vendor: imageTarget.vendor,
      model: imageTarget.model,
      available: Boolean(imageTarget.apiKey),
    },
    video: {
      vendor: videoTarget.vendor,
      model: videoTarget.model,
      available: Boolean(videoTarget.apiKey),
    },
  };
}

async function updateTask(
  taskId: string,
  values: Partial<Pick<TaskRow, "status" | "progress" | "outputJson" | "errorJson" | "externalTaskId" | "updatedAt">>,
) {
  await u.db("sc_tasks").where("id", taskId).update(values);
}

async function requireTrustedShotCharacters(projectId: number, shotId: number) {
  const { getShotCharacterAssetContext } = await import("./characterAssets");
  const context = await getShotCharacterAssetContext(projectId, shotId);
  assertTrustedCharacterBindings(shotId, context.unboundCharacters);
  return context;
}

async function runMvpGeneration(taskId: string, projectId: number, input: StoredTaskInput): Promise<void> {
  const now = () => new Date().toISOString();
  await updateTask(taskId, { status: "running", progress: 10, updatedAt: now() });

  try {
    let mediaPath: string;
    if (input.kind === "image") {
      const image = u.Ai.Image(input.model as `${string}:${string}`);
      const referenceImages = input.referenceImages?.length
        ? input.referenceImages
        : input.referenceImage
          ? [input.referenceImage]
          : [];
      await image.run({
        prompt: input.prompt,
        referenceList: referenceImages.map((base64) => ({ type: "image" as const, base64 })),
        size: "2K",
        aspectRatio: input.aspectRatio,
      });
      mediaPath = `/mvp/${projectId}/images/${taskId}.jpg`;
      await image.save(mediaPath);
    } else {
      const characterContext = await requireTrustedShotCharacters(projectId, input.shotId);
      const generated = await generateBytePlusVideo({
        prompt: input.prompt,
        referenceImage: characterContext.assetUris.length ? undefined : input.referenceImage,
        referenceAssetUris: characterContext.assetUris,
        duration: input.duration,
        ratio: input.aspectRatio,
        resolution: input.resolution,
      }, {
        onTaskCreated: async (externalTaskId) => {
          await u.db("sc_tasks").where("id", taskId).update({
            externalTaskId,
            progress: 20,
            updatedAt: now(),
          });
        },
        onStatus: async (status) => {
          if (status === "running") {
            await updateTask(taskId, { progress: 45, updatedAt: now() });
          }
        },
      });
      mediaPath = `/mvp/${projectId}/videos/${taskId}.mp4`;
      await u.oss.writeFile(mediaPath, await downloadBytePlusVideo(generated.videoUrl));
    }

    const mediaUrl = await u.oss.getFileUrl(mediaPath);
    await updateTask(taskId, {
      status: "succeeded",
      progress: 100,
      outputJson: JSON.stringify({ mediaType: input.kind, mediaUrl, mediaPath }),
      errorJson: null,
      updatedAt: now(),
    });
  } catch (error) {
    await updateTask(taskId, {
      status: "failed",
      progress: 100,
      errorJson: JSON.stringify({
        code: "PROVIDER_ERROR",
        message: safeErrorMessage(error),
      }),
      updatedAt: now(),
    });
  }
}

export async function createMvpGenerationTask(
  input: MvpGenerationInput,
  options: { allowLegacyCreate?: boolean } = {},
) {
  const projectId = await ensureMvpProject(options);
  const existing = (await u.db("sc_tasks").where("idempotencyKey", input.idempotencyKey).first()) as TaskRow | undefined;
  if (existing) return toPublicMvpTask(existing);

  if (input.kind === "image") {
    await assertImageReplacementAuthorized(
      projectId,
      input.shotId,
      input.replaceImageTaskId,
      u.db as unknown as import("knex").Knex,
    );
  }
  if (input.kind === "video") {
    await requireTrustedShotCharacters(projectId, input.shotId);
  }

  const resolvedContext = await resolveMvpShotContext(projectId, input.shotId, input.prompt);
  if (input.contextRevision && input.contextRevision !== resolvedContext.worldRevision) {
    throw new Error(`世界记忆已从 v${input.contextRevision} 更新到 v${resolvedContext.worldRevision}，请刷新镜头上下文后重试。`);
  }
  if (resolvedContext.errors.length) {
    throw new Error(`连续性检查未通过：${resolvedContext.errors.join("；")}`);
  }

  const config = await loadModels();
  const target = input.kind === "image" ? config.image.fallback : config.video;
  const resolved = resolveModelTarget(target);
  if (!resolved.apiKey) {
    throw new Error(`缺少 ${target.apiKeyEnv}，请先在服务端配置模型密钥。`);
  }

  const taskId = crypto.randomUUID();
  const now = new Date().toISOString();
  const storedInput: StoredTaskInput = {
    ...input,
    localPrompt: input.prompt,
    prompt: resolvedContext.resolvedPrompt,
    resolvedContext,
    model: `${target.vendor}:${target.model}`,
  };
  const {
    referenceImage: _referenceImage,
    referenceImages: _referenceImages,
    ...auditableInput
  } = storedInput;

  await u.db("sc_tasks").insert({
    id: taskId,
    projectId,
    taskType: input.kind === "image" ? "mvp_image_generation" : "mvp_video_generation",
    provider: target.vendor,
    status: "queued",
    progress: 0,
    inputJson: JSON.stringify({
      ...auditableInput,
      referencePayload: {
        hasFirstFrame: Boolean(storedInput.referenceImage),
        memoryImageCount: storedInput.referenceImages?.length ?? 0,
      },
    }),
    idempotencyKey: input.idempotencyKey,
    createdAt: now,
    updatedAt: now,
  });

  void runMvpGeneration(taskId, projectId, storedInput);
  const row = (await u.db("sc_tasks").where("id", taskId).first()) as TaskRow;
  return toPublicMvpTask(row);
}

export async function getMvpTask(taskId: string) {
  const row = (await u.db("sc_tasks").where("id", taskId).first()) as TaskRow | undefined;
  return row ? toPublicMvpTask(row) : undefined;
}

export async function listRecentMvpTasks(projectId: number, limit = 100) {
  const rows = (await u
    .db("sc_tasks")
    .where("projectId", projectId)
    .whereIn("taskType", ["mvp_image_generation", "mvp_video_generation"])
    .orderBy("createdAt", "desc")
    .limit(limit)) as TaskRow[];
  return Promise.all(rows.map(toPublicMvpTask));
}
