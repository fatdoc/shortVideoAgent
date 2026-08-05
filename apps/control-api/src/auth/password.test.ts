import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password scrypt storage', () => {
  it('hashes with a random salt and verifies without storing plaintext', async () => {
    const first = await hashPassword('correct horse battery staple');
    const second = await hashPassword('correct horse battery staple');

    expect(first).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(first).not.toContain('correct horse');
    expect(first).not.toBe(second);
    await expect(verifyPassword('correct horse battery staple', first)).resolves.toBe(true);
    await expect(verifyPassword('incorrect', first)).resolves.toBe(false);
  });

  it('rejects malformed or downgraded hashes', async () => {
    await expect(verifyPassword('anything', 'scrypt$2$1$1$AA==$AA==')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'not-a-hash')).resolves.toBe(false);
  });
});
