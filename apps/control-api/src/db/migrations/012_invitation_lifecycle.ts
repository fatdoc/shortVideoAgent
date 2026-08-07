import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.invitations (
      invitation_id uuid primary key,
      issuer_membership_id uuid not null
        references control_plane.organization_memberships(membership_id),
      issuer_organization_id uuid not null
        references control_plane.organizations(organization_id),
      invitation_type text not null
        check (invitation_type in ('PLATFORM', 'CHANNEL', 'TENANT_MEMBER')),
      target_organization_id uuid
        references control_plane.organizations(organization_id),
      target_role_code text,
      target_email_normalized text,
      attribution_channel_id uuid
        references control_plane.channels(channel_id),
      token_digest text not null,
      status text not null
        check (status in ('active', 'revoked', 'exhausted', 'expired')),
      valid_from timestamptz not null,
      expires_at timestamptz not null,
      max_uses integer not null,
      used_count integer not null default 0,
      creation_idempotency_key text not null,
      creation_request_digest text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      revoked_at timestamptz,
      revoked_by_membership_id uuid
        references control_plane.organization_memberships(membership_id),
      constraint invitations_token_digest_uq unique (token_digest),
      constraint invitations_creation_idempotency_uq
        unique (issuer_organization_id, creation_idempotency_key),
      constraint invitations_token_digest_format_ck
        check (token_digest ~ '^sha256:v1:[0-9a-f]{64}$'),
      constraint invitations_creation_digest_format_ck
        check (creation_request_digest ~ '^[0-9a-f]{64}$'),
      constraint invitations_idempotency_key_nonempty_ck
        check (
          creation_idempotency_key = btrim(creation_idempotency_key)
          and char_length(creation_idempotency_key) between 1 and 200
        ),
      constraint invitations_target_email_normalized_ck
        check (
          target_email_normalized is null
          or (
            target_email_normalized = lower(btrim(target_email_normalized))
            and char_length(target_email_normalized) between 3 and 254
            and target_email_normalized ~ '^[^[:space:]@]+@[^[:space:]@]+$'
          )
        ),
      constraint invitations_window_ck check (valid_from < expires_at),
      constraint invitations_usage_count_ck
        check (max_uses > 0 and used_count between 0 and max_uses),
      constraint invitations_directed_window_7_days_ck
        check (
          invitation_type not in ('PLATFORM', 'TENANT_MEMBER')
          or expires_at <= valid_from + interval '7 days'
        ),
      constraint invitations_directed_single_use_ck
        check (
          invitation_type not in ('PLATFORM', 'TENANT_MEMBER')
          or max_uses = 1
        ),
      constraint invitations_channel_window_30_days_ck
        check (
          invitation_type <> 'CHANNEL'
          or expires_at <= valid_from + interval '30 days'
        ),
      constraint invitations_channel_max_uses_100_ck
        check (
          invitation_type <> 'CHANNEL'
          or max_uses between 1 and 100
        ),
      constraint invitations_type_shape_ck
        check (
          (
            invitation_type = 'PLATFORM'
            and target_organization_id is null
            and target_role_code is null
            and target_email_normalized is not null
          )
          or (
            invitation_type = 'CHANNEL'
            and target_organization_id is null
            and target_role_code is null
            and target_email_normalized is null
            and attribution_channel_id is not null
          )
          or (
            invitation_type = 'TENANT_MEMBER'
            and target_organization_id is not null
            and target_role_code = 'content_operator'
            and target_email_normalized is not null
            and attribution_channel_id is null
          )
        ),
      constraint invitations_status_evidence_ck
        check (
          (
            status = 'active'
            and revoked_at is null
            and revoked_by_membership_id is null
            and used_count < max_uses
          )
          or (
            status = 'revoked'
            and revoked_at is not null
            and revoked_by_membership_id is not null
          )
          or (
            status = 'exhausted'
            and revoked_at is null
            and revoked_by_membership_id is null
            and used_count = max_uses
          )
          or (
            status = 'expired'
            and revoked_at is null
            and revoked_by_membership_id is null
            and used_count < max_uses
          )
        )
    );

    create index invitations_issuer_scope_idx
      on control_plane.invitations (
        issuer_organization_id,
        status,
        created_at desc,
        invitation_id desc
      );
    create index invitations_attribution_channel_idx
      on control_plane.invitations (attribution_channel_id, status, created_at desc)
      where attribution_channel_id is not null;
    create index invitations_target_organization_idx
      on control_plane.invitations (target_organization_id, status, created_at desc)
      where target_organization_id is not null;
    create index invitations_expiration_idx
      on control_plane.invitations (expires_at, invitation_id)
      where status = 'active';

    create function control_plane.validate_invitation_scope()
      returns trigger language plpgsql as $$
      declare
        issuer_type text;
        issuer_role text;
        resolved_channel_organization_id uuid;
        resolved_target_type text;
        revoker_organization_id uuid;
        revoker_role text;
      begin
        select organization.organization_type, membership.primary_role_code
          into issuer_type, issuer_role
        from control_plane.organization_memberships membership
        join control_plane.organizations organization
          on organization.organization_id = membership.organization_id
        where membership.membership_id = new.issuer_membership_id
          and membership.organization_id = new.issuer_organization_id
          and membership.status = 'active'
          and organization.status = 'active'
          and exists (
            select 1
            from control_plane.organization_membership_roles membership_role
            where membership_role.membership_id = membership.membership_id
              and membership_role.role_code = membership.primary_role_code
          );

        if issuer_type is null then
          raise exception 'invitation issuer requires an active membership and organization';
        end if;

        if new.invitation_type = 'PLATFORM' then
          if issuer_type <> 'PLATFORM' or issuer_role <> 'platform_admin' then
            raise exception 'PLATFORM invitation requires a platform_admin issuer';
          end if;
        elsif new.invitation_type = 'CHANNEL' then
          if issuer_type <> 'CHANNEL' or issuer_role <> 'channel_admin' then
            raise exception 'CHANNEL invitation requires a channel_admin issuer';
          end if;
        elsif new.invitation_type = 'TENANT_MEMBER' then
          if issuer_type <> 'TENANT' or issuer_role <> 'tenant_admin' then
            raise exception 'TENANT_MEMBER invitation requires a tenant_admin issuer';
          end if;
        end if;

        if new.attribution_channel_id is not null then
          select channel.organization_id
            into resolved_channel_organization_id
          from control_plane.channels channel
          join control_plane.organizations organization
            on organization.organization_id = channel.organization_id
          where channel.channel_id = new.attribution_channel_id
            and organization.organization_type = 'CHANNEL'
            and organization.status = 'active';

          if resolved_channel_organization_id is null then
            raise exception 'invitation attribution requires an active CHANNEL';
          end if;

          if new.invitation_type = 'CHANNEL'
            and resolved_channel_organization_id <> new.issuer_organization_id then
            raise exception 'CHANNEL invitation attribution must match the issuer scope';
          end if;
        end if;

        if new.target_organization_id is not null then
          select organization.organization_type
            into resolved_target_type
          from control_plane.organizations organization
          join control_plane.tenants tenant
            on tenant.organization_id = organization.organization_id
          where organization.organization_id = new.target_organization_id
            and organization.status = 'active'
            and tenant.status = 'active';

          if resolved_target_type <> 'TENANT' then
            raise exception 'invitation target must be an active TENANT';
          end if;

          if new.invitation_type = 'TENANT_MEMBER'
            and new.target_organization_id <> new.issuer_organization_id then
            raise exception 'TENANT_MEMBER invitation target must match the issuer scope';
          end if;
        end if;

        if new.status = 'revoked' then
          select membership.organization_id, membership.primary_role_code
            into revoker_organization_id, revoker_role
          from control_plane.organization_memberships membership
          where membership.membership_id = new.revoked_by_membership_id
            and membership.status = 'active';

          if revoker_organization_id is null
            or revoker_organization_id <> new.issuer_organization_id
            or revoker_role <> issuer_role then
            raise exception 'invitation revoker must hold the active issuer scope';
          end if;
        end if;

        return new;
      end;
      $$;

    create trigger invitations_scope_guard
      before insert or update
      on control_plane.invitations
      for each row execute function control_plane.validate_invitation_scope();

    create function control_plane.protect_invitation_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'invitation audit facts cannot be deleted';
        end if;

        if new.invitation_id <> old.invitation_id
          or new.issuer_membership_id <> old.issuer_membership_id
          or new.issuer_organization_id <> old.issuer_organization_id
          or new.invitation_type <> old.invitation_type
          or new.target_organization_id is distinct from old.target_organization_id
          or new.target_role_code is distinct from old.target_role_code
          or new.target_email_normalized is distinct from old.target_email_normalized
          or new.attribution_channel_id is distinct from old.attribution_channel_id
          or new.token_digest <> old.token_digest
          or new.valid_from <> old.valid_from
          or new.expires_at <> old.expires_at
          or new.max_uses <> old.max_uses
          or new.creation_idempotency_key <> old.creation_idempotency_key
          or new.creation_request_digest <> old.creation_request_digest
          or new.created_at <> old.created_at then
          raise exception 'invitation identity and scope are immutable';
        end if;

        if new.used_count <> old.used_count and pg_trigger_depth() <= 1 then
          raise exception 'invitation used_count may only change through append-only Usage';
        end if;

        if old.status in ('revoked', 'exhausted', 'expired') then
          raise exception 'invitation terminal lifecycle is immutable';
        end if;

        if new.status = 'active' then
          if new.used_count <> old.used_count + 1 and new.used_count <> old.used_count then
            raise exception 'invitation usage count must increase one at a time';
          end if;
        elsif new.status = 'exhausted' then
          if pg_trigger_depth() <= 1 or new.used_count <> new.max_uses then
            raise exception 'invitation exhaustion may only result from final Usage';
          end if;
        elsif new.status = 'revoked' then
          if new.used_count <> old.used_count then
            raise exception 'invitation revocation cannot change Usage history';
          end if;
        elsif new.status = 'expired' then
          if new.used_count <> old.used_count or new.expires_at > clock_timestamp() then
            raise exception 'invitation may only expire after its validity window';
          end if;
        end if;

        new.updated_at := now();
        return new;
      end;
      $$;

    create trigger invitations_lifecycle_guard
      before update or delete
      on control_plane.invitations
      for each row execute function control_plane.protect_invitation_lifecycle();

    create table control_plane.invitation_usages (
      invitation_usage_id uuid primary key,
      invitation_id uuid not null
        references control_plane.invitations(invitation_id),
      registration_id uuid not null,
      user_id uuid not null
        references control_plane.users(user_id),
      used_at timestamptz not null default now(),
      idempotency_key text not null,
      request_digest text not null,
      created_at timestamptz not null default now(),
      constraint invitation_usages_registration_uq unique (registration_id),
      constraint invitation_usages_invitation_registration_uq
        unique (invitation_id, registration_id),
      constraint invitation_usages_invitation_idempotency_uq
        unique (invitation_id, idempotency_key),
      constraint invitation_usages_idempotency_key_nonempty_ck
        check (
          idempotency_key = btrim(idempotency_key)
          and char_length(idempotency_key) between 1 and 200
        ),
      constraint invitation_usages_request_digest_format_ck
        check (request_digest ~ '^[0-9a-f]{64}$')
    );

    create index invitation_usages_invitation_used_idx
      on control_plane.invitation_usages (invitation_id, used_at, invitation_usage_id);
    create index invitation_usages_user_idx
      on control_plane.invitation_usages (user_id, used_at desc);

    create function control_plane.consume_invitation_usage()
      returns trigger language plpgsql as $$
      declare
        locked_invitation control_plane.invitations%rowtype;
        consumed_at timestamptz;
      begin
        consumed_at := clock_timestamp();
        select *
          into locked_invitation
        from control_plane.invitations
        where invitation_id = new.invitation_id
        for update;

        if locked_invitation.invitation_id is null then
          raise exception 'invitation is not available for Usage';
        end if;

        if locked_invitation.status <> 'active' then
          raise exception 'invitation is not active for Usage';
        end if;

        if consumed_at < locked_invitation.valid_from
          or consumed_at >= locked_invitation.expires_at then
          raise exception 'invitation validity window is unavailable for Usage';
        end if;

        if locked_invitation.used_count >= locked_invitation.max_uses then
          raise exception 'invitation Usage limit is exhausted';
        end if;

        new.used_at := consumed_at;
        new.created_at := consumed_at;

        update control_plane.invitations
        set used_count = used_count + 1,
            status = case
              when used_count + 1 = max_uses then 'exhausted'
              else 'active'
            end
        where invitation_id = new.invitation_id;

        return new;
      end;
      $$;

    create trigger invitation_usages_consume_guard
      before insert
      on control_plane.invitation_usages
      for each row execute function control_plane.consume_invitation_usage();

    create function control_plane.protect_invitation_usage()
      returns trigger language plpgsql as $$
      begin
        raise exception 'invitation Usage is append-only and cannot be updated or deleted';
      end;
      $$;

    create trigger invitation_usages_append_only_guard
      before update or delete
      on control_plane.invitation_usages
      for each row execute function control_plane.protect_invitation_usage();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if to_regclass('control_plane.invitation_usages') is not null
        and exists (select 1 from control_plane.invitation_usages) then
        raise exception 'invitation rollback blocked: Usage audit evidence exists';
      end if;

      if to_regclass('control_plane.invitations') is not null
        and exists (select 1 from control_plane.invitations) then
        raise exception 'invitation rollback blocked: Invitation audit facts exist';
      end if;
    end;
    $$;

    drop trigger if exists invitation_usages_append_only_guard
      on control_plane.invitation_usages;
    drop function if exists control_plane.protect_invitation_usage();
    drop trigger if exists invitation_usages_consume_guard
      on control_plane.invitation_usages;
    drop function if exists control_plane.consume_invitation_usage();
    drop table if exists control_plane.invitation_usages;

    drop trigger if exists invitations_lifecycle_guard
      on control_plane.invitations;
    drop function if exists control_plane.protect_invitation_lifecycle();
    drop trigger if exists invitations_scope_guard
      on control_plane.invitations;
    drop function if exists control_plane.validate_invitation_scope();
    drop table if exists control_plane.invitations;
  `);
}
