import { z } from "zod";
import { materialStrategySchema, taskStatusSchema, toonflowIdSchema, uuidSchema } from "./common";

export const sceneSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    title: z.string().trim().min(1).max(200),
    description: z.string().trim().max(4_000).default(""),
    location: z.string().trim().max(300).default(""),
    sortOrder: z.number().int().nonnegative(),
  })
  .strict();

export const shotSchema = z
  .object({
    storyboardId: toonflowIdSchema,
    sceneId: uuidSchema,
    shotType: z.string().trim().min(1).max(80),
    cameraMovement: z.string().trim().min(1).max(120),
    visualDescription: z.string().trim().min(1).max(4_000),
    imagePrompt: z.string().trim().min(1).max(8_000),
    videoPrompt: z.string().trim().min(1).max(8_000),
    narration: z.string().trim().max(2_000).default(""),
    onScreenText: z.string().trim().max(500).default(""),
    transitionName: z.string().trim().max(100).default("cut"),
    materialStrategy: materialStrategySchema,
    durationSeconds: z.number().positive().max(30),
    locked: z.boolean().default(false),
    sortOrder: z.number().int().nonnegative(),
    generationStatus: taskStatusSchema.default("queued"),
  })
  .strict();

export function validateStoryboardDuration(shots: readonly z.infer<typeof shotSchema>[], expectedSeconds: number, toleranceSeconds = 0.05) {
  const total = shots.reduce((sum, shot) => sum + shot.durationSeconds, 0);
  if (Math.abs(total - expectedSeconds) > toleranceSeconds) {
    throw new Error(`分镜总时长 ${total} 秒与目标 ${expectedSeconds} 秒不一致`);
  }
  return total;
}

export type Scene = z.infer<typeof sceneSchema>;
export type Shot = z.infer<typeof shotSchema>;
