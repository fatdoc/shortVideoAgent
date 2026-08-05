import { createHmac, randomBytes, randomUUID } from 'node:crypto';

export const SESSION_COOKIE_NAME = 'videoagent_session';

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function digestSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export function newSessionId(): string {
  return randomUUID();
}

export function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;

  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator < 0) continue;
    const key = pair.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export function isSafeReturnTo(value: string | undefined): value is string {
  if (!value || value.length > 1024) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (value.includes('\\')) return false;
  return [...value].every((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint >= 32 && codePoint !== 127;
  });
}
