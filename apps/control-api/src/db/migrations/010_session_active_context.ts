import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.organization_memberships
      add constraint organization_memberships_context_uq
      unique (membership_id, user_id, organization_id);

    alter table control_plane.auth_sessions
      alter column tenant_id drop not null,
      add column active_membership_id uuid,
      add column active_organization_id uuid,
      add column membership_version integer;

    update control_plane.auth_sessions session
      set active_membership_id = membership.membership_id,
          active_organization_id = membership.organization_id,
          membership_version = membership.version
    from control_plane.organization_memberships membership
    join control_plane.organizations organization
      on organization.organization_id = membership.organization_id
    join control_plane.tenants tenant
      on tenant.organization_id = membership.organization_id
    join control_plane.users account_user
      on account_user.user_id = membership.user_id
    where session.user_id = membership.user_id
      and session.tenant_id = tenant.tenant_id
      and membership.status = 'active'
      and organization.status = 'active'
      and organization.organization_type = 'TENANT'
      and tenant.status = 'active'
      and account_user.status = 'active';

    update control_plane.auth_sessions
      set revoked_at = now()
      where active_membership_id is null
        and revoked_at is null;

    alter table control_plane.auth_sessions
      add constraint auth_sessions_active_context_complete_ck
        check (
          (
            active_membership_id is null
            and active_organization_id is null
            and membership_version is null
          ) or (
            active_membership_id is not null
            and active_organization_id is not null
            and membership_version is not null
          )
        ),
      add constraint auth_sessions_membership_version_positive_ck
        check (membership_version is null or membership_version > 0),
      add constraint auth_sessions_active_context_fk
        foreign key (active_membership_id, user_id, active_organization_id)
        references control_plane.organization_memberships (
          membership_id,
          user_id,
          organization_id
        );

    create index auth_sessions_user_membership_active_idx
      on control_plane.auth_sessions (user_id, active_membership_id, expires_at)
      where revoked_at is null
        and active_membership_id is not null;

    create function control_plane.enforce_auth_session_active_context()
      returns trigger language plpgsql as $$
      declare
        resolved_organization_type text;
        resolved_membership_version integer;
      begin
        if new.active_membership_id is null then
          return new;
        end if;

        select organization.organization_type, membership.version
          into resolved_organization_type, resolved_membership_version
        from control_plane.organization_memberships membership
        join control_plane.organizations organization
          on organization.organization_id = membership.organization_id
        join control_plane.users account_user
          on account_user.user_id = membership.user_id
        where membership.membership_id = new.active_membership_id
          and membership.user_id = new.user_id
          and membership.organization_id = new.active_organization_id
          and membership.status = 'active'
          and organization.status = 'active'
          and account_user.status = 'active';

        if resolved_organization_type is null then
          raise exception 'auth session requires an active membership context';
        end if;

        if new.membership_version <> resolved_membership_version then
          raise exception 'auth session membership version must match the active membership';
        end if;

        if resolved_organization_type = 'TENANT' then
          if new.tenant_id is null or not exists (
            select 1
            from control_plane.tenants tenant
            where tenant.tenant_id = new.tenant_id
              and tenant.organization_id = new.active_organization_id
              and tenant.status = 'active'
          ) then
            raise exception 'TENANT auth session requires its active Tenant extension';
          end if;
        elsif new.tenant_id is not null then
          raise exception 'non-TENANT auth session cannot carry a Tenant scope';
        end if;

        return new;
      end;
      $$;

    create trigger auth_sessions_active_context_guard
      before insert or update of
        user_id,
        tenant_id,
        active_membership_id,
        active_organization_id,
        membership_version
      on control_plane.auth_sessions
      for each row execute function control_plane.enforce_auth_session_active_context();

    create function control_plane.protect_organization_membership_version()
      returns trigger language plpgsql as $$
      begin
        if new.membership_id is distinct from old.membership_id then
          raise exception 'organization membership identity is immutable';
        end if;

        if new.version < old.version then
          raise exception 'organization membership version cannot decrease';
        end if;

        if new.user_id is distinct from old.user_id
          or new.organization_id is distinct from old.organization_id
          or new.status is distinct from old.status
          or new.primary_role_code is distinct from old.primary_role_code then
          if new.version <= old.version then
            new.version = old.version + 1;
          end if;
          new.updated_at = now();
        end if;

        return new;
      end;
      $$;

    create trigger organization_memberships_version_guard
      before update on control_plane.organization_memberships
      for each row execute function control_plane.protect_organization_membership_version();

    create function control_plane.bump_membership_version_for_role()
      returns trigger language plpgsql as $$
      declare
        role_count integer;
      begin
        if tg_op = 'INSERT' then
          select count(*)
            into role_count
          from control_plane.organization_membership_roles
          where membership_id = new.membership_id;

          if role_count > 1 then
            update control_plane.organization_memberships
              set version = version + 1,
                  updated_at = now()
              where membership_id = new.membership_id;
          end if;
          return new;
        end if;

        if tg_op = 'DELETE' then
          update control_plane.organization_memberships
            set version = version + 1,
                updated_at = now()
            where membership_id = old.membership_id;
          return old;
        end if;

        if new.membership_id is distinct from old.membership_id
          or new.role_code is distinct from old.role_code then
          update control_plane.organization_memberships
            set version = version + 1,
                updated_at = now()
            where membership_id = old.membership_id;

          if new.membership_id is distinct from old.membership_id then
            update control_plane.organization_memberships
              set version = version + 1,
                  updated_at = now()
              where membership_id = new.membership_id;
          end if;
        end if;
        return new;
      end;
      $$;

    create trigger organization_membership_roles_version_guard
      after insert or update or delete
      on control_plane.organization_membership_roles
      for each row execute function control_plane.bump_membership_version_for_role();

    create or replace function control_plane.shadow_legacy_membership()
      returns trigger language plpgsql as $$
      declare
        resolved_organization_id uuid;
      begin
        if tg_op = 'DELETE' then
          delete from control_plane.organization_memberships
          where membership_id = old.membership_id;
          return old;
        end if;

        select organization.organization_id
          into resolved_organization_id
        from control_plane.tenants tenant
        join control_plane.organizations organization
          on organization.organization_id = tenant.organization_id
        where tenant.tenant_id = new.tenant_id
          and organization.organization_type = 'TENANT';

        if resolved_organization_id is null then
          raise exception 'legacy membership tenant must map to a TENANT organization';
        end if;

        if new.role_code = 'pilot_support' then
          raise exception 'legacy pilot_support membership requires an explicit PLATFORM membership';
        end if;

        if tg_op = 'UPDATE' then
          if new.membership_id is distinct from old.membership_id
            or new.user_id is distinct from old.user_id
            or new.tenant_id is distinct from old.tenant_id then
            raise exception 'legacy membership identity and scope are immutable';
          end if;

          update control_plane.organization_memberships
            set status = new.status,
                primary_role_code = new.role_code,
                updated_at = new.updated_at
            where membership_id = old.membership_id;

          delete from control_plane.organization_membership_roles
            where membership_id = old.membership_id
              and role_code <> new.role_code;

          insert into control_plane.organization_membership_roles (
            membership_id,
            role_code,
            created_at
          ) values (
            old.membership_id,
            new.role_code,
            new.created_at
          ) on conflict (membership_id, role_code) do nothing;

          return new;
        end if;

        insert into control_plane.organization_memberships (
          membership_id,
          user_id,
          organization_id,
          status,
          primary_role_code,
          version,
          created_at,
          updated_at
        ) values (
          new.membership_id,
          new.user_id,
          resolved_organization_id,
          new.status,
          new.role_code,
          1,
          new.created_at,
          new.updated_at
        );

        insert into control_plane.organization_membership_roles (
          membership_id,
          role_code,
          created_at
        ) values (
          new.membership_id,
          new.role_code,
          new.created_at
        );

        return new;
      end;
      $$;
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.auth_sessions
        where tenant_id is null
      ) then
        raise exception 'non-TENANT auth sessions block migration 010 rollback';
      end if;
    end;
    $$;

    create or replace function control_plane.shadow_legacy_membership()
      returns trigger language plpgsql as $$
      declare
        resolved_organization_id uuid;
      begin
        if tg_op = 'DELETE' then
          delete from control_plane.organization_memberships
          where membership_id = old.membership_id;
          return old;
        end if;

        select organization.organization_id
          into resolved_organization_id
        from control_plane.tenants tenant
        join control_plane.organizations organization
          on organization.organization_id = tenant.organization_id
        where tenant.tenant_id = new.tenant_id
          and organization.organization_type = 'TENANT';

        if resolved_organization_id is null then
          raise exception 'legacy membership tenant must map to a TENANT organization';
        end if;

        if new.role_code = 'pilot_support' then
          raise exception 'legacy pilot_support membership requires an explicit PLATFORM membership';
        end if;

        if tg_op = 'UPDATE' then
          delete from control_plane.organization_memberships
          where membership_id = old.membership_id;
        end if;

        insert into control_plane.organization_memberships (
          membership_id,
          user_id,
          organization_id,
          status,
          primary_role_code,
          version,
          created_at,
          updated_at
        ) values (
          new.membership_id,
          new.user_id,
          resolved_organization_id,
          new.status,
          new.role_code,
          1,
          new.created_at,
          new.updated_at
        );

        insert into control_plane.organization_membership_roles (
          membership_id,
          role_code,
          created_at
        ) values (
          new.membership_id,
          new.role_code,
          new.created_at
        );

        return new;
      end;
      $$;

    drop trigger if exists organization_membership_roles_version_guard
      on control_plane.organization_membership_roles;
    drop function if exists control_plane.bump_membership_version_for_role();

    drop trigger if exists organization_memberships_version_guard
      on control_plane.organization_memberships;
    drop function if exists control_plane.protect_organization_membership_version();

    drop trigger if exists auth_sessions_active_context_guard
      on control_plane.auth_sessions;
    drop function if exists control_plane.enforce_auth_session_active_context();

    drop index if exists control_plane.auth_sessions_user_membership_active_idx;

    alter table control_plane.auth_sessions
      drop constraint if exists auth_sessions_active_context_fk,
      drop constraint if exists auth_sessions_membership_version_positive_ck,
      drop constraint if exists auth_sessions_active_context_complete_ck,
      drop column if exists membership_version,
      drop column if exists active_organization_id,
      drop column if exists active_membership_id,
      alter column tenant_id set not null;

    alter table control_plane.organization_memberships
      drop constraint if exists organization_memberships_context_uq;
  `);
}
