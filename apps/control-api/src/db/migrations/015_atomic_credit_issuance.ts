import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.payment_events
      add column processed_at timestamptz;

    alter table control_plane.payment_events
      drop constraint payment_events_error_code_ck,
      drop constraint payment_events_processing_evidence_ck;

    alter table control_plane.payment_events
      add constraint payment_events_error_code_ck
        check (
          error_code is null
          or error_code in (
            'invalid_signature',
            'unknown_order',
            'amount_mismatch',
            'currency_mismatch',
            'mode_mismatch',
            'duplicate_conflict',
            'invalid_order_state',
            'wallet_unavailable',
            'credit_issuance_conflict',
            'unsupported_event_type',
            'provider_unavailable',
            'internal_processing_error'
          )
        ),
      add constraint payment_events_processing_evidence_ck
        check (
          (
            processing_status = 'received'
            and error_code is null
            and processed_at is null
          )
          or
          (
            processing_status = 'applied'
            and error_code is null
            and processed_at is not null
            and processed_at >= received_at
          )
          or
          (
            processing_status = 'rejected'
            and error_code is not null
            and processed_at is not null
            and processed_at >= received_at
          )
        );

    create or replace function control_plane.protect_payment_event_lifecycle()
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
          and (
            new.processing_status is distinct from old.processing_status
            or new.error_code is distinct from old.error_code
            or new.processed_at is distinct from old.processed_at
          ) then
          raise exception 'terminal Payment Event processing evidence is immutable';
        end if;

        return new;
      end;
      $$;

    create table control_plane.credit_lots (
      credit_lot_id uuid primary key,
      tenant_id uuid not null
        references control_plane.tenants(tenant_id),
      wallet_id uuid not null,
      recharge_order_id uuid not null
        references control_plane.recharge_orders(recharge_order_id),
      source_payment_event_id uuid not null
        references control_plane.payment_events(payment_event_id),
      conversion_rule_version_id uuid not null
        references control_plane.credit_conversion_rule_versions(rule_version_id),
      lot_type text not null
        check (lot_type in ('PURCHASED', 'BONUS')),
      original_credits bigint not null
        check (original_credits > 0),
      issued_at timestamptz not null,
      expires_at timestamptz,
      created_at timestamptz not null default now(),
      constraint credit_lots_wallet_tenant_fk
        foreign key (wallet_id, tenant_id)
        references control_plane.wallets(wallet_id, tenant_id),
      constraint credit_lots_payment_type_uq
        unique (source_payment_event_id, lot_type),
      constraint credit_lots_order_type_uq
        unique (recharge_order_id, lot_type),
      constraint credit_lots_expiry_ck
        check (
          (lot_type = 'PURCHASED' and expires_at is null)
          or
          (lot_type = 'BONUS' and expires_at is not null and expires_at > issued_at)
        ),
      constraint credit_lots_created_ck
        check (created_at >= issued_at)
    );

    create index credit_lots_wallet_expiry_idx
      on control_plane.credit_lots (
        wallet_id,
        expires_at nulls last,
        issued_at,
        credit_lot_id
      );

    create function control_plane.validate_credit_lot_source()
      returns trigger language plpgsql as $$
      declare
        source_order_id uuid;
        source_event_type text;
        source_occurred_at timestamptz;
        order_tenant_id uuid;
        order_wallet_id uuid;
        order_rule_id uuid;
        order_purchased_credits bigint;
        order_bonus_credits bigint;
        order_bonus_expires_in_days integer;
        expected_expires_at timestamptz;
      begin
        select
          payment_event.recharge_order_id,
          payment_event.event_type,
          payment_event.occurred_at,
          recharge_order.tenant_id,
          recharge_order.wallet_id,
          recharge_order.conversion_rule_version_id,
          recharge_order.purchased_credits,
          recharge_order.bonus_credits,
          recharge_order.bonus_expires_in_days
        into
          source_order_id,
          source_event_type,
          source_occurred_at,
          order_tenant_id,
          order_wallet_id,
          order_rule_id,
          order_purchased_credits,
          order_bonus_credits,
          order_bonus_expires_in_days
        from control_plane.payment_events payment_event
        join control_plane.recharge_orders recharge_order
          on recharge_order.recharge_order_id = payment_event.recharge_order_id
        where payment_event.payment_event_id = new.source_payment_event_id;

        if source_order_id is null or source_event_type is distinct from 'payment_succeeded' then
          raise exception 'Credit Lot requires a payment_succeeded source Payment Event';
        end if;

        if new.recharge_order_id is distinct from source_order_id
          or new.tenant_id is distinct from order_tenant_id
          or new.wallet_id is distinct from order_wallet_id
          or new.conversion_rule_version_id is distinct from order_rule_id then
          raise exception 'Credit Lot scope must match its frozen Recharge Order and Payment Event';
        end if;

        if new.issued_at is distinct from source_occurred_at then
          raise exception 'Credit Lot issued time must match its source Payment Event';
        end if;

        if new.lot_type = 'PURCHASED' then
          if new.original_credits is distinct from order_purchased_credits
            or new.expires_at is not null then
            raise exception 'Purchased Credit Lot credits and expiry must match the frozen Recharge Order';
          end if;
        elsif new.lot_type = 'BONUS' then
          if order_bonus_credits <= 0 or order_bonus_expires_in_days is null then
            raise exception 'Bonus Credit Lot requires frozen bonus credits and expiry';
          end if;

          expected_expires_at := source_occurred_at + make_interval(days => order_bonus_expires_in_days);
          if new.original_credits is distinct from order_bonus_credits
            or new.expires_at is distinct from expected_expires_at then
            raise exception 'Bonus Credit Lot credits and expiry must match the frozen Recharge Order';
          end if;
        end if;

        return new;
      end;
      $$;

    create trigger credit_lots_source_guard
      before insert
      on control_plane.credit_lots
      for each row execute function control_plane.validate_credit_lot_source();

    create function control_plane.protect_credit_lot()
      returns trigger language plpgsql as $$
      begin
        raise exception 'Credit Lot source facts are immutable and cannot be updated or deleted';
      end;
      $$;

    create trigger credit_lots_append_only_guard
      before update or delete
      on control_plane.credit_lots
      for each row execute function control_plane.protect_credit_lot();

    alter table control_plane.credit_ledger_entries
      add column credit_lot_id uuid
        references control_plane.credit_lots(credit_lot_id);

    create unique index credit_ledger_recharge_lot_issue_uq
      on control_plane.credit_ledger_entries (credit_lot_id)
      where credit_lot_id is not null;

    create function control_plane.validate_recharge_credit_ledger_entry()
      returns trigger language plpgsql as $$
      declare
        lot_tenant_id uuid;
        lot_wallet_id uuid;
        lot_order_id uuid;
        lot_payment_event_id uuid;
        lot_type text;
        lot_original_credits bigint;
        lot_issued_at timestamptz;
        provider_code text;
        expected_reason_code text;
        expected_idempotency_key text;
      begin
        if new.credit_lot_id is null then
          return new;
        end if;

        select
          credit_lot.tenant_id,
          credit_lot.wallet_id,
          credit_lot.recharge_order_id,
          credit_lot.source_payment_event_id,
          credit_lot.lot_type,
          credit_lot.original_credits,
          credit_lot.issued_at,
          payment_event.provider_code
        into
          lot_tenant_id,
          lot_wallet_id,
          lot_order_id,
          lot_payment_event_id,
          lot_type,
          lot_original_credits,
          lot_issued_at,
          provider_code
        from control_plane.credit_lots credit_lot
        join control_plane.payment_events payment_event
          on payment_event.payment_event_id = credit_lot.source_payment_event_id
        where credit_lot.credit_lot_id = new.credit_lot_id;

        if lot_order_id is null then
          raise exception 'Recharge Credit Ledger requires a valid Credit Lot';
        end if;

        expected_reason_code := case lot_type
          when 'PURCHASED' then 'recharge_purchase_issued'
          when 'BONUS' then 'recharge_bonus_issued'
        end;
        expected_idempotency_key :=
          'payment-event:' || lot_payment_event_id::text || ':' || lower(lot_type);

        if new.tenant_id is distinct from lot_tenant_id
          or new.wallet_id is distinct from lot_wallet_id
          or new.reservation_id is not null
          or new.posting_group_id is distinct from lot_payment_event_id
          or new.operation is distinct from 'issue'
          or new.bucket is distinct from 'available'
          or new.delta is distinct from lot_original_credits
          or new.reference_type is distinct from 'recharge_order'
          or new.reference_id is distinct from lot_order_id::text
          or new.idempotency_key is distinct from expected_idempotency_key
          or new.actor_type is distinct from 'system'
          or new.actor_id is distinct from provider_code
          or new.reason_code is distinct from expected_reason_code
          or new.occurred_at is distinct from lot_issued_at then
          raise exception 'Recharge Credit Ledger facts must match their Credit Lot, Order and Provider';
        end if;

        return new;
      end;
      $$;

    create trigger credit_ledger_recharge_issue_guard
      before insert or update
      on control_plane.credit_ledger_entries
      for each row execute function control_plane.validate_recharge_credit_ledger_entry();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if to_regclass('control_plane.credit_lots') is not null
        and exists (select 1 from control_plane.credit_lots) then
        raise exception 'atomic credit issuance rollback blocked: Credit Lot evidence exists';
      end if;

      if exists (
        select 1
        from control_plane.credit_ledger_entries
        where credit_lot_id is not null
      ) then
        raise exception 'atomic credit issuance rollback blocked: linked Credit Ledger evidence exists';
      end if;

      if exists (
        select 1
        from control_plane.payment_events
        where processed_at is not null
      ) then
        raise exception 'atomic credit issuance rollback blocked: Payment processing evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists credit_ledger_recharge_issue_guard
      on control_plane.credit_ledger_entries;
    drop function if exists control_plane.validate_recharge_credit_ledger_entry();
    drop index if exists control_plane.credit_ledger_recharge_lot_issue_uq;
    alter table control_plane.credit_ledger_entries
      drop column if exists credit_lot_id;

    drop trigger if exists credit_lots_append_only_guard
      on control_plane.credit_lots;
    drop function if exists control_plane.protect_credit_lot();
    drop trigger if exists credit_lots_source_guard
      on control_plane.credit_lots;
    drop function if exists control_plane.validate_credit_lot_source();
    drop table if exists control_plane.credit_lots;

    alter table control_plane.payment_events
      drop constraint payment_events_processing_evidence_ck,
      drop constraint payment_events_error_code_ck;

    create or replace function control_plane.protect_payment_event_lifecycle()
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

    alter table control_plane.payment_events
      drop column if exists processed_at;

    alter table control_plane.payment_events
      add constraint payment_events_error_code_ck
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
      add constraint payment_events_processing_evidence_ck
        check (
          (processing_status in ('received', 'applied') and error_code is null)
          or
          (processing_status = 'rejected' and error_code is not null)
        );
  `);
}
