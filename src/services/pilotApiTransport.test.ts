import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PilotRuntime } from '../config/pilotRuntime';
import { PilotApiError, createPilotApiTransport, type PilotApiResponse } from './pilotApiTransport';

const runtime: PilotRuntime = {
  mode: 'pilot',
  controlApiBaseUrl: 'https://control.example.com',
  configurationError: null,
};

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function parseValue(value: unknown): { value: string } {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).length !== 1 ||
    typeof (value as Record<string, unknown>).value !== 'string'
  ) {
    throw new Error('unsafe parser details must not escape');
  }
  return { value: (value as Record<string, unknown>).value as string };
}

describe('pilotApiTransport', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('uses the real Cookie session, no-store, AbortSignal and an exact GET request', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ value: 'ok' }, 200, {
        'x-request-id': 'req-get-1',
      }),
    );
    const signal = new AbortController().signal;
    const transport = createPilotApiTransport({ runtime, fetchImpl });

    const response = await transport.request({
      method: 'GET',
      path: '/api/v1/projects/10000000-0000-4000-8000-000000000001/production-eligibility',
      signal,
      expectedStatuses: [200],
      parse: parseValue,
    });

    expect(response).toEqual<PilotApiResponse<{ value: string }>>({
      data: { value: 'ok' },
      status: 200,
      requestId: 'req-get-1',
      replayed: null,
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://control.example.com/api/v1/projects/10000000-0000-4000-8000-000000000001/production-eligibility',
      {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      },
    );
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('retries an idempotent POST with the identical key and body only', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: 'PROVIDER_UNAVAILABLE',
              message: 'private provider stack and signed URL',
              requestId: 'req-post-503',
            },
          },
          503,
        ),
      )
      .mockResolvedValueOnce(
        jsonResponse({ value: 'created' }, 201, {
          'idempotency-replayed': 'true',
          'x-request-id': 'req-post-201',
        }),
      );
    const transport = createPilotApiTransport({ runtime, fetchImpl });
    const body = { packageId: '10000000-0000-4000-8000-000000000001' };

    await expect(
      transport.request({
        method: 'POST',
        path: '/api/v1/projects/10000000-0000-4000-8000-000000000002/canvas-entries',
        body,
        idempotencyKey: 'canvas-entry-1',
        maxAttempts: 2,
        expectedStatuses: [200, 201],
        parse: parseValue,
      }),
    ).resolves.toEqual({
      data: { value: 'created' },
      status: 201,
      requestId: 'req-post-201',
      replayed: true,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const first = fetchImpl.mock.calls[0];
    const second = fetchImpl.mock.calls[1];
    expect(first).toEqual(second);
    expect(first).toEqual([
      'https://control.example.com/api/v1/projects/10000000-0000-4000-8000-000000000002/canvas-entries',
      {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'Idempotency-Key': 'canvas-entry-1',
        },
        body: JSON.stringify(body),
        signal: undefined,
      },
    ]);
  });

  it('rejects unsafe methods, paths, GET bodies and POST retry without idempotency', async () => {
    const fetchImpl = vi.fn();
    const transport = createPilotApiTransport({ runtime, fetchImpl });

    await expect(
      transport.request({
        method: 'DELETE' as 'GET',
        path: '/api/v1/projects',
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PILOT_REQUEST' });
    await expect(
      transport.request({
        method: 'GET',
        path: 'https://attacker.example/api/v1/projects',
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PILOT_REQUEST' });
    await expect(
      transport.request({
        method: 'GET',
        path: '/api/v1/projects/../auth/session',
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PILOT_REQUEST' });
    await expect(
      transport.request({
        method: 'GET',
        path: '/api/v1/projects',
        body: {} as never,
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PILOT_REQUEST' });
    await expect(
      transport.request({
        method: 'POST',
        path: '/api/v1/projects',
        body: {},
        maxAttempts: 2,
        expectedStatuses: [201],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({ code: 'INVALID_PILOT_REQUEST' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it.each([
    [401, 'SESSION_REQUIRED'],
    [403, 'CAPABILITY_SCOPE_DENIED'],
    [404, 'PROJECT_NOT_FOUND'],
    [409, 'IDEMPOTENCY_CONFLICT'],
    [410, 'CANVAS_ENTRY_EXPIRED'],
    [422, 'SCHEMA_INVALID'],
    [503, 'PROVIDER_UNAVAILABLE'],
  ])(
    'preserves safe status/code/request ID for HTTP %s without exposing server text',
    async (status, code) => {
      const fetchImpl = vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code,
              message: 'SQL stack accessToken=private signedUrl=https://private.example',
              requestId: `req-${status}`,
              stack: 'private stack',
            },
          },
          status,
        ),
      );
      const transport = createPilotApiTransport({ runtime, fetchImpl });

      let caught: unknown;
      try {
        await transport.request({
          method: 'GET',
          path: '/api/v1/projects',
          expectedStatuses: [200],
          parse: parseValue,
        });
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(PilotApiError);
      expect(caught).toMatchObject({ status, code, requestId: `req-${status}` });
      const serialized = JSON.stringify(caught);
      expect(serialized).not.toContain('accessToken');
      expect((caught as Error).message).not.toContain('SQL');
      expect((caught as Error).message).not.toContain('private.example');
    },
  );

  it('keeps HTTP status and header Request ID when JSON or schema parsing fails', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response('<html>private upstream stack</html>', {
          status: 503,
          headers: { 'x-request-id': 'req-bad-json' },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ value: 42, serverStack: 'private' }, 200, {
          'x-request-id': 'req-bad-schema',
        }),
      );
    const transport = createPilotApiTransport({ runtime, fetchImpl });

    await expect(
      transport.request({
        method: 'GET',
        path: '/api/v1/projects',
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({
      code: 'PILOT_SERVICE_UNAVAILABLE',
      status: 503,
      requestId: 'req-bad-json',
    });

    await expect(
      transport.request({
        method: 'GET',
        path: '/api/v1/projects',
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_API_RESPONSE',
      status: 200,
      requestId: 'req-bad-schema',
    });
  });

  it('propagates AbortSignal cancellation and never falls back to storage or mock data', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new DOMException('aborted secret', 'AbortError'));
    const transport = createPilotApiTransport({ runtime, fetchImpl });

    await expect(
      transport.request({
        method: 'GET',
        path: '/api/v1/projects',
        signal: new AbortController().signal,
        maxAttempts: 3,
        expectedStatuses: [200],
        parse: parseValue,
      }),
    ).rejects.toMatchObject({ code: 'REQUEST_ABORTED', status: null, requestId: null });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
