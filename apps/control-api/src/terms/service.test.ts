import { describe, expect, it, vi } from 'vitest';
import { TermsDomainError, TermsPermissionDeniedError, TermsValidationError } from './errors.js';
import { TermsService } from './service.js';
import type { TermsActor, TermsDocument, TermsStore, TermsVersion, UserConsent } from './types.js';

const platformAdmin: TermsActor = {
  userId: '10000000-0000-4000-8000-000000000001',
  organizationType: 'PLATFORM',
  roles: ['platform_admin'],
};

const document: TermsDocument = {
  termsDocumentId: '20000000-0000-4000-8000-000000000001',
  documentCode: 'registration-notice',
  title: 'Registration notice test fixture',
  status: 'active',
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:00:00.000Z',
};

const version: TermsVersion = {
  termsVersionId: '30000000-0000-4000-8000-000000000001',
  termsDocumentId: document.termsDocumentId,
  versionLabel: 'test-v1',
  status: 'PUBLISHED',
  content: 'Test-only terms body.',
  contentDigest: 'f'.repeat(64),
  locale: 'zh-CN',
  publishedAt: '2026-08-07T10:30:00.000Z',
  effectiveAt: '2026-08-07T11:00:00.000Z',
  publishedBy: platformAdmin.userId,
  supersedesTermsVersionId: null,
  mustReaccept: false,
  createdAt: '2026-08-07T10:00:00.000Z',
  updatedAt: '2026-08-07T10:30:00.000Z',
};

const consent: UserConsent = {
  userConsentId: '40000000-0000-4000-8000-000000000001',
  userId: '50000000-0000-4000-8000-000000000001',
  termsVersionId: version.termsVersionId,
  contentDigestSnapshot: version.contentDigest,
  acceptedAt: '2026-08-07T12:00:00.000Z',
  acceptanceContext: 'registration',
  registrationId: '60000000-0000-4000-8000-000000000001',
  evidenceMetadata: { channel: 'web', explicitAccepted: true, requestId: 'request-1' },
  createdAt: '2026-08-07T12:00:00.000Z',
};

function store(overrides: Partial<TermsStore> = {}): TermsStore {
  return {
    createDocument: vi.fn(async () => document),
    createDraft: vi.fn(async () => ({ ...version, status: 'DRAFT' as const })),
    updateDraft: vi.fn(async () => ({ ...version, status: 'DRAFT' as const })),
    publishVersion: vi.fn(async () => ({ value: version, replayed: false })),
    retireVersion: vi.fn(async () => ({
      value: { ...version, status: 'RETIRED' },
      replayed: false,
    })),
    retireDocument: vi.fn(async () => ({
      value: { ...document, status: 'retired' },
      replayed: false,
    })),
    findCurrent: vi.fn(async () => ({ document, version })),
    recordConsent: vi.fn(async () => consent),
    ...overrides,
  };
}

describe('TermsService', () => {
  it('allows only a PLATFORM platform_admin to mutate Terms', async () => {
    const createDocument = vi.fn<TermsStore['createDocument']>();
    const service = new TermsService(store({ createDocument }));
    const rejectedActors: TermsActor[] = [
      { ...platformAdmin, organizationType: 'CHANNEL' },
      { ...platformAdmin, organizationType: 'TENANT' },
      { ...platformAdmin, roles: ['pilot_support'] },
      { ...platformAdmin, roles: ['content_operator'] },
    ];

    for (const actor of rejectedActors) {
      await expect(
        service.createDocument(actor, {
          documentCode: 'registration-notice',
          title: 'Registration notice',
        }),
      ).rejects.toBeInstanceOf(TermsPermissionDeniedError);
    }
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('normalizes safe document and DRAFT input but never accepts client-provided digest or publication facts', async () => {
    const createDocument = vi.fn<TermsStore['createDocument']>(async () => document);
    const createDraft = vi.fn<TermsStore['createDraft']>(async () => ({
      ...version,
      status: 'DRAFT',
    }));
    const service = new TermsService(store({ createDocument, createDraft }));

    await service.createDocument(platformAdmin, {
      documentCode: '  registration-notice  ',
      title: '  Registration notice  ',
    });
    expect(createDocument).toHaveBeenCalledWith({
      documentCode: 'registration-notice',
      title: 'Registration notice',
    });

    await service.createDraft(platformAdmin, {
      termsDocumentId: document.termsDocumentId,
      versionLabel: '  test-v1  ',
      content: '  Test-only terms body.  ',
      locale: '  zh-CN  ',
      mustReaccept: true,
      supersedesTermsVersionId: null,
    });
    expect(createDraft).toHaveBeenCalledWith({
      termsDocumentId: document.termsDocumentId,
      versionLabel: 'test-v1',
      content: 'Test-only terms body.',
      locale: 'zh-CN',
      mustReaccept: true,
      supersedesTermsVersionId: null,
    });
  });

  it('rejects empty or overlong generic input before reaching the store', async () => {
    const createDraft = vi.fn<TermsStore['createDraft']>();
    const service = new TermsService(store({ createDraft }));

    await expect(
      service.createDraft(platformAdmin, {
        termsDocumentId: document.termsDocumentId,
        versionLabel: 'test-v1',
        content: '   ',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
      }),
    ).rejects.toBeInstanceOf(TermsValidationError);
    await expect(
      service.createDraft(platformAdmin, {
        termsDocumentId: document.termsDocumentId,
        versionLabel: 'x'.repeat(101),
        content: 'Test body',
        locale: 'zh-CN',
        mustReaccept: false,
        supersedesTermsVersionId: null,
      }),
    ).rejects.toBeInstanceOf(TermsValidationError);
    expect(createDraft).not.toHaveBeenCalled();
  });

  it('returns only current public Terms and fails closed with TERMS_NOT_AVAILABLE', async () => {
    const findCurrent = vi
      .fn<TermsStore['findCurrent']>()
      .mockResolvedValueOnce({ document, version })
      .mockResolvedValueOnce(null);
    const service = new TermsService(store({ findCurrent }));
    const asOf = new Date('2026-08-07T12:00:00.000Z');

    await expect(
      service.getPublicCurrent(' registration-notice ', ' zh-CN ', asOf),
    ).resolves.toEqual({ document, version });
    expect(findCurrent).toHaveBeenCalledWith('registration-notice', 'zh-CN', asOf);

    await expect(
      service.getPublicCurrent('registration-notice', 'zh-CN', asOf),
    ).rejects.toMatchObject<Partial<TermsDomainError>>({
      status: 503,
      code: 'TERMS_NOT_AVAILABLE',
    });
  });

  it('requires explicit acceptance and whitelists minimal consent evidence', async () => {
    const recordConsent = vi.fn<TermsStore['recordConsent']>(async () => consent);
    const service = new TermsService(store({ recordConsent }));
    const base = {
      userId: consent.userId,
      documentCode: document.documentCode,
      locale: version.locale,
      termsVersionId: version.termsVersionId,
      contentDigestSnapshot: version.contentDigest,
      acceptedAt: new Date(consent.acceptedAt),
      acceptanceContext: 'registration',
      registrationId: consent.registrationId,
      evidenceMetadata: {
        channel: 'web' as const,
        explicitAccepted: true as const,
        requestId: 'request-1',
      },
    };

    await expect(service.recordCurrentConsent({ ...base, accepted: false })).rejects.toMatchObject({
      code: 'TERMS_ACCEPTANCE_REQUIRED',
    });
    await expect(
      service.recordCurrentConsent({
        ...base,
        accepted: true,
        evidenceMetadata: {
          channel: 'web',
          explicitAccepted: true,
          requestId: 'request-1',
          rawUserAgent: 'must-not-pass',
        } as never,
      }),
    ).rejects.toBeInstanceOf(TermsValidationError);
    expect(recordConsent).not.toHaveBeenCalled();

    await expect(service.recordCurrentConsent({ ...base, accepted: true })).resolves.toEqual(
      consent,
    );
    expect(recordConsent).toHaveBeenCalledWith({
      ...base,
      evidenceMetadata: { channel: 'web', explicitAccepted: true, requestId: 'request-1' },
    });
  });
});
