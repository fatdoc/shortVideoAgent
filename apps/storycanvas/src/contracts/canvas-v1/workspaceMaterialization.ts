import crypto from "node:crypto";
import { z } from "zod";

import {
  parseCanvasV1BrowserContract,
  type CanvasBootstrapV01,
  type CanvasDocumentV01,
  type CanvasEventV01,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from "./index.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SESSION = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const CONTROLLED_MEDIA = /^\/(?:api\/canvas-v1|api\/production\/pilot\/canvas\/v1\/media)\/[A-Za-z0-9_./%-]+$/;
const OUTPUT_MEDIA = /^\/api\/production\/pilot\/canvas\/v1\/media\/[A-Za-z0-9_./%-]+$/;
const MAX_MATERIALIZATION_BYTES = 8 * 1024 * 1024;
const MAX_MATERIALIZATION_BASE64_CHARS = 11_184_812;

export const CANVAS_WORKSPACE_REASON_CODES = [
  "WORKSPACE_CAPABILITY_BLOCKED",
  "WORKSPACE_SHOT_BLOCKED",
  "WORKSPACE_ASSET_AGGREGATE_INCOMPLETE",
  "WORKSPACE_REQUIREMENTS_INCOMPLETE",
  "WORKSPACE_READINESS_INCOMPLETE",
  "WORKSPACE_OUTPUTS_INCOMPLETE",
  "WORKSPACE_EVENTS_INCOMPLETE",
  "WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE",
] as const;

export type CanvasWorkspaceContractErrorCode =
  | "CANVAS_WORKSPACE_SCHEMA_INVALID"
  | "CANVAS_WORKSPACE_BROWSER_UNSAFE"
  | "CANVAS_WORKSPACE_SCOPE_MISMATCH"
  | "CANVAS_WORKSPACE_DOCUMENT_MISMATCH"
  | "CANVAS_WORKSPACE_SHOT_MISMATCH"
  | "CANVAS_WORKSPACE_REQUIREMENT_MISMATCH"
  | "CANVAS_WORKSPACE_READINESS_MISMATCH"
  | "CANVAS_WORKSPACE_ASSET_MISMATCH"
  | "CANVAS_WORKSPACE_OUTPUT_MISMATCH"
  | "CANVAS_WORKSPACE_EVENT_MISMATCH"
  | "CANVAS_WORKSPACE_STATUS_INCONSISTENT"
  | "CANVAS_MATERIALIZATION_REQUEST_INVALID"
  | "CANVAS_MATERIALIZATION_RESPONSE_INVALID"
  | "CANVAS_MATERIALIZATION_SCOPE_MISMATCH"
  | "CANVAS_MATERIALIZATION_CATEGORY_UNSUPPORTED"
  | "CANVAS_MATERIALIZATION_SOURCE_EMPTY"
  | "CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE"
  | "CANVAS_MATERIALIZATION_MIME_UNSUPPORTED"
  | "CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED"
  | "CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT";

export class CanvasWorkspaceContractError extends Error {
  constructor(public readonly code: CanvasWorkspaceContractErrorCode) {
    super(code);
    this.name = "CanvasWorkspaceContractError";
  }
}

function isCanonicalUtcTimestamp(value: string): boolean {
  if (!TIMESTAMP.test(value)) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

const uuid = z.string().regex(UUID);
const timestamp = z.string().refine(isCanonicalUtcTimestamp);
const sessionId = z.string().regex(SESSION);
const requestId = z.string().regex(REQUEST_ID);
const category = z.enum(["human", "virtual_character", "store", "product", "brand", "prop", "voice", "image", "video"]);
const rightsStatus = z.enum(["pending", "authorized", "rejected", "revoked", "expired"]);
const approvalStatus = z.enum(["pending", "approved", "rejected", "revoked"]);
const providerStatus = z.enum(["processing", "active", "rejected", "failed", "unavailable"]);
const entityBindingStatus = z.enum(["pending", "approved", "rejected", "revoked"]);
const controlledMediaUrl = z.string().max(2048).regex(CONTROLLED_MEDIA).nullable();

const materializationState = z.object({
  status: z.enum(["not_started", "ready", "blocked", "unsupported"]),
  reasonCode: z.enum([
    "MATERIALIZATION_REQUIRED",
    "RIGHTS_NOT_AUTHORIZED",
    "APPROVAL_NOT_APPROVED",
    "SOURCE_UNAVAILABLE",
    "MATERIALIZATION_CONFLICT",
    "CATEGORY_UNSUPPORTED",
  ]).nullable(),
}).strict();

const workspaceAsset = z.object({
  assetId: uuid,
  category,
  displayName: z.string().min(1).max(200),
  rightsStatus,
  approvalStatus,
  providerStatus,
  entityBindingStatus,
  controlledPreviewUrl: controlledMediaUrl,
  targetEntityId: uuid.nullable(),
  materialization: materializationState,
}).strict();

const workspaceOutput = z.object({
  assetId: uuid,
  kind: z.enum(["image", "video"]),
  previewUrl: z.string().max(2048).regex(OUTPUT_MEDIA),
  selected: z.boolean(),
}).strict();

const workspaceShot = z.object({
  shotId: uuid,
  sequence: z.number().int().positive(),
  title: z.string().min(1).max(200),
  durationSeconds: z.number().positive().max(300),
  scriptText: z.string().min(1).max(50_000),
  storyboardText: z.string().min(1).max(4_000),
  thumbnailUrl: controlledMediaUrl,
  requirements: z.array(z.unknown()).min(1).max(1_000),
  readiness: z.unknown(),
  requiredAssetLabels: z.array(z.string().min(1).max(40)).min(1).max(1_000),
  outputs: z.array(workspaceOutput).max(1_000),
  event: z.unknown().nullable(),
}).strict();

const workspaceSchema = z.object({
  objectType: z.literal("CanvasWorkspace"),
  contractVersion: z.literal("0.1"),
  tenantId: uuid,
  projectId: uuid,
  packageId: uuid,
  canvasSessionId: sessionId,
  status: z.enum(["ready", "blocked"]),
  reasonCodes: z.array(z.enum(CANVAS_WORKSPACE_REASON_CODES)),
  completeness: z.object({
    assets: z.boolean(),
    requirements: z.boolean(),
    readiness: z.boolean(),
    outputs: z.boolean(),
    events: z.boolean(),
    controlledMedia: z.boolean(),
  }).strict(),
  project: z.object({
    projectName: z.string().min(1).max(200),
    requestedByActorId: uuid,
  }).strict(),
  bootstrap: z.unknown(),
  document: z.unknown(),
  shots: z.array(workspaceShot).min(1).max(1_000),
  assets: z.array(workspaceAsset).max(1_000),
  saveState: z.literal("saved"),
  requestId,
  occurredAt: timestamp,
}).strict();

const materializationRequestSchema = z.object({
  objectType: z.literal("CanvasAssetMaterializationRequest"),
  contractVersion: z.literal("0.1"),
  tenantId: uuid,
  projectId: uuid,
  packageId: uuid,
  canvasSessionId: sessionId,
  assetId: uuid,
  actorId: uuid,
  materializationAttemptId: uuid,
  requestId,
  occurredAt: timestamp,
}).strict();

const materializationResponseSchema = z.object({
  objectType: z.literal("CanvasAssetMaterialization"),
  contractVersion: z.literal("0.1"),
  tenantId: uuid,
  projectId: uuid,
  packageId: uuid,
  canvasSessionId: sessionId,
  assetId: uuid,
  materializationAttemptId: uuid,
  materializationId: uuid,
  category: z.literal("virtual_character"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
  byteSize: z.number().int().min(1).max(MAX_MATERIALIZATION_BYTES),
  checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
  contentEncoding: z.literal("base64"),
  contentBase64: z.string().min(4).max(MAX_MATERIALIZATION_BASE64_CHARS),
  replayed: z.boolean(),
  requestId,
  occurredAt: timestamp,
}).strict();

export type CanvasWorkspaceAssetV01 = z.infer<typeof workspaceAsset>;
export type CanvasWorkspaceOutputV01 = z.infer<typeof workspaceOutput>;
export type CanvasWorkspaceShotV01 = Omit<z.infer<typeof workspaceShot>, "requirements" | "readiness" | "event"> & {
  requirements: ShotAssetRequirementV01[];
  readiness: ShotReadinessV01;
  event: CanvasEventV01 | null;
};
export type CanvasWorkspaceV01 = Omit<z.infer<typeof workspaceSchema>, "bootstrap" | "document" | "shots"> & {
  bootstrap: CanvasBootstrapV01;
  document: CanvasDocumentV01;
  shots: CanvasWorkspaceShotV01[];
};
export type CanvasAssetMaterializationRequestV01 = z.infer<typeof materializationRequestSchema>;
export type CanvasAssetMaterializationV01 = z.infer<typeof materializationResponseSchema>;

const CATEGORY_LABELS: Record<CanvasWorkspaceAssetV01["category"], string> = {
  human: "真人",
  virtual_character: "虚拟人物",
  store: "门店",
  product: "商品",
  brand: "品牌",
  prop: "道具",
  voice: "声音",
  image: "图片",
  video: "视频",
};

const FORBIDDEN_WORKSPACE_KEYS = new Set([
  "storagereference", "checksum", "contentbase64", "materializationattemptid",
  "materializationid", "providerassetid", "providergroupid", "asseturi", "accesstoken",
  "authorization", "internaltoken", "idempotencykey", "grant", "projectgrant",
  "productionpackage", "packagesnapshot", "payloaddigest", "localpath", "signedurl",
]);
const FORBIDDEN_WORKSPACE_VALUES = [
  "asset://", "bearer ", "x-amz-credential=", "x-amz-signature=", "x-tos-signature=",
  "access_token=", "blob:", "data:",
];
const FORBIDDEN_MATERIALIZATION_KEYS = new Set([
  "storagereference", "signedurl", "previewurl", "controlledpreviewurl", "accesstoken",
  "authorization", "internaltoken", "providercredential", "providerrawbody",
]);

function fail(code: CanvasWorkspaceContractErrorCode): never {
  throw new CanvasWorkspaceContractError(code);
}

function scan(value: unknown, forbiddenKeys: Set<string>, forbiddenValues: readonly string[], code: CanvasWorkspaceContractErrorCode): void {
  if (Array.isArray(value)) {
    value.forEach((item) => scan(item, forbiddenKeys, forbiddenValues, code));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) fail(code);
    if (typeof child === "string" && forbiddenValues.some((marker) => child.toLowerCase().includes(marker))) fail(code);
    scan(child, forbiddenKeys, forbiddenValues, code);
  }
}

function scopeMatches(value: { tenantId: string; projectId: string; packageId: string; canvasSessionId: string }, expected: CanvasWorkspaceV01): boolean {
  return value.tenantId === expected.tenantId && value.projectId === expected.projectId
    && value.packageId === expected.packageId && value.canvasSessionId === expected.canvasSessionId;
}

function unique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

function expectedWorkspaceReasons(value: CanvasWorkspaceV01): typeof CANVAS_WORKSPACE_REASON_CODES[number][] {
  const reasons: typeof CANVAS_WORKSPACE_REASON_CODES[number][] = [];
  if (value.bootstrap.status === "blocked") reasons.push("WORKSPACE_CAPABILITY_BLOCKED");
  if (value.shots.some((shot) => !shot.readiness.ready)) reasons.push("WORKSPACE_SHOT_BLOCKED");
  if (!value.completeness.assets) reasons.push("WORKSPACE_ASSET_AGGREGATE_INCOMPLETE");
  if (!value.completeness.requirements) reasons.push("WORKSPACE_REQUIREMENTS_INCOMPLETE");
  if (!value.completeness.readiness) reasons.push("WORKSPACE_READINESS_INCOMPLETE");
  if (!value.completeness.outputs) reasons.push("WORKSPACE_OUTPUTS_INCOMPLETE");
  if (!value.completeness.events) reasons.push("WORKSPACE_EVENTS_INCOMPLETE");
  if (!value.completeness.controlledMedia) reasons.push("WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE");
  return reasons;
}

function parseNestedWorkspace(raw: z.infer<typeof workspaceSchema>): CanvasWorkspaceV01 {
  let bootstrap: CanvasBootstrapV01;
  let document: CanvasDocumentV01;
  const shots: CanvasWorkspaceShotV01[] = [];
  try {
    const parsedBootstrap = parseCanvasV1BrowserContract(raw.bootstrap);
    const parsedDocument = parseCanvasV1BrowserContract(raw.document);
    if (parsedBootstrap.objectType !== "CanvasBootstrap" || parsedDocument.objectType !== "CanvasDocument") {
      fail("CANVAS_WORKSPACE_SCHEMA_INVALID");
    }
    bootstrap = parsedBootstrap;
    document = parsedDocument;
    for (const shot of raw.shots) {
      const requirements = shot.requirements.map((item) => {
        const parsed = parseCanvasV1BrowserContract(item);
        if (parsed.objectType !== "ShotAssetRequirement") fail("CANVAS_WORKSPACE_SCHEMA_INVALID");
        return parsed;
      });
      const readiness = parseCanvasV1BrowserContract(shot.readiness);
      if (readiness.objectType !== "ShotReadiness") fail("CANVAS_WORKSPACE_SCHEMA_INVALID");
      const parsedEvent = shot.event === null ? null : parseCanvasV1BrowserContract(shot.event);
      if (parsedEvent !== null && parsedEvent.objectType !== "CanvasEvent") fail("CANVAS_WORKSPACE_SCHEMA_INVALID");
      shots.push({ ...shot, requirements, readiness, event: parsedEvent });
    }
  } catch (error) {
    if (error instanceof CanvasWorkspaceContractError) throw error;
    fail("CANVAS_WORKSPACE_SCHEMA_INVALID");
  }
  return { ...raw, bootstrap, document, shots };
}

function assertWorkspaceSemantics(value: CanvasWorkspaceV01): void {
  if (!scopeMatches(value.bootstrap, value) || !scopeMatches(value.document, value)) {
    fail("CANVAS_WORKSPACE_SCOPE_MISMATCH");
  }
  if (value.bootstrap.document.documentId !== value.document.documentId
    || value.bootstrap.document.version !== value.document.version) {
    fail("CANVAS_WORKSPACE_DOCUMENT_MISMATCH");
  }
  if (value.shots.length !== value.document.shots.length
    || !unique(value.shots.map(({ shotId }) => shotId))
    || !unique(value.shots.flatMap(({ outputs }) => outputs.map(({ assetId }) => assetId)))) {
    fail("CANVAS_WORKSPACE_SHOT_MISMATCH");
  }
  const scriptText = value.shots[0]?.scriptText;
  for (const [index, shot] of value.shots.entries()) {
    const documentShot = value.document.shots[index];
    if (!documentShot || shot.shotId !== documentShot.shotId || documentShot.position !== index
      || shot.sequence !== index + 1 || shot.title !== `镜头 ${String(index + 1).padStart(2, "0")}`
      || shot.scriptText !== scriptText) {
      fail("CANVAS_WORKSPACE_SHOT_MISMATCH");
    }
    for (const requirement of shot.requirements) {
      if (!scopeMatches(requirement, value) || requirement.shotId !== shot.shotId
        || requirement.source.scriptId !== value.bootstrap.approvedScript.scriptId
        || requirement.source.scriptVersion !== value.bootstrap.approvedScript.version
        || requirement.source.storyboardId !== value.bootstrap.approvedStoryboard.storyboardId
        || requirement.source.storyboardVersion !== value.bootstrap.approvedStoryboard.version) {
        fail("CANVAS_WORKSPACE_REQUIREMENT_MISMATCH");
      }
    }
    const labels = [...new Set(shot.requirements.map(({ assetCategory }) => CATEGORY_LABELS[assetCategory]))];
    if (JSON.stringify(labels) !== JSON.stringify(shot.requiredAssetLabels)) {
      fail("CANVAS_WORKSPACE_REQUIREMENT_MISMATCH");
    }
    if (!scopeMatches(shot.readiness, value) || shot.readiness.shotId !== shot.shotId
      || shot.readiness.script.scriptId !== value.bootstrap.approvedScript.scriptId
      || shot.readiness.script.version !== value.bootstrap.approvedScript.version
      || shot.readiness.storyboard.storyboardId !== value.bootstrap.approvedStoryboard.storyboardId
      || shot.readiness.storyboard.version !== value.bootstrap.approvedStoryboard.version
      || JSON.stringify(shot.readiness.requirements.map(({ requirementId }) => requirementId))
        !== JSON.stringify(shot.requirements.map(({ requirementId }) => requirementId))) {
      fail("CANVAS_WORKSPACE_READINESS_MISMATCH");
    }
    const selected = shot.outputs.filter(({ selected }) => selected);
    if (selected.length !== (documentShot.selectedOutputAssetId ? 1 : 0)
      || (selected[0]?.assetId ?? null) !== documentShot.selectedOutputAssetId
      || shot.thumbnailUrl !== (selected[0]?.previewUrl ?? null)
      || !unique(shot.outputs.map(({ assetId }) => assetId))) {
      fail("CANVAS_WORKSPACE_OUTPUT_MISMATCH");
    }
    if (shot.event && (!scopeMatches(shot.event, value) || shot.event.commandType !== "GENERATE_SHOT")) {
      fail(shot.event.commandType === "GENERATE_SHOT" ? "CANVAS_WORKSPACE_SCOPE_MISMATCH" : "CANVAS_WORKSPACE_EVENT_MISMATCH");
    }
  }
  if (value.assets.length !== value.bootstrap.assetSummaries.length
    || !unique(value.assets.map(({ assetId }) => assetId))) {
    fail("CANVAS_WORKSPACE_ASSET_MISMATCH");
  }
  for (const [index, asset] of value.assets.entries()) {
    const summary = value.bootstrap.assetSummaries[index];
    const summaryKeys = [
      "assetId", "category", "displayName", "rightsStatus", "approvalStatus",
      "providerStatus", "entityBindingStatus", "controlledPreviewUrl",
    ] as const;
    if (!summary || summaryKeys.some((key) => asset[key] !== summary[key])) {
      fail("CANVAS_WORKSPACE_ASSET_MISMATCH");
    }
    const state = asset.materialization;
    if (asset.category !== "virtual_character") {
      if (state.status !== "unsupported" || state.reasonCode !== "CATEGORY_UNSUPPORTED") fail("CANVAS_WORKSPACE_ASSET_MISMATCH");
    } else if (asset.rightsStatus !== "authorized") {
      if (state.status !== "blocked" || state.reasonCode !== "RIGHTS_NOT_AUTHORIZED") fail("CANVAS_WORKSPACE_ASSET_MISMATCH");
    } else if (asset.approvalStatus !== "approved") {
      if (state.status !== "blocked" || state.reasonCode !== "APPROVAL_NOT_APPROVED") fail("CANVAS_WORKSPACE_ASSET_MISMATCH");
    } else if (
      (state.status === "ready" && state.reasonCode !== null)
      || (state.status === "not_started" && state.reasonCode !== "MATERIALIZATION_REQUIRED")
      || (state.status === "blocked" && !["SOURCE_UNAVAILABLE", "MATERIALIZATION_CONFLICT"].includes(state.reasonCode ?? ""))
      || state.status === "unsupported"
    ) {
      fail("CANVAS_WORKSPACE_ASSET_MISMATCH");
    }
  }
  const reasons = expectedWorkspaceReasons(value);
  if (JSON.stringify(value.reasonCodes) !== JSON.stringify(reasons)
    || value.status !== (reasons.length === 0 ? "ready" : "blocked")) {
    fail("CANVAS_WORKSPACE_STATUS_INCONSISTENT");
  }
}

export function parseCanvasWorkspaceV01(input: unknown): CanvasWorkspaceV01 {
  scan(input, FORBIDDEN_WORKSPACE_KEYS, FORBIDDEN_WORKSPACE_VALUES, "CANVAS_WORKSPACE_BROWSER_UNSAFE");
  const parsed = workspaceSchema.safeParse(input);
  if (!parsed.success) fail("CANVAS_WORKSPACE_SCHEMA_INVALID");
  const value = parseNestedWorkspace(parsed.data);
  assertWorkspaceSemantics(value);
  return value;
}

export function parseCanvasAssetMaterializationRequestV01(input: unknown): CanvasAssetMaterializationRequestV01 {
  const parsed = materializationRequestSchema.safeParse(input);
  if (!parsed.success) fail("CANVAS_MATERIALIZATION_REQUEST_INVALID");
  if (Buffer.byteLength(JSON.stringify(parsed.data), "utf8") > 16 * 1024) fail("CANVAS_MATERIALIZATION_REQUEST_INVALID");
  return parsed.data;
}

function record(input: unknown): Record<string, unknown> | null {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null;
}

function magicMime(bytes: Buffer): CanvasAssetMaterializationV01["mimeType"] | null {
  if (bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  return null;
}

function isBase64Alphabet(code: number): boolean {
  return (code >= 0x41 && code <= 0x5a)
    || (code >= 0x61 && code <= 0x7a)
    || (code >= 0x30 && code <= 0x39)
    || code === 0x2b
    || code === 0x2f;
}

function decodeCanonicalBase64(value: string): Buffer | null {
  if (value.length < 4 || value.length % 4 !== 0) return null;
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  const contentLength = value.length - padding;
  if ((padding === 0 && contentLength % 4 !== 0)
    || (padding === 1 && contentLength % 4 !== 3)
    || (padding === 2 && contentLength % 4 !== 2)) return null;
  for (let index = 0; index < contentLength; index += 1) {
    if (!isBase64Alphabet(value.charCodeAt(index))) return null;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) return null;
  }
  const bytes = Buffer.from(value, "base64");
  return bytes.toString("base64") === value ? bytes : null;
}

function parseCanvasAssetMaterializationInternal(input: unknown): CanvasAssetMaterializationV01 {
  scan(input, FORBIDDEN_MATERIALIZATION_KEYS, ["bearer ", "x-tos-signature=", "x-amz-signature="], "CANVAS_MATERIALIZATION_RESPONSE_INVALID");
  const candidate = record(input);
  if (candidate?.category !== undefined && candidate.category !== "virtual_character") {
    fail("CANVAS_MATERIALIZATION_CATEGORY_UNSUPPORTED");
  }
  if (candidate && (candidate.byteSize === 0 || candidate.contentBase64 === "")) fail("CANVAS_MATERIALIZATION_SOURCE_EMPTY");
  if (candidate && typeof candidate.byteSize === "number" && candidate.byteSize > MAX_MATERIALIZATION_BYTES) {
    fail("CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE");
  }
  if (candidate?.mimeType !== undefined && !["image/jpeg", "image/png", "image/webp"].includes(String(candidate.mimeType))) {
    fail("CANVAS_MATERIALIZATION_MIME_UNSUPPORTED");
  }
  if (candidate && typeof candidate.contentBase64 === "string"
    && candidate.contentBase64.length > MAX_MATERIALIZATION_BASE64_CHARS) {
    fail("CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE");
  }
  const decoded = candidate && typeof candidate.contentBase64 === "string"
    ? decodeCanonicalBase64(candidate.contentBase64)
    : null;
  if (candidate && typeof candidate.contentBase64 === "string" && decoded === null) {
    fail("CANVAS_MATERIALIZATION_RESPONSE_INVALID");
  }
  const parsed = materializationResponseSchema.safeParse(input);
  if (!parsed.success) fail("CANVAS_MATERIALIZATION_RESPONSE_INVALID");
  const bytes = decoded!;
  if (bytes.length === 0) fail("CANVAS_MATERIALIZATION_SOURCE_EMPTY");
  if (bytes.length > MAX_MATERIALIZATION_BYTES) fail("CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE");
  const derivedMime = magicMime(bytes);
  if (derivedMime === null) fail("CANVAS_MATERIALIZATION_MIME_UNSUPPORTED");
  const checksum = `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
  if (parsed.data.byteSize !== bytes.length || parsed.data.mimeType !== derivedMime || parsed.data.checksum !== checksum) {
    fail("CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED");
  }
  return parsed.data;
}

export function parseCanvasAssetMaterializationV01(input: unknown): CanvasAssetMaterializationV01 {
  try {
    return parseCanvasAssetMaterializationInternal(input);
  } catch (error) {
    if (error instanceof CanvasWorkspaceContractError) throw error;
    fail("CANVAS_MATERIALIZATION_RESPONSE_INVALID");
  }
}

export function assertCanvasAssetMaterializationMatchesRequest(
  response: CanvasAssetMaterializationV01,
  request: CanvasAssetMaterializationRequestV01,
): void {
  if (response.tenantId !== request.tenantId || response.projectId !== request.projectId
    || response.packageId !== request.packageId || response.canvasSessionId !== request.canvasSessionId
    || response.assetId !== request.assetId
    || response.materializationAttemptId !== request.materializationAttemptId) {
    fail("CANVAS_MATERIALIZATION_SCOPE_MISMATCH");
  }
}

export function decideCanvasAssetMaterializationReplay(
  existing: CanvasAssetMaterializationRequestV01,
  incoming: CanvasAssetMaterializationRequestV01,
): { outcome: "new" | "replay"; replayed: boolean } {
  const left = parseCanvasAssetMaterializationRequestV01(existing);
  const right = parseCanvasAssetMaterializationRequestV01(incoming);
  if (left.materializationAttemptId !== right.materializationAttemptId) return { outcome: "new", replayed: false };
  const semanticKeys = ["tenantId", "projectId", "packageId", "canvasSessionId", "assetId", "actorId"] as const;
  if (semanticKeys.some((key) => left[key] !== right[key])) fail("CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT");
  return { outcome: "replay", replayed: true };
}
