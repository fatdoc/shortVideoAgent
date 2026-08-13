import type { Knex } from 'knex';
import {
  ProductionAuthorityResourceNotFoundError,
  verifyProductionPackageAuthority,
} from '../production/authority.js';
import { ProductionDomainError } from '../production/errors.js';
import { canvasAssetError, CanvasAssetDomainError } from './errors.js';
import type {
  CanvasAssetSessionAuthority,
  CanvasAssetSessionAuthorityStore,
  CanvasAssetSessionRegistration,
  CanvasAssetSessionScope,
  RegisterCanvasAssetSessionOutcome,
} from './sessionTypes.js';

type EntryAuthorityRow = {
  canvas_entry_id: string;
  handle: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  grant_id: string;
  consumed_at: Date | string | null;
  entry_expires_at: Date | string;
  package_expires_at: Date | string;
  grant_expires_at: Date | string;
};

type SessionRow = {
  canvas_session_id: string;
  canvas_entry_id: string;
  handle: string;
  tenant_id: string;
  project_id: string;
  package_id: string;
  actor_id: string;
  registered_at: Date | string;
  expires_at: Date | string;
};

type AuthorityVerifier = typeof verifyProductionPackageAuthority;

function date(value: Date | string): Date {
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error('Canvas session timestamp is invalid.');
  return result;
}

function valueFromRow(row: SessionRow): CanvasAssetSessionAuthority {
  return {
    handle: row.handle,
    tenantId: row.tenant_id,
    projectId: row.project_id,
    packageId: row.package_id,
    canvasSessionId: row.canvas_session_id,
    actorId: row.actor_id,
    registeredAt: date(row.registered_at),
    expiresAt: date(row.expires_at),
  };
}

function inactive(): CanvasAssetDomainError {
  return canvasAssetError('CANVAS_SESSION_INVALID', 'Canvas session authority is invalid.');
}

function knownInactive(error: unknown): boolean {
  return (
    error instanceof ProductionAuthorityResourceNotFoundError ||
    error instanceof ProductionDomainError
  );
}

export class PostgresCanvasAssetSessionAuthorityRepository
  implements CanvasAssetSessionAuthorityStore
{
  constructor(
    private readonly database: Knex,
    private readonly authorityVerifier: AuthorityVerifier = verifyProductionPackageAuthority,
  ) {}

  async registerSession(
    input: CanvasAssetSessionRegistration & { registeredAt: Date },
  ): Promise<RegisterCanvasAssetSessionOutcome> {
    try {
      return await this.database.transaction(async (transaction) => {
        for (const lock of [
          `canvas-asset-session:entry:${input.handle}`,
          `canvas-asset-session:id:${input.canvasSessionId}`,
        ].sort()) {
          await transaction.raw('select pg_advisory_xact_lock(hashtextextended(?, 0))', [lock]);
        }

        const entry = (await transaction('control_plane.canvas_entries as entry')
          .join('control_plane.production_packages as package', function joinPackage() {
            this.on('package.package_id', '=', 'entry.package_id')
              .andOn('package.project_id', '=', 'entry.project_id')
              .andOn('package.tenant_id', '=', 'entry.tenant_id');
          })
          .join('control_plane.project_grants as grant', function joinGrant() {
            this.on('grant.grant_id', '=', 'entry.grant_id')
              .andOn('grant.package_id', '=', 'entry.package_id')
              .andOn('grant.project_id', '=', 'entry.project_id')
              .andOn('grant.tenant_id', '=', 'entry.tenant_id');
          })
          .select(
            'entry.canvas_entry_id',
            'entry.handle',
            'entry.tenant_id',
            'entry.project_id',
            'entry.package_id',
            'entry.grant_id',
            'entry.consumed_at',
            'entry.expires_at as entry_expires_at',
            'package.expires_at as package_expires_at',
            'grant.expires_at as grant_expires_at',
          )
          .where({
            'entry.handle': input.handle,
            'entry.tenant_id': input.tenantId,
            'entry.project_id': input.projectId,
            'entry.package_id': input.packageId,
            'entry.state': 'consumed',
            'package.status': 'ready',
            'grant.status': 'active',
            'grant.revoked_at': null,
          })
          .where('package.valid_from', '<=', input.registeredAt)
          .where('package.expires_at', '>', input.registeredAt)
          .where('grant.issued_at', '<=', input.registeredAt)
          .where('grant.expires_at', '>', input.registeredAt)
          .forShare('entry')
          .first()) as EntryAuthorityRow | undefined;
        if (
          !entry?.consumed_at ||
          date(entry.consumed_at).getTime() >= date(entry.entry_expires_at).getTime()
        ) {
          throw inactive();
        }

        try {
          await this.authorityVerifier(transaction, {
            tenantId: input.tenantId,
            projectId: input.projectId,
            packageId: input.packageId,
            now: input.registeredAt,
          });
        } catch (error) {
          if (knownInactive(error)) throw inactive();
          throw error;
        }

        const derivedExpiresAt = new Date(
          Math.min(
            date(entry.package_expires_at).getTime(),
            date(entry.grant_expires_at).getTime(),
          ),
        );
        const existing = (await transaction('control_plane.canvas_asset_sessions as session')
          .join('control_plane.canvas_entries as entry', 'entry.canvas_entry_id', 'session.canvas_entry_id')
          .select(
            'session.canvas_session_id',
            'session.canvas_entry_id',
            'entry.handle',
            'session.tenant_id',
            'session.project_id',
            'session.package_id',
            'session.actor_id',
            'session.registered_at',
            'session.expires_at',
          )
          .where('session.canvas_session_id', input.canvasSessionId)
          .orWhere('session.canvas_entry_id', entry.canvas_entry_id)
          .forUpdate('session')) as SessionRow[];
        if (existing.length > 0) {
          const exact = existing.find(
            (row) =>
              row.canvas_session_id === input.canvasSessionId &&
              row.canvas_entry_id === entry.canvas_entry_id &&
              row.handle === input.handle &&
              row.tenant_id === input.tenantId &&
              row.project_id === input.projectId &&
              row.package_id === input.packageId &&
              row.actor_id === input.actorId &&
              date(row.expires_at).getTime() === derivedExpiresAt.getTime(),
          );
          return exact ? { kind: 'replayed', value: valueFromRow(exact) } : { kind: 'conflict' };
        }

        const rows = (await transaction('control_plane.canvas_asset_sessions')
          .insert({
            canvas_session_id: input.canvasSessionId,
            canvas_entry_id: entry.canvas_entry_id,
            grant_id: entry.grant_id,
            tenant_id: input.tenantId,
            project_id: input.projectId,
            package_id: input.packageId,
            actor_id: input.actorId,
            registered_at: input.registeredAt,
            expires_at: derivedExpiresAt,
          })
          .returning('*')) as Array<Omit<SessionRow, 'handle'>>;
        const created = rows[0];
        if (!created) throw new Error('Canvas session registration returned no row.');
        return {
          kind: 'created',
          value: valueFromRow({ ...created, handle: input.handle }),
        };
      });
    } catch (error) {
      if ((error as { code?: string }).code === '23505') return { kind: 'conflict' };
      throw error;
    }
  }

  async readActiveSession(
    input: CanvasAssetSessionScope & { verifiedAt: Date },
  ): Promise<CanvasAssetSessionAuthority | null> {
    return this.database.transaction(async (transaction) => {
      const row = (await transaction('control_plane.canvas_asset_sessions as session')
        .join('control_plane.canvas_entries as entry', 'entry.canvas_entry_id', 'session.canvas_entry_id')
        .join('control_plane.production_packages as package', function joinPackage() {
          this.on('package.package_id', '=', 'session.package_id')
            .andOn('package.project_id', '=', 'session.project_id')
            .andOn('package.tenant_id', '=', 'session.tenant_id');
        })
        .join('control_plane.project_grants as grant', function joinGrant() {
          this.on('grant.grant_id', '=', 'session.grant_id')
            .andOn('grant.package_id', '=', 'session.package_id')
            .andOn('grant.project_id', '=', 'session.project_id')
            .andOn('grant.tenant_id', '=', 'session.tenant_id');
        })
        .select(
          'session.canvas_session_id',
          'session.canvas_entry_id',
          'entry.handle',
          'session.tenant_id',
          'session.project_id',
          'session.package_id',
          'session.actor_id',
          'session.registered_at',
          'session.expires_at',
        )
        .where({
          'session.canvas_session_id': input.canvasSessionId,
          'session.tenant_id': input.tenantId,
          'session.project_id': input.projectId,
          'session.package_id': input.packageId,
          'session.actor_id': input.actorId,
          'entry.state': 'consumed',
          'package.status': 'ready',
          'grant.status': 'active',
          'grant.revoked_at': null,
        })
        .where('session.expires_at', '>', input.verifiedAt)
        .where('package.valid_from', '<=', input.verifiedAt)
        .where('package.expires_at', '>', input.verifiedAt)
        .where('grant.issued_at', '<=', input.verifiedAt)
        .where('grant.expires_at', '>', input.verifiedAt)
        .forShare('session')
        .first()) as SessionRow | undefined;
      if (!row) return null;
      try {
        await this.authorityVerifier(transaction, {
          tenantId: input.tenantId,
          projectId: input.projectId,
          packageId: input.packageId,
          now: input.verifiedAt,
        });
      } catch (error) {
        if (knownInactive(error)) return null;
        throw error;
      }
      return valueFromRow(row);
    });
  }
}
