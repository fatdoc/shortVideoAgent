import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.organizations (
      organization_id uuid primary key,
      organization_type text not null
        check (organization_type in ('PLATFORM', 'CHANNEL', 'TENANT')),
      display_name text not null,
      status text not null
        check (status in ('active', 'suspended', 'archived')),
      parent_organization_id uuid
        references control_plane.organizations(organization_id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint organizations_parent_not_self_ck
        check (
          parent_organization_id is null
          or parent_organization_id <> organization_id
        )
    );

    create index organizations_type_status_idx
      on control_plane.organizations (organization_type, status);
    create index organizations_parent_idx
      on control_plane.organizations (parent_organization_id)
      where parent_organization_id is not null;

    alter table control_plane.tenants
      add column organization_id uuid;

    insert into control_plane.organizations (
      organization_id,
      organization_type,
      display_name,
      status,
      created_at,
      updated_at
    )
    select
      tenant_id,
      'TENANT',
      display_name,
      status,
      created_at,
      updated_at
    from control_plane.tenants;

    update control_plane.tenants
      set organization_id = tenant_id;

    do $$
    begin
      if exists (
        select 1
        from control_plane.tenants tenant
        left join control_plane.organizations organization
          on organization.organization_id = tenant.organization_id
        where tenant.organization_id is null
          or organization.organization_id is null
          or organization.organization_type <> 'TENANT'
      ) then
        raise exception 'every tenant must map to exactly one TENANT organization';
      end if;
    end;
    $$;

    alter table control_plane.tenants
      alter column organization_id set not null,
      add constraint tenants_organization_uq unique (organization_id),
      add constraint tenants_organization_fk
        foreign key (organization_id)
        references control_plane.organizations(organization_id);

    create function control_plane.enforce_tenant_organization_type()
      returns trigger language plpgsql as $$
      begin
        if not exists (
          select 1
          from control_plane.organizations organization
          where organization.organization_id = new.organization_id
            and organization.organization_type = 'TENANT'
        ) then
          raise exception 'tenant organization must reference a TENANT organization';
        end if;
        return new;
      end;
    $$;

    create trigger tenants_organization_type_guard
      before insert or update of organization_id
      on control_plane.tenants
      for each row execute function control_plane.enforce_tenant_organization_type();

    create function control_plane.protect_tenant_organization_type()
      returns trigger language plpgsql as $$
      begin
        if new.organization_type <> 'TENANT'
          and exists (
            select 1
            from control_plane.tenants tenant
            where tenant.organization_id = old.organization_id
          ) then
          raise exception 'organization extended by a tenant must remain TENANT';
        end if;
        return new;
      end;
    $$;

    create trigger organizations_tenant_type_guard
      before update of organization_type
      on control_plane.organizations
      for each row execute function control_plane.protect_tenant_organization_type();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop trigger if exists organizations_tenant_type_guard
      on control_plane.organizations;
    drop function if exists control_plane.protect_tenant_organization_type();
    drop trigger if exists tenants_organization_type_guard
      on control_plane.tenants;
    drop function if exists control_plane.enforce_tenant_organization_type();

    alter table control_plane.tenants
      drop constraint if exists tenants_organization_fk,
      drop constraint if exists tenants_organization_uq,
      drop column if exists organization_id;

    drop table if exists control_plane.organizations;
  `);
}
