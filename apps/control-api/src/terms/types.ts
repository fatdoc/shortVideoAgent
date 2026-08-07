import type { OrganizationType, RoleCode } from '../auth/types.js';

export type TermsActor = {
  userId: string;
  organizationType: OrganizationType;
  roles: readonly RoleCode[];
};

export type TermsDocumentStatus = 'active' | 'retired';
export type TermsVersionStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type TermsEvidenceChannel = 'web' | 'admin' | 'api';

export type TermsDocument = {
  termsDocumentId: string;
  documentCode: string;
  title: string;
  status: TermsDocumentStatus;
  createdAt: string;
  updatedAt: string;
};

export type TermsVersion = {
  termsVersionId: string;
  termsDocumentId: string;
  versionLabel: string;
  status: TermsVersionStatus;
  content: string;
  contentDigest: string;
  locale: string;
  publishedAt: string | null;
  effectiveAt: string | null;
  publishedBy: string | null;
  supersedesTermsVersionId: string | null;
  mustReaccept: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConsentEvidence = {
  channel: TermsEvidenceChannel;
  explicitAccepted: true;
  requestId?: string;
};

export type UserConsent = {
  userConsentId: string;
  userId: string;
  termsVersionId: string;
  contentDigestSnapshot: string;
  acceptedAt: string;
  acceptanceContext: string;
  registrationId: string | null;
  evidenceMetadata: ConsentEvidence;
  createdAt: string;
};

export type CreateTermsDocumentInput = {
  documentCode: string;
  title: string;
};

export type CreateTermsDraftInput = {
  termsDocumentId: string;
  versionLabel: string;
  content: string;
  locale: string;
  mustReaccept: boolean;
  supersedesTermsVersionId: string | null;
};

export type UpdateTermsDraftInput = Omit<CreateTermsDraftInput, 'termsDocumentId'> & {
  effectiveAt?: Date | null;
};

export type RecordTermsConsentInput = {
  userId: string;
  documentCode: string;
  locale: string;
  termsVersionId: string;
  contentDigestSnapshot: string;
  acceptedAt: Date;
  acceptanceContext: string;
  registrationId: string | null;
  evidenceMetadata: ConsentEvidence;
};

export type CurrentTerms = {
  document: TermsDocument;
  version: TermsVersion;
};

export type ReplayableResult<T> = {
  value: T;
  replayed: boolean;
};

export interface TermsStore {
  createDocument(input: CreateTermsDocumentInput): Promise<TermsDocument>;
  createDraft(input: CreateTermsDraftInput): Promise<TermsVersion>;
  updateDraft(termsVersionId: string, input: UpdateTermsDraftInput): Promise<TermsVersion>;
  publishVersion(
    termsVersionId: string,
    publishedBy: string,
    effectiveAt: Date,
  ): Promise<ReplayableResult<TermsVersion>>;
  retireVersion(termsVersionId: string): Promise<ReplayableResult<TermsVersion>>;
  retireDocument(termsDocumentId: string): Promise<ReplayableResult<TermsDocument>>;
  findCurrent(documentCode: string, locale: string, asOf: Date): Promise<CurrentTerms | null>;
  recordConsent(input: RecordTermsConsentInput): Promise<UserConsent>;
}
