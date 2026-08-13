import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertSafePilotCanvasErrorResponse,
  assertSafePilotCanvasRuntimeOutput,
  type PilotCanvasErrorResponseInput,
  type PilotCanvasRuntimeOutputInput,
} from './sharedCanvasRemediationSecurityOracle.js';

const REQUEST_ID = 'req_canvas_safe_20260812';
const MALFORMED_BODY = '{"secret":"RAW_MALFORMED_BODY_DO_NOT_ECHO_20260812",';
const DATA_ROOT = '/private/tmp/storycanvas-remediation-secret-root-20260812';

function errorResponse(
  overrides: Partial<PilotCanvasErrorResponseInput> = {},
): PilotCanvasErrorResponseInput {
  return {
    kind: 'malformed-json',
    status: 400,
    headers: {
      'cache-control': 'no-store',
      'content-type': 'application/json; charset=utf-8',
      'x-request-id': REQUEST_ID,
    },
    body: {
      error: {
        code: 'PILOT_CANVAS_MALFORMED_JSON',
        message: 'Pilot Canvas request body is invalid.',
        retryable: false,
        requestId: REQUEST_ID,
      },
    },
    requestBody: MALFORMED_BODY,
    sensitiveValues: [
      'videoagent_session=COOKIE_SECRET_DO_NOT_ECHO_20260812',
      'CSRF_SECRET_DO_NOT_ECHO_20260812',
      'TOKEN_SECRET_DO_NOT_ECHO_20260812',
      'GRANT_SECRET_DO_NOT_ECHO_20260812',
      'DIGEST_SECRET_DO_NOT_ECHO_20260812',
    ],
    ...overrides,
  };
}

function runtimeOutput(
  overrides: Partial<PilotCanvasRuntimeOutputInput> = {},
): PilotCanvasRuntimeOutputInput {
  return {
    expectedState: 'ready-stopped',
    stdout: 'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\nPILOT_CANVAS_RUNTIME_STOPPED\n',
    stderr: '',
    stdoutTruncated: false,
    stderrTruncated: false,
    dataRoot: DATA_ROOT,
    sensitiveValues: ['RUNTIME_TOKEN_SECRET_DO_NOT_ECHO_20260812'],
    ...overrides,
  };
}

function assertFixedError(
  action: () => void,
  expectedCode: string,
  forbidden: readonly string[] = [],
): void {
  assert.throws(action, (error: Error) => {
    assert.equal(error.message, expectedCode);
    assert.match(error.message, /^[A-Z0-9_]+$/);
    for (const value of forbidden) assert.equal(error.message.includes(value), false);
    assert.doesNotMatch(error.message, /Error:|\bat\s+.*:\d+:\d+/);
    return true;
  });
}

test('accepts the fixed malformed JSON 400 envelope', () => {
  assert.doesNotThrow(() => assertSafePilotCanvasErrorResponse(errorResponse()));
});

test('accepts the fixed oversized request 413 envelope', () => {
  assert.doesNotThrow(() =>
    assertSafePilotCanvasErrorResponse(
      errorResponse({
        kind: 'oversized-json',
        status: 413,
        body: {
          error: {
            code: 'PILOT_CANVAS_REQUEST_TOO_LARGE',
            message: 'Pilot Canvas request body is too large.',
            retryable: false,
            requestId: REQUEST_ID,
          },
        },
        requestBody: `{"payload":"${'X'.repeat(17 * 1024)}"}`,
      }),
    ),
  );
});

test('rejects the wrong status, code, message, retryability, or envelope shape with fixed codes', () => {
  const cases: ReadonlyArray<[Partial<PilotCanvasErrorResponseInput>, string]> = [
    [{ status: 500 }, 'SHARED_CANVAS_HTTP_STATUS_INVALID'],
    [
      {
        body: {
          error: {
            code: 'PILOT_CANVAS_REQUEST_INVALID',
            message: 'Pilot Canvas request body is invalid.',
            retryable: false,
            requestId: REQUEST_ID,
          },
        },
      },
      'SHARED_CANVAS_HTTP_ENVELOPE_INVALID',
    ],
    [
      {
        body: {
          error: {
            code: 'PILOT_CANVAS_MALFORMED_JSON',
            message: 'Unexpected token near secret body',
            retryable: false,
            requestId: REQUEST_ID,
          },
        },
      },
      'SHARED_CANVAS_HTTP_SENSITIVE_CONTENT',
    ],
    [
      {
        body: {
          error: {
            code: 'PILOT_CANVAS_MALFORMED_JSON',
            message: 'Pilot Canvas request body is invalid.',
            retryable: true,
            requestId: REQUEST_ID,
          },
        },
      },
      'SHARED_CANVAS_HTTP_ENVELOPE_INVALID',
    ],
    [
      {
        body: {
          error: {
            code: 'PILOT_CANVAS_MALFORMED_JSON',
            message: 'Pilot Canvas request body is invalid.',
            retryable: false,
            requestId: REQUEST_ID,
          },
          diagnostic: 'safe-looking-extra-field',
        },
      },
      'SHARED_CANVAS_HTTP_ENVELOPE_INVALID',
    ],
  ];

  for (const [overrides, code] of cases) {
    assertFixedError(() => assertSafePilotCanvasErrorResponse(errorResponse(overrides)), code, [
      MALFORMED_BODY,
      'Unexpected token near secret body',
    ]);
  }
});

test('requires JSON, no-store, one safe request ID, and exact header/body request ID equality', () => {
  const cases: ReadonlyArray<[Partial<PilotCanvasErrorResponseInput>, string]> = [
    [
      {
        headers: {
          'content-type': 'text/plain',
          'cache-control': 'no-store',
          'x-request-id': REQUEST_ID,
        },
      },
      'SHARED_CANVAS_HTTP_HEADERS_INVALID',
    ],
    [
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'max-age=60',
          'x-request-id': REQUEST_ID,
        },
      },
      'SHARED_CANVAS_HTTP_HEADERS_INVALID',
    ],
    [
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'x-request-id': ['req_one', 'req_two'],
        },
      },
      'SHARED_CANVAS_HTTP_REQUEST_ID_INVALID',
    ],
    [
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'x-request-id': 'unsafe request id\r\nset-cookie: bad=true',
        },
      },
      'SHARED_CANVAS_HTTP_REQUEST_ID_INVALID',
    ],
    [
      {
        headers: {
          'content-type': 'application/json',
          'cache-control': 'no-store',
          'x-request-id': 'req_header_safe',
        },
      },
      'SHARED_CANVAS_HTTP_REQUEST_ID_INVALID',
    ],
  ];

  for (const [overrides, code] of cases) {
    assertFixedError(() => assertSafePilotCanvasErrorResponse(errorResponse(overrides)), code, [
      'unsafe request id',
      'set-cookie',
      MALFORMED_BODY,
    ]);
  }
});

test('rejects raw request bodies and caller-provided sensitive values anywhere in response evidence', () => {
  const sentinels = [
    MALFORMED_BODY,
    'videoagent_session=COOKIE_SECRET_DO_NOT_ECHO_20260812',
    'CSRF_SECRET_DO_NOT_ECHO_20260812',
    'TOKEN_SECRET_DO_NOT_ECHO_20260812',
    'GRANT_SECRET_DO_NOT_ECHO_20260812',
    'DIGEST_SECRET_DO_NOT_ECHO_20260812',
  ];

  for (const sentinel of sentinels) {
    assertFixedError(
      () =>
        assertSafePilotCanvasErrorResponse(
          errorResponse({
            headers: {
              'content-type': 'application/json',
              'cache-control': 'no-store',
              'x-request-id': REQUEST_ID,
              'x-debug': sentinel,
            },
          }),
        ),
      'SHARED_CANVAS_HTTP_SENSITIVE_CONTENT',
      sentinels,
    );
  }
});

test('rejects secret markers, data-root paths, stack traces, and parser internals without echoing them', () => {
  const forbidden = [
    'Cookie: videoagent_session=secret',
    'x-storycanvas-csrf=secret',
    'accessToken=secret',
    'grantId=grant_secret',
    'entryDigest=digest_secret',
    `STORYCANVAS_DATA_ROOT=${DATA_ROOT}`,
    DATA_ROOT,
    'Error: parser exploded\n    at parseBody (/repo/parser.ts:10:4)',
    'entity.parse.failed',
    'entity.too.large',
    'SyntaxError: JSON input',
    'Unexpected token } in JSON',
  ];

  for (const marker of forbidden) {
    assertFixedError(
      () =>
        assertSafePilotCanvasErrorResponse(
          errorResponse({
            body: {
              error: {
                code: 'PILOT_CANVAS_MALFORMED_JSON',
                message: 'Pilot Canvas request body is invalid.',
                retryable: false,
                requestId: REQUEST_ID,
              },
              diagnostic: marker,
            },
          }),
        ),
      'SHARED_CANVAS_HTTP_SENSITIVE_CONTENT',
      forbidden,
    );
  }
});

test('accepts only the READY then STOPPED Pilot runtime lifecycle lines', () => {
  assert.doesNotThrow(() => assertSafePilotCanvasRuntimeOutput(runtimeOutput()));
});

test('accepts one BLOCKED marker only for the blocked runtime state', () => {
  assert.doesNotThrow(() =>
    assertSafePilotCanvasRuntimeOutput(
      runtimeOutput({ expectedState: 'blocked', stdout: 'PILOT_CANVAS_RUNTIME_BLOCKED\n' }),
    ),
  );
});

test('rejects non-empty stderr and truncated output with fixed codes', () => {
  assertFixedError(
    () =>
      assertSafePilotCanvasRuntimeOutput(
        runtimeOutput({ stderr: 'SyntaxError: RUNTIME_STDERR_SECRET_DO_NOT_ECHO_20260812' }),
      ),
    'SHARED_CANVAS_RUNTIME_STDERR_FORBIDDEN',
    ['RUNTIME_STDERR_SECRET_DO_NOT_ECHO_20260812', 'SyntaxError'],
  );
  assertFixedError(
    () => assertSafePilotCanvasRuntimeOutput(runtimeOutput({ stdoutTruncated: true })),
    'SHARED_CANVAS_RUNTIME_OUTPUT_TRUNCATED',
  );
  assertFixedError(
    () => assertSafePilotCanvasRuntimeOutput(runtimeOutput({ stderrTruncated: true })),
    'SHARED_CANVAS_RUNTIME_OUTPUT_TRUNCATED',
  );
});

test('enforces the Pilot stdout line allowlist without leaking rejected lines', () => {
  const forbiddenLines = [
    'database directory: /private/tmp/storycanvas-secret',
    'GET /api/production/pilot/canvas/bootstrap 400',
    'Cookie: videoagent_session=secret',
    'PILOT_CANVAS_RUNTIME_READY http://localhost:10588',
    'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:0',
    'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:65536',
  ];

  for (const line of forbiddenLines) {
    assertFixedError(
      () =>
        assertSafePilotCanvasRuntimeOutput(
          runtimeOutput({
            stdout: `PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\n${line}\nPILOT_CANVAS_RUNTIME_STOPPED\n`,
          }),
        ),
      'SHARED_CANVAS_RUNTIME_OUTPUT_INVALID',
      forbiddenLines,
    );
  }
});

test('requires exact READY and STOPPED counts and lifecycle order', () => {
  const invalidOutputs = [
    '',
    'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\n',
    'PILOT_CANVAS_RUNTIME_STOPPED\n',
    'PILOT_CANVAS_RUNTIME_STOPPED\nPILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\n',
    'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\nPILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10589\nPILOT_CANVAS_RUNTIME_STOPPED\n',
    'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\nPILOT_CANVAS_RUNTIME_STOPPED\nPILOT_CANVAS_RUNTIME_STOPPED\n',
  ];

  for (const stdout of invalidOutputs) {
    assertFixedError(
      () => assertSafePilotCanvasRuntimeOutput(runtimeOutput({ stdout })),
      'SHARED_CANVAS_RUNTIME_MARKER_INVALID',
    );
  }
});

test('keeps BLOCKED mutually exclusive with READY and STOPPED', () => {
  const invalidOutputs = [
    'PILOT_CANVAS_RUNTIME_BLOCKED\nPILOT_CANVAS_RUNTIME_STOPPED\n',
    'PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\nPILOT_CANVAS_RUNTIME_BLOCKED\nPILOT_CANVAS_RUNTIME_STOPPED\n',
    'PILOT_CANVAS_RUNTIME_BLOCKED\nPILOT_CANVAS_RUNTIME_BLOCKED\n',
  ];

  for (const stdout of invalidOutputs) {
    assertFixedError(
      () => assertSafePilotCanvasRuntimeOutput(runtimeOutput({ expectedState: 'blocked', stdout })),
      'SHARED_CANVAS_RUNTIME_MARKER_INVALID',
    );
  }
});

test('rejects runtime secrets and data-root disclosure with a fixed non-echoing code', () => {
  const forbidden = [DATA_ROOT, 'RUNTIME_TOKEN_SECRET_DO_NOT_ECHO_20260812'];
  for (const sentinel of forbidden) {
    assertFixedError(
      () =>
        assertSafePilotCanvasRuntimeOutput(
          runtimeOutput({
            stdout: `PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:10588\n${sentinel}\nPILOT_CANVAS_RUNTIME_STOPPED\n`,
          }),
        ),
      'SHARED_CANVAS_RUNTIME_SENSITIVE_CONTENT',
      forbidden,
    );
  }
});
