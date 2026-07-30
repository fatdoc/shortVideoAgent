import { z } from "zod";
import { isoDateTimeSchema, taskStatusSchema, toonflowIdSchema, uuidSchema } from "./common";

export const editSessionStatusSchema = z.enum(["draft", "syncing", "ready", "rendering", "exporting", "failed", "cancelled"]);

export const editSessionSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    status: editSessionStatusSchema,
    openStorylineSessionId: z.string().trim().max(300).nullable(),
    currentTimelineVersionId: uuidSchema.nullable(),
    previewAssetId: uuidSchema.nullable(),
    outputAssetId: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const editCommandSchema = z
  .object({
    id: uuidSchema,
    editSessionId: uuidSchema,
    instruction: z.string().trim().min(1).max(10_000),
    status: taskStatusSchema,
    taskId: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type EditSessionStatus = z.infer<typeof editSessionStatusSchema>;
export type EditSession = z.infer<typeof editSessionSchema>;
export type EditCommand = z.infer<typeof editCommandSchema>;
