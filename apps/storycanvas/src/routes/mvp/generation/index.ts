import express from "express";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import {
  createMvpGenerationTask,
  ensureMvpProject,
  getMvpCapabilities,
  listRecentMvpTasks,
} from "@/services/storycanvas/mvpGeneration";
import { getMvpContinuityWorkspace } from "@/services/storycanvas/continuityMemory";

const router = express.Router();

router.use((req, res, next) => {
  if (req.header("x-storycanvas-mode") !== "legacy") {
    res.status(403).send(error("D1 canonical 模式禁止旧生成入口", {
      code: "LEGACY_MODE_REQUIRED",
      requiredHeader: "X-StoryCanvas-Mode: legacy",
    }));
    return;
  }
  next();
});

router.get("/", async (_req, res) => {
  try {
    const projectId = await ensureMvpProject({ allowLegacyCreate: true });
    const [capabilities, recentTasks, continuity] = await Promise.all([
      getMvpCapabilities(),
      listRecentMvpTasks(projectId),
      getMvpContinuityWorkspace(projectId),
    ]);
    res.status(200).send(success({ projectId, capabilities, recentTasks, continuity }));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(500).send(error(message));
  }
});

router.post(
  "/",
  validateFields({
    kind: z.enum(["image", "video"]),
    shotId: z.number().int().positive(),
    prompt: z.string().trim().min(1).max(2000),
    aspectRatio: z.enum(["16:9", "9:16"]),
    duration: z.number().int().min(4).max(12),
    resolution: z.enum(["480p", "720p", "1080p"]),
    referenceImage: z.string().max(30_000_000).optional(),
    referenceImages: z.array(z.string().max(30_000_000)).max(6).optional(),
    contextRevision: z.number().int().positive().optional(),
    replaceImageTaskId: z.string().trim().min(1).max(100).optional(),
    idempotencyKey: z.string().trim().min(8).max(300),
  }),
  async (req, res) => {
    try {
      const task = await createMvpGenerationTask(req.body, { allowLegacyCreate: true });
      res.status(202).send(success(task, "生成任务已提交"));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      res.status(400).send(error(message));
    }
  },
);

export default router;
