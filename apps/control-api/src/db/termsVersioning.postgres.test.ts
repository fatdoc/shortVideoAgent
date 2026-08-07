import { createHash } from 'node:crypto';
import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from './migrations/001_pilot_core.js';
import {
  down as removeTermsVersioning,
  up as addTermsVersioning,
} from './migrations/011_terms_versioning.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const publisherId = '71000000-0000-4000-8000-000000000001';
const consentingUserId = '71000000-0000-4000-8000-000000000002';
const documentId = '72000000-0000-4000-8000-000000000001';
const alternateDocumentId = '72000000-0000-4000-8000-000000000002';
const versionOneId = '73000000-0000-4000-8000-000000000001';
const versionTwoId = '73000000-0000-4000-8000-000000000002';
const alternateVersionId = '73000000-0000-4000-8000-000000000003';
const consentId = '74000000-0000-4000-8000-000000000001';

function digest(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await database('control_plane.users').insert([
    {
      user_id: publisherId,
      email: 'publisher@example.com',
      display_name: 'Terms Publisher',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: consentingUserId,
      email: 'consenting-user@example.com',
      display_name: 'Consenting User',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
}

async function insertDocument(
  database: Knex,
  values: Partial<{
    terms_document_id: string;
    document_code: string;
    title: string;
  }> = {},
): Promise<void> {
  await database('control_plane.terms_documents').insert({
    terms_document_id: values.terms_document_id ?? documentId,
    document_code: values.document_code ?? 'registration-notice',
    title: values.title ?? 'Registration notice test fixture',
    status: 'active',
  });
}

async function insertDraft(
  database: Knex,
  values: Partial<{
    terms_version_id: string;
    terms_document_id: string;
    version_label: string;
    content: string;
    locale: string;
    supersedes_terms_version_id: string | null;
  }> = {},
): Promise<void> {
  const content = values.content ?? 'Test-only terms body version one.';
  await database('control_plane.terms_versions').insert({
    terms_version_id: values.terms_version_id ?? versionOneId,
    terms_document_id: values.terms_document_id ?? documentId,
    version_label: values.version_label ?? 'test-v1',
    status: 'DRAFT',
    content,
    content_digest: digest(content),
    locale: values.locale ?? 'zh-CN',
    supersedes_terms_version_id: values.supersedes_terms_version_id ?? null,
    must_reaccept: false,
  });
}

async function publish(
  database: Knex,
  versionId = versionOneId,
  effectiveAt = '2026-08-07T12:00:00.000Z',
): Promise<void> {
  await database('control_plane.terms_versions').where({ terms_version_id: versionId }).update({
    status: 'PUBLISHED',
    published_at: '2026-08-07T11:00:00.000Z',
    effective_at: effectiveAt,
    published_by: publisherId,
  });
}

async function tableRegistration(database: Knex, tableName: string): Promise<string | null> {
  const result = await database.raw<{ rows: Array<{ table_name: string | null }> }>(
    'select to_regclass(?)::text as table_name',
    [`control_plane.${tableName}`],
  );
  return result.rows[0]?.table_name ?? null;
}

describe.runIf(hasDedicatedTestDatabase)('migration 011 terms versioning', () => {
  let database: Knex;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('creates the three Terms tables without seeding a formal or placeholder document', async () => {
    await addTermsVersioning(database);

    await expect(
      Promise.all(
        ['terms_documents', 'terms_versions', 'user_consents'].map((tableName) =>
          tableRegistration(database, tableName),
        ),
      ),
    ).resolves.toEqual([
      'control_plane.terms_documents',
      'control_plane.terms_versions',
      'control_plane.user_consents',
    ]);
    await expect(
      database('control_plane.terms_documents').count('* as count').first(),
    ).resolves.toMatchObject({ count: '0' });
  });

  it('enforces canonical Document identity and a one-way retirement lifecycle', async () => {
    await addTermsVersioning(database);
    await insertDocument(database);

    await expect(
      insertDocument(database, {
        terms_document_id: alternateDocumentId,
        document_code: 'REGISTRATION-NOTICE',
      }),
    ).rejects.toThrow();
    await expect(
      database('control_plane.terms_documents')
        .where({ terms_document_id: documentId })
        .update({ document_code: 'different-code' }),
    ).rejects.toThrow(/document_code|immutable/i);

    await database('control_plane.terms_documents')
      .where({ terms_document_id: documentId })
      .update({ status: 'retired' });
    await expect(
      database('control_plane.terms_documents')
        .where({ terms_document_id: documentId })
        .update({ status: 'active' }),
    ).rejects.toThrow(/retired|lifecycle/i);
  });

  it('keeps DRAFT editable but rejects empty content and a digest that does not match UTF-8 content', async () => {
    await addTermsVersioning(database);
    await insertDocument(database);

    await expect(
      database('control_plane.terms_versions').insert({
        terms_version_id: versionOneId,
        terms_document_id: documentId,
        version_label: 'test-v1',
        status: 'DRAFT',
        content: '   ',
        content_digest: digest('   '),
        locale: 'zh-CN',
        must_reaccept: false,
      }),
    ).rejects.toThrow();

    await expect(
      database('control_plane.terms_versions').insert({
        terms_version_id: versionOneId,
        terms_document_id: documentId,
        version_label: 'test-v1',
        status: 'DRAFT',
        content: 'Test-only body.',
        content_digest: digest('Different body.'),
        locale: 'zh-CN',
        must_reaccept: false,
      }),
    ).rejects.toThrow(/digest/i);

    await insertDraft(database);
    const editedContent = 'Edited test-only terms body.';
    await database('control_plane.terms_versions')
      .where({ terms_version_id: versionOneId })
      .update({
        content: editedContent,
        content_digest: digest(editedContent),
        must_reaccept: true,
      });

    await expect(
      database('control_plane.terms_versions')
        .select('content', 'content_digest', 'must_reaccept')
        .where({ terms_version_id: versionOneId })
        .first(),
    ).resolves.toMatchObject({
      content: editedContent,
      content_digest: digest(editedContent),
      must_reaccept: true,
    });
  });

  it('enforces publication evidence and the DRAFT to PUBLISHED to RETIRED state machine', async () => {
    await addTermsVersioning(database);
    await insertDocument(database);
    await insertDraft(database);

    await expect(
      database('control_plane.terms_versions')
        .where({ terms_version_id: versionOneId })
        .update({ status: 'PUBLISHED' }),
    ).rejects.toThrow();
    await expect(
      database('control_plane.terms_versions')
        .where({ terms_version_id: versionOneId })
        .update({ published_at: '2026-08-07T11:00:00.000Z' }),
    ).rejects.toThrow();

    await publish(database);
    await database('control_plane.terms_versions')
      .where({ terms_version_id: versionOneId })
      .update({ status: 'RETIRED' });
    await expect(
      database('control_plane.terms_versions')
        .where({ terms_version_id: versionOneId })
        .update({ status: 'PUBLISHED' }),
    ).rejects.toThrow(/lifecycle|transition|retired/i);
  });

  it('makes published facts immutable and prevents deletion of published or retired versions', async () => {
    await addTermsVersioning(database);
    await insertDocument(database);
    await insertDraft(database);
    await publish(database);

    const changedContent = 'Published content must not change.';
    await expect(
      database('control_plane.terms_versions')
        .where({ terms_version_id: versionOneId })
        .update({ content: changedContent, content_digest: digest(changedContent) }),
    ).rejects.toThrow(/published|immutable/i);
    await expect(
      database('control_plane.terms_versions').where({ terms_version_id: versionOneId }).delete(),
    ).rejects.toThrow(/published|immutable/i);

    await database('control_plane.terms_versions')
      .where({ terms_version_id: versionOneId })
      .update({ status: 'RETIRED' });
    await expect(
      database('control_plane.terms_versions').where({ terms_version_id: versionOneId }).delete(),
    ).rejects.toThrow(/retired|immutable/i);
  });

  it('prevents ambiguous published effective times and cross-document or cross-locale supersedes links', async () => {
    await addTermsVersioning(database);
    await insertDocument(database);
    await insertDocument(database, {
      terms_document_id: alternateDocumentId,
      document_code: 'privacy-notice',
      title: 'Privacy notice test fixture',
    });
    await insertDraft(database);
    await publish(database);

    await insertDraft(database, {
      terms_version_id: versionTwoId,
      version_label: 'test-v2',
      content: 'Test-only terms body version two.',
      supersedes_terms_version_id: versionOneId,
    });
    await expect(publish(database, versionTwoId)).rejects.toThrow();

    await expect(
      insertDraft(database, {
        terms_version_id: alternateVersionId,
        terms_document_id: alternateDocumentId,
        version_label: 'test-v1',
        content: 'Another document body.',
        supersedes_terms_version_id: versionOneId,
      }),
    ).rejects.toThrow();

    await expect(
      insertDraft(database, {
        terms_version_id: alternateVersionId,
        version_label: 'test-v3',
        content: 'Another locale body.',
        locale: 'en-US',
        supersedes_terms_version_id: versionOneId,
      }),
    ).rejects.toThrow();
  });

  it('accepts consent only for released content with the exact digest snapshot and keeps it append-only', async () => {
    await addTermsVersioning(database);
    await insertDocument(database);
    await insertDraft(database);
    const contentDigest = digest('Test-only terms body version one.');

    const consent = {
      user_consent_id: consentId,
      user_id: consentingUserId,
      terms_version_id: versionOneId,
      content_digest_snapshot: contentDigest,
      accepted_at: '2026-08-07T13:00:00.000Z',
      acceptance_context: 'registration',
      registration_id: '75000000-0000-4000-8000-000000000001',
      evidence_metadata: { channel: 'web', explicitAccepted: true },
    };

    await expect(database('control_plane.user_consents').insert(consent)).rejects.toThrow(
      /draft|published|released/i,
    );
    await publish(database);
    await expect(
      database('control_plane.user_consents').insert({
        ...consent,
        content_digest_snapshot: digest('Forged content.'),
      }),
    ).rejects.toThrow(/digest/i);

    await database('control_plane.user_consents').insert(consent);
    await expect(
      database('control_plane.user_consents')
        .where({ user_consent_id: consentId })
        .update({ acceptance_context: 'changed' }),
    ).rejects.toThrow(/append-only/i);
    await expect(
      database('control_plane.user_consents').where({ user_consent_id: consentId }).delete(),
    ).rejects.toThrow(/append-only/i);
  });

  it('allows an empty-foundation rollback but fails closed once published facts or consent exist', async () => {
    await addTermsVersioning(database);
    await removeTermsVersioning(database);
    await expect(tableRegistration(database, 'terms_versions')).resolves.toBeNull();

    await addTermsVersioning(database);
    await insertDocument(database);
    await insertDraft(database);
    await publish(database);
    await expect(removeTermsVersioning(database)).rejects.toThrow(/published|audit|rollback/i);

    await database('control_plane.terms_versions')
      .where({ terms_version_id: versionOneId })
      .update({ status: 'RETIRED' });
    await expect(removeTermsVersioning(database)).rejects.toThrow(
      /published|retired|audit|rollback/i,
    );
  });
});
