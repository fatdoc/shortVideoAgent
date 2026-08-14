import type { OrganizationType, RoleCode } from '../auth/types.js';
import type { BrowserSafeBriefPayload } from '../briefs/schema.js';

export type SessionActor = {
  userId: string;
  membershipId: string;
  organizationId: string;
  organizationType: Extract<OrganizationType, 'TENANT'>;
  tenantId: string;
  membershipVersion: number;
  primaryRole: RoleCode;
  roles: RoleCode[];
};

export type ProjectStatus = 'draft' | 'active' | 'production' | 'completed' | 'archived';

export type Project = {
  id: string;
  name: string;
  status: ProjectStatus;
  platform: string;
  aspectRatio: string;
  targetDurationSeconds: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type BriefVersion = {
  id: string;
  projectId: string;
  version: number;
  status: 'draft' | 'approved' | 'superseded';
  payload: BrowserSafeBriefPayload;
  createdBy: string;
  createdAt: string;
};

export type ScriptVersion = {
  id: string;
  projectId: string;
  version: number;
  status: 'draft' | 'approved' | 'revoked' | 'superseded';
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
};

export type ApprovalEvent = {
  id: string;
  projectId: string;
  scriptVersionId: string;
  status: 'approved' | 'revoked' | 'blocked';
  factRiskStatus: 'cleared' | 'unresolved';
  reason: string | null;
  actedBy: string;
  actedAt: string;
};

export const PRODUCTION_ELIGIBILITY_REASON_CODES = [
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
] as const;

export type ProductionEligibilityReason = (typeof PRODUCTION_ELIGIBILITY_REASON_CODES)[number];

export type ProductionStoryboardApproval = {
  id: string;
  projectId: string;
  storyboardVersionId: string;
  status: ApprovalEvent['status'];
  factRiskStatus: ApprovalEvent['factRiskStatus'];
  reason: string | null;
  actedBy: string;
  actedAt: string;
};

export type ProductionEligibilityDecision = {
  projectId: string;
  eligible: boolean;
  scriptVersionId: string | null;
  scriptVersion: number | null;
  storyboardVersionId: string | null;
  storyboardVersion: number | null;
  reasonCode: ProductionEligibilityReason;
  scriptApproval: ApprovalEvent | null;
  storyboardApproval: ProductionStoryboardApproval | null;
};

export type ProductionScriptAuthority = {
  id: string;
  projectId: string;
  version: number;
  status: ScriptVersion['status'];
  payloadDigest: string;
};

export type ProductionStoryboardAuthority = {
  id: string;
  projectId: string;
  scriptVersionId: string;
  version: number;
  status: ScriptVersion['status'];
  scriptPayloadDigest: string;
  payloadDigest: string;
};

export type ProductionScriptApprovalAuthority = ApprovalEvent & {
  sequence: string;
};

export type ProductionStoryboardApprovalAuthority = ProductionStoryboardApproval & {
  sequence: string;
};

export type ProductionEligibilityEvaluationInput = {
  projectId: string;
  scripts: readonly ProductionScriptAuthority[];
  scriptApprovals: readonly ProductionScriptApprovalAuthority[];
  storyboards: readonly ProductionStoryboardAuthority[];
  storyboardApprovals: readonly ProductionStoryboardApprovalAuthority[];
};

export type IdempotentResult<T> = { value: T; replayed: boolean };

export type IdempotencyInput = {
  operation: string;
  key: string;
  payload: unknown;
};

export type CreateProjectInput = {
  name: string;
  status: ProjectStatus;
  platform: string;
  aspectRatio: string;
  targetDurationSeconds: number;
};

export type UpdateProjectInput = {
  [Key in keyof CreateProjectInput]?: CreateProjectInput[Key] | undefined;
};

export type CreateApprovalInput = {
  status: ApprovalEvent['status'];
  factRiskStatus: ApprovalEvent['factRiskStatus'];
  reason?: string | undefined;
};

export interface ContentStore {
  createProject(
    actor: SessionActor,
    input: CreateProjectInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<Project>>;
  listProjects(actor: SessionActor, projectIds: readonly string[] | null): Promise<Project[]>;
  getProject(actor: SessionActor, projectId: string): Promise<Project | null>;
  updateProject(
    actor: SessionActor,
    projectId: string,
    input: UpdateProjectInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<Project> | null>;
  createBriefVersion(
    actor: SessionActor,
    projectId: string,
    payload: BrowserSafeBriefPayload,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<BriefVersion> | null>;
  listBriefVersions(actor: SessionActor, projectId: string): Promise<BriefVersion[] | null>;
  createScriptVersion(
    actor: SessionActor,
    projectId: string,
    payload: Record<string, unknown>,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ScriptVersion> | null>;
  listScriptVersions(actor: SessionActor, projectId: string): Promise<ScriptVersion[] | null>;
  createApproval(
    actor: SessionActor,
    projectId: string,
    scriptVersionId: string,
    input: CreateApprovalInput,
    idempotency: IdempotencyInput,
  ): Promise<IdempotentResult<ApprovalEvent> | null>;
  getProductionEligibility(
    actor: SessionActor,
    projectId: string,
  ): Promise<ProductionEligibilityDecision | null>;
}
