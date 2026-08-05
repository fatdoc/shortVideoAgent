import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.production_packages
      add column package_version integer,
      add column organization_id uuid,
      add column approved_script_version_id uuid,
      add column created_by uuid references control_plane.users(user_id);

    update control_plane.production_packages
      set package_version = 1,
          organization_id = tenant_id;

    update control_plane.production_packages package
      set created_by = project.created_by
      from control_plane.projects project
      where package.project_id = project.project_id
        and package.tenant_id = project.tenant_id;

    update control_plane.production_packages
      set approved_script_version_id = (snapshot #>> '{approvedScript,scriptVersionId}')::uuid
      where snapshot #>> '{approvedScript,scriptVersionId}'
        ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$';

    do $$
    begin
      if exists (
        select 1 from control_plane.production_packages
        where approved_script_version_id is null or created_by is null
      ) then
        raise exception 'legacy production packages must be remediated before migration 004';
      end if;
    end;
    $$;

    alter table control_plane.production_packages
      alter column package_version set not null,
      alter column organization_id set not null,
      alter column approved_script_version_id set not null,
      alter column created_by set not null,
      add constraint production_packages_version_positive_ck
        check (package_version > 0),
      add constraint production_packages_validity_ck
        check (valid_from < expires_at),
      add constraint production_packages_digest_ck
        check (package_digest ~ '^sha256:[a-f0-9]{64}$'),
      add constraint production_packages_project_version_uq
        unique (project_id, package_version),
      add constraint production_packages_id_project_tenant_uq
        unique (package_id, project_id, tenant_id),
      add constraint production_packages_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      add constraint production_packages_script_project_tenant_fk
        foreign key (approved_script_version_id, project_id, tenant_id)
        references control_plane.script_versions(script_version_id, project_id, tenant_id);

    alter table control_plane.project_grants
      add column contract_version text,
      add column idempotency_key text,
      add column payload_digest text,
      add column scopes jsonb,
      add column key_id text,
      add column nonce text,
      add column created_by uuid references control_plane.users(user_id);

    update control_plane.project_grants
      set contract_version = '0.2',
          idempotency_key = grant_id::text,
          payload_digest = 'sha256:' || repeat('0', 64),
          scopes = '["production.package.read"]'::jsonb,
          key_id = 'legacy-unusable',
          nonce = grant_id::text;

    update control_plane.project_grants grant_row
      set created_by = package.created_by
      from control_plane.production_packages package
      where grant_row.package_id = package.package_id;

    do $$
    begin
      if exists (select 1 from control_plane.project_grants where created_by is null) then
        raise exception 'legacy project grants must be remediated before migration 004';
      end if;
    end;
    $$;

    alter table control_plane.project_grants
      alter column contract_version set not null,
      alter column idempotency_key set not null,
      alter column payload_digest set not null,
      alter column scopes set not null,
      alter column key_id set not null,
      alter column nonce set not null,
      alter column created_by set not null,
      add constraint project_grants_contract_version_ck
        check (contract_version = '0.2'),
      add constraint project_grants_payload_digest_ck
        check (payload_digest ~ '^sha256:[a-f0-9]{64}$'),
      add constraint project_grants_capabilities_array_ck
        check (jsonb_typeof(capabilities) = 'array' and jsonb_array_length(capabilities) > 0),
      add constraint project_grants_scopes_array_ck
        check (jsonb_typeof(scopes) = 'array' and jsonb_array_length(scopes) > 0),
      add constraint project_grants_validity_ck
        check (issued_at < expires_at and expires_at <= issued_at + interval '15 minutes'),
      add constraint project_grants_tenant_idempotency_uq
        unique (tenant_id, idempotency_key),
      add constraint project_grants_id_project_tenant_uq
        unique (grant_id, project_id, tenant_id),
      add constraint project_grants_project_tenant_fk
        foreign key (project_id, tenant_id)
        references control_plane.projects(project_id, tenant_id),
      add constraint project_grants_package_project_tenant_fk
        foreign key (package_id, project_id, tenant_id)
        references control_plane.production_packages(package_id, project_id, tenant_id);

    create function control_plane.protect_production_package_snapshot()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'production package is immutable';
        end if;
        if new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.contract_version is distinct from old.contract_version
          or new.idempotency_key is distinct from old.idempotency_key
          or new.package_digest is distinct from old.package_digest
          or new.snapshot is distinct from old.snapshot
          or new.valid_from is distinct from old.valid_from
          or new.expires_at is distinct from old.expires_at
          or new.package_version is distinct from old.package_version
          or new.organization_id is distinct from old.organization_id
          or new.approved_script_version_id is distinct from old.approved_script_version_id
          or new.created_by is distinct from old.created_by then
          raise exception 'production package snapshot is immutable';
        end if;
        return new;
      end;
    $$;

    create trigger production_packages_snapshot_immutable
      before update or delete on control_plane.production_packages
      for each row execute function control_plane.protect_production_package_snapshot();

    create function control_plane.protect_project_grant_scope()
      returns trigger language plpgsql as $$
      begin
        if new.tenant_id is distinct from old.tenant_id
          or new.project_id is distinct from old.project_id
          or new.package_id is distinct from old.package_id
          or new.token_digest is distinct from old.token_digest
          or new.capabilities is distinct from old.capabilities
          or new.contract_version is distinct from old.contract_version
          or new.idempotency_key is distinct from old.idempotency_key
          or new.payload_digest is distinct from old.payload_digest
          or new.scopes is distinct from old.scopes
          or new.key_id is distinct from old.key_id
          or new.nonce is distinct from old.nonce
          or new.issued_at is distinct from old.issued_at
          or new.expires_at is distinct from old.expires_at
          or new.created_by is distinct from old.created_by then
          raise exception 'project grant scope is immutable';
        end if;
        return new;
      end;
    $$;

    create trigger project_grants_scope_immutable
      before update on control_plane.project_grants
      for each row execute function control_plane.protect_project_grant_scope();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop trigger if exists project_grants_scope_immutable on control_plane.project_grants;
    drop function if exists control_plane.protect_project_grant_scope();
    drop trigger if exists production_packages_snapshot_immutable on control_plane.production_packages;
    drop function if exists control_plane.protect_production_package_snapshot();

    alter table control_plane.project_grants
      drop constraint if exists project_grants_package_project_tenant_fk,
      drop constraint if exists project_grants_project_tenant_fk,
      drop constraint if exists project_grants_id_project_tenant_uq,
      drop constraint if exists project_grants_tenant_idempotency_uq,
      drop constraint if exists project_grants_validity_ck,
      drop constraint if exists project_grants_scopes_array_ck,
      drop constraint if exists project_grants_capabilities_array_ck,
      drop constraint if exists project_grants_payload_digest_ck,
      drop constraint if exists project_grants_contract_version_ck,
      drop column if exists created_by,
      drop column if exists nonce,
      drop column if exists key_id,
      drop column if exists scopes,
      drop column if exists payload_digest,
      drop column if exists idempotency_key,
      drop column if exists contract_version;

    alter table control_plane.production_packages
      drop constraint if exists production_packages_script_project_tenant_fk,
      drop constraint if exists production_packages_project_tenant_fk,
      drop constraint if exists production_packages_id_project_tenant_uq,
      drop constraint if exists production_packages_project_version_uq,
      drop constraint if exists production_packages_digest_ck,
      drop constraint if exists production_packages_validity_ck,
      drop constraint if exists production_packages_version_positive_ck,
      drop column if exists created_by,
      drop column if exists approved_script_version_id,
      drop column if exists organization_id,
      drop column if exists package_version;
  `);
}
