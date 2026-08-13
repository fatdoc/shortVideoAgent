import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    alter table control_plane.production_packages
      drop constraint production_packages_snapshot_contract_ck,
      drop constraint production_packages_contract_version_ck,
      add column approved_storyboard_version_id uuid,
      add column approved_script_digest text,
      add column approved_storyboard_digest text;

    alter table control_plane.production_packages
      add constraint production_packages_storyboard_project_tenant_fk
        foreign key (approved_storyboard_version_id, project_id, tenant_id)
        references control_plane.storyboard_versions(storyboard_version_id, project_id, tenant_id),
      add constraint production_packages_approved_script_digest_ck
        check (
          approved_script_digest is null
          or approved_script_digest ~ '^sha256:[a-f0-9]{64}$'
        ),
      add constraint production_packages_approved_storyboard_digest_ck
        check (
          approved_storyboard_digest is null
          or approved_storyboard_digest ~ '^sha256:[a-f0-9]{64}$'
        ),
      add constraint production_packages_contract_version_ck
        check (contract_version in ('0.2', '0.3')),
      add constraint production_packages_authority_contract_ck
        check (
          (
            contract_version = '0.2'
            and approved_storyboard_version_id is null
            and approved_script_digest is null
            and approved_storyboard_digest is null
          )
          or
          (
            contract_version = '0.3'
            and approved_storyboard_version_id is not null
            and approved_script_digest is not null
            and approved_storyboard_digest is not null
          )
        ),
      add constraint production_packages_snapshot_contract_ck
        check (
          jsonb_typeof(snapshot) = 'object'
          and snapshot ->> 'objectType' = 'ProjectProductionPackage'
          and snapshot ->> 'contractVersion' = contract_version
          and snapshot ->> 'tenantId' = tenant_id::text
          and snapshot ->> 'projectId' = project_id::text
          and snapshot ->> 'packageId' = package_id::text
          and snapshot ->> 'payloadDigest' = package_digest
          and (
            contract_version = '0.2'
            or (
              contract_version = '0.3'
              and jsonb_typeof(snapshot -> 'packageVersion') = 'number'
              and snapshot ->> 'packageVersion' = package_version::text
              and jsonb_typeof(snapshot -> 'scriptVersionId') = 'string'
              and snapshot ->> 'scriptVersionId' = approved_script_version_id::text
              and jsonb_typeof(snapshot -> 'storyboardVersionId') = 'string'
              and snapshot ->> 'storyboardVersionId' = approved_storyboard_version_id::text
              and jsonb_typeof(snapshot -> 'approvedScriptDigest') = 'string'
              and snapshot ->> 'approvedScriptDigest' = approved_script_digest
              and jsonb_typeof(snapshot -> 'approvedStoryboardDigest') = 'string'
              and snapshot ->> 'approvedStoryboardDigest' = approved_storyboard_digest
            )
          )
        );

    create or replace function control_plane.protect_production_package_snapshot()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'production package is immutable';
        end if;
        if new.package_id is distinct from old.package_id
          or new.tenant_id is distinct from old.tenant_id
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
          or new.approved_storyboard_version_id is distinct from old.approved_storyboard_version_id
          or new.approved_script_digest is distinct from old.approved_script_digest
          or new.approved_storyboard_digest is distinct from old.approved_storyboard_digest
          or new.created_by is distinct from old.created_by then
          raise exception 'production package snapshot is immutable';
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
        from control_plane.production_packages
        where contract_version = '0.3'
          or approved_storyboard_version_id is not null
          or approved_script_digest is not null
          or approved_storyboard_digest is not null
      ) then
        raise exception 'production storyboard authority rollback blocked: authority evidence exists';
      end if;
    end;
    $$;

    alter table control_plane.production_packages
      drop constraint if exists production_packages_snapshot_contract_ck,
      drop constraint if exists production_packages_authority_contract_ck,
      drop constraint if exists production_packages_contract_version_ck,
      drop constraint if exists production_packages_approved_storyboard_digest_ck,
      drop constraint if exists production_packages_approved_script_digest_ck,
      drop constraint if exists production_packages_storyboard_project_tenant_fk;

    create or replace function control_plane.protect_production_package_snapshot()
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

    alter table control_plane.production_packages
      drop column approved_storyboard_digest,
      drop column approved_script_digest,
      drop column approved_storyboard_version_id,
      add constraint production_packages_contract_version_ck
        check (contract_version = '0.2'),
      add constraint production_packages_snapshot_contract_ck
        check (
          snapshot ->> 'objectType' = 'ProjectProductionPackage'
          and snapshot ->> 'contractVersion' = contract_version
          and snapshot ->> 'tenantId' = tenant_id::text
          and snapshot ->> 'projectId' = project_id::text
          and snapshot ->> 'packageId' = package_id::text
          and snapshot ->> 'payloadDigest' = package_digest
        );
  `);
}
