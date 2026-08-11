import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  AbGoldenPathRunnerError,
  createLocalAbGoldenPathPreflightDependencies,
  runAbGoldenPath,
  validateAbGoldenPathEvidence,
  type AbGoldenPathRunnerDependencies,
} from './run-ab-golden-path.js';

const BASELINE_COMMIT = 'a7f8021b80f540c69e4c45718b335ba2c0fca539';
const DATABASE_URL =
  'postgresql://pilot_user:FAKE_RUNNER_DB_PASSWORD@127.0.0.1:5432/videoagent_control_test';
const FORBIDDEN = [
  BASELINE_COMMIT,
  DATABASE_URL,
  'FAKE_RUNNER_SECRET_DO_NOT_USE',
  '/private/tmp/fake-runner-path',
];

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

function runnerDependencies(overrides: Partial<AbGoldenPathRunnerDependencies> = {}): {
  dependencies: AbGoldenPathRunnerDependencies;
  calls: Record<
    'exists' | 'ancestor' | 'consumer' | 'read' | 'reset' | 'spawn' | 'network',
    number
  >;
} {
  const calls = {
    exists: 0,
    ancestor: 0,
    consumer: 0,
    read: 0,
    reset: 0,
    spawn: 0,
    network: 0,
  };
  return {
    dependencies: {
      commitExists: async () => {
        calls.exists += 1;
        return true;
      },
      isCommitAncestor: async () => {
        calls.ancestor += 1;
        return true;
      },
      hasBConsumerCapability: async () => {
        calls.consumer += 1;
        return false;
      },
      readGoldenPathInput: async () => {
        calls.read += 1;
        return '';
      },
      resetMigrateSeed: async () => {
        calls.reset += 1;
      },
      createProcessHarness: () => {
        calls.spawn += 1;
        throw new Error('FAKE_PROCESS_MUST_NOT_START');
      },
      probeReadiness: async () => {
        calls.network += 1;
        return false;
      },
      ...overrides,
    },
    calls,
  };
}

async function expectSafeCode(operation: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(operation, (error: Error) => {
    assert.equal(error.message, code);
    assert.equal(error.stack, undefined);
    for (const forbidden of FORBIDDEN) {
      assert.doesNotMatch(
        error.message,
        new RegExp(forbidden.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      );
    }
    return true;
  });
}

test('rejects static environment failures before Git, file, database, process, or network work', async () => {
  const probes = runnerDependencies();

  await expectSafeCode(
    runAbGoldenPath(environment({ PILOT_E2E_AB_GOLDEN_PATH: 'false' }), {
      dependencies: probes.dependencies,
    }),
    'AB_GOLDEN_PATH_MODE_REQUIRED',
  );

  assert.deepEqual(probes.calls, {
    exists: 0,
    ancestor: 0,
    consumer: 0,
    read: 0,
    reset: 0,
    spawn: 0,
    network: 0,
  });
});

test('requires commit object and ancestor evidence before the B consumer probe', async () => {
  const missing = runnerDependencies({ commitExists: async () => false });
  await expectSafeCode(
    runAbGoldenPath(environment(), { dependencies: missing.dependencies }),
    'JOINT_GATE_B_BASELINE_COMMIT_INVALID',
  );
  assert.deepEqual(missing.calls, {
    exists: 0,
    ancestor: 0,
    consumer: 0,
    read: 0,
    reset: 0,
    spawn: 0,
    network: 0,
  });

  const nonAncestor = runnerDependencies({ isCommitAncestor: async () => false });
  await expectSafeCode(
    runAbGoldenPath(environment(), { dependencies: nonAncestor.dependencies }),
    'JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR',
  );
  assert.equal(nonAncestor.calls.exists, 1);
  assert.equal(nonAncestor.calls.consumer, 0);
  assert.equal(nonAncestor.calls.read, 0);
  assert.equal(nonAncestor.calls.reset, 0);
  assert.equal(nonAncestor.calls.spawn, 0);
  assert.equal(nonAncestor.calls.network, 0);
});

test('fails closed on the current missing B consumer capability with zero deferred side effects', async () => {
  const probes = runnerDependencies();

  await expectSafeCode(
    runAbGoldenPath(environment(), { dependencies: probes.dependencies }),
    'AB_GOLDEN_PATH_B_CONSUMER_REQUIRED',
  );

  assert.deepEqual(probes.calls, {
    exists: 1,
    ancestor: 1,
    consumer: 1,
    read: 0,
    reset: 0,
    spawn: 0,
    network: 0,
  });
});

test('remains NOT_IMPLEMENTED after a synthetic complete preflight and starts no deferred work', async () => {
  const probes = runnerDependencies({ hasBConsumerCapability: async () => true });

  await expectSafeCode(
    runAbGoldenPath(environment(), { dependencies: probes.dependencies }),
    'AB_GOLDEN_PATH_NOT_IMPLEMENTED',
  );

  assert.equal(probes.calls.exists, 1);
  assert.equal(probes.calls.ancestor, 1);
  assert.equal(probes.calls.read, 0);
  assert.equal(probes.calls.reset, 0);
  assert.equal(probes.calls.spawn, 0);
  assert.equal(probes.calls.network, 0);
});

test('uses only local shell-false Git probes and defaults the unfrozen B capability marker to false', async () => {
  const invocations: Array<{
    command: string;
    args: string[];
    options: { cwd: string; shell: false; stdio: 'ignore' };
  }> = [];
  const repositoryRoot = '/private/tmp/fake-runner-path';
  const dependencies = createLocalAbGoldenPathPreflightDependencies({
    repositoryRoot,
    spawnSyncImpl: (command, args, options) => {
      invocations.push({ command, args, options });
      return { status: 0 };
    },
  });

  assert.equal(await dependencies.commitExists(BASELINE_COMMIT), true);
  assert.equal(await dependencies.isCommitAncestor(BASELINE_COMMIT), true);
  assert.equal(await dependencies.hasBConsumerCapability(BASELINE_COMMIT), false);
  assert.deepEqual(invocations, [
    {
      command: 'git',
      args: ['cat-file', '-e', `${BASELINE_COMMIT}^{commit}`],
      options: { cwd: repositoryRoot, shell: false, stdio: 'ignore' },
    },
    {
      command: 'git',
      args: ['merge-base', '--is-ancestor', BASELINE_COMMIT, 'HEAD'],
      options: { cwd: repositoryRoot, shell: false, stdio: 'ignore' },
    },
  ]);
});

test('reuses the frozen spec, report, and artifact oracles without declaring gate completion', async () => {
  const artifactRoot = await mkdtemp(join(tmpdir(), 'pilot-ab-runner-evidence-'));
  try {
    const result = await validateAbGoldenPathEvidence({
      specSource: `
        import { test } from '@playwright/test';
        test('synthetic evidence only', async () => { await Promise.resolve(); });
      `,
      playwrightReport: {
        suites: [
          {
            title: 'A/B Golden Path evidence',
            specs: [
              {
                title: 'synthetic evidence only',
                tests: [
                  {
                    expectedStatus: 'passed',
                    annotations: [],
                    results: [{ status: 'passed' }],
                  },
                ],
              },
            ],
          },
        ],
        stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
      },
      artifactRoot,
      secrets: [],
    });

    assert.deepEqual(result, { total: 1, expected: 1, passed: 1 });
    assert.equal('gateComplete' in result, false);
  } finally {
    await rm(artifactRoot, { recursive: true, force: true });
  }
});

test('normalizes unexpected runner failures to a fixed non-leaking code', async () => {
  const probes = runnerDependencies({
    commitExists: async () => {
      throw new AbGoldenPathRunnerError('AB_GOLDEN_PATH_RUNNER_FAILED');
    },
  });

  await expectSafeCode(
    runAbGoldenPath(environment(), { dependencies: probes.dependencies }),
    'JOINT_GATE_B_BASELINE_COMMIT_INVALID',
  );
});
