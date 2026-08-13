import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.canvas_entries (
      canvas_entry_id uuid primary key,
      handle text not null unique
        check (handle ~ '^ce_[A-Za-z0-9_-]{32,64}$'),
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      package_id uuid not null,
      grant_id uuid not null,
      idempotency_key text not null
        check (
          length(idempotency_key) between 1 and 200
          and idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
        ),
      request_digest text not null
        check (request_digest ~ '^sha256:[a-f0-9]{64}$'),
      state text not null default 'active'
        check (state in ('active', 'consumed', 'expired')),
      issued_at timestamptz not null,
      expires_at timestamptz not null,
      consumed_at timestamptz,
      created_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      constraint canvas_entries_validity_ck check (
        issued_at + interval '30 seconds' <= expires_at
        and expires_at <= issued_at + interval '5 minutes'
      ),
      constraint canvas_entries_lifecycle_ck check (
        (state = 'active' and consumed_at is null)
        or (
          state = 'consumed'
          and consumed_at is not null
          and consumed_at >= issued_at
          and consumed_at < expires_at
        )
        or (state = 'expired' and consumed_at is null)
      ),
      constraint canvas_entries_project_idempotency_uq
        unique (tenant_id, project_id, idempotency_key),
      constraint canvas_entries_id_project_tenant_uq
        unique (canvas_entry_id, project_id, tenant_id),
      constraint canvas_entries_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      constraint canvas_entries_package_project_tenant_fk
        foreign key (package_id, project_id, tenant_id)
        references control_plane.production_packages(package_id, project_id, tenant_id),
      constraint canvas_entries_grant_project_tenant_fk
        foreign key (grant_id, project_id, tenant_id)
        references control_plane.project_grants(grant_id, project_id, tenant_id)
    );

    create index canvas_entries_scope_state_expiry_idx
      on control_plane.canvas_entries
      (tenant_id, project_id, package_id, state, expires_at);
    create index canvas_entries_grant_idx
      on control_plane.canvas_entries (tenant_id, project_id, grant_id);

    create function control_plane.protect_canvas_entry_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'canvas entry lifecycle is immutable';
        end if;

        if new.canvas_entry_id is distinct from old.canvas_entry_id
          or new.handle is distinct from old.handle
          or new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.package_id is distinct from old.package_id
          or new.grant_id is distinct from old.grant_id
          or new.idempotency_key is distinct from old.idempotency_key
          or new.request_digest is distinct from old.request_digest
          or new.issued_at is distinct from old.issued_at
          or new.expires_at is distinct from old.expires_at
          or new.created_by is distinct from old.created_by
          or new.created_at is distinct from old.created_at then
          raise exception 'canvas entry scope is immutable';
        end if;

        if old.state <> 'active'
          or new.state not in ('consumed', 'expired') then
          raise exception 'canvas entry lifecycle transition is invalid';
        end if;

        return new;
      end;
    $$;

    create trigger canvas_entries_lifecycle_immutable
      before update or delete on control_plane.canvas_entries
      for each row execute function control_plane.protect_canvas_entry_lifecycle();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.canvas_entries) then
        raise exception 'canvas entry lifecycle rollback blocked: lifecycle evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists canvas_entries_lifecycle_immutable
      on control_plane.canvas_entries;
    drop function if exists control_plane.protect_canvas_entry_lifecycle();
    drop table if exists control_plane.canvas_entries;
  `);
}
