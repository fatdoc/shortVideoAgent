import { z } from 'zod';
import { canvasAssetError } from './errors.js';
import {
  ASSET_APPROVAL_STATUSES,
  ASSET_CATEGORIES,
  ASSET_RIGHTS_STATUSES,
  HIGH_COST_COMMAND_TYPES,
  type AssetRecordProjection,
  type ConsumeHighCostApprovalInput,
  type CreateAssetInput,
  type CreateHighCostApprovalInput,
  type HighCostApprovalProjection,
  type TransitionAssetApprovalInput,
  type TransitionAssetRightsInput,
} from './types.js';

const uuid = z.string().uuid();
const timestamp = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
const canvasSessionId = z.string().regex(/^pcs_[A-Za-z0-9_-]{24,128}$/);
const checksum = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const controlledPreviewUrl = z
  .string()
  .max(2048)
  .regex(/^(?:\/api\/canvas-v1\/[A-Za-z0-9_./-]+|https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9_./%-]+)$/)
  .nullable();
const provenanceKind = z.enum([
  'customer_upload',
  'provider_generated',
  'licensed',
  'control_synced',
]);
const rightsBasis = z.enum([
  'customer_owned',
  'licensed',
  'provider_generated',
  'external_identity_verification',
]);

const projectionSchema = z
  .object({
    objectType: z.literal('AssetRecord'),
    contractVersion: z.literal('0.1'),
    tenantId: uuid,
    projectId: uuid,
    packageId: uuid,
    canvasSessionId,
    assetId: uuid,
    category: z.enum(ASSET_CATEGORIES),
    displayName: z.string().min(1).max(200),
    provenance: z
      .object({
        kind: provenanceKind,
        sourceAssetId: uuid.nullable(),
        declaredByActorId: uuid,
        declaredAt: timestamp,
      })
      .strict(),
    rights: z
      .object({
        status: z.enum(ASSET_RIGHTS_STATUSES),
        basis: rightsBasis,
        validFrom: timestamp.nullable(),
        validUntil: timestamp.nullable(),
        reviewedAt: timestamp.nullable(),
      })
      .strict(),
    approval: z
      .object({
        status: z.enum(ASSET_APPROVAL_STATUSES),
        reviewedByActorId: uuid.nullable(),
        reviewedAt: timestamp.nullable(),
      })
      .strict(),
    controlledPreviewUrl,
    createdAt: timestamp,
    updatedAt: timestamp,
    occurredAt: timestamp,
  })
  .strict();

const storageReference = z
  .string()
  .min(1)
  .max(1024)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/)
  .refine((value) => !value.split('/').includes('..'))
  .refine((value) => !/(?:^|\/)(?:storycanvas|.*\.sqlite(?:3)?)(?:\/|$)/i.test(value))
  .refine(
    (value) =>
      !/(?:^|[._/-])(?:token|credential|secret|bearer|authorization|cookie|projectgrant)(?:[._/-]|$)/i.test(
        value,
      ),
  )
  .refine((value) => !value.toLowerCase().includes('asset://'));

const createAssetSchema = z
  .object({
    packageId: uuid,
    canvasSessionId,
    category: z.enum(ASSET_CATEGORIES),
    displayName: z.string().trim().min(1).max(200),
    provenance: z.object({ kind: provenanceKind, sourceAssetId: uuid.nullable() }).strict(),
    rights: z
      .object({
        status: z.enum(['pending', 'authorized']),
        basis: rightsBasis,
        validFrom: timestamp.nullable(),
        validUntil: timestamp.nullable(),
      })
      .strict(),
    storageReference,
    checksum,
    reuseScope: z.enum(['project', 'tenant']),
    controlledPreviewUrl,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.rights.status === 'pending' && (value.rights.validFrom || value.rights.validUntil)) {
      context.addIssue({ code: 'custom', message: 'pending rights cannot have a validity window' });
    }
    if (value.rights.status === 'authorized') {
      if (!value.rights.validFrom) {
        context.addIssue({ code: 'custom', message: 'authorized rights require validFrom' });
      }
      if (
        value.rights.validFrom &&
        value.rights.validUntil &&
        value.rights.validFrom >= value.rights.validUntil
      ) {
        context.addIssue({ code: 'custom', message: 'rights validity window is invalid' });
      }
    }
  });

const transitionRightsSchema = z
  .object({
    status: z.enum(['authorized', 'rejected', 'revoked', 'expired']),
    validFrom: timestamp.nullable(),
    validUntil: timestamp.nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'authorized' && !value.validFrom) {
      context.addIssue({ code: 'custom', message: 'authorized rights require validFrom' });
    }
    if (
      value.validFrom &&
      value.validUntil &&
      new Date(value.validFrom).getTime() >= new Date(value.validUntil).getTime()
    ) {
      context.addIssue({ code: 'custom', message: 'rights validity window is invalid' });
    }
  });

const transitionApprovalSchema = z
  .object({ status: z.enum(['approved', 'rejected', 'revoked']) })
  .strict();

const jsonValue: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(4000),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(jsonValue).max(100),
    z.record(z.string().min(1).max(100), jsonValue),
  ]),
);

const createHighCostApprovalSchema = z
  .object({
    packageId: uuid,
    canvasSessionId,
    commandType: z.enum(HIGH_COST_COMMAND_TYPES),
    action: z.record(z.string().min(1).max(100), jsonValue),
    expiresInSeconds: z.number().int().min(30).max(300),
    replayPolicy: z.literal('single_use_replay_same_command'),
  })
  .strict()
  .refine((value) => Object.keys(value.action).length > 0)
  .refine((value) => Buffer.byteLength(JSON.stringify(value.action), 'utf8') <= 64 * 1024);

const consumeHighCostApprovalSchema = z
  .object({
    approvalId: uuid,
    tenantId: uuid,
    projectId: uuid,
    packageId: uuid,
    canvasSessionId,
    actorId: uuid,
    commandType: z.enum(HIGH_COST_COMMAND_TYPES),
    action: z.record(z.string().min(1).max(100), jsonValue),
    commandId: uuid,
  })
  .strict()
  .refine((value) => Object.keys(value.action).length > 0)
  .refine((value) => Buffer.byteLength(JSON.stringify(value.action), 'utf8') <= 64 * 1024);

const highCostApprovalProjectionSchema = z
  .object({
    approvalId: uuid,
    status: z.enum(['active', 'consumed', 'expired', 'revoked']),
  })
  .strict();

const forbiddenBrowserKeys = new Set([
  'remoteassetid',
  'asseturi',
  'groupid',
  'providerassetid',
  'providergroupid',
  'providertaskid',
  'accesstoken',
  'authorization',
  'cookie',
  'grant',
  'projectgrant',
  'productionpackage',
  'packagesnapshot',
  'payloaddigest',
  'approvedscriptdigest',
  'approvedstoryboarddigest',
  'idempotencykey',
  'internaltoken',
  'credential',
  'secret',
  'password',
  'localpath',
  'databaseid',
  'providerrawbody',
  'providerrawmessage',
  'userconfirmed',
]);
const forbiddenProjectionOnlyKeys = new Set(['storagereference', 'checksum']);
const forbiddenValuePatterns = [
  /asset:\/\//i,
  /bearer\s/i,
  /x-amz-credential=/i,
  /x-amz-signature=/i,
  /x-tos-signature=/i,
  /access_token=/i,
];

function scanBrowser(value: unknown, projection: boolean, seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (forbiddenValuePatterns.some((pattern) => pattern.test(value))) unsafe();
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) unsafe();
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) scanBrowser(item, projection, seen);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (forbiddenBrowserKeys.has(normalized)) unsafe();
    if (projection && forbiddenProjectionOnlyKeys.has(normalized)) unsafe();
    scanBrowser(item, projection, seen);
  }
}

function unsafe(): never {
  throw canvasAssetError(
    'CANVAS_BROWSER_PROJECTION_UNSAFE',
    'Canvas browser input or projection contains a forbidden server-only marker.',
  );
}

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw canvasAssetError(
      'CANVAS_SCHEMA_INVALID',
      'Canvas Asset input violated the strict contract.',
    );
  }
  return parsed.data;
}

export function assertBrowserSafeAssetInput(value: unknown): void {
  scanBrowser(value, false);
}

export function assertBrowserSafeAssetProjection(value: unknown): void {
  scanBrowser(value, true);
}

export function parseAssetRecordProjection(value: unknown): AssetRecordProjection {
  assertBrowserSafeAssetProjection(value);
  return parse(projectionSchema, value);
}

export function parseCreateAssetInput(value: unknown): CreateAssetInput {
  assertBrowserSafeAssetInput(value);
  return parse(createAssetSchema, value);
}

export function parseTransitionAssetRightsInput(value: unknown): TransitionAssetRightsInput {
  assertBrowserSafeAssetInput(value);
  return parse(transitionRightsSchema, value);
}

export function parseTransitionAssetApprovalInput(value: unknown): TransitionAssetApprovalInput {
  assertBrowserSafeAssetInput(value);
  return parse(transitionApprovalSchema, value);
}

export function parseCreateHighCostApprovalInput(value: unknown): CreateHighCostApprovalInput {
  assertBrowserSafeAssetInput(value);
  return parse(createHighCostApprovalSchema, value);
}

export function parseConsumeHighCostApprovalInput(value: unknown): ConsumeHighCostApprovalInput {
  return parse(consumeHighCostApprovalSchema, value);
}

export function parseHighCostApprovalProjection(value: unknown): HighCostApprovalProjection {
  assertBrowserSafeAssetProjection(value);
  return parse(highCostApprovalProjectionSchema, value);
}

export function parseUuid(value: unknown): string {
  return parse(uuid, value);
}
