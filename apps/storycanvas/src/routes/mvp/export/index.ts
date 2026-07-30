import express from "express";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import { validateFields } from "@/middleware/middleware";
import { exportMvpProjectVideo } from "@/services/storycanvas/mvpExport";

const router = express.Router();

router.use((req, res, next) => {
  if (req.header("x-storycanvas-mode") !== "legacy") {
    res.status(403).send(error("D1 canonical 模式禁止旧导出入口", {
      code: "LEGACY_MODE_REQUIRED",
      requiredHeader: "X-StoryCanvas-Mode: legacy",
    }));
    return;
  }
  next();
});

router.post(
  "/",
  validateFields({
    shotIds: z.array(z.number().int().positive()).min(1).max(20),
  }),
  async (req, res) => {
    try {
      const result = await exportMvpProjectVideo(req.body.shotIds, { allowLegacyCreate: true });
      res.status(200).send(success(result, "视频合并完成"));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      res.status(400).send(error(message));
    }
  },
);

export default router;
