import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.commission_reversals) then
        raise exception 'full TEST reversal migration blocked: pre-017 Commission Reversal evidence exists';
      end if;
    end;
    $$;

    alter table control_plane.credit_ledger_entries
      drop constraint credit_ledger_entries_operation_check,
      add constraint credit_ledger_entries_operation_check
        check (operation in ('issue', 'reserve', 'consume', 'release', 'adjust', 'reclaim'));

    drop index control_plane.credit_ledger_recharge_lot_issue_uq;
    create unique index credit_ledger_recharge_lot_issue_uq
      on control_plane.credit_ledger_entries (credit_lot_id)
      where credit_lot_id is not null and operation = 'issue';
    create unique index credit_ledger_recharge_lot_reclaim_uq
      on control_plane.credit_ledger_entries (credit_lot_id)
      where credit_lot_id is not null and operation = 'reclaim';

    create or replace function control_plane.validate_recharge_credit_ledger_entry()
      returns trigger language plpgsql as $$
      declare
        credit_lot record;
        issue_provider_code text;
        payment_event record;
        recharge_order record;
        expected_reason_code text;
        expected_idempotency_key text;
      begin
        if new.credit_lot_id is null then
          return new;
        end if;

        select lot.* into credit_lot
        from control_plane.credit_lots lot
        where lot.credit_lot_id = new.credit_lot_id
        for update;

        if credit_lot.credit_lot_id is null then
          raise exception 'Recharge Credit Ledger requires a valid Credit Lot';
        end if;

        if new.operation = 'issue' then
          select source_event.provider_code
            into issue_provider_code
          from control_plane.payment_events source_event
          where source_event.payment_event_id = credit_lot.source_payment_event_id;

          expected_reason_code := case credit_lot.lot_type
            when 'PURCHASED' then 'recharge_purchase_issued'
            when 'BONUS' then 'recharge_bonus_issued'
          end;
          expected_idempotency_key :=
            'payment-event:' || credit_lot.source_payment_event_id::text || ':' || lower(credit_lot.lot_type);

          if new.tenant_id is distinct from credit_lot.tenant_id
            or new.wallet_id is distinct from credit_lot.wallet_id
            or new.reservation_id is not null
            or new.posting_group_id is distinct from credit_lot.source_payment_event_id
            or new.bucket is distinct from 'available'
            or new.delta is distinct from credit_lot.original_credits
            or new.reference_type is distinct from 'recharge_order'
            or new.reference_id is distinct from credit_lot.recharge_order_id::text
            or new.idempotency_key is distinct from expected_idempotency_key
            or new.actor_type is distinct from 'system'
            or new.actor_id is distinct from issue_provider_code
            or new.reason_code is distinct from expected_reason_code
            or new.occurred_at is distinct from credit_lot.issued_at then
            raise exception 'Recharge Credit Ledger facts must match their Credit Lot, Order and Provider';
          end if;

          return new;
        end if;

        if new.operation = 'reclaim' then
          select * into payment_event
          from control_plane.payment_events
          where payment_event_id = new.posting_group_id;

          select * into recharge_order
          from control_plane.recharge_orders
          where recharge_order_id = credit_lot.recharge_order_id;

          expected_reason_code := case payment_event.event_type
            when 'refund_succeeded' then 'recharge_refund_reclaimed'
            when 'chargeback_succeeded' then 'recharge_chargeback_reclaimed'
          end;
          expected_idempotency_key :=
            'payment-event:' || payment_event.payment_event_id::text || ':' || lower(credit_lot.lot_type) || ':reclaim';

          if payment_event.payment_event_id is null
            or payment_event.processing_status <> 'applied'
            or payment_event.payment_mode <> 'TEST'
            or payment_event.event_type not in ('refund_succeeded', 'chargeback_succeeded')
            or payment_event.recharge_order_id is distinct from credit_lot.recharge_order_id
            or payment_event.amount_minor is distinct from recharge_order.amount_minor
            or payment_event.currency is distinct from recharge_order.currency
            or new.tenant_id is distinct from credit_lot.tenant_id
            or new.wallet_id is distinct from credit_lot.wallet_id
            or new.reservation_id is not null
            or new.bucket is distinct from 'available'
            or new.delta is distinct from -credit_lot.original_credits
            or new.reference_type is distinct from 'recharge_order'
            or new.reference_id is distinct from credit_lot.recharge_order_id::text
            or new.idempotency_key is distinct from expected_idempotency_key
            or new.actor_type is distinct from 'system'
            or new.actor_id is distinct from payment_event.provider_code
            or new.reason_code is distinct from expected_reason_code
            or new.occurred_at is distinct from payment_event.occurred_at
            or not exists (
              select 1
              from control_plane.credit_ledger_entries issue_entry
              where issue_entry.credit_lot_id = credit_lot.credit_lot_id
                and issue_entry.operation = 'issue'
            ) then
            raise exception 'Recharge Credit reclaim facts must match an applied full TEST reversal Event and issued Lot';
          end if;

          return new;
        end if;

        raise exception 'Lot-linked Credit Ledger operation must be issue or reclaim';
      end;
      $$;

    create or replace function control_plane.validate_payment_event_order_facts()
      returns trigger language plpgsql as $$
      declare
        recharge_order record;
      begin
        if new.processing_status <> 'received'
          or new.error_code is not null
          or new.processed_at is not null then
          raise exception 'Payment Event must enter the Inbox as received without terminal evidence';
        end if;

        select * into recharge_order
        from control_plane.recharge_orders
        where recharge_order_id = new.recharge_order_id;

        if new.payment_mode is distinct from recharge_order.payment_mode then
          raise exception 'Payment Event mode must match its Recharge Order';
        end if;

        if new.currency is distinct from recharge_order.currency then
          raise exception 'Payment Event currency must match its Recharge Order';
        end if;

        if new.event_type in ('refund_succeeded', 'chargeback_succeeded') then
          if new.amount_minor > recharge_order.amount_minor then
            raise exception 'Payment reversal Event amount cannot exceed its Recharge Order';
          end if;
        elsif new.amount_minor is distinct from recharge_order.amount_minor then
          raise exception 'Payment Event amount must match its Recharge Order';
        end if;

        return new;
      end;
      $$;

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
            'partial_refund_unsupported',
            'credit_reclaim_unsafe',
            'commission_reversal_conflict',
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

    create or replace function control_plane.validate_commission_reversal()
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
          or payment_event.processing_status <> 'applied'
          or payment_event.payment_mode <> 'TEST'
          or payment_event.event_type is distinct from expected_event_type
          or payment_event.recharge_order_id is distinct from accrual.recharge_order_id
          or payment_event.amount_minor is distinct from accrual.basis_amount_minor
          or payment_event.currency is distinct from accrual.currency
          or new.amount_minor is distinct from accrual.commission_amount_minor
          or new.currency is distinct from accrual.currency
          or new.occurred_at is distinct from payment_event.occurred_at then
          raise exception 'Commission Reversal requires an applied full TEST Event matching its Accrual';
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
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.credit_ledger_entries
        where operation = 'reclaim'
      ) then
        raise exception 'full TEST reversal rollback blocked: Credit reclaim evidence exists';
      end if;

      if exists (
        select 1
        from control_plane.payment_events
        where event_type in ('refund_succeeded', 'chargeback_succeeded')
          and processing_status = 'applied'
      ) then
        raise exception 'full TEST reversal rollback blocked: applied reversal Payment evidence exists';
      end if;

      if exists (select 1 from control_plane.commission_reversals) then
        raise exception 'full TEST reversal rollback blocked: Commission Reversal evidence exists';
      end if;
    end;
    $$;

    create or replace function control_plane.validate_commission_reversal()
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

    alter table control_plane.payment_events
      drop constraint payment_events_processing_evidence_ck,
      drop constraint payment_events_error_code_ck;

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

    create or replace function control_plane.validate_payment_event_order_facts()
      returns trigger language plpgsql as $$
      declare
        order_mode text;
        order_amount_minor bigint;
        order_currency text;
      begin
        if new.processing_status <> 'received'
          or new.error_code is not null
          or new.processed_at is not null then
          raise exception 'Payment Event must enter the Inbox as received without terminal evidence';
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

    drop index control_plane.credit_ledger_recharge_lot_reclaim_uq;
    drop index control_plane.credit_ledger_recharge_lot_issue_uq;
    create unique index credit_ledger_recharge_lot_issue_uq
      on control_plane.credit_ledger_entries (credit_lot_id)
      where credit_lot_id is not null;

    create or replace function control_plane.validate_recharge_credit_ledger_entry()
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

    alter table control_plane.credit_ledger_entries
      drop constraint credit_ledger_entries_operation_check,
      add constraint credit_ledger_entries_operation_check
        check (operation in ('issue', 'reserve', 'consume', 'release', 'adjust'));
  `);
}
