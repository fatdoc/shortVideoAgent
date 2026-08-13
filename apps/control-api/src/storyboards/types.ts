import type { SessionActor } from '../projects/types.js';
import type { StoryboardDraftRevision } from './schema.js';

export type StoryboardVersionStatus = 'draft' | 'approved' | 'revoked' | 'superseded';
export type StoryboardApprovalStatus = 'approved' | 'revoked' | 'blocked';
export type StoryboardFactRiskStatus = 'cleared' | 'unresolved';

export type StoryboardVersion = {
  id: string;
  tenantId: string;
  projectId: string;
  scriptVersionId: string;
  version: number;
  status: StoryboardVersionStatus;
  draft: StoryboardDraftRevision;
  createdBy: string;
  createdAt: string;
};

export type StoryboardApprovalEvent = {
  id: string;
  tenantId: string;
  projectId: string;
  storyboardVersionId: string;
  sequence: string;
  status: StoryboardApprovalStatus;
  factRiskStatus: StoryboardFactRiskStatus;
  reason: string | null;
  eventDigest: string;
  actedBy: string;
  actedAt: string;
};

export type CreateStoryboardVersionInput = {
  draft: unknown;
  idempotencyKey: string;
};

export type CreateStoryboardApprovalInput = {
  expectedVersion: number;
  status: StoryboardApprovalStatus;
  factRiskStatus: StoryboardFactRiskStatus;
  reason?: string | undefined;
  idempotencyKey: string;
};

export type IdempotentStoryboardResult<T> = {
  value: T;
  replayed: boolean;
};

export interface StoryboardAuthorityStore {
  createVersion(
    actor: SessionActor,
    projectId: string,
    draft: StoryboardDraftRevision,
    idempotencyKey: string,
  ): Promise<IdempotentStoryboardResult<StoryboardVersion> | null>;
  listVersions(actor: SessionActor, projectId: string): Promise<StoryboardVersion[] | null>;
  createApproval(
    actor: SessionActor,
    projectId: string,
    storyboardVersionId: string,
    input: CreateStoryboardApprovalInput,
  ): Promise<IdempotentStoryboardResult<StoryboardApprovalEvent> | null>;
  listApprovals(
    actor: SessionActor,
    projectId: string,
    storyboardVersionId: string,
  ): Promise<StoryboardApprovalEvent[] | null>;
}
