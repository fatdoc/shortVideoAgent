import type { Knex } from 'knex';

export async function up(database: Knex): Promise<void> {
  await database.raw(`
    create table control_plane.terms_documents (
      terms_document_id uuid primary key,
      document_code text not null,
      title text not null,
      status text not null
        check (status in ('active', 'retired')),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint terms_documents_code_nonempty_ck
        check (
          document_code = btrim(document_code)
          and char_length(document_code) between 1 and 100
        ),
      constraint terms_documents_title_nonempty_ck
        check (
          title = btrim(title)
          and char_length(title) between 1 and 300
        )
    );

    create unique index terms_documents_code_normalized_uq
      on control_plane.terms_documents (lower(document_code));

    create table control_plane.terms_versions (
      terms_version_id uuid primary key,
      terms_document_id uuid not null
        references control_plane.terms_documents(terms_document_id),
      version_label text not null,
      status text not null
        check (status in ('DRAFT', 'PUBLISHED', 'RETIRED')),
      content text not null,
      content_digest text not null,
      locale text not null,
      published_at timestamptz,
      effective_at timestamptz,
      published_by uuid
        references control_plane.users(user_id),
      supersedes_terms_version_id uuid,
      must_reaccept boolean not null default false,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint terms_versions_label_nonempty_ck
        check (
          version_label = btrim(version_label)
          and char_length(version_label) between 1 and 100
        ),
      constraint terms_versions_content_nonempty_ck
        check (char_length(btrim(content)) > 0),
      constraint terms_versions_locale_nonempty_ck
        check (
          locale = btrim(locale)
          and char_length(locale) between 1 and 35
        ),
      constraint terms_versions_digest_format_ck
        check (content_digest ~ '^[0-9a-f]{64}$'),
      constraint terms_versions_digest_matches_content_ck
        check (
          content_digest = encode(sha256(convert_to(content, 'UTF8')), 'hex')
        ),
      constraint terms_versions_publication_evidence_ck
        check (
          (
            status = 'DRAFT'
            and published_at is null
            and published_by is null
          )
          or (
            status in ('PUBLISHED', 'RETIRED')
            and published_at is not null
            and effective_at is not null
            and published_by is not null
          )
        ),
      constraint terms_versions_supersedes_not_self_ck
        check (
          supersedes_terms_version_id is null
          or supersedes_terms_version_id <> terms_version_id
        ),
      constraint terms_versions_identity_scope_uq
        unique (terms_version_id, terms_document_id, locale),
      constraint terms_versions_label_scope_uq
        unique (terms_document_id, locale, version_label),
      constraint terms_versions_supersedes_scope_fk
        foreign key (
          supersedes_terms_version_id,
          terms_document_id,
          locale
        ) references control_plane.terms_versions (
          terms_version_id,
          terms_document_id,
          locale
        )
    );

    create unique index terms_versions_published_effective_uq
      on control_plane.terms_versions (
        terms_document_id,
        locale,
        effective_at
      ) where status = 'PUBLISHED';

    create index terms_versions_public_current_idx
      on control_plane.terms_versions (
        terms_document_id,
        locale,
        effective_at desc,
        published_at desc,
        terms_version_id desc
      ) where status = 'PUBLISHED';

    create index terms_versions_supersedes_idx
      on control_plane.terms_versions (supersedes_terms_version_id)
      where supersedes_terms_version_id is not null;

    create table control_plane.user_consents (
      user_consent_id uuid primary key,
      user_id uuid not null
        references control_plane.users(user_id),
      terms_version_id uuid not null
        references control_plane.terms_versions(terms_version_id),
      content_digest_snapshot text not null,
      accepted_at timestamptz not null,
      acceptance_context text not null,
      registration_id uuid,
      evidence_metadata jsonb not null,
      created_at timestamptz not null default now(),
      constraint user_consents_digest_format_ck
        check (content_digest_snapshot ~ '^[0-9a-f]{64}$'),
      constraint user_consents_context_nonempty_ck
        check (
          acceptance_context = btrim(acceptance_context)
          and char_length(acceptance_context) between 1 and 100
        ),
      constraint user_consents_evidence_object_ck
        check (
          jsonb_typeof(evidence_metadata) = 'object'
          and evidence_metadata <> '{}'::jsonb
        )
    );

    create index user_consents_user_accepted_idx
      on control_plane.user_consents (user_id, accepted_at desc);
    create index user_consents_version_accepted_idx
      on control_plane.user_consents (terms_version_id, accepted_at desc);
    create index user_consents_registration_idx
      on control_plane.user_consents (registration_id)
      where registration_id is not null;

    create function control_plane.protect_terms_document_lifecycle()
      returns trigger language plpgsql as $$
      begin
        if tg_op = 'DELETE' then
          return old;
        end if;

        if new.document_code is distinct from old.document_code then
          raise exception 'terms document_code is immutable';
        end if;

        if old.status = 'retired' and new.status <> 'retired' then
          raise exception 'retired terms document lifecycle is immutable';
        end if;

        new.updated_at := now();
        return new;
      end;
      $$;

    create trigger terms_documents_lifecycle_guard
      before update or delete
      on control_plane.terms_documents
      for each row execute function control_plane.protect_terms_document_lifecycle();

    create function control_plane.protect_terms_version_lifecycle()
      returns trigger language plpgsql as $$
      declare
        superseded_status text;
        document_status text;
      begin
        if tg_op = 'DELETE' then
          if old.status <> 'DRAFT' then
            raise exception '% terms version is immutable and cannot be deleted', lower(old.status);
          end if;
          return old;
        end if;

        if old.status = 'DRAFT' and new.status not in ('DRAFT', 'PUBLISHED') then
          raise exception 'invalid terms version lifecycle transition from DRAFT to %', new.status;
        elsif old.status = 'PUBLISHED' and new.status not in ('PUBLISHED', 'RETIRED') then
          raise exception 'invalid terms version lifecycle transition from PUBLISHED to %', new.status;
        elsif old.status = 'RETIRED' and new.status <> 'RETIRED' then
          raise exception 'retired terms version lifecycle is immutable';
        end if;

        if old.status in ('PUBLISHED', 'RETIRED') and (
          new.terms_document_id is distinct from old.terms_document_id
          or new.version_label is distinct from old.version_label
          or new.content is distinct from old.content
          or new.content_digest is distinct from old.content_digest
          or new.locale is distinct from old.locale
          or new.published_at is distinct from old.published_at
          or new.effective_at is distinct from old.effective_at
          or new.published_by is distinct from old.published_by
          or new.supersedes_terms_version_id is distinct from old.supersedes_terms_version_id
          or new.must_reaccept is distinct from old.must_reaccept
          or new.created_at is distinct from old.created_at
        ) then
          raise exception '% terms version facts are immutable', lower(old.status);
        end if;

        if old.status = 'DRAFT' and new.status = 'PUBLISHED' then
          select status
            into document_status
          from control_plane.terms_documents
          where terms_document_id = new.terms_document_id;

          if document_status is distinct from 'active' then
            raise exception 'terms version cannot be published for a non-active document';
          end if;
        end if;

        if new.supersedes_terms_version_id is not null then
          select status
            into superseded_status
          from control_plane.terms_versions
          where terms_version_id = new.supersedes_terms_version_id
            and terms_document_id = new.terms_document_id
            and locale = new.locale;

          if superseded_status is null then
            raise exception 'superseded terms version must share document and locale';
          end if;

          if superseded_status = 'DRAFT' then
            raise exception 'a terms version may only supersede released content';
          end if;
        end if;

        new.updated_at := now();
        return new;
      end;
      $$;

    create trigger terms_versions_lifecycle_guard
      before update or delete
      on control_plane.terms_versions
      for each row execute function control_plane.protect_terms_version_lifecycle();

    create function control_plane.validate_terms_version_insert()
      returns trigger language plpgsql as $$
      declare
        superseded_status text;
      begin
        if new.supersedes_terms_version_id is null then
          return new;
        end if;

        select status
          into superseded_status
        from control_plane.terms_versions
        where terms_version_id = new.supersedes_terms_version_id
          and terms_document_id = new.terms_document_id
          and locale = new.locale;

        if superseded_status is null then
          raise exception 'superseded terms version must share document and locale';
        end if;

        if superseded_status = 'DRAFT' then
          raise exception 'a terms version may only supersede released content';
        end if;

        return new;
      end;
      $$;

    create trigger terms_versions_insert_guard
      before insert
      on control_plane.terms_versions
      for each row execute function control_plane.validate_terms_version_insert();

    create function control_plane.validate_user_consent()
      returns trigger language plpgsql as $$
      declare
        released_status text;
        released_digest text;
      begin
        select status, content_digest
          into released_status, released_digest
        from control_plane.terms_versions
        where terms_version_id = new.terms_version_id;

        if released_status is null then
          raise exception 'consent terms version does not exist';
        end if;

        if released_status not in ('PUBLISHED', 'RETIRED') then
          raise exception 'consent requires published or retired released terms';
        end if;

        if new.content_digest_snapshot is distinct from released_digest then
          raise exception 'consent digest snapshot does not match terms version digest';
        end if;

        return new;
      end;
      $$;

    create trigger user_consents_validation_guard
      before insert
      on control_plane.user_consents
      for each row execute function control_plane.validate_user_consent();

    create function control_plane.protect_user_consent_append_only()
      returns trigger language plpgsql as $$
      begin
        raise exception 'user consent is append-only';
      end;
      $$;

    create trigger user_consents_append_only_guard
      before update or delete
      on control_plane.user_consents
      for each row execute function control_plane.protect_user_consent_append_only();
  `);
}

export async function down(database: Knex): Promise<void> {
  await database.raw(`
    do $$
    begin
      if exists (
        select 1
        from control_plane.user_consents
      ) then
        raise exception 'terms rollback blocked: consent audit evidence exists';
      end if;

      if exists (
        select 1
        from control_plane.terms_versions
        where status in ('PUBLISHED', 'RETIRED')
      ) then
        raise exception 'terms rollback blocked: published or retired audit facts exist';
      end if;
    end;
    $$;

    drop trigger if exists user_consents_append_only_guard
      on control_plane.user_consents;
    drop function if exists control_plane.protect_user_consent_append_only();
    drop trigger if exists user_consents_validation_guard
      on control_plane.user_consents;
    drop function if exists control_plane.validate_user_consent();
    drop trigger if exists terms_versions_insert_guard
      on control_plane.terms_versions;
    drop function if exists control_plane.validate_terms_version_insert();
    drop trigger if exists terms_versions_lifecycle_guard
      on control_plane.terms_versions;
    drop function if exists control_plane.protect_terms_version_lifecycle();
    drop trigger if exists terms_documents_lifecycle_guard
      on control_plane.terms_documents;
    drop function if exists control_plane.protect_terms_document_lifecycle();

    drop table if exists control_plane.user_consents;
    drop table if exists control_plane.terms_versions;
    drop table if exists control_plane.terms_documents;
  `);
}
