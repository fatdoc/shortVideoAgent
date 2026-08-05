import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create schema if not exists control_plane;

    create table control_plane.tenants (
      tenant_id uuid primary key,
      display_name text not null,
      status text not null check (status in ('active', 'suspended')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create table control_plane.users (
      user_id uuid primary key,
      email text not null,
      display_name text not null,
      password_hash text not null,
      status text not null check (status in ('active', 'suspended')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create unique index users_email_normalized_uq
      on control_plane.users (lower(email));

    create table control_plane.memberships (
      membership_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      user_id uuid not null references control_plane.users(user_id),
      role_code text not null check (role_code in ('tenant_admin', 'content_operator', 'pilot_support')),
      status text not null check (status in ('active', 'suspended', 'expired')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_id, user_id, role_code)
    );

    create table control_plane.auth_sessions (
      session_id uuid primary key,
      user_id uuid not null references control_plane.users(user_id),
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      token_digest text not null unique,
      expires_at timestamptz not null,
      revoked_at timestamptz,
      created_at timestamptz not null default now(),
      last_seen_at timestamptz not null default now()
    );
    create index auth_sessions_active_lookup_idx
      on control_plane.auth_sessions (token_digest, expires_at)
      where revoked_at is null;

    create table control_plane.projects (
      project_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      name text not null,
      status text not null check (status in ('draft', 'active', 'production', 'completed', 'archived')),
      platform text not null,
      aspect_ratio text not null,
      target_duration_seconds integer not null check (target_duration_seconds > 0),
      created_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
    create index projects_tenant_updated_idx
      on control_plane.projects (tenant_id, updated_at desc);

    create table control_plane.creative_briefs (
      brief_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      version integer not null check (version > 0),
      status text not null check (status in ('draft', 'approved', 'superseded')),
      payload jsonb not null,
      payload_digest text not null,
      created_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      unique (project_id, version),
      unique (project_id, payload_digest)
    );

    create table control_plane.script_versions (
      script_version_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      version integer not null check (version > 0),
      status text not null check (status in ('draft', 'approved', 'revoked', 'superseded')),
      payload jsonb not null,
      payload_digest text not null,
      created_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      unique (project_id, version),
      unique (project_id, payload_digest)
    );

    create table control_plane.script_approvals (
      approval_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      script_version_id uuid not null references control_plane.script_versions(script_version_id),
      status text not null check (status in ('approved', 'revoked', 'blocked')),
      fact_risk_status text not null check (fact_risk_status in ('cleared', 'unresolved')),
      reason text,
      acted_by uuid not null references control_plane.users(user_id),
      acted_at timestamptz not null default now()
    );

    create table control_plane.production_packages (
      package_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      contract_version text not null,
      idempotency_key text not null,
      package_digest text not null,
      snapshot jsonb not null,
      status text not null check (status in ('ready', 'dispatched', 'accepted', 'rejected', 'expired')),
      valid_from timestamptz not null,
      expires_at timestamptz not null,
      created_at timestamptz not null default now(),
      unique (tenant_id, idempotency_key),
      unique (project_id, package_digest)
    );

    create table control_plane.project_grants (
      grant_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      package_id uuid not null references control_plane.production_packages(package_id),
      token_digest text not null unique,
      capabilities jsonb not null,
      status text not null check (status in ('active', 'revoked', 'expired')),
      issued_at timestamptz not null,
      expires_at timestamptz not null,
      revoked_at timestamptz
    );

    create table control_plane.wallets (
      wallet_id uuid primary key,
      tenant_id uuid not null unique references control_plane.tenants(tenant_id),
      credit_type text not null check (credit_type = 'AI_VIDEO_CREDIT'),
      status text not null check (status in ('active', 'frozen', 'closed')),
      created_at timestamptz not null default now()
    );

    create table control_plane.credit_reservations (
      reservation_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      wallet_id uuid not null references control_plane.wallets(wallet_id),
      generation_task_id uuid not null,
      status text not null check (status in ('reserved', 'consumed', 'released')),
      reserved_credits bigint not null check (reserved_credits > 0),
      consumed_credits bigint not null default 0 check (consumed_credits >= 0),
      released_credits bigint not null default 0 check (released_credits >= 0),
      rate_card_version text not null,
      idempotency_key text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_id, idempotency_key),
      unique (generation_task_id)
    );

    create table control_plane.credit_ledger_entries (
      ledger_entry_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      wallet_id uuid not null references control_plane.wallets(wallet_id),
      reservation_id uuid references control_plane.credit_reservations(reservation_id),
      posting_group_id uuid not null,
      operation text not null check (operation in ('issue', 'reserve', 'consume', 'release', 'adjust')),
      bucket text not null check (bucket in ('available', 'reserved', 'consumed')),
      delta bigint not null check (delta <> 0),
      reference_type text not null,
      reference_id text not null,
      idempotency_key text not null,
      actor_type text not null check (actor_type in ('system', 'user', 'admin')),
      actor_id text not null,
      reason_code text not null,
      occurred_at timestamptz not null,
      created_at timestamptz not null default now(),
      unique (tenant_id, idempotency_key, bucket)
    );
    create index credit_ledger_wallet_time_idx
      on control_plane.credit_ledger_entries (wallet_id, occurred_at, ledger_entry_id);

    create function control_plane.reject_ledger_mutation()
      returns trigger language plpgsql as $$
      begin
        raise exception 'credit ledger is append-only';
      end;
    $$;
    create trigger credit_ledger_no_update
      before update or delete on control_plane.credit_ledger_entries
      for each row execute function control_plane.reject_ledger_mutation();

    create table control_plane.production_tasks (
      generation_task_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      package_id uuid not null references control_plane.production_packages(package_id),
      reservation_id uuid references control_plane.credit_reservations(reservation_id),
      external_task_id text,
      task_type text not null,
      capability_code text not null,
      status text not null check (status in ('requested', 'reserved', 'queued', 'running', 'succeeded', 'failed', 'cancelled')),
      idempotency_key text not null,
      error_code text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (tenant_id, idempotency_key)
    );

    alter table control_plane.credit_reservations
      add constraint credit_reservations_task_fk
      foreign key (generation_task_id)
      references control_plane.production_tasks(generation_task_id)
      deferrable initially deferred;

    create table control_plane.receipt_inbox (
      receipt_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      generation_task_id uuid references control_plane.production_tasks(generation_task_id),
      receipt_type text not null check (receipt_type in ('task', 'asset', 'export', 'usage')),
      business_id text not null,
      payload_digest text not null,
      payload jsonb not null,
      processing_status text not null check (processing_status in ('received', 'applied', 'rejected')),
      error_code text,
      received_at timestamptz not null default now(),
      processed_at timestamptz,
      unique (receipt_type, business_id, payload_digest)
    );

    create table control_plane.media_assets (
      asset_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      generation_task_id uuid references control_plane.production_tasks(generation_task_id),
      asset_type text not null,
      mime_type text not null,
      storage_key text not null,
      checksum text not null,
      provenance jsonb not null,
      review_status text not null check (review_status in ('pending', 'approved', 'rejected')),
      created_at timestamptz not null default now(),
      unique (tenant_id, storage_key),
      unique (tenant_id, checksum)
    );

    create table control_plane.export_artifacts (
      export_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null references control_plane.projects(project_id),
      generation_task_id uuid references control_plane.production_tasks(generation_task_id),
      asset_id uuid references control_plane.media_assets(asset_id),
      status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled')),
      created_at timestamptz not null default now(),
      completed_at timestamptz
    );

    create table control_plane.outbox_events (
      event_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      aggregate_type text not null,
      aggregate_id uuid not null,
      event_type text not null,
      payload jsonb not null,
      status text not null check (status in ('pending', 'processing', 'delivered', 'failed')),
      available_at timestamptz not null default now(),
      attempt_count integer not null default 0 check (attempt_count >= 0),
      last_error_code text,
      created_at timestamptz not null default now(),
      delivered_at timestamptz
    );
    create index outbox_pending_idx
      on control_plane.outbox_events (available_at, event_id)
      where status in ('pending', 'failed');

    create table control_plane.idempotency_records (
      idempotency_record_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      operation text not null,
      idempotency_key text not null,
      request_digest text not null,
      response_status integer,
      response_body jsonb,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      unique (tenant_id, operation, idempotency_key)
    );
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop schema if exists control_plane cascade;
  `);
}
