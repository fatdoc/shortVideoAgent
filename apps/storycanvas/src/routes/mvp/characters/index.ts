import express from "express";
import { z } from "zod";
import { error, success } from "@/lib/responseFormat";
import {
  bindCharacterAssetToEntity,
  createCharacterGenerationTask,
  getCharacterAssetWorkspace,
  getCharacterGenerationTask,
  uploadLocalCharacter,
} from "@/services/storycanvas/characterAssets";

const router = express.Router();
const maxImageDataUrlLength = 42_000_000;

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  age: z.string().trim().max(40).default(""),
  height: z.string().trim().max(40).default(""),
  bodyType: z.string().trim().max(200).default(""),
  style: z.string().trim().max(200).default("电影级风格化写实"),
  personality: z.string().trim().max(300).default(""),
  appearance: z.string().trim().max(1_000).default(""),
  wardrobe: z.string().trim().max(1_000).default(""),
  setting: z.string().trim().max(500).default(""),
}).strict();

router.get("/", async (_req, res) => {
  try {
    res.status(200).send(success(await getCharacterAssetWorkspace()));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(500).send(error(message));
  }
});

router.post("/generate", async (req, res) => {
  const parsed = z.object({
    profile: profileSchema,
    imageModel: z.enum(["seedream", "image2"]).default("seedream"),
    referenceImage: z.string().max(maxImageDataUrlLength).optional(),
    additionalPrompt: z.string().trim().max(2_000).optional(),
    idempotencyKey: z.string().trim().min(8).max(300),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(error("虚拟人物生成参数错误", parsed.error.issues));
  }
  try {
    res.status(202).send(success(await createCharacterGenerationTask(parsed.data), "虚拟人物生成任务已提交"));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(400).send(error(message));
  }
});

router.post("/upload", async (req, res) => {
  const parsed = z.object({
    profile: profileSchema,
    image: z.string().max(maxImageDataUrlLength),
    idempotencyKey: z.string().trim().min(8).max(300),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(error("虚拟人物上传参数错误", parsed.error.issues));
  }
  try {
    res.status(201).send(success(await uploadLocalCharacter(parsed.data), "虚拟人物已保存到本机资产库"));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(400).send(error(message));
  }
});

router.get("/tasks/:taskId", async (req, res) => {
  const taskId = z.uuid().safeParse(req.params.taskId);
  if (!taskId.success) return res.status(400).send(error("虚拟人物任务 ID 无效"));
  try {
    const task = await getCharacterGenerationTask(taskId.data);
    if (!task) return res.status(404).send(error("虚拟人物任务不存在"));
    res.status(200).send(success(task));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(500).send(error(message));
  }
});

router.post("/bind", async (req, res) => {
  const parsed = z.object({
    assetId: z.string().trim().min(1).max(300),
    entityId: z.uuid(),
  }).strict().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).send(error("人物资产绑定参数错误", parsed.error.issues));
  }
  try {
    res.status(200).send(success(
      await bindCharacterAssetToEntity(parsed.data.assetId, parsed.data.entityId),
      "虚拟人物已绑定到世界记忆",
    ));
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    res.status(400).send(error(message));
  }
});

export default router;
