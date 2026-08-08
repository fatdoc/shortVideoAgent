import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.wallets
      add constraint wallets_wallet_tenant_uq unique (wallet_id, tenant_id);

    create table control_plane.credit_conversion_rule_versions (
      rule_version_id uuid primary key,
      rule_code text not null,
      version_label text not null,
      payment_mode text not null
        check (payment_mode in ('TEST', 'LIVE')),
      status text not null
        check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
      currency text not null,
      amount_minor bigint not null
        check (amount_minor > 0),
      purchased_credits bigint not null
        check (purchased_credits > 0),
      bonus_credits bigint not null default 0
        check (bonus_credits >= 0),
      bonus_expires_in_days integer,
      rule_digest text not null,
      effective_at timestamptz,
      retired_at timestamptz,
      approved_by_membership_id uuid
        references control_plane.organization_memberships(membership_id),
      created_at timestamptz not null default now(),
      constraint credit_conversion_rules_identity_uq
        unique (rule_code, version_label, payment_mode),
      constraint credit_conversion_rules_code_ck
        check (
          rule_code = upper(btrim(rule_code))
          and rule_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
        ),
      constraint credit_conversion_rules_version_ck
        check (
          version_label = btrim(version_label)
          and char_length(version_label) between 1 and 50
        ),
      constraint credit_conversion_rules_currency_ck
        check (currency ~ '^[A-Z]{3}$'),
      constraint credit_conversion_rules_bonus_expiry_ck
        check (
          (bonus_credits = 0 and bonus_expires_in_days is null)
          or
          (
            bonus_credits > 0
            and bonus_expires_in_days is not null
            and bonus_expires_in_days > 0
          )
        ),
      constraint credit_conversion_rules_digest_ck
        check (rule_digest ~ '^[0-9a-f]{64}$'),
      constraint credit_conversion_rules_lifecycle_evidence_ck
        check (
          (
            status = 'DRAFT'
            and effective_at is null
            and retired_at is null
            and approved_by_membership_id is null
          )
          or
          (
            status = 'ACTIVE'
            and effective_at is not null
            and retired_at is null
            and approved_by_membership_id is not null
          )
          or
          (
            status = 'RETIRED'
            and effective_at is not null
            and retired_at is not null
            and retired_at >= effective_at
            and approved_by_membership_id is not null
          )
        )
    );

    create index credit_conversion_rules_mode_status_idx
      on control_plane.credit_conversion_rule_versions (
        payment_mode,
        status,
        effective_at desc,
        rule_version_id
      );

    create function control_plane.validate_credit_conversion_rule_approval()
      returns trigger language plpgsql as $$
      begin
        if new.status in ('ACTIVE', 'RETIRED') and not exists (
          select 1
          from control_plane.organization_memberships membership
          join control_plane.organization_membership_roles membership_role
            on membership_role.membership_id = membership.membership_id
          join control_plane.organizations organization
            on organization.organization_id = membership.organization_id
          where membership.membership_id = new.approved_by_membership_id
            and membership.status = 'active'
            and membership_role.role_code = 'platform_admin'
            and organization.organization_type = 'PLATFORM'
            and organization.status = 'active'
        ) then
          raise exception 'active Credit Conversion Rule requires an active PLATFORM administrator';
        end if;

        return new;
      end;
      $$;

    create trigger credit_conversion_rules_approval_guard
      before insert or update
      on control_plane.credit_conversion_rule_versions
      for each row execute function control_plane.validate_credit_conversion_rule_approval();

    create function control_plane.protect_credit_conversion_rule_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'Credit Conversion Rule audit facts cannot be deleted';
        end if;

        if new.rule_version_id is distinct from old.rule_version_id
          or new.rule_code is distinct from old.rule_code
          or new.version_label is distinct from old.version_label
          or new.payment_mode is distinct from old.payment_mode
          or new.currency is distinct from old.currency
          or new.amount_minor is distinct from old.amount_minor
          or new.purchased_credits is distinct from old.purchased_credits
          or new.bonus_credits is distinct from old.bonus_credits
          or new.bonus_expires_in_days is distinct from old.bonus_expires_in_days
          or new.rule_digest is distinct from old.rule_digest
          or new.created_at is distinct from old.created_at then
          raise exception 'Credit Conversion Rule identity and conversion facts are immutable';
        end if;

        if old.status = 'DRAFT' and new.status not in ('DRAFT', 'ACTIVE') then
          raise exception 'invalid Credit Conversion Rule lifecycle transition from DRAFT';
        elsif old.status = 'ACTIVE' and new.status not in ('ACTIVE', 'RETIRED') then
          raise exception 'invalid Credit Conversion Rule lifecycle transition from ACTIVE';
        elsif old.status = 'RETIRED' and new.status <> 'RETIRED' then
          raise exception 'retired Credit Conversion Rule lifecycle is immutable';
        end if;

        if old.status = 'ACTIVE' and (
          new.effective_at is distinct from old.effective_at
          or new.approved_by_membership_id is distinct from old.approved_by_membership_id
        ) then
          raise exception 'active Credit Conversion Rule approval facts are immutable';
        end if;

        if old.status = 'RETIRED' and new.retired_at is distinct from old.retired_at then
          raise exception 'retired Credit Conversion Rule timestamp is immutable';
        end if;

        return new;
      end;
      $$;

    create trigger credit_conversion_rules_lifecycle_guard
      before update or delete
      on control_plane.credit_conversion_rule_versions
      for each row execute function control_plane.protect_credit_conversion_rule_lifecycle();

    create table control_plane.recharge_orders (
      recharge_order_id uuid primary key,
      tenant_id uuid not null
        references control_plane.tenants(tenant_id),
      wallet_id uuid not null,
      buyer_user_id uuid not null
        references control_plane.users(user_id),
      buyer_membership_id uuid not null
        references control_plane.organization_memberships(membership_id),
      payment_mode text not null
        check (payment_mode in ('TEST', 'LIVE')),
      conversion_rule_version_id uuid not null
        references control_plane.credit_conversion_rule_versions(rule_version_id),
      amount_minor bigint not null
        check (amount_minor > 0),
      currency text not null,
      purchased_credits bigint not null
        check (purchased_credits > 0),
      bonus_credits bigint not null default 0
        check (bonus_credits >= 0),
      bonus_expires_in_days integer,
      status text not null
        check (
          status in (
            'created',
            'pending',
            'paid',
            'partially_refunded',
            'refunded',
            'cancelled',
            'disputed'
          )
        ),
      attribution_snapshot_id uuid
        references control_plane.referral_attributions(referral_attribution_id),
      idempotency_key text not null,
      request_digest text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint recharge_orders_wallet_tenant_fk
        foreign key (wallet_id, tenant_id)
        references control_plane.wallets(wallet_id, tenant_id),
      constraint recharge_orders_idempotency_uq
        unique (tenant_id, idempotency_key),
      constraint recharge_orders_currency_ck
        check (currency ~ '^[A-Z]{3}$'),
      constraint recharge_orders_bonus_expiry_ck
        check (
          (bonus_credits = 0 and bonus_expires_in_days is null)
          or
          (
            bonus_credits > 0
            and bonus_expires_in_days is not null
            and bonus_expires_in_days > 0
          )
        ),
      constraint recharge_orders_idempotency_key_ck
        check (
          idempotency_key = btrim(idempotency_key)
          and char_length(idempotency_key) between 1 and 200
        ),
      constraint recharge_orders_request_digest_ck
        check (request_digest ~ '^[0-9a-f]{64}$')
    );

    create index recharge_orders_tenant_created_idx
      on control_plane.recharge_orders (tenant_id, created_at desc, recharge_order_id);
    create index recharge_orders_wallet_created_idx
      on control_plane.recharge_orders (wallet_id, created_at desc, recharge_order_id);
    create index recharge_orders_status_idx
      on control_plane.recharge_orders (payment_mode, status, updated_at, recharge_order_id);

    create function control_plane.validate_recharge_order_scope_and_rule()
      returns trigger language plpgsql as $$
      declare
        tenant_organization_id uuid;
        rule_mode text;
        rule_status text;
        rule_currency text;
        rule_amount_minor bigint;
        rule_purchased_credits bigint;
        rule_bonus_credits bigint;
        rule_bonus_expires_in_days integer;
      begin
        if new.status <> 'created' then
          raise exception 'Recharge Order must be created in created status';
        end if;

        select organization_id
          into tenant_organization_id
        from control_plane.tenants
        where tenant_id = new.tenant_id;

        if not exists (
          select 1
          from control_plane.organization_memberships membership
          where membership.membership_id = new.buyer_membership_id
            and membership.user_id = new.buyer_user_id
            and membership.organization_id = tenant_organization_id
            and membership.status = 'active'
        ) then
          raise exception 'Recharge Order Buyer Membership must belong to its User and Tenant organization';
        end if;

        select
          payment_mode,
          status,
          currency,
          amount_minor,
          purchased_credits,
          bonus_credits,
          bonus_expires_in_days
        into
          rule_mode,
          rule_status,
          rule_currency,
          rule_amount_minor,
          rule_purchased_credits,
          rule_bonus_credits,
          rule_bonus_expires_in_days
        from control_plane.credit_conversion_rule_versions
        where rule_version_id = new.conversion_rule_version_id;

        if rule_status is distinct from 'ACTIVE' then
          raise exception 'Recharge Order requires an ACTIVE Credit Conversion Rule';
        end if;

        if new.payment_mode is distinct from rule_mode then
          raise exception 'Recharge Order payment mode must match its Credit Conversion Rule';
        end if;

        if new.amount_minor is distinct from rule_amount_minor then
          raise exception 'Recharge Order amount must match its frozen Credit Conversion Rule';
        end if;

        if new.currency is distinct from rule_currency then
          raise exception 'Recharge Order currency must match its frozen Credit Conversion Rule';
        end if;

        if new.purchased_credits is distinct from rule_purchased_credits
          or new.bonus_credits is distinct from rule_bonus_credits
          or new.bonus_expires_in_days is distinct from rule_bonus_expires_in_days then
          raise exception 'Recharge Order credits must match its frozen Credit Conversion Rule';
        end if;

        if new.attribution_snapshot_id is not null and not exists (
          select 1
          from control_plane.referral_attributions attribution
          where attribution.referral_attribution_id = new.attribution_snapshot_id
            and attribution.tenant_id = new.tenant_id
            and attribution.user_id = new.buyer_user_id
        ) then
          raise exception 'Recharge Order Attribution must belong to its Buyer and Tenant';
        end if;

        return new;
      end;
      $$;

    create trigger recharge_orders_scope_rule_guard
      before insert
      on control_plane.recharge_orders
      for each row execute function control_plane.validate_recharge_order_scope_and_rule();

    create function control_plane.protect_recharge_order_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'Recharge Order audit facts cannot be deleted';
        end if;

        if new.recharge_order_id is distinct from old.recharge_order_id
          or new.tenant_id is distinct from old.tenant_id
          or new.wallet_id is distinct from old.wallet_id
          or new.buyer_user_id is distinct from old.buyer_user_id
          or new.buyer_membership_id is distinct from old.buyer_membership_id
          or new.payment_mode is distinct from old.payment_mode
          or new.conversion_rule_version_id is distinct from old.conversion_rule_version_id
          or new.amount_minor is distinct from old.amount_minor
          or new.currency is distinct from old.currency
          or new.purchased_credits is distinct from old.purchased_credits
          or new.bonus_credits is distinct from old.bonus_credits
          or new.bonus_expires_in_days is distinct from old.bonus_expires_in_days
          or new.attribution_snapshot_id is distinct from old.attribution_snapshot_id
          or new.idempotency_key is distinct from old.idempotency_key
          or new.request_digest is distinct from old.request_digest
          or new.created_at is distinct from old.created_at then
          raise exception 'Recharge Order identity and frozen facts are immutable';
        end if;

        if old.status = 'created' and new.status not in ('created', 'pending', 'cancelled') then
          raise exception 'invalid Recharge Order status transition from created';
        elsif old.status = 'pending' and new.status not in ('pending', 'paid', 'cancelled') then
          raise exception 'invalid Recharge Order status transition from pending';
        elsif old.status = 'paid'
          and new.status not in ('paid', 'partially_refunded', 'refunded', 'disputed') then
          raise exception 'invalid Recharge Order status transition from paid';
        elsif old.status = 'partially_refunded'
          and new.status not in ('partially_refunded', 'refunded', 'disputed') then
          raise exception 'invalid Recharge Order status transition from partially_refunded';
        elsif old.status = 'disputed' and new.status not in ('disputed', 'refunded') then
          raise exception 'invalid Recharge Order status transition from disputed';
        elsif old.status in ('refunded', 'cancelled') and new.status <> old.status then
          raise exception 'terminal Recharge Order status cannot transition';
        end if;

        new.updated_at := now();
        return new;
      end;
      $$;

    create trigger recharge_orders_lifecycle_guard
      before update or delete
      on control_plane.recharge_orders
      for each row execute function control_plane.protect_recharge_order_lifecycle();

    create table control_plane.payment_events (
      payment_event_id uuid primary key,
      payment_mode text not null
        check (payment_mode in ('TEST', 'LIVE')),
      provider_code text not null,
      provider_event_id text not null,
      event_type text not null
        check (
          event_type in (
            'payment_succeeded',
            'payment_failed',
            'refund_succeeded',
            'chargeback_succeeded'
          )
        ),
      event_digest text not null,
      recharge_order_id uuid not null
        references control_plane.recharge_orders(recharge_order_id),
      amount_minor bigint not null
        check (amount_minor > 0),
      currency text not null,
      occurred_at timestamptz not null,
      received_at timestamptz not null default now(),
      processing_status text not null default 'received'
        check (processing_status in ('received', 'applied', 'rejected')),
      error_code text,
      constraint payment_events_provider_identity_uq
        unique (provider_code, provider_event_id),
      constraint payment_events_provider_code_ck
        check (
          provider_code = lower(btrim(provider_code))
          and provider_code ~ '^[a-z0-9][a-z0-9._-]{1,63}$'
        ),
      constraint payment_events_provider_event_id_ck
        check (
          provider_event_id = btrim(provider_event_id)
          and char_length(provider_event_id) between 1 and 200
        ),
      constraint payment_events_digest_ck
        check (event_digest ~ '^[0-9a-f]{64}$'),
      constraint payment_events_currency_ck
        check (currency ~ '^[A-Z]{3}$'),
      constraint payment_events_error_code_ck
        check (
          error_code is null
          or error_code in (
            'invalid_signature',
            'unknown_order',
            'amount_mismatch',
            'currency_mismatch',
            'mode_mismatch',
            'duplicate_conflict',
            'unsupported_event_type',
            'provider_unavailable',
            'internal_processing_error'
          )
        ),
      constraint payment_events_processing_evidence_ck
        check (
          (processing_status in ('received', 'applied') and error_code is null)
          or
          (processing_status = 'rejected' and error_code is not null)
        )
    );

    create index payment_events_received_idx
      on control_plane.payment_events (
        processing_status,
        received_at,
        payment_event_id
      );
    create index payment_events_order_idx
      on control_plane.payment_events (
        recharge_order_id,
        occurred_at,
        payment_event_id
      );

    create function control_plane.validate_payment_event_order_facts()
      returns trigger language plpgsql as $$
      declare
        order_mode text;
        order_amount_minor bigint;
        order_currency text;
      begin
        if new.processing_status <> 'received' or new.error_code is not null then
          raise exception 'Payment Event must enter the Inbox as received without error evidence';
        end if;

        select payment_mode, amount_minor, currency
          into order_mode, order_amount_minor, order_currency
        from control_plane.recharge_orders
        where recharge_order_id = new.recharge_order_id;

        if new.payment_mode is distinct from order_mode then
          raise exception 'Payment Event mode must match its Recharge Order';
        end if;

        if new.amount_minor is distinct from order_amount_minor then
          raise exception 'Payment Event amount must match its Recharge Order';
        end if;

        if new.currency is distinct from order_currency then
          raise exception 'Payment Event currency must match its Recharge Order';
        end if;

        return new;
      end;
      $$;

    create trigger payment_events_order_facts_guard
      before insert
      on control_plane.payment_events
      for each row execute function control_plane.validate_payment_event_order_facts();

    create function control_plane.protect_payment_event_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'Payment Event audit facts cannot be deleted';
        end if;

        if new.payment_event_id is distinct from old.payment_event_id
          or new.payment_mode is distinct from old.payment_mode
          or new.provider_code is distinct from old.provider_code
          or new.provider_event_id is distinct from old.provider_event_id
          or new.event_type is distinct from old.event_type
          or new.event_digest is distinct from old.event_digest
          or new.recharge_order_id is distinct from old.recharge_order_id
          or new.amount_minor is distinct from old.amount_minor
          or new.currency is distinct from old.currency
          or new.occurred_at is distinct from old.occurred_at
          or new.received_at is distinct from old.received_at then
          raise exception 'Payment Event original facts are immutable';
        end if;

        if old.processing_status = 'received'
          and new.processing_status not in ('received', 'applied', 'rejected') then
          raise exception 'invalid Payment Event processing status transition';
        elsif old.processing_status in ('applied', 'rejected')
          and new.processing_status <> old.processing_status then
          raise exception 'terminal Payment Event processing status cannot transition';
        end if;

        if old.processing_status <> 'received'
          and new.error_code is distinct from old.error_code then
          raise exception 'terminal Payment Event error evidence is immutable';
        end if;

        return new;
      end;
      $$;

    create trigger payment_events_lifecycle_guard
      before update or delete
      on control_plane.payment_events
      for each row execute function control_plane.protect_payment_event_lifecycle();

    create table control_plane.recharge_order_events (
      recharge_order_event_id uuid primary key,
      recharge_order_id uuid not null
        references control_plane.recharge_orders(recharge_order_id),
      event_type text not null
        check (
          event_type in (
            'created',
            'pending',
            'paid',
            'partially_refunded',
            'refunded',
            'cancelled',
            'disputed'
          )
        ),
      source_payment_event_id uuid
        references control_plane.payment_events(payment_event_id),
      actor_type text not null
        check (actor_type in ('system', 'user', 'admin', 'provider')),
      actor_id text not null,
      reason_code text not null,
      occurred_at timestamptz not null,
      created_at timestamptz not null default now(),
      constraint recharge_order_events_actor_id_ck
        check (
          actor_id = btrim(actor_id)
          and char_length(actor_id) between 1 and 200
        ),
      constraint recharge_order_events_reason_code_ck
        check (
          reason_code = btrim(reason_code)
          and reason_code ~ '^[a-z][a-z0-9_]{1,99}$'
        ),
      constraint recharge_order_events_payment_source_ck
        check (
          (
            event_type in ('paid', 'partially_refunded', 'refunded', 'disputed')
            and source_payment_event_id is not null
          )
          or
          (
            event_type in ('created', 'pending', 'cancelled')
            and source_payment_event_id is null
          )
        )
    );

    create unique index recharge_order_events_created_uq
      on control_plane.recharge_order_events (recharge_order_id)
      where event_type = 'created';
    create index recharge_order_events_history_idx
      on control_plane.recharge_order_events (
        recharge_order_id,
        occurred_at,
        recharge_order_event_id
      );

    create function control_plane.validate_recharge_order_event()
      returns trigger language plpgsql as $$
      declare
        order_status text;
      begin
        select status
          into order_status
        from control_plane.recharge_orders
        where recharge_order_id = new.recharge_order_id;

        if new.event_type is distinct from order_status then
          raise exception 'Recharge Order Event type must match current Order status';
        end if;

        if new.source_payment_event_id is not null and not exists (
          select 1
          from control_plane.payment_events payment_event
          where payment_event.payment_event_id = new.source_payment_event_id
            and payment_event.recharge_order_id = new.recharge_order_id
        ) then
          raise exception 'Recharge Order Event Payment source must belong to its Order';
        end if;

        return new;
      end;
      $$;

    create trigger recharge_order_events_validation_guard
      before insert
      on control_plane.recharge_order_events
      for each row execute function control_plane.validate_recharge_order_event();

    create function control_plane.protect_recharge_order_event()
      returns trigger language plpgsql as $$
      begin
        raise exception 'Recharge Order Event is append-only and cannot be updated or deleted';
      end;
      $$;

    create trigger recharge_order_events_append_only_guard
      before update or delete
      on control_plane.recharge_order_events
      for each row execute function control_plane.protect_recharge_order_event();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if to_regclass('control_plane.recharge_order_events') is not null
        and exists (select 1 from control_plane.recharge_order_events) then
        raise exception 'recharge payment rollback blocked: Order Event audit evidence exists';
      end if;

      if to_regclass('control_plane.payment_events') is not null
        and exists (select 1 from control_plane.payment_events) then
        raise exception 'recharge payment rollback blocked: Payment Event audit evidence exists';
      end if;

      if to_regclass('control_plane.recharge_orders') is not null
        and exists (select 1 from control_plane.recharge_orders) then
        raise exception 'recharge payment rollback blocked: Recharge Order audit facts exist';
      end if;

      if to_regclass('control_plane.credit_conversion_rule_versions') is not null
        and exists (select 1 from control_plane.credit_conversion_rule_versions) then
        raise exception 'recharge payment rollback blocked: Credit Conversion Rule audit facts exist';
      end if;
    end;
    $$;

    drop trigger if exists recharge_order_events_append_only_guard
      on control_plane.recharge_order_events;
    drop function if exists control_plane.protect_recharge_order_event();
    drop trigger if exists recharge_order_events_validation_guard
      on control_plane.recharge_order_events;
    drop function if exists control_plane.validate_recharge_order_event();
    drop table if exists control_plane.recharge_order_events;

    drop trigger if exists payment_events_lifecycle_guard
      on control_plane.payment_events;
    drop function if exists control_plane.protect_payment_event_lifecycle();
    drop trigger if exists payment_events_order_facts_guard
      on control_plane.payment_events;
    drop function if exists control_plane.validate_payment_event_order_facts();
    drop table if exists control_plane.payment_events;

    drop trigger if exists recharge_orders_lifecycle_guard
      on control_plane.recharge_orders;
    drop function if exists control_plane.protect_recharge_order_lifecycle();
    drop trigger if exists recharge_orders_scope_rule_guard
      on control_plane.recharge_orders;
    drop function if exists control_plane.validate_recharge_order_scope_and_rule();
    drop table if exists control_plane.recharge_orders;

    drop trigger if exists credit_conversion_rules_lifecycle_guard
      on control_plane.credit_conversion_rule_versions;
    drop function if exists control_plane.protect_credit_conversion_rule_lifecycle();
    drop trigger if exists credit_conversion_rules_approval_guard
      on control_plane.credit_conversion_rule_versions;
    drop function if exists control_plane.validate_credit_conversion_rule_approval();
    drop table if exists control_plane.credit_conversion_rule_versions;

    alter table control_plane.wallets
      drop constraint if exists wallets_wallet_tenant_uq;
  `);
}
