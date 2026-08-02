import { z } from "zod";
import { isoDateTimeSchema, metadataSchema, toonflowIdSchema, uuidSchema } from "./common";

export const phase1ReferenceRoleSchema = z.enum([
  "image_reference",
  "video_reference",
  "character_reference",
  "location_reference",
  "style_reference",
  "product_reference",
  "depth_reference",
  "normal_reference",
  "mask_reference",
  "previs_reference",
  "camera_reference",
  "three_d_asset",
]);

const vector3Schema = z.object({ x: z.number(), y: z.number(), z: z.number() }).strict();

export const cameraPlanSchema = z.object({
  cameraType: z.string().trim().max(100).nullable().default(null),
  position: vector3Schema.nullable().default(null),
  target: vector3Schema.nullable().default(null),
  focalLength: z.number().positive().nullable().default(null),
  movementType: z.string().trim().max(100).nullable().default(null),
  trajectoryAssetId: uuidSchema.nullable().default(null),
  previsAssetId: uuidSchema.nullable().default(null),
  characterAction: z.string().trim().max(2_000).nullable().default(null),
  depthAssetId: uuidSchema.nullable().default(null),
  normalAssetId: uuidSchema.nullable().default(null),
  maskAssetId: uuidSchema.nullable().default(null),
  materialReferenceAssetIds: z.array(uuidSchema).default([]),
  lightingReferenceAssetIds: z.array(uuidSchema).default([]),
}).strict();

export const phase1ShotContractSchema = z.object({
  narrativePurpose: z.string().trim().min(1),
  requiredFacts: z.array(z.string()),
  requiredClaims: z.array(z.string()),
  requiredCTA: z.string(),
  requiredDisclaimer: z.string(),
  prohibitedTerms: z.array(z.string()),
  subjects: z.array(z.string()),
  location: z.string(),
  action: z.string(),
  framing: z.string(),
  cameraAngle: z.string(),
  cameraMovement: z.string(),
  startState: metadataSchema,
  endState: metadataSchema,
  continuityRequirements: z.array(z.string()),
  duration: z.number().positive(),
  aspectRatio: z.string().trim().min(1),
}).strict();

export const productionShotStatusSchema = z.enum([
  "planning",
  "awaiting_confirmation",
  "ready",
  "generating",
  "has_candidates",
  "selected",
  "blocked",
]);

export const productionShotSchema = z.object({
  id: uuidSchema,
  externalStoryboardShotId: z.string().trim().min(1).max(300),
  productionPackageId: uuidSchema,
  projectId: toonflowIdSchema,
  sequence: z.number().int().positive(),
  title: z.string().trim().min(1),
  duration: z.number().positive(),
  approvedScriptSegment: metadataSchema,
  claimIds: z.array(z.string()),
  brandFactIds: z.array(z.string()),
  lockedBusinessFields: metadataSchema,
  editableCreativeFields: metadataSchema,
  shotContract: phase1ShotContractSchema,
  status: productionShotStatusSchema,
  selectedAttemptId: uuidSchema.nullable(),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

export const generationPlanStatusSchema = z.enum(["awaiting_confirmation", "approved", "superseded"]);

export const generationPlanSchema = z.object({
  id: uuidSchema,
  shotId: uuidSchema,
  planVersion: z.number().int().positive(),
  imagePrompt: z.string().trim().min(1),
  videoPrompt: z.string().trim().min(1),
  negativePrompt: z.string(),
  recommendedImageModel: z.string().nullable(),
  recommendedVideoModel: z.string().nullable(),
  referenceAssetIds: z.array(uuidSchema),
  continuityEntityIds: z.array(uuidSchema),
  cameraPlan: cameraPlanSchema,
  estimatedCredit: z.number().nonnegative(),
  generatedBy: z.string().trim().min(1),
  status: generationPlanStatusSchema,
  approvedByOperator: z.string().nullable(),
  approvedAt: isoDateTimeSchema.nullable(),
  idempotencyKey: z.string().trim().min(8).max(300),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
}).strict();

export const runtimeTaskStatusSchema = z.enum([
  "draft",
  "awaiting_confirmation",
  "queued",
  "running",
  "validating",
  "succeeded",
  "failed",
  "cancelled",
]);

export const shotAttemptDecisionSchema = z.enum(["undecided", "selected", "alternative", "rejected"]);
export const assetValidationStatusSchema = z.enum(["pending", "valid", "invalid", "missing", "inaccessible"]);

export const runtimeGenerationTaskSchema = z.object({
  id: uuidSchema,
  shotId: uuidSchema,
  attemptId: uuidSchema,
  taskType: z.enum(["image-generation", "video-generation"]),
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  modelVersion: z.string().nullable(),
  providerTaskId: z.string().nullable(),
  requestedPrompt: z.string(),
  resolvedPrompt: z.string(),
  negativePrompt: z.string(),
  inputAssetIds: z.array(uuidSchema),
  outputAssetIds: z.array(uuidSchema),
  status: runtimeTaskStatusSchema,
  progress: z.number().min(0).max(100),
  errorCode: z.string().nullable(),
  errorMessage: z.string().nullable(),
  idempotencyKey: z.string().trim().min(8).max(300),
  reservedCredit: z.number().nonnegative(),
  consumedCredit: z.number().nonnegative(),
  releasedCredit: z.number().nonnegative(),
  createdAt: isoDateTimeSchema,
  startedAt: isoDateTimeSchema.nullable(),
  completedAt: isoDateTimeSchema.nullable(),
}).strict();

export const shotAttemptSchema = z.object({
  id: uuidSchema,
  shotId: uuidSchema,
  generationTaskId: uuidSchema,
  attemptNumber: z.number().int().positive(),
  parentAttemptId: uuidSchema.nullable(),
  assetId: uuidSchema.nullable(),
  thumbnailAssetId: uuidSchema.nullable(),
  promptSnapshot: metadataSchema,
  modelSnapshot: metadataSchema,
  parameterSnapshot: metadataSchema,
  referenceSnapshot: z.array(metadataSchema),
  qualityStatus: z.enum(["pending", "valid", "invalid", "blocked"]),
  operatorDecision: shotAttemptDecisionSchema,
  isSelected: z.boolean(),
  createdAt: isoDateTimeSchema,
}).strict();

export const runtimeMediaAssetSchema = z.object({
  id: uuidSchema,
  projectId: toonflowIdSchema,
  shotId: uuidSchema.nullable(),
  attemptId: uuidSchema.nullable(),
  assetType: z.enum(["image", "video", "audio", "thumbnail", "rough_cut", "export", "other"]),
  sourceType: z.enum(["upload", "generated", "package", "mock", "export"]),
  provider: z.string().nullable(),
  localPath: z.string().nullable(),
  remoteUrl: z.string().url().nullable(),
  playableUrl: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
  mimeType: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  duration: z.number().nonnegative().nullable(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  size: z.number().int().nonnegative(),
  rightsNote: z.string().nullable(),
  validationStatus: assetValidationStatusSchema,
  createdAt: isoDateTimeSchema,
}).strict();

export const roughCutSchema = z.object({
  id: uuidSchema,
  projectId: toonflowIdSchema,
  orderedShotSelections: z.array(z.object({
    shotId: uuidSchema,
    attemptId: uuidSchema,
    assetId: uuidSchema,
    sequence: z.number().int().positive(),
    duration: z.number().positive(),
  }).strict()),
  totalDuration: z.number().positive(),
  aspectRatio: z.string().min(1),
  previewAssetId: uuidSchema.nullable(),
  approvalStatus: z.enum(["awaiting_tenant_approval", "approved", "rejected"]),
  approvedBy: z.string().nullable(),
  approvedAt: isoDateTimeSchema.nullable(),
}).strict();

export const runtimeExportArtifactSchema = z.object({
  id: uuidSchema,
  projectId: toonflowIdSchema,
  roughCutId: uuidSchema,
  exportType: z.enum(["main", "platform_variant"]),
  platformVariant: z.string(),
  assetId: uuidSchema,
  manifest: metadataSchema,
  provenance: metadataSchema,
  status: z.enum(["pending", "succeeded", "failed"]),
  approvedAt: isoDateTimeSchema,
}).strict();

export type Phase1ReferenceRole = z.infer<typeof phase1ReferenceRoleSchema>;
export type CameraPlan = z.infer<typeof cameraPlanSchema>;
export type Phase1ShotContract = z.infer<typeof phase1ShotContractSchema>;
export type ProductionShot = z.infer<typeof productionShotSchema>;
export type GenerationPlan = z.infer<typeof generationPlanSchema>;
export type RuntimeGenerationTask = z.infer<typeof runtimeGenerationTaskSchema>;
export type ShotAttempt = z.infer<typeof shotAttemptSchema>;
export type RuntimeMediaAsset = z.infer<typeof runtimeMediaAssetSchema>;
export type RoughCut = z.infer<typeof roughCutSchema>;
export type RuntimeExportArtifact = z.infer<typeof runtimeExportArtifactSchema>;
