import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.canvas_entries
        where state = 'consumed'
      ) then
        raise exception 'canvas entry redemption migration blocked: consumed lifecycle evidence exists';
      end if;
    end;
    $$;

    alter table control_plane.canvas_entries
      add column redemption_idempotency_key text,
      add column redemption_request_digest text,
      add column redeemed_by text;

    alter table control_plane.canvas_entries
      drop constraint canvas_entries_lifecycle_ck,
      add constraint canvas_entries_redemption_key_ck check (
        redemption_idempotency_key is null
        or (
          length(redemption_idempotency_key) between 1 and 200
          and redemption_idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
        )
      ),
      add constraint canvas_entries_redemption_digest_ck check (
        redemption_request_digest is null
        or redemption_request_digest ~ '^sha256:[a-f0-9]{64}$'
      ),
      add constraint canvas_entries_redeemed_by_ck check (
        redeemed_by is null
        or (
          length(redeemed_by) between 1 and 100
          and redeemed_by ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
        )
      ),
      add constraint canvas_entries_lifecycle_ck check (
        (
          state = 'active'
          and consumed_at is null
          and redemption_idempotency_key is null
          and redemption_request_digest is null
          and redeemed_by is null
        )
        or (
          state = 'consumed'
          and consumed_at is not null
          and consumed_at >= issued_at
          and consumed_at < expires_at
          and redemption_idempotency_key is not null
          and redemption_request_digest is not null
          and redeemed_by is not null
        )
        or (
          state = 'expired'
          and consumed_at is null
          and redemption_idempotency_key is null
          and redemption_request_digest is null
          and redeemed_by is null
        )
      );

    create or replace function control_plane.protect_canvas_entry_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'canvas entry lifecycle is immutable';
        end if;

        if new.canvas_entry_id is distinct from old.canvas_entry_id
          or new.handle is distinct from old.handle
          or new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.package_id is distinct from old.package_id
          or new.grant_id is distinct from old.grant_id
          or new.idempotency_key is distinct from old.idempotency_key
          or new.request_digest is distinct from old.request_digest
          or new.issued_at is distinct from old.issued_at
          or new.expires_at is distinct from old.expires_at
          or new.created_by is distinct from old.created_by
          or new.created_at is distinct from old.created_at then
          raise exception 'canvas entry scope is immutable';
        end if;

        if old.state <> 'active'
          or new.state not in ('consumed', 'expired') then
          raise exception 'canvas entry lifecycle transition is invalid';
        end if;

        if new.state = 'consumed' then
          if old.redemption_idempotency_key is not null
            or old.redemption_request_digest is not null
            or old.redeemed_by is not null
            or new.redemption_idempotency_key is null
            or new.redemption_request_digest is null
            or new.redeemed_by is null then
            raise exception 'canvas entry redemption facts are invalid';
          end if;
        elsif new.redemption_idempotency_key is not null
          or new.redemption_request_digest is not null
          or new.redeemed_by is not null then
          raise exception 'canvas entry redemption facts are invalid';
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
      if exists (select 1 from control_plane.canvas_entries) then
        raise exception 'canvas entry redemption rollback blocked: lifecycle evidence exists';
      end if;
    end;
    $$;

    create or replace function control_plane.protect_canvas_entry_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'canvas entry lifecycle is immutable';
        end if;

        if new.canvas_entry_id is distinct from old.canvas_entry_id
          or new.handle is distinct from old.handle
          or new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.package_id is distinct from old.package_id
          or new.grant_id is distinct from old.grant_id
          or new.idempotency_key is distinct from old.idempotency_key
          or new.request_digest is distinct from old.request_digest
          or new.issued_at is distinct from old.issued_at
          or new.expires_at is distinct from old.expires_at
          or new.created_by is distinct from old.created_by
          or new.created_at is distinct from old.created_at then
          raise exception 'canvas entry scope is immutable';
        end if;

        if old.state <> 'active'
          or new.state not in ('consumed', 'expired') then
          raise exception 'canvas entry lifecycle transition is invalid';
        end if;

        return new;
      end;
    $$;

    alter table control_plane.canvas_entries
      drop constraint canvas_entries_lifecycle_ck,
      drop constraint canvas_entries_redemption_key_ck,
      drop constraint canvas_entries_redemption_digest_ck,
      drop constraint canvas_entries_redeemed_by_ck,
      drop column redemption_idempotency_key,
      drop column redemption_request_digest,
      drop column redeemed_by,
      add constraint canvas_entries_lifecycle_ck check (
        (state = 'active' and consumed_at is null)
        or (
          state = 'consumed'
          and consumed_at is not null
          and consumed_at >= issued_at
          and consumed_at < expires_at
        )
        or (state = 'expired' and consumed_at is null)
      );
  `);
}
