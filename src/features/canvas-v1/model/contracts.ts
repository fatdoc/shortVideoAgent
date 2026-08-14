const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SESSION_PATTERN = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const REQUEST_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export const CANVAS_V1_COMMAND_TYPES = [
  'ANALYZE_ASSET_REQUIREMENTS',
  'CREATE_VIRTUAL_CHARACTER',
  'SYNC_PROVIDER_ASSET',
  'BIND_ASSET_TO_ENTITY',
  'GENERATE_SHOT',
  'SELECT_SHOT_OUTPUT',
  'SAVE_CANVAS_DOCUMENT',
  'EXPORT_PLAYLIST',
] as const;

export const CANVAS_V1_REASON_CODES = [
  'SCOPE_MISMATCH',
  'REQUIRED_ASSET_MISSING',
  'RIGHTS_PENDING',
  'RIGHTS_REJECTED',
  'RIGHTS_REVOKED',
  'RIGHTS_EXPIRED',
  'ASSET_APPROVAL_PENDING',
  'ASSET_APPROVAL_REJECTED',
  'ASSET_APPROVAL_REVOKED',
  'PROVIDER_PROCESSING',
  'PROVIDER_REJECTED',
  'PROVIDER_FAILED',
  'PROVIDER_UNAVAILABLE',
  'ENTITY_BINDING_MISSING',
  'ENTITY_BINDING_PENDING',
  'ENTITY_BINDING_REJECTED',
  'ENTITY_BINDING_REVOKED',
  'CAPABILITY_UNAVAILABLE',
  'SCRIPT_NOT_CURRENT',
  'STORYBOARD_NOT_CURRENT',
] as const;

export type CanvasCommandType = (typeof CANVAS_V1_COMMAND_TYPES)[number];
export type ShotReadinessReasonCode = (typeof CANVAS_V1_REASON_CODES)[number];
export type AssetCategory = 'human' | 'virtual_character' | 'store' | 'product' | 'brand' | 'prop' | 'voice' | 'image' | 'video';
export type RightsStatus = 'pending' | 'authorized' | 'rejected' | 'revoked' | 'expired';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type ProviderStatus = 'processing' | 'active' | 'rejected' | 'failed' | 'unavailable';
export type EntityBindingStatus = 'pending' | 'approved' | 'rejected' | 'revoked';
export type Capability = 'asset_analysis' | 'image_generation' | 'provider_asset_sync' | 'video_generation' | 'playlist_export';

export type CanvasV1ContractErrorCode =
  | 'CANVAS_SCHEMA_INVALID'
  | 'CANVAS_BROWSER_PROJECTION_UNSAFE'
  | 'CANVAS_SCOPE_MISMATCH'
  | 'CANVAS_SESSION_INVALID'
  | 'CANVAS_READINESS_INCONSISTENT'
  | 'CANVAS_BINDING_INCONSISTENT'
  | 'CANVAS_APPROVAL_REQUIRED'
  | 'CANVAS_COMMAND_PAYLOAD_MISMATCH'
  | 'CANVAS_COMMAND_IDEMPOTENCY_CONFLICT'
  | 'CANVAS_DOCUMENT_VERSION_CONFLICT'
  | 'CANVAS_EVENT_FACTS_INCONSISTENT';

export class CanvasV1ContractError extends Error {
  readonly code: CanvasV1ContractErrorCode;

  constructor(code: CanvasV1ContractErrorCode) {
    super(code);
    this.name = 'CanvasV1ContractError';
    this.code = code;
  }
}

export interface CanvasV1Scope {
  tenantId: string;
  projectId: string;
  packageId: string;
  canvasSessionId: string;
}

interface Envelope extends CanvasV1Scope {
  contractVersion: '0.1';
  occurredAt: string;
}

export interface DocumentShot {
  shotId: string;
  position: number;
  selectedOutputAssetId: string | null;
  prompt: string;
  updatedAt: string;
}

export interface CanvasBootstrapV01 extends Envelope {
  objectType: 'CanvasBootstrap';
  status: 'ready' | 'blocked';
  approvedScript: { scriptId: string; version: number; status: 'approved' };
  approvedStoryboard: { storyboardId: string; version: number; status: 'approved' };
  document: { documentId: string; version: number };
  assetSummaries: Array<{
    assetId: string;
    category: AssetCategory;
    displayName: string;
    rightsStatus: RightsStatus;
    approvalStatus: ApprovalStatus;
    providerStatus: ProviderStatus;
    entityBindingStatus: EntityBindingStatus;
    controlledPreviewUrl: string | null;
  }>;
  capabilities: Array<{ capability: Capability; available: boolean; reasonCode: ShotReadinessReasonCode | null }>;
  requestId: string;
}

export interface CanvasDocumentV01 extends Envelope {
  objectType: 'CanvasDocument';
  documentId: string;
  status: 'active' | 'archived';
  version: number;
  shots: DocumentShot[];
  playlist: { shotIds: string[] };
  createdAt: string;
  updatedAt: string;
}

export interface AssetRecordV01 extends Envelope {
  objectType: 'AssetRecord';
  assetId: string;
  category: AssetCategory;
  displayName: string;
  provenance: {
    kind: 'customer_upload' | 'provider_generated' | 'licensed' | 'control_synced';
    sourceAssetId: string | null;
    declaredByActorId: string;
    declaredAt: string;
  };
  rights: {
    status: RightsStatus;
    basis: 'customer_owned' | 'licensed' | 'provider_generated' | 'external_identity_verification';
    validFrom: string | null;
    validUntil: string | null;
    reviewedAt: string | null;
  };
  approval: { status: ApprovalStatus; reviewedByActorId: string | null; reviewedAt: string | null };
  controlledPreviewUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderAssetBindingV01 extends Envelope {
  objectType: 'ProviderAssetBinding';
  bindingId: string;
  assetId: string;
  provider: 'byteplus';
  providerStatus: ProviderStatus;
  providerAssetId: string | null;
  providerGroupId: string | null;
  assetUri: string | null;
  registeredAt: string | null;
  updatedAt: string;
}

export interface EntityBindingV01 extends Envelope {
  objectType: 'EntityBinding';
  bindingId: string;
  assetId: string;
  entityId: string;
  entityType: 'human' | 'virtual_character' | 'store' | 'product' | 'brand' | 'prop' | 'voice';
  status: EntityBindingStatus;
  approvedByActorId: string | null;
  approvedAt: string | null;
  continuityRevision: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShotAssetRequirementV01 extends Envelope {
  objectType: 'ShotAssetRequirement';
  requirementId: string;
  shotId: string;
  assetCategory: AssetCategory;
  entityId: string | null;
  status: 'required' | 'satisfied' | 'waived';
  source: { scriptId: string; scriptVersion: number; storyboardId: string; storyboardVersion: number };
  requiredCapabilities: Capability[];
  createdAt: string;
  updatedAt: string;
}

export interface ReadinessRequirement {
  requirementId: string;
  assetId: string | null;
  scopeMatched: boolean;
  rightsStatus: RightsStatus;
  approvalStatus: ApprovalStatus;
  providerStatus: ProviderStatus;
  entityBindingStatus: EntityBindingStatus | null;
  capabilityAvailable: boolean;
  ready: boolean;
  reasonCodes: ShotReadinessReasonCode[];
}

export interface ShotReadinessV01 extends Envelope {
  objectType: 'ShotReadiness';
  readinessId: string;
  shotId: string;
  ready: boolean;
  reasonCodes: ShotReadinessReasonCode[];
  script: { scriptId: string; version: number; current: boolean };
  storyboard: { storyboardId: string; version: number; current: boolean };
  requirements: ReadinessRequirement[];
  evaluatedAt: string;
}

export type CanvasCommandPayload =
  | { shotId: string }
  | { assetId: string; entityId: string; prompt: string }
  | { assetId: string }
  | { assetId: string; entityId: string }
  | { shotId: string; readinessId: string; prompt: string; referenceAssetIds: string[] }
  | { shotId: string; outputAssetId: string; documentId: string; expectedVersion: number }
  | { documentId: string; expectedVersion: number; shots: DocumentShot[]; playlist: { shotIds: string[] } }
  | { documentId: string; expectedVersion: number };

export interface CanvasCommandV01 extends Envelope {
  objectType: 'CanvasCommand';
  commandId: string;
  commandType: CanvasCommandType;
  requestedByActorId: string;
  requestSource: 'user' | 'agent';
  approvalId: string | null;
  payload: CanvasCommandPayload;
  requestId: string;
}

export interface CanvasEventV01 extends Envelope {
  objectType: 'CanvasEvent';
  eventId: string;
  commandId: string;
  commandType: CanvasCommandType;
  status: 'accepted' | 'provider_submitted' | 'task_created' | 'output_registered' | 'receipt_recorded' | 'failed';
  providerSubmitted: boolean;
  taskCreated: boolean;
  outputRegistered: boolean;
  receiptRecorded: boolean;
  taskId: string | null;
  outputAssetId: string | null;
  receiptId: string | null;
  replayed: boolean;
  error: { code: string; message: string; retryable: boolean } | null;
  requestId: string;
}

export type CanvasV1Contract =
  | CanvasBootstrapV01
  | CanvasDocumentV01
  | AssetRecordV01
  | ProviderAssetBindingV01
  | EntityBindingV01
  | ShotAssetRequirementV01
  | ShotReadinessV01
  | CanvasCommandV01
  | CanvasEventV01;
export type CanvasV1BrowserContract = Exclude<CanvasV1Contract, ProviderAssetBindingV01>;

type UnknownRecord = Record<string, unknown>;

function fail(code: CanvasV1ContractErrorCode = 'CANVAS_SCHEMA_INVALID'): never {
  throw new CanvasV1ContractError(code);
}

function record(value: unknown): UnknownRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail();
  return value as UnknownRecord;
}

function exact(value: unknown, keys: readonly string[]): UnknownRecord {
  const output = record(value);
  const actual = Object.keys(output).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return fail();
  return output;
}

function text(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): string {
  if (typeof value !== 'string' || value.length < min || value.length > max) return fail();
  return value;
}

function uuid(value: unknown): string {
  const output = text(value);
  if (!UUID_PATTERN.test(output)) return fail();
  return output;
}

function timestamp(value: unknown): string {
  const output = text(value);
  if (!TIMESTAMP_PATTERN.test(output) || !Number.isFinite(Date.parse(output))) return fail();
  return output;
}

function session(value: unknown): string {
  const output = text(value);
  if (!SESSION_PATTERN.test(output)) return fail();
  return output;
}

function request(value: unknown): string {
  const output = text(value);
  if (!REQUEST_PATTERN.test(output)) return fail();
  return output;
}

function integer(value: unknown, minimum = 1): number {
  if (!Number.isSafeInteger(value) || (value as number) < minimum) return fail();
  return value as number;
}

function bool(value: unknown): boolean {
  if (typeof value !== 'boolean') return fail();
  return value;
}

function nullable<T>(value: unknown, parser: (input: unknown) => T): T | null {
  return value === null ? null : parser(value);
}

function enumeration<T extends string>(value: unknown, values: readonly T[]): T {
  if (typeof value !== 'string' || !values.includes(value as T)) return fail();
  return value as T;
}

function list<T>(value: unknown, parser: (input: unknown) => T, minimum = 0, maximum = 1000): T[] {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) return fail();
  return value.map(parser);
}

const ASSET_CATEGORIES = ['human', 'virtual_character', 'store', 'product', 'brand', 'prop', 'voice', 'image', 'video'] as const;
const RIGHTS_STATUSES = ['pending', 'authorized', 'rejected', 'revoked', 'expired'] as const;
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'revoked'] as const;
const PROVIDER_STATUSES = ['processing', 'active', 'rejected', 'failed', 'unavailable'] as const;
const ENTITY_STATUSES = ['pending', 'approved', 'rejected', 'revoked'] as const;
const CAPABILITIES = ['asset_analysis', 'image_generation', 'provider_asset_sync', 'video_generation', 'playlist_export'] as const;

const COMMON_KEYS = ['objectType', 'contractVersion', 'tenantId', 'projectId', 'packageId', 'canvasSessionId', 'occurredAt'] as const;

function common(value: UnknownRecord): void {
  if (value.contractVersion !== '0.1') fail();
  uuid(value.tenantId);
  uuid(value.projectId);
  uuid(value.packageId);
  session(value.canvasSessionId);
  timestamp(value.occurredAt);
}

function documentShot(value: unknown): DocumentShot {
  const output = exact(value, ['shotId', 'position', 'selectedOutputAssetId', 'prompt', 'updatedAt']);
  uuid(output.shotId);
  integer(output.position, 0);
  nullable(output.selectedOutputAssetId, uuid);
  text(output.prompt, 0, 4000);
  timestamp(output.updatedAt);
  return output as unknown as DocumentShot;
}

function parseBootstrap(value: unknown): CanvasBootstrapV01 {
  const output = exact(value, [...COMMON_KEYS, 'status', 'approvedScript', 'approvedStoryboard', 'document', 'assetSummaries', 'capabilities', 'requestId']);
  common(output);
  enumeration(output.status, ['ready', 'blocked']);
  const script = exact(output.approvedScript, ['scriptId', 'version', 'status']);
  uuid(script.scriptId); integer(script.version); if (script.status !== 'approved') fail();
  const storyboard = exact(output.approvedStoryboard, ['storyboardId', 'version', 'status']);
  uuid(storyboard.storyboardId); integer(storyboard.version); if (storyboard.status !== 'approved') fail();
  const document = exact(output.document, ['documentId', 'version']);
  uuid(document.documentId); integer(document.version);
  list(output.assetSummaries, (item) => {
    const asset = exact(item, ['assetId', 'category', 'displayName', 'rightsStatus', 'approvalStatus', 'providerStatus', 'entityBindingStatus', 'controlledPreviewUrl']);
    uuid(asset.assetId); enumeration(asset.category, ASSET_CATEGORIES); text(asset.displayName, 1, 200);
    enumeration(asset.rightsStatus, RIGHTS_STATUSES); enumeration(asset.approvalStatus, APPROVAL_STATUSES);
    enumeration(asset.providerStatus, PROVIDER_STATUSES); enumeration(asset.entityBindingStatus, ENTITY_STATUSES);
    controlledPreviewUrl(nullable(asset.controlledPreviewUrl, (entry) => text(entry, 1, 2048)));
    return asset;
  });
  list(output.capabilities, (item) => {
    const entry = exact(item, ['capability', 'available', 'reasonCode']);
    enumeration(entry.capability, CAPABILITIES);
    const available = bool(entry.available);
    const reason = nullable(entry.reasonCode, (candidate) => enumeration(candidate, CANVAS_V1_REASON_CODES));
    if (available !== (reason === null)) fail();
    return entry;
  }, 1);
  request(output.requestId);
  return output as unknown as CanvasBootstrapV01;
}

function parseDocument(value: unknown): CanvasDocumentV01 {
  const output = exact(value, [...COMMON_KEYS, 'documentId', 'status', 'version', 'shots', 'playlist', 'createdAt', 'updatedAt']);
  common(output); uuid(output.documentId); enumeration(output.status, ['active', 'archived']); integer(output.version);
  const shots = list(output.shots, documentShot);
  const playlistValue = exact(output.playlist, ['shotIds']);
  const playlistIds = list(playlistValue.shotIds, uuid);
  timestamp(output.createdAt); timestamp(output.updatedAt); chronology(output.createdAt as string, output.updatedAt as string);
  if (!unique(shots.map((shot) => shot.shotId)) || !unique(shots.map((shot) => shot.position)) || !unique(playlistIds)) fail();
  if (playlistIds.some((shotId) => !shots.some((shot) => shot.shotId === shotId))) fail();
  return output as unknown as CanvasDocumentV01;
}

function parseAssetRecord(value: unknown): AssetRecordV01 {
  const output = exact(value, [...COMMON_KEYS, 'assetId', 'category', 'displayName', 'provenance', 'rights', 'approval', 'controlledPreviewUrl', 'createdAt', 'updatedAt']);
  common(output); uuid(output.assetId); enumeration(output.category, ASSET_CATEGORIES); text(output.displayName, 1, 200);
  const provenance = exact(output.provenance, ['kind', 'sourceAssetId', 'declaredByActorId', 'declaredAt']);
  enumeration(provenance.kind, ['customer_upload', 'provider_generated', 'licensed', 'control_synced']);
  nullable(provenance.sourceAssetId, uuid); uuid(provenance.declaredByActorId); timestamp(provenance.declaredAt);
  const rights = exact(output.rights, ['status', 'basis', 'validFrom', 'validUntil', 'reviewedAt']);
  const rightsValue = enumeration(rights.status, RIGHTS_STATUSES);
  enumeration(rights.basis, ['customer_owned', 'licensed', 'provider_generated', 'external_identity_verification']);
  const validFrom = nullable(rights.validFrom, timestamp); const validUntil = nullable(rights.validUntil, timestamp);
  const rightsReviewedAt = nullable(rights.reviewedAt, timestamp);
  if (validFrom && validUntil) chronology(validFrom, validUntil);
  if (rightsValue === 'authorized' && !rightsReviewedAt) fail();
  const approval = exact(output.approval, ['status', 'reviewedByActorId', 'reviewedAt']);
  const approvalValue = enumeration(approval.status, APPROVAL_STATUSES);
  const reviewer = nullable(approval.reviewedByActorId, uuid); const approvalReviewedAt = nullable(approval.reviewedAt, timestamp);
  if (approvalValue === 'approved' && (!reviewer || !approvalReviewedAt)) fail();
  controlledPreviewUrl(nullable(output.controlledPreviewUrl, (entry) => text(entry, 1, 2048)));
  timestamp(output.createdAt); timestamp(output.updatedAt); chronology(output.createdAt as string, output.updatedAt as string);
  return output as unknown as AssetRecordV01;
}

function parseProviderBinding(value: unknown): ProviderAssetBindingV01 {
  const output = exact(value, [...COMMON_KEYS, 'bindingId', 'assetId', 'provider', 'providerStatus', 'providerAssetId', 'providerGroupId', 'assetUri', 'registeredAt', 'updatedAt']);
  common(output); uuid(output.bindingId); uuid(output.assetId); if (output.provider !== 'byteplus') fail();
  const status = enumeration(output.providerStatus, PROVIDER_STATUSES);
  const assetId = nullable(output.providerAssetId, (entry) => text(entry, 1, 256));
  const groupId = nullable(output.providerGroupId, (entry) => text(entry, 1, 256));
  const assetUri = nullable(output.assetUri, (entry) => {
    const uri = text(entry, 1, 1024); if (!/^asset:\/\/[A-Za-z0-9._:/-]+$/.test(uri)) fail(); return uri;
  });
  const registeredAt = nullable(output.registeredAt, timestamp); timestamp(output.updatedAt);
  if (status === 'active' && (!assetId || !groupId || !assetUri || !registeredAt)) fail();
  return output as unknown as ProviderAssetBindingV01;
}

function parseEntityBinding(value: unknown): EntityBindingV01 {
  const output = exact(value, [...COMMON_KEYS, 'bindingId', 'assetId', 'entityId', 'entityType', 'status', 'approvedByActorId', 'approvedAt', 'continuityRevision', 'createdAt', 'updatedAt']);
  common(output); uuid(output.bindingId); uuid(output.assetId); uuid(output.entityId);
  enumeration(output.entityType, ['human', 'virtual_character', 'store', 'product', 'brand', 'prop', 'voice']);
  const status = enumeration(output.status, ENTITY_STATUSES);
  const approvedBy = nullable(output.approvedByActorId, uuid); const approvedAt = nullable(output.approvedAt, timestamp);
  const revision = nullable(output.continuityRevision, integer);
  if ((status === 'approved') !== Boolean(approvedBy && approvedAt && revision)) fail('CANVAS_BINDING_INCONSISTENT');
  timestamp(output.createdAt); timestamp(output.updatedAt); chronology(output.createdAt as string, output.updatedAt as string);
  return output as unknown as EntityBindingV01;
}

function parseRequirement(value: unknown): ShotAssetRequirementV01 {
  const output = exact(value, [...COMMON_KEYS, 'requirementId', 'shotId', 'assetCategory', 'entityId', 'status', 'source', 'requiredCapabilities', 'createdAt', 'updatedAt']);
  common(output); uuid(output.requirementId); uuid(output.shotId); enumeration(output.assetCategory, ASSET_CATEGORIES);
  nullable(output.entityId, uuid); enumeration(output.status, ['required', 'satisfied', 'waived']);
  const source = exact(output.source, ['scriptId', 'scriptVersion', 'storyboardId', 'storyboardVersion']);
  uuid(source.scriptId); integer(source.scriptVersion); uuid(source.storyboardId); integer(source.storyboardVersion);
  const capabilities = list(output.requiredCapabilities, (entry) => enumeration(entry, CAPABILITIES), 1);
  if (!unique(capabilities)) fail();
  timestamp(output.createdAt); timestamp(output.updatedAt); chronology(output.createdAt as string, output.updatedAt as string);
  return output as unknown as ShotAssetRequirementV01;
}

function parseReadiness(value: unknown): ShotReadinessV01 {
  const output = exact(value, [...COMMON_KEYS, 'readinessId', 'shotId', 'ready', 'reasonCodes', 'script', 'storyboard', 'requirements', 'evaluatedAt']);
  common(output); uuid(output.readinessId); uuid(output.shotId); const ready = bool(output.ready);
  const reasonCodes = list(output.reasonCodes, (entry) => enumeration(entry, CANVAS_V1_REASON_CODES));
  const script = exact(output.script, ['scriptId', 'version', 'current']); uuid(script.scriptId); integer(script.version); bool(script.current);
  const storyboard = exact(output.storyboard, ['storyboardId', 'version', 'current']); uuid(storyboard.storyboardId); integer(storyboard.version); bool(storyboard.current);
  const aggregate: ShotReadinessReasonCode[] = [];
  list(output.requirements, (item) => {
    const entry = exact(item, ['requirementId', 'assetId', 'scopeMatched', 'rightsStatus', 'approvalStatus', 'providerStatus', 'entityBindingStatus', 'capabilityAvailable', 'ready', 'reasonCodes']);
    uuid(entry.requirementId); const assetId = nullable(entry.assetId, uuid); const scopeMatched = bool(entry.scopeMatched);
    const rights = enumeration(entry.rightsStatus, RIGHTS_STATUSES); const approval = enumeration(entry.approvalStatus, APPROVAL_STATUSES);
    const provider = enumeration(entry.providerStatus, PROVIDER_STATUSES); const binding = nullable(entry.entityBindingStatus, (candidate) => enumeration(candidate, ENTITY_STATUSES));
    const capabilityAvailable = bool(entry.capabilityAvailable); const itemReady = bool(entry.ready);
    const itemReasons = list(entry.reasonCodes, (candidate) => enumeration(candidate, CANVAS_V1_REASON_CODES));
    const expected = readinessReasons({ assetId, scopeMatched, rightsStatus: rights, approvalStatus: approval, providerStatus: provider, entityBindingStatus: binding, capabilityAvailable });
    if (itemReady !== (expected.length === 0) || JSON.stringify(itemReasons) !== JSON.stringify(expected)) fail('CANVAS_READINESS_INCONSISTENT');
    aggregate.push(...expected); return entry;
  }, 1);
  if (script.current === false) aggregate.push('SCRIPT_NOT_CURRENT');
  if (storyboard.current === false) aggregate.push('STORYBOARD_NOT_CURRENT');
  const expected = CANVAS_V1_REASON_CODES.filter((code) => aggregate.includes(code));
  if (ready !== (expected.length === 0) || JSON.stringify(reasonCodes) !== JSON.stringify(expected)) fail('CANVAS_READINESS_INCONSISTENT');
  timestamp(output.evaluatedAt);
  return output as unknown as ShotReadinessV01;
}

const PAYLOAD_KEYS: Record<CanvasCommandType, readonly string[]> = {
  ANALYZE_ASSET_REQUIREMENTS: ['shotId'],
  CREATE_VIRTUAL_CHARACTER: ['assetId', 'entityId', 'prompt'],
  SYNC_PROVIDER_ASSET: ['assetId'],
  BIND_ASSET_TO_ENTITY: ['assetId', 'entityId'],
  GENERATE_SHOT: ['shotId', 'readinessId', 'prompt', 'referenceAssetIds'],
  SELECT_SHOT_OUTPUT: ['shotId', 'outputAssetId', 'documentId', 'expectedVersion'],
  SAVE_CANVAS_DOCUMENT: ['documentId', 'expectedVersion', 'shots', 'playlist'],
  EXPORT_PLAYLIST: ['documentId', 'expectedVersion'],
};

function parseCommand(value: unknown): CanvasCommandV01 {
  const output = exact(value, [...COMMON_KEYS, 'commandId', 'commandType', 'requestedByActorId', 'requestSource', 'approvalId', 'payload', 'requestId']);
  common(output); uuid(output.commandId); const type = enumeration(output.commandType, CANVAS_V1_COMMAND_TYPES);
  uuid(output.requestedByActorId); enumeration(output.requestSource, ['user', 'agent']); const approvalId = nullable(output.approvalId, uuid); request(output.requestId);
  let payload: UnknownRecord;
  try { payload = exact(output.payload, PAYLOAD_KEYS[type]); } catch { return fail('CANVAS_COMMAND_PAYLOAD_MISMATCH'); }
  if ('shotId' in payload) uuid(payload.shotId);
  if ('assetId' in payload) uuid(payload.assetId);
  if ('entityId' in payload) uuid(payload.entityId);
  if ('readinessId' in payload) uuid(payload.readinessId);
  if ('outputAssetId' in payload) uuid(payload.outputAssetId);
  if ('documentId' in payload) uuid(payload.documentId);
  if ('expectedVersion' in payload) integer(payload.expectedVersion);
  if ('prompt' in payload) text(payload.prompt, 1, 4000);
  if ('referenceAssetIds' in payload) {
    const references = list(payload.referenceAssetIds, uuid, 1, 50); if (!unique(references)) fail();
  }
  if ('shots' in payload) list(payload.shots, documentShot);
  if ('playlist' in payload) { const value = exact(payload.playlist, ['shotIds']); const ids = list(value.shotIds, uuid); if (!unique(ids)) fail(); }
  if (['CREATE_VIRTUAL_CHARACTER', 'BIND_ASSET_TO_ENTITY', 'GENERATE_SHOT', 'SELECT_SHOT_OUTPUT', 'EXPORT_PLAYLIST'].includes(type) && !approvalId) {
    fail('CANVAS_APPROVAL_REQUIRED');
  }
  return output as unknown as CanvasCommandV01;
}

const EVENT_ERROR_CODES = [
  'CANVAS_SCHEMA_INVALID', 'CANVAS_SCOPE_MISMATCH', 'CANVAS_SESSION_INVALID', 'CANVAS_RIGHTS_NOT_AUTHORIZED',
  'CANVAS_ASSET_NOT_APPROVED', 'CANVAS_PROVIDER_NOT_ACTIVE', 'CANVAS_ENTITY_BINDING_NOT_APPROVED',
  'CANVAS_SHOT_NOT_READY', 'CANVAS_CAPABILITY_UNAVAILABLE', 'CANVAS_APPROVAL_REQUIRED', 'CANVAS_APPROVAL_INVALID',
  'CANVAS_COMMAND_IDEMPOTENCY_CONFLICT', 'CANVAS_DOCUMENT_VERSION_CONFLICT', 'CANVAS_PROVIDER_FAILED',
  'CANVAS_OUTPUT_REGISTRATION_FAILED',
] as const;

function parseEvent(value: unknown): CanvasEventV01 {
  const output = exact(value, [...COMMON_KEYS, 'eventId', 'commandId', 'commandType', 'status', 'providerSubmitted', 'taskCreated', 'outputRegistered', 'receiptRecorded', 'taskId', 'outputAssetId', 'receiptId', 'replayed', 'error', 'requestId']);
  common(output); uuid(output.eventId); uuid(output.commandId); enumeration(output.commandType, CANVAS_V1_COMMAND_TYPES);
  const status = enumeration(output.status, ['accepted', 'provider_submitted', 'task_created', 'output_registered', 'receipt_recorded', 'failed']);
  const facts = [bool(output.providerSubmitted), bool(output.taskCreated), bool(output.outputRegistered), bool(output.receiptRecorded)];
  const taskId = nullable(output.taskId, uuid); const outputAssetId = nullable(output.outputAssetId, uuid); const receiptId = nullable(output.receiptId, uuid);
  bool(output.replayed); request(output.requestId);
  let errorValue: UnknownRecord | null = null;
  if (output.error !== null) {
    errorValue = exact(output.error, ['code', 'message', 'retryable']);
    enumeration(errorValue.code, EVENT_ERROR_CODES); text(errorValue.message, 1, 160); bool(errorValue.retryable);
    assertSafeErrorMessage(errorValue.message as string);
  }
  const expected: Record<Exclude<CanvasEventV01['status'], 'failed'>, boolean[]> = {
    accepted: [false, false, false, false], provider_submitted: [true, false, false, false],
    task_created: [true, true, false, false], output_registered: [true, true, true, false], receipt_recorded: [true, true, true, true],
  };
  if (status === 'failed') {
    if (!errorValue || (facts[3] && !facts[2]) || (facts[2] && !facts[1]) || (facts[1] && !facts[0])) fail('CANVAS_EVENT_FACTS_INCONSISTENT');
  } else if (JSON.stringify(facts) !== JSON.stringify(expected[status]) || errorValue) fail('CANVAS_EVENT_FACTS_INCONSISTENT');
  if (facts[1] !== Boolean(taskId) || facts[2] !== Boolean(outputAssetId) || facts[3] !== Boolean(receiptId)) fail('CANVAS_EVENT_FACTS_INCONSISTENT');
  return output as unknown as CanvasEventV01;
}

function controlledPreviewUrl(value: string | null): void {
  if (value === null || /^\/api\/canvas-v1\/[A-Za-z0-9_./-]+$/.test(value) || /^https:\/\/[A-Za-z0-9.-]+\/[A-Za-z0-9_./%-]+$/.test(value)) return;
  fail();
}

function chronology(first: string, second: string): void {
  if (Date.parse(first) > Date.parse(second)) fail();
}

function unique(values: readonly unknown[]): boolean {
  return new Set(values).size === values.length;
}

function readinessReasons(value: Pick<ReadinessRequirement, 'assetId' | 'scopeMatched' | 'rightsStatus' | 'approvalStatus' | 'providerStatus' | 'entityBindingStatus' | 'capabilityAvailable'>) {
  const reasons: ShotReadinessReasonCode[] = [];
  if (!value.scopeMatched) reasons.push('SCOPE_MISMATCH');
  if (value.assetId === null) reasons.push('REQUIRED_ASSET_MISSING');
  if (value.rightsStatus !== 'authorized') reasons.push(`RIGHTS_${value.rightsStatus.toUpperCase()}` as ShotReadinessReasonCode);
  if (value.approvalStatus !== 'approved') reasons.push(`ASSET_APPROVAL_${value.approvalStatus.toUpperCase()}` as ShotReadinessReasonCode);
  if (value.providerStatus !== 'active') reasons.push(`PROVIDER_${value.providerStatus.toUpperCase()}` as ShotReadinessReasonCode);
  if (value.entityBindingStatus === null) reasons.push('ENTITY_BINDING_MISSING');
  else if (value.entityBindingStatus !== 'approved') reasons.push(`ENTITY_BINDING_${value.entityBindingStatus.toUpperCase()}` as ShotReadinessReasonCode);
  if (!value.capabilityAvailable) reasons.push('CAPABILITY_UNAVAILABLE');
  return CANVAS_V1_REASON_CODES.filter((code) => reasons.includes(code));
}

function assertSafeErrorMessage(message: string): void {
  if (/(?:bearer\s+|asset:\/\/|access[_-]?token|api[_-]?key|password|x-amz-|x-tos-|provider raw)/iu.test(message)) fail();
}

const BROWSER_OBJECT_TYPES = new Set(['CanvasBootstrap', 'CanvasDocument', 'AssetRecord', 'EntityBinding', 'ShotAssetRequirement', 'ShotReadiness', 'CanvasCommand', 'CanvasEvent']);
const FORBIDDEN_KEYS = new Set([
  'remoteassetid', 'asseturi', 'groupid', 'providerassetid', 'providergroupid', 'providertaskid', 'accesstoken',
  'authorization', 'cookie', 'grant', 'projectgrant', 'productionpackage', 'packagesnapshot', 'payloaddigest',
  'approvedscriptdigest', 'approvedstoryboarddigest', 'idempotencykey', 'internaltoken', 'credential', 'secret',
  'password', 'localpath', 'databaseid', 'providerrawbody', 'providerrawmessage', 'userconfirmed',
]);
const FORBIDDEN_VALUES = ['asset://', 'bearer ', 'x-amz-credential=', 'x-amz-signature=', 'x-tos-signature=', 'access_token='];

function assertBrowserSafe(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(assertBrowserSafe); return; }
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail('CANVAS_BROWSER_PROJECTION_UNSAFE');
    if (typeof child === 'string' && FORBIDDEN_VALUES.some((pattern) => child.toLowerCase().includes(pattern))) fail('CANVAS_BROWSER_PROJECTION_UNSAFE');
    assertBrowserSafe(child);
  }
}

export function parseCanvasV1Contract(input: unknown): CanvasV1Contract {
  const discriminator = record(input).objectType;
  switch (discriminator) {
    case 'CanvasBootstrap': return parseBootstrap(input);
    case 'CanvasDocument': return parseDocument(input);
    case 'AssetRecord': return parseAssetRecord(input);
    case 'ProviderAssetBinding': return parseProviderBinding(input);
    case 'EntityBinding': return parseEntityBinding(input);
    case 'ShotAssetRequirement': return parseRequirement(input);
    case 'ShotReadiness': return parseReadiness(input);
    case 'CanvasCommand': return parseCommand(input);
    case 'CanvasEvent': return parseEvent(input);
    default: return fail();
  }
}

export function parseCanvasV1BrowserContract(input: unknown): CanvasV1BrowserContract {
  assertBrowserSafe(input);
  const parsed = parseCanvasV1Contract(input);
  if (!BROWSER_OBJECT_TYPES.has(parsed.objectType)) fail('CANVAS_BROWSER_PROJECTION_UNSAFE');
  return parsed as CanvasV1BrowserContract;
}

export function assertCanvasScope(value: CanvasV1Contract, expected: CanvasV1Scope): void {
  if (value.tenantId !== expected.tenantId || value.projectId !== expected.projectId || value.packageId !== expected.packageId || value.canvasSessionId !== expected.canvasSessionId) {
    fail('CANVAS_SCOPE_MISMATCH');
  }
}

export function assertCanvasDocumentVersion(value: CanvasV1Contract, expectedVersion: number): void {
  if (value.objectType !== 'CanvasDocument' || value.version !== expectedVersion) fail('CANVAS_DOCUMENT_VERSION_CONFLICT');
}

export function assertCanvasSessionActive(active: boolean): void {
  if (!active) fail('CANVAS_SESSION_INVALID');
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  return `{${Object.keys(value as UnknownRecord).sort().map((key) => `${JSON.stringify(key)}:${canonicalize((value as UnknownRecord)[key])}`).join(',')}}`;
}

export function decideCanvasCommandReplay(existing: CanvasV1Contract, incoming: CanvasV1Contract) {
  if (existing.objectType !== 'CanvasCommand' || incoming.objectType !== 'CanvasCommand') fail();
  const keys = ['tenantId', 'projectId', 'packageId', 'canvasSessionId', 'commandType'] as const;
  if (keys.some((key) => existing[key] !== incoming[key])) return { outcome: 'new', replayed: false } as const;
  const semantic = (value: CanvasCommandV01) => ({ requestedByActorId: value.requestedByActorId, requestSource: value.requestSource, approvalId: value.approvalId, payload: value.payload });
  if (canonicalize(semantic(existing)) !== canonicalize(semantic(incoming))) fail('CANVAS_COMMAND_IDEMPOTENCY_CONFLICT');
  return { outcome: 'replay', replayed: true } as const;
}

export function restoreCanvasDocumentForSession(value: CanvasV1Contract, newCanvasSessionId: string): CanvasDocumentV01 {
  if (value.objectType !== 'CanvasDocument' || !SESSION_PATTERN.test(newCanvasSessionId)) fail('CANVAS_SESSION_INVALID');
  return { ...value, canvasSessionId: newCanvasSessionId };
}
