import { describe, expect, it } from 'vitest';
import { createSessionToken, digestSessionToken, isSafeReturnTo, readCookie } from './session.js';

describe('session primitives', () => {
  it('creates opaque tokens and stores only a keyed digest', () => {
    const token = createSessionToken();
    const digest = digestSessionToken(token, 'test-secret-at-least-thirty-two-characters');

    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(digest).toMatch(/^[a-f0-9]{64}$/);
    expect(digest).not.toContain(token);
  });

  it('accepts only application-local return paths', () => {
    expect(isSafeReturnTo('/projects/p-1?tab=brief')).toBe(true);
    expect(isSafeReturnTo('https://attacker.example')).toBe(false);
    expect(isSafeReturnTo('//attacker.example')).toBe(false);
    expect(isSafeReturnTo('/safe\\attacker')).toBe(false);
    expect(isSafeReturnTo('/safe\nlocation')).toBe(false);
  });

  it('reads one encoded cookie without accepting malformed encoding', () => {
    expect(readCookie('a=1; videoagent_session=abc%2D123; c=3', 'videoagent_session')).toBe('abc-123');
    expect(readCookie('videoagent_session=%E0%A4%A', 'videoagent_session')).toBeUndefined();
  });
});
