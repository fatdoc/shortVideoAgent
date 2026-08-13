import crypto from "node:crypto";

import { z } from "zod";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SESSION_PATTERN = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const REQUEST_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const CANVAS_V1_COMMAND_TYPES = [
  "ANALYZE_ASSET_REQUIREMENTS",
  "CREATE_VIRTUAL_CHARACTER",
  "SYNC_PROVIDER_ASSET",
  "BIND_ASSET_TO_ENTITY",
  "GENERATE_SHOT",
  "SELECT_SHOT_OUTPUT",
  "SAVE_CANVAS_DOCUMENT",
  "EXPORT_PLAYLIST",
] as const;

export const CANVAS_V1_REASON_CODES = [
  "SCOPE_MISMATCH",
  "REQUIRED_ASSET_MISSING",
  "RIGHTS_PENDING",
  "RIGHTS_REJECTED",
  "RIGHTS_REVOKED",
  "RIGHTS_EXPIRED",
  "ASSET_APPROVAL_PENDING",
  "ASSET_APPROVAL_REJECTED",
  "ASSET_APPROVAL_REVOKED",
  "PROVIDER_PROCESSING",
  "PROVIDER_REJECTED",
  "PROVIDER_FAILED",
  "PROVIDER_UNAVAILABLE",
  "ENTITY_BINDING_MISSING",
  "ENTITY_BINDING_PENDING",
  "ENTITY_BINDING_REJECTED",
  "ENTITY_BINDING_REVOKED",
  "CAPABILITY_UNAVAILABLE",
  "SCRIPT_NOT_CURRENT",
  "STORYBOARD_NOT_CURRENT",
] as const;

export type CanvasV1ContractErrorCode =
  | "CANVAS_SCHEMA_INVALID"
  | "CANVAS_BROWSER_PROJECTION_UNSAFE"
  | "CANVAS_SCOPE_MISMATCH"
  | "CANVAS_SESSION_INVALID"
  | "CANVAS_READINESS_INCONSISTENT"
  | "CANVAS_BINDING_INCONSISTENT"
  | "CANVAS_APPROVAL_REQUIRED"
  | "CANVAS_COMMAND_PAYLOAD_MISMATCH"
  | "CANVAS_COMMAND_IDEMPOTENCY_CONFLICT"
  | "CANVAS_DOCUMENT_VERSION_CONFLICT"
  | "CANVAS_EVENT_FACTS_INCONSISTENT";

export class CanvasV1ContractError extends Error {
  constructor(public readonly code: CanvasV1ContractErrorCode) {
    super(code);
    this.name = "CanvasV1ContractError";
  }
}

const uuid = z.string().regex(UUID_PATTERN);
const timestamp = z.string().regex(TIMESTAMP_PATTERN).refine((value) => Number.isFinite(Date.parse(value)));
const canvasSessionId = z.string().regex(SESSION_PATTERN);
const requestId = z.string().regex(REQUEST_PATTERN);
const nullableUuid = uuid.nullable();
const nullableTimestamp = timestamp.nullable();
const assetCategory = z.enum(["human", "virtual_character", "store", "product", "brand", "prop", "voice", "image", "video"]);
const rightsStatus = z.enum(["pending", "authorized", "rejected", "revoked", "expired"]);
const approvalStatus = z.enum(["pending", "approved", "rejected", "revoked"]);
const providerStatus = z.enum(["processing", "active", "rejected", "failed", "unavailable"]);
const entityBindingStatus = z.enum(["pending", "approved", "rejected", "revoked"]);
const capability = z.enum(["asset_analysis", "image_generation", "provider_asset_sync", "video_generation", "playlist_export"]);
const commandType = z.enum(CANVAS_V1_COMMAND_TYPES);
const reasonCode = z.enum(CANVAS_V1_REASON_CODES);

const scope = {
  contractVersion: z.literal("0.1"),
  tenantId: uuid,
  projectId: uuid,
  packageId: uuid,
  canvasSessionId,
  occurredAt: timestamp,
};

const approvedScript = z.object({ scriptId: uuid, version: z.number().int().positive(), status: z.literal("approved") }).strict();
const approvedStoryboard = z.object({ storyboardId: uuid, version: z.number().int().positive(), status: z.literal("approved") }).strict();
const documentShot = z.object({
  shotId: uuid,
  position: z.number().int().nonnegative(),
  selectedOutputAssetId: nullableUuid,
  prompt: z.string().max(4000),
  updatedAt: timestamp,
}).strict();
const playlist = z.object({ shotIds: z.array(uuid).max(1000) }).strict();

const canvasBootstrapSchema = z.object({
  objectType: z.literal("CanvasBootstrap"),
  ...scope,
  status: z.enum(["ready", "blocked"]),
  approvedScript,
  approvedStoryboard,
  document: z.object({ documentId: uuid, version: z.number().int().positive() }).strict(),
  assetSummaries: z.array(z.object({
    assetId: uuid,
    category: assetCategory,
    displayName: z.string().min(1).max(200),
    rightsStatus,
    approvalStatus,
    providerStatus,
    entityBindingStatus,
    controlledPreviewUrl: z.string().max(2048).nullable(),
  }).strict()).max(1000),
  capabilities: z.array(z.object({ capability, available: z.boolean(), reasonCode: reasonCode.nullable() }).strict()).min(1),
  requestId,
}).strict();

const canvasDocumentSchema = z.object({
  objectType: z.literal("CanvasDocument"),
  ...scope,
  documentId: uuid,
  status: z.enum(["active", "archived"]),
  version: z.number().int().positive(),
  shots: z.array(documentShot).max(1000),
  playlist,
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

const assetRecordSchema = z.object({
  objectType: z.literal("AssetRecord"),
  ...scope,
  assetId: uuid,
  category: assetCategory,
  displayName: z.string().min(1).max(200),
  provenance: z.object({
    kind: z.enum(["customer_upload", "provider_generated", "licensed", "control_synced"]),
    sourceAssetId: nullableUuid,
    declaredByActorId: uuid,
    declaredAt: timestamp,
  }).strict(),
  rights: z.object({
    status: rightsStatus,
    basis: z.enum(["customer_owned", "licensed", "provider_generated", "external_identity_verification"]),
    validFrom: nullableTimestamp,
    validUntil: nullableTimestamp,
    reviewedAt: nullableTimestamp,
  }).strict(),
  approval: z.object({ status: approvalStatus, reviewedByActorId: nullableUuid, reviewedAt: nullableTimestamp }).strict(),
  controlledPreviewUrl: z.string().max(2048).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

const providerAssetBindingSchema = z.object({
  objectType: z.literal("ProviderAssetBinding"),
  ...scope,
  bindingId: uuid,
  assetId: uuid,
  provider: z.literal("byteplus"),
  providerStatus,
  providerAssetId: z.string().min(1).max(256).nullable(),
  providerGroupId: z.string().min(1).max(256).nullable(),
  assetUri: z.string().regex(/^asset:\/\/[A-Za-z0-9._:/-]+$/).max(1024).nullable(),
  registeredAt: nullableTimestamp,
  updatedAt: timestamp,
}).strict();

const entityBindingSchema = z.object({
  objectType: z.literal("EntityBinding"),
  ...scope,
  bindingId: uuid,
  assetId: uuid,
  entityId: uuid,
  entityType: z.enum(["human", "virtual_character", "store", "product", "brand", "prop", "voice"]),
  status: entityBindingStatus,
  approvedByActorId: nullableUuid,
  approvedAt: nullableTimestamp,
  continuityRevision: z.number().int().positive().nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

const shotAssetRequirementSchema = z.object({
  objectType: z.literal("ShotAssetRequirement"),
  ...scope,
  requirementId: uuid,
  shotId: uuid,
  assetCategory,
  entityId: nullableUuid,
  status: z.enum(["required", "satisfied", "waived"]),
  source: z.object({
    scriptId: uuid,
    scriptVersion: z.number().int().positive(),
    storyboardId: uuid,
    storyboardVersion: z.number().int().positive(),
  }).strict(),
  requiredCapabilities: z.array(capability).min(1),
  createdAt: timestamp,
  updatedAt: timestamp,
}).strict();

const currentScript = z.object({ scriptId: uuid, version: z.number().int().positive(), current: z.boolean() }).strict();
const currentStoryboard = z.object({ storyboardId: uuid, version: z.number().int().positive(), current: z.boolean() }).strict();
const readinessRequirement = z.object({
  requirementId: uuid,
  assetId: nullableUuid,
  scopeMatched: z.boolean(),
  rightsStatus,
  approvalStatus,
  providerStatus,
  entityBindingStatus,
  capabilityAvailable: z.boolean(),
  ready: z.boolean(),
  reasonCodes: z.array(reasonCode),
}).strict();
const shotReadinessSchema = z.object({
  objectType: z.literal("ShotReadiness"),
  ...scope,
  readinessId: uuid,
  shotId: uuid,
  ready: z.boolean(),
  reasonCodes: z.array(reasonCode),
  script: currentScript,
  storyboard: currentStoryboard,
  requirements: z.array(readinessRequirement).min(1).max(1000),
  evaluatedAt: timestamp,
}).strict();

const commandPayload = z.union([
  z.object({ shotId: uuid }).strict(),
  z.object({ assetId: uuid, entityId: uuid, prompt: z.string().min(1).max(4000) }).strict(),
  z.object({ assetId: uuid }).strict(),
  z.object({ assetId: uuid, entityId: uuid }).strict(),
  z.object({ shotId: uuid, readinessId: uuid, prompt: z.string().min(1).max(4000), referenceAssetIds: z.array(uuid).min(1).max(50) }).strict(),
  z.object({ shotId: uuid, outputAssetId: uuid, documentId: uuid, expectedVersion: z.number().int().positive() }).strict(),
  z.object({ documentId: uuid, expectedVersion: z.number().int().positive(), shots: z.array(documentShot).max(1000), playlist }).strict(),
  z.object({ documentId: uuid, expectedVersion: z.number().int().positive() }).strict(),
]);
const canvasCommandSchema = z.object({
  objectType: z.literal("CanvasCommand"),
  ...scope,
  commandId: uuid,
  commandType,
  requestedByActorId: uuid,
  requestSource: z.enum(["user", "agent"]),
  approvalId: nullableUuid,
  payload: commandPayload,
  requestId,
}).strict();

const canvasError = z.object({
  code: z.enum([
    "CANVAS_SCHEMA_INVALID",
    "CANVAS_SCOPE_MISMATCH",
    "CANVAS_SESSION_INVALID",
    "CANVAS_RIGHTS_NOT_AUTHORIZED",
    "CANVAS_ASSET_NOT_APPROVED",
    "CANVAS_PROVIDER_NOT_ACTIVE",
    "CANVAS_ENTITY_BINDING_NOT_APPROVED",
    "CANVAS_SHOT_NOT_READY",
    "CANVAS_CAPABILITY_UNAVAILABLE",
    "CANVAS_APPROVAL_REQUIRED",
    "CANVAS_APPROVAL_INVALID",
    "CANVAS_COMMAND_IDEMPOTENCY_CONFLICT",
    "CANVAS_DOCUMENT_VERSION_CONFLICT",
    "CANVAS_PROVIDER_FAILED",
    "CANVAS_OUTPUT_REGISTRATION_FAILED",
  ]),
  message: z.string().min(1).max(160),
  retryable: z.boolean(),
}).strict();
const canvasEventSchema = z.object({
  objectType: z.literal("CanvasEvent"),
  ...scope,
  eventId: uuid,
  commandId: uuid,
  commandType,
  status: z.enum(["accepted", "provider_submitted", "task_created", "output_registered", "receipt_recorded", "failed"]),
  providerSubmitted: z.boolean(),
  taskCreated: z.boolean(),
  outputRegistered: z.boolean(),
  receiptRecorded: z.boolean(),
  taskId: nullableUuid,
  outputAssetId: nullableUuid,
  receiptId: nullableUuid,
  replayed: z.boolean(),
  error: canvasError.nullable(),
  requestId,
}).strict();

const canvasV1ContractSchema = z.discriminatedUnion("objectType", [
  canvasBootstrapSchema,
  canvasDocumentSchema,
  assetRecordSchema,
  providerAssetBindingSchema,
  entityBindingSchema,
  shotAssetRequirementSchema,
  shotReadinessSchema,
  canvasCommandSchema,
  canvasEventSchema,
]);

export type CanvasBootstrapV01 = z.infer<typeof canvasBootstrapSchema>;
export type CanvasDocumentV01 = z.infer<typeof canvasDocumentSchema>;
export type AssetRecordV01 = z.infer<typeof assetRecordSchema>;
export type ProviderAssetBindingV01 = z.infer<typeof providerAssetBindingSchema>;
export type EntityBindingV01 = z.infer<typeof entityBindingSchema>;
export type ShotAssetRequirementV01 = z.infer<typeof shotAssetRequirementSchema>;
export type ShotReadinessV01 = z.infer<typeof shotReadinessSchema>;
export type CanvasCommandV01 = z.infer<typeof canvasCommandSchema>;
export type CanvasEventV01 = z.infer<typeof canvasEventSchema>;
export type CanvasV1Contract = z.infer<typeof canvasV1ContractSchema>;
export type CanvasV1BrowserContract = Exclude<CanvasV1Contract, ProviderAssetBindingV01>;
export type CanvasV1Scope = Pick<CanvasV1Contract, "tenantId" | "projectId" | "packageId" | "canvasSessionId">;

const BROWSER_OBJECT_TYPES = new Set([
  "CanvasBootstrap", "CanvasDocument", "AssetRecord", "EntityBinding",
  "ShotAssetRequirement", "ShotReadiness", "CanvasCommand", "CanvasEvent",
]);
const FORBIDDEN_KEYS = new Set([
  "remoteassetid", "asseturi", "groupid", "providerassetid", "providergroupid", "providertaskid",
  "accesstoken", "authorization", "cookie", "grant", "projectgrant", "productionpackage", "packagesnapshot",
  "payloaddigest", "approvedscriptdigest", "approvedstoryboarddigest", "idempotencykey", "internaltoken",
  "credential", "secret", "password", "localpath", "databaseid", "providerrawbody", "providerrawmessage", "userconfirmed",
]);
const FORBIDDEN_VALUES = ["asset://", "bearer ", "x-amz-credential=", "x-amz-signature=", "x-tos-signature=", "access_token="];

function assertBrowserSafe(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertBrowserSafe);
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) throw new CanvasV1ContractError("CANVAS_BROWSER_PROJECTION_UNSAFE");
    if (typeof child === "string" && FORBIDDEN_VALUES.some((pattern) => child.toLowerCase().includes(pattern))) {
      throw new CanvasV1ContractError("CANVAS_BROWSER_PROJECTION_UNSAFE");
    }
    assertBrowserSafe(child);
  }
}

function assertControlledPreviewUrl(value: string | null): void {
  if (value === null) return;
  if (/^\/api\/canvas-v1\/[A-Za-z0-9_./-]+$/.test(value)) return;
  if (/^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9_./%-]+$/.test(value)) return;
  throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  return `{${Object.keys(value as Record<string, unknown>).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalize((value as Record<string, unknown>)[key])}`).join(",")}}`;
}

function unique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

function assertChronology(first: string, second: string): void {
  if (Date.parse(first) > Date.parse(second)) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
}

function assertSafeErrorMessage(message: string): void {
  if (/(?:bearer\s+|asset:\/\/|access[_-]?token|api[_-]?key|password|x-amz-|x-tos-|provider raw)/iu.test(message)) {
    throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
  }
}

function readinessReasons(requirement: ShotReadinessV01["requirements"][number]) {
  const reasons: (typeof CANVAS_V1_REASON_CODES)[number][] = [];
  if (!requirement.scopeMatched) reasons.push("SCOPE_MISMATCH");
  if (requirement.assetId === null) reasons.push("REQUIRED_ASSET_MISSING");
  if (requirement.rightsStatus !== "authorized") reasons.push(`RIGHTS_${requirement.rightsStatus.toUpperCase()}` as typeof reasons[number]);
  if (requirement.approvalStatus !== "approved") reasons.push(`ASSET_APPROVAL_${requirement.approvalStatus.toUpperCase()}` as typeof reasons[number]);
  if (requirement.providerStatus !== "active") reasons.push(`PROVIDER_${requirement.providerStatus.toUpperCase()}` as typeof reasons[number]);
  if (requirement.entityBindingStatus !== "approved") reasons.push(`ENTITY_BINDING_${requirement.entityBindingStatus.toUpperCase()}` as typeof reasons[number]);
  if (!requirement.capabilityAvailable) reasons.push("CAPABILITY_UNAVAILABLE");
  return CANVAS_V1_REASON_CODES.filter((code) => reasons.includes(code));
}

function assertSemantic(value: CanvasV1Contract): void {
  switch (value.objectType) {
    case "CanvasBootstrap":
      value.assetSummaries.forEach((item) => assertControlledPreviewUrl(item.controlledPreviewUrl));
      for (const item of value.capabilities) {
        if (item.available !== (item.reasonCode === null)) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      }
      return;
    case "CanvasDocument": {
      assertChronology(value.createdAt, value.updatedAt);
      const shotIds = value.shots.map((shot) => shot.shotId);
      const positions = value.shots.map((shot) => shot.position);
      if (!unique(shotIds) || !unique(positions) || !unique(value.playlist.shotIds)) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      if (value.playlist.shotIds.some((shotId) => !shotIds.includes(shotId))) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      return;
    }
    case "AssetRecord":
      assertControlledPreviewUrl(value.controlledPreviewUrl);
      assertChronology(value.createdAt, value.updatedAt);
      if (value.rights.validFrom && value.rights.validUntil) assertChronology(value.rights.validFrom, value.rights.validUntil);
      if (value.rights.status === "authorized" && value.rights.reviewedAt === null) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      if (value.approval.status === "approved" && (!value.approval.reviewedByActorId || !value.approval.reviewedAt)) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      return;
    case "ProviderAssetBinding":
      if (value.providerStatus === "active" && (!value.providerAssetId || !value.providerGroupId || !value.assetUri || !value.registeredAt)) {
        throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      }
      return;
    case "EntityBinding": {
      const hasApproval = Boolean(value.approvedByActorId && value.approvedAt && value.continuityRevision);
      if ((value.status === "approved") !== hasApproval) throw new CanvasV1ContractError("CANVAS_BINDING_INCONSISTENT");
      assertChronology(value.createdAt, value.updatedAt);
      return;
    }
    case "ShotAssetRequirement":
      if (!unique(value.requiredCapabilities)) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
      assertChronology(value.createdAt, value.updatedAt);
      return;
    case "ShotReadiness": {
      const aggregate: (typeof CANVAS_V1_REASON_CODES)[number][] = [];
      for (const requirement of value.requirements) {
        const reasons = readinessReasons(requirement);
        if (requirement.ready !== (reasons.length === 0) || JSON.stringify(requirement.reasonCodes) !== JSON.stringify(reasons)) {
          throw new CanvasV1ContractError("CANVAS_READINESS_INCONSISTENT");
        }
        aggregate.push(...reasons);
      }
      if (!value.script.current) aggregate.push("SCRIPT_NOT_CURRENT");
      if (!value.storyboard.current) aggregate.push("STORYBOARD_NOT_CURRENT");
      const ordered = CANVAS_V1_REASON_CODES.filter((code) => aggregate.includes(code));
      if (value.ready !== (ordered.length === 0) || JSON.stringify(value.reasonCodes) !== JSON.stringify(ordered)) {
        throw new CanvasV1ContractError("CANVAS_READINESS_INCONSISTENT");
      }
      return;
    }
    case "CanvasCommand": {
      const keys = Object.keys(value.payload).sort().join(",");
      const expectedKeys: Record<CanvasCommandV01["commandType"], string> = {
        ANALYZE_ASSET_REQUIREMENTS: "shotId",
        CREATE_VIRTUAL_CHARACTER: "assetId,entityId,prompt",
        SYNC_PROVIDER_ASSET: "assetId",
        BIND_ASSET_TO_ENTITY: "assetId,entityId",
        GENERATE_SHOT: "prompt,readinessId,referenceAssetIds,shotId",
        SELECT_SHOT_OUTPUT: "documentId,expectedVersion,outputAssetId,shotId",
        SAVE_CANVAS_DOCUMENT: "documentId,expectedVersion,playlist,shots",
        EXPORT_PLAYLIST: "documentId,expectedVersion",
      };
      if (keys !== expectedKeys[value.commandType]) throw new CanvasV1ContractError("CANVAS_COMMAND_PAYLOAD_MISMATCH");
      const approvalRequired = new Set(["CREATE_VIRTUAL_CHARACTER", "BIND_ASSET_TO_ENTITY", "GENERATE_SHOT", "SELECT_SHOT_OUTPUT", "EXPORT_PLAYLIST"]);
      if (approvalRequired.has(value.commandType) && value.approvalId === null) throw new CanvasV1ContractError("CANVAS_APPROVAL_REQUIRED");
      return;
    }
    case "CanvasEvent": {
      const exact: Record<Exclude<CanvasEventV01["status"], "failed">, [boolean, boolean, boolean, boolean]> = {
        accepted: [false, false, false, false],
        provider_submitted: [true, false, false, false],
        task_created: [true, true, false, false],
        output_registered: [true, true, true, false],
        receipt_recorded: [true, true, true, true],
      };
      const facts: [boolean, boolean, boolean, boolean] = [value.providerSubmitted, value.taskCreated, value.outputRegistered, value.receiptRecorded];
      if (value.status === "failed") {
        if (value.error === null || (value.receiptRecorded && !value.outputRegistered) || (value.outputRegistered && !value.taskCreated) || (value.taskCreated && !value.providerSubmitted)) {
          throw new CanvasV1ContractError("CANVAS_EVENT_FACTS_INCONSISTENT");
        }
      } else if (JSON.stringify(facts) !== JSON.stringify(exact[value.status]) || value.error !== null) {
        throw new CanvasV1ContractError("CANVAS_EVENT_FACTS_INCONSISTENT");
      }
      if (value.error !== null) assertSafeErrorMessage(value.error.message);
      if (value.taskCreated !== (value.taskId !== null) || value.outputRegistered !== (value.outputAssetId !== null) || value.receiptRecorded !== (value.receiptId !== null)) {
        throw new CanvasV1ContractError("CANVAS_EVENT_FACTS_INCONSISTENT");
      }
      return;
    }
  }
}

export function parseCanvasV1Contract(input: unknown): CanvasV1Contract {
  const parsed = canvasV1ContractSchema.safeParse(input);
  if (!parsed.success) throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
  assertSemantic(parsed.data);
  return parsed.data;
}

export function parseCanvasV1BrowserContract(input: unknown): CanvasV1BrowserContract {
  assertBrowserSafe(input);
  const parsed = parseCanvasV1Contract(input);
  if (!BROWSER_OBJECT_TYPES.has(parsed.objectType)) throw new CanvasV1ContractError("CANVAS_BROWSER_PROJECTION_UNSAFE");
  return parsed as CanvasV1BrowserContract;
}

export function assertCanvasScope(value: CanvasV1Contract, expected: CanvasV1Scope): void {
  if (value.tenantId !== expected.tenantId || value.projectId !== expected.projectId ||
      value.packageId !== expected.packageId || value.canvasSessionId !== expected.canvasSessionId) {
    throw new CanvasV1ContractError("CANVAS_SCOPE_MISMATCH");
  }
}

export function assertCanvasDocumentVersion(value: CanvasV1Contract, expectedVersion: number): void {
  if (value.objectType !== "CanvasDocument" || value.version !== expectedVersion) {
    throw new CanvasV1ContractError("CANVAS_DOCUMENT_VERSION_CONFLICT");
  }
}

export function assertCanvasSessionActive(active: boolean): void {
  if (!active) throw new CanvasV1ContractError("CANVAS_SESSION_INVALID");
}

export function decideCanvasCommandReplay(existing: CanvasV1Contract, incoming: CanvasV1Contract) {
  if (existing.objectType !== "CanvasCommand" || incoming.objectType !== "CanvasCommand") {
    throw new CanvasV1ContractError("CANVAS_SCHEMA_INVALID");
  }
  const scopeKeys = ["tenantId", "projectId", "packageId", "canvasSessionId", "commandType"] as const;
  if (scopeKeys.some((key) => existing[key] !== incoming[key])) return { outcome: "new", replayed: false } as const;
  const semantic = (value: CanvasCommandV01) => ({
    requestedByActorId: value.requestedByActorId,
    requestSource: value.requestSource,
    approvalId: value.approvalId,
    payload: value.payload,
  });
  const left = crypto.createHash("sha256").update(canonicalize(semantic(existing))).digest("hex");
  const right = crypto.createHash("sha256").update(canonicalize(semantic(incoming))).digest("hex");
  if (left !== right) throw new CanvasV1ContractError("CANVAS_COMMAND_IDEMPOTENCY_CONFLICT");
  return { outcome: "replay", replayed: true } as const;
}

export function restoreCanvasDocumentForSession(value: CanvasV1Contract, newCanvasSessionId: string): CanvasDocumentV01 {
  if (value.objectType !== "CanvasDocument" || !SESSION_PATTERN.test(newCanvasSessionId)) {
    throw new CanvasV1ContractError("CANVAS_SESSION_INVALID");
  }
  return { ...value, canvasSessionId: newCanvasSessionId };
}
