import { z } from 'zod';
import type { SessionActor } from '../projects/types.js';
import { parseStoryboardDraftRevision, StoryboardContractError } from './contract.js';
import { StoryboardAuthorityError } from './errors.js';
import type {
  CreateStoryboardApprovalInput,
  CreateStoryboardVersionInput,
  IdempotentStoryboardResult,
  StoryboardApprovalEvent,
  StoryboardAuthorityStore,
  StoryboardVersion,
} from './types.js';

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const idempotencyKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;

const approvalInputSchema = z
  .object({
    expectedVersion: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    status: z.enum(['approved', 'revoked', 'blocked']),
    factRiskStatus: z.enum(['cleared', 'unresolved']),
    reason: z
      .string()
      .min(1)
      .max(2_000)
      .refine((value) => value.trim() === value)
      .optional(),
    idempotencyKey: z.string().regex(idempotencyKeyPattern),
  })
  .strict();

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === 'string' && canonicalUuidPattern.test(value);
}

function assertActor(actor: SessionActor): void {
  const candidate = actor as unknown as Record<string, unknown>;
  if (
    !candidate ||
    candidate.organizationType !== 'TENANT' ||
    !isCanonicalUuid(candidate.userId) ||
    !isCanonicalUuid(candidate.membershipId) ||
    !isCanonicalUuid(candidate.organizationId) ||
    !isCanonicalUuid(candidate.tenantId) ||
    candidate.organizationId !== candidate.tenantId ||
    !Number.isInteger(candidate.membershipVersion) ||
    (candidate.membershipVersion as number) < 1 ||
    typeof candidate.primaryRole !== 'string' ||
    !Array.isArray(candidate.roles) ||
    !candidate.roles.includes(candidate.primaryRole)
  ) {
    throw new StoryboardAuthorityError('STORYBOARD_ACTOR_INVALID');
  }
}

function assertScopedId(value: unknown): asserts value is string {
  if (!isCanonicalUuid(value)) {
    throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
  }
}

function parseIdempotencyKey(value: unknown): string {
  const parsed = z.string().regex(idempotencyKeyPattern).safeParse(value);
  if (!parsed.success) throw new StoryboardAuthorityError('STORYBOARD_INPUT_INVALID');
  return parsed.data;
}

export class StoryboardAuthorityService {
  constructor(private readonly store: StoryboardAuthorityStore) {}

  async createVersion(
    actor: SessionActor,
    projectId: string,
    input: CreateStoryboardVersionInput,
  ): Promise<IdempotentStoryboardResult<StoryboardVersion>> {
    assertActor(actor);
    assertScopedId(projectId);
    const draft = parseStoryboardDraftRevision(input.draft);
    const idempotencyKey = parseIdempotencyKey(input.idempotencyKey);
    if (draft.tenantId !== actor.tenantId || draft.projectId !== projectId) {
      throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
    }

    const result = await this.safeStoreCall(() =>
      this.store.createVersion(actor, projectId, draft, idempotencyKey),
    );
    if (!result) throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
    return result;
  }

  async listVersions(actor: SessionActor, projectId: string): Promise<StoryboardVersion[]> {
    assertActor(actor);
    assertScopedId(projectId);
    const versions = await this.safeStoreCall(() => this.store.listVersions(actor, projectId));
    if (!versions) throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
    return versions;
  }

  async createApproval(
    actor: SessionActor,
    projectId: string,
    storyboardVersionId: string,
    input: CreateStoryboardApprovalInput,
  ): Promise<IdempotentStoryboardResult<StoryboardApprovalEvent>> {
    assertActor(actor);
    assertScopedId(projectId);
    assertScopedId(storyboardVersionId);
    const parsed = approvalInputSchema.safeParse(input);
    if (!parsed.success) throw new StoryboardAuthorityError('STORYBOARD_INPUT_INVALID');
    if (parsed.data.status === 'approved' && parsed.data.factRiskStatus !== 'cleared') {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }
    if (parsed.data.status !== 'approved' && !parsed.data.reason) {
      throw new StoryboardAuthorityError('STORYBOARD_APPROVAL_STATE_INVALID');
    }

    const result = await this.safeStoreCall(() =>
      this.store.createApproval(actor, projectId, storyboardVersionId, parsed.data),
    );
    if (!result) throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
    return result;
  }

  async listApprovals(
    actor: SessionActor,
    projectId: string,
    storyboardVersionId: string,
  ): Promise<StoryboardApprovalEvent[]> {
    assertActor(actor);
    assertScopedId(projectId);
    assertScopedId(storyboardVersionId);
    const approvals = await this.safeStoreCall(() =>
      this.store.listApprovals(actor, projectId, storyboardVersionId),
    );
    if (!approvals) throw new StoryboardAuthorityError('STORYBOARD_NOT_FOUND');
    return approvals;
  }

  private async safeStoreCall<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof StoryboardAuthorityError || error instanceof StoryboardContractError) {
        throw error;
      }
      throw new StoryboardAuthorityError('STORYBOARD_STORAGE_ERROR');
    }
  }
}
