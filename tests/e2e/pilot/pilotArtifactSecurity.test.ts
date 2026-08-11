import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { assertPilotBrowserArtifactsSafe } from './pilotArtifactSecurity.js';

const FAKE_SENSITIVE_VALUES = [
  ['internal redemption token', 'FAKE_INTERNAL_REDEMPTION_TOKEN_DO_NOT_USE_0001'],
  ['raw Grant token', 'FAKE_RAW_GRANT_TOKEN_DO_NOT_USE_0002'],
  ['grantId', 'FAKE_GRANT_ID_DO_NOT_USE_0003'],
  ['Package digest', 'FAKE_PACKAGE_DIGEST_DO_NOT_USE_0004'],
  ['Grant digest', 'FAKE_GRANT_DIGEST_DO_NOT_USE_0005'],
  ['Entry digest', 'FAKE_ENTRY_DIGEST_DO_NOT_USE_0006'],
  ['Script digest', 'FAKE_SCRIPT_DIGEST_DO_NOT_USE_0007'],
  ['Storyboard digest', 'FAKE_STORYBOARD_DIGEST_DO_NOT_USE_0008'],
  ['redemption idempotency key', 'FAKE_REDEMPTION_IDEMPOTENCY_KEY_DO_NOT_USE_0009'],
  ['redemption request digest', 'FAKE_REDEMPTION_REQUEST_DIGEST_DO_NOT_USE_0010'],
  [
    'PostgreSQL URL',
    'postgresql://fake_user:FAKE_DB_PASSWORD_DO_NOT_USE@127.0.0.1/fake_golden_path_test',
  ],
  ['PostgreSQL password', 'FAKE_DB_PASSWORD_DO_NOT_USE_0012'],
  ['StoryCanvas temporary path', '/private/tmp/fake-storycanvas-e2e-data-do-not-use'],
] as const;

const FAKE_SENSITIVE_EVIDENCE = {
  sensitiveValues: FAKE_SENSITIVE_VALUES.map(([label, value]) => ({ label, value })),
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test('accepts absent, empty, and secret-free Pilot browser artifact directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-safe-'));
  try {
    await assert.doesNotReject(
      assertPilotBrowserArtifactsSafe(join(root, 'missing'), ['browser-secret-value']),
    );
    await mkdir(join(root, 'nested'));
    await writeFile(join(root, 'nested', 'test-finished-1.png'), Buffer.from([137, 80, 78, 71]));
    await assert.doesNotReject(assertPilotBrowserArtifactsSafe(root, ['browser-secret-value']));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects textual secret residue without echoing the secret or artifact path', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-secret-'));
  const secret = 'browser-secret-value';
  try {
    await writeFile(join(root, 'failure.txt'), `safe prefix ${secret} safe suffix`);
    await assert.rejects(assertPilotBrowserArtifactsSafe(root, [secret]), (error: Error) => {
      assert.equal(error.message, 'PILOT_E2E_ARTIFACT_SECRET_LEAK');
      assert.doesNotMatch(error.message, new RegExp(secret));
      assert.doesNotMatch(error.message, /failure\.txt/);
      return true;
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects trace, HAR, and video captures that can retain request or DOM secrets', async () => {
  for (const extension of ['zip', 'har', 'webm']) {
    const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-capture-'));
    try {
      await writeFile(join(root, `capture.${extension}`), 'safe');
      await assert.rejects(
        assertPilotBrowserArtifactsSafe(root, []),
        /PILOT_E2E_ARTIFACT_CAPTURE_FORBIDDEN/,
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('rejects Golden Path sensitive values in Playwright artifacts without echoing evidence', async () => {
  for (const [label, value] of FAKE_SENSITIVE_VALUES) {
    const root = await mkdtemp(join(tmpdir(), 'pilot-artifact-golden-path-'));
    try {
      await writeFile(join(root, 'evidence.txt'), `synthetic ${label}: ${value}`);
      await assert.rejects(
        assertPilotBrowserArtifactsSafe(root, [], FAKE_SENSITIVE_EVIDENCE),
        (error: Error) => {
          assert.equal(error.message, 'PILOT_E2E_ARTIFACT_SECRET_LEAK');
          assert.doesNotMatch(error.message, new RegExp(escapeRegExp(value)));
          assert.doesNotMatch(error.message, /evidence\.txt/);
          return true;
        },
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
});

test('scans Control API and StoryCanvas stdout and stderr for Golden Path sensitive values', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-service-output-'));
  try {
    for (const [service, stream] of [
      ['controlApi', 'stdout'],
      ['controlApi', 'stderr'],
      ['storyCanvas', 'stdout'],
      ['storyCanvas', 'stderr'],
    ] as const) {
      const leakedValue = FAKE_SENSITIVE_VALUES.find(([label]) => label === 'raw Grant token')?.[1];
      assert.ok(leakedValue);
      await assert.rejects(
        assertPilotBrowserArtifactsSafe(root, [], {
          ...FAKE_SENSITIVE_EVIDENCE,
          serviceOutput: {
            [service]: {
              [stream]: `synthetic output ${leakedValue}`,
            },
          },
        }),
        (error: Error) => {
          assert.equal(error.message, 'PILOT_E2E_SERVICE_OUTPUT_SECRET_LEAK');
          assert.doesNotMatch(error.message, new RegExp(leakedValue));
          assert.doesNotMatch(error.message, new RegExp(service, 'i'));
          assert.doesNotMatch(error.message, new RegExp(stream, 'i'));
          return true;
        },
      );
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects structured security markers in artifacts and service output', async () => {
  const markers = [
    'X-Production-Plane-Internal-Token: [synthetic-redacted-value]',
    'internalRedemptionToken=FAKE_INTERNAL_TOKEN_DO_NOT_USE',
    'Authorization: Bearer FAKE_RAW_GRANT_TOKEN_DO_NOT_USE',
    'grantId=FAKE_GRANT_ID_DO_NOT_USE',
    'packagePayloadDigest=FAKE_PACKAGE_DIGEST_DO_NOT_USE',
    'grantDigest=FAKE_GRANT_DIGEST_DO_NOT_USE',
    'entry_digest=FAKE_ENTRY_DIGEST_DO_NOT_USE',
    'scriptDigest=FAKE_SCRIPT_DIGEST_DO_NOT_USE',
    'storyboard_payload_digest=FAKE_STORYBOARD_DIGEST_DO_NOT_USE',
    'redemptionIdempotencyKey=FAKE_REDEMPTION_KEY_DO_NOT_USE',
    'redemption_request_digest=FAKE_REDEMPTION_REQUEST_DIGEST_DO_NOT_USE',
    'postgresql://fake_user:FAKE_PASSWORD_DO_NOT_USE@127.0.0.1/fake_test',
    'PGPASSWORD=FAKE_PASSWORD_DO_NOT_USE',
    '"databasePassword":"FAKE_PASSWORD_DO_NOT_USE"',
    '/private/tmp/fake-storycanvas-runtime-do-not-use/session.json',
    'PostgresError: synthetic database diagnostic',
    'SELECT fake_secret FROM fake_grants',
    'Error: synthetic failure\n    at fakeFunction (/fake/source.ts:12:34)',
    'providerResponseBody={"synthetic":"unsafe"}',
  ] as const;

  for (const marker of markers) {
    const artifactRoot = await mkdtemp(join(tmpdir(), 'pilot-artifact-marker-'));
    try {
      await writeFile(join(artifactRoot, 'diagnostic.txt'), marker);
      await assert.rejects(
        assertPilotBrowserArtifactsSafe(artifactRoot, []),
        /PILOT_E2E_SENSITIVE_MARKER_LEAK/,
      );
      await rm(artifactRoot, { recursive: true, force: true });

      const serviceRoot = await mkdtemp(join(tmpdir(), 'pilot-output-marker-'));
      try {
        await assert.rejects(
          assertPilotBrowserArtifactsSafe(serviceRoot, [], {
            serviceOutput: { storyCanvas: { stderr: marker } },
          }),
          /PILOT_E2E_SENSITIVE_MARKER_LEAK/,
        );
      } finally {
        await rm(serviceRoot, { recursive: true, force: true });
      }
    } finally {
      await rm(artifactRoot, { recursive: true, force: true });
    }
  }
});

test('accepts synthetic secret-free service output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pilot-service-output-safe-'));
  try {
    await assert.doesNotReject(
      assertPilotBrowserArtifactsSafe(root, [], {
        ...FAKE_SENSITIVE_EVIDENCE,
        serviceOutput: {
          controlApi: {
            stdout: 'control-api ready requestId=req_safe_001',
            stderr: '',
          },
          storyCanvas: {
            stdout: 'storycanvas ready requestId=req_safe_002',
            stderr: '',
          },
        },
      }),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
