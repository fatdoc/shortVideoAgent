import { z } from "zod";
import { isoDateTimeSchema, metadataSchema, toonflowIdSchema, uuidSchema } from "./common";

export const timelineClipSchema = z
  .object({
    id: uuidSchema,
    assetId: uuidSchema,
    startMs: z.number().int().nonnegative(),
    durationMs: z.number().int().positive(),
    sourceStartMs: z.number().int().nonnegative().default(0),
    metadata: metadataSchema,
  })
  .strict();

export const timelineTrackSchema = z
  .object({
    id: uuidSchema,
    type: z.enum(["video", "audio", "subtitle", "overlay"]),
    sortOrder: z.number().int().nonnegative(),
    clips: z.array(timelineClipSchema),
  })
  .strict();

export const timelineVersionSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    editSessionId: uuidSchema,
    version: z.number().int().positive(),
    source: z.enum(["user", "openstoryline", "mock", "import"]),
    tracks: z.array(timelineTrackSchema),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type TimelineClip = z.infer<typeof timelineClipSchema>;
export type TimelineTrack = z.infer<typeof timelineTrackSchema>;
export type TimelineVersion = z.infer<typeof timelineVersionSchema>;
