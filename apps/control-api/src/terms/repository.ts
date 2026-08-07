import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import {
  TermsDocumentNotFoundError,
  TermsPublishConflictError,
  TermsStateConflictError,
  TermsVersionNotFoundError,
  TermsVersionStaleError,
} from './errors.js';
import { termsContentDigest } from './digest.js';
import type {
  ConsentEvidence,
  CreateTermsDocumentInput,
  CreateTermsDraftInput,
  CurrentTerms,
  RecordTermsConsentInput,
  ReplayableResult,
  TermsDocument,
  TermsDocumentStatus,
  TermsStore,
  TermsVersion,
  TermsVersionStatus,
  UpdateTermsDraftInput,
  UserConsent,
} from './types.js';

type TermsDocumentRow = {
  terms_document_id: string;
  document_code: string;
  title: string;
  status: TermsDocumentStatus;
  created_at: Date | string;
  updated_at: Date | string;
};

type TermsVersionRow = {
  terms_version_id: string;
  terms_document_id: string;
  version_label: string;
  status: TermsVersionStatus;
  content: string;
  content_digest: string;
  locale: string;
  published_at: Date | string | null;
  effective_at: Date | string | null;
  published_by: string | null;
  supersedes_terms_version_id: string | null;
  must_reaccept: boolean;
  created_at: Date | string;
  updated_at: Date | string;
};

type UserConsentRow = {
  user_consent_id: string;
  user_id: string;
  terms_version_id: string;
  content_digest_snapshot: string;
  accepted_at: Date | string;
  acceptance_context: string;
  registration_id: string | null;
  evidence_metadata: ConsentEvidence;
  created_at: Date | string;
};

function iso(value: Date | string): string {
  return new Date(value).toISOString();
}

function nullableIso(value: Date | string | null): string | null {
  return value === null ? null : iso(value);
}

function sameInstant(value: Date | string | null, expected: Date): boolean {
  return value !== null && new Date(value).getTime() === expected.getTime();
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === '23505';
}

function documentFromRow(row: TermsDocumentRow): TermsDocument {
  return {
    termsDocumentId: row.terms_document_id,
    documentCode: row.document_code,
    title: row.title,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function versionFromRow(row: TermsVersionRow): TermsVersion {
  return {
    termsVersionId: row.terms_version_id,
    termsDocumentId: row.terms_document_id,
    versionLabel: row.version_label,
    status: row.status,
    content: row.content,
    contentDigest: row.content_digest,
    locale: row.locale,
    publishedAt: nullableIso(row.published_at),
    effectiveAt: nullableIso(row.effective_at),
    publishedBy: row.published_by,
    supersedesTermsVersionId: row.supersedes_terms_version_id,
    mustReaccept: row.must_reaccept,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
  };
}

function consentFromRow(row: UserConsentRow): UserConsent {
  return {
    userConsentId: row.user_consent_id,
    userId: row.user_id,
    termsVersionId: row.terms_version_id,
    contentDigestSnapshot: row.content_digest_snapshot,
    acceptedAt: iso(row.accepted_at),
    acceptanceContext: row.acceptance_context,
    registrationId: row.registration_id,
    evidenceMetadata: row.evidence_metadata,
    createdAt: iso(row.created_at),
  };
}

export class PostgresTermsRepository implements TermsStore {
  constructor(
    private readonly database: Knex,
    private readonly now: () => Date = () => new Date(),
    private readonly newId: (entity: 'document' | 'version' | 'consent') => string = () =>
      randomUUID(),
  ) {}

  async createDocument(input: CreateTermsDocumentInput): Promise<TermsDocument> {
    try {
      return await this.database.transaction(async (transaction) => {
        const timestamp = this.now();
        const [row] = (await transaction('control_plane.terms_documents')
          .insert({
            terms_document_id: this.newId('document'),
            document_code: input.documentCode,
            title: input.title,
            status: 'active',
            created_at: timestamp,
            updated_at: timestamp,
          })
          .returning('*')) as TermsDocumentRow[];
        if (!row) throw new Error('terms document insert returned no row');
        return documentFromRow(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new TermsStateConflictError();
      throw error;
    }
  }

  async createDraft(input: CreateTermsDraftInput): Promise<TermsVersion> {
    try {
      return await this.database.transaction(async (transaction) => {
        const document = await this.lockDocument(transaction, input.termsDocumentId);
        if (document.status !== 'active') throw new TermsStateConflictError();

        const timestamp = this.now();
        const [row] = (await transaction('control_plane.terms_versions')
          .insert({
            terms_version_id: this.newId('version'),
            terms_document_id: input.termsDocumentId,
            version_label: input.versionLabel,
            status: 'DRAFT',
            content: input.content,
            content_digest: termsContentDigest(input.content),
            locale: input.locale,
            published_at: null,
            effective_at: null,
            published_by: null,
            supersedes_terms_version_id: input.supersedesTermsVersionId,
            must_reaccept: input.mustReaccept,
            created_at: timestamp,
            updated_at: timestamp,
          })
          .returning('*')) as TermsVersionRow[];
        if (!row) throw new Error('terms draft insert returned no row');
        return versionFromRow(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new TermsStateConflictError();
      throw error;
    }
  }

  async updateDraft(termsVersionId: string, input: UpdateTermsDraftInput): Promise<TermsVersion> {
    try {
      return await this.database.transaction(async (transaction) => {
        const candidate = await this.findVersion(transaction, termsVersionId);
        if (!candidate) throw new TermsVersionNotFoundError();
        const document = await this.lockDocument(transaction, candidate.terms_document_id);
        if (document.status !== 'active') throw new TermsStateConflictError();
        const existing = await this.lockVersion(transaction, termsVersionId);
        if (existing.status !== 'DRAFT') throw new TermsStateConflictError();

        const update: Record<string, unknown> = {
          version_label: input.versionLabel,
          content: input.content,
          content_digest: termsContentDigest(input.content),
          locale: input.locale,
          must_reaccept: input.mustReaccept,
          supersedes_terms_version_id: input.supersedesTermsVersionId,
        };
        if (input.effectiveAt !== undefined) update.effective_at = input.effectiveAt;

        const [row] = (await transaction('control_plane.terms_versions')
          .where({ terms_version_id: termsVersionId })
          .update(update)
          .returning('*')) as TermsVersionRow[];
        if (!row) throw new Error('terms draft update returned no row');
        return versionFromRow(row);
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new TermsStateConflictError();
      throw error;
    }
  }

  async publishVersion(
    termsVersionId: string,
    publishedBy: string,
    effectiveAt: Date,
  ): Promise<ReplayableResult<TermsVersion>> {
    try {
      return await this.database.transaction(async (transaction) => {
        const candidate = await this.findVersion(transaction, termsVersionId);
        if (!candidate) throw new TermsVersionNotFoundError();
        const document = await this.lockDocument(transaction, candidate.terms_document_id);
        const locked = await this.lockVersion(transaction, termsVersionId);

        if (locked.status === 'PUBLISHED') {
          if (
            locked.published_by === publishedBy &&
            sameInstant(locked.effective_at, effectiveAt)
          ) {
            return { value: versionFromRow(locked), replayed: true };
          }
          throw new TermsPublishConflictError();
        }
        if (locked.status !== 'DRAFT' || document.status !== 'active') {
          throw new TermsStateConflictError();
        }

        const [row] = (await transaction('control_plane.terms_versions')
          .where({ terms_version_id: termsVersionId })
          .update({
            status: 'PUBLISHED',
            published_at: this.now(),
            effective_at: effectiveAt,
            published_by: publishedBy,
          })
          .returning('*')) as TermsVersionRow[];
        if (!row) throw new Error('terms publication returned no row');
        return { value: versionFromRow(row), replayed: false };
      });
    } catch (error) {
      if (isUniqueViolation(error)) throw new TermsPublishConflictError();
      throw error;
    }
  }

  async retireVersion(termsVersionId: string): Promise<ReplayableResult<TermsVersion>> {
    return this.database.transaction(async (transaction) => {
      const candidate = await this.findVersion(transaction, termsVersionId);
      if (!candidate) throw new TermsVersionNotFoundError();
      await this.lockDocument(transaction, candidate.terms_document_id);
      const existing = await this.lockVersion(transaction, termsVersionId);
      if (existing.status === 'RETIRED') {
        return { value: versionFromRow(existing), replayed: true };
      }
      if (existing.status !== 'PUBLISHED') throw new TermsStateConflictError();

      const [row] = (await transaction('control_plane.terms_versions')
        .where({ terms_version_id: termsVersionId })
        .update({ status: 'RETIRED' })
        .returning('*')) as TermsVersionRow[];
      if (!row) throw new Error('terms version retirement returned no row');
      return { value: versionFromRow(row), replayed: false };
    });
  }

  async retireDocument(termsDocumentId: string): Promise<ReplayableResult<TermsDocument>> {
    return this.database.transaction(async (transaction) => {
      const existing = await this.lockDocument(transaction, termsDocumentId);
      if (existing.status === 'retired') {
        return { value: documentFromRow(existing), replayed: true };
      }

      const [row] = (await transaction('control_plane.terms_documents')
        .where({ terms_document_id: termsDocumentId })
        .update({ status: 'retired' })
        .returning('*')) as TermsDocumentRow[];
      if (!row) throw new Error('terms document retirement returned no row');
      return { value: documentFromRow(row), replayed: false };
    });
  }

  async findCurrent(
    documentCode: string,
    locale: string,
    asOf: Date,
  ): Promise<CurrentTerms | null> {
    const document = (await this.database('control_plane.terms_documents')
      .whereRaw('lower(document_code) = lower(?)', [documentCode])
      .where({ status: 'active' })
      .first()) as TermsDocumentRow | undefined;
    if (!document) return null;

    const version = await this.selectCurrentVersion(
      this.database,
      document.terms_document_id,
      locale,
      asOf,
    );
    return version
      ? { document: documentFromRow(document), version: versionFromRow(version) }
      : null;
  }

  async recordConsent(input: RecordTermsConsentInput): Promise<UserConsent> {
    return this.database.transaction(async (transaction) => {
      const document = (await transaction('control_plane.terms_documents')
        .whereRaw('lower(document_code) = lower(?)', [input.documentCode])
        .forUpdate()
        .first()) as TermsDocumentRow | undefined;
      if (!document || document.status !== 'active') throw new TermsVersionStaleError();

      const current = await this.selectCurrentVersion(
        transaction,
        document.terms_document_id,
        input.locale,
        input.acceptedAt,
      );
      if (
        !current ||
        current.terms_version_id !== input.termsVersionId ||
        current.content_digest !== input.contentDigestSnapshot
      ) {
        throw new TermsVersionStaleError();
      }

      const [row] = (await transaction('control_plane.user_consents')
        .insert({
          user_consent_id: this.newId('consent'),
          user_id: input.userId,
          terms_version_id: current.terms_version_id,
          content_digest_snapshot: current.content_digest,
          accepted_at: input.acceptedAt,
          acceptance_context: input.acceptanceContext,
          registration_id: input.registrationId,
          evidence_metadata: input.evidenceMetadata,
          created_at: this.now(),
        })
        .returning('*')) as UserConsentRow[];
      if (!row) throw new Error('terms consent insert returned no row');
      return consentFromRow(row);
    });
  }

  private async findVersion(
    database: Knex | Knex.Transaction,
    termsVersionId: string,
  ): Promise<TermsVersionRow | undefined> {
    return (await database('control_plane.terms_versions')
      .where({ terms_version_id: termsVersionId })
      .first()) as TermsVersionRow | undefined;
  }

  private async lockDocument(
    transaction: Knex.Transaction,
    termsDocumentId: string,
  ): Promise<TermsDocumentRow> {
    const row = (await transaction('control_plane.terms_documents')
      .where({ terms_document_id: termsDocumentId })
      .forUpdate()
      .first()) as TermsDocumentRow | undefined;
    if (!row) throw new TermsDocumentNotFoundError();
    return row;
  }

  private async lockVersion(
    transaction: Knex.Transaction,
    termsVersionId: string,
  ): Promise<TermsVersionRow> {
    const row = (await transaction('control_plane.terms_versions')
      .where({ terms_version_id: termsVersionId })
      .forUpdate()
      .first()) as TermsVersionRow | undefined;
    if (!row) throw new TermsVersionNotFoundError();
    return row;
  }

  private async selectCurrentVersion(
    database: Knex | Knex.Transaction,
    termsDocumentId: string,
    locale: string,
    asOf: Date,
  ): Promise<TermsVersionRow | undefined> {
    return (await database('control_plane.terms_versions')
      .where({
        terms_document_id: termsDocumentId,
        locale,
        status: 'PUBLISHED',
      })
      .where('effective_at', '<=', asOf)
      .orderBy('effective_at', 'desc')
      .orderBy('published_at', 'desc')
      .orderBy('terms_version_id', 'desc')
      .first()) as TermsVersionRow | undefined;
  }
}
