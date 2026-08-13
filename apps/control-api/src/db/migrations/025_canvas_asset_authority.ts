import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.canvas_asset_records (
      asset_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      package_id uuid not null,
      canvas_session_id text not null
        check (canvas_session_id ~ '^pcs_[A-Za-z0-9_-]{24,128}$'),
      category text not null check (category in (
        'human', 'virtual_character', 'store', 'product', 'brand', 'prop', 'voice', 'image', 'video'
      )),
      display_name text not null check (length(display_name) between 1 and 200),
      provenance_kind text not null check (provenance_kind in (
        'customer_upload', 'provider_generated', 'licensed', 'control_synced'
      )),
      source_asset_id uuid,
      declared_by_actor_id uuid not null references control_plane.users(user_id),
      declared_at timestamptz not null,
      rights_status text not null check (rights_status in (
        'pending', 'authorized', 'rejected', 'revoked', 'expired'
      )),
      rights_basis text not null check (rights_basis in (
        'customer_owned', 'licensed', 'provider_generated', 'external_identity_verification'
      )),
      rights_valid_from timestamptz,
      rights_valid_until timestamptz,
      rights_reviewed_by_actor_id uuid references control_plane.users(user_id),
      rights_reviewed_at timestamptz,
      approval_status text not null check (approval_status in (
        'pending', 'approved', 'rejected', 'revoked'
      )),
      approval_reviewed_by_actor_id uuid references control_plane.users(user_id),
      approval_reviewed_at timestamptz,
      storage_reference text not null
        check (
          length(storage_reference) between 1 and 1024
          and storage_reference ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
          and storage_reference !~ '(^|/)\\.\\.(/|$)'
          and storage_reference !~* 'asset://'
          and storage_reference !~* '(^|/)(storycanvas|[^/]*\\.sqlite3?)(/|$)'
          and storage_reference !~* '(^|[._/-])(token|credential|secret|bearer|authorization|cookie|projectgrant)([._/-]|$)'
        ),
      checksum text not null check (checksum ~ '^sha256:[a-f0-9]{64}$'),
      reuse_scope text not null check (reuse_scope in ('project', 'tenant')),
      controlled_preview_url text check (
        controlled_preview_url is null or controlled_preview_url ~
          '^(/api/canvas-v1/[A-Za-z0-9_./-]+|https://[A-Za-z0-9.-]+/[A-Za-z0-9_./%-]+)$'
      ),
      created_at timestamptz not null,
      updated_at timestamptz not null,
      constraint canvas_asset_records_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      constraint canvas_asset_records_package_scope_fk
        foreign key (package_id, project_id, tenant_id)
        references control_plane.production_packages(package_id, project_id, tenant_id),
      constraint canvas_asset_records_source_tenant_fk
        foreign key (source_asset_id, tenant_id)
        references control_plane.canvas_asset_records(asset_id, tenant_id),
      constraint canvas_asset_records_rights_window_ck check (
        (rights_status = 'pending' and rights_valid_from is null and rights_valid_until is null
          and rights_reviewed_by_actor_id is null and rights_reviewed_at is null)
        or (rights_status = 'authorized' and rights_valid_from is not null
          and rights_reviewed_by_actor_id is not null and rights_reviewed_at is not null
          and (rights_valid_until is null or rights_valid_from < rights_valid_until))
        or (rights_status in ('rejected', 'revoked', 'expired')
          and rights_reviewed_by_actor_id is not null and rights_reviewed_at is not null
          and (rights_valid_until is null or rights_valid_from is null
            or rights_valid_from < rights_valid_until))
      ),
      constraint canvas_asset_records_approval_review_ck check (
        (approval_status = 'pending' and approval_reviewed_by_actor_id is null
          and approval_reviewed_at is null)
        or (approval_status <> 'pending' and approval_reviewed_by_actor_id is not null
          and approval_reviewed_at is not null)
      ),
      constraint canvas_asset_records_time_ck check (
        created_at = declared_at and updated_at >= created_at
      ),
      unique (asset_id, project_id, tenant_id),
      unique (asset_id, tenant_id),
      unique (tenant_id, project_id, checksum)
    );

    create index canvas_asset_records_project_idx
      on control_plane.canvas_asset_records (tenant_id, project_id, created_at, asset_id);

    create function control_plane.protect_canvas_asset_record()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'canvas asset authority is immutable';
        end if;
        if new.asset_id is distinct from old.asset_id
          or new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.package_id is distinct from old.package_id
          or new.canvas_session_id is distinct from old.canvas_session_id
          or new.category is distinct from old.category
          or new.display_name is distinct from old.display_name
          or new.provenance_kind is distinct from old.provenance_kind
          or new.source_asset_id is distinct from old.source_asset_id
          or new.declared_by_actor_id is distinct from old.declared_by_actor_id
          or new.declared_at is distinct from old.declared_at
          or new.rights_basis is distinct from old.rights_basis
          or new.storage_reference is distinct from old.storage_reference
          or new.checksum is distinct from old.checksum
          or new.reuse_scope is distinct from old.reuse_scope
          or new.controlled_preview_url is distinct from old.controlled_preview_url
          or new.created_at is distinct from old.created_at then
          raise exception 'canvas asset immutable facts cannot change';
        end if;
        if new.rights_status is distinct from old.rights_status and not (
          (old.rights_status = 'pending' and new.rights_status in ('authorized', 'rejected'))
          or (old.rights_status = 'authorized' and new.rights_status in ('revoked', 'expired'))
        ) then
          raise exception 'canvas asset rights transition is invalid';
        end if;
        if new.rights_status is not distinct from old.rights_status and (
          new.rights_valid_from is distinct from old.rights_valid_from
          or new.rights_valid_until is distinct from old.rights_valid_until
          or new.rights_reviewed_by_actor_id is distinct from old.rights_reviewed_by_actor_id
          or new.rights_reviewed_at is distinct from old.rights_reviewed_at
        ) then
          raise exception 'canvas asset rights facts require a lifecycle transition';
        end if;
        if new.approval_status is distinct from old.approval_status and not (
          (old.approval_status = 'pending' and new.approval_status in ('approved', 'rejected'))
          or (old.approval_status = 'approved' and new.approval_status = 'revoked')
        ) then
          raise exception 'canvas asset approval transition is invalid';
        end if;
        if new.approval_status is not distinct from old.approval_status and (
          new.approval_reviewed_by_actor_id is distinct from old.approval_reviewed_by_actor_id
          or new.approval_reviewed_at is distinct from old.approval_reviewed_at
        ) then
          raise exception 'canvas asset approval facts require a lifecycle transition';
        end if;
        if new.rights_status is not distinct from old.rights_status
          and new.approval_status is not distinct from old.approval_status
          and new.updated_at is distinct from old.updated_at then
          raise exception 'canvas asset update requires a lifecycle transition';
        end if;
        return new;
      end;
    $$;

    create trigger canvas_asset_records_protected
      before update or delete on control_plane.canvas_asset_records
      for each row execute function control_plane.protect_canvas_asset_record();

    create table control_plane.high_cost_command_approvals (
      approval_id uuid primary key,
      tenant_id uuid not null references control_plane.tenants(tenant_id),
      project_id uuid not null,
      package_id uuid not null,
      canvas_session_id text not null
        check (canvas_session_id ~ '^pcs_[A-Za-z0-9_-]{24,128}$'),
      actor_id uuid not null references control_plane.users(user_id),
      command_type text not null check (command_type in (
        'CREATE_VIRTUAL_CHARACTER', 'SYNC_PROVIDER_ASSET', 'BIND_ASSET_TO_ENTITY',
        'GENERATE_SHOT', 'SELECT_SHOT_OUTPUT', 'EXPORT_PLAYLIST'
      )),
      action_fingerprint text not null check (action_fingerprint ~ '^sha256:[a-f0-9]{64}$'),
      confirmed_at timestamptz not null,
      expires_at timestamptz not null,
      replay_policy text not null check (replay_policy = 'single_use_replay_same_command'),
      status text not null check (status in ('active', 'consumed', 'expired', 'revoked')),
      consumed_at timestamptz,
      consumed_by_command_id uuid,
      constraint high_cost_approvals_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      constraint high_cost_approvals_package_scope_fk
        foreign key (package_id, project_id, tenant_id)
        references control_plane.production_packages(package_id, project_id, tenant_id),
      constraint high_cost_approvals_validity_ck check (
        confirmed_at < expires_at and expires_at <= confirmed_at + interval '5 minutes'
      ),
      constraint high_cost_approvals_consumption_ck check (
        (status = 'active' and consumed_at is null and consumed_by_command_id is null)
        or (status = 'consumed' and consumed_at is not null and consumed_by_command_id is not null
          and consumed_at >= confirmed_at and consumed_at < expires_at)
        or (status in ('expired', 'revoked') and consumed_at is null
          and consumed_by_command_id is null)
      )
    );

    create index high_cost_approvals_scope_idx
      on control_plane.high_cost_command_approvals
      (tenant_id, project_id, package_id, canvas_session_id, actor_id, approval_id);

    create function control_plane.protect_high_cost_command_approval()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'high cost command approval is immutable';
        end if;
        if new.approval_id is distinct from old.approval_id
          or new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.package_id is distinct from old.package_id
          or new.canvas_session_id is distinct from old.canvas_session_id
          or new.actor_id is distinct from old.actor_id
          or new.command_type is distinct from old.command_type
          or new.action_fingerprint is distinct from old.action_fingerprint
          or new.confirmed_at is distinct from old.confirmed_at
          or new.expires_at is distinct from old.expires_at
          or new.replay_policy is distinct from old.replay_policy then
          raise exception 'high cost command approval scope is immutable';
        end if;
        if old.status <> 'active' or new.status not in ('consumed', 'expired', 'revoked') then
          raise exception 'high cost command approval transition is invalid';
        end if;
        return new;
      end;
    $$;

    create trigger high_cost_command_approvals_protected
      before update or delete on control_plane.high_cost_command_approvals
      for each row execute function control_plane.protect_high_cost_command_approval();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (select 1 from control_plane.canvas_asset_records)
        or exists (select 1 from control_plane.high_cost_command_approvals) then
        raise exception 'canvas asset authority rollback blocked: authority evidence exists';
      end if;
    end;
    $$;

    drop trigger if exists high_cost_command_approvals_protected
      on control_plane.high_cost_command_approvals;
    drop function if exists control_plane.protect_high_cost_command_approval();
    drop table control_plane.high_cost_command_approvals;
    drop trigger if exists canvas_asset_records_protected on control_plane.canvas_asset_records;
    drop function if exists control_plane.protect_canvas_asset_record();
    drop table control_plane.canvas_asset_records;
  `);
}
