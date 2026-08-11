import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AbGoldenPathPreflightError,
  preflightAbGoldenPath,
  type AbGoldenPathPreflightDependencies,
} from './abGoldenPathPreflight.js';

const BASELINE_COMMIT = 'a7f8021b80f540c69e4c45718b335ba2c0fca539';
const DATABASE_URL =
  'postgresql://pilot_user:FAKE_DB_PASSWORD_DO_NOT_USE@127.0.0.1:5432/videoagent_control_test';
const FAKE_SECRET = 'FAKE_PREFLIGHT_SECRET_DO_NOT_USE';

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PILOT_E2E: 'true',
    PILOT_E2E_AB_GOLDEN_PATH: 'true',
    PILOT_E2E_BROWSER_CHANNEL: 'chrome',
    CONTROL_API_TEST_DATABASE_URL: DATABASE_URL,
    JOINT_GATE_B_BASELINE_COMMIT: BASELINE_COMMIT,
    ...overrides,
  };
}

function dependencies(overrides: Partial<AbGoldenPathPreflightDependencies> = {}): {
  dependencies: AbGoldenPathPreflightDependencies;
  calls: { exists: string[]; ancestor: string[]; consumer: string[] };
} {
  const calls = { exists: [] as string[], ancestor: [] as string[], consumer: [] as string[] };
  return {
    dependencies: {
      commitExists: async (commit) => {
        calls.exists.push(commit);
        return true;
      },
      isCommitAncestor: async (commit) => {
        calls.ancestor.push(commit);
        return true;
      },
      hasBConsumerCapability: async (commit) => {
        calls.consumer.push(commit);
        return true;
      },
      ...overrides,
    },
    calls,
  };
}

async function expectCode(
  operation: Promise<unknown>,
  code: string,
  forbiddenValues: readonly string[] = [],
): Promise<void> {
  await assert.rejects(operation, (error: Error) => {
    assert.ok(error instanceof AbGoldenPathPreflightError);
    assert.equal(error.message, code);
    assert.equal(error.code, code);
    assert.equal(error.stack, undefined);
    const publicError = JSON.stringify({
      name: error.name,
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    for (const value of forbiddenValues) {
      assert.doesNotMatch(publicError, new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }
    return true;
  });
}

test('rejects unsafe static inputs before invoking repository or consumer probes', async () => {
  const cases: Array<[NodeJS.ProcessEnv, string]> = [
    [{ PILOT_E2E: undefined }, 'PILOT_E2E_MODE_REQUIRED'],
    [{ PILOT_E2E: 'false' }, 'PILOT_E2E_MODE_REQUIRED'],
    [{ PILOT_E2E_AB_GOLDEN_PATH: undefined }, 'AB_GOLDEN_PATH_MODE_REQUIRED'],
    [{ PILOT_E2E_AB_GOLDEN_PATH: 'false' }, 'AB_GOLDEN_PATH_MODE_REQUIRED'],
    [{ PILOT_E2E_BROWSER_CHANNEL: undefined }, 'PILOT_E2E_BROWSER_CHANNEL_REQUIRED'],
    [{ PILOT_E2E_BROWSER_CHANNEL: 'chromium' }, 'PILOT_E2E_BROWSER_CHANNEL_INVALID'],
    [{ CONTROL_API_TEST_DATABASE_URL: undefined }, 'PILOT_E2E_DATABASE_URL_REQUIRED'],
    [
      { CONTROL_API_TEST_DATABASE_URL: 'mysql://127.0.0.1/videoagent_control_test' },
      'PILOT_E2E_DATABASE_PROTOCOL_INVALID',
    ],
    [
      { CONTROL_API_TEST_DATABASE_URL: 'postgres://127.0.0.1/videoagent_control' },
      'PILOT_E2E_DATABASE_NOT_DEDICATED',
    ],
    [
      { CONTROL_API_TEST_DATABASE_URL: 'postgres://127.0.0.1/not-a-test-database' },
      'PILOT_E2E_DATABASE_NOT_DEDICATED',
    ],
    [{ CONTROL_API_TEST_DATABASE_URL: 'not a url' }, 'PILOT_E2E_DATABASE_URL_INVALID'],
    [{ JOINT_GATE_B_BASELINE_COMMIT: undefined }, 'JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED'],
    [{ JOINT_GATE_B_BASELINE_COMMIT: 'a7f8021' }, 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'],
    [
      { JOINT_GATE_B_BASELINE_COMMIT: `${BASELINE_COMMIT}0` },
      'JOINT_GATE_B_BASELINE_COMMIT_INVALID',
    ],
    [{ JOINT_GATE_B_BASELINE_COMMIT: 'z'.repeat(40) }, 'JOINT_GATE_B_BASELINE_COMMIT_INVALID'],
  ];

  for (const [overrides, expectedCode] of cases) {
    const probes = dependencies();
    await expectCode(
      preflightAbGoldenPath(environment(overrides), probes.dependencies),
      expectedCode,
      [DATABASE_URL, BASELINE_COMMIT, FAKE_SECRET],
    );
    assert.deepEqual(probes.calls, { exists: [], ancestor: [], consumer: [] });
  }
});

test('requires the baseline commit object before ancestor and consumer checks', async () => {
  const probes = dependencies({ commitExists: async () => false });

  await expectCode(
    preflightAbGoldenPath(environment(), probes.dependencies),
    'JOINT_GATE_B_BASELINE_COMMIT_INVALID',
    [DATABASE_URL, BASELINE_COMMIT, FAKE_SECRET],
  );

  assert.deepEqual(probes.calls.ancestor, []);
  assert.deepEqual(probes.calls.consumer, []);
});

test('requires the baseline to be an ancestor before checking the B consumer', async () => {
  const probes = dependencies({ isCommitAncestor: async () => false });

  await expectCode(
    preflightAbGoldenPath(environment(), probes.dependencies),
    'JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR',
    [DATABASE_URL, BASELINE_COMMIT, FAKE_SECRET],
  );

  assert.deepEqual(probes.calls.exists, [BASELINE_COMMIT]);
  assert.deepEqual(probes.calls.consumer, []);
});

test('fails closed with the fixed consumer code when B capability is not proven', async () => {
  const probes = dependencies({ hasBConsumerCapability: async () => false });

  await expectCode(
    preflightAbGoldenPath(environment(), probes.dependencies),
    'AB_GOLDEN_PATH_B_CONSUMER_REQUIRED',
    [DATABASE_URL, BASELINE_COMMIT, FAKE_SECRET],
  );

  assert.deepEqual(probes.calls.exists, [BASELINE_COMMIT]);
  assert.deepEqual(probes.calls.ancestor, [BASELINE_COMMIT]);
});

test('normalizes probe exceptions to fixed codes without leaking input or secret details', async () => {
  const cases: Array<[Partial<AbGoldenPathPreflightDependencies>, string]> = [
    [
      { commitExists: async () => Promise.reject(new Error(`git failed ${BASELINE_COMMIT}`)) },
      'JOINT_GATE_B_BASELINE_COMMIT_INVALID',
    ],
    [
      { isCommitAncestor: async () => Promise.reject(new Error(`git failed ${DATABASE_URL}`)) },
      'JOINT_GATE_B_BASELINE_COMMIT_INVALID',
    ],
    [
      {
        hasBConsumerCapability: async () =>
          Promise.reject(new Error(`consumer failed ${FAKE_SECRET}`)),
      },
      'AB_GOLDEN_PATH_B_CONSUMER_REQUIRED',
    ],
  ];

  for (const [overrides, expectedCode] of cases) {
    await expectCode(
      preflightAbGoldenPath(environment(), dependencies(overrides).dependencies),
      expectedCode,
      [DATABASE_URL, BASELINE_COMMIT, FAKE_SECRET],
    );
  }
});

test('accepts a dedicated PostgreSQL URL with either supported protocol and mutates no input', async () => {
  for (const protocol of ['postgres', 'postgresql'] as const) {
    const input = environment({
      CONTROL_API_TEST_DATABASE_URL: `${protocol}://127.0.0.1:5432/videoagent_control_test`,
    });
    const snapshot = { ...input };
    const probes = dependencies();

    const result = await preflightAbGoldenPath(input, probes.dependencies);

    assert.deepEqual(input, snapshot);
    assert.deepEqual(result, {
      browserChannel: 'chrome',
      databaseName: 'videoagent_control_test',
      databaseUrl: `${protocol}://127.0.0.1:5432/videoagent_control_test`,
      baselineCommit: BASELINE_COMMIT,
    });
    assert.deepEqual(probes.calls, {
      exists: [BASELINE_COMMIT],
      ancestor: [BASELINE_COMMIT],
      consumer: [BASELINE_COMMIT],
    });
  }
});
