import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.auth_sessions
      add column rotation_due_at timestamptz,
      add column rotated_from_session_id uuid references control_plane.auth_sessions(session_id) on delete set null,
      add column replaced_by_session_id uuid references control_plane.auth_sessions(session_id) on delete set null;

    update control_plane.auth_sessions
      set rotation_due_at = least(expires_at, created_at + interval '30 minutes');

    alter table control_plane.auth_sessions
      alter column rotation_due_at set not null;

    create index auth_sessions_user_tenant_active_idx
      on control_plane.auth_sessions (user_id, tenant_id, expires_at)
      where revoked_at is null;
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop index if exists control_plane.auth_sessions_user_tenant_active_idx;
    alter table control_plane.auth_sessions
      drop column if exists replaced_by_session_id,
      drop column if exists rotated_from_session_id,
      drop column if exists rotation_due_at;
  `);
}
