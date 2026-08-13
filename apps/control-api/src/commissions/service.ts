import { CommissionPermissionDeniedError, CommissionScopeNotFoundError } from './errors.js';
import type {
  CommissionAccrualAudit,
  CommissionActor,
  CommissionAuditStore,
  CommissionCalculationAudit,
  CommissionReversalAudit,
} from './types.js';

function boundedLimit(limit: number): number {
  return Math.max(1, Math.min(100, Math.trunc(limit)));
}

export class CommissionAuditService {
  constructor(private readonly store: CommissionAuditStore) {}

  async listPlatformCalculations(
    actor: CommissionActor,
    limit: number,
  ): Promise<CommissionCalculationAudit[]> {
    this.requirePlatformAdmin(actor);
    return this.store.listCalculations({}, boundedLimit(limit));
  }

  async listPlatformAccruals(
    actor: CommissionActor,
    limit: number,
  ): Promise<CommissionAccrualAudit[]> {
    this.requirePlatformAdmin(actor);
    return this.store.listAccruals(null, boundedLimit(limit));
  }

  async listPlatformReversals(
    actor: CommissionActor,
    limit: number,
  ): Promise<CommissionReversalAudit[]> {
    this.requirePlatformAdmin(actor);
    return this.store.listReversals(null, boundedLimit(limit));
  }

  async listPlatformManualReviews(
    actor: CommissionActor,
    limit: number,
  ): Promise<CommissionCalculationAudit[]> {
    this.requirePlatformAdmin(actor);
    return this.store.listCalculations({ outcome: 'manual_review' }, boundedLimit(limit));
  }

  async listChannelCalculations(
    actor: CommissionActor,
    requestedChannelId: string,
    limit: number,
  ): Promise<CommissionCalculationAudit[]> {
    const channelId = await this.requireChannelAdmin(actor, requestedChannelId);
    return this.store.listCalculations({ beneficiaryChannelId: channelId }, boundedLimit(limit));
  }

  async listChannelAccruals(
    actor: CommissionActor,
    requestedChannelId: string,
    limit: number,
  ): Promise<CommissionAccrualAudit[]> {
    const channelId = await this.requireChannelAdmin(actor, requestedChannelId);
    return this.store.listAccruals(channelId, boundedLimit(limit));
  }

  async listChannelReversals(
    actor: CommissionActor,
    requestedChannelId: string,
    limit: number,
  ): Promise<CommissionReversalAudit[]> {
    const channelId = await this.requireChannelAdmin(actor, requestedChannelId);
    return this.store.listReversals(channelId, boundedLimit(limit));
  }

  private requirePlatformAdmin(actor: CommissionActor): void {
    if (actor.organizationType !== 'PLATFORM') throw new CommissionScopeNotFoundError();
    if (!actor.roles.includes('platform_admin')) throw new CommissionPermissionDeniedError();
  }

  private async requireChannelAdmin(
    actor: CommissionActor,
    requestedChannelId: string,
  ): Promise<string> {
    if (actor.organizationType !== 'CHANNEL') throw new CommissionScopeNotFoundError();
    const canonicalChannelId = await this.store.findChannelIdByOrganizationId(actor.organizationId);
    if (!canonicalChannelId || canonicalChannelId !== requestedChannelId) {
      throw new CommissionScopeNotFoundError();
    }
    if (!actor.roles.includes('channel_admin')) throw new CommissionPermissionDeniedError();
    return canonicalChannelId;
  }
}
