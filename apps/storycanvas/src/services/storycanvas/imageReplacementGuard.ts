import type { Knex } from "knex";

interface ImageTaskRow {
  id: string;
  projectId: number;
  taskType: string;
  status: string;
  inputJson: string;
  createdAt: string;
}

export async function assertImageReplacementAuthorized(
  projectId: number,
  shotId: number,
  replaceImageTaskId: string | undefined,
  database: Knex,
) {
  const latestImage = await database<ImageTaskRow>("sc_tasks")
    .where({ projectId, taskType: "mvp_image_generation", status: "succeeded" })
    .whereRaw("json_extract(inputJson, '$.shotId') = ?", [shotId])
    .orderBy("createdAt", "desc")
    .first("id", "createdAt");

  if (!latestImage) return;
  if (replaceImageTaskId !== latestImage.id) {
    throw new Error(
      `镜头 ${String(shotId).padStart(2, "0")} 已有生成图片。`
      + "为防止误覆盖，请刷新页面并通过“确认覆盖并重新生成”操作。",
    );
  }
}
