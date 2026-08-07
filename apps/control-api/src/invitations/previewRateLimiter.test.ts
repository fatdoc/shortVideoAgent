import { describe, expect, it } from 'vitest';
import { InvitationPreviewRateLimiter } from './previewRateLimiter.js';

describe('InvitationPreviewRateLimiter', () => {
  it('allows the configured window quota, then blocks without extending the block on reads', () => {
    let now = 1_000;
    const limiter = new InvitationPreviewRateLimiter(2, 10_000, 30_000, () => now);

    expect(limiter.retryAfterSeconds('digest-key')).toBeNull();
    limiter.record('digest-key');
    expect(limiter.retryAfterSeconds('digest-key')).toBeNull();
    limiter.record('digest-key');

    expect(limiter.retryAfterSeconds('digest-key')).toBe(30);
    now += 1_001;
    expect(limiter.retryAfterSeconds('digest-key')).toBe(29);
    now = 31_000;
    expect(limiter.retryAfterSeconds('digest-key')).toBeNull();
  });

  it('resets attempts after the observation window', () => {
    let now = 5_000;
    const limiter = new InvitationPreviewRateLimiter(2, 1_000, 30_000, () => now);

    limiter.record('digest-key');
    now = 6_001;
    limiter.record('digest-key');
    expect(limiter.retryAfterSeconds('digest-key')).toBeNull();
  });
});
