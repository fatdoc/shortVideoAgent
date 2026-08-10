import type { Page } from '@playwright/test';

export const PILOT_E2E_PROJECT_ID = '66000000-0000-4000-8000-000000000001';
export const PILOT_E2E_SUSPENDABLE_MEMBERSHIP_ID = '65000000-0000-4000-8000-000000000007';

export type PilotE2eAccountKey =
  | 'platformAdmin'
  | 'platformSupport'
  | 'channelAdminA'
  | 'channelAdminB'
  | 'tenantAdminA'
  | 'tenantOperatorA'
  | 'tenantSuspendableA'
  | 'tenantAdminB';

export type PilotE2eInvitationKey = 'valid' | 'expired' | 'revoked' | 'exhausted';
export type PilotE2eVerificationMode = 'valid' | 'failed' | 'recovering';

interface PilotE2eCredential {
  email: string;
  password: string;
}

const accountKeys: readonly PilotE2eAccountKey[] = [
  'platformAdmin',
  'platformSupport',
  'channelAdminA',
  'channelAdminB',
  'tenantAdminA',
  'tenantOperatorA',
  'tenantSuspendableA',
  'tenantAdminB',
];
const invitationKeys: readonly PilotE2eInvitationKey[] = [
  'valid',
  'expired',
  'revoked',
  'exhausted',
];
const invitationTokenPattern = /^[A-Za-z0-9_-]{43}$/;
const invalidVerificationToken = 'pilot-e2e-invalid-verification-token-000000000000000000000000';

function isCredential(value: unknown): value is PilotE2eCredential {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.email === 'string' &&
    candidate.email.length > 0 &&
    typeof candidate.password === 'string' &&
    candidate.password.length >= 32
  );
}

function parseCredentials(): Record<PilotE2eAccountKey, PilotE2eCredential> {
  const raw = process.env.PILOT_E2E_CREDENTIALS_JSON;
  if (!raw) throw new Error('PILOT_E2E_CREDENTIALS_REQUIRED');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('PILOT_E2E_CREDENTIALS_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PILOT_E2E_CREDENTIALS_INVALID');
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== accountKeys.length ||
    accountKeys.some((key) => !isCredential(candidate[key]))
  ) {
    throw new Error('PILOT_E2E_CREDENTIALS_INVALID');
  }
  return candidate as Record<PilotE2eAccountKey, PilotE2eCredential>;
}

function parseInvitationTokens(): Record<PilotE2eInvitationKey, string> {
  const raw = process.env.PILOT_E2E_INVITATION_TOKENS_JSON;
  if (!raw) throw new Error('PILOT_E2E_INVITATION_TOKENS_REQUIRED');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('PILOT_E2E_INVITATION_TOKENS_INVALID');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('PILOT_E2E_INVITATION_TOKENS_INVALID');
  }

  const candidate = parsed as Record<string, unknown>;
  if (
    Object.keys(candidate).length !== invitationKeys.length ||
    invitationKeys.some(
      (key) =>
        typeof candidate[key] !== 'string' ||
        !invitationTokenPattern.test(candidate[key] as string),
    )
  ) {
    throw new Error('PILOT_E2E_INVITATION_TOKENS_INVALID');
  }
  return candidate as Record<PilotE2eInvitationKey, string>;
}

function parseVerificationToken(): string {
  const token = process.env.PILOT_E2E_EMAIL_VERIFICATION_TOKEN;
  if (!token || token.length < 32 || token.length > 2_000) {
    throw new Error('PILOT_E2E_EMAIL_VERIFICATION_TOKEN_REQUIRED');
  }
  return token;
}

const credentials = parseCredentials();
const invitationTokens = parseInvitationTokens();
const verificationToken = parseVerificationToken();

export function account(key: PilotE2eAccountKey): PilotE2eCredential {
  return credentials[key];
}

export function invitationToken(key: PilotE2eInvitationKey): string {
  return invitationTokens[key];
}

export async function installEmailVerificationBridge(
  page: Page,
  mode: PilotE2eVerificationMode = 'valid',
): Promise<void> {
  const evidence = {
    valid: verificationToken,
    invalid: invalidVerificationToken,
    mode,
  };
  await page.addInitScript(({ valid, invalid, mode: bridgeMode }) => {
    let calls = 0;
    Object.defineProperty(window, '__PILOT_E2E_EMAIL_VERIFICATION__', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: () => {
        calls += 1;
        if (bridgeMode === 'failed') return invalid;
        if (bridgeMode === 'recovering' && calls === 1) return invalid;
        return valid;
      },
    });
  }, evidence);
}

export async function login(page: Page, key: PilotE2eAccountKey): Promise<void> {
  const credential = account(key);
  await page.getByTestId('pilot-login-email').fill(credential.email);
  await page.getByTestId('pilot-login-password').fill(credential.password);
  await page.getByTestId('pilot-login-submit').click();
}

export async function browserStorageKeys(page: Page): Promise<{
  localStorageKeys: string[];
  sessionStorageKeys: string[];
}> {
  return page.evaluate(() => ({
    localStorageKeys: Object.keys(window.localStorage).sort(),
    sessionStorageKeys: Object.keys(window.sessionStorage).sort(),
  }));
}
