import type { OrganizationType, RoleCode } from '../auth/types.js';

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
  payload: Record<string, unknown>;
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

export type ProductionEligibility = {
  projectId: string;
  eligible: boolean;
  scriptVersionId: string | null;
  scriptVersion: number | null;
  reasonCode:
    | 'ELIGIBLE'
    | 'NO_SCRIPT_VERSION'
    | 'SCRIPT_NOT_APPROVED'
    | 'APPROVAL_REVOKED'
    | 'SCRIPT_BLOCKED'
    | 'FACT_RISK_UNRESOLVED';
  approval: ApprovalEvent | null;
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
    payload: Record<string, unknown>,
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
  ): Promise<ProductionEligibility | null>;
}
