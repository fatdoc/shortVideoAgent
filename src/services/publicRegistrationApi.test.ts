import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  PublicRegistrationApiError,
  createPublicRegistrationApi,
  type PublicRegistrationInput,
} from './publicRegistrationApi';

const runtime = {
  mode: 'pilot' as const,
  controlApiBaseUrl: 'https://control.example.com',
  configurationError: null,
};

const terms = {
  termsDocumentId: 'a1000000-0000-4000-8000-000000000001',
  termsVersionId: 'a2000000-0000-4000-8000-000000000001',
  documentCode: 'registration-notice',
  title: '用户须知',
  versionLabel: '2026-08',
  locale: 'zh-CN',
  content: '已批准的测试正文',
  contentDigest: 'a'.repeat(64),
  effectiveAt: '2026-08-08T00:00:00.000Z',
  mustReaccept: true,
};

const invitation = {
  invitationType: 'CHANNEL' as const,
  targetRoleCode: null,
  targetOrganizationId: null,
  attributionChannelId: 'a3000000-0000-4000-8000-000000000001',
  expiresAt: '2026-09-07T00:00:00.000Z',
  remainingUses: 97,
};

const registration = {
  registrationId: 'b1000000-0000-4000-8000-000000000001',
  userId: 'b2000000-0000-4000-8000-000000000001',
  tenantId: 'b3000000-0000-4000-8000-000000000001',
  membershipId: 'b4000000-0000-4000-8000-000000000001',
  registrationPath: 'CHANNEL_INVITATION' as const,
  completedAt: '2026-08-08T08:00:00.000Z',
};

const input: PublicRegistrationInput = {
  email: 'new.user@example.com',
  password: 'a-strong-registration-password',
  displayName: 'New User',
  tenantDisplayName: 'New Studio',
  invitationToken: 'invitation-secret-token',
  termsVersionId: terms.termsVersionId,
  locale: 'zh-CN',
  accepted: true,
  emailVerificationToken: 'email-verification-secret',
  idempotencyKey: 'registration-intent-1',
};

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

describe('Public Registration API client', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('loads and strictly parses the current published registration Terms', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ terms }));
    const api = createPublicRegistrationApi({ runtime, fetchImpl });

    await expect(api.loadCurrentTerms()).resolves.toEqual(terms);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/public/terms/current?documentCode=registration-notice&locale=zh-CN',
      expect.objectContaining({ credentials: 'include', method: 'GET' }),
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('previews an Invitation with the Token only in the JSON body', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ invitation }));
    const api = createPublicRegistrationApi({ runtime, fetchImpl });

    await expect(api.previewInvitation('invitation-secret-token')).resolves.toEqual(invitation);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/public/invitations/preview',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ token: 'invitation-secret-token' }),
      }),
    );
    expect(fetchImpl.mock.calls[0]?.[0]).not.toContain('invitation-secret-token');
  });

  it.each([
    [201, null, false],
    [200, 'true', true],
  ])(
    'submits the strict registration body and recognizes replay for HTTP %s',
    async (status, header, replayed) => {
      const fetchImpl = vi
        .fn()
        .mockResolvedValue(
          jsonResponse(
            { registration },
            status,
            header ? { 'idempotency-replayed': header } : undefined,
          ),
        );
      const api = createPublicRegistrationApi({ runtime, fetchImpl });

      await expect(api.register(input)).resolves.toEqual({ registration, replayed });
      expect(fetchImpl).toHaveBeenCalledWith(
        'https://control.example.com/api/v1/public/registrations',
        expect.objectContaining({ method: 'POST', credentials: 'include' }),
      );
      expect(JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string)).toEqual(input);
      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
    },
  );

  it('omits optional undefined fields instead of sending an ambiguous payload', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(
        jsonResponse({ registration: { ...registration, registrationPath: 'DIRECT' } }, 201),
      );
    const api = createPublicRegistrationApi({ runtime, fetchImpl });
    const directInput: PublicRegistrationInput = {
      email: input.email,
      password: input.password,
      displayName: input.displayName,
      termsVersionId: input.termsVersionId,
      locale: input.locale,
      accepted: true,
      emailVerificationToken: input.emailVerificationToken,
      idempotencyKey: input.idempotencyKey,
    };

    await api.register(directInput);
    expect(JSON.parse(fetchImpl.mock.calls[0]?.[1]?.body as string)).toEqual(directInput);
  });

  it('rejects malformed or over-broad successful responses', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ terms: { ...terms, publishedBy: 'internal-user' } }))
      .mockResolvedValueOnce(jsonResponse({ invitation: { ...invitation, remainingUses: -1 } }))
      .mockResolvedValueOnce(
        jsonResponse(
          { registration: { ...registration, registrationPath: 'CLIENT_OVERRIDE' } },
          201,
        ),
      );
    const api = createPublicRegistrationApi({ runtime, fetchImpl });

    await expect(api.loadCurrentTerms()).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
    await expect(api.previewInvitation('token')).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
    });
    await expect(api.register(input)).rejects.toMatchObject({ code: 'INVALID_API_RESPONSE' });
  });

  it('maps safe server errors, request IDs and retry-after without reflecting sensitive text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: 'REGISTRATION_RATE_LIMITED',
            message: 'password=secret invitation-secret-token new.user@example.com',
            requestId: 'req-registration-429',
          },
        },
        429,
        { 'retry-after': '17' },
      ),
    );
    const api = createPublicRegistrationApi({ runtime, fetchImpl });

    const error = await api.register(input).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublicRegistrationApiError);
    expect(error).toMatchObject({
      code: 'REGISTRATION_RATE_LIMITED',
      status: 429,
      requestId: 'req-registration-429',
      retryAfterSeconds: 17,
    });
    expect((error as Error).message).toBe('注册请求过多，请稍后重试。');
    expect((error as Error).message).not.toContain('secret');
    expect((error as Error).message).not.toContain('new.user@example.com');
  });

  it('fails closed for invalid runtime configuration and network failures', async () => {
    const invalidApi = createPublicRegistrationApi({
      runtime: { mode: 'demo', controlApiBaseUrl: null, configurationError: null },
      fetchImpl: vi.fn(),
    });
    await expect(invalidApi.loadCurrentTerms()).rejects.toMatchObject({
      code: 'PILOT_CONFIGURATION_ERROR',
    });

    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('network down with secret'));
    const api = createPublicRegistrationApi({ runtime, fetchImpl });
    await expect(api.previewInvitation('secret-token')).rejects.toEqual(
      expect.objectContaining({
        code: 'CONTROL_API_UNREACHABLE',
        status: null,
        message: '无法连接注册服务，请检查服务状态后重试。',
      }),
    );
  });
});
