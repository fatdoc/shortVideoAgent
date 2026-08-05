import crypto from "node:crypto";
import type { Knex } from "knex";
import {
  createSignedTosPutRequest,
  getBytePlusTosUploadTarget,
  type BytePlusTosTarget,
} from "./byteplusTos";

export interface RemoteOutputScope {
  projectId: string | number;
  taskId: string;
  assetId: string;
}

export interface RemoteOutputUpload {
  provider: "byteplus-tos";
  bucket: string;
  key: string;
  storageReference: string;
  checksum: `sha256:${string}`;
  mimeType: string;
  byteSize: number;
  uploadedAt: string;
}

export interface UploadRemoteOutputDependencies {
  resolveTarget?: () => Promise<BytePlusTosTarget>;
  fetch?: typeof fetch;
  now?: () => Date;
  maxAttempts?: number;
}

export interface RegisterRemoteOutputInput {
  scope: RemoteOutputScope;
  upload: RemoteOutputUpload;
  type: "image" | "video" | "audio" | "subtitle" | "preview" | "export" | "other";
  source: "upload" | "generated" | "stock" | "openstoryline";
  originalName?: string;
  provider?: string;
  model?: string;
  promptDigest?: string;
  externalTaskId?: string;
  rightsNote?: string;
  createdAt?: string;
}

export class RemoteOutputStorageError extends Error {
  constructor(
    public readonly code:
      | "REMOTE_STORAGE_SCOPE_INVALID"
      | "REMOTE_STORAGE_CONFIG_MISSING"
      | "REMOTE_STORAGE_UPLOAD_FAILED"
      | "REMOTE_STORAGE_TASK_SCOPE_MISMATCH"
      | "REMOTE_STORAGE_ASSET_CONFLICT",
    message: string,
  ) {
    super(message);
    this.name = "RemoteOutputStorageError";
  }
}

const SAFE_SCOPE_SEGMENT = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const SAFE_MIME = /^(image|video|audio|text|application)\/[A-Za-z0-9.+-]{1,100}$/;

function scopeSegment(value: string | number, label: string): string {
  const normalized = String(value).trim();
  if (!SAFE_SCOPE_SEGMENT.test(normalized) || normalized === "." || normalized === "..") {
    throw new RemoteOutputStorageError(
      "REMOTE_STORAGE_SCOPE_INVALID",
      `${label} 不是合法的远程存储作用域。`,
    );
  }
  return normalized;
}

function safePrefix(prefix: string): string[] {
  if (!prefix) return [];
  if (prefix.startsWith("/") || prefix.includes("\\")) {
    throw new RemoteOutputStorageError("REMOTE_STORAGE_SCOPE_INVALID", "远程存储 prefix 不合法。");
  }
  const segments = prefix.split("/");
  if (segments.some((segment) => !SAFE_SCOPE_SEGMENT.test(segment) || segment === "." || segment === "..")) {
    throw new RemoteOutputStorageError("REMOTE_STORAGE_SCOPE_INVALID", "远程存储 prefix 不合法。");
  }
  return segments;
}

function extensionForMime(mimeType: string): string {
  const extensions: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "audio/mpeg": "mp3",
    "audio/wav": "wav",
    "text/vtt": "vtt",
    "application/json": "json",
  };
  return extensions[mimeType] || "bin";
}

export function buildRemoteOutputKey(
  scope: RemoteOutputScope,
  mimeType: string,
  prefix = "",
): string {
  if (!SAFE_MIME.test(mimeType)) {
    throw new RemoteOutputStorageError("REMOTE_STORAGE_SCOPE_INVALID", "远程输出 MIME 不合法。");
  }
  const projectId = scopeSegment(scope.projectId, "projectId");
  const taskId = scopeSegment(scope.taskId, "taskId");
  const assetId = scopeSegment(scope.assetId, "assetId");
  if (!UUID.test(taskId) || !UUID.test(assetId)) {
    throw new RemoteOutputStorageError(
      "REMOTE_STORAGE_SCOPE_INVALID",
      "taskId 与 assetId 必须是 UUID。",
    );
  }
  return [
    ...safePrefix(prefix),
    "storycanvas",
    "projects",
    projectId,
    "tasks",
    taskId,
    "assets",
    `${assetId}.${extensionForMime(mimeType)}`,
  ].join("/");
}

function retryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

function sha256(content: Buffer): `sha256:${string}` {
  return `sha256:${crypto.createHash("sha256").update(content).digest("hex")}`;
}

export async function uploadRemoteOutput(
  scope: RemoteOutputScope,
  content: Buffer,
  mimeType: string,
  dependencies: UploadRemoteOutputDependencies = {},
): Promise<RemoteOutputUpload> {
  let target: BytePlusTosTarget;
  try {
    target = await (dependencies.resolveTarget ?? getBytePlusTosUploadTarget)();
  } catch {
    throw new RemoteOutputStorageError(
      "REMOTE_STORAGE_CONFIG_MISSING",
      "远程对象存储未配置，无法保存生产输出。",
    );
  }
  const key = buildRemoteOutputKey(scope, mimeType, target.prefix);
  const request = createSignedTosPutRequest(key, content, mimeType, target, dependencies.now?.());
  const fetcher = dependencies.fetch ?? fetch;
  const maxAttempts = Math.max(1, Math.min(dependencies.maxAttempts ?? 3, 5));
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    attempts = attempt;
    try {
      const response = await fetcher(request.url, {
        method: "PUT",
        headers: request.headers,
        body: new Uint8Array(content),
        signal: AbortSignal.timeout(120_000),
      });
      if (response.ok) {
        return {
          provider: "byteplus-tos",
          bucket: target.bucket,
          key,
          storageReference: `tos://${target.bucket}/${key}`,
          checksum: sha256(content),
          mimeType,
          byteSize: content.byteLength,
          uploadedAt: (dependencies.now ?? (() => new Date()))().toISOString(),
        };
      }
      if (!retryableStatus(response.status) || attempt === maxAttempts) break;
    } catch {
      if (attempt === maxAttempts) break;
    }
  }
  throw new RemoteOutputStorageError(
    "REMOTE_STORAGE_UPLOAD_FAILED",
    `远程对象存储上传失败（已尝试 ${attempts} 次）。`,
  );
}

export async function registerRemoteOutputAsset(
  database: Knex | Knex.Transaction,
  input: RegisterRemoteOutputInput,
) {
  const projectId = Number(scopeSegment(input.scope.projectId, "projectId"));
  if (!Number.isSafeInteger(projectId) || projectId <= 0) {
    throw new RemoteOutputStorageError("REMOTE_STORAGE_SCOPE_INVALID", "projectId 不是有效的项目编号。");
  }
  const taskId = scopeSegment(input.scope.taskId, "taskId");
  const assetId = scopeSegment(input.scope.assetId, "assetId");
  const expectedKey = buildRemoteOutputKey(input.scope, input.upload.mimeType, "");
  if (!input.upload.key.endsWith(expectedKey)) {
    throw new RemoteOutputStorageError("REMOTE_STORAGE_SCOPE_INVALID", "上传结果与素材作用域不一致。");
  }

  const task = await database("sc_tasks").where({ id: taskId }).first();
  if (!task || Number(task.projectId) !== projectId) {
    throw new RemoteOutputStorageError(
      "REMOTE_STORAGE_TASK_SCOPE_MISMATCH",
      "任务不属于目标项目，拒绝登记远程素材。",
    );
  }
  const existing = await database("sc_media_assets").where({ id: assetId }).first();
  if (existing) {
    if (Number(existing.projectId) !== projectId || existing.sha256 !== input.upload.checksum.slice(7)) {
      throw new RemoteOutputStorageError(
        "REMOTE_STORAGE_ASSET_CONFLICT",
        "素材 ID 已被其他项目或内容占用。",
      );
    }
    return { assetId, duplicate: true, storageReference: input.upload.storageReference };
  }

  await database("sc_media_assets").insert({
    id: assetId,
    projectId,
    type: input.type,
    source: input.source,
    originalName: input.originalName ?? null,
    mimeType: input.upload.mimeType,
    byteSize: input.upload.byteSize,
    localPath: input.upload.storageReference,
    remoteUrl: null,
    provider: input.provider ?? input.upload.provider,
    prompt: null,
    sha256: input.upload.checksum.slice(7),
    rightsNote: input.rightsNote ?? null,
    metadataJson: JSON.stringify({
      storage: {
        provider: input.upload.provider,
        bucket: input.upload.bucket,
        key: input.upload.key,
      },
      taskId,
      externalTaskId: input.externalTaskId ?? null,
      model: input.model ?? null,
      promptDigest: input.promptDigest ?? null,
      uploadedAt: input.upload.uploadedAt,
    }),
    createdAt: input.createdAt ?? new Date().toISOString(),
  });
  return { assetId, duplicate: false, storageReference: input.upload.storageReference };
}
