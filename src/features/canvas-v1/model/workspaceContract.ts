import {
  parseCanvasV1BrowserContract,
  type ApprovalStatus,
  type AssetCategory,
  type CanvasBootstrapV01,
  type CanvasDocumentV01,
  type CanvasEventV01,
  type EntityBindingStatus,
  type ProviderStatus,
  type RightsStatus,
  type ShotAssetRequirementV01,
  type ShotReadinessV01,
} from './contracts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SESSION = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const CONTROLLED_MEDIA = /^\/(?:api\/canvas-v1|api\/production\/pilot\/canvas\/v1\/media)\/[A-Za-z0-9_./%-]+$/;
const OUTPUT_MEDIA = /^\/api\/production\/pilot\/canvas\/v1\/media\/[A-Za-z0-9_./%-]+$/;

export const CANVAS_WORKSPACE_REASON_CODES = [
  'WORKSPACE_CAPABILITY_BLOCKED',
  'WORKSPACE_SHOT_BLOCKED',
  'WORKSPACE_ASSET_AGGREGATE_INCOMPLETE',
  'WORKSPACE_REQUIREMENTS_INCOMPLETE',
  'WORKSPACE_READINESS_INCOMPLETE',
  'WORKSPACE_OUTPUTS_INCOMPLETE',
  'WORKSPACE_EVENTS_INCOMPLETE',
  'WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE',
] as const;

export type CanvasWorkspaceReasonCode = (typeof CANVAS_WORKSPACE_REASON_CODES)[number];
export type CanvasWorkspaceContractErrorCode =
  | 'CANVAS_WORKSPACE_SCHEMA_INVALID'
  | 'CANVAS_WORKSPACE_BROWSER_UNSAFE'
  | 'CANVAS_WORKSPACE_SCOPE_MISMATCH'
  | 'CANVAS_WORKSPACE_DOCUMENT_MISMATCH'
  | 'CANVAS_WORKSPACE_SHOT_MISMATCH'
  | 'CANVAS_WORKSPACE_REQUIREMENT_MISMATCH'
  | 'CANVAS_WORKSPACE_READINESS_MISMATCH'
  | 'CANVAS_WORKSPACE_ASSET_MISMATCH'
  | 'CANVAS_WORKSPACE_OUTPUT_MISMATCH'
  | 'CANVAS_WORKSPACE_EVENT_MISMATCH'
  | 'CANVAS_WORKSPACE_STATUS_INCONSISTENT';

export class CanvasWorkspaceContractError extends Error {
  readonly code: CanvasWorkspaceContractErrorCode;

  constructor(code: CanvasWorkspaceContractErrorCode) {
    super(code);
    this.name = 'CanvasWorkspaceContractError';
    this.code = code;
  }
}

export interface CanvasWorkspaceAssetV01 {
  assetId: string;
  category: AssetCategory;
  displayName: string;
  rightsStatus: RightsStatus;
  approvalStatus: ApprovalStatus;
  providerStatus: ProviderStatus;
  entityBindingStatus: EntityBindingStatus;
  controlledPreviewUrl: string | null;
  targetEntityId: string | null;
  materialization: {
    status: 'not_started' | 'ready' | 'blocked' | 'unsupported';
    reasonCode:
      | 'MATERIALIZATION_REQUIRED'
      | 'RIGHTS_NOT_AUTHORIZED'
      | 'APPROVAL_NOT_APPROVED'
      | 'SOURCE_UNAVAILABLE'
      | 'MATERIALIZATION_CONFLICT'
      | 'CATEGORY_UNSUPPORTED'
      | null;
  };
}

export interface CanvasWorkspaceOutputV01 {
  assetId: string;
  kind: 'image' | 'video';
  previewUrl: string;
  selected: boolean;
}

export interface CanvasWorkspaceShotV01 {
  shotId: string;
  sequence: number;
  title: string;
  durationSeconds: number;
  scriptText: string;
  storyboardText: string;
  thumbnailUrl: string | null;
  requirements: ShotAssetRequirementV01[];
  readiness: ShotReadinessV01;
  requiredAssetLabels: string[];
  outputs: CanvasWorkspaceOutputV01[];
  event: CanvasEventV01 | null;
}

export interface CanvasWorkspaceV01 {
  objectType: 'CanvasWorkspace';
  contractVersion: '0.1';
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  status: 'ready' | 'blocked';
  reasonCodes: CanvasWorkspaceReasonCode[];
  completeness: {
    assets: boolean;
    requirements: boolean;
    readiness: boolean;
    outputs: boolean;
    events: boolean;
    controlledMedia: boolean;
  };
  project: { projectName: string; requestedByActorId: string };
  bootstrap: CanvasBootstrapV01;
  document: CanvasDocumentV01;
  shots: CanvasWorkspaceShotV01[];
  assets: CanvasWorkspaceAssetV01[];
  saveState: 'saved';
  requestId: string;
  occurredAt: string;
}

type UnknownRecord = Record<string, unknown>;

const CATEGORIES: readonly AssetCategory[] = ['human', 'virtual_character', 'store', 'product', 'brand', 'prop', 'voice', 'image', 'video'];
const RIGHTS: readonly RightsStatus[] = ['pending', 'authorized', 'rejected', 'revoked', 'expired'];
const APPROVALS: readonly ApprovalStatus[] = ['pending', 'approved', 'rejected', 'revoked'];
const PROVIDERS: readonly ProviderStatus[] = ['processing', 'active', 'rejected', 'failed', 'unavailable'];
const BINDINGS: readonly EntityBindingStatus[] = ['pending', 'approved', 'rejected', 'revoked'];
const MATERIALIZATION_STATUSES = ['not_started', 'ready', 'blocked', 'unsupported'] as const;
const MATERIALIZATION_REASONS = [
  'MATERIALIZATION_REQUIRED', 'RIGHTS_NOT_AUTHORIZED', 'APPROVAL_NOT_APPROVED',
  'SOURCE_UNAVAILABLE', 'MATERIALIZATION_CONFLICT', 'CATEGORY_UNSUPPORTED',
] as const;
const CATEGORY_LABELS: Record<AssetCategory, string> = {
  human: '真人', virtual_character: '虚拟人物', store: '门店', product: '商品', brand: '品牌',
  prop: '道具', voice: '声音', image: '图片', video: '视频',
};
const FORBIDDEN_KEYS = new Set([
  'storagereference', 'checksum', 'contentbase64', 'materializationattemptid', 'materializationid',
  'providerassetid', 'providergroupid', 'asseturi', 'accesstoken', 'authorization', 'internaltoken',
  'idempotencykey', 'grant', 'projectgrant', 'productionpackage', 'packagesnapshot', 'payloaddigest',
  'localpath', 'signedurl',
]);
const FORBIDDEN_VALUES = [
  'asset://', 'bearer ', 'x-amz-credential=', 'x-amz-signature=', 'x-tos-signature=',
  'access_token=', 'blob:', 'data:',
];

function fail(code: CanvasWorkspaceContractErrorCode = 'CANVAS_WORKSPACE_SCHEMA_INVALID'): never {
  throw new CanvasWorkspaceContractError(code);
}

function scan(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(scan); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail('CANVAS_WORKSPACE_BROWSER_UNSAFE');
    if (typeof child === 'string' && FORBIDDEN_VALUES.some((marker) => child.toLowerCase().includes(marker))) {
      fail('CANVAS_WORKSPACE_BROWSER_UNSAFE');
    }
    scan(child);
  }
}

function exact(value: unknown, keys: readonly string[]): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail();
  const output = value as UnknownRecord;
  if (Object.keys(output).sort().join('\0') !== [...keys].sort().join('\0')) fail();
  return output;
}

function text(value: unknown, min: number, max: number): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) fail();
  return value;
}

function pattern(value: unknown, expression: RegExp): string {
  const output = text(value, 1, 50_000);
  if (!expression.test(output)) fail();
  return output;
}

function canonicalUtcTimestamp(value: unknown): string {
  const output = pattern(value, TIMESTAMP);
  const milliseconds = Date.parse(output);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== output) fail();
  return output;
}

function enumeration<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) fail();
  return value as T;
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') fail();
  return value;
}

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || Number(value) <= 0) fail();
  return Number(value);
}

function positiveNumber(value: unknown, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0 || value > max) fail();
  return value;
}

function nullable<T>(value: unknown, parser: (input: unknown) => T): T | null {
  return value === null ? null : parser(value);
}

function list<T>(value: unknown, parser: (input: unknown) => T, min = 0, max = 1_000): T[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) fail();
  return value.map(parser);
}

function parseOutput(value: unknown): CanvasWorkspaceOutputV01 {
  const output = exact(value, ['assetId', 'kind', 'previewUrl', 'selected']);
  return {
    assetId: pattern(output.assetId, UUID),
    kind: enumeration(output.kind, ['image', 'video']),
    previewUrl: pattern(output.previewUrl, OUTPUT_MEDIA),
    selected: bool(output.selected),
  };
}

function parseAsset(value: unknown): CanvasWorkspaceAssetV01 {
  const output = exact(value, [
    'assetId', 'category', 'displayName', 'rightsStatus', 'approvalStatus', 'providerStatus',
    'entityBindingStatus', 'controlledPreviewUrl', 'targetEntityId', 'materialization',
  ]);
  const materialization = exact(output.materialization, ['status', 'reasonCode']);
  return {
    assetId: pattern(output.assetId, UUID),
    category: enumeration(output.category, CATEGORIES),
    displayName: text(output.displayName, 1, 200),
    rightsStatus: enumeration(output.rightsStatus, RIGHTS),
    approvalStatus: enumeration(output.approvalStatus, APPROVALS),
    providerStatus: enumeration(output.providerStatus, PROVIDERS),
    entityBindingStatus: enumeration(output.entityBindingStatus, BINDINGS),
    controlledPreviewUrl: nullable(output.controlledPreviewUrl, (entry) => pattern(entry, CONTROLLED_MEDIA)),
    targetEntityId: nullable(output.targetEntityId, (entry) => pattern(entry, UUID)),
    materialization: {
      status: enumeration(materialization.status, MATERIALIZATION_STATUSES),
      reasonCode: nullable(materialization.reasonCode, (entry) => enumeration(entry, MATERIALIZATION_REASONS)),
    },
  };
}

function nested<T>(value: unknown, objectType: string): T {
  try {
    const parsed = parseCanvasV1BrowserContract(value);
    if (parsed.objectType !== objectType) fail();
    return parsed as T;
  } catch (error) {
    if (error instanceof CanvasWorkspaceContractError) throw error;
    return fail();
  }
}

function parseShot(value: unknown): CanvasWorkspaceShotV01 {
  const output = exact(value, [
    'shotId', 'sequence', 'title', 'durationSeconds', 'scriptText', 'storyboardText', 'thumbnailUrl',
    'requirements', 'readiness', 'requiredAssetLabels', 'outputs', 'event',
  ]);
  return {
    shotId: pattern(output.shotId, UUID),
    sequence: positiveInteger(output.sequence),
    title: text(output.title, 1, 200),
    durationSeconds: positiveNumber(output.durationSeconds, 300),
    scriptText: text(output.scriptText, 1, 50_000),
    storyboardText: text(output.storyboardText, 1, 4_000),
    thumbnailUrl: nullable(output.thumbnailUrl, (entry) => pattern(entry, CONTROLLED_MEDIA)),
    requirements: list(output.requirements, (entry) => nested<ShotAssetRequirementV01>(entry, 'ShotAssetRequirement'), 1),
    readiness: nested<ShotReadinessV01>(output.readiness, 'ShotReadiness'),
    requiredAssetLabels: list(output.requiredAssetLabels, (entry) => text(entry, 1, 40), 1),
    outputs: list(output.outputs, parseOutput),
    event: nullable(output.event, (entry) => nested<CanvasEventV01>(entry, 'CanvasEvent')),
  };
}

function unique(values: readonly unknown[]): boolean { return new Set(values).size === values.length; }

function scopeMatches(value: { tenantId: string; projectId: string; packageId: string; canvasSessionId: string }, expected: CanvasWorkspaceV01): boolean {
  return value.tenantId === expected.tenantId && value.projectId === expected.projectId
    && value.packageId === expected.packageId && value.canvasSessionId === expected.canvasSessionId;
}

function expectedReasons(value: CanvasWorkspaceV01): CanvasWorkspaceReasonCode[] {
  const reasons: CanvasWorkspaceReasonCode[] = [];
  if (value.bootstrap.status === 'blocked') reasons.push('WORKSPACE_CAPABILITY_BLOCKED');
  if (value.shots.some((shot) => !shot.readiness.ready)) reasons.push('WORKSPACE_SHOT_BLOCKED');
  if (!value.completeness.assets) reasons.push('WORKSPACE_ASSET_AGGREGATE_INCOMPLETE');
  if (!value.completeness.requirements) reasons.push('WORKSPACE_REQUIREMENTS_INCOMPLETE');
  if (!value.completeness.readiness) reasons.push('WORKSPACE_READINESS_INCOMPLETE');
  if (!value.completeness.outputs) reasons.push('WORKSPACE_OUTPUTS_INCOMPLETE');
  if (!value.completeness.events) reasons.push('WORKSPACE_EVENTS_INCOMPLETE');
  if (!value.completeness.controlledMedia) reasons.push('WORKSPACE_CONTROLLED_MEDIA_INCOMPLETE');
  return reasons;
}

function assertSemantics(value: CanvasWorkspaceV01): void {
  if (!scopeMatches(value.bootstrap, value) || !scopeMatches(value.document, value)) fail('CANVAS_WORKSPACE_SCOPE_MISMATCH');
  if (value.bootstrap.document.documentId !== value.document.documentId || value.bootstrap.document.version !== value.document.version) {
    fail('CANVAS_WORKSPACE_DOCUMENT_MISMATCH');
  }
  if (value.shots.length !== value.document.shots.length || !unique(value.shots.map(({ shotId }) => shotId))) fail('CANVAS_WORKSPACE_SHOT_MISMATCH');
  const scriptText = value.shots[0]?.scriptText;
  for (const [index, shot] of value.shots.entries()) {
    const documentShot = value.document.shots[index];
    if (!documentShot || shot.shotId !== documentShot.shotId || documentShot.position !== index || shot.sequence !== index + 1
      || shot.title !== `镜头 ${String(index + 1).padStart(2, '0')}` || shot.scriptText !== scriptText) {
      fail('CANVAS_WORKSPACE_SHOT_MISMATCH');
    }
    for (const requirement of shot.requirements) {
      if (!scopeMatches(requirement, value) || requirement.shotId !== shot.shotId
        || requirement.source.scriptId !== value.bootstrap.approvedScript.scriptId
        || requirement.source.scriptVersion !== value.bootstrap.approvedScript.version
        || requirement.source.storyboardId !== value.bootstrap.approvedStoryboard.storyboardId
        || requirement.source.storyboardVersion !== value.bootstrap.approvedStoryboard.version) {
        fail('CANVAS_WORKSPACE_REQUIREMENT_MISMATCH');
      }
    }
    const labels = [...new Set(shot.requirements.map(({ assetCategory }) => CATEGORY_LABELS[assetCategory]))];
    if (JSON.stringify(labels) !== JSON.stringify(shot.requiredAssetLabels)) fail('CANVAS_WORKSPACE_REQUIREMENT_MISMATCH');
    if (!scopeMatches(shot.readiness, value) || shot.readiness.shotId !== shot.shotId
      || shot.readiness.script.scriptId !== value.bootstrap.approvedScript.scriptId
      || shot.readiness.script.version !== value.bootstrap.approvedScript.version
      || shot.readiness.storyboard.storyboardId !== value.bootstrap.approvedStoryboard.storyboardId
      || shot.readiness.storyboard.version !== value.bootstrap.approvedStoryboard.version
      || JSON.stringify(shot.readiness.requirements.map(({ requirementId }) => requirementId))
        !== JSON.stringify(shot.requirements.map(({ requirementId }) => requirementId))) {
      fail('CANVAS_WORKSPACE_READINESS_MISMATCH');
    }
    const selected = shot.outputs.filter(({ selected }) => selected);
    if (!unique(shot.outputs.map(({ assetId }) => assetId))
      || selected.length !== (documentShot.selectedOutputAssetId ? 1 : 0)
      || (selected[0]?.assetId ?? null) !== documentShot.selectedOutputAssetId
      || shot.thumbnailUrl !== (selected[0]?.previewUrl ?? null)) fail('CANVAS_WORKSPACE_OUTPUT_MISMATCH');
    if (shot.event && (!scopeMatches(shot.event, value) || shot.event.commandType !== 'GENERATE_SHOT')) {
      fail(shot.event.commandType === 'GENERATE_SHOT' ? 'CANVAS_WORKSPACE_SCOPE_MISMATCH' : 'CANVAS_WORKSPACE_EVENT_MISMATCH');
    }
  }
  if (value.assets.length !== value.bootstrap.assetSummaries.length || !unique(value.assets.map(({ assetId }) => assetId))) fail('CANVAS_WORKSPACE_ASSET_MISMATCH');
  for (const [index, asset] of value.assets.entries()) {
    const summary = value.bootstrap.assetSummaries[index];
    const keys = ['assetId', 'category', 'displayName', 'rightsStatus', 'approvalStatus', 'providerStatus', 'entityBindingStatus', 'controlledPreviewUrl'] as const;
    if (!summary || keys.some((key) => asset[key] !== summary[key])) fail('CANVAS_WORKSPACE_ASSET_MISMATCH');
    const state = asset.materialization;
    if (asset.category !== 'virtual_character') {
      if (state.status !== 'unsupported' || state.reasonCode !== 'CATEGORY_UNSUPPORTED') fail('CANVAS_WORKSPACE_ASSET_MISMATCH');
    } else if (asset.rightsStatus !== 'authorized') {
      if (state.status !== 'blocked' || state.reasonCode !== 'RIGHTS_NOT_AUTHORIZED') fail('CANVAS_WORKSPACE_ASSET_MISMATCH');
    } else if (asset.approvalStatus !== 'approved') {
      if (state.status !== 'blocked' || state.reasonCode !== 'APPROVAL_NOT_APPROVED') fail('CANVAS_WORKSPACE_ASSET_MISMATCH');
    } else if ((state.status === 'ready' && state.reasonCode !== null)
      || (state.status === 'not_started' && state.reasonCode !== 'MATERIALIZATION_REQUIRED')
      || (state.status === 'blocked' && !['SOURCE_UNAVAILABLE', 'MATERIALIZATION_CONFLICT'].includes(state.reasonCode ?? ''))
      || state.status === 'unsupported') fail('CANVAS_WORKSPACE_ASSET_MISMATCH');
  }
  const reasons = expectedReasons(value);
  if (JSON.stringify(value.reasonCodes) !== JSON.stringify(reasons) || value.status !== (reasons.length ? 'blocked' : 'ready')) {
    fail('CANVAS_WORKSPACE_STATUS_INCONSISTENT');
  }
}

export function parseCanvasWorkspaceV01(input: unknown): CanvasWorkspaceV01 {
  scan(input);
  const output = exact(input, [
    'objectType', 'contractVersion', 'tenantId', 'projectId', 'packageId', 'canvasSessionId',
    'status', 'reasonCodes', 'completeness', 'project', 'bootstrap', 'document', 'shots', 'assets',
    'saveState', 'requestId', 'occurredAt',
  ]);
  if (output.objectType !== 'CanvasWorkspace' || output.contractVersion !== '0.1' || output.saveState !== 'saved') fail();
  const completeness = exact(output.completeness, ['assets', 'requirements', 'readiness', 'outputs', 'events', 'controlledMedia']);
  const project = exact(output.project, ['projectName', 'requestedByActorId']);
  const bootstrap = nested<CanvasBootstrapV01>(output.bootstrap, 'CanvasBootstrap');
  const document = nested<CanvasDocumentV01>(output.document, 'CanvasDocument');
  const value: CanvasWorkspaceV01 = {
    objectType: 'CanvasWorkspace',
    contractVersion: '0.1',
    tenantId: pattern(output.tenantId, UUID),
    projectId: pattern(output.projectId, UUID),
    packageId: pattern(output.packageId, UUID),
    canvasSessionId: pattern(output.canvasSessionId, SESSION),
    status: enumeration(output.status, ['ready', 'blocked']),
    reasonCodes: list(output.reasonCodes, (entry) => enumeration(entry, CANVAS_WORKSPACE_REASON_CODES)),
    completeness: {
      assets: bool(completeness.assets), requirements: bool(completeness.requirements),
      readiness: bool(completeness.readiness), outputs: bool(completeness.outputs),
      events: bool(completeness.events), controlledMedia: bool(completeness.controlledMedia),
    },
    project: { projectName: text(project.projectName, 1, 200), requestedByActorId: pattern(project.requestedByActorId, UUID) },
    bootstrap,
    document,
    shots: list(output.shots, parseShot, 1),
    assets: list(output.assets, parseAsset),
    saveState: 'saved',
    requestId: pattern(output.requestId, REQUEST_ID),
    occurredAt: canonicalUtcTimestamp(output.occurredAt),
  };
  assertSemantics(value);
  return value;
}
