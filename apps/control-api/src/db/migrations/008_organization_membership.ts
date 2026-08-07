import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.memberships
        group by tenant_id, user_id
        having count(*) > 1
      ) then
        raise exception 'ambiguous legacy memberships: multiple roles require an explicit primary role';
      end if;

      if exists (
        select 1
        from control_plane.memberships
        where role_code = 'pilot_support'
      ) then
        raise exception 'legacy pilot_support membership cannot be mapped from TENANT to PLATFORM implicitly';
      end if;

      if exists (
        select 1
        from control_plane.memberships legacy_membership
        left join control_plane.tenants tenant
          on tenant.tenant_id = legacy_membership.tenant_id
        left join control_plane.organizations organization
          on organization.organization_id = tenant.organization_id
        where organization.organization_id is null
          or organization.organization_type <> 'TENANT'
      ) then
        raise exception 'legacy membership tenant must map to exactly one TENANT organization';
      end if;
    end;
    $$;

    create table control_plane.organization_memberships (
      membership_id uuid primary key,
      user_id uuid not null references control_plane.users(user_id),
      organization_id uuid not null references control_plane.organizations(organization_id),
      status text not null check (status in ('active', 'suspended', 'expired')),
      primary_role_code text not null check (
        primary_role_code in (
          'platform_admin',
          'channel_admin',
          'tenant_admin',
          'content_operator',
          'pilot_support'
        )
      ),
      version integer not null default 1 check (version > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint organization_memberships_user_organization_uq
        unique (user_id, organization_id)
    );

    create table control_plane.organization_membership_roles (
      membership_id uuid not null
        references control_plane.organization_memberships(membership_id)
        on delete cascade,
      role_code text not null check (
        role_code in (
          'platform_admin',
          'channel_admin',
          'tenant_admin',
          'content_operator',
          'pilot_support'
        )
      ),
      created_at timestamptz not null default now(),
      primary key (membership_id, role_code)
    );

    insert into control_plane.organization_memberships (
      membership_id,
      user_id,
      organization_id,
      status,
      primary_role_code,
      version,
      created_at,
      updated_at
    )
    select
      legacy_membership.membership_id,
      legacy_membership.user_id,
      tenant.organization_id,
      legacy_membership.status,
      legacy_membership.role_code,
      1,
      legacy_membership.created_at,
      legacy_membership.updated_at
    from control_plane.memberships legacy_membership
    join control_plane.tenants tenant
      on tenant.tenant_id = legacy_membership.tenant_id;

    insert into control_plane.organization_membership_roles (
      membership_id,
      role_code,
      created_at
    )
    select
      membership_id,
      role_code,
      created_at
    from control_plane.memberships;

    alter table control_plane.organization_memberships
      add constraint organization_memberships_primary_role_fk
      foreign key (membership_id, primary_role_code)
      references control_plane.organization_membership_roles(membership_id, role_code)
      deferrable initially deferred;

    create index organization_memberships_active_user_idx
      on control_plane.organization_memberships (user_id, organization_id)
      where status = 'active';
    create index organization_memberships_organization_status_idx
      on control_plane.organization_memberships (organization_id, status, user_id);
    create index organization_membership_roles_role_idx
      on control_plane.organization_membership_roles (role_code, membership_id);

    create function control_plane.organization_role_matches_type(
      checked_role_code text,
      checked_organization_type text
    ) returns boolean
      language sql
      immutable
      strict
      as $$
        select case checked_organization_type
          when 'PLATFORM' then checked_role_code in ('platform_admin', 'pilot_support')
          when 'CHANNEL' then checked_role_code = 'channel_admin'
          when 'TENANT' then checked_role_code in ('tenant_admin', 'content_operator')
          else false
        end;
      $$;

    create function control_plane.enforce_organization_membership_type()
      returns trigger language plpgsql as $$
      declare
        resolved_organization_type text;
      begin
        select organization_type
          into resolved_organization_type
        from control_plane.organizations
        where organization_id = new.organization_id;

        if resolved_organization_type is null then
          raise exception 'organization membership must reference an existing organization';
        end if;

        if not control_plane.organization_role_matches_type(
          new.primary_role_code,
          resolved_organization_type
        ) then
          raise exception 'membership primary role % is incompatible with % organization',
            new.primary_role_code,
            resolved_organization_type;
        end if;

        if tg_op = 'UPDATE' and exists (
          select 1
          from control_plane.organization_membership_roles membership_role
          where membership_role.membership_id = old.membership_id
            and not control_plane.organization_role_matches_type(
              membership_role.role_code,
              resolved_organization_type
            )
        ) then
          raise exception 'membership roles are incompatible with % organization',
            resolved_organization_type;
        end if;

        return new;
      end;
    $$;

    create trigger organization_memberships_type_guard
      before insert or update of organization_id, primary_role_code
      on control_plane.organization_memberships
      for each row execute function control_plane.enforce_organization_membership_type();

    create function control_plane.enforce_organization_membership_role_type()
      returns trigger language plpgsql as $$
      declare
        resolved_organization_type text;
      begin
        select organization.organization_type
          into resolved_organization_type
        from control_plane.organization_memberships membership
        join control_plane.organizations organization
          on organization.organization_id = membership.organization_id
        where membership.membership_id = new.membership_id;

        if resolved_organization_type is null then
          raise exception 'membership role must reference an existing organization membership';
        end if;

        if not control_plane.organization_role_matches_type(
          new.role_code,
          resolved_organization_type
        ) then
          raise exception 'membership role % is incompatible with % organization',
            new.role_code,
            resolved_organization_type;
        end if;

        return new;
      end;
    $$;

    create trigger organization_membership_roles_type_guard
      before insert or update of membership_id, role_code
      on control_plane.organization_membership_roles
      for each row execute function control_plane.enforce_organization_membership_role_type();

    create function control_plane.protect_organization_membership_role_type()
      returns trigger language plpgsql as $$
      begin
        if exists (
          select 1
          from control_plane.organization_memberships membership
          join control_plane.organization_membership_roles membership_role
            on membership_role.membership_id = membership.membership_id
          where membership.organization_id = old.organization_id
            and not control_plane.organization_role_matches_type(
              membership_role.role_code,
              new.organization_type
            )
        ) then
          raise exception 'organization type is incompatible with existing membership roles';
        end if;

        return new;
      end;
    $$;

    create trigger organizations_membership_role_type_guard
      before update of organization_type
      on control_plane.organizations
      for each row execute function control_plane.protect_organization_membership_role_type();

    create function control_plane.shadow_legacy_membership()
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

    create trigger memberships_organization_shadow
      after insert or update or delete
      on control_plane.memberships
      for each row execute function control_plane.shadow_legacy_membership();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop trigger if exists memberships_organization_shadow
      on control_plane.memberships;
    drop function if exists control_plane.shadow_legacy_membership();

    drop trigger if exists organizations_membership_role_type_guard
      on control_plane.organizations;
    drop function if exists control_plane.protect_organization_membership_role_type();

    drop trigger if exists organization_membership_roles_type_guard
      on control_plane.organization_membership_roles;
    drop function if exists control_plane.enforce_organization_membership_role_type();

    drop trigger if exists organization_memberships_type_guard
      on control_plane.organization_memberships;
    drop function if exists control_plane.enforce_organization_membership_type();

    alter table if exists control_plane.organization_memberships
      drop constraint if exists organization_memberships_primary_role_fk;
    drop table if exists control_plane.organization_membership_roles;
    drop table if exists control_plane.organization_memberships;
    drop function if exists control_plane.organization_role_matches_type(text, text);
  `);
}
