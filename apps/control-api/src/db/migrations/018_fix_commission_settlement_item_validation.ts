import type { Knex } from 'knex';

const fixedValidator = `
  create or replace function control_plane.validate_commission_settlement_item()
    returns trigger language plpgsql as $$
    declare
      settlement_record record;
      accrual_record record;
      reversal_record record;
    begin
      select source_settlement.* into settlement_record
      from control_plane.commission_settlements source_settlement
      where source_settlement.commission_settlement_id = new.commission_settlement_id
      for update;

      if settlement_record.commission_settlement_id is null
        or settlement_record.status <> 'draft' then
        raise exception 'Commission Settlement Items may only be added to a draft Settlement';
      end if;

      if new.beneficiary_channel_id is distinct from settlement_record.beneficiary_channel_id
        or new.currency is distinct from settlement_record.currency then
        raise exception 'Commission Settlement Item Channel and currency must match Settlement scope';
      end if;

      if new.source_occurred_at < settlement_record.period_start::timestamp at time zone 'UTC'
        or new.source_occurred_at >= settlement_record.period_end::timestamp at time zone 'UTC'
        or new.source_occurred_at >= settlement_record.cutoff_at then
        raise exception 'Commission Settlement Item source must fall inside period and cutoff';
      end if;

      if new.entry_type = 'accrual' then
        select source_accrual.* into accrual_record
        from control_plane.commission_accruals source_accrual
        where source_accrual.commission_accrual_id = new.commission_accrual_id;

        if accrual_record.commission_accrual_id is null
          or new.amount_minor is distinct from accrual_record.commission_amount_minor
          or new.currency is distinct from accrual_record.currency
          or new.beneficiary_channel_id is distinct from accrual_record.beneficiary_channel_id
          or new.source_occurred_at is distinct from accrual_record.occurred_at
          or accrual_record.eligible_at > settlement_record.cutoff_at then
          raise exception 'Commission Settlement accrual Item must match an eligible Accrual';
        end if;
      else
        select
          source_reversal.*,
          source_accrual.beneficiary_channel_id
        into reversal_record
        from control_plane.commission_reversals source_reversal
        join control_plane.commission_accruals source_accrual
          on source_accrual.commission_accrual_id = source_reversal.commission_accrual_id
        where source_reversal.commission_reversal_id = new.commission_reversal_id;

        if reversal_record.commission_reversal_id is null
          or new.amount_minor is distinct from -reversal_record.amount_minor
          or new.currency is distinct from reversal_record.currency
          or new.beneficiary_channel_id is distinct from reversal_record.beneficiary_channel_id
          or new.source_occurred_at is distinct from reversal_record.occurred_at then
          raise exception 'Commission Settlement reversal Item must exactly match Reversal evidence';
        end if;
      end if;

      return new;
    end;
    $$;
`;

export async function up(database: Knex): Promise<void> {
  await database.raw(fixedValidator);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.commission_settlement_items
        where entry_type = 'reversal'
      ) then
        raise exception 'settlement item validation rollback blocked: Reversal Settlement Item evidence exists';
      end if;
    end;
    $$;

    create or replace function control_plane.validate_commission_settlement_item()
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
  `);
}
