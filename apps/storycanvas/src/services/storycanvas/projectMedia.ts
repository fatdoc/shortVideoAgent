import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import isPathInside from "is-path-inside";
import { z } from "zod";
import getPath from "@/utils/getPath";

export const PROJECT_MEDIA_KINDS = ["uploads", "images", "videos", "audio", "subtitles", "previews", "exports", "metadata"] as const;
export type ProjectMediaKind = (typeof PROJECT_MEDIA_KINDS)[number];

const projectIdSchema = z.number().int().positive();
const assetIdSchema = z.uuid();
const extensionSchema = z.enum(["png", "jpg", "jpeg", "webp", "mp4", "mov", "webm", "mp3", "wav", "m4a", "srt", "vtt", "json"]);

export function getProjectMediaRoot(projectId: number, projectsRoot = getPath("projects")): string {
  const safeProjectId = projectIdSchema.parse(projectId);
  const root = path.resolve(projectsRoot);
  const projectRoot = path.resolve(root, String(safeProjectId));
  if (!isPathInside(projectRoot, root)) throw new Error("项目媒体目录越界");
  return projectRoot;
}

export async function ensureProjectMediaDirectories(projectId: number, projectsRoot = getPath("projects")): Promise<string> {
  const projectRoot = getProjectMediaRoot(projectId, projectsRoot);
  await Promise.all(PROJECT_MEDIA_KINDS.map((kind) => mkdir(path.join(projectRoot, kind), { recursive: true })));
  return projectRoot;
}

export function resolveProjectMediaPath(
  projectId: number,
  kind: ProjectMediaKind,
  assetId: string,
  extension: string,
  projectsRoot = getPath("projects"),
): string {
  const projectRoot = getProjectMediaRoot(projectId, projectsRoot);
  if (!PROJECT_MEDIA_KINDS.includes(kind)) throw new Error("不支持的项目媒体目录");
  const safeAssetId = assetIdSchema.parse(assetId);
  const safeExtension = extensionSchema.parse(extension.toLowerCase().replace(/^\./, ""));
  const target = path.resolve(projectRoot, kind, `${safeAssetId}.${safeExtension}`);
  if (!isPathInside(target, projectRoot)) throw new Error("项目媒体路径越界");
  return target;
}

export async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("end", () => resolve(hash.digest("hex")));
  });
}
