import { EmailVerificationUnavailableError } from './errors.js';
import type { EmailVerificationPort } from './types.js';

export class UnavailableEmailVerification implements EmailVerificationPort {
  async verify(): Promise<never> {
    throw new EmailVerificationUnavailableError();
  }
}
