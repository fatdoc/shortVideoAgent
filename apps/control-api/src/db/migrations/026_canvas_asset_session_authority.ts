import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.canvas_asset_records)
        or exists (select 1 from control_plane.high_cost_command_approvals) then
        raise exception 'canvas asset session migration blocked: unbound authority evidence exists';
      end if;
    end;
    $$;

    alter table control_plane.canvas_entries
      add constraint canvas_entries_id_grant_package_scope_uq
        unique (canvas_entry_id, grant_id, package_id, project_id, tenant_id);

    create table control_plane.canvas_asset_sessions (
      canvas_session_id text primary key
        check (canvas_session_id ~ '^pcs_[A-Za-z0-9_-]{24,128}$'),
      canvas_entry_id uuid not null unique,
      grant_id uuid not null,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      package_id uuid not null,
      actor_id uuid not null references control_plane.users(user_id),
      registered_at timestamptz not null,
      expires_at timestamptz not null,
      unique (tenant_id, project_id, package_id, canvas_session_id, actor_id),
      constraint canvas_asset_sessions_entry_scope_fk
        foreign key (canvas_entry_id, grant_id, package_id, project_id, tenant_id)
        references control_plane.canvas_entries(
          canvas_entry_id, grant_id, package_id, project_id, tenant_id
        ),
      constraint canvas_asset_sessions_grant_scope_fk
        foreign key (grant_id, package_id, project_id, tenant_id)
        references control_plane.project_grants(grant_id, package_id, project_id, tenant_id),
      constraint canvas_asset_sessions_package_scope_fk
        foreign key (package_id, project_id, tenant_id)
        references control_plane.production_packages(package_id, project_id, tenant_id),
      constraint canvas_asset_sessions_window_ck check (registered_at < expires_at)
    );

    create index canvas_asset_sessions_exact_scope_idx
      on control_plane.canvas_asset_sessions
      (tenant_id, project_id, package_id, canvas_session_id, actor_id, expires_at);

    alter table control_plane.canvas_asset_records
      add constraint canvas_asset_records_session_authority_fk
        foreign key (
          tenant_id,
          project_id,
          package_id,
          canvas_session_id,
          declared_by_actor_id
        ) references control_plane.canvas_asset_sessions(
          tenant_id,
          project_id,
          package_id,
          canvas_session_id,
          actor_id
        );

    alter table control_plane.high_cost_command_approvals
      add constraint high_cost_approvals_session_authority_fk
        foreign key (tenant_id, project_id, package_id, canvas_session_id, actor_id)
        references control_plane.canvas_asset_sessions(
          tenant_id,
          project_id,
          package_id,
          canvas_session_id,
          actor_id
        );

    create function control_plane.protect_canvas_asset_session_authority()
      returns trigger language plpgsql as $$
      begin
        raise exception 'canvas asset session authority is immutable';
      end;
    $$;

    create trigger canvas_asset_sessions_immutable
      before update or delete on control_plane.canvas_asset_sessions
      for each row execute function control_plane.protect_canvas_asset_session_authority();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.canvas_asset_sessions) then
        raise exception 'canvas asset session rollback blocked: authority evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists canvas_asset_sessions_immutable
      on control_plane.canvas_asset_sessions;
    drop function if exists control_plane.protect_canvas_asset_session_authority();
    alter table control_plane.high_cost_command_approvals
      drop constraint if exists high_cost_approvals_session_authority_fk;
    alter table control_plane.canvas_asset_records
      drop constraint if exists canvas_asset_records_session_authority_fk;
    drop table control_plane.canvas_asset_sessions;
    alter table control_plane.canvas_entries
      drop constraint if exists canvas_entries_id_grant_package_scope_uq;
  `);
}
