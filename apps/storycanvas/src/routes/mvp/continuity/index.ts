import express from "express";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { ensureMvpProject } from "@/services/storycanvas/mvpGeneration";
import {
  getMvpContinuityWorkspace,
  updateMvpShotContinuity,
} from "@/services/storycanvas/continuityMemory";

const router = express.Router();

router.get("/", async (_req, res) => {
  try {
    const projectId = await ensureMvpProject();
    res.status(200).send(success(await getMvpContinuityWorkspace(projectId)));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(500).send(error(message));
  }
});

router.put("/shots/:shotId", async (req, res) => {
  const inputSchema = z.object({
    shotId: z.coerce.number().int().positive(),
    body: z.object({
      entitySlugs: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
      relationType: z.enum([
        "continuous-action",
        "same-scene-cut",
        "cross-scene-cut",
        "time-jump",
        "montage",
      ]).optional(),
      preserve: z.array(z.string().trim().min(1).max(300)).max(100).optional(),
      matchOn: z.string().trim().max(40).nullable().optional(),
      usePreviousEndFrame: z.boolean().optional(),
    }).strict(),
  });
  const parsed = inputSchema.safeParse({ shotId: req.params.shotId, body: req.body });
  if (!parsed.success) {
    return res.status(400).send(error("镜头连续性参数错误", parsed.error.issues));
  }

  try {
    const projectId = await ensureMvpProject();
    const workspace = await updateMvpShotContinuity(
      projectId,
      parsed.data.shotId,
      parsed.data.body,
    );
    res.status(200).send(success(workspace, "镜头上下文已更新"));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(400).send(error(message));
  }
});

export default router;
