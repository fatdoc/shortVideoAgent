import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.storyboard_versions (
      storyboard_version_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      script_version_id uuid not null,
      version integer not null check (version > 0),
      status text not null default 'draft'
        check (status in ('draft', 'approved', 'revoked', 'superseded')),
      draft_revision_id text not null
        check (
          length(draft_revision_id) between 1 and 200
          and draft_revision_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
        ),
      draft_revision_number integer not null check (draft_revision_number > 0),
      previous_draft_revision_id text,
      script_payload_digest text not null
        check (script_payload_digest ~ '^sha256:[a-f0-9]{64}$'),
      payload jsonb not null check (jsonb_typeof(payload) = 'object'),
      payload_digest text not null check (payload_digest ~ '^sha256:[a-f0-9]{64}$'),
      provenance jsonb not null
        check (
          jsonb_typeof(provenance) = 'object'
          and jsonb_typeof(provenance -> 'sourceReceipt') = 'object'
          and length(coalesce(provenance #>> '{sourceReceipt,receiptId}', '')) > 0
          and coalesce(provenance #>> '{sourceReceipt,receiptDigest}', '')
            ~ '^sha256:[a-f0-9]{64}$'
          and length(coalesce(provenance #>> '{sourceReceipt,receivedAt}', '')) > 0
        ),
      created_by uuid not null references control_plane.users(user_id),
      created_at timestamptz not null default now(),
      constraint storyboard_versions_previous_revision_ck check (
        previous_draft_revision_id is null
        or (
          length(previous_draft_revision_id) between 1 and 200
          and previous_draft_revision_id ~ '^[A-Za-z0-9][A-Za-z0-9._:-]*$'
          and previous_draft_revision_id <> draft_revision_id
        )
      ),
      constraint storyboard_versions_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      constraint storyboard_versions_script_project_tenant_fk
        foreign key (script_version_id, project_id, tenant_id)
        references control_plane.script_versions(script_version_id, project_id, tenant_id),
      constraint storyboard_versions_id_project_tenant_uq
        unique (storyboard_version_id, project_id, tenant_id),
      constraint storyboard_versions_project_version_uq unique (project_id, version),
      constraint storyboard_versions_project_payload_uq unique (project_id, payload_digest),
      constraint storyboard_versions_draft_revision_uq
        unique (tenant_id, project_id, draft_revision_id)
    );

    create table control_plane.storyboard_approvals (
      storyboard_approval_id uuid primary key,
      approval_sequence bigint generated always as identity,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      storyboard_version_id uuid not null,
      status text not null check (status in ('approved', 'revoked', 'blocked')),
      fact_risk_status text not null check (fact_risk_status in ('cleared', 'unresolved')),
      reason text,
      idempotency_key text not null
        check (length(idempotency_key) between 1 and 200),
      event_digest text not null check (event_digest ~ '^sha256:[a-f0-9]{64}$'),
      acted_by uuid not null references control_plane.users(user_id),
      acted_at timestamptz not null default now(),
      constraint storyboard_approvals_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      constraint storyboard_approvals_version_project_tenant_fk
        foreign key (storyboard_version_id, project_id, tenant_id)
        references control_plane.storyboard_versions(storyboard_version_id, project_id, tenant_id),
      constraint storyboard_approvals_tenant_idempotency_uq
        unique (tenant_id, idempotency_key),
      constraint storyboard_approvals_event_digest_uq
        unique (tenant_id, event_digest)
    );

    create index storyboard_versions_project_created_idx
      on control_plane.storyboard_versions (tenant_id, project_id, version desc);
    create index storyboard_approvals_latest_idx
      on control_plane.storyboard_approvals
      (tenant_id, project_id, storyboard_version_id, approval_sequence desc);

    create or replace function control_plane.protect_storyboard_version_authority()
      returns trigger language plpgsql as $$
      declare
        latest_status text;
        latest_fact_risk_status text;
      begin
        if tg_op = 'DELETE' then
          raise exception 'storyboard version authority is immutable';
        end if;
        if tg_op = 'INSERT' and new.status <> 'draft' then
          raise exception 'storyboard version must begin as draft';
        end if;
        if tg_op = 'UPDATE' then
          if new.tenant_id is distinct from old.tenant_id
            or new.project_id is distinct from old.project_id
            or new.script_version_id is distinct from old.script_version_id
            or new.version is distinct from old.version
            or new.draft_revision_id is distinct from old.draft_revision_id
            or new.draft_revision_number is distinct from old.draft_revision_number
            or new.previous_draft_revision_id is distinct from old.previous_draft_revision_id
            or new.script_payload_digest is distinct from old.script_payload_digest
            or new.payload is distinct from old.payload
            or new.payload_digest is distinct from old.payload_digest
            or new.provenance is distinct from old.provenance
            or new.created_by is distinct from old.created_by
            or new.created_at is distinct from old.created_at then
            raise exception 'storyboard version authority is immutable';
          end if;

          if new.status is distinct from old.status and new.status in ('approved', 'revoked') then
            select approval.status, approval.fact_risk_status
              into latest_status, latest_fact_risk_status
            from control_plane.storyboard_approvals approval
            where approval.tenant_id = new.tenant_id
              and approval.project_id = new.project_id
              and approval.storyboard_version_id = new.storyboard_version_id
            order by approval.approval_sequence desc
            limit 1;

            if latest_status is distinct from new.status
              or (new.status = 'approved' and latest_fact_risk_status <> 'cleared') then
              raise exception 'storyboard status requires matching append-only approval';
            end if;
          end if;

          if old.status in ('revoked', 'superseded') and new.status <> old.status then
            raise exception 'terminal storyboard status is immutable';
          end if;
        end if;
        return new;
      end;
    $$;

    create trigger storyboard_versions_authority_immutable
      before insert or update or delete on control_plane.storyboard_versions
      for each row execute function control_plane.protect_storyboard_version_authority();

    create or replace function control_plane.protect_storyboard_approval_event()
      returns trigger language plpgsql as $$
      begin
        raise exception 'storyboard approval events are append-only';
      end;
    $$;

    create trigger storyboard_approvals_append_only
      before update or delete on control_plane.storyboard_approvals
      for each row execute function control_plane.protect_storyboard_approval_event();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.storyboard_approvals)
        or exists (select 1 from control_plane.storyboard_versions) then
        raise exception 'storyboard authority rollback blocked: authority evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists storyboard_approvals_append_only
      on control_plane.storyboard_approvals;
    drop trigger if exists storyboard_versions_authority_immutable
      on control_plane.storyboard_versions;
    drop function if exists control_plane.protect_storyboard_approval_event();
    drop function if exists control_plane.protect_storyboard_version_authority();
    drop table if exists control_plane.storyboard_approvals;
    drop table if exists control_plane.storyboard_versions;
  `);
}
