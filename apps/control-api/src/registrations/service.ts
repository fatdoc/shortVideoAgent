import { hashPassword } from '../auth/password.js';
import { digestInvitationToken, isInvitationToken } from '../invitations/token.js';
import { registrationRequestDigest } from './digest.js';
import { RegistrationTermsNotAcceptedError, RegistrationValidationError } from './errors.js';
import type {
  EmailVerificationPort,
  PublicRegistrationInput,
  RegistrationStore,
  ReplayableRegistrationResult,
} from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function text(value: unknown, field: string, maxLength: number): string {
  if (typeof value !== 'string') throw new RegistrationValidationError(`${field} is required.`);
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) {
    throw new RegistrationValidationError(`${field} is invalid.`);
  }
  return normalized;
}

function uuid(value: unknown, field: string): string {
  const normalized = text(value, field, 36);
  if (!uuidPattern.test(normalized)) {
    throw new RegistrationValidationError(`${field} must be a UUID.`);
  }
  return normalized.toLowerCase();
}

function email(value: unknown): string {
  const normalized = text(value, 'email', 320).toLowerCase();
  if (!emailPattern.test(normalized)) throw new RegistrationValidationError('email is invalid.');
  return normalized;
}

function password(value: unknown): string {
  if (typeof value !== 'string' || value.length < 12 || value.length > 1_024) {
    throw new RegistrationValidationError('password must contain between 12 and 1024 characters.');
  }
  return value;
}

export class RegistrationService {
  constructor(
    private readonly store: RegistrationStore,
    private readonly emailVerification: EmailVerificationPort,
    private readonly idempotencySecret: string,
    private readonly now: () => Date = () => new Date(),
  ) {
    if (Buffer.byteLength(idempotencySecret, 'utf8') < 32) {
      throw new Error('Registration idempotency secret must contain at least 32 bytes.');
    }
  }

  async register(input: PublicRegistrationInput): Promise<ReplayableRegistrationResult> {
    if (input.accepted !== true) throw new RegistrationTermsNotAcceptedError();

    const normalizedEmail = email(input.email);
    const rawPassword = password(input.password);
    const displayName = text(input.displayName, 'displayName', 200);
    const invitationToken =
      input.invitationToken === undefined
        ? null
        : text(input.invitationToken, 'invitationToken', 500);
    if (invitationToken !== null && !isInvitationToken(invitationToken)) {
      throw new RegistrationValidationError('invitationToken is invalid.');
    }
    const tenantDisplayName =
      input.tenantDisplayName === undefined
        ? null
        : text(input.tenantDisplayName, 'tenantDisplayName', 300);
    if (invitationToken === null && tenantDisplayName === null) {
      throw new RegistrationValidationError(
        'tenantDisplayName is required for direct registration.',
      );
    }

    const termsVersionId = uuid(input.termsVersionId, 'termsVersionId');
    const locale = text(input.locale, 'locale', 35);
    const emailVerificationToken = text(
      input.emailVerificationToken,
      'emailVerificationToken',
      2_000,
    );
    const idempotencyKey = text(input.idempotencyKey, 'idempotencyKey', 200);
    const completedAt = this.now();
    const verification = await this.emailVerification.verify(
      normalizedEmail,
      emailVerificationToken,
      completedAt,
    );
    const verificationEvidenceId = text(verification.evidenceId, 'verification.evidenceId', 200);
    const invitationTokenDigest =
      invitationToken === null ? null : digestInvitationToken(invitationToken);
    const requestDigest = registrationRequestDigest(this.idempotencySecret, {
      normalizedEmail,
      password: rawPassword,
      displayName,
      tenantDisplayName,
      invitationTokenDigest,
      termsVersionId,
      locale,
      accepted: true,
      emailVerificationToken,
      idempotencyKey,
    });
    const passwordHash = await hashPassword(rawPassword);

    return this.store.register({
      normalizedEmail,
      passwordHash,
      displayName,
      tenantDisplayName,
      invitationTokenDigest,
      termsVersionId,
      locale,
      idempotencyKey,
      requestDigest,
      verificationEvidenceId,
      completedAt,
    });
  }
}
