import crypto from "node:crypto";
import { open, rename, stat, unlink } from "node:fs/promises";
import path from "node:path";
import type { Knex } from "knex";

import type { CanvasProductionScope } from "../assets-v1";
import {
  ensureProjectMediaDirectories,
  resolveProjectMediaPath,
  sha256File,
} from "../projectMedia";

export class CanvasV1LocalOutputError extends Error {
  constructor(public readonly code:
    | "LOCAL_OUTPUT_SCOPE_INVALID"
    | "LOCAL_OUTPUT_TASK_SCOPE_MISMATCH"
    | "LOCAL_OUTPUT_CONFLICT"
    | "LOCAL_OUTPUT_PERSISTENCE_FAILED") {
    super("Canvas output could not be persisted locally.");
    this.name = "CanvasV1LocalOutputError";
  }
}

export interface PersistLocalCanvasOutputInput {
  database: Knex;
  scope: CanvasProductionScope;
  taskId: string;
  assetId: string;
  content: Buffer;
  mimeType: "video/mp4";
  projectsRoot: string;
  now?: () => Date;
}

export interface PersistLocalCanvasOutputResult {
  outputAssetId: string;
  duplicate: boolean;
  localPath: string;
}

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

function sha256(content: Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function publishAtomic(filePath: string, content: Buffer, digest: string): Promise<boolean> {
  try {
    const existing = await stat(filePath);
    if (!existing.isFile() || existing.size !== content.byteLength || await sha256File(filePath) !== digest) {
      throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_CONFLICT");
    }
    return false;
  } catch (error) {
    if (error instanceof CanvasV1LocalOutputError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_PERSISTENCE_FAILED");
    }
  }

  const tempPath = path.join(path.dirname(filePath), `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  let temp;
  try {
    temp = await open(tempPath, "wx", 0o600);
    await temp.writeFile(content);
    await temp.sync();
  } catch {
    await temp?.close().catch(() => undefined);
    await unlink(tempPath).catch(() => undefined);
    throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_PERSISTENCE_FAILED");
  }
  await temp.close();

  try {
    const reservation = await open(filePath, "wx", 0o600);
    await reservation.close();
  } catch {
    await unlink(tempPath).catch(() => undefined);
    try {
      const existing = await stat(filePath);
      if (existing.isFile() && existing.size === content.byteLength && await sha256File(filePath) === digest) {
        return false;
      }
    } catch { /* fixed error below */ }
    throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_CONFLICT");
  }

  try {
    await rename(tempPath, filePath);
    const directory = await open(path.dirname(filePath), "r");
    await directory.sync();
    await directory.close();
    return true;
  } catch {
    await unlink(tempPath).catch(() => undefined);
    await unlink(filePath).catch(() => undefined);
    throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_PERSISTENCE_FAILED");
  }
}

export async function persistLocalCanvasOutput(
  input: PersistLocalCanvasOutputInput,
): Promise<PersistLocalCanvasOutputResult> {
  if (!UUID.test(input.taskId) || !UUID.test(input.assetId) || input.content.byteLength < 1
    || input.mimeType !== "video/mp4" || !Number.isSafeInteger(input.scope.localProjectId)
    || input.scope.localProjectId <= 0) {
    throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_SCOPE_INVALID");
  }
  const tasks = await input.database("sc_tasks")
    .where({ id: input.taskId, projectId: input.scope.localProjectId }).limit(2);
  if (tasks.length !== 1) {
    throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_TASK_SCOPE_MISMATCH");
  }

  await ensureProjectMediaDirectories(input.scope.localProjectId, input.projectsRoot);
  const localPath = resolveProjectMediaPath(
    input.scope.localProjectId,
    "videos",
    input.assetId,
    "mp4",
    input.projectsRoot,
  );
  const digest = sha256(input.content);
  const createdFile = await publishAtomic(localPath, input.content, digest);
  const occurredAt = (input.now ?? (() => new Date()))().toISOString();

  try {
    const duplicate = await input.database.transaction(async (transaction) => {
      const rows = await transaction("sc_media_assets").where({ id: input.assetId }).limit(2);
      if (rows.length > 1) throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_CONFLICT");
      const existing = rows[0];
      if (existing) {
        if (Number(existing.projectId) !== input.scope.localProjectId
          || existing.type !== "video"
          || existing.source !== "generated"
          || existing.mimeType !== input.mimeType
          || Number(existing.byteSize) !== input.content.byteLength
          || existing.sha256 !== digest
          || existing.localPath !== localPath) {
          throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_CONFLICT");
        }
        return true;
      }
      await transaction("sc_media_assets").insert({
        id: input.assetId,
        projectId: input.scope.localProjectId,
        type: "video",
        source: "generated",
        originalName: `${input.taskId}.mp4`,
        mimeType: input.mimeType,
        byteSize: input.content.byteLength,
        localPath,
        remoteUrl: null,
        provider: "byteplus",
        prompt: null,
        sha256: digest,
        rightsNote: "Canvas V1 generated output stored in the controlled local project root",
        metadataJson: JSON.stringify({
          taskId: input.taskId,
          storage: { provider: "storycanvas-local" },
        }),
        createdAt: occurredAt,
      });
      return false;
    });
    return { outputAssetId: input.assetId, duplicate: duplicate || !createdFile, localPath };
  } catch (error) {
    if (error instanceof CanvasV1LocalOutputError) throw error;
    throw new CanvasV1LocalOutputError("LOCAL_OUTPUT_CONFLICT");
  }
}
