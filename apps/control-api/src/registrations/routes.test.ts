import express, { type ErrorRequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import {
  EmailVerificationFailedError,
  EmailVerificationUnavailableError,
  RegistrationConflictError,
  RegistrationIdempotencyConflictError,
  RegistrationInvitationUnavailableError,
  RegistrationTermsNotAcceptedError,
  RegistrationTermsNotAvailableError,
  RegistrationValidationError,
} from './errors.js';
import { createRegistrationRouter } from './routes.js';

const payload = {
  email: ' New.User@Example.com ',
  password: 'a-strong-registration-password',
  displayName: 'New User',
  tenantDisplayName: 'New Studio',
  termsVersionId: 'b5000000-0000-4000-8000-000000000002',
  locale: 'zh-CN',
  accepted: true,
  emailVerificationToken: 'verified-token',
  idempotencyKey: 'register-http-1',
};

const result = {
  registrationId: 'c5000000-0000-4000-8000-000000000001',
  userId: 'c3000000-0000-4000-8000-000000000001',
  tenantId: 'c2000000-0000-4000-8000-000000000001',
  membershipId: 'c4000000-0000-4000-8000-000000000001',
  registrationPath: 'DIRECT' as const,
  completedAt: '2026-08-08T06:00:00.000Z',
};

function fixture(
  options: {
    register?: ReturnType<typeof vi.fn>;
    retryAfterSeconds?: (key: string) => number | null;
    record?: (key: string) => void;
  } = {},
) {
  const register = options.register ?? vi.fn(async () => ({ value: result, replayed: false }));
  const limiter = {
    retryAfterSeconds: vi.fn(options.retryAfterSeconds ?? (() => null)),
    record: vi.fn(options.record ?? (() => undefined)),
  };
  const application = express();
  application.set('trust proxy', 1);
  application.use(express.json({ limit: '1mb', strict: true }));
  application.use((_request, response, next) => {
    response.locals.requestId = 'registration-request-1';
    next();
  });
  application.use('/api/v1', createRegistrationRouter({ service: { register }, limiter }));
  const errors: ErrorRequestHandler = (_error, _request, response, next) => {
    void next;
    response.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Unexpected error.',
        requestId: response.locals.requestId,
      },
    });
  };
  application.use(errors);
  return { application, register, limiter };
}

describe('Public Registration HTTP API', () => {
  it('creates a registration without requiring a Session or setting a Cookie', async () => {
    const { application, register, limiter } = fixture();
    const response = await request(application)
      .post('/api/v1/public/registrations')
      .set('x-forwarded-for', '203.0.113.40')
      .send(payload);

    expect(response.status).toBe(201);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['set-cookie']).toBeUndefined();
    expect(response.body).toEqual({ registration: result });
    expect(register).toHaveBeenCalledWith({ ...payload, email: 'New.User@Example.com' });
    expect(limiter.record).toHaveBeenCalledOnce();
    const limiterKey = limiter.retryAfterSeconds.mock.calls[0]?.[0] as string;
    expect(limiterKey).toMatch(/^[0-9a-f]{64}$/);
    expect(limiterKey).not.toContain('203.0.113.40');
    expect(limiterKey).not.toContain('new.user@example.com');
    expect(limiter.record).toHaveBeenCalledWith(limiterKey);
  });

  it('returns 200 with a replay header for a safe idempotent replay', async () => {
    const { application } = fixture({
      register: vi.fn(async () => ({ value: result, replayed: true })),
    });
    const response = await request(application).post('/api/v1/public/registrations').send(payload);

    expect(response.status).toBe(200);
    expect(response.headers['idempotency-replayed']).toBe('true');
    expect(response.body).toEqual({ registration: result });
  });

  it('strictly rejects unknown fields before calling the Service or consuming limiter budget', async () => {
    const { application, register, limiter } = fixture();
    const response = await request(application)
      .post('/api/v1/public/registrations')
      .send({ ...payload, registrationPath: 'DIRECT' });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'INVALID_REGISTRATION_REQUEST',
      requestId: 'registration-request-1',
    });
    expect(register).not.toHaveBeenCalled();
    expect(limiter.retryAfterSeconds).not.toHaveBeenCalled();
    expect(limiter.record).not.toHaveBeenCalled();
  });

  it('returns 429 before calling the Service and exposes only retry-after', async () => {
    const { application, register, limiter } = fixture({ retryAfterSeconds: () => 17 });
    const response = await request(application).post('/api/v1/public/registrations').send(payload);

    expect(response.status).toBe(429);
    expect(response.headers['retry-after']).toBe('17');
    expect(response.body.error.code).toBe('REGISTRATION_RATE_LIMITED');
    expect(register).not.toHaveBeenCalled();
    expect(limiter.record).not.toHaveBeenCalled();
  });

  it.each([
    [new RegistrationValidationError(), 400, 'INVALID_REGISTRATION_REQUEST'],
    [new RegistrationTermsNotAcceptedError(), 400, 'REGISTRATION_TERMS_NOT_ACCEPTED'],
    [new EmailVerificationFailedError(), 400, 'EMAIL_VERIFICATION_FAILED'],
    [new RegistrationInvitationUnavailableError(), 404, 'INVITATION_UNAVAILABLE'],
    [new RegistrationConflictError(), 409, 'REGISTRATION_CONFLICT'],
    [new RegistrationIdempotencyConflictError(), 409, 'REGISTRATION_IDEMPOTENCY_CONFLICT'],
    [new RegistrationTermsNotAvailableError(), 503, 'TERMS_NOT_AVAILABLE'],
    [new EmailVerificationUnavailableError(), 503, 'EMAIL_VERIFICATION_UNAVAILABLE'],
  ])('maps a stable domain error to %s', async (error, status, code) => {
    const { application } = fixture({
      register: vi.fn(async () => {
        throw error;
      }),
    });
    const response = await request(application).post('/api/v1/public/registrations').send(payload);

    expect(response.status).toBe(status);
    expect(response.body.error).toMatchObject({ code, requestId: 'registration-request-1' });
    expect(response.text).not.toContain(error.message);
  });

  it('delegates unknown failures to the global 500 handler without leaking details', async () => {
    const { application } = fixture({
      register: vi.fn(async () => {
        throw new Error('password=secret database constraint email new.user@example.com');
      }),
    });
    const response = await request(application).post('/api/v1/public/registrations').send(payload);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.text).not.toContain('secret');
    expect(response.text).not.toContain('new.user@example.com');
  });
});
