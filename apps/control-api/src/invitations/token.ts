import { createHash, randomBytes } from 'node:crypto';

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export function createInvitationToken(): string {
  return randomBytes(32).toString('base64url');
}

export function isInvitationToken(value: string): boolean {
  return tokenPattern.test(value);
}

export function digestInvitationToken(token: string): string {
  return `sha256:v1:${createHash('sha256').update(token, 'utf8').digest('hex')}`;
}

export function invitationRequestDigest(value: object): string {
  return createHash('sha256').update(JSON.stringify(value), 'utf8').digest('hex');
}
