import { describe, expect, it } from 'vitest';
import { RegistrationRateLimiter } from './rateLimiter.js';

describe('RegistrationRateLimiter', () => {
  it('blocks a key after the configured request budget and reports retry-after', () => {
    let now = 1_000;
    const limiter = new RegistrationRateLimiter(2, 10_000, 30_000, () => now);

    expect(limiter.retryAfterSeconds('digest')).toBeNull();
    limiter.record('digest');
    expect(limiter.retryAfterSeconds('digest')).toBeNull();
    limiter.record('digest');
    expect(limiter.retryAfterSeconds('digest')).toBe(30);

    now += 30_000;
    expect(limiter.retryAfterSeconds('digest')).toBeNull();
  });

  it('resets an incomplete request window without affecting another digest', () => {
    let now = 5_000;
    const limiter = new RegistrationRateLimiter(3, 1_000, 5_000, () => now);

    limiter.record('first');
    limiter.record('second');
    now += 1_001;

    expect(limiter.retryAfterSeconds('first')).toBeNull();
    limiter.record('first');
    expect(limiter.retryAfterSeconds('second')).toBeNull();
    expect(limiter.retryAfterSeconds('first')).toBeNull();
  });
});
