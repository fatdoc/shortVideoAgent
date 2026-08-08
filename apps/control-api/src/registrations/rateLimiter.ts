type RegistrationAttempt = {
  requests: number;
  resetAt: number;
  blockedUntil?: number;
};

export class RegistrationRateLimiter {
  private readonly attempts = new Map<string, RegistrationAttempt>();

  constructor(
    private readonly maximumAttempts: number,
    private readonly windowMilliseconds: number,
    private readonly blockMilliseconds: number,
    private readonly now: () => number = Date.now,
  ) {}

  retryAfterSeconds(key: string): number | null {
    const attempt = this.attempts.get(key);
    if (!attempt) return null;
    const now = this.now();
    if (attempt.blockedUntil && attempt.blockedUntil > now) {
      return Math.max(1, Math.ceil((attempt.blockedUntil - now) / 1000));
    }
    if (attempt.resetAt <= now || (attempt.blockedUntil && attempt.blockedUntil <= now)) {
      this.attempts.delete(key);
    }
    return null;
  }

  record(key: string): void {
    const now = this.now();
    const previous = this.attempts.get(key);
    const attempt =
      !previous || previous.resetAt <= now
        ? { requests: 0, resetAt: now + this.windowMilliseconds }
        : previous;
    attempt.requests += 1;
    if (attempt.requests >= this.maximumAttempts) {
      attempt.blockedUntil = now + this.blockMilliseconds;
    }
    this.attempts.set(key, attempt);
  }
}
