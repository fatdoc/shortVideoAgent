import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { commissionSettlementSnapshotDigest } from './digest.js';
import {
  CommissionSettlementDomainError,
  CommissionSettlementEvidenceInvalidError,
  CommissionSettlementIdempotencyConflictError,
  CommissionSettlementPeriodConflictError,
  CommissionSettlementScopeNotFoundError,
} from './errors.js';
import type {
  CommissionSettlementDraft,
  CommissionSettlementStore,
  CreateCommissionSettlementRecord,
  ReplayableCommissionSettlement,
} from './types.js';

type RepositoryEntity = 'settlement' | 'settlementItem';

type SettlementRow = {
  commission_settlement_id: string;
  beneficiary_channel_id: string;
  currency: string;
  period_start: Date | string;
  period_end: Date | string;
  cutoff_at: Date | string;
  status: 'draft' | 'reviewed' | 'approved';
  idempotency_key: string;
  request_digest: string;
  created_at: Date | string;
};

type SettlementTotalsRow = {
  gross_accrual_amount_minor: string | number;
  gross_reversal_amount_minor: string | number;
  accrual_item_count: string | number;
  reversal_item_count: string | number;
  item_count: string | number;
};

type AccrualCandidateRow = {
  commission_accrual_id: string;
  source_payment_event_id: string;
  commission_rule_version_id: string;
  beneficiary_channel_id: string;
  currency: string;
  commission_amount_minor: string | number;
  eligible_at: Date | string;
  occurred_at: Date | string;
  calculation_digest: string;
  reversed_amount_before_cutoff: string | number;
  evidence_valid: boolean;
};

type ReversalCandidateRow = {
  commission_reversal_id: string;
  commission_accrual_id: string;
  source_payment_event_id: string;
  beneficiary_channel_id: string;
  currency: string;
  reversal_type: 'refund' | 'chargeback';
  amount_minor: string | number;
  occurred_at: Date | string;
  reversal_digest: string;
  evidence_valid: boolean;
};

type SettlementItemInsert = {
  commission_settlement_item_id: string;
  commission_settlement_id: string;
  entry_type: 'accrual' | 'reversal';
  commission_accrual_id: string | null;
  commission_reversal_id: string | null;
  amount_minor: number;
  currency: string;
  beneficiary_channel_id: string;
  source_occurred_at: Date;
  item_snapshot: Record<string, unknown>;
  item_digest: string;
  created_at: Date;
};

type PostgresError = { code?: string; constraint?: string };

function postgresError(error: unknown): PostgresError {
  return (error as PostgresError | null) ?? {};
}

function isUniqueViolation(error: unknown): boolean {
  return postgresError(error).code === '23505';
}

function safeInteger(value: string | number, field: string): number {
  const normalized = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(normalized)) {
    throw new CommissionSettlementEvidenceInvalidError(`${field} is outside the safe range.`);
  }
  return normalized;
}

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function dateOnly(value: Date | string): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

function sumSafe(left: number, right: number, field: string): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new CommissionSettlementEvidenceInvalidError(`${field} is outside the safe range.`);
  }
  return result;
}

export class PostgresCommissionSettlementRepository implements CommissionSettlementStore {
  constructor(
    private readonly database: Knex,
    private readonly newId: (entity: RepositoryEntity) => string = () => randomUUID(),
  ) {}

  async createDraft(
    input: CreateCommissionSettlementRecord,
  ): Promise<ReplayableCommissionSettlement> {
    try {
      return await this.database.transaction(async (transaction) => {
        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `commission:settlement:scope:${input.beneficiaryChannelId}:${input.currency}:${dateOnly(input.periodStart)}:${dateOnly(input.periodEnd)}`,
        ]);
        await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
          `commission:settlement:idempotency:${input.idempotencyKey}`,
        ]);

        const byIdempotency = await this.findByIdempotencyKey(
          transaction,
          input.idempotencyKey,
          true,
        );
        if (byIdempotency) {
          if (byIdempotency.request_digest !== input.requestDigest) {
            throw new CommissionSettlementIdempotencyConflictError();
          }
          return { value: await this.project(transaction, byIdempotency), replayed: true };
        }

        const byPeriod = await this.findByPeriod(transaction, input, true);
        if (byPeriod) throw new CommissionSettlementPeriodConflictError();

        await this.requireActivePlatformAdmin(transaction, input);
        await this.requireActiveChannel(transaction, input.beneficiaryChannelId);

        const accrualCandidates = await this.loadAccrualCandidates(transaction, input);
        const reversalCandidates = await this.loadReversalCandidates(transaction, input);
        const settlementId = this.newId('settlement');
        const items = this.buildItems(settlementId, input, accrualCandidates, reversalCandidates);
        const totals = this.totals(items);
        const itemDigests = items.map((item) => item.item_digest);
        const settlementSnapshot = {
          schemaVersion: 'commission-settlement.v1',
          fixture: 'TEST_NON_QUOTE',
          paymentMode: input.paymentMode,
          beneficiaryChannelId: input.beneficiaryChannelId,
          currency: input.currency,
          periodStart: dateOnly(input.periodStart),
          periodEnd: dateOnly(input.periodEnd),
          cutoffAt: input.cutoffAt.toISOString(),
          itemDigests,
          ...totals,
          createdByMembershipId: input.createdByMembershipId,
        };

        const [created] = (await transaction('control_plane.commission_settlements')
          .insert({
            commission_settlement_id: settlementId,
            beneficiary_channel_id: input.beneficiaryChannelId,
            currency: input.currency,
            period_start: input.periodStart,
            period_end: input.periodEnd,
            cutoff_at: input.cutoffAt,
            status: 'draft',
            idempotency_key: input.idempotencyKey,
            request_digest: input.requestDigest,
            settlement_snapshot: settlementSnapshot,
            settlement_digest: commissionSettlementSnapshotDigest(settlementSnapshot),
            created_by_membership_id: input.createdByMembershipId,
            reviewed_by_membership_id: null,
            reviewed_at: null,
            approved_by_membership_id: null,
            approved_at: null,
            created_at: input.createdAt,
          })
          .returning('*')) as SettlementRow[];
        if (!created) throw new Error('Commission Settlement insert returned no row.');

        if (items.length > 0) {
          await transaction('control_plane.commission_settlement_items').insert(items);
        }

        return {
          value: this.fromRow(created, {
            gross_accrual_amount_minor: totals.grossAccrualAmountMinor,
            gross_reversal_amount_minor: totals.grossReversalAmountMinor,
            accrual_item_count: totals.accrualItemCount,
            reversal_item_count: totals.reversalItemCount,
            item_count: totals.itemCount,
          }),
          replayed: false,
        };
      });
    } catch (error) {
      if (error instanceof CommissionSettlementDomainError) throw error;
      if (isUniqueViolation(error)) {
        const constraint = postgresError(error).constraint;
        if (constraint === 'commission_settlements_idempotency_uq') {
          throw new CommissionSettlementIdempotencyConflictError();
        }
        if (constraint === 'commission_settlements_scope_period_uq') {
          throw new CommissionSettlementPeriodConflictError();
        }
        if (
          constraint === 'commission_settlement_items_accrual_uq' ||
          constraint === 'commission_settlement_items_reversal_uq'
        ) {
          throw new CommissionSettlementEvidenceInvalidError(
            'Commission source evidence was already occupied concurrently.',
          );
        }
      }
      throw error;
    }
  }

  private async requireActivePlatformAdmin(
    transaction: Knex.Transaction,
    input: CreateCommissionSettlementRecord,
  ): Promise<void> {
    const actor = await transaction('control_plane.organization_memberships as membership')
      .join(
        'control_plane.organization_membership_roles as membership_role',
        'membership_role.membership_id',
        'membership.membership_id',
      )
      .join(
        'control_plane.organizations as organization',
        'organization.organization_id',
        'membership.organization_id',
      )
      .select('membership.membership_id')
      .where({
        'membership.membership_id': input.createdByMembershipId,
        'membership.user_id': input.createdByUserId,
        'membership.status': 'active',
        'membership_role.role_code': 'platform_admin',
        'organization.organization_type': 'PLATFORM',
        'organization.status': 'active',
      })
      .forUpdate('membership')
      .first();
    if (!actor) throw new CommissionSettlementScopeNotFoundError();
  }

  private async requireActiveChannel(
    transaction: Knex.Transaction,
    beneficiaryChannelId: string,
  ): Promise<void> {
    const channel = await transaction('control_plane.channels as channel')
      .join(
        'control_plane.organizations as organization',
        'organization.organization_id',
        'channel.organization_id',
      )
      .select('channel.channel_id')
      .where({
        'channel.channel_id': beneficiaryChannelId,
        'organization.organization_type': 'CHANNEL',
        'organization.status': 'active',
      })
      .forUpdate('channel')
      .first();
    if (!channel) throw new CommissionSettlementScopeNotFoundError();
  }

  private async loadAccrualCandidates(
    transaction: Knex.Transaction,
    input: CreateCommissionSettlementRecord,
  ): Promise<AccrualCandidateRow[]> {
    const rows = (await transaction('control_plane.commission_accruals as accrual')
      .join(
        'control_plane.payment_events as payment_event',
        'payment_event.payment_event_id',
        'accrual.source_payment_event_id',
      )
      .join(
        'control_plane.commission_rule_versions as commission_rule',
        'commission_rule.commission_rule_version_id',
        'accrual.commission_rule_version_id',
      )
      .leftJoin(
        'control_plane.commission_settlement_items as occupied_item',
        'occupied_item.commission_accrual_id',
        'accrual.commission_accrual_id',
      )
      .select(
        'accrual.commission_accrual_id',
        'accrual.source_payment_event_id',
        'accrual.commission_rule_version_id',
        'accrual.beneficiary_channel_id',
        'accrual.currency',
        'accrual.commission_amount_minor',
        'accrual.eligible_at',
        'accrual.occurred_at',
        'accrual.calculation_digest',
        transaction.raw(
          `(select coalesce(sum(reversal.amount_minor), 0)
              from control_plane.commission_reversals reversal
             where reversal.commission_accrual_id = accrual.commission_accrual_id
               and reversal.occurred_at < ?) as reversed_amount_before_cutoff`,
          [input.cutoffAt],
        ),
        transaction.raw(
          `(payment_event.payment_mode = 'TEST'
            and payment_event.event_type = 'payment_succeeded'
            and payment_event.processing_status = 'applied'
            and payment_event.currency = accrual.currency
            and commission_rule.payment_mode = 'TEST'
            and commission_rule.status in ('ACTIVE', 'RETIRED')
            and commission_rule.currency = accrual.currency
            and commission_rule.effective_at <= accrual.occurred_at
            and (commission_rule.retired_at is null or accrual.occurred_at < commission_rule.retired_at)
            and accrual.eligible_at = accrual.occurred_at
              + make_interval(days => commission_rule.refund_observation_days)) as evidence_valid`,
        ),
      )
      .where({
        'accrual.beneficiary_channel_id': input.beneficiaryChannelId,
        'accrual.currency': input.currency,
      })
      .where('accrual.occurred_at', '>=', input.periodStart)
      .where('accrual.occurred_at', '<', input.periodEnd)
      .where('accrual.occurred_at', '<', input.cutoffAt)
      .where('accrual.eligible_at', '<=', input.cutoffAt)
      .whereNull('occupied_item.commission_settlement_item_id')
      .orderBy('accrual.occurred_at', 'asc')
      .orderBy('accrual.commission_accrual_id', 'asc')
      .forUpdate('accrual')) as AccrualCandidateRow[];

    return rows.filter((row) => {
      if (!row.evidence_valid) throw new CommissionSettlementEvidenceInvalidError();
      const amount = safeInteger(row.commission_amount_minor, 'Commission Accrual amount');
      const reversed = safeInteger(
        row.reversed_amount_before_cutoff,
        'Commission reversed amount before cutoff',
      );
      if (reversed < 0 || reversed > amount) {
        throw new CommissionSettlementEvidenceInvalidError();
      }
      if (reversed > 0 && reversed < amount) {
        throw new CommissionSettlementEvidenceInvalidError(
          'Partial Commission reversal settlement is not authorized.',
        );
      }
      return reversed === 0;
    });
  }

  private async loadReversalCandidates(
    transaction: Knex.Transaction,
    input: CreateCommissionSettlementRecord,
  ): Promise<ReversalCandidateRow[]> {
    const rows = (await transaction('control_plane.commission_reversals as reversal')
      .join(
        'control_plane.commission_accruals as accrual',
        'accrual.commission_accrual_id',
        'reversal.commission_accrual_id',
      )
      .join(
        'control_plane.payment_events as reversal_event',
        'reversal_event.payment_event_id',
        'reversal.source_payment_event_id',
      )
      .join(
        'control_plane.payment_events as accrual_event',
        'accrual_event.payment_event_id',
        'accrual.source_payment_event_id',
      )
      .join(
        'control_plane.commission_rule_versions as commission_rule',
        'commission_rule.commission_rule_version_id',
        'accrual.commission_rule_version_id',
      )
      .join(
        'control_plane.commission_settlement_items as settled_accrual_item',
        'settled_accrual_item.commission_accrual_id',
        'accrual.commission_accrual_id',
      )
      .leftJoin(
        'control_plane.commission_settlement_items as occupied_item',
        'occupied_item.commission_reversal_id',
        'reversal.commission_reversal_id',
      )
      .select(
        'reversal.commission_reversal_id',
        'reversal.commission_accrual_id',
        'reversal.source_payment_event_id',
        'accrual.beneficiary_channel_id',
        'reversal.currency',
        'reversal.reversal_type',
        'reversal.amount_minor',
        'reversal.occurred_at',
        'reversal.reversal_digest',
        transaction.raw(
          `(reversal_event.payment_mode = 'TEST'
            and reversal_event.event_type in ('refund_succeeded', 'chargeback_succeeded')
            and reversal_event.processing_status = 'applied'
            and reversal_event.currency = reversal.currency
            and accrual_event.payment_mode = 'TEST'
            and accrual_event.event_type = 'payment_succeeded'
            and accrual_event.processing_status = 'applied'
            and commission_rule.payment_mode = 'TEST'
            and commission_rule.status in ('ACTIVE', 'RETIRED')
            and commission_rule.currency = reversal.currency
            and commission_rule.effective_at <= accrual.occurred_at
            and (commission_rule.retired_at is null or accrual.occurred_at < commission_rule.retired_at)
            and accrual.eligible_at = accrual.occurred_at
              + make_interval(days => commission_rule.refund_observation_days)) as evidence_valid`,
        ),
      )
      .where({
        'accrual.beneficiary_channel_id': input.beneficiaryChannelId,
        'reversal.currency': input.currency,
        'settled_accrual_item.entry_type': 'accrual',
      })
      .where('reversal.occurred_at', '>=', input.periodStart)
      .where('reversal.occurred_at', '<', input.periodEnd)
      .where('reversal.occurred_at', '<', input.cutoffAt)
      .whereNull('occupied_item.commission_settlement_item_id')
      .orderBy('reversal.occurred_at', 'asc')
      .orderBy('reversal.commission_reversal_id', 'asc')
      .forUpdate('reversal')) as ReversalCandidateRow[];

    for (const row of rows) {
      if (!row.evidence_valid) throw new CommissionSettlementEvidenceInvalidError();
      const amount = safeInteger(row.amount_minor, 'Commission Reversal amount');
      if (amount <= 0) throw new CommissionSettlementEvidenceInvalidError();
    }
    return rows;
  }

  private buildItems(
    settlementId: string,
    input: CreateCommissionSettlementRecord,
    accruals: AccrualCandidateRow[],
    reversals: ReversalCandidateRow[],
  ): SettlementItemInsert[] {
    const facts = [
      ...accruals.map((row) => ({
        type: 'accrual' as const,
        id: row.commission_accrual_id,
        occurredAt: iso(row.occurred_at),
        row,
      })),
      ...reversals.map((row) => ({
        type: 'reversal' as const,
        id: row.commission_reversal_id,
        occurredAt: iso(row.occurred_at),
        row,
      })),
    ].sort((left, right) =>
      left.occurredAt === right.occurredAt
        ? left.id.localeCompare(right.id)
        : left.occurredAt.localeCompare(right.occurredAt),
    );

    return facts.map((fact) => {
      const itemId = this.newId('settlementItem');
      if (fact.type === 'accrual') {
        const amount = safeInteger(
          fact.row.commission_amount_minor,
          'Commission Settlement Accrual amount',
        );
        const snapshot = {
          schemaVersion: 'commission-settlement-item.v1',
          fixture: 'TEST_NON_QUOTE',
          paymentMode: input.paymentMode,
          entryType: 'accrual',
          sourceId: fact.row.commission_accrual_id,
          sourcePaymentEventId: fact.row.source_payment_event_id,
          sourceOccurredAt: fact.occurredAt,
          beneficiaryChannelId: fact.row.beneficiary_channel_id,
          currency: fact.row.currency,
          amountMinor: amount,
          eligibleAt: iso(fact.row.eligible_at),
          commissionRuleVersionId: fact.row.commission_rule_version_id,
          calculationDigest: fact.row.calculation_digest,
        };
        return {
          commission_settlement_item_id: itemId,
          commission_settlement_id: settlementId,
          entry_type: 'accrual',
          commission_accrual_id: fact.row.commission_accrual_id,
          commission_reversal_id: null,
          amount_minor: amount,
          currency: fact.row.currency,
          beneficiary_channel_id: fact.row.beneficiary_channel_id,
          source_occurred_at: new Date(fact.row.occurred_at),
          item_snapshot: snapshot,
          item_digest: commissionSettlementSnapshotDigest(snapshot),
          created_at: input.createdAt,
        };
      }

      const amount = safeInteger(fact.row.amount_minor, 'Commission Settlement Reversal amount');
      const snapshot = {
        schemaVersion: 'commission-settlement-item.v1',
        fixture: 'TEST_NON_QUOTE',
        paymentMode: input.paymentMode,
        entryType: 'reversal',
        sourceId: fact.row.commission_reversal_id,
        sourcePaymentEventId: fact.row.source_payment_event_id,
        sourceOccurredAt: fact.occurredAt,
        beneficiaryChannelId: fact.row.beneficiary_channel_id,
        currency: fact.row.currency,
        amountMinor: -amount,
        commissionAccrualId: fact.row.commission_accrual_id,
        reversalType: fact.row.reversal_type,
        reversalDigest: fact.row.reversal_digest,
      };
      return {
        commission_settlement_item_id: itemId,
        commission_settlement_id: settlementId,
        entry_type: 'reversal',
        commission_accrual_id: null,
        commission_reversal_id: fact.row.commission_reversal_id,
        amount_minor: -amount,
        currency: fact.row.currency,
        beneficiary_channel_id: fact.row.beneficiary_channel_id,
        source_occurred_at: new Date(fact.row.occurred_at),
        item_snapshot: snapshot,
        item_digest: commissionSettlementSnapshotDigest(snapshot),
        created_at: input.createdAt,
      };
    });
  }

  private totals(items: SettlementItemInsert[]) {
    let grossAccrualAmountMinor = 0;
    let grossReversalAmountMinor = 0;
    let accrualItemCount = 0;
    let reversalItemCount = 0;
    for (const item of items) {
      if (item.entry_type === 'accrual') {
        grossAccrualAmountMinor = sumSafe(
          grossAccrualAmountMinor,
          item.amount_minor,
          'Commission Settlement gross Accrual amount',
        );
        accrualItemCount += 1;
      } else {
        grossReversalAmountMinor = sumSafe(
          grossReversalAmountMinor,
          -item.amount_minor,
          'Commission Settlement gross Reversal amount',
        );
        reversalItemCount += 1;
      }
    }
    const netAmountMinor = sumSafe(
      grossAccrualAmountMinor,
      -grossReversalAmountMinor,
      'Commission Settlement net amount',
    );
    return {
      grossAccrualAmountMinor,
      grossReversalAmountMinor,
      netAmountMinor,
      accrualItemCount,
      reversalItemCount,
      itemCount: items.length,
    };
  }

  private async project(
    transaction: Knex.Transaction,
    row: SettlementRow,
  ): Promise<CommissionSettlementDraft> {
    const totals = (await transaction('control_plane.commission_settlement_items')
      .where({ commission_settlement_id: row.commission_settlement_id })
      .select(
        transaction.raw(
          `coalesce(sum(case when entry_type = 'accrual' then amount_minor else 0 end), 0)
             as gross_accrual_amount_minor`,
        ),
        transaction.raw(
          `coalesce(sum(case when entry_type = 'reversal' then -amount_minor else 0 end), 0)
             as gross_reversal_amount_minor`,
        ),
        transaction.raw(`count(*) filter (where entry_type = 'accrual') as accrual_item_count`),
        transaction.raw(`count(*) filter (where entry_type = 'reversal') as reversal_item_count`),
        transaction.raw('count(*) as item_count'),
      )
      .first()) as SettlementTotalsRow | undefined;
    if (!totals) throw new Error('Commission Settlement totals query returned no row.');
    return this.fromRow(row, totals);
  }

  private fromRow(row: SettlementRow, totals: SettlementTotalsRow): CommissionSettlementDraft {
    if (row.status !== 'draft') {
      throw new CommissionSettlementEvidenceInvalidError(
        'The idempotent Commission Settlement is no longer a draft.',
      );
    }
    const grossAccrualAmountMinor = safeInteger(
      totals.gross_accrual_amount_minor,
      'Commission Settlement gross Accrual amount',
    );
    const grossReversalAmountMinor = safeInteger(
      totals.gross_reversal_amount_minor,
      'Commission Settlement gross Reversal amount',
    );
    return {
      commissionSettlementId: row.commission_settlement_id,
      paymentMode: 'TEST',
      beneficiaryChannelId: row.beneficiary_channel_id,
      currency: row.currency,
      periodStart: dateOnly(row.period_start),
      periodEnd: dateOnly(row.period_end),
      cutoffAt: iso(row.cutoff_at),
      status: 'draft',
      grossAccrualAmountMinor,
      grossReversalAmountMinor,
      netAmountMinor: sumSafe(
        grossAccrualAmountMinor,
        -grossReversalAmountMinor,
        'Commission Settlement net amount',
      ),
      accrualItemCount: safeInteger(
        totals.accrual_item_count,
        'Commission Settlement Accrual Item count',
      ),
      reversalItemCount: safeInteger(
        totals.reversal_item_count,
        'Commission Settlement Reversal Item count',
      ),
      itemCount: safeInteger(totals.item_count, 'Commission Settlement Item count'),
      createdAt: iso(row.created_at),
    };
  }

  private async findByIdempotencyKey(
    transaction: Knex.Transaction,
    idempotencyKey: string,
    lock: boolean,
  ): Promise<SettlementRow | undefined> {
    let query = transaction('control_plane.commission_settlements').where({
      idempotency_key: idempotencyKey,
    });
    if (lock) query = query.forUpdate();
    return (await query.first()) as SettlementRow | undefined;
  }

  private async findByPeriod(
    transaction: Knex.Transaction,
    input: CreateCommissionSettlementRecord,
    lock: boolean,
  ): Promise<SettlementRow | undefined> {
    let query = transaction('control_plane.commission_settlements').where({
      beneficiary_channel_id: input.beneficiaryChannelId,
      currency: input.currency,
      period_start: input.periodStart,
      period_end: input.periodEnd,
    });
    if (lock) query = query.forUpdate();
    return (await query.first()) as SettlementRow | undefined;
  }
}
