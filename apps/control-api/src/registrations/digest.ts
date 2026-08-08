import { createHmac } from 'node:crypto';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export type RegistrationDigestFacts = {
  normalizedEmail: string;
  password: string;
  displayName: string;
  tenantDisplayName: string | null;
  invitationTokenDigest: string | null;
  termsVersionId: string;
  locale: string;
  accepted: true;
  emailVerificationToken: string;
  idempotencyKey: string;
};

export function registrationRequestDigest(secret: string, facts: RegistrationDigestFacts): string {
  return createHmac('sha256', secret).update(canonicalJson(facts), 'utf8').digest('hex');
}
