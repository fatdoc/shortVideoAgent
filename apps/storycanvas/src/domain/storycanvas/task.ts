import { z } from "zod";
import { isoDateTimeSchema, metadataSchema, taskStatusSchema, toonflowIdSchema, uuidSchema } from "./common";

export const taskTypeSchema = z.enum([
  "creative-brief",
  "script",
  "storyboard",
  "image-generation",
  "video-generation",
  "asset-upload",
  "edit-command",
  "render-preview",
  "export",
]);

export const generationTaskSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    storyboardId: toonflowIdSchema.nullable(),
    taskType: taskTypeSchema,
    provider: z.string().trim().min(1).max(100),
    status: taskStatusSchema,
    progress: z.number().min(0).max(100),
    input: metadataSchema,
    output: metadataSchema.nullable(),
    error: metadataSchema.nullable(),
    idempotencyKey: z.string().trim().min(8).max(300),
    externalTaskId: z.string().trim().max(300).nullable(),
    estimatedCost: z.number().nonnegative().nullable(),
    actualCost: z.number().nonnegative().nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type TaskType = z.infer<typeof taskTypeSchema>;
export type GenerationTask = z.infer<typeof generationTaskSchema>;
