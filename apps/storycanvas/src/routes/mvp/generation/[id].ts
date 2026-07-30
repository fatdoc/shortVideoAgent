import express from "express";
import { error, success } from "@/lib/responseFormat";
import { getMvpTask } from "@/services/storycanvas/mvpGeneration";

const router = express.Router({ mergeParams: true });

router.use((req, res, next) => {
  if (req.header("x-storycanvas-mode") !== "legacy") {
    res.status(403).send(error("D1 canonical 模式禁止旧生成任务查询", {
      code: "LEGACY_MODE_REQUIRED",
      requiredHeader: "X-StoryCanvas-Mode: legacy",
    }));
    return;
  }
  next();
});

router.get("/", async (req, res) => {
  try {
    const task = await getMvpTask((req.params as { id: string }).id);
    if (!task) return res.status(404).send(error("生成任务不存在"));
    return res.status(200).send(success(task));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return res.status(500).send(error(message));
  }
});

export default router;
