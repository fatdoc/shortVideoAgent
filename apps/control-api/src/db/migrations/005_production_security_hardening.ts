import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create function control_plane.jsonb_text_array_is_unique_subset(
      input jsonb,
      allowed_values text[]
    ) returns boolean
    language sql
    immutable
    strict
    as $$
      select jsonb_typeof(input) = 'array'
        and jsonb_array_length(input) > 0
        and not exists (
          select 1
          from jsonb_array_elements(input) item
          where jsonb_typeof(item) <> 'string'
             or (item #>> '{}') <> all(allowed_values)
        )
        and (
          select count(*) = count(distinct item #>> '{}')
          from jsonb_array_elements(input) item
        );
    $$;

    alter table control_plane.production_packages
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

    alter table control_plane.project_grants
      drop constraint project_grants_capabilities_array_ck,
      drop constraint project_grants_scopes_array_ck,
      add constraint project_grants_capabilities_policy_ck
        check (
          control_plane.jsonb_text_array_is_unique_subset(
            capabilities,
            array['image.generate', 'video.generate', 'audio.tts', 'media.export']
          )
        ),
      add constraint project_grants_scopes_policy_ck
        check (
          control_plane.jsonb_text_array_is_unique_subset(
            scopes,
            array[
              'production.package.read',
              'production.task.write',
              'production.receipt.write',
              'production.asset.write',
              'production.export.write'
            ]
          )
        ),
      add constraint project_grants_token_digest_ck
        check (token_digest ~ '^sha256:[a-f0-9]{64}$'),
      add constraint project_grants_status_revocation_ck
        check (
          (status = 'active' and revoked_at is null)
          or (status = 'revoked' and revoked_at is not null)
          or (status = 'expired' and revoked_at is null)
        );

    create or replace function control_plane.protect_project_grant_scope()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          raise exception 'project grant cannot be deleted';
        end if;
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

    drop trigger project_grants_scope_immutable on control_plane.project_grants;
    create trigger project_grants_scope_immutable
      before update or delete on control_plane.project_grants
      for each row execute function control_plane.protect_project_grant_scope();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    drop trigger if exists project_grants_scope_immutable on control_plane.project_grants;
    create trigger project_grants_scope_immutable
      before update on control_plane.project_grants
      for each row execute function control_plane.protect_project_grant_scope();

    alter table control_plane.project_grants
      drop constraint if exists project_grants_status_revocation_ck,
      drop constraint if exists project_grants_token_digest_ck,
      drop constraint if exists project_grants_scopes_policy_ck,
      drop constraint if exists project_grants_capabilities_policy_ck,
      add constraint project_grants_capabilities_array_ck
        check (jsonb_typeof(capabilities) = 'array' and jsonb_array_length(capabilities) > 0),
      add constraint project_grants_scopes_array_ck
        check (jsonb_typeof(scopes) = 'array' and jsonb_array_length(scopes) > 0);

    alter table control_plane.production_packages
      drop constraint if exists production_packages_snapshot_contract_ck,
      drop constraint if exists production_packages_contract_version_ck;

    drop function if exists control_plane.jsonb_text_array_is_unique_subset(jsonb, text[]);
  `);
}
