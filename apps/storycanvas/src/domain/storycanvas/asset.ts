import { z } from "zod";
import { isoDateTimeSchema, metadataSchema, toonflowIdSchema, uuidSchema } from "./common";

export const assetTypeSchema = z.enum(["image", "video", "audio", "subtitle", "preview", "export", "other"]);
export const assetSourceSchema = z.enum(["upload", "generated", "stock", "openstoryline", "mock"]);

export const mediaAssetSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    imageId: toonflowIdSchema.nullable(),
    videoId: toonflowIdSchema.nullable(),
    type: assetTypeSchema,
    source: assetSourceSchema,
    originalName: z.string().trim().max(500).nullable(),
    mimeType: z.string().trim().min(1).max(200),
    byteSize: z.number().int().nonnegative(),
    localPath: z.string().trim().min(1).max(2_000),
    remoteUrl: z.url().nullable(),
    thumbnailPath: z.string().trim().max(2_000).nullable(),
    durationMs: z.number().int().nonnegative().nullable(),
    width: z.number().int().positive().nullable(),
    height: z.number().int().positive().nullable(),
    fps: z.number().positive().nullable(),
    provider: z.string().trim().max(100).nullable(),
    prompt: z.string().trim().max(20_000).nullable(),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    rightsNote: z.string().trim().max(2_000).nullable(),
    metadata: metadataSchema,
    createdAt: isoDateTimeSchema,
  })
  .strict()
  .superRefine((asset, context) => {
    if (["generated", "mock"].includes(asset.source) && (!asset.provider || !asset.prompt)) {
      context.addIssue({ code: "custom", message: "AI/Mock 素材必须记录 provider 和 prompt" });
    }
  });

export type AssetType = z.infer<typeof assetTypeSchema>;
export type AssetSource = z.infer<typeof assetSourceSchema>;
export type MediaAsset = z.infer<typeof mediaAssetSchema>;
