import type { Knex } from 'knex';

const hardenedLegacyMembershipShadow = `
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

        if new.role_code is distinct from old.role_code then
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
        end if;

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
`;

const previousLegacyMembershipShadow = `
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
`;

export async function up(database: Knex): Promise<void> {
  await database.raw(hardenedLegacyMembershipShadow);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(previousLegacyMembershipShadow);
}
