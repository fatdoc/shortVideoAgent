import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.user_consents
        where registration_id is not null
      ) then
        raise exception 'registration migration blocked: orphan Consent registration references require manual review';
      end if;

      if exists (
        select 1
        from control_plane.invitation_usages
      ) then
        raise exception 'registration migration blocked: orphan Usage registration references require manual review';
      end if;
    end;
    $$;

    create table control_plane.registrations (
      registration_id uuid primary key,
      normalized_email text not null,
      status text not null
        check (status = 'completed'),
      registration_path text not null
        check (
          registration_path in (
            'DIRECT',
            'PLATFORM_INVITATION',
            'CHANNEL_INVITATION',
            'TENANT_MEMBER_INVITATION'
          )
        ),
      invitation_id uuid
        references control_plane.invitations(invitation_id),
      user_id uuid not null
        references control_plane.users(user_id),
      tenant_id uuid not null
        references control_plane.tenants(tenant_id),
      membership_id uuid not null
        references control_plane.organization_memberships(membership_id),
      terms_version_id uuid not null
        references control_plane.terms_versions(terms_version_id),
      idempotency_key text not null,
      request_digest text not null,
      completed_at timestamptz not null,
      created_at timestamptz not null default now(),
      constraint registrations_email_normalized_ck
        check (
          normalized_email = lower(btrim(normalized_email))
          and char_length(normalized_email) between 3 and 320
        ),
      constraint registrations_path_invitation_ck
        check (
          (registration_path = 'DIRECT' and invitation_id is null)
          or
          (registration_path <> 'DIRECT' and invitation_id is not null)
        ),
      constraint registrations_idempotency_key_nonempty_ck
        check (
          idempotency_key = btrim(idempotency_key)
          and char_length(idempotency_key) between 1 and 200
        ),
      constraint registrations_request_digest_format_ck
        check (request_digest ~ '^[0-9a-f]{64}$'),
      constraint registrations_user_uq unique (user_id),
      constraint registrations_idempotency_key_uq unique (idempotency_key)
    );

    create unique index registrations_email_normalized_uq
      on control_plane.registrations (lower(normalized_email));
    create index registrations_tenant_completed_idx
      on control_plane.registrations (tenant_id, completed_at desc, registration_id);
    create index registrations_invitation_idx
      on control_plane.registrations (invitation_id)
      where invitation_id is not null;

    create function control_plane.validate_registration_fact()
      returns trigger language plpgsql as $$
      declare
        resolved_invitation_type text;
        resolved_target_organization_id uuid;
        resolved_target_email text;
        resolved_terms_status text;
        resolved_tenant_organization_id uuid;
      begin
        if not exists (
          select 1
          from control_plane.organization_memberships membership
          join control_plane.tenants tenant
            on tenant.organization_id = membership.organization_id
          where membership.membership_id = new.membership_id
            and membership.user_id = new.user_id
            and tenant.tenant_id = new.tenant_id
        ) then
          raise exception 'registration membership must belong to its User and Tenant organization';
        end if;

        select status
          into resolved_terms_status
        from control_plane.terms_versions
        where terms_version_id = new.terms_version_id;

        if resolved_terms_status not in ('PUBLISHED', 'RETIRED') then
          raise exception 'completed registration must reference released Terms';
        end if;

        if new.registration_path = 'DIRECT' then
          return new;
        end if;

        select
          invitation_type,
          target_organization_id,
          target_email_normalized
        into
          resolved_invitation_type,
          resolved_target_organization_id,
          resolved_target_email
        from control_plane.invitations
        where invitation_id = new.invitation_id;

        if resolved_invitation_type is null then
          raise exception 'registration Invitation does not exist';
        end if;

        if (new.registration_path = 'PLATFORM_INVITATION' and resolved_invitation_type <> 'PLATFORM')
          or (new.registration_path = 'CHANNEL_INVITATION' and resolved_invitation_type <> 'CHANNEL')
          or (
            new.registration_path = 'TENANT_MEMBER_INVITATION'
            and resolved_invitation_type <> 'TENANT_MEMBER'
          ) then
          raise exception 'registration path does not match Invitation type';
        end if;

        if resolved_target_email is not null
          and resolved_target_email <> new.normalized_email then
          raise exception 'registration email does not match targeted Invitation';
        end if;

        if new.registration_path = 'TENANT_MEMBER_INVITATION' then
          select organization_id
            into resolved_tenant_organization_id
          from control_plane.tenants
          where tenant_id = new.tenant_id;

          if resolved_target_organization_id is distinct from resolved_tenant_organization_id then
            raise exception 'tenant member registration must use the Invitation target Tenant';
          end if;
        end if;

        return new;
      end;
      $$;

    create trigger registrations_validation_guard
      before insert
      on control_plane.registrations
      for each row execute function control_plane.validate_registration_fact();

    create function control_plane.protect_registration_fact()
      returns trigger language plpgsql as $$
      begin
        raise exception 'completed Registration is immutable and cannot be updated or deleted';
      end;
      $$;

    create trigger registrations_immutable_guard
      before update or delete
      on control_plane.registrations
      for each row execute function control_plane.protect_registration_fact();

    create table control_plane.referral_attributions (
      referral_attribution_id uuid primary key,
      registration_id uuid not null
        references control_plane.registrations(registration_id),
      user_id uuid not null
        references control_plane.users(user_id),
      tenant_id uuid not null
        references control_plane.tenants(tenant_id),
      acquisition_source text not null
        check (
          acquisition_source in (
            'DIRECT',
            'PLATFORM_INVITATION',
            'CHANNEL_INVITATION',
            'TENANT_MEMBER_INVITATION'
          )
        ),
      invitation_id uuid
        references control_plane.invitations(invitation_id),
      referrer_channel_id uuid
        references control_plane.channels(channel_id),
      effective_from timestamptz not null,
      protected_until timestamptz,
      protection_rule_version text not null,
      evidence_digest text not null,
      status text not null
        check (status in ('active', 'ended')),
      created_at timestamptz not null default now(),
      constraint referral_attributions_registration_uq unique (registration_id),
      constraint referral_attributions_user_uq unique (user_id),
      constraint referral_attributions_rule_nonempty_ck
        check (
          protection_rule_version = btrim(protection_rule_version)
          and char_length(protection_rule_version) between 1 and 100
        ),
      constraint referral_attributions_evidence_digest_format_ck
        check (evidence_digest ~ '^[0-9a-f]{64}$')
    );

    create index referral_attributions_tenant_created_idx
      on control_plane.referral_attributions (tenant_id, created_at desc);
    create index referral_attributions_channel_protected_idx
      on control_plane.referral_attributions (referrer_channel_id, protected_until)
      where referrer_channel_id is not null;

    create function control_plane.validate_referral_attribution()
      returns trigger language plpgsql as $$
      declare
        registered_fact control_plane.registrations%rowtype;
        frozen_channel_id uuid;
      begin
        select *
          into registered_fact
        from control_plane.registrations
        where registration_id = new.registration_id;

        if registered_fact.registration_id is null then
          raise exception 'Attribution must reference a completed Registration';
        end if;

        if new.user_id <> registered_fact.user_id
          or new.tenant_id <> registered_fact.tenant_id
          or new.acquisition_source <> registered_fact.registration_path
          or new.invitation_id is distinct from registered_fact.invitation_id then
          raise exception 'Attribution facts must match the completed Registration';
        end if;

        if new.effective_from <> registered_fact.completed_at then
          raise exception 'Attribution effective_from must match Registration completion';
        end if;

        if registered_fact.invitation_id is not null then
          select attribution_channel_id
            into frozen_channel_id
          from control_plane.invitations
          where invitation_id = registered_fact.invitation_id;
        end if;

        if new.acquisition_source in ('DIRECT', 'TENANT_MEMBER_INVITATION') then
          if new.referrer_channel_id is not null or new.protected_until is not null then
            raise exception 'direct or tenant member Attribution cannot claim a referrer Channel';
          end if;
        elsif new.acquisition_source = 'CHANNEL_INVITATION' then
          if frozen_channel_id is null
            or new.referrer_channel_id is distinct from frozen_channel_id then
            raise exception 'Channel Invitation Attribution must use its frozen referrer Channel';
          end if;
        elsif new.acquisition_source = 'PLATFORM_INVITATION' then
          if new.referrer_channel_id is distinct from frozen_channel_id then
            raise exception 'Platform Invitation Attribution must use its frozen optional Channel';
          end if;
        end if;

        if new.referrer_channel_id is null then
          if new.protected_until is not null then
            raise exception 'Attribution without a referrer Channel cannot have protection';
          end if;
        elsif new.protected_until is distinct from new.effective_from + interval '12 months' then
          raise exception 'referrer Channel protection must equal exactly 12 months';
        end if;

        return new;
      end;
      $$;

    create trigger referral_attributions_validation_guard
      before insert
      on control_plane.referral_attributions
      for each row execute function control_plane.validate_referral_attribution();

    create function control_plane.protect_referral_attribution()
      returns trigger language plpgsql as $$
      begin
        raise exception 'Referral Attribution is immutable and cannot be updated or deleted';
      end;
      $$;

    create trigger referral_attributions_immutable_guard
      before update or delete
      on control_plane.referral_attributions
      for each row execute function control_plane.protect_referral_attribution();

    create table control_plane.referral_attribution_events (
      event_id uuid primary key,
      referral_attribution_id uuid not null
        references control_plane.referral_attributions(referral_attribution_id),
      event_type text not null
        check (event_type in ('created', 'corrected', 'ended')),
      reason_code text not null,
      acted_by uuid
        references control_plane.users(user_id),
      occurred_at timestamptz not null,
      evidence_digest text not null,
      created_at timestamptz not null default now(),
      constraint referral_attribution_events_reason_nonempty_ck
        check (
          reason_code = btrim(reason_code)
          and char_length(reason_code) between 1 and 100
        ),
      constraint referral_attribution_events_evidence_digest_format_ck
        check (evidence_digest ~ '^[0-9a-f]{64}$'),
      constraint referral_attribution_events_actor_ck
        check (
          (event_type = 'created' and acted_by is null)
          or
          (event_type in ('corrected', 'ended') and acted_by is not null)
        )
    );

    create unique index referral_attribution_events_created_uq
      on control_plane.referral_attribution_events (referral_attribution_id)
      where event_type = 'created';
    create index referral_attribution_events_history_idx
      on control_plane.referral_attribution_events (
        referral_attribution_id,
        occurred_at,
        event_id
      );

    create function control_plane.validate_referral_attribution_event()
      returns trigger language plpgsql as $$
      declare
        attribution_effective_from timestamptz;
      begin
        select effective_from
          into attribution_effective_from
        from control_plane.referral_attributions
        where referral_attribution_id = new.referral_attribution_id;

        if attribution_effective_from is null then
          raise exception 'Attribution Event must reference an existing Attribution';
        end if;

        if new.occurred_at < attribution_effective_from then
          raise exception 'Attribution Event cannot predate Attribution effectiveness';
        end if;

        return new;
      end;
      $$;

    create trigger referral_attribution_events_validation_guard
      before insert
      on control_plane.referral_attribution_events
      for each row execute function control_plane.validate_referral_attribution_event();

    create function control_plane.protect_referral_attribution_event()
      returns trigger language plpgsql as $$
      begin
        raise exception 'Referral Attribution Event is append-only and cannot be updated or deleted';
      end;
      $$;

    create trigger referral_attribution_events_append_only_guard
      before update or delete
      on control_plane.referral_attribution_events
      for each row execute function control_plane.protect_referral_attribution_event();

    alter table control_plane.user_consents
      add constraint user_consents_registration_fk
      foreign key (registration_id)
      references control_plane.registrations(registration_id);

    alter table control_plane.invitation_usages
      add constraint invitation_usages_registration_fk
      foreign key (registration_id)
      references control_plane.registrations(registration_id);
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if to_regclass('control_plane.referral_attribution_events') is not null
        and exists (select 1 from control_plane.referral_attribution_events) then
        raise exception 'registration attribution rollback blocked: Event audit evidence exists';
      end if;

      if to_regclass('control_plane.referral_attributions') is not null
        and exists (select 1 from control_plane.referral_attributions) then
        raise exception 'registration attribution rollback blocked: Attribution audit facts exist';
      end if;

      if to_regclass('control_plane.registrations') is not null
        and exists (select 1 from control_plane.registrations) then
        raise exception 'registration attribution rollback blocked: Registration audit facts exist';
      end if;

      if exists (
        select 1
        from control_plane.user_consents
        where registration_id is not null
      ) then
        raise exception 'registration attribution rollback blocked: Consent audit evidence exists';
      end if;

      if exists (select 1 from control_plane.invitation_usages) then
        raise exception 'registration attribution rollback blocked: Usage audit evidence exists';
      end if;
    end;
    $$;

    alter table control_plane.invitation_usages
      drop constraint if exists invitation_usages_registration_fk;
    alter table control_plane.user_consents
      drop constraint if exists user_consents_registration_fk;

    drop trigger if exists referral_attribution_events_append_only_guard
      on control_plane.referral_attribution_events;
    drop function if exists control_plane.protect_referral_attribution_event();
    drop trigger if exists referral_attribution_events_validation_guard
      on control_plane.referral_attribution_events;
    drop function if exists control_plane.validate_referral_attribution_event();
    drop table if exists control_plane.referral_attribution_events;

    drop trigger if exists referral_attributions_immutable_guard
      on control_plane.referral_attributions;
    drop function if exists control_plane.protect_referral_attribution();
    drop trigger if exists referral_attributions_validation_guard
      on control_plane.referral_attributions;
    drop function if exists control_plane.validate_referral_attribution();
    drop table if exists control_plane.referral_attributions;

    drop trigger if exists registrations_immutable_guard
      on control_plane.registrations;
    drop function if exists control_plane.protect_registration_fact();
    drop trigger if exists registrations_validation_guard
      on control_plane.registrations;
    drop function if exists control_plane.validate_registration_fact();
    drop table if exists control_plane.registrations;
  `);
}
