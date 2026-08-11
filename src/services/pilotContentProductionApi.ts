import { pilotRuntime, type PilotRuntime } from '../config/pilotRuntime';
import {
  PilotApiError,
  createPilotApiTransport,
  type PilotApiFetch,
  type PilotApiTransport,
} from './pilotApiTransport';

export type PilotContentStatus = 'draft' | 'approved' | 'revoked' | 'superseded';
export type PilotApprovalStatus = 'approved' | 'revoked' | 'blocked';
export type PilotFactRiskStatus = 'cleared' | 'unresolved';
export type PilotStoryboardSourceMode = 'uploaded' | 'generated' | 'mixed';
export type PilotProductionCapability =
  'image.generate' | 'video.generate' | 'audio.tts' | 'media.export';

export interface PilotRequestOptions {
  signal?: AbortSignal;
  maxAttempts?: number;
}

export interface PilotMutationResult<T> {
  value: T;
  replayed: boolean;
}

export interface PilotScriptVersion {
  id: string;
  projectId: string;
  version: number;
  status: PilotContentStatus;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
}

export interface PilotScriptApproval {
  id: string;
  projectId: string;
  scriptVersionId: string;
  status: PilotApprovalStatus;
  factRiskStatus: PilotFactRiskStatus;
  reason: string | null;
  actedBy: string;
  actedAt: string;
}

export interface PilotStoryboardShot {
  shotId: string;
  sequence: number;
  durationSeconds: number;
  description: string;
  sourceMode: PilotStoryboardSourceMode;
}

export interface PilotStoryboardSourceReceipt {
  providerId: string;
  sourceSystem: string;
  sourceContractVersion: string;
  commandId: string;
  receiptId: string;
  receiptDigest: string;
  receivedAt: string;
}

export interface PilotStoryboardGenerationPolicy {
  policyId: string;
  policyVersion: string;
}

export interface PilotStoryboardValidationSummary {
  status: 'passed' | 'warnings';
  issueCodes: string[];
}

export interface PilotStoryboardDraftRevision {
  objectType: 'StoryboardDraftRevision';
  contractVersion: '0.2';
  status: 'draft';
  tenantId: string;
  projectId: string;
  approvedScriptVersionId: string;
  approvedScriptDigest: string;
  draftRevisionId: string;
  revisionNumber: number;
  previousRevisionId: string | null;
  shots: PilotStoryboardShot[];
  sourceReceipt: PilotStoryboardSourceReceipt;
  generationPolicy: PilotStoryboardGenerationPolicy;
  validationSummary: PilotStoryboardValidationSummary;
  createdAt: string;
  payloadDigest: string;
}

export interface PilotStoryboardDraftProvenance {
  draftRevisionId: string;
  draftRevisionNumber: number;
  previousDraftRevisionId: string | null;
  sourceCommandId: string;
  sourceReceiptId: string;
  generationPolicyVersion: string;
  validationSummary: string;
}

export interface PilotStoryboardVersion {
  id: string;
  projectId: string;
  scriptVersionId: string;
  version: number;
  status: PilotContentStatus;
  shots: PilotStoryboardShot[];
  draftProvenance: PilotStoryboardDraftProvenance;
  createdBy: string;
  createdAt: string;
}

export interface PilotStoryboardApproval {
  id: string;
  projectId: string;
  storyboardVersionId: string;
  status: PilotApprovalStatus;
  factRiskStatus: PilotFactRiskStatus;
  reason: string | null;
  actedBy: string;
  actedAt: string;
}

export type PilotProductionEligibilityReason =
  | 'ELIGIBLE'
  | 'NO_SCRIPT_VERSION'
  | 'SCRIPT_NOT_APPROVED'
  | 'SCRIPT_APPROVAL_REVOKED'
  | 'SCRIPT_BLOCKED'
  | 'SCRIPT_FACT_RISK_UNRESOLVED'
  | 'NO_STORYBOARD_VERSION'
  | 'STORYBOARD_NOT_APPROVED'
  | 'STORYBOARD_APPROVAL_REVOKED'
  | 'STORYBOARD_BLOCKED'
  | 'STORYBOARD_FACT_RISK_UNRESOLVED'
  | 'SCRIPT_STORYBOARD_BINDING_MISMATCH';

export interface PilotProductionEligibility {
  projectId: string;
  eligible: boolean;
  scriptVersionId: string | null;
  scriptVersion: number | null;
  storyboardVersionId: string | null;
  storyboardVersion: number | null;
  reasonCode: PilotProductionEligibilityReason;
  scriptApproval: PilotScriptApproval | null;
  storyboardApproval: PilotStoryboardApproval | null;
}

export interface PilotProductionPackage {
  objectType: 'ProjectProductionPackage';
  contractVersion: '0.3';
  projectId: string;
  packageId: string;
  packageVersion: number;
  scriptVersionId: string;
  storyboardVersionId: string;
  capabilityRequirements: PilotProductionCapability[];
  status: 'ready';
  createdAt: string;
  expiresAt: string;
}

export interface PilotCanvasEntry {
  objectType: 'CanvasEntry';
  contractVersion: '0.2';
  handle: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  state: 'active';
  issuedAt: string;
  expiresAt: string;
}

export interface PilotCreateScriptVersionInput {
  payload: Record<string, unknown>;
}

export interface PilotCreateApprovalInput {
  status: PilotApprovalStatus;
  factRiskStatus: PilotFactRiskStatus;
  reason?: string;
}

export interface PilotCreateStoryboardVersionInput {
  draftRevision: PilotStoryboardDraftRevision;
}

export interface PilotCreateProductionPackageInput {
  scriptVersionId: string;
  storyboardVersionId: string;
  capabilityRequirements: PilotProductionCapability[];
  expiresInSeconds: number;
}

export interface PilotCreateCanvasEntryInput {
  packageId: string;
  ttlSeconds: number;
}

export interface PilotContentProductionApi {
  listScriptVersions(
    projectId: string,
    options?: PilotRequestOptions,
  ): Promise<PilotScriptVersion[]>;
  createScriptVersion(
    projectId: string,
    input: PilotCreateScriptVersionInput,
    idempotencyKey: string,
    options?: PilotRequestOptions,
  ): Promise<PilotMutationResult<PilotScriptVersion>>;
  createScriptApproval(
    projectId: string,
    scriptVersionId: string,
    input: PilotCreateApprovalInput,
    idempotencyKey: string,
    options?: PilotRequestOptions,
  ): Promise<PilotMutationResult<PilotScriptApproval>>;
  listStoryboardVersions(
    projectId: string,
    options?: PilotRequestOptions,
  ): Promise<PilotStoryboardVersion[]>;
  createStoryboardVersion(
    projectId: string,
    input: PilotCreateStoryboardVersionInput,
    idempotencyKey: string,
    options?: PilotRequestOptions,
  ): Promise<PilotMutationResult<PilotStoryboardVersion>>;
  createStoryboardApproval(
    projectId: string,
    storyboardVersionId: string,
    input: PilotCreateApprovalInput,
    idempotencyKey: string,
    options?: PilotRequestOptions,
  ): Promise<PilotMutationResult<PilotStoryboardApproval>>;
  readProductionEligibility(
    projectId: string,
    options?: PilotRequestOptions,
  ): Promise<PilotProductionEligibility>;
  createProductionPackage(
    projectId: string,
    input: PilotCreateProductionPackageInput,
    idempotencyKey: string,
    options?: PilotRequestOptions,
  ): Promise<PilotMutationResult<PilotProductionPackage>>;
  readProductionPackage(
    projectId: string,
    packageId: string,
    options?: PilotRequestOptions,
  ): Promise<PilotProductionPackage>;
  createCanvasEntry(
    projectId: string,
    input: PilotCreateCanvasEntryInput,
    idempotencyKey: string,
    options?: PilotRequestOptions,
  ): Promise<PilotMutationResult<PilotCanvasEntry>>;
  readCanvasEntry(
    projectId: string,
    handle: string,
    options?: PilotRequestOptions,
  ): Promise<PilotCanvasEntry>;
}

export interface PilotContentProductionApiOptions {
  runtime?: PilotRuntime;
  fetchImpl?: PilotApiFetch;
  transport?: PilotApiTransport;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;
const SAFE_REFERENCE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const CONTENT_STATUSES = new Set<PilotContentStatus>([
  'draft',
  'approved',
  'revoked',
  'superseded',
]);
const APPROVAL_STATUSES = new Set<PilotApprovalStatus>(['approved', 'revoked', 'blocked']);
const FACT_RISK_STATUSES = new Set<PilotFactRiskStatus>(['cleared', 'unresolved']);
const SOURCE_MODES = new Set<PilotStoryboardSourceMode>(['uploaded', 'generated', 'mixed']);
const CAPABILITIES = new Set<PilotProductionCapability>([
  'image.generate',
  'video.generate',
  'audio.tts',
  'media.export',
]);
const ELIGIBILITY_REASONS = new Set<PilotProductionEligibilityReason>([
  'ELIGIBLE',
  'NO_SCRIPT_VERSION',
  'SCRIPT_NOT_APPROVED',
  'SCRIPT_APPROVAL_REVOKED',
  'SCRIPT_BLOCKED',
  'SCRIPT_FACT_RISK_UNRESOLVED',
  'NO_STORYBOARD_VERSION',
  'STORYBOARD_NOT_APPROVED',
  'STORYBOARD_APPROVAL_REVOKED',
  'STORYBOARD_BLOCKED',
  'STORYBOARD_FACT_RISK_UNRESOLVED',
  'SCRIPT_STORYBOARD_BINDING_MISMATCH',
]);
const SENSITIVE_CANVAS_KEY_PARTS = [
  'accesstoken',
  'token',
  'authorization',
  'cookie',
  'secret',
  'password',
  'digest',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && actual.every((key) => keys.includes(key));
}

function requiredString(value: unknown, maxLength = 20_000): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength;
}

function uuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function timestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function digest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST_PATTERN.test(value);
}

function safeReference(value: unknown): value is string {
  return typeof value === 'string' && SAFE_REFERENCE_PATTERN.test(value);
}

function invalidClientInput(): PilotApiError {
  return new PilotApiError(
    'INVALID_PILOT_REQUEST',
    '内容生产请求不符合严格客户端合同。',
    null,
    null,
  );
}

function assertProjectId(value: string): void {
  if (!uuid(value)) throw invalidClientInput();
}

function parsePayload(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('invalid payload');
  return value;
}

function parseScriptVersion(value: unknown): PilotScriptVersion {
  const keys = [
    'id',
    'projectId',
    'version',
    'status',
    'payload',
    'createdBy',
    'createdAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !uuid(value.id) ||
    !uuid(value.projectId) ||
    !positiveInteger(value.version) ||
    typeof value.status !== 'string' ||
    !CONTENT_STATUSES.has(value.status as PilotContentStatus) ||
    !uuid(value.createdBy) ||
    !timestamp(value.createdAt)
  ) {
    throw new Error('invalid script version');
  }
  return {
    id: value.id,
    projectId: value.projectId,
    version: value.version,
    status: value.status as PilotContentStatus,
    payload: parsePayload(value.payload),
    createdBy: value.createdBy,
    createdAt: value.createdAt,
  };
}

function parseScriptApproval(value: unknown): PilotScriptApproval {
  const keys = [
    'id',
    'projectId',
    'scriptVersionId',
    'status',
    'factRiskStatus',
    'reason',
    'actedBy',
    'actedAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !uuid(value.id) ||
    !uuid(value.projectId) ||
    !uuid(value.scriptVersionId) ||
    typeof value.status !== 'string' ||
    !APPROVAL_STATUSES.has(value.status as PilotApprovalStatus) ||
    typeof value.factRiskStatus !== 'string' ||
    !FACT_RISK_STATUSES.has(value.factRiskStatus as PilotFactRiskStatus) ||
    !(value.reason === null || requiredString(value.reason, 2_000)) ||
    !uuid(value.actedBy) ||
    !timestamp(value.actedAt)
  ) {
    throw new Error('invalid script approval');
  }
  return {
    id: value.id,
    projectId: value.projectId,
    scriptVersionId: value.scriptVersionId,
    status: value.status as PilotApprovalStatus,
    factRiskStatus: value.factRiskStatus as PilotFactRiskStatus,
    reason: value.reason,
    actedBy: value.actedBy,
    actedAt: value.actedAt,
  };
}

function parseShot(value: unknown): PilotStoryboardShot {
  const keys = ['shotId', 'sequence', 'durationSeconds', 'description', 'sourceMode'] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !uuid(value.shotId) ||
    !positiveInteger(value.sequence) ||
    value.sequence > 10_000 ||
    typeof value.durationSeconds !== 'number' ||
    !Number.isFinite(value.durationSeconds) ||
    value.durationSeconds <= 0 ||
    value.durationSeconds > 3_600 ||
    Math.abs(Math.round(value.durationSeconds * 1_000) - value.durationSeconds * 1_000) > 1e-9 ||
    !requiredString(value.description, 4_000) ||
    value.description.trim() !== value.description ||
    typeof value.sourceMode !== 'string' ||
    !SOURCE_MODES.has(value.sourceMode as PilotStoryboardSourceMode)
  ) {
    throw new Error('invalid storyboard shot');
  }
  return {
    shotId: value.shotId,
    sequence: value.sequence,
    durationSeconds: value.durationSeconds,
    description: value.description,
    sourceMode: value.sourceMode as PilotStoryboardSourceMode,
  };
}

function parseShots(value: unknown): PilotStoryboardShot[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 500) {
    throw new Error('invalid storyboard shots');
  }
  const shots = value.map(parseShot);
  if (
    new Set(shots.map((shot) => shot.shotId)).size !== shots.length ||
    shots.some((shot, index) => shot.sequence !== index + 1)
  ) {
    throw new Error('invalid storyboard shot order');
  }
  return shots;
}

function parseStoryboardSourceReceipt(value: unknown): PilotStoryboardSourceReceipt {
  const keys = [
    'providerId',
    'sourceSystem',
    'sourceContractVersion',
    'commandId',
    'receiptId',
    'receiptDigest',
    'receivedAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    typeof value.providerId !== 'string' ||
    value.providerId.length > 80 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value.providerId) ||
    typeof value.sourceSystem !== 'string' ||
    value.sourceSystem.length > 80 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value.sourceSystem) ||
    typeof value.sourceContractVersion !== 'string' ||
    value.sourceContractVersion.length > 32 ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value.sourceContractVersion) ||
    !uuid(value.commandId) ||
    !uuid(value.receiptId) ||
    !digest(value.receiptDigest) ||
    !timestamp(value.receivedAt)
  ) {
    throw new Error('invalid storyboard source receipt');
  }
  return {
    providerId: value.providerId,
    sourceSystem: value.sourceSystem,
    sourceContractVersion: value.sourceContractVersion,
    commandId: value.commandId,
    receiptId: value.receiptId,
    receiptDigest: value.receiptDigest,
    receivedAt: value.receivedAt,
  };
}

function parseStoryboardGenerationPolicy(value: unknown): PilotStoryboardGenerationPolicy {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['policyId', 'policyVersion']) ||
    typeof value.policyId !== 'string' ||
    value.policyId.length > 80 ||
    !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value.policyId) ||
    typeof value.policyVersion !== 'string' ||
    value.policyVersion.length > 32 ||
    !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(value.policyVersion)
  ) {
    throw new Error('invalid storyboard generation policy');
  }
  return { policyId: value.policyId, policyVersion: value.policyVersion };
}

function parseStoryboardValidationSummary(value: unknown): PilotStoryboardValidationSummary {
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, ['status', 'issueCodes']) ||
    (value.status !== 'passed' && value.status !== 'warnings') ||
    !Array.isArray(value.issueCodes)
  ) {
    throw new Error('invalid storyboard validation summary');
  }
  const issueCodes = value.issueCodes;
  if (
    issueCodes.length > 100 ||
    !issueCodes.every(
      (code): code is string =>
        typeof code === 'string' &&
        code.length <= 120 &&
        /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(code),
    )
  ) {
    throw new Error('invalid storyboard validation summary');
  }
  const sortedIssueCodes = [...issueCodes].sort();
  if (
    new Set(issueCodes).size !== issueCodes.length ||
    issueCodes.some((code, index) => sortedIssueCodes[index] !== code) ||
    (value.status === 'passed' && issueCodes.length !== 0) ||
    (value.status === 'warnings' && issueCodes.length === 0)
  ) {
    throw new Error('invalid storyboard validation summary');
  }
  return { status: value.status, issueCodes: [...issueCodes] };
}

function parseStoryboardDraftRevision(value: unknown): PilotStoryboardDraftRevision {
  const keys = [
    'objectType',
    'contractVersion',
    'status',
    'tenantId',
    'projectId',
    'approvedScriptVersionId',
    'approvedScriptDigest',
    'draftRevisionId',
    'revisionNumber',
    'previousRevisionId',
    'shots',
    'sourceReceipt',
    'generationPolicy',
    'validationSummary',
    'createdAt',
    'payloadDigest',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    value.objectType !== 'StoryboardDraftRevision' ||
    value.contractVersion !== '0.2' ||
    value.status !== 'draft' ||
    !uuid(value.tenantId) ||
    !uuid(value.projectId) ||
    !uuid(value.approvedScriptVersionId) ||
    !digest(value.approvedScriptDigest) ||
    !uuid(value.draftRevisionId) ||
    !positiveInteger(value.revisionNumber) ||
    !(value.previousRevisionId === null || uuid(value.previousRevisionId)) ||
    (value.revisionNumber === 1 && value.previousRevisionId !== null) ||
    (value.revisionNumber > 1 && value.previousRevisionId === null) ||
    value.previousRevisionId === value.draftRevisionId ||
    !timestamp(value.createdAt) ||
    !digest(value.payloadDigest)
  ) {
    throw new Error('invalid storyboard draft revision');
  }
  const sourceReceipt = parseStoryboardSourceReceipt(value.sourceReceipt);
  if (Date.parse(sourceReceipt.receivedAt) > Date.parse(value.createdAt)) {
    throw new Error('invalid storyboard receipt time');
  }
  return {
    objectType: 'StoryboardDraftRevision',
    contractVersion: '0.2',
    status: 'draft',
    tenantId: value.tenantId,
    projectId: value.projectId,
    approvedScriptVersionId: value.approvedScriptVersionId,
    approvedScriptDigest: value.approvedScriptDigest,
    draftRevisionId: value.draftRevisionId,
    revisionNumber: value.revisionNumber,
    previousRevisionId: value.previousRevisionId,
    shots: parseShots(value.shots),
    sourceReceipt,
    generationPolicy: parseStoryboardGenerationPolicy(value.generationPolicy),
    validationSummary: parseStoryboardValidationSummary(value.validationSummary),
    createdAt: value.createdAt,
    payloadDigest: value.payloadDigest,
  };
}

function parseDraftProvenance(value: unknown): PilotStoryboardDraftProvenance {
  const keys = [
    'draftRevisionId',
    'draftRevisionNumber',
    'previousDraftRevisionId',
    'sourceCommandId',
    'sourceReceiptId',
    'generationPolicyVersion',
    'validationSummary',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !safeReference(value.draftRevisionId) ||
    !positiveInteger(value.draftRevisionNumber) ||
    !(value.previousDraftRevisionId === null || safeReference(value.previousDraftRevisionId)) ||
    !safeReference(value.sourceCommandId) ||
    !safeReference(value.sourceReceiptId) ||
    !safeReference(value.generationPolicyVersion) ||
    !requiredString(value.validationSummary, 2_000)
  ) {
    throw new Error('invalid draft provenance');
  }
  return {
    draftRevisionId: value.draftRevisionId,
    draftRevisionNumber: value.draftRevisionNumber,
    previousDraftRevisionId: value.previousDraftRevisionId,
    sourceCommandId: value.sourceCommandId,
    sourceReceiptId: value.sourceReceiptId,
    generationPolicyVersion: value.generationPolicyVersion,
    validationSummary: value.validationSummary,
  };
}

function parseStoryboardVersion(value: unknown): PilotStoryboardVersion {
  const keys = [
    'id',
    'projectId',
    'scriptVersionId',
    'version',
    'status',
    'scriptPayloadDigest',
    'storyboardPayloadDigest',
    'shots',
    'draftProvenance',
    'createdBy',
    'createdAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !uuid(value.id) ||
    !uuid(value.projectId) ||
    !uuid(value.scriptVersionId) ||
    !positiveInteger(value.version) ||
    typeof value.status !== 'string' ||
    !CONTENT_STATUSES.has(value.status as PilotContentStatus) ||
    !digest(value.scriptPayloadDigest) ||
    !digest(value.storyboardPayloadDigest) ||
    !uuid(value.createdBy) ||
    !timestamp(value.createdAt)
  ) {
    throw new Error('invalid storyboard version');
  }
  return {
    id: value.id,
    projectId: value.projectId,
    scriptVersionId: value.scriptVersionId,
    version: value.version,
    status: value.status as PilotContentStatus,
    shots: parseShots(value.shots),
    draftProvenance: parseDraftProvenance(value.draftProvenance),
    createdBy: value.createdBy,
    createdAt: value.createdAt,
  };
}

function parseStoryboardApproval(value: unknown): PilotStoryboardApproval {
  const keys = [
    'id',
    'projectId',
    'storyboardVersionId',
    'status',
    'factRiskStatus',
    'reason',
    'actedBy',
    'actedAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !uuid(value.id) ||
    !uuid(value.projectId) ||
    !uuid(value.storyboardVersionId) ||
    typeof value.status !== 'string' ||
    !APPROVAL_STATUSES.has(value.status as PilotApprovalStatus) ||
    typeof value.factRiskStatus !== 'string' ||
    !FACT_RISK_STATUSES.has(value.factRiskStatus as PilotFactRiskStatus) ||
    !(value.reason === null || requiredString(value.reason, 2_000)) ||
    !uuid(value.actedBy) ||
    !timestamp(value.actedAt)
  ) {
    throw new Error('invalid storyboard approval');
  }
  return {
    id: value.id,
    projectId: value.projectId,
    storyboardVersionId: value.storyboardVersionId,
    status: value.status as PilotApprovalStatus,
    factRiskStatus: value.factRiskStatus as PilotFactRiskStatus,
    reason: value.reason,
    actedBy: value.actedBy,
    actedAt: value.actedAt,
  };
}

function parseEligibility(value: unknown): PilotProductionEligibility {
  const keys = [
    'projectId',
    'eligible',
    'scriptVersionId',
    'scriptVersion',
    'storyboardVersionId',
    'storyboardVersion',
    'reasonCode',
    'scriptApproval',
    'storyboardApproval',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    !uuid(value.projectId) ||
    typeof value.eligible !== 'boolean' ||
    !(value.scriptVersionId === null || uuid(value.scriptVersionId)) ||
    !(value.scriptVersion === null || positiveInteger(value.scriptVersion)) ||
    !(value.storyboardVersionId === null || uuid(value.storyboardVersionId)) ||
    !(value.storyboardVersion === null || positiveInteger(value.storyboardVersion)) ||
    typeof value.reasonCode !== 'string' ||
    !ELIGIBILITY_REASONS.has(value.reasonCode as PilotProductionEligibilityReason)
  ) {
    throw new Error('invalid production eligibility');
  }
  const scriptApproval =
    value.scriptApproval === null ? null : parseScriptApproval(value.scriptApproval);
  const storyboardApproval =
    value.storyboardApproval === null ? null : parseStoryboardApproval(value.storyboardApproval);
  if (
    value.eligible !== (value.reasonCode === 'ELIGIBLE') ||
    (value.eligible &&
      (value.scriptVersionId === null ||
        value.scriptVersion === null ||
        value.storyboardVersionId === null ||
        value.storyboardVersion === null ||
        scriptApproval?.status !== 'approved' ||
        scriptApproval.factRiskStatus !== 'cleared' ||
        storyboardApproval?.status !== 'approved' ||
        storyboardApproval.factRiskStatus !== 'cleared'))
  ) {
    throw new Error('inconsistent production eligibility');
  }
  return {
    projectId: value.projectId,
    eligible: value.eligible,
    scriptVersionId: value.scriptVersionId,
    scriptVersion: value.scriptVersion,
    storyboardVersionId: value.storyboardVersionId,
    storyboardVersion: value.storyboardVersion,
    reasonCode: value.reasonCode as PilotProductionEligibilityReason,
    scriptApproval,
    storyboardApproval,
  };
}

function parseCapabilities(value: unknown): PilotProductionCapability[] {
  if (
    !Array.isArray(value) ||
    value.length === 0 ||
    value.length > CAPABILITIES.size ||
    !value.every(
      (capability): capability is PilotProductionCapability =>
        typeof capability === 'string' && CAPABILITIES.has(capability as PilotProductionCapability),
    ) ||
    new Set(value).size !== value.length
  ) {
    throw new Error('invalid capabilities');
  }
  return [...value];
}

function parseProductionPackage(value: unknown): PilotProductionPackage {
  const keys = [
    'objectType',
    'contractVersion',
    'tenantId',
    'projectId',
    'packageId',
    'packageVersion',
    'scriptVersionId',
    'storyboardVersionId',
    'capabilityRequirements',
    'status',
    'payloadDigest',
    'approvedScriptDigest',
    'approvedStoryboardDigest',
    'createdAt',
    'expiresAt',
  ] as const;
  if (
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    value.objectType !== 'ProjectProductionPackage' ||
    value.contractVersion !== '0.3' ||
    !uuid(value.tenantId) ||
    !uuid(value.projectId) ||
    !uuid(value.packageId) ||
    !positiveInteger(value.packageVersion) ||
    !uuid(value.scriptVersionId) ||
    !uuid(value.storyboardVersionId) ||
    value.status !== 'ready' ||
    !digest(value.payloadDigest) ||
    !digest(value.approvedScriptDigest) ||
    !digest(value.approvedStoryboardDigest) ||
    !timestamp(value.createdAt) ||
    !timestamp(value.expiresAt) ||
    Date.parse(value.expiresAt) <= Date.parse(value.createdAt)
  ) {
    throw new Error('invalid production package');
  }
  return {
    objectType: 'ProjectProductionPackage',
    contractVersion: '0.3',
    projectId: value.projectId,
    packageId: value.packageId,
    packageVersion: value.packageVersion,
    scriptVersionId: value.scriptVersionId,
    storyboardVersionId: value.storyboardVersionId,
    capabilityRequirements: parseCapabilities(value.capabilityRequirements),
    status: 'ready',
    createdAt: value.createdAt,
    expiresAt: value.expiresAt,
  };
}

function normalizedKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function containsSensitiveCanvasData(value: unknown, seen = new Set<object>()): boolean {
  if (typeof value === 'string') {
    return /\bbearer\s+[a-z0-9._~+/=-]{4,}/i.test(value);
  }
  if (typeof value !== 'object' || value === null) return false;
  if (seen.has(value)) return true;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((item) => containsSensitiveCanvasData(item, seen));
  }
  return Object.entries(value).some(([key, nested]) => {
    const normalized = normalizedKey(key);
    return (
      SENSITIVE_CANVAS_KEY_PARTS.some((part) => normalized.includes(part)) ||
      containsSensitiveCanvasData(nested, seen)
    );
  });
}

function parseCanvasEntry(value: unknown): PilotCanvasEntry {
  const keys = [
    'objectType',
    'contractVersion',
    'handle',
    'tenantId',
    'projectId',
    'packageId',
    'state',
    'issuedAt',
    'expiresAt',
  ] as const;
  if (
    containsSensitiveCanvasData(value) ||
    !isRecord(value) ||
    !hasOnlyKeys(value, keys) ||
    value.objectType !== 'CanvasEntry' ||
    value.contractVersion !== '0.2' ||
    typeof value.handle !== 'string' ||
    !/^ce_[A-Za-z0-9_-]{32,64}$/.test(value.handle) ||
    !uuid(value.tenantId) ||
    !uuid(value.projectId) ||
    !uuid(value.packageId) ||
    value.state !== 'active' ||
    !timestamp(value.issuedAt) ||
    !timestamp(value.expiresAt)
  ) {
    throw new Error('invalid canvas entry');
  }
  const lifetimeMilliseconds = Date.parse(value.expiresAt) - Date.parse(value.issuedAt);
  if (
    lifetimeMilliseconds < 30_000 ||
    lifetimeMilliseconds > 300_000 ||
    lifetimeMilliseconds % 1_000 !== 0
  ) {
    throw new Error('invalid canvas entry lifetime');
  }
  return {
    objectType: 'CanvasEntry',
    contractVersion: '0.2',
    handle: value.handle,
    tenantId: value.tenantId,
    projectId: value.projectId,
    packageId: value.packageId,
    state: 'active',
    issuedAt: value.issuedAt,
    expiresAt: value.expiresAt,
  };
}

function parseList<T>(value: unknown, key: string, parser: (item: unknown) => T): T[] {
  if (!isRecord(value) || !hasOnlyKeys(value, [key]) || !Array.isArray(value[key])) {
    throw new Error('invalid list response');
  }
  return value[key].map(parser);
}

function validateApprovalInput(input: PilotCreateApprovalInput): void {
  const keys =
    input.reason === undefined
      ? ['status', 'factRiskStatus']
      : ['status', 'factRiskStatus', 'reason'];
  if (
    !isRecord(input) ||
    !hasOnlyKeys(input, keys) ||
    !APPROVAL_STATUSES.has(input.status) ||
    !FACT_RISK_STATUSES.has(input.factRiskStatus) ||
    !(input.reason === undefined || requiredString(input.reason, 2_000)) ||
    (input.status === 'approved' && input.factRiskStatus !== 'cleared') ||
    (input.status !== 'approved' && input.reason === undefined)
  ) {
    throw invalidClientInput();
  }
}

function validateStoryboardInput(
  projectId: string,
  input: PilotCreateStoryboardVersionInput,
): void {
  if (!isRecord(input) || !hasOnlyKeys(input, ['draftRevision'])) {
    throw invalidClientInput();
  }
  try {
    const draft = parseStoryboardDraftRevision(input.draftRevision);
    if (draft.projectId !== projectId) throw new Error('scope mismatch');
  } catch {
    throw invalidClientInput();
  }
}

function requestOptions(options: PilotRequestOptions | undefined): {
  signal: AbortSignal | undefined;
  maxAttempts: number | undefined;
} {
  return { signal: options?.signal, maxAttempts: options?.maxAttempts };
}

function mutationResult<T>(
  data: T,
  replayed: boolean | null,
  status: number,
): PilotMutationResult<T> {
  return { value: data, replayed: replayed ?? status === 200 };
}

export function createPilotContentProductionApi(
  options: PilotContentProductionApiOptions = {},
): PilotContentProductionApi {
  const transport =
    options.transport ??
    createPilotApiTransport({
      runtime: options.runtime ?? pilotRuntime,
      fetchImpl: options.fetchImpl,
    });

  return {
    async listScriptVersions(projectId, options) {
      assertProjectId(projectId);
      const response = await transport.request({
        method: 'GET',
        path: `/api/v1/projects/${projectId}/script-versions`,
        ...requestOptions(options),
        expectedStatuses: [200],
        parse: (value) => parseList(value, 'scriptVersions', parseScriptVersion),
      });
      return response.data;
    },

    async createScriptVersion(projectId, input, idempotencyKey, options) {
      assertProjectId(projectId);
      if (!isRecord(input) || !hasOnlyKeys(input, ['payload']) || !isRecord(input.payload)) {
        throw invalidClientInput();
      }
      const response = await transport.request({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/script-versions`,
        body: input,
        idempotencyKey,
        ...requestOptions(options),
        expectedStatuses: [200, 201],
        parse: parseScriptVersion,
      });
      return mutationResult(response.data, response.replayed, response.status);
    },

    async createScriptApproval(projectId, scriptVersionId, input, idempotencyKey, options) {
      assertProjectId(projectId);
      if (!uuid(scriptVersionId)) throw invalidClientInput();
      validateApprovalInput(input);
      const response = await transport.request({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/script-versions/${scriptVersionId}/approvals`,
        body: input,
        idempotencyKey,
        ...requestOptions(options),
        expectedStatuses: [200, 201],
        parse: parseScriptApproval,
      });
      return mutationResult(response.data, response.replayed, response.status);
    },

    async listStoryboardVersions(projectId, options) {
      assertProjectId(projectId);
      const response = await transport.request({
        method: 'GET',
        path: `/api/v1/projects/${projectId}/storyboard-versions`,
        ...requestOptions(options),
        expectedStatuses: [200],
        parse: (value) => parseList(value, 'storyboardVersions', parseStoryboardVersion),
      });
      return response.data;
    },

    async createStoryboardVersion(projectId, input, idempotencyKey, options) {
      assertProjectId(projectId);
      validateStoryboardInput(projectId, input);
      const response = await transport.request({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/storyboard-versions`,
        body: input,
        idempotencyKey,
        ...requestOptions(options),
        expectedStatuses: [200, 201],
        parse: parseStoryboardVersion,
      });
      return mutationResult(response.data, response.replayed, response.status);
    },

    async createStoryboardApproval(projectId, storyboardVersionId, input, idempotencyKey, options) {
      assertProjectId(projectId);
      if (!uuid(storyboardVersionId)) throw invalidClientInput();
      validateApprovalInput(input);
      const response = await transport.request({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/storyboard-versions/${storyboardVersionId}/approvals`,
        body: input,
        idempotencyKey,
        ...requestOptions(options),
        expectedStatuses: [200, 201],
        parse: parseStoryboardApproval,
      });
      return mutationResult(response.data, response.replayed, response.status);
    },

    async readProductionEligibility(projectId, options) {
      assertProjectId(projectId);
      const response = await transport.request({
        method: 'GET',
        path: `/api/v1/projects/${projectId}/production-eligibility`,
        ...requestOptions(options),
        expectedStatuses: [200],
        parse: parseEligibility,
      });
      return response.data;
    },

    async createProductionPackage(projectId, input, idempotencyKey, options) {
      assertProjectId(projectId);
      const keys = [
        'scriptVersionId',
        'storyboardVersionId',
        'capabilityRequirements',
        'expiresInSeconds',
      ] as const;
      if (
        !isRecord(input) ||
        !hasOnlyKeys(input, keys) ||
        !uuid(input.scriptVersionId) ||
        !uuid(input.storyboardVersionId) ||
        !Number.isInteger(input.expiresInSeconds) ||
        input.expiresInSeconds < 300 ||
        input.expiresInSeconds > 86_400
      ) {
        throw invalidClientInput();
      }
      try {
        parseCapabilities(input.capabilityRequirements);
      } catch {
        throw invalidClientInput();
      }
      const response = await transport.request({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/production-packages`,
        body: input,
        idempotencyKey,
        ...requestOptions(options),
        expectedStatuses: [200, 201],
        parse: parseProductionPackage,
      });
      return mutationResult(response.data, response.replayed, response.status);
    },

    async readProductionPackage(projectId, packageId, options) {
      assertProjectId(projectId);
      if (!uuid(packageId)) throw invalidClientInput();
      const response = await transport.request({
        method: 'GET',
        path: `/api/v1/projects/${projectId}/production-packages/${packageId}`,
        ...requestOptions(options),
        expectedStatuses: [200],
        parse: parseProductionPackage,
      });
      return response.data;
    },

    async createCanvasEntry(projectId, input, idempotencyKey, options) {
      assertProjectId(projectId);
      if (
        !isRecord(input) ||
        !hasOnlyKeys(input, ['packageId', 'ttlSeconds']) ||
        !uuid(input.packageId) ||
        !Number.isInteger(input.ttlSeconds) ||
        input.ttlSeconds < 30 ||
        input.ttlSeconds > 300
      ) {
        throw invalidClientInput();
      }
      const response = await transport.request({
        method: 'POST',
        path: `/api/v1/projects/${projectId}/canvas-entries`,
        body: input,
        idempotencyKey,
        ...requestOptions(options),
        expectedStatuses: [200, 201],
        parse: parseCanvasEntry,
      });
      return mutationResult(response.data, response.replayed, response.status);
    },

    async readCanvasEntry(projectId, handle, options) {
      assertProjectId(projectId);
      if (!/^ce_[A-Za-z0-9_-]{32,64}$/.test(handle)) throw invalidClientInput();
      const response = await transport.request({
        method: 'GET',
        path: `/api/v1/projects/${projectId}/canvas-entries/${handle}`,
        ...requestOptions(options),
        expectedStatuses: [200],
        parse: parseCanvasEntry,
      });
      return response.data;
    },
  };
}

export const pilotContentProductionApi = createPilotContentProductionApi();
