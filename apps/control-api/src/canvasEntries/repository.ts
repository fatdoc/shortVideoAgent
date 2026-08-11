import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
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

type ReadOutcomeRow = PublicCanvasEntryRow & { binding_active: boolean };

type ConsumeOutcomeRow = CanvasEntryRow & {
  outcome: 'consumed' | 'expired' | 'replayed';
};

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

export class PostgresCanvasEntryRepository implements CanvasEntryStore {
  constructor(
    private readonly database: Knex,
    private readonly newId: () => string = () => randomUUID(),
  ) {}

  async createEntry(input: CreateCanvasEntryRecord): Promise<CreateCanvasEntryResult> {
    validateCreateRecord(input);
    try {
      return await this.database.transaction(async (transaction) => {
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
          return { value: publicEntryFromRow(existing), replayed: true };
        }

        const bindings = await transaction('control_plane.production_packages as package')
          .join('control_plane.project_grants as grant_row', function joinGrant() {
            this.on('grant_row.package_id', '=', 'package.package_id')
              .andOn('grant_row.project_id', '=', 'package.project_id')
              .andOn('grant_row.tenant_id', '=', 'package.tenant_id');
          })
          .select('grant_row.grant_id')
          .where({
            'package.package_id': input.packageId,
            'package.project_id': input.projectId,
            'package.tenant_id': input.tenantId,
            'grant_row.status': 'active',
            'grant_row.revoked_at': null,
          })
          .where('package.valid_from', '<=', input.issuedAt)
          .where('package.expires_at', '>=', input.expiresAt)
          .where('grant_row.issued_at', '<=', input.issuedAt)
          .where('grant_row.expires_at', '>=', input.expiresAt)
          .orderBy('grant_row.issued_at', 'desc')
          .limit(2);
        const binding = bindings.length === 1 ? bindings[0] : undefined;
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
        return { value: publicEntryFromRow(created), replayed: false };
      });
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

    const result = await this.database.raw<{ rows: ReadOutcomeRow[] }>(
      `select entry.handle,
              entry.tenant_id,
              entry.project_id,
              entry.package_id,
              entry.state,
              entry.issued_at,
              entry.expires_at,
              exists (
                select 1
                  from control_plane.production_packages package_row
                  join control_plane.project_grants grant_row
                    on grant_row.package_id = package_row.package_id
                   and grant_row.project_id = package_row.project_id
                   and grant_row.tenant_id = package_row.tenant_id
                 where package_row.package_id = entry.package_id
                   and package_row.project_id = entry.project_id
                   and package_row.tenant_id = entry.tenant_id
                   and grant_row.grant_id = entry.grant_id
                   and grant_row.status = 'active'
                   and grant_row.revoked_at is null
                   and package_row.valid_from <= ?::timestamptz
                   and package_row.expires_at > ?::timestamptz
                   and grant_row.issued_at <= ?::timestamptz
                   and grant_row.expires_at > ?::timestamptz
              ) as binding_active
         from control_plane.canvas_entries entry
        where entry.handle = ?
          and entry.tenant_id = ?
          and entry.project_id = ?
        limit 1`,
      [readAt, readAt, readAt, readAt, handle, tenantId, projectId],
    );
    const row = result.rows[0];
    if (!row) {
      throw canvasEntryError(
        'CANVAS_ENTRY_NOT_FOUND',
        'Canvas Entry handle or exact scope was not found.',
      );
    }
    if (row.state === 'consumed') {
      throw canvasEntryError('CANVAS_ENTRY_REPLAYED', 'Canvas Entry was already consumed.');
    }
    if (
      row.state === 'expired' ||
      new Date(row.expires_at).getTime() <= readAt.getTime() ||
      !row.binding_active
    ) {
      throw canvasEntryError(
        'CANVAS_ENTRY_EXPIRED',
        'Canvas Entry or its Package/Grant authorization is no longer active.',
      );
    }
    return publicEntryFromRow(row);
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

    const result = await this.database.raw<{ rows: ConsumeOutcomeRow[] }>(
      `with target as materialized (
         select entry.*,
                exists (
                  select 1
                    from control_plane.production_packages package
                    join control_plane.project_grants grant_row
                      on grant_row.package_id = package.package_id
                     and grant_row.project_id = package.project_id
                     and grant_row.tenant_id = package.tenant_id
                   where package.package_id = entry.package_id
                     and package.project_id = entry.project_id
                     and package.tenant_id = entry.tenant_id
                     and grant_row.grant_id = entry.grant_id
                     and grant_row.status = 'active'
                     and grant_row.revoked_at is null
                     and package.valid_from <= ?
                     and package.expires_at > ?
                     and grant_row.issued_at <= ?
                     and grant_row.expires_at > ?
                ) as binding_active
           from control_plane.canvas_entries entry
          where entry.handle = ?
            and entry.tenant_id = ?
            and entry.project_id = ?
            and entry.package_id = ?
       ), transition as (
         update control_plane.canvas_entries entry
            set state = case
                          when target.expires_at <= ? or not target.binding_active then 'expired'
                          else 'consumed'
                        end,
                consumed_at = case
                                when target.expires_at <= ? or not target.binding_active then null
                                else ?::timestamptz
                              end
           from target
          where entry.canvas_entry_id = target.canvas_entry_id
            and entry.state = 'active'
        returning entry.*
       ), resolved as (
         select transition.canvas_entry_id,
                transition.handle,
                transition.tenant_id,
                transition.project_id,
                transition.package_id,
                transition.grant_id,
                transition.idempotency_key,
                transition.request_digest,
                transition.state,
                transition.issued_at,
                transition.expires_at,
                transition.consumed_at,
                transition.created_by,
                case when transition.state = 'consumed' then 'consumed' else 'expired' end as outcome
           from transition
         union all
         select target.canvas_entry_id,
                target.handle,
                target.tenant_id,
                target.project_id,
                target.package_id,
                target.grant_id,
                target.idempotency_key,
                target.request_digest,
                target.state,
                target.issued_at,
                target.expires_at,
                target.consumed_at,
                target.created_by,
                case
                  when target.state = 'consumed' then 'replayed'
                  when target.state = 'expired' or target.expires_at <= ? or not target.binding_active
                    then 'expired'
                  else 'replayed'
                end as outcome
           from target
          where not exists (select 1 from transition)
       )
       select * from resolved limit 1`,
      [
        consumedAt,
        consumedAt,
        consumedAt,
        consumedAt,
        handle,
        tenantId,
        projectId,
        packageId,
        consumedAt,
        consumedAt,
        consumedAt,
        consumedAt,
      ],
    );
    const row = result.rows[0];
    if (!row) {
      throw canvasEntryError(
        'CANVAS_ENTRY_NOT_FOUND',
        'Canvas Entry handle or exact scope was not found.',
      );
    }
    if (row.outcome === 'expired') {
      throw canvasEntryError(
        'CANVAS_ENTRY_EXPIRED',
        'Canvas Entry or its Package/Grant authorization is no longer active.',
      );
    }
    if (row.outcome === 'replayed') {
      throw canvasEntryError('CANVAS_ENTRY_REPLAYED', 'Canvas Entry was already consumed.');
    }
    if (!row.consumed_at) {
      throw canvasEntryError(
        'CANVAS_ENTRY_SCHEMA_INVALID',
        'Consumed Canvas Entry did not record consumedAt.',
      );
    }
    return {
      handle: row.handle,
      tenantId: row.tenant_id,
      projectId: row.project_id,
      packageId: row.package_id,
      grantId: row.grant_id,
      consumedAt: iso(row.consumed_at),
    };
  }
}
