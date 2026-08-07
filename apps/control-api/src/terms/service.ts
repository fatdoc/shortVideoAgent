import {
  TermsAcceptanceRequiredError,
  TermsNotAvailableError,
  TermsPermissionDeniedError,
  TermsValidationError,
} from './errors.js';
import type {
  ConsentEvidence,
  CreateTermsDocumentInput,
  CreateTermsDraftInput,
  CurrentTerms,
  RecordTermsConsentInput,
  ReplayableResult,
  TermsActor,
  TermsDocument,
  TermsStore,
  TermsVersion,
  UpdateTermsDraftInput,
  UserConsent,
} from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const digestPattern = /^[0-9a-f]{64}$/;
const evidenceKeys = new Set(['channel', 'explicitAccepted', 'requestId']);
const evidenceChannels = new Set(['web', 'admin', 'api']);

function trimmed(value: string, field: string, maxLength: number): string {
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) {
    throw new TermsValidationError(`${field} must contain between 1 and ${maxLength} characters.`);
  }
  return normalized;
}

function uuid(value: string, field: string): string {
  const normalized = value.trim();
  if (!uuidPattern.test(normalized)) throw new TermsValidationError(`${field} must be a UUID.`);
  return normalized;
}

function optionalUuid(value: string | null, field: string): string | null {
  return value === null ? null : uuid(value, field);
}

function validDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TermsValidationError(`${field} must be a valid date.`);
  }
  return value;
}

function consentEvidence(value: ConsentEvidence): ConsentEvidence {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TermsValidationError('evidenceMetadata must be an object.');
  }
  const keys = Object.keys(value);
  if (keys.length < 2 || keys.some((key) => !evidenceKeys.has(key))) {
    throw new TermsValidationError('evidenceMetadata contains unsupported fields.');
  }
  if (!evidenceChannels.has(value.channel) || value.explicitAccepted !== true) {
    throw new TermsValidationError('evidenceMetadata does not prove explicit acceptance.');
  }
  if (value.requestId !== undefined) {
    const requestId = trimmed(value.requestId, 'requestId', 200);
    return { channel: value.channel, explicitAccepted: true, requestId };
  }
  return { channel: value.channel, explicitAccepted: true };
}

export class TermsService {
  constructor(private readonly store: TermsStore) {}

  async createDocument(actor: TermsActor, input: CreateTermsDocumentInput): Promise<TermsDocument> {
    this.requirePlatformAdmin(actor);
    return this.store.createDocument({
      documentCode: trimmed(input.documentCode, 'documentCode', 100),
      title: trimmed(input.title, 'title', 300),
    });
  }

  async createDraft(actor: TermsActor, input: CreateTermsDraftInput): Promise<TermsVersion> {
    this.requirePlatformAdmin(actor);
    return this.store.createDraft({
      termsDocumentId: uuid(input.termsDocumentId, 'termsDocumentId'),
      versionLabel: trimmed(input.versionLabel, 'versionLabel', 100),
      content: trimmed(input.content, 'content', 1_000_000),
      locale: trimmed(input.locale, 'locale', 35),
      mustReaccept: input.mustReaccept,
      supersedesTermsVersionId: optionalUuid(
        input.supersedesTermsVersionId,
        'supersedesTermsVersionId',
      ),
    });
  }

  async updateDraft(
    actor: TermsActor,
    termsVersionId: string,
    input: UpdateTermsDraftInput,
  ): Promise<TermsVersion> {
    this.requirePlatformAdmin(actor);
    const normalized: UpdateTermsDraftInput = {
      versionLabel: trimmed(input.versionLabel, 'versionLabel', 100),
      content: trimmed(input.content, 'content', 1_000_000),
      locale: trimmed(input.locale, 'locale', 35),
      mustReaccept: input.mustReaccept,
      supersedesTermsVersionId: optionalUuid(
        input.supersedesTermsVersionId,
        'supersedesTermsVersionId',
      ),
    };
    if (input.effectiveAt !== undefined) {
      normalized.effectiveAt =
        input.effectiveAt === null ? null : validDate(input.effectiveAt, 'effectiveAt');
    }
    return this.store.updateDraft(uuid(termsVersionId, 'termsVersionId'), normalized);
  }

  async publishVersion(
    actor: TermsActor,
    termsVersionId: string,
    effectiveAt: Date,
  ): Promise<ReplayableResult<TermsVersion>> {
    this.requirePlatformAdmin(actor);
    return this.store.publishVersion(
      uuid(termsVersionId, 'termsVersionId'),
      uuid(actor.userId, 'actor.userId'),
      validDate(effectiveAt, 'effectiveAt'),
    );
  }

  async retireVersion(
    actor: TermsActor,
    termsVersionId: string,
  ): Promise<ReplayableResult<TermsVersion>> {
    this.requirePlatformAdmin(actor);
    return this.store.retireVersion(uuid(termsVersionId, 'termsVersionId'));
  }

  async retireDocument(
    actor: TermsActor,
    termsDocumentId: string,
  ): Promise<ReplayableResult<TermsDocument>> {
    this.requirePlatformAdmin(actor);
    return this.store.retireDocument(uuid(termsDocumentId, 'termsDocumentId'));
  }

  async getPublicCurrent(documentCode: string, locale: string, asOf: Date): Promise<CurrentTerms> {
    const current = await this.store.findCurrent(
      trimmed(documentCode, 'documentCode', 100),
      trimmed(locale, 'locale', 35),
      validDate(asOf, 'asOf'),
    );
    if (!current) throw new TermsNotAvailableError();
    return current;
  }

  async recordCurrentConsent(
    input: RecordTermsConsentInput & { accepted: boolean },
  ): Promise<UserConsent> {
    if (input.accepted !== true) throw new TermsAcceptanceRequiredError();
    const contentDigestSnapshot = input.contentDigestSnapshot.trim().toLowerCase();
    if (!digestPattern.test(contentDigestSnapshot)) {
      throw new TermsValidationError('contentDigestSnapshot must be a SHA-256 digest.');
    }
    return this.store.recordConsent({
      userId: uuid(input.userId, 'userId'),
      documentCode: trimmed(input.documentCode, 'documentCode', 100),
      locale: trimmed(input.locale, 'locale', 35),
      termsVersionId: uuid(input.termsVersionId, 'termsVersionId'),
      contentDigestSnapshot,
      acceptedAt: validDate(input.acceptedAt, 'acceptedAt'),
      acceptanceContext: trimmed(input.acceptanceContext, 'acceptanceContext', 100),
      registrationId: optionalUuid(input.registrationId, 'registrationId'),
      evidenceMetadata: consentEvidence(input.evidenceMetadata),
    });
  }

  private requirePlatformAdmin(actor: TermsActor): void {
    if (actor.organizationType !== 'PLATFORM' || !actor.roles.includes('platform_admin')) {
      throw new TermsPermissionDeniedError();
    }
  }
}
