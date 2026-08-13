import { PublicRegistrationApiError } from '../../services/publicRegistrationApi';

export interface RegistrationEmailVerificationProvider {
  createEvidence(email: string): Promise<string>;
}

export interface RegistrationEmailVerificationEnvironment {
  MODE?: string;
  VITE_PILOT_E2E?: string;
}

export type PilotE2eEmailVerificationBridge = (normalizedEmail: string) => Promise<string> | string;

declare global {
  interface Window {
    __PILOT_E2E_EMAIL_VERIFICATION__?: PilotE2eEmailVerificationBridge;
  }
}

function unavailable(): PublicRegistrationApiError {
  return new PublicRegistrationApiError(
    'EMAIL_VERIFICATION_UNAVAILABLE',
    '邮箱验证服务暂不可用。',
    503,
    null,
  );
}

export function createRegistrationEmailVerification(
  environment: RegistrationEmailVerificationEnvironment,
  bridge?: PilotE2eEmailVerificationBridge,
): RegistrationEmailVerificationProvider {
  return {
    async createEvidence(email: string): Promise<string> {
      if (
        environment.MODE !== 'test' ||
        environment.VITE_PILOT_E2E !== 'true' ||
        typeof bridge !== 'function'
      ) {
        throw unavailable();
      }

      try {
        const token = await bridge(email.trim().toLowerCase());
        if (typeof token !== 'string' || token.length < 32 || token.length > 2_000) {
          throw unavailable();
        }
        return token;
      } catch {
        throw unavailable();
      }
    },
  };
}

export const registrationEmailVerification: RegistrationEmailVerificationProvider = {
  createEvidence(email: string): Promise<string> {
    return createRegistrationEmailVerification(
      import.meta.env,
      globalThis.window?.__PILOT_E2E_EMAIL_VERIFICATION__,
    ).createEvidence(email);
  },
};
