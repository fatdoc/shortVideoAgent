import { createHash, timingSafeEqual } from 'node:crypto';
import { EmailVerificationFailedError, EmailVerificationUnavailableError } from './errors.js';
import type { EmailVerificationPort } from './types.js';

const MINIMUM_TEST_TOKEN_BYTES = 32;

export class UnavailableEmailVerification implements EmailVerificationPort {
  async verify(): Promise<never> {
    throw new EmailVerificationUnavailableError();
  }
}

class PilotE2eEmailVerification implements EmailVerificationPort {
  constructor(private readonly tokenDigest: Buffer) {}

  async verify(normalizedEmail: string, verificationToken: string) {
    const suppliedDigest = createHash('sha256').update(verificationToken, 'utf8').digest();
    if (!timingSafeEqual(suppliedDigest, this.tokenDigest)) {
      throw new EmailVerificationFailedError();
    }

    return {
      evidenceId: `pilot-e2e:${createHash('sha256')
        .update('pilot-e2e-email-verification\0', 'utf8')
        .update(normalizedEmail, 'utf8')
        .update('\0', 'utf8')
        .update(this.tokenDigest)
        .digest('hex')}`,
    };
  }
}

export function createEmailVerification(
  environment: NodeJS.ProcessEnv = process.env,
): EmailVerificationPort {
  const token = environment.PILOT_E2E_EMAIL_VERIFICATION_TOKEN;
  if (
    environment.NODE_ENV !== 'test' ||
    environment.PILOT_E2E !== 'true' ||
    typeof token !== 'string' ||
    Buffer.byteLength(token, 'utf8') < MINIMUM_TEST_TOKEN_BYTES
  ) {
    return new UnavailableEmailVerification();
  }

  return new PilotE2eEmailVerification(createHash('sha256').update(token, 'utf8').digest());
}
