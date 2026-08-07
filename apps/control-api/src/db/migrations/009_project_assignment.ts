import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.projects
      add constraint projects_project_tenant_uq
      unique (project_id, tenant_id);

    alter table control_plane.tenants
      add constraint tenants_tenant_organization_uq
      unique (tenant_id, organization_id);

    alter table control_plane.organization_memberships
      add constraint organization_memberships_membership_organization_uq
      unique (membership_id, organization_id);

    create table control_plane.project_assignment_backfill_runs (
      backfill_run_id uuid primary key,
      manifest_id text not null unique check (length(btrim(manifest_id)) > 0),
      manifest_digest text not null unique check (
        manifest_digest ~ '^sha256:[0-9a-f]{64}$'
      ),
      manifest_version integer not null check (manifest_version = 1),
      assignment_count integer not null check (assignment_count > 0),
      tenant_id uuid not null,
      organization_id uuid not null,
      approved_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      constraint project_assignment_backfill_runs_tenant_organization_fk
        foreign key (tenant_id, organization_id)
        references control_plane.tenants(tenant_id, organization_id),
      constraint project_assignment_backfill_runs_identity_scope_uq
        unique (backfill_run_id, tenant_id, organization_id)
    );

    create table control_plane.project_assignments (
      project_assignment_id uuid primary key,
      project_id uuid not null,
      membership_id uuid not null,
      tenant_id uuid not null,
      organization_id uuid not null,
      access_level text not null check (access_level in ('viewer', 'editor')),
      status text not null check (status in ('active', 'suspended', 'revoked')),
      assignment_source text not null check (
        assignment_source in ('manual', 'pilot_backfill')
      ),
      backfill_run_id uuid,
      created_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      revoked_at timestamptz,
      constraint project_assignments_project_membership_uq
        unique (project_id, membership_id),
      constraint project_assignments_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      constraint project_assignments_tenant_organization_fk
        foreign key (tenant_id, organization_id)
        references control_plane.tenants(tenant_id, organization_id),
      constraint project_assignments_membership_organization_fk
        foreign key (membership_id, organization_id)
        references control_plane.organization_memberships(membership_id, organization_id),
      constraint project_assignments_backfill_scope_fk
        foreign key (backfill_run_id, tenant_id, organization_id)
        references control_plane.project_assignment_backfill_runs(
          backfill_run_id,
          tenant_id,
          organization_id
        ),
      constraint project_assignments_source_backfill_ck check (
        (assignment_source = 'manual' and backfill_run_id is null)
        or
        (assignment_source = 'pilot_backfill' and backfill_run_id is not null)
      ),
      constraint project_assignments_revoked_at_ck check (
        (status = 'revoked' and revoked_at is not null)
        or
        (status <> 'revoked' and revoked_at is null)
      )
    );

    create index project_assignments_active_membership_idx
      on control_plane.project_assignments (membership_id, project_id)
      where status = 'active';
    create index project_assignments_active_project_idx
      on control_plane.project_assignments (project_id, membership_id)
      where status = 'active';

    create function control_plane.enforce_project_assignment_membership()
      returns trigger language plpgsql as $$
      begin
        if not exists (
          select 1
          from control_plane.organization_memberships membership
          join control_plane.organization_membership_roles membership_role
            on membership_role.membership_id = membership.membership_id
          join control_plane.organizations organization
            on organization.organization_id = membership.organization_id
          where membership.membership_id = new.membership_id
            and membership.organization_id = new.organization_id
            and membership.status = 'active'
            and membership_role.role_code = 'content_operator'
            and organization.organization_type = 'TENANT'
        ) then
          raise exception 'project assignment requires an active TENANT content_operator membership';
        end if;
        return new;
      end;
      $$;

    create trigger project_assignments_membership_guard
      before insert on control_plane.project_assignments
      for each row execute function control_plane.enforce_project_assignment_membership();

    create function control_plane.protect_project_assignment_history()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'project assignment history cannot be deleted';
        end if;

        if new.project_assignment_id is distinct from old.project_assignment_id
          or new.project_id is distinct from old.project_id
          or new.membership_id is distinct from old.membership_id
          or new.tenant_id is distinct from old.tenant_id
          or new.organization_id is distinct from old.organization_id then
          raise exception 'project assignment scope is immutable';
        end if;

        if new.assignment_source is distinct from old.assignment_source
          or new.backfill_run_id is distinct from old.backfill_run_id then
          raise exception 'project assignment source is immutable';
        end if;

        if new.created_by is distinct from old.created_by
          or new.created_at is distinct from old.created_at then
          raise exception 'project assignment creator audit fields are immutable';
        end if;

        if old.status = 'revoked' then
          if new.status <> 'revoked' then
            raise exception 'revoked project assignment is terminal';
          end if;
          if new.access_level is distinct from old.access_level then
            raise exception 'revoked project assignment access level is immutable';
          end if;
          if new.revoked_at is distinct from old.revoked_at then
            raise exception 'revoked project assignment timestamp is immutable';
          end if;
        elsif old.status = 'active' and new.status not in ('active', 'suspended', 'revoked') then
          raise exception 'invalid project assignment status transition from active';
        elsif old.status = 'suspended' and new.status not in ('active', 'suspended', 'revoked') then
          raise exception 'invalid project assignment status transition from suspended';
        end if;

        new.updated_at = now();
        return new;
      end;
      $$;

    create trigger project_assignments_history_guard
      before update or delete on control_plane.project_assignments
      for each row execute function control_plane.protect_project_assignment_history();

    create function control_plane.reject_project_assignment_backfill_run_mutation()
      returns trigger language plpgsql as $$
      begin
        raise exception 'project assignment backfill evidence is immutable';
      end;
      $$;

    create trigger project_assignment_backfill_runs_immutable
      before update or delete on control_plane.project_assignment_backfill_runs
      for each row execute function control_plane.reject_project_assignment_backfill_run_mutation();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop trigger if exists project_assignments_history_guard
      on control_plane.project_assignments;
    drop function if exists control_plane.protect_project_assignment_history();

    drop trigger if exists project_assignments_membership_guard
      on control_plane.project_assignments;
    drop function if exists control_plane.enforce_project_assignment_membership();

    drop trigger if exists project_assignment_backfill_runs_immutable
      on control_plane.project_assignment_backfill_runs;
    drop function if exists control_plane.reject_project_assignment_backfill_run_mutation();

    drop table if exists control_plane.project_assignments;
    drop table if exists control_plane.project_assignment_backfill_runs;

    alter table if exists control_plane.organization_memberships
      drop constraint if exists organization_memberships_membership_organization_uq;
    alter table if exists control_plane.tenants
      drop constraint if exists tenants_tenant_organization_uq;
    alter table if exists control_plane.projects
      drop constraint if exists projects_project_tenant_uq;
  `);
}
