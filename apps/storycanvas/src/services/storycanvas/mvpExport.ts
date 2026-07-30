import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import u from "@/utils";
import { ensureMvpProject } from "./mvpGeneration";

interface TaskOutput {
  mediaType?: "image" | "video";
  mediaUrl?: string;
  mediaPath?: string;
}

interface VideoTaskRow {
  id: string;
  inputJson: string;
  outputJson?: string | null;
}

const execFileAsync = promisify(execFile);

function parseJson<T>(source: string | null | undefined): T | undefined {
  if (!source) return undefined;
  try {
    return JSON.parse(source) as T;
  } catch {
    return undefined;
  }
}

async function findLatestVideoTask(projectId: number, shotId: number): Promise<VideoTaskRow> {
  const rows = (await u
    .db("sc_tasks")
    .where({
      projectId,
      taskType: "mvp_video_generation",
      status: "succeeded",
    })
    .orderBy("createdAt", "desc")) as VideoTaskRow[];

  const row = rows.find((candidate) => {
    const input = parseJson<{ shotId?: number }>(candidate.inputJson);
    return input?.shotId === shotId;
  });

  if (!row) throw new Error(`镜头 ${String(shotId).padStart(2, "0")} 还没有成功生成的视频。`);
  return row;
}

async function normalizeClip(inputPath: string, outputPath: string): Promise<void> {
  await execFileAsync(
    "ffmpeg",
    [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      inputPath,
      "-vf",
      "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:black,fps=30",
      "-an",
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "20",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ],
    { timeout: 10 * 60_000, maxBuffer: 10 * 1024 * 1024 },
  );
}

export async function exportMvpProjectVideo(
  shotIds: number[],
  options: { allowLegacyCreate?: boolean } = {},
) {
  if (!shotIds.length) throw new Error("至少选择一个镜头后才能合并。");

  try {
    await execFileAsync("ffmpeg", ["-version"], { timeout: 10_000, maxBuffer: 1024 * 1024 });
  } catch {
    throw new Error("没有检测到 FFmpeg，无法合并视频。");
  }

  const projectId = await ensureMvpProject(options);
  const tempDirectory = await mkdtemp(path.join(os.tmpdir(), "storycanvas-export-"));

  try {
    const normalizedPaths: string[] = [];
    for (const [index, shotId] of shotIds.entries()) {
      const row = await findLatestVideoTask(projectId, shotId);
      const output = parseJson<TaskOutput>(row.outputJson);
      if (!output?.mediaPath) {
        throw new Error(`镜头 ${String(shotId).padStart(2, "0")} 的视频文件记录不完整，请重新生成该镜头。`);
      }

      const inputPath = path.join(tempDirectory, `source-${index + 1}.mp4`);
      const normalizedPath = path.join(tempDirectory, `normalized-${index + 1}.mp4`);
      await writeFile(inputPath, await u.oss.getFile(output.mediaPath));
      await normalizeClip(inputPath, normalizedPath);
      normalizedPaths.push(normalizedPath);
    }

    const concatListPath = path.join(tempDirectory, "concat.txt");
    await writeFile(
      concatListPath,
      normalizedPaths.map((clipPath) => `file '${clipPath.replace(/'/g, "'\\''")}'`).join("\n"),
      "utf8",
    );

    const mergedPath = path.join(tempDirectory, "storycanvas-final.mp4");
    await execFileAsync(
      "ffmpeg",
      [
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        concatListPath,
        "-c",
        "copy",
        "-movflags",
        "+faststart",
        mergedPath,
      ],
      { timeout: 10 * 60_000, maxBuffer: 10 * 1024 * 1024 },
    );

    const exportId = crypto.randomUUID();
    const mediaPath = `/mvp/${projectId}/exports/${exportId}.mp4`;
    await u.oss.writeFile(mediaPath, await readFile(mergedPath));
    const mediaUrl = await u.oss.getFileUrl(mediaPath);

    return {
      id: exportId,
      projectId,
      shotIds,
      mediaPath,
      mediaUrl,
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}
