import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import {
  ProductionAuthorityResourceNotFoundError,
  verifyProductionPackageAuthority,
} from '../production/authority.js';
import { ProductionDomainError } from '../production/errors.js';
import { canvasEntryError, CanvasEntryDomainError } from './errors.js';
import {
  assertNonSecretBrowserPayload,
  parseCanvasEntryHandle,
  parseCanvasEntryPublicDto,
  parseCanvasEntryUuid,
  parseCreateCanvasEntryCommand,
} from './parser.js';
import type {
  CanvasEntryPublicDto,
  CanvasEntryStore,
  ConsumedCanvasEntryAuthorization,
  ConsumeCanvasEntryRecord,
  CreateCanvasEntryRecord,
  CreateCanvasEntryResult,
  ReadCanvasEntryRecord,
} from './types.js';

type CanvasEntryRow = {
  canvas_entry_id: string;
  handle: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  grant_id: string;
  idempotency_key: string;
  request_digest: string;
  state: 'active' | 'consumed' | 'expired';
  issued_at: Date | string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  created_by: string;
};

type PublicCanvasEntryRow = Pick<
  CanvasEntryRow,
  'handle' | 'tenant_id' | 'project_id' | 'package_id' | 'state' | 'issued_at' | 'expires_at'
>;

type AuthorityVerifier = typeof verifyProductionPackageAuthority;

type CreateTransactionOutcome =
  | { kind: 'created'; value: CanvasEntryPublicDto }
  | { kind: 'replayed'; value: CanvasEntryPublicDto }
  | { kind: 'expired' };

type ConsumeTransactionOutcome =
  { kind: 'consumed'; row: CanvasEntryRow } | { kind: 'expired' } | { kind: 'replayed' };

const createRecordKeys = new Set([
  'tenantId',
  'projectId',
  'packageId',
  'handle',
  'idempotencyKey',
  'requestDigest',
  'issuedAt',
  'expiresAt',
  'createdBy',
]);

function iso(value: Date | string): string {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) {
    throw canvasEntryError('CANVAS_ENTRY_SCHEMA_INVALID', 'Canvas Entry timestamp is invalid.');
  }
  return parsed.toISOString();
}

function publicEntryFromRow(row: PublicCanvasEntryRow): CanvasEntryPublicDto {
  return parseCanvasEntryPublicDto({
    objectType: 'CanvasEntry',
    contractVersion: '0.2',
    handle: row.handle,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    packageId: row.package_id,
    state: 'active',
    issuedAt: iso(row.issued_at),
    expiresAt: iso(row.expires_at),
  });
}

function validateCreateRecord(input: CreateCanvasEntryRecord): void {
  assertNonSecretBrowserPayload(input);
  if (
    Object.keys(input).length !== createRecordKeys.size ||
    Object.keys(input).some((key) => !createRecordKeys.has(key))
  ) {
    throw canvasEntryError(
      'CANVAS_ENTRY_SCHEMA_INVALID',
      'Canvas Entry record fields are invalid.',
    );
  }
  parseCreateCanvasEntryCommand({
    tenantId: input.tenantId,
    projectId: input.projectId,
    packageId: input.packageId,
    idempotencyKey: input.idempotencyKey,
    ttlSeconds: (input.expiresAt.getTime() - input.issuedAt.getTime()) / 1000,
  });
  parseCanvasEntryHandle(input.handle);
  parseCanvasEntryUuid(input.createdBy);
  if (!/^sha256:[a-f0-9]{64}$/.test(input.requestDigest)) {
    throw canvasEntryError(
      'CANVAS_ENTRY_SCHEMA_INVALID',
      'Canvas Entry request digest is invalid.',
    );
  }
  publicEntryFromRow({
    handle: input.handle,
    tenant_id: input.tenantId,
    project_id: input.projectId,
    package_id: input.packageId,
    state: 'active',
    issued_at: input.issuedAt,
    expires_at: input.expiresAt,
  });
}

function isKnownAuthorityFailure(error: unknown): boolean {
  return (
    error instanceof ProductionAuthorityResourceNotFoundError ||
    error instanceof ProductionDomainError
  );
}

function expiredError(): CanvasEntryDomainError {
  return canvasEntryError(
    'CANVAS_ENTRY_EXPIRED',
    'Canvas Entry or its Package/Grant authorization is no longer active.',
  );
}

async function expireActiveEntry(
  transaction: Knex.Transaction,
  canvasEntryId: string,
): Promise<void> {
  await transaction('control_plane.canvas_entries')
    .where({ canvas_entry_id: canvasEntryId, state: 'active' })
    .update({ state: 'expired', consumed_at: null });
}

async function findExactActiveGrant(
  transaction: Knex.Transaction,
  input: {
    tenantId: string;
    projectId: string;
    packageId: string;
    checkedAt: Date;
    coversUntil: Date | string;
    grantId?: string;
  },
): Promise<{ grant_id: string } | undefined> {
  const query = transaction('control_plane.project_grants')
    .select('grant_id')
    .where({
      tenant_id: input.tenantId,
      project_id: input.projectId,
      package_id: input.packageId,
      status: 'active',
      revoked_at: null,
    })
    .where('issued_at', '<=', input.checkedAt)
    .where('expires_at', '>', input.checkedAt)
    .where('expires_at', '>=', input.coversUntil)
    .forShare()
    .limit(2);
  if (input.grantId) query.andWhere('grant_id', input.grantId);
  const rows = (await query) as { grant_id: string }[];
  return rows.length === 1 ? rows[0] : undefined;
}

export class PostgresCanvasEntryRepository implements CanvasEntryStore {
  constructor(
    private readonly database: Knex,
    private readonly newId: () => string = () => randomUUID(),
    private readonly authorityVerifier: AuthorityVerifier = verifyProductionPackageAuthority,
  ) {}

  async createEntry(input: CreateCanvasEntryRecord): Promise<CreateCanvasEntryResult> {
    validateCreateRecord(input);
    try {
      const outcome = await this.database.transaction<CreateTransactionOutcome>(
        async (transaction) => {
          await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [
            `canvas-entry:create:${input.tenantId}:${input.projectId}:${input.idempotencyKey}`,
          ]);
          const existing = (await transaction('control_plane.canvas_entries')
            .where({
              tenant_id: input.tenantId,
              project_id: input.projectId,
              idempotency_key: input.idempotencyKey,
            })
            .forUpdate()
            .first()) as CanvasEntryRow | undefined;
          if (existing) {
            if (existing.request_digest !== input.requestDigest) {
              throw canvasEntryError(
                'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT',
                'Canvas Entry idempotency key conflicts with immutable request facts.',
              );
            }
            if (existing.state === 'consumed') {
              throw canvasEntryError('CANVAS_ENTRY_REPLAYED', 'Canvas Entry was already consumed.');
            }
            if (
              existing.state === 'expired' ||
              new Date(existing.expires_at).getTime() <= input.issuedAt.getTime()
            ) {
              await expireActiveEntry(transaction, existing.canvas_entry_id);
              return { kind: 'expired' };
            }
            try {
              await this.authorityVerifier(transaction, {
                tenantId: existing.tenant_id,
                projectId: existing.project_id,
                packageId: existing.package_id,
                now: input.issuedAt,
              });
            } catch (error) {
              if (!isKnownAuthorityFailure(error)) throw error;
              await expireActiveEntry(transaction, existing.canvas_entry_id);
              return { kind: 'expired' };
            }
            const grant = await findExactActiveGrant(transaction, {
              tenantId: existing.tenant_id,
              projectId: existing.project_id,
              packageId: existing.package_id,
              grantId: existing.grant_id,
              checkedAt: input.issuedAt,
              coversUntil: existing.expires_at,
            });
            if (!grant) {
              await expireActiveEntry(transaction, existing.canvas_entry_id);
              return { kind: 'expired' };
            }
            return { kind: 'replayed', value: publicEntryFromRow(existing) };
          }

          try {
            await this.authorityVerifier(transaction, {
              tenantId: input.tenantId,
              projectId: input.projectId,
              packageId: input.packageId,
              now: input.issuedAt,
            });
          } catch (error) {
            if (error instanceof ProductionAuthorityResourceNotFoundError) {
              throw canvasEntryError(
                'CANVAS_ENTRY_NOT_FOUND',
                'Canvas Entry package or Grant binding is unavailable.',
              );
            }
            if (error instanceof ProductionDomainError) throw expiredError();
            throw error;
          }

          const binding = await findExactActiveGrant(transaction, {
            tenantId: input.tenantId,
            projectId: input.projectId,
            packageId: input.packageId,
            checkedAt: input.issuedAt,
            coversUntil: input.expiresAt,
          });
          if (!binding) {
            throw canvasEntryError(
              'CANVAS_ENTRY_NOT_FOUND',
              'Canvas Entry package or Grant binding is unavailable.',
            );
          }

          const [created] = (await transaction('control_plane.canvas_entries')
            .insert({
              canvas_entry_id: parseCanvasEntryUuid(this.newId()),
              handle: input.handle,
              tenant_id: input.tenantId,
              project_id: input.projectId,
              package_id: input.packageId,
              grant_id: parseCanvasEntryUuid(binding.grant_id),
              idempotency_key: input.idempotencyKey,
              request_digest: input.requestDigest,
              state: 'active',
              issued_at: input.issuedAt,
              expires_at: input.expiresAt,
              consumed_at: null,
              created_by: input.createdBy,
            })
            .returning('*')) as CanvasEntryRow[];
          if (!created) throw new Error('Canvas Entry insert returned no row.');
          return { kind: 'created', value: publicEntryFromRow(created) };
        },
      );
      if (outcome.kind === 'expired') throw expiredError();
      return { value: outcome.value, replayed: outcome.kind === 'replayed' };
    } catch (error) {
      if (error instanceof CanvasEntryDomainError) throw error;
      throw error;
    }
  }

  async readEntry(input: ReadCanvasEntryRecord): Promise<CanvasEntryPublicDto> {
    const handle = parseCanvasEntryHandle(input.handle);
    const tenantId = parseCanvasEntryUuid(input.tenantId);
    const projectId = parseCanvasEntryUuid(input.projectId);
    const readAt = new Date(input.readAt);
    if (!Number.isFinite(readAt.getTime())) {
      throw canvasEntryError('CANVAS_ENTRY_SCHEMA_INVALID', 'Canvas Entry read time is invalid.');
    }

    return this.database.transaction(async (transaction) => {
      const row = (await transaction('control_plane.canvas_entries')
        .where({ handle, tenant_id: tenantId, project_id: projectId })
        .first()) as CanvasEntryRow | undefined;
      if (!row) {
        throw canvasEntryError(
          'CANVAS_ENTRY_NOT_FOUND',
          'Canvas Entry handle or exact scope was not found.',
        );
      }
      if (row.state === 'consumed') {
        throw canvasEntryError('CANVAS_ENTRY_REPLAYED', 'Canvas Entry was already consumed.');
      }
      if (row.state === 'expired' || new Date(row.expires_at).getTime() <= readAt.getTime()) {
        throw expiredError();
      }
      try {
        await this.authorityVerifier(transaction, {
          tenantId: row.tenant_id,
          projectId: row.project_id,
          packageId: row.package_id,
          now: readAt,
        });
      } catch (error) {
        if (isKnownAuthorityFailure(error)) throw expiredError();
        throw error;
      }
      const grant = await findExactActiveGrant(transaction, {
        tenantId: row.tenant_id,
        projectId: row.project_id,
        packageId: row.package_id,
        grantId: row.grant_id,
        checkedAt: readAt,
        coversUntil: row.expires_at,
      });
      if (!grant) throw expiredError();
      return publicEntryFromRow(row);
    });
  }

  async consumeEntry(input: ConsumeCanvasEntryRecord): Promise<ConsumedCanvasEntryAuthorization> {
    const handle = parseCanvasEntryHandle(input.handle);
    const tenantId = parseCanvasEntryUuid(input.tenantId);
    const projectId = parseCanvasEntryUuid(input.projectId);
    const packageId = parseCanvasEntryUuid(input.packageId);
    const consumedAt = new Date(input.consumedAt);
    if (!Number.isFinite(consumedAt.getTime())) {
      throw canvasEntryError(
        'CANVAS_ENTRY_SCHEMA_INVALID',
        'Canvas Entry consume time is invalid.',
      );
    }

    const outcome = await this.database.transaction<ConsumeTransactionOutcome>(
      async (transaction) => {
        const row = (await transaction('control_plane.canvas_entries')
          .where({
            handle,
            tenant_id: tenantId,
            project_id: projectId,
            package_id: packageId,
          })
          .forUpdate()
          .first()) as CanvasEntryRow | undefined;
        if (!row) {
          throw canvasEntryError(
            'CANVAS_ENTRY_NOT_FOUND',
            'Canvas Entry handle or exact scope was not found.',
          );
        }
        if (row.state === 'consumed') return { kind: 'replayed' };
        if (row.state === 'expired' || new Date(row.expires_at).getTime() <= consumedAt.getTime()) {
          await expireActiveEntry(transaction, row.canvas_entry_id);
          return { kind: 'expired' };
        }
        try {
          await this.authorityVerifier(transaction, {
            tenantId: row.tenant_id,
            projectId: row.project_id,
            packageId: row.package_id,
            now: consumedAt,
          });
        } catch (error) {
          if (!isKnownAuthorityFailure(error)) throw error;
          await expireActiveEntry(transaction, row.canvas_entry_id);
          return { kind: 'expired' };
        }
        const grant = await findExactActiveGrant(transaction, {
          tenantId: row.tenant_id,
          projectId: row.project_id,
          packageId: row.package_id,
          grantId: row.grant_id,
          checkedAt: consumedAt,
          coversUntil: row.expires_at,
        });
        if (!grant) {
          await expireActiveEntry(transaction, row.canvas_entry_id);
          return { kind: 'expired' };
        }
        const [consumed] = (await transaction('control_plane.canvas_entries')
          .where({ canvas_entry_id: row.canvas_entry_id, state: 'active' })
          .update({ state: 'consumed', consumed_at: consumedAt })
          .returning('*')) as CanvasEntryRow[];
        if (!consumed) return { kind: 'replayed' };
        return { kind: 'consumed', row: consumed };
      },
    );
    if (outcome.kind === 'expired') throw expiredError();
    if (outcome.kind === 'replayed') {
      throw canvasEntryError('CANVAS_ENTRY_REPLAYED', 'Canvas Entry was already consumed.');
    }
    if (!outcome.row.consumed_at) {
      throw canvasEntryError(
        'CANVAS_ENTRY_SCHEMA_INVALID',
        'Consumed Canvas Entry did not record consumedAt.',
      );
    }
    return {
      handle: outcome.row.handle,
      tenantId: outcome.row.tenant_id,
      projectId: outcome.row.project_id,
      packageId: outcome.row.package_id,
      grantId: outcome.row.grant_id,
      consumedAt: iso(outcome.row.consumed_at),
    };
  }
}
