import { z } from "zod";

export const openStorylineClientConfigSchema = z.object({
  baseUrl: z.string().url(),
  mcpUrl: z.string().url(),
  timeoutMs: z.number().int().positive().max(30_000),
});

export const openStorylineApiDocumentSchema = z.object({
  info: z.object({
    title: z.string(),
    version: z.string(),
  }),
  paths: z.record(z.string(), z.unknown()),
});

export const openStorylineComponentHealthSchema = z.object({
  status: z.enum(["online", "offline"]),
  latencyMs: z.number().nonnegative(),
  detail: z.string().optional(),
});

export const openStorylineHealthSchema = z.object({
  service: z.literal("openstoryline"),
  status: z.enum(["online", "degraded", "offline"]),
  checkedAt: z.string().datetime(),
  latencyMs: z.number().nonnegative(),
  version: z.string().optional(),
  components: z.object({
    web: openStorylineComponentHealthSchema,
    mcp: openStorylineComponentHealthSchema,
  }),
});

