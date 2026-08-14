import { z } from 'zod';
import { parseAssetRecordProjection } from './parser.js';
import { ASSET_CATEGORIES, type AssetRecordProjection } from './types.js';
import { CanvasWorkspaceAuthorityError, workspaceAuthorityError } from './workspaceAuthorityErrors.js';
import {
  CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES,
  type CanvasWorkspaceAuthorityRequest,
  type CanvasWorkspaceAuthorityResponse,
} from './workspaceAuthorityTypes.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

const uuid = z.string().regex(UUID);
const timestamp = z.string().regex(TIMESTAMP);
const requestId = z.string().regex(REQUEST_ID);
const canvasSessionId = z.string().regex(/^pcs_[A-Za-z0-9_-]{24,128}$/);

const requestSchema = z
  .object({
    objectType: z.literal('CanvasWorkspaceAuthorityRequest'),
    contractVersion: z.literal('0.1'),
    tenantId: uuid,
    projectId: uuid,
    packageId: uuid,
    canvasSessionId,
    actorId: uuid,
    requestId,
    occurredAt: timestamp,
  })
  .strict();

const approvedVersionSchema = z
  .object({
    scriptId: uuid.optional(),
    storyboardId: uuid.optional(),
    version: z.number().int().positive(),
  })
  .strict();

const responseSchema = z
  .object({
    objectType: z.literal('CanvasWorkspaceAuthority'),
    contractVersion: z.literal('0.1'),
    tenantId: uuid,
    projectId: uuid,
    packageId: uuid,
    canvasSessionId,
    project: z.object({ projectName: z.string().min(1).max(200) }).strict(),
    approvedScript: approvedVersionSchema.refine(
      (value) => value.scriptId !== undefined && value.storyboardId === undefined,
    ),
    approvedStoryboard: approvedVersionSchema.refine(
      (value) => value.storyboardId !== undefined && value.scriptId === undefined,
    ),
    assets: z.array(z.unknown()).max(1000),
    completeness: z
      .object({
        project: z.literal(true),
        approvedScript: z.literal(true),
        approvedStoryboard: z.literal(true),
        assets: z.literal(true),
      })
      .strict(),
    requestId,
    occurredAt: timestamp,
  })
  .strict();

const forbiddenKeys = new Set([
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
  'storagereference',
  'checksum',
  'contentbase64',
  'internalid',
  'signedurl',
]);

const forbiddenValues = [
  /asset:\/\//i,
  /bearer\s/i,
  /x-amz-credential=/i,
  /x-amz-signature=/i,
  /x-tos-signature=/i,
  /access_token=/i,
  /blob:/i,
  /data:/i,
];

function fail(code: ConstructorParameters<typeof CanvasWorkspaceAuthorityError>[0]): never {
  throw workspaceAuthorityError(code);
}

function isCanonicalTimestamp(value: string): boolean {
  if (!TIMESTAMP.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value;
}

function scanBrowserSafe(value: unknown, seen = new Set<object>()): void {
  if (typeof value === 'string') {
    if (forbiddenValues.some((pattern) => pattern.test(value))) {
      fail('CANVAS_WORKSPACE_AUTHORITY_BROWSER_UNSAFE');
    }
    return;
  }
  if (!value || typeof value !== 'object') return;
  if (seen.has(value)) fail('CANVAS_WORKSPACE_AUTHORITY_BROWSER_UNSAFE');
  seen.add(value);
  if (Array.isArray(value)) {
    for (const item of value) scanBrowserSafe(item, seen);
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (forbiddenKeys.has(key.toLowerCase())) {
      fail('CANVAS_WORKSPACE_AUTHORITY_BROWSER_UNSAFE');
    }
    scanBrowserSafe(item, seen);
  }
}

function assertCanonicalAssetTimestamps(asset: AssetRecordProjection): void {
  const values = [
    asset.occurredAt,
    asset.createdAt,
    asset.updatedAt,
    asset.provenance.declaredAt,
    asset.rights.validFrom,
    asset.rights.validUntil,
    asset.rights.reviewedAt,
    asset.approval.reviewedAt,
  ];
  if (values.some((value) => value !== null && !isCanonicalTimestamp(value))) {
    fail('CANVAS_WORKSPACE_AUTHORITY_RESPONSE_INVALID');
  }
}

function assertLowercaseAssetIds(asset: AssetRecordProjection): void {
  const values = [
    asset.tenantId,
    asset.projectId,
    asset.packageId,
    asset.assetId,
    asset.provenance.declaredByActorId,
    asset.provenance.sourceAssetId,
    asset.approval.reviewedByActorId,
  ];
  if (values.some((value) => value !== null && !UUID.test(value))) {
    fail('CANVAS_WORKSPACE_AUTHORITY_RESPONSE_INVALID');
  }
}

export function parseCanvasWorkspaceAuthorityRequest(
  input: unknown,
): CanvasWorkspaceAuthorityRequest {
  const parsed = requestSchema.safeParse(input);
  if (
    !parsed.success ||
    !isCanonicalTimestamp(parsed.data.occurredAt) ||
    Buffer.byteLength(JSON.stringify(parsed.data), 'utf8') >
      CANVAS_WORKSPACE_AUTHORITY_MAX_REQUEST_BYTES
  ) {
    fail('CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID');
  }
  return parsed.data;
}

export function parseCanvasWorkspaceAuthorityResponse(
  input: unknown,
): CanvasWorkspaceAuthorityResponse {
  try {
    scanBrowserSafe(input);
    if (input && typeof input === 'object' && !Array.isArray(input)) {
      const completeness = (input as Record<string, unknown>).completeness;
      if (completeness && typeof completeness === 'object' && !Array.isArray(completeness)) {
        if (Object.values(completeness).some((value) => value !== true)) {
          fail('CANVAS_WORKSPACE_AUTHORITY_INCOMPLETE');
        }
      }
    }
    const parsed = responseSchema.safeParse(input);
    if (!parsed.success || !isCanonicalTimestamp(parsed.data.occurredAt)) {
      fail('CANVAS_WORKSPACE_AUTHORITY_RESPONSE_INVALID');
    }
    const assets = parsed.data.assets.map((value) => {
      const asset = parseAssetRecordProjection(value);
      assertCanonicalAssetTimestamps(asset);
      assertLowercaseAssetIds(asset);
      if (
        asset.tenantId !== parsed.data.tenantId ||
        asset.projectId !== parsed.data.projectId ||
        asset.packageId !== parsed.data.packageId ||
        asset.canvasSessionId !== parsed.data.canvasSessionId
      ) {
        fail('CANVAS_WORKSPACE_AUTHORITY_SCOPE_MISMATCH');
      }
      return asset;
    });
    if (new Set(assets.map(({ assetId }) => assetId)).size !== assets.length) {
      fail('CANVAS_WORKSPACE_AUTHORITY_RESPONSE_INVALID');
    }
    const categoryRank = new Map(ASSET_CATEGORIES.map((category, index) => [category, index]));
    const order = assets.map(
      ({ category, assetId }) =>
        `${String(categoryRank.get(category)).padStart(2, '0')}:${assetId.toLowerCase()}`,
    );
    if (order.some((value, index) => index > 0 && value < order[index - 1]!)) {
      fail('CANVAS_WORKSPACE_AUTHORITY_ASSET_ORDER_INVALID');
    }
    return {
      ...parsed.data,
      approvedScript: {
        scriptId: parsed.data.approvedScript.scriptId!,
        version: parsed.data.approvedScript.version,
      },
      approvedStoryboard: {
        storyboardId: parsed.data.approvedStoryboard.storyboardId!,
        version: parsed.data.approvedStoryboard.version,
      },
      assets,
    };
  } catch (error) {
    if (error instanceof CanvasWorkspaceAuthorityError) throw error;
    fail('CANVAS_WORKSPACE_AUTHORITY_RESPONSE_INVALID');
  }
}
