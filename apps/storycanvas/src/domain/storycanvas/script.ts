import { z } from "zod";
import { isoDateTimeSchema, toonflowIdSchema, uuidSchema } from "./common";

export const scriptSegmentSchema = z
  .object({
    id: uuidSchema,
    sortOrder: z.number().int().nonnegative(),
    durationSeconds: z.number().positive().max(180),
    narration: z.string().trim().max(2_000),
    visualDirection: z.string().trim().min(1).max(4_000),
    onScreenText: z.string().trim().max(500).default(""),
  })
  .strict();

export const scriptVersionSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    scriptId: toonflowIdSchema.nullable(),
    version: z.number().int().positive(),
    title: z.string().trim().min(1).max(200),
    hook: z.string().trim().min(1).max(500),
    narration: z.string().trim().min(1).max(20_000),
    segments: z.array(scriptSegmentSchema).min(1).max(100),
    source: z.enum(["user", "ai", "mock", "import"]),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type ScriptSegment = z.infer<typeof scriptSegmentSchema>;
export type ScriptVersion = z.infer<typeof scriptVersionSchema>;
