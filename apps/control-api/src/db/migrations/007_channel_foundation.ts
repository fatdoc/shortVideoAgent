import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.channels (
      channel_id uuid primary key,
      organization_id uuid not null
        references control_plane.organizations(organization_id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint channels_organization_uq unique (organization_id)
    );

    create function control_plane.enforce_channel_organization_type()
      returns trigger language plpgsql as $$
      begin
        if not exists (
          select 1
          from control_plane.organizations organization
          where organization.organization_id = new.organization_id
            and organization.organization_type = 'CHANNEL'
        ) then
          raise exception 'channel organization must reference a CHANNEL organization';
        end if;
        return new;
      end;
    $$;

    create trigger channels_organization_type_guard
      before insert or update of organization_id
      on control_plane.channels
      for each row execute function control_plane.enforce_channel_organization_type();

    create function control_plane.protect_channel_organization_type()
      returns trigger language plpgsql as $$
      begin
        if new.organization_type <> 'CHANNEL'
          and exists (
            select 1
            from control_plane.channels channel
            where channel.organization_id = old.organization_id
          ) then
          raise exception 'organization extended by a channel must remain CHANNEL';
        end if;
        return new;
      end;
    $$;

    create trigger organizations_channel_type_guard
      before update of organization_type
      on control_plane.organizations
      for each row execute function control_plane.protect_channel_organization_type();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop trigger if exists organizations_channel_type_guard
      on control_plane.organizations;
    drop function if exists control_plane.protect_channel_organization_type();
    drop trigger if exists channels_organization_type_guard
      on control_plane.channels;
    drop function if exists control_plane.enforce_channel_organization_type();
    drop table if exists control_plane.channels;
  `);
}
