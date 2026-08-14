import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.canvas_asset_records
      add constraint canvas_asset_records_materialization_scope_uq
        unique (asset_id, tenant_id, project_id, package_id);

    create table control_plane.canvas_asset_materialization_attempts (
      materialization_attempt_id uuid primary key,
      materialization_id uuid not null unique,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      package_id uuid not null,
      canvas_session_id text not null
        check (canvas_session_id ~ '^pcs_[A-Za-z0-9_-]{24,128}$'),
      actor_id uuid not null references control_plane.users(user_id),
      asset_id uuid not null,
      authority_checksum text not null check (authority_checksum ~ '^sha256:[a-f0-9]{64}$'),
      mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
      byte_size integer not null check (byte_size between 1 and 8388608),
      created_at timestamptz not null,
      constraint canvas_asset_materialization_session_scope_fk
        foreign key (tenant_id, project_id, package_id, canvas_session_id, actor_id)
        references control_plane.canvas_asset_sessions(
          tenant_id, project_id, package_id, canvas_session_id, actor_id
        ),
      constraint canvas_asset_materialization_asset_scope_fk
        foreign key (asset_id, tenant_id, project_id, package_id)
        references control_plane.canvas_asset_records(asset_id, tenant_id, project_id, package_id)
    );

    create index canvas_asset_materialization_scope_idx
      on control_plane.canvas_asset_materialization_attempts
      (tenant_id, project_id, package_id, canvas_session_id, actor_id, asset_id);

    create function control_plane.protect_canvas_asset_materialization_attempt()
      returns trigger language plpgsql as $$
      begin
        raise exception 'canvas asset materialization authority is immutable';
      end;
    $$;

    create trigger canvas_asset_materialization_attempts_immutable
      before update or delete on control_plane.canvas_asset_materialization_attempts
      for each row execute function control_plane.protect_canvas_asset_materialization_attempt();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.canvas_asset_materialization_attempts) then
        raise exception 'canvas asset materialization rollback blocked: authority evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists canvas_asset_materialization_attempts_immutable
      on control_plane.canvas_asset_materialization_attempts;
    drop function if exists control_plane.protect_canvas_asset_materialization_attempt();
    drop table control_plane.canvas_asset_materialization_attempts;
    alter table control_plane.canvas_asset_records
      drop constraint if exists canvas_asset_records_materialization_scope_uq;
  `);
}
