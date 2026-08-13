import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SharedCanvasRemediationCandidateRunnerError,
  parseSharedCanvasRemediationCandidateArgs,
  runSharedCanvasRemediationCandidate,
  type SharedCanvasRemediationCandidateRunnerDependencies,
} from './run-shared-canvas-remediation-candidate.js';

const COMMITS = {
  baseline: '49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9',
  red: 'b49c1befddfd2a7ec32145331374019372ff3080',
  parserImplementation: 'a50898fea5dcd6b2461880f9a89a6df2bcacb6a6',
  lifecycleImplementation: 'b9e9daad5683634702c3588dc892855c9108fd80',
  logImplementation: 'c288275673f493f36ebee8808b8fde8d72764005',
  parser: '2738a675b44e032fd1f70394ca24d0f360b283ce',
  lifecycle: '60869ba79eafaa047d5df76cb628c0a529644769',
  log: '27cb0bf11db8e7dfa00b3a8af3b60f91f675a168',
  docs: 'a19404f345cab9f2d418a14281f0c1c8155022ba',
  candidate: 'b5f36f2e43e8c43a9fdc3b015ddd67e87d33297a',
  requiredA: '49b9b5e3f738f65f3b88a2f513d06a4c1d3348f9',
} as const;

const REPOSITORY_ROOT = '/workspace/shortVideoAgent';
const CANDIDATE_ROOT = '/private/tmp/shortVideoAgent-b-acceptance';
const ALLOWED_ORIGIN = 'http://127.0.0.1:5173';
const SECRET = 'RUNNER_SECRET_MUST_NOT_LEAK_20260813';

function argv(): string[] {
  return [
    '--repository-root',
    REPOSITORY_ROOT,
    '--candidate-root',
    CANDIDATE_ROOT,
    '--baseline',
    COMMITS.baseline,
    '--red',
    COMMITS.red,
    '--parser-implementation',
    COMMITS.parserImplementation,
    '--lifecycle-implementation',
    COMMITS.lifecycleImplementation,
    '--log-implementation',
    COMMITS.logImplementation,
    '--parser',
    COMMITS.parser,
    '--lifecycle',
    COMMITS.lifecycle,
    '--log',
    COMMITS.log,
    '--docs',
    COMMITS.docs,
    '--candidate',
    COMMITS.candidate,
    '--required-a',
    COMMITS.requiredA,
    '--storycanvas-port',
    '10589',
    '--allowed-origin',
    ALLOWED_ORIGIN,
  ];
}

async function expectSafeCode(
  action: () => unknown | Promise<unknown>,
  code: string,
): Promise<void> {
  await assert.rejects(Promise.resolve().then(action), (error: unknown) => {
    assert.ok(error instanceof SharedCanvasRemediationCandidateRunnerError);
    assert.equal(error.message, code);
    assert.equal(error.stack, undefined);
    assert.equal(error.message.includes(SECRET), false);
    assert.equal(error.message.includes(COMMITS.candidate), false);
    return true;
  });
}

test('parses the exact fail-closed candidate acceptance CLI contract', () => {
  assert.deepEqual(parseSharedCanvasRemediationCandidateArgs(argv()), {
    repositoryRoot: REPOSITORY_ROOT,
    candidateRoot: CANDIDATE_ROOT,
    storyCanvasPort: 10589,
    allowedOrigin: ALLOWED_ORIGIN,
    commits: COMMITS,
  });
});

test('rejects missing, duplicate, unknown, relative, same-root, and unsafe port arguments', async () => {
  const cases = [
    argv().slice(0, -2),
    [...argv(), '--candidate', COMMITS.candidate],
    [...argv(), '--unexpected', SECRET],
    argv().map((value) => (value === CANDIDATE_ROOT ? 'relative-candidate' : value)),
    argv().map((value) => (value === CANDIDATE_ROOT ? REPOSITORY_ROOT : value)),
    argv().map((value) => (value === '10589' ? '0' : value)),
  ];
  for (const value of cases) {
    await expectSafeCode(
      () => parseSharedCanvasRemediationCandidateArgs(value),
      'SHARED_CANVAS_CANDIDATE_RUNNER_CONFIG_INVALID',
    );
  }
});

test('runs Git, HTTP/log, no-PostgreSQL runtime, then lifecycle and exposes no Gate claim', async () => {
  const events: string[] = [];
  const dependencies: SharedCanvasRemediationCandidateRunnerDependencies = {
    attestGit: async () => {
      events.push('git');
      return { verifiedCommitCount: 8, verifiedWriteSetCount: 5 };
    },
    validateHttpLog: async () => {
      events.push('http-log');
      return { malformedValidated: true, oversizedValidated: true, runtimeLogValidated: true };
    },
    validateRuntimeHarness: async () => {
      events.push('runtime');
      return {
        status: 'harness-ready',
        code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY',
        controlApiRequestCount: 2,
        storyCanvasStarted: true,
        storyCanvasStopped: true,
        dataRootRemoved: true,
      };
    },
    validateLifecycle: async () => {
      events.push('lifecycle');
      return {
        status: 'oracle-ready',
        code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY',
        registryEventCount: 8,
        shutdownSignal: 'SIGTERM',
        boundedShutdown: true,
      };
    },
  };

  const result = await runSharedCanvasRemediationCandidate(
    parseSharedCanvasRemediationCandidateArgs(argv()),
    { dependencies },
  );

  assert.deepEqual(events, ['git', 'http-log', 'runtime', 'lifecycle']);
  assert.deepEqual(result, {
    status: 'candidate-acceptance-ready',
    code: 'B_REMEDIATION_CANDIDATE_ACCEPTANCE_READY',
    gitAttested: true,
    httpLogValidated: true,
    runtimeHarnessValidated: true,
    lifecycleValidated: true,
  });
  for (const forbidden of [
    'candidateSha',
    'stdout',
    'stderr',
    'secret',
    'bRemediationAccepted',
    'sharedActivationGreen',
    'realEditorLoaded',
    'goldenPathComplete',
    'jointGatePass',
  ]) {
    assert.equal(Object.hasOwn(result, forbidden), false);
  }
});

test('maps every stage failure to one fixed runner code without running later stages', async () => {
  const events: string[] = [];
  const dependencies: SharedCanvasRemediationCandidateRunnerDependencies = {
    attestGit: async () => {
      events.push('git');
      return { verifiedCommitCount: 8, verifiedWriteSetCount: 5 };
    },
    validateHttpLog: async () => {
      events.push('http-log');
      throw new Error(`${SECRET} ${COMMITS.candidate}`);
    },
    validateRuntimeHarness: async () => {
      events.push('runtime');
      throw new Error(SECRET);
    },
    validateLifecycle: async () => {
      events.push('lifecycle');
      throw new Error(SECRET);
    },
  };

  await expectSafeCode(
    () =>
      runSharedCanvasRemediationCandidate(parseSharedCanvasRemediationCandidateArgs(argv()), {
        dependencies,
      }),
    'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
  );
  assert.deepEqual(events, ['git', 'http-log']);
});
