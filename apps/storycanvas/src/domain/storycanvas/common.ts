import { z } from "zod";

export const projectStatusSchema = z.enum([
  "draft",
  "planning",
  "storyboarding",
  "generating",
  "editing",
  "reviewing",
  "exported",
  "failed",
]);

export const taskStatusSchema = z.enum(["queued", "running", "succeeded", "failed", "cancelled"]);
export const materialStrategySchema = z.enum(["real-footage", "ai-image", "ai-video", "stock", "mixed"]);
export const platformSchema = z.enum(["douyin", "xiaohongshu", "kuaishou", "wechat-video"]);
export const isoDateTimeSchema = z.iso.datetime({ offset: true });
export const uuidSchema = z.uuid();
export const toonflowIdSchema = z.number().int().positive();
export const metadataSchema = z.record(z.string(), z.unknown()).default({});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type MaterialStrategy = z.infer<typeof materialStrategySchema>;
export type Platform = z.infer<typeof platformSchema>;
