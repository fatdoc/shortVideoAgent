import { z } from "zod";
import {
  isoDateTimeSchema,
  materialStrategySchema,
  platformSchema,
  projectStatusSchema,
  toonflowIdSchema,
  uuidSchema,
} from "./common";

export const creativeBriefSchema = z
  .object({
    city: z.string().trim().min(1).max(80),
    storeName: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(300),
    businessHours: z.string().trim().min(1).max(120),
    averageSpendCny: z.number().nonnegative().max(1_000_000),
    promotions: z.array(z.string().trim().min(1).max(200)).max(20).default([]),
    sellingPoints: z.array(z.string().trim().min(1).max(200)).min(1).max(20),
    targetAudience: z.array(z.string().trim().min(1).max(100)).min(1).max(20),
    platform: platformSchema,
    callToAction: z.string().trim().min(1).max(300),
    durationSeconds: z.number().int().min(5).max(180),
    materialStrategy: materialStrategySchema,
  })
  .strict();

export const videoProjectSchema = z
  .object({
    projectId: toonflowIdSchema,
    category: z.string().trim().min(1).max(80),
    status: projectStatusSchema,
    brief: creativeBriefSchema.nullable(),
    currentScriptVersionId: uuidSchema.nullable(),
    currentTimelineVersionId: uuidSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type CreativeBrief = z.infer<typeof creativeBriefSchema>;
export type VideoProject = z.infer<typeof videoProjectSchema>;
