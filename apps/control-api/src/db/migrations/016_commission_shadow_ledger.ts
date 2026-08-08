import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create function control_plane.is_active_platform_admin(
      checked_membership_id uuid
    ) returns boolean
      language sql
      stable
      as $$
        select exists (
          select 1
          from control_plane.organization_memberships membership
          join control_plane.organization_membership_roles membership_role
            on membership_role.membership_id = membership.membership_id
          join control_plane.organizations organization
            on organization.organization_id = membership.organization_id
          where membership.membership_id = checked_membership_id
            and membership.status = 'active'
            and membership_role.role_code = 'platform_admin'
            and organization.organization_type = 'PLATFORM'
            and organization.status = 'active'
        );
      $$;

    create table control_plane.commission_rule_versions (
      commission_rule_version_id uuid primary key,
      rule_code text not null,
      version_label text not null,
      payment_mode text not null
        check (payment_mode in ('TEST', 'LIVE')),
      status text not null
        check (status in ('DRAFT', 'ACTIVE', 'RETIRED')),
      scope_type text not null
        check (scope_type = 'DIRECT_ATTRIBUTION'),
      basis_type text not null
        check (basis_type = 'NET_PAID_AMOUNT'),
      currency text not null,
      rate_numerator bigint not null
        check (rate_numerator > 0),
      rate_denominator bigint not null
        check (rate_denominator > 0),
      rounding_mode text not null
        check (rounding_mode in ('FLOOR', 'CEILING', 'HALF_UP')),
      refund_observation_days integer not null
        check (refund_observation_days >= 0),
      rule_digest text not null,
      effective_at timestamptz,
      retired_at timestamptz,
      approved_by_membership_id uuid
        references control_plane.organization_memberships(membership_id),
      created_at timestamptz not null default now(),
      constraint commission_rules_identity_uq
        unique (rule_code, version_label, payment_mode),
      constraint commission_rules_code_ck
        check (
          rule_code = upper(btrim(rule_code))
          and rule_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
        ),
      constraint commission_rules_version_ck
        check (
          version_label = btrim(version_label)
          and char_length(version_label) between 1 and 100
        ),
      constraint commission_rules_currency_ck
        check (currency ~ '^[A-Z]{3}$'),
      constraint commission_rules_digest_ck
        check (rule_digest ~ '^[0-9a-f]{64}$'),
      constraint commission_rules_lifecycle_evidence_ck
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
            and retired_at > effective_at
            and approved_by_membership_id is not null
          )
        )
    );

    create index commission_rules_scope_window_idx
      on control_plane.commission_rule_versions (
        payment_mode,
        currency,
        scope_type,
        effective_at,
        retired_at
      )
      where status in ('ACTIVE', 'RETIRED');

    create function control_plane.validate_commission_rule()
      returns trigger language plpgsql as $$
      begin
        if new.status in ('ACTIVE', 'RETIRED')
          and not control_plane.is_active_platform_admin(new.approved_by_membership_id) then
          raise exception 'Commission Rule activation requires active PLATFORM administrator approval';
        end if;

        if new.status in ('ACTIVE', 'RETIRED') then
          perform pg_advisory_xact_lock(
            hashtextextended(
              new.payment_mode || ':' || new.currency || ':' || new.scope_type,
              0
            )
          );

          if exists (
            select 1
            from control_plane.commission_rule_versions existing_rule
            where existing_rule.commission_rule_version_id <> new.commission_rule_version_id
              and existing_rule.payment_mode = new.payment_mode
              and existing_rule.currency = new.currency
              and existing_rule.scope_type = new.scope_type
              and existing_rule.status in ('ACTIVE', 'RETIRED')
              and tstzrange(
                existing_rule.effective_at,
                existing_rule.retired_at,
                '[)'
              ) && tstzrange(new.effective_at, new.retired_at, '[)')
          ) then
            raise exception 'Commission Rule effective window must not overlap another active or retired window';
          end if;
        end if;

        return new;
      end;
      $$;

    create trigger commission_rules_validation_guard
      before insert or update
      on control_plane.commission_rule_versions
      for each row execute function control_plane.validate_commission_rule();

    create function control_plane.protect_commission_rule_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'Commission Rule audit facts cannot be deleted';
        end if;

        if new.commission_rule_version_id is distinct from old.commission_rule_version_id
          or new.rule_code is distinct from old.rule_code
          or new.version_label is distinct from old.version_label
          or new.payment_mode is distinct from old.payment_mode
          or new.scope_type is distinct from old.scope_type
          or new.basis_type is distinct from old.basis_type
          or new.currency is distinct from old.currency
          or new.rate_numerator is distinct from old.rate_numerator
          or new.rate_denominator is distinct from old.rate_denominator
          or new.rounding_mode is distinct from old.rounding_mode
          or new.refund_observation_days is distinct from old.refund_observation_days
          or new.rule_digest is distinct from old.rule_digest
          or new.created_at is distinct from old.created_at then
          raise exception 'Commission Rule calculation facts are immutable';
        end if;

        if old.status = 'DRAFT' and new.status not in ('DRAFT', 'ACTIVE') then
          raise exception 'invalid Commission Rule lifecycle transition from DRAFT';
        elsif old.status = 'ACTIVE' and new.status not in ('ACTIVE', 'RETIRED') then
          raise exception 'invalid Commission Rule lifecycle transition from ACTIVE';
        elsif old.status = 'RETIRED' and new.status <> 'RETIRED' then
          raise exception 'RETIRED Commission Rule cannot transition';
        end if;

        if old.status = new.status and (
          new.effective_at is distinct from old.effective_at
          or new.retired_at is distinct from old.retired_at
          or new.approved_by_membership_id is distinct from old.approved_by_membership_id
        ) then
          raise exception 'Commission Rule lifecycle evidence is immutable within a status';
        end if;

        if old.status = 'ACTIVE' and new.status = 'RETIRED' and (
          new.effective_at is distinct from old.effective_at
          or new.approved_by_membership_id is distinct from old.approved_by_membership_id
        ) then
          raise exception 'Commission Rule activation evidence is immutable';
        end if;

        return new;
      end;
      $$;

    create trigger commission_rules_lifecycle_guard
      before update or delete
      on control_plane.commission_rule_versions
      for each row execute function control_plane.protect_commission_rule_lifecycle();

    create table control_plane.commission_calculation_outcomes (
      commission_calculation_outcome_id uuid primary key,
      source_payment_event_id uuid not null
        references control_plane.payment_events(payment_event_id),
      recharge_order_id uuid not null
        references control_plane.recharge_orders(recharge_order_id),
      referral_attribution_id uuid
        references control_plane.referral_attributions(referral_attribution_id),
      beneficiary_channel_id uuid
        references control_plane.channels(channel_id),
      commission_rule_version_id uuid
        references control_plane.commission_rule_versions(commission_rule_version_id),
      basis_amount_minor bigint not null
        check (basis_amount_minor > 0),
      currency text not null,
      outcome text not null
        check (
          outcome in (
            'accrued',
            'not_attributed',
            'attribution_expired',
            'manual_review'
          )
        ),
      reason_code text not null,
      calculation_snapshot jsonb not null,
      calculation_digest text not null,
      occurred_at timestamptz not null,
      created_at timestamptz not null default now(),
      constraint commission_outcomes_source_event_uq unique (source_payment_event_id),
      constraint commission_outcomes_currency_ck check (currency ~ '^[A-Z]{3}$'),
      constraint commission_outcomes_reason_ck
        check (
          reason_code = lower(btrim(reason_code))
          and reason_code ~ '^[a-z][a-z0-9_]{1,99}$'
        ),
      constraint commission_outcomes_snapshot_ck
        check (jsonb_typeof(calculation_snapshot) = 'object'),
      constraint commission_outcomes_digest_ck
        check (calculation_digest ~ '^[0-9a-f]{64}$'),
      constraint commission_outcomes_accrued_evidence_ck
        check (
          outcome <> 'accrued'
          or (
            referral_attribution_id is not null
            and beneficiary_channel_id is not null
            and commission_rule_version_id is not null
          )
        )
    );

    create index commission_outcomes_order_idx
      on control_plane.commission_calculation_outcomes (
        recharge_order_id,
        occurred_at,
        commission_calculation_outcome_id
      );
    create index commission_outcomes_channel_idx
      on control_plane.commission_calculation_outcomes (
        beneficiary_channel_id,
        occurred_at desc,
        commission_calculation_outcome_id
      )
      where beneficiary_channel_id is not null;
    create index commission_outcomes_manual_review_idx
      on control_plane.commission_calculation_outcomes (
        occurred_at,
        commission_calculation_outcome_id
      )
      where outcome = 'manual_review';

    create function control_plane.validate_commission_calculation_outcome()
      returns trigger language plpgsql as $$
      declare
        payment_event record;
        recharge_order record;
        attribution record;
        commission_rule record;
      begin
        select * into payment_event
        from control_plane.payment_events
        where payment_event_id = new.source_payment_event_id;

        if payment_event.payment_event_id is null
          or payment_event.event_type <> 'payment_succeeded'
          or payment_event.processing_status <> 'applied' then
          raise exception 'Commission Calculation Outcome requires an applied payment_succeeded Payment Event';
        end if;

        select * into recharge_order
        from control_plane.recharge_orders
        where recharge_order_id = new.recharge_order_id;

        if recharge_order.recharge_order_id is null
          or recharge_order.recharge_order_id is distinct from payment_event.recharge_order_id
          or recharge_order.status <> 'paid' then
          raise exception 'Commission Calculation Outcome Payment Event and paid Recharge Order must match';
        end if;

        if new.basis_amount_minor is distinct from payment_event.amount_minor
          or new.basis_amount_minor is distinct from recharge_order.amount_minor then
          raise exception 'Commission Calculation Outcome basis must equal Payment Event and Order net paid amount';
        end if;

        if new.currency is distinct from payment_event.currency
          or new.currency is distinct from recharge_order.currency then
          raise exception 'Commission Calculation Outcome currency must match Payment Event and Order';
        end if;

        if new.occurred_at is distinct from payment_event.occurred_at then
          raise exception 'Commission Calculation Outcome occurred_at must match Payment Event';
        end if;

        if new.outcome = 'not_attributed' then
          if recharge_order.attribution_snapshot_id is not null
            or new.referral_attribution_id is not null
            or new.beneficiary_channel_id is not null
            or new.commission_rule_version_id is not null then
            raise exception 'not_attributed Commission outcome cannot contain attribution, Channel or Rule evidence';
          end if;
          return new;
        end if;

        if new.beneficiary_channel_id is not null
          and new.referral_attribution_id is null then
          raise exception 'Commission Calculation Outcome beneficiary Channel requires Attribution evidence';
        end if;

        if new.referral_attribution_id is not null then
          select * into attribution
          from control_plane.referral_attributions
          where referral_attribution_id = new.referral_attribution_id;

          if attribution.referral_attribution_id is null
            or new.referral_attribution_id is distinct from recharge_order.attribution_snapshot_id then
            raise exception 'Commission Calculation Outcome Attribution must match the frozen Recharge Order snapshot';
          end if;

          if new.beneficiary_channel_id is not null
            and new.beneficiary_channel_id is distinct from attribution.referrer_channel_id then
            raise exception 'Commission Calculation Outcome beneficiary Channel must match Attribution';
          end if;
        end if;

        if new.commission_rule_version_id is not null then
          select * into commission_rule
          from control_plane.commission_rule_versions
          where commission_rule_version_id = new.commission_rule_version_id;

          if commission_rule.commission_rule_version_id is null
            or commission_rule.payment_mode is distinct from payment_event.payment_mode
            or commission_rule.currency is distinct from new.currency then
            raise exception 'Commission Calculation Outcome Rule must match Payment mode and currency';
          end if;
        end if;

        if new.outcome = 'accrued' then
          if attribution.status <> 'active'
            or attribution.referrer_channel_id is null
            or payment_event.occurred_at < attribution.effective_from
            or attribution.protected_until is null
            or payment_event.occurred_at >= attribution.protected_until then
            raise exception 'accrued Commission outcome requires active, unexpired direct Attribution';
          end if;

          if commission_rule.status <> 'ACTIVE'
            or payment_event.occurred_at < commission_rule.effective_at
            or (
              commission_rule.retired_at is not null
              and payment_event.occurred_at >= commission_rule.retired_at
            ) then
            raise exception 'accrued Commission outcome requires a matching ACTIVE Rule window';
          end if;
        elsif new.outcome = 'attribution_expired' then
          if attribution.referral_attribution_id is null
            or attribution.protected_until is null
            or payment_event.occurred_at < attribution.protected_until then
            raise exception 'attribution_expired outcome requires expired Attribution evidence';
          end if;
        end if;

        return new;
      end;
      $$;

    create trigger commission_outcomes_validation_guard
      before insert
      on control_plane.commission_calculation_outcomes
      for each row execute function control_plane.validate_commission_calculation_outcome();

    create function control_plane.protect_commission_append_only_fact()
      returns trigger language plpgsql as $$
      begin
        raise exception '% is append-only and immutable', tg_table_name;
      end;
      $$;

    create trigger commission_outcomes_append_only_guard
      before update or delete
      on control_plane.commission_calculation_outcomes
      for each row execute function control_plane.protect_commission_append_only_fact();

    create table control_plane.commission_accruals (
      commission_accrual_id uuid primary key,
      calculation_outcome_id uuid not null
        references control_plane.commission_calculation_outcomes(commission_calculation_outcome_id),
      source_payment_event_id uuid not null
        references control_plane.payment_events(payment_event_id),
      recharge_order_id uuid not null
        references control_plane.recharge_orders(recharge_order_id),
      referral_attribution_id uuid not null
        references control_plane.referral_attributions(referral_attribution_id),
      beneficiary_channel_id uuid not null
        references control_plane.channels(channel_id),
      commission_rule_version_id uuid not null
        references control_plane.commission_rule_versions(commission_rule_version_id),
      basis_amount_minor bigint not null
        check (basis_amount_minor > 0),
      commission_amount_minor bigint not null
        check (commission_amount_minor > 0),
      currency text not null,
      eligible_at timestamptz not null,
      calculation_snapshot jsonb not null,
      calculation_digest text not null,
      occurred_at timestamptz not null,
      created_at timestamptz not null default now(),
      constraint commission_accruals_outcome_uq unique (calculation_outcome_id),
      constraint commission_accruals_source_event_uq unique (source_payment_event_id),
      constraint commission_accruals_currency_ck check (currency ~ '^[A-Z]{3}$'),
      constraint commission_accruals_snapshot_ck
        check (jsonb_typeof(calculation_snapshot) = 'object'),
      constraint commission_accruals_digest_ck
        check (calculation_digest ~ '^[0-9a-f]{64}$'),
      constraint commission_accruals_created_ck check (created_at >= occurred_at),
      constraint commission_accruals_eligible_ck check (eligible_at >= occurred_at)
    );

    create index commission_accruals_channel_eligible_idx
      on control_plane.commission_accruals (
        beneficiary_channel_id,
        currency,
        eligible_at,
        commission_accrual_id
      );

    create function control_plane.validate_commission_accrual()
      returns trigger language plpgsql as $$
      declare
        outcome record;
        payment_event record;
        attribution record;
        organization_status text;
        commission_rule record;
        expected_amount numeric;
        expected_eligible_at timestamptz;
      begin
        select * into outcome
        from control_plane.commission_calculation_outcomes
        where commission_calculation_outcome_id = new.calculation_outcome_id;

        if outcome.commission_calculation_outcome_id is null
          or outcome.outcome <> 'accrued'
          or new.source_payment_event_id is distinct from outcome.source_payment_event_id
          or new.recharge_order_id is distinct from outcome.recharge_order_id
          or new.referral_attribution_id is distinct from outcome.referral_attribution_id
          or new.beneficiary_channel_id is distinct from outcome.beneficiary_channel_id
          or new.commission_rule_version_id is distinct from outcome.commission_rule_version_id
          or new.basis_amount_minor is distinct from outcome.basis_amount_minor
          or new.currency is distinct from outcome.currency
          or new.occurred_at is distinct from outcome.occurred_at then
          raise exception 'Commission Accrual facts must exactly match its accrued Calculation Outcome';
        end if;

        select * into payment_event
        from control_plane.payment_events
        where payment_event_id = new.source_payment_event_id;

        if payment_event.event_type <> 'payment_succeeded'
          or payment_event.processing_status <> 'applied'
          or payment_event.recharge_order_id is distinct from new.recharge_order_id
          or payment_event.amount_minor is distinct from new.basis_amount_minor
          or payment_event.currency is distinct from new.currency
          or payment_event.occurred_at is distinct from new.occurred_at then
          raise exception 'Commission Accrual Payment Event facts do not match';
        end if;

        select * into attribution
        from control_plane.referral_attributions
        where referral_attribution_id = new.referral_attribution_id;

        if attribution.status <> 'active'
          or attribution.referrer_channel_id is distinct from new.beneficiary_channel_id
          or new.occurred_at < attribution.effective_from
          or attribution.protected_until is null
          or new.occurred_at >= attribution.protected_until then
          raise exception 'Commission Accrual requires active, unexpired direct Attribution';
        end if;

        select organization.status
          into organization_status
        from control_plane.channels channel
        join control_plane.organizations organization
          on organization.organization_id = channel.organization_id
        where channel.channel_id = new.beneficiary_channel_id;

        if organization_status is distinct from 'active' then
          raise exception 'Commission Accrual beneficiary Channel Organization must be active';
        end if;

        select * into commission_rule
        from control_plane.commission_rule_versions
        where commission_rule_version_id = new.commission_rule_version_id;

        if commission_rule.status <> 'ACTIVE'
          or commission_rule.payment_mode is distinct from payment_event.payment_mode
          or commission_rule.currency is distinct from new.currency
          or commission_rule.scope_type <> 'DIRECT_ATTRIBUTION'
          or commission_rule.basis_type <> 'NET_PAID_AMOUNT'
          or new.occurred_at < commission_rule.effective_at
          or (
            commission_rule.retired_at is not null
            and new.occurred_at >= commission_rule.retired_at
          ) then
          raise exception 'Commission Accrual requires matching ACTIVE Rule facts';
        end if;

        if commission_rule.rounding_mode = 'FLOOR' then
          expected_amount := floor(
            new.basis_amount_minor::numeric * commission_rule.rate_numerator
            / commission_rule.rate_denominator
          );
        elsif commission_rule.rounding_mode = 'CEILING' then
          expected_amount := ceil(
            new.basis_amount_minor::numeric * commission_rule.rate_numerator
            / commission_rule.rate_denominator
          );
        else
          expected_amount := floor(
            new.basis_amount_minor::numeric * commission_rule.rate_numerator
            / commission_rule.rate_denominator + 0.5
          );
        end if;

        if expected_amount <= 0
          or new.commission_amount_minor::numeric is distinct from expected_amount then
          raise exception 'Commission Accrual amount must match the integer Rule calculation';
        end if;

        expected_eligible_at := new.occurred_at
          + make_interval(days => commission_rule.refund_observation_days);
        if new.eligible_at is distinct from expected_eligible_at then
          raise exception 'Commission Accrual eligible_at must match the Rule refund observation window';
        end if;

        return new;
      end;
      $$;

    create trigger commission_accruals_validation_guard
      before insert
      on control_plane.commission_accruals
      for each row execute function control_plane.validate_commission_accrual();

    create trigger commission_accruals_append_only_guard
      before update or delete
      on control_plane.commission_accruals
      for each row execute function control_plane.protect_commission_append_only_fact();

    create table control_plane.commission_reversals (
      commission_reversal_id uuid primary key,
      commission_accrual_id uuid not null
        references control_plane.commission_accruals(commission_accrual_id),
      source_payment_event_id uuid not null
        references control_plane.payment_events(payment_event_id),
      reversal_type text not null
        check (reversal_type in ('refund', 'chargeback')),
      amount_minor bigint not null
        check (amount_minor > 0),
      currency text not null,
      reversal_snapshot jsonb not null,
      reversal_digest text not null,
      occurred_at timestamptz not null,
      created_at timestamptz not null default now(),
      constraint commission_reversals_source_event_uq unique (source_payment_event_id),
      constraint commission_reversals_currency_ck check (currency ~ '^[A-Z]{3}$'),
      constraint commission_reversals_snapshot_ck
        check (jsonb_typeof(reversal_snapshot) = 'object'),
      constraint commission_reversals_digest_ck
        check (reversal_digest ~ '^[0-9a-f]{64}$'),
      constraint commission_reversals_created_ck check (created_at >= occurred_at)
    );

    create index commission_reversals_accrual_idx
      on control_plane.commission_reversals (
        commission_accrual_id,
        occurred_at,
        commission_reversal_id
      );

    create function control_plane.validate_commission_reversal()
      returns trigger language plpgsql as $$
      declare
        accrual record;
        payment_event record;
        reversed_amount bigint;
        expected_event_type text;
      begin
        select * into accrual
        from control_plane.commission_accruals
        where commission_accrual_id = new.commission_accrual_id
        for update;

        select * into payment_event
        from control_plane.payment_events
        where payment_event_id = new.source_payment_event_id;

        expected_event_type := case new.reversal_type
          when 'refund' then 'refund_succeeded'
          else 'chargeback_succeeded'
        end;

        if payment_event.payment_event_id is null
          or payment_event.event_type is distinct from expected_event_type
          or payment_event.recharge_order_id is distinct from accrual.recharge_order_id
          or payment_event.currency is distinct from accrual.currency
          or new.currency is distinct from accrual.currency
          or new.occurred_at is distinct from payment_event.occurred_at then
          raise exception 'Commission Reversal source Payment Event must match its Accrual and reversal type';
        end if;

        select coalesce(sum(existing_reversal.amount_minor), 0)
          into reversed_amount
        from control_plane.commission_reversals existing_reversal
        where existing_reversal.commission_accrual_id = new.commission_accrual_id;

        if reversed_amount + new.amount_minor > accrual.commission_amount_minor then
          raise exception 'Commission Reversal total cannot exceed original Accrual amount';
        end if;

        return new;
      end;
      $$;

    create trigger commission_reversals_validation_guard
      before insert
      on control_plane.commission_reversals
      for each row execute function control_plane.validate_commission_reversal();

    create trigger commission_reversals_append_only_guard
      before update or delete
      on control_plane.commission_reversals
      for each row execute function control_plane.protect_commission_append_only_fact();

    create table control_plane.commission_settlements (
      commission_settlement_id uuid primary key,
      beneficiary_channel_id uuid not null
        references control_plane.channels(channel_id),
      currency text not null,
      period_start date not null,
      period_end date not null,
      cutoff_at timestamptz not null,
      status text not null
        check (status in ('draft', 'reviewed', 'approved')),
      idempotency_key text not null,
      request_digest text not null,
      settlement_snapshot jsonb not null,
      settlement_digest text not null,
      created_by_membership_id uuid not null
        references control_plane.organization_memberships(membership_id),
      reviewed_by_membership_id uuid
        references control_plane.organization_memberships(membership_id),
      reviewed_at timestamptz,
      approved_by_membership_id uuid
        references control_plane.organization_memberships(membership_id),
      approved_at timestamptz,
      created_at timestamptz not null default now(),
      constraint commission_settlements_idempotency_uq unique (idempotency_key),
      constraint commission_settlements_scope_period_uq
        unique (beneficiary_channel_id, currency, period_start, period_end),
      constraint commission_settlements_currency_ck check (currency ~ '^[A-Z]{3}$'),
      constraint commission_settlements_period_ck
        check (
          period_start = date_trunc('month', period_start::timestamp)::date
          and period_end = (period_start + interval '1 month')::date
          and cutoff_at >= period_end::timestamp at time zone 'UTC'
        ),
      constraint commission_settlements_idempotency_ck
        check (
          idempotency_key = btrim(idempotency_key)
          and char_length(idempotency_key) between 1 and 200
        ),
      constraint commission_settlements_request_digest_ck
        check (request_digest ~ '^[0-9a-f]{64}$'),
      constraint commission_settlements_snapshot_ck
        check (jsonb_typeof(settlement_snapshot) = 'object'),
      constraint commission_settlements_digest_ck
        check (settlement_digest ~ '^[0-9a-f]{64}$'),
      constraint commission_settlements_status_evidence_ck
        check (
          (
            status = 'draft'
            and reviewed_by_membership_id is null
            and reviewed_at is null
            and approved_by_membership_id is null
            and approved_at is null
          )
          or
          (
            status = 'reviewed'
            and reviewed_by_membership_id is not null
            and reviewed_at is not null
            and approved_by_membership_id is null
            and approved_at is null
          )
          or
          (
            status = 'approved'
            and reviewed_by_membership_id is not null
            and reviewed_at is not null
            and approved_by_membership_id is not null
            and approved_at is not null
            and approved_at >= reviewed_at
          )
        )
    );

    create index commission_settlements_channel_status_idx
      on control_plane.commission_settlements (
        beneficiary_channel_id,
        status,
        period_start desc,
        commission_settlement_id
      );

    create function control_plane.validate_commission_settlement_actors()
      returns trigger language plpgsql as $$
      begin
        if not control_plane.is_active_platform_admin(new.created_by_membership_id) then
          raise exception 'Commission Settlement creation requires an active PLATFORM administrator';
        end if;

        if new.reviewed_by_membership_id is not null
          and not control_plane.is_active_platform_admin(new.reviewed_by_membership_id) then
          raise exception 'Commission Settlement review requires an active PLATFORM administrator';
        end if;

        if new.approved_by_membership_id is not null
          and not control_plane.is_active_platform_admin(new.approved_by_membership_id) then
          raise exception 'Commission Settlement approval requires an active PLATFORM administrator';
        end if;

        return new;
      end;
      $$;

    create trigger commission_settlements_actor_guard
      before insert or update
      on control_plane.commission_settlements
      for each row execute function control_plane.validate_commission_settlement_actors();

    create function control_plane.protect_commission_settlement_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'Commission Settlement audit facts cannot be deleted';
        end if;

        if new.commission_settlement_id is distinct from old.commission_settlement_id
          or new.beneficiary_channel_id is distinct from old.beneficiary_channel_id
          or new.currency is distinct from old.currency
          or new.period_start is distinct from old.period_start
          or new.period_end is distinct from old.period_end
          or new.cutoff_at is distinct from old.cutoff_at
          or new.idempotency_key is distinct from old.idempotency_key
          or new.request_digest is distinct from old.request_digest
          or new.settlement_snapshot is distinct from old.settlement_snapshot
          or new.settlement_digest is distinct from old.settlement_digest
          or new.created_by_membership_id is distinct from old.created_by_membership_id
          or new.created_at is distinct from old.created_at then
          raise exception 'Commission Settlement core facts are immutable';
        end if;

        if old.status = 'draft' and new.status not in ('draft', 'reviewed') then
          raise exception 'invalid Commission Settlement transition from draft';
        elsif old.status = 'reviewed' and new.status not in ('reviewed', 'approved') then
          raise exception 'invalid Commission Settlement transition from reviewed';
        elsif old.status = 'approved' and new.status <> 'approved' then
          raise exception 'approved Commission Settlement cannot transition';
        end if;

        if old.status = new.status and (
          new.reviewed_by_membership_id is distinct from old.reviewed_by_membership_id
          or new.reviewed_at is distinct from old.reviewed_at
          or new.approved_by_membership_id is distinct from old.approved_by_membership_id
          or new.approved_at is distinct from old.approved_at
        ) then
          raise exception 'Commission Settlement lifecycle evidence is immutable within a status';
        end if;

        if old.status = 'reviewed' and new.status = 'approved' and (
          new.reviewed_by_membership_id is distinct from old.reviewed_by_membership_id
          or new.reviewed_at is distinct from old.reviewed_at
        ) then
          raise exception 'Commission Settlement review evidence is immutable';
        end if;

        return new;
      end;
      $$;

    create trigger commission_settlements_lifecycle_guard
      before update or delete
      on control_plane.commission_settlements
      for each row execute function control_plane.protect_commission_settlement_lifecycle();

    create table control_plane.commission_settlement_items (
      commission_settlement_item_id uuid primary key,
      commission_settlement_id uuid not null
        references control_plane.commission_settlements(commission_settlement_id),
      entry_type text not null
        check (entry_type in ('accrual', 'reversal')),
      commission_accrual_id uuid
        references control_plane.commission_accruals(commission_accrual_id),
      commission_reversal_id uuid
        references control_plane.commission_reversals(commission_reversal_id),
      amount_minor bigint not null
        check (amount_minor <> 0),
      currency text not null,
      beneficiary_channel_id uuid not null
        references control_plane.channels(channel_id),
      source_occurred_at timestamptz not null,
      item_snapshot jsonb not null,
      item_digest text not null,
      created_at timestamptz not null default now(),
      constraint commission_settlement_items_source_ck
        check (
          (
            entry_type = 'accrual'
            and commission_accrual_id is not null
            and commission_reversal_id is null
            and amount_minor > 0
          )
          or
          (
            entry_type = 'reversal'
            and commission_accrual_id is null
            and commission_reversal_id is not null
            and amount_minor < 0
          )
        ),
      constraint commission_settlement_items_accrual_uq unique (commission_accrual_id),
      constraint commission_settlement_items_reversal_uq unique (commission_reversal_id),
      constraint commission_settlement_items_currency_ck check (currency ~ '^[A-Z]{3}$'),
      constraint commission_settlement_items_snapshot_ck
        check (jsonb_typeof(item_snapshot) = 'object'),
      constraint commission_settlement_items_digest_ck
        check (item_digest ~ '^[0-9a-f]{64}$')
    );

    create index commission_settlement_items_settlement_idx
      on control_plane.commission_settlement_items (
        commission_settlement_id,
        source_occurred_at,
        commission_settlement_item_id
      );

    create function control_plane.validate_commission_settlement_item()
      returns trigger language plpgsql as $$
      declare
        settlement record;
        accrual record;
        reversal record;
      begin
        select * into settlement
        from control_plane.commission_settlements
        where commission_settlement_id = new.commission_settlement_id
        for update;

        if settlement.commission_settlement_id is null
          or settlement.status <> 'draft' then
          raise exception 'Commission Settlement Items may only be added to a draft Settlement';
        end if;

        if new.beneficiary_channel_id is distinct from settlement.beneficiary_channel_id
          or new.currency is distinct from settlement.currency then
          raise exception 'Commission Settlement Item Channel and currency must match Settlement scope';
        end if;

        if new.source_occurred_at < settlement.period_start::timestamp at time zone 'UTC'
          or new.source_occurred_at >= settlement.period_end::timestamp at time zone 'UTC'
          or new.source_occurred_at >= settlement.cutoff_at then
          raise exception 'Commission Settlement Item source must fall inside period and cutoff';
        end if;

        if new.entry_type = 'accrual' then
          select * into accrual
          from control_plane.commission_accruals
          where commission_accrual_id = new.commission_accrual_id;

          if accrual.commission_accrual_id is null
            or new.amount_minor is distinct from accrual.commission_amount_minor
            or new.currency is distinct from accrual.currency
            or new.beneficiary_channel_id is distinct from accrual.beneficiary_channel_id
            or new.source_occurred_at is distinct from accrual.occurred_at
            or accrual.eligible_at > settlement.cutoff_at then
            raise exception 'Commission Settlement accrual Item must match an eligible Accrual';
          end if;
        else
          select reversal.*, accrual.beneficiary_channel_id
            into reversal
          from control_plane.commission_reversals reversal
          join control_plane.commission_accruals accrual
            on accrual.commission_accrual_id = reversal.commission_accrual_id
          where reversal.commission_reversal_id = new.commission_reversal_id;

          if reversal.commission_reversal_id is null
            or new.amount_minor is distinct from -reversal.amount_minor
            or new.currency is distinct from reversal.currency
            or new.beneficiary_channel_id is distinct from reversal.beneficiary_channel_id
            or new.source_occurred_at is distinct from reversal.occurred_at then
            raise exception 'Commission Settlement reversal Item must exactly match Reversal evidence';
          end if;
        end if;

        return new;
      end;
      $$;

    create trigger commission_settlement_items_validation_guard
      before insert
      on control_plane.commission_settlement_items
      for each row execute function control_plane.validate_commission_settlement_item();

    create trigger commission_settlement_items_append_only_guard
      before update or delete
      on control_plane.commission_settlement_items
      for each row execute function control_plane.protect_commission_append_only_fact();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if to_regclass('control_plane.commission_settlement_items') is not null
        and exists (select 1 from control_plane.commission_settlement_items) then
        raise exception 'commission shadow ledger rollback blocked: Settlement Item evidence exists';
      end if;

      if to_regclass('control_plane.commission_settlements') is not null
        and exists (select 1 from control_plane.commission_settlements) then
        raise exception 'commission shadow ledger rollback blocked: Settlement evidence exists';
      end if;

      if to_regclass('control_plane.commission_reversals') is not null
        and exists (select 1 from control_plane.commission_reversals) then
        raise exception 'commission shadow ledger rollback blocked: Reversal evidence exists';
      end if;

      if to_regclass('control_plane.commission_accruals') is not null
        and exists (select 1 from control_plane.commission_accruals) then
        raise exception 'commission shadow ledger rollback blocked: Accrual evidence exists';
      end if;

      if to_regclass('control_plane.commission_calculation_outcomes') is not null
        and exists (select 1 from control_plane.commission_calculation_outcomes) then
        raise exception 'commission shadow ledger rollback blocked: Calculation Outcome evidence exists';
      end if;

      if to_regclass('control_plane.commission_rule_versions') is not null
        and exists (select 1 from control_plane.commission_rule_versions) then
        raise exception 'commission shadow ledger rollback blocked: Commission Rule evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists commission_settlement_items_append_only_guard
      on control_plane.commission_settlement_items;
    drop trigger if exists commission_settlement_items_validation_guard
      on control_plane.commission_settlement_items;
    drop function if exists control_plane.validate_commission_settlement_item();
    drop table if exists control_plane.commission_settlement_items;

    drop trigger if exists commission_settlements_lifecycle_guard
      on control_plane.commission_settlements;
    drop function if exists control_plane.protect_commission_settlement_lifecycle();
    drop trigger if exists commission_settlements_actor_guard
      on control_plane.commission_settlements;
    drop function if exists control_plane.validate_commission_settlement_actors();
    drop table if exists control_plane.commission_settlements;

    drop trigger if exists commission_reversals_append_only_guard
      on control_plane.commission_reversals;
    drop trigger if exists commission_reversals_validation_guard
      on control_plane.commission_reversals;
    drop function if exists control_plane.validate_commission_reversal();
    drop table if exists control_plane.commission_reversals;

    drop trigger if exists commission_accruals_append_only_guard
      on control_plane.commission_accruals;
    drop trigger if exists commission_accruals_validation_guard
      on control_plane.commission_accruals;
    drop function if exists control_plane.validate_commission_accrual();
    drop table if exists control_plane.commission_accruals;

    drop trigger if exists commission_outcomes_append_only_guard
      on control_plane.commission_calculation_outcomes;
    drop trigger if exists commission_outcomes_validation_guard
      on control_plane.commission_calculation_outcomes;
    drop function if exists control_plane.validate_commission_calculation_outcome();
    drop table if exists control_plane.commission_calculation_outcomes;

    drop function if exists control_plane.protect_commission_append_only_fact();

    drop trigger if exists commission_rules_lifecycle_guard
      on control_plane.commission_rule_versions;
    drop function if exists control_plane.protect_commission_rule_lifecycle();
    drop trigger if exists commission_rules_validation_guard
      on control_plane.commission_rule_versions;
    drop function if exists control_plane.validate_commission_rule();
    drop table if exists control_plane.commission_rule_versions;

    drop function if exists control_plane.is_active_platform_admin(uuid);
  `);
}
