import knex, { type Knex } from 'knex';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { up as createPilotCore } from '../db/migrations/001_pilot_core.js';
import { up as addTermsVersioning } from '../db/migrations/011_terms_versioning.js';
import { TermsDomainError } from './errors.js';
import { PostgresTermsRepository } from './repository.js';

const databaseUrl = process.env.CONTROL_API_TEST_DATABASE_URL;
const testDatabaseName = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : '';
const hasDedicatedTestDatabase = /_test$/.test(testDatabaseName);

const publisherId = '81000000-0000-4000-8000-000000000001';
const consentingUserId = '81000000-0000-4000-8000-000000000002';
const documentId = '82000000-0000-4000-8000-000000000001';
const versionOneId = '83000000-0000-4000-8000-000000000001';
const versionTwoId = '83000000-0000-4000-8000-000000000002';
const consentId = '84000000-0000-4000-8000-000000000001';
const generatedIds = {
  document: [documentId],
  version: [versionOneId, versionTwoId],
  consent: [consentId],
};

async function resetFoundation(database: Knex): Promise<void> {
  await database.raw('drop schema if exists control_plane cascade');
  await createPilotCore(database);
  await addTermsVersioning(database);
  await database('control_plane.users').insert([
    {
      user_id: publisherId,
      email: 'terms-publisher@example.com',
      display_name: 'Terms Publisher',
      password_hash: 'unused',
      status: 'active',
    },
    {
      user_id: consentingUserId,
      email: 'terms-user@example.com',
      display_name: 'Terms User',
      password_hash: 'unused',
      status: 'active',
    },
  ]);
}

describe.runIf(hasDedicatedTestDatabase)('PostgresTermsRepository', () => {
  let database: Knex;
  let repository: PostgresTermsRepository;

  beforeEach(async () => {
    database ??= knex({ client: 'pg', connection: databaseUrl });
    await resetFoundation(database);
    const ids = {
      document: [...generatedIds.document],
      version: [...generatedIds.version],
      consent: [...generatedIds.consent],
    };
    repository = new PostgresTermsRepository(
      database,
      () => new Date('2026-08-07T10:30:00.000Z'),
      (entity) => ids[entity].shift() ?? '85000000-0000-4000-8000-000000000001',
    );
  });

  afterAll(async () => {
    if (!database) return;
    await database.raw('drop schema if exists control_plane cascade');
    await database.destroy();
  });

  it('creates a Document and editable DRAFT while deriving the content digest server-side', async () => {
    const document = await repository.createDocument({
      documentCode: 'registration-notice',
      title: 'Registration notice test fixture',
    });
    const draft = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v1',
      content: 'Test-only terms body version one.',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });

    expect(document).toMatchObject({ termsDocumentId: documentId, status: 'active' });
    expect(draft).toMatchObject({
      termsVersionId: versionOneId,
      status: 'DRAFT',
      contentDigest: 'b3a378fa13d464730d09bf85ece722e8cc852bc598394799953328e635b3802d',
      publishedAt: null,
      publishedBy: null,
    });

    const updated = await repository.updateDraft(versionOneId, {
      content: 'Edited test-only terms body.',
      versionLabel: 'test-v1-edited',
      locale: 'zh-CN',
      mustReaccept: true,
      supersedesTermsVersionId: null,
      effectiveAt: new Date('2026-08-07T11:00:00.000Z'),
    });
    expect(updated).toMatchObject({
      content: 'Edited test-only terms body.',
      contentDigest: '00d01bff0072aa2b489bff0ba9a9a058209c3b32a1efa7a731cf4535572dc0c1',
      versionLabel: 'test-v1-edited',
      mustReaccept: true,
      effectiveAt: '2026-08-07T11:00:00.000Z',
    });
  });

  it('selects exact-locale current Terms by effective time and never returns DRAFT or future content', async () => {
    const document = await repository.createDocument({
      documentCode: 'registration-notice',
      title: 'Registration notice test fixture',
    });
    const first = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v1',
      content: 'Test-only terms body version one.',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });

    await expect(
      repository.findCurrent('registration-notice', 'zh-CN', new Date('2026-08-07T12:00:00.000Z')),
    ).resolves.toBeNull();
    await repository.publishVersion(
      first.termsVersionId,
      publisherId,
      new Date('2026-08-07T11:00:00.000Z'),
    );
    const second = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v2',
      content: 'Test-only terms body version two.',
      locale: 'zh-CN',
      mustReaccept: true,
      supersedesTermsVersionId: first.termsVersionId,
    });
    await repository.publishVersion(
      second.termsVersionId,
      publisherId,
      new Date('2026-08-08T00:00:00.000Z'),
    );

    await expect(
      repository.findCurrent('REGISTRATION-NOTICE', 'zh-CN', new Date('2026-08-07T12:00:00.000Z')),
    ).resolves.toMatchObject({ version: { termsVersionId: first.termsVersionId } });
    await expect(
      repository.findCurrent('registration-notice', 'en-US', new Date('2026-08-08T01:00:00.000Z')),
    ).resolves.toBeNull();
    await expect(
      repository.findCurrent('registration-notice', 'zh-CN', new Date('2026-08-08T01:00:00.000Z')),
    ).resolves.toMatchObject({
      version: { termsVersionId: second.termsVersionId, mustReaccept: true },
    });
  });

  it('publishes transactionally with safe replay and rejects a conflicting retry', async () => {
    const document = await repository.createDocument({
      documentCode: 'registration-notice',
      title: 'Registration notice test fixture',
    });
    const draft = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v1',
      content: 'Test-only terms body version one.',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });
    const effectiveAt = new Date('2026-08-07T11:00:00.000Z');

    await expect(
      repository.publishVersion(draft.termsVersionId, publisherId, effectiveAt),
    ).resolves.toMatchObject({ replayed: false, value: { status: 'PUBLISHED' } });
    await expect(
      repository.publishVersion(draft.termsVersionId, publisherId, effectiveAt),
    ).resolves.toMatchObject({ replayed: true, value: { status: 'PUBLISHED' } });
    await expect(
      repository.publishVersion(
        draft.termsVersionId,
        publisherId,
        new Date('2026-08-07T12:00:00.000Z'),
      ),
    ).rejects.toMatchObject<Partial<TermsDomainError>>({
      status: 409,
      code: 'TERMS_PUBLISH_CONFLICT',
    });

    const competingDraft = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v2',
      content: 'Competing test-only terms body.',
      locale: 'zh-CN',
      mustReaccept: true,
      supersedesTermsVersionId: draft.termsVersionId,
    });
    await expect(
      repository.publishVersion(competingDraft.termsVersionId, publisherId, effectiveAt),
    ).rejects.toMatchObject<Partial<TermsDomainError>>({
      status: 409,
      code: 'TERMS_PUBLISH_CONFLICT',
    });
  });

  it('records consent only for the transactionally current Version and rejects stale or forged snapshots', async () => {
    const document = await repository.createDocument({
      documentCode: 'registration-notice',
      title: 'Registration notice test fixture',
    });
    const draft = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v1',
      content: 'Test-only terms body version one.',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });
    const published = await repository.publishVersion(
      draft.termsVersionId,
      publisherId,
      new Date('2026-08-07T11:00:00.000Z'),
    );
    const input = {
      userId: consentingUserId,
      documentCode: document.documentCode,
      locale: published.value.locale,
      termsVersionId: published.value.termsVersionId,
      contentDigestSnapshot: published.value.contentDigest,
      acceptedAt: new Date('2026-08-07T12:00:00.000Z'),
      acceptanceContext: 'registration',
      registrationId: '86000000-0000-4000-8000-000000000001',
      evidenceMetadata: {
        channel: 'web' as const,
        explicitAccepted: true as const,
        requestId: 'request-1',
      },
    };

    await expect(
      repository.recordConsent({ ...input, contentDigestSnapshot: '0'.repeat(64) }),
    ).rejects.toMatchObject({ code: 'TERMS_VERSION_STALE' });
    await expect(
      repository.recordConsent({
        ...input,
        termsVersionId: '87000000-0000-4000-8000-000000000001',
      }),
    ).rejects.toMatchObject({ code: 'TERMS_VERSION_STALE' });
    await expect(repository.recordConsent(input)).resolves.toMatchObject({
      userConsentId: consentId,
      termsVersionId: published.value.termsVersionId,
      contentDigestSnapshot: published.value.contentDigest,
      evidenceMetadata: { channel: 'web', explicitAccepted: true, requestId: 'request-1' },
    });
  });

  it('retires Versions and Documents idempotently and fails current lookup closed', async () => {
    const document = await repository.createDocument({
      documentCode: 'registration-notice',
      title: 'Registration notice test fixture',
    });
    const draft = await repository.createDraft({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v1',
      content: 'Test-only terms body version one.',
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });
    await repository.publishVersion(
      draft.termsVersionId,
      publisherId,
      new Date('2026-08-07T11:00:00.000Z'),
    );

    await expect(repository.retireVersion(draft.termsVersionId)).resolves.toMatchObject({
      replayed: false,
      value: { status: 'RETIRED' },
    });
    await expect(repository.retireVersion(draft.termsVersionId)).resolves.toMatchObject({
      replayed: true,
    });
    await expect(repository.retireDocument(document.termsDocumentId)).resolves.toMatchObject({
      replayed: false,
      value: { status: 'retired' },
    });
    await expect(repository.retireDocument(document.termsDocumentId)).resolves.toMatchObject({
      replayed: true,
    });
    await expect(
      repository.findCurrent('registration-notice', 'zh-CN', new Date('2026-08-07T12:00:00.000Z')),
    ).resolves.toBeNull();
  });
});
