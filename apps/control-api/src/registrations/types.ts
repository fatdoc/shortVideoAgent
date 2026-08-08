export type RegistrationPath =
  'DIRECT' | 'PLATFORM_INVITATION' | 'CHANNEL_INVITATION' | 'TENANT_MEMBER_INVITATION';

export type RegistrationResult = {
  registrationId: string;
  userId: string;
  tenantId: string;
  membershipId: string;
  registrationPath: RegistrationPath;
  completedAt: string;
};

export type ReplayableRegistrationResult = {
  value: RegistrationResult;
  replayed: boolean;
};

export type PublicRegistrationInput = {
  email: string;
  password: string;
  displayName: string;
  tenantDisplayName?: string;
  invitationToken?: string;
  termsVersionId: string;
  locale: string;
  accepted: boolean;
  emailVerificationToken: string;
  idempotencyKey: string;
};

export type RegistrationRecordInput = {
  normalizedEmail: string;
  passwordHash: string;
  displayName: string;
  tenantDisplayName: string | null;
  invitationTokenDigest: string | null;
  termsVersionId: string;
  locale: string;
  idempotencyKey: string;
  requestDigest: string;
  verificationEvidenceId: string;
  completedAt: Date;
};

export type EmailVerificationEvidence = {
  evidenceId: string;
};

export interface EmailVerificationPort {
  verify(
    normalizedEmail: string,
    verificationToken: string,
    asOf: Date,
  ): Promise<EmailVerificationEvidence>;
}

export interface RegistrationStore {
  register(input: RegistrationRecordInput): Promise<ReplayableRegistrationResult>;
}
