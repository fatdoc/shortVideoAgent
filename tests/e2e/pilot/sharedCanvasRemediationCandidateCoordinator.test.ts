import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SharedCanvasRemediationCandidateCoordinatorError,
  coordinateSharedCanvasRemediationCandidateAcceptance,
  type SharedCanvasRemediationCandidateCoordinatorDependencies,
  type SharedCanvasRemediationCandidateCoordinatorResult,
} from './sharedCanvasRemediationCandidateCoordinator.js';

const SECRET = 'CANDIDATE_SECRET_DO_NOT_ECHO_20260812';
const DATA_ROOT = '/private/tmp/candidate-coordinator-secret-root';
const LEAK_SENTINELS = [SECRET, DATA_ROOT] as const;

interface FixtureState {
  events: string[];
}

function validDependencies(
  state: FixtureState,
  overrides: Partial<SharedCanvasRemediationCandidateCoordinatorDependencies> = {},
): SharedCanvasRemediationCandidateCoordinatorDependencies {
  return {
    attestGit: async () => {
      state.events.push('git');
      return { verifiedCommitCount: 8, verifiedWriteSetCount: 5 };
    },
    validateHttpLog: async () => {
      state.events.push('http-log');
      return { malformedValidated: true, oversizedValidated: true, runtimeLogValidated: true };
    },
    validateRuntimeHarness: async () => {
      state.events.push('runtime');
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
      state.events.push('lifecycle');
      return {
        status: 'oracle-ready',
        code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY',
        registryEventCount: 8,
        shutdownSignal: 'SIGTERM',
        boundedShutdown: true,
      };
    },
    ...overrides,
  };
}

async function expectSafeCode(action: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof SharedCanvasRemediationCandidateCoordinatorError);
    assert.equal(error.message, code);
    assert.equal(error.stack, undefined);
    assert.match(error.message, /^[A-Z0-9_]+$/);
    for (const value of LEAK_SENTINELS) {
      assert.equal(error.message.includes(value), false);
    }
    return true;
  });
}

function assertNoCompletionFields(result: SharedCanvasRemediationCandidateCoordinatorResult): void {
  for (const forbidden of [
    'pass',
    'remediationAccepted',
    'bRemediationAccepted',
    'sharedActivationGreen',
    'realEditorLoaded',
    'goldenPathComplete',
    'jointGatePass',
    'candidateSha',
    'stdout',
    'stderr',
    'dataRoot',
  ]) {
    assert.equal(Object.hasOwn(result, forbidden), false);
  }
}

test('coordinates the exact Git then HTTP/log then runtime then lifecycle order without Gate completion', async () => {
  const state: FixtureState = { events: [] };
  const result = await coordinateSharedCanvasRemediationCandidateAcceptance(
    validDependencies(state),
  );

  assert.deepEqual(state.events, ['git', 'http-log', 'runtime', 'lifecycle']);
  assert.deepEqual(result, {
    status: 'coordinator-ready',
    code: 'A_REM_VAL_5_CANDIDATE_COORDINATOR_READY',
    gitAttested: true,
    httpLogValidated: true,
    runtimeHarnessValidated: true,
    lifecycleValidated: true,
  });
  assertNoCompletionFields(result);
});

test('fails before later work when Git attestation throws or returns the wrong exact result', async () => {
  const cases: SharedCanvasRemediationCandidateCoordinatorDependencies['attestGit'][] = [
    async () => {
      throw new Error(`${SECRET} ${DATA_ROOT}`);
    },
    async () => ({ verifiedCommitCount: 7, verifiedWriteSetCount: 5 }),
    async () => ({ verifiedCommitCount: 8, verifiedWriteSetCount: 4 }),
    async () =>
      ({
        verifiedCommitCount: 8,
        verifiedWriteSetCount: 5,
        jointGatePass: true,
      }) as { verifiedCommitCount: number; verifiedWriteSetCount: number },
  ];

  for (const attestGit of cases) {
    const state: FixtureState = { events: [] };
    await expectSafeCode(
      () =>
        coordinateSharedCanvasRemediationCandidateAcceptance(
          validDependencies(state, { attestGit }),
        ),
      'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED',
    );
    assert.deepEqual(state.events, []);
  }
});

test('fails before runtime and lifecycle when HTTP/log evidence is rejected or malformed', async () => {
  const cases: SharedCanvasRemediationCandidateCoordinatorDependencies['validateHttpLog'][] = [
    async () => {
      throw new Error(`${SECRET} ${DATA_ROOT}`);
    },
    async () => ({
      malformedValidated: false,
      oversizedValidated: true,
      runtimeLogValidated: true,
    }),
    async () => ({
      malformedValidated: true,
      oversizedValidated: false,
      runtimeLogValidated: true,
    }),
    async () => ({
      malformedValidated: true,
      oversizedValidated: true,
      runtimeLogValidated: false,
    }),
  ];

  for (const validateHttpLog of cases) {
    const state: FixtureState = { events: [] };
    await expectSafeCode(
      () =>
        coordinateSharedCanvasRemediationCandidateAcceptance(
          validDependencies(state, { validateHttpLog }),
        ),
      'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
    );
    assert.deepEqual(state.events, ['git']);
  }
});

test('fails before lifecycle when no-PostgreSQL runtime acceptance is rejected or overclaims Gate state', async () => {
  const cases: SharedCanvasRemediationCandidateCoordinatorDependencies['validateRuntimeHarness'][] =
    [
      async () => {
        throw new Error(`${SECRET} ${DATA_ROOT}`);
      },
      async () => ({
        status: 'harness-ready',
        code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY',
        controlApiRequestCount: 2,
        storyCanvasStarted: true,
        storyCanvasStopped: false as true,
        dataRootRemoved: true,
      }),
      async () =>
        ({
          status: 'harness-ready',
          code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY',
          controlApiRequestCount: 2,
          storyCanvasStarted: true,
          storyCanvasStopped: true,
          dataRootRemoved: true,
          bRemediationAccepted: true,
        }) as Awaited<
          ReturnType<
            SharedCanvasRemediationCandidateCoordinatorDependencies['validateRuntimeHarness']
          >
        >,
    ];

  for (const validateRuntimeHarness of cases) {
    const state: FixtureState = { events: [] };
    await expectSafeCode(
      () =>
        coordinateSharedCanvasRemediationCandidateAcceptance(
          validDependencies(state, { validateRuntimeHarness }),
        ),
      'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED',
    );
    assert.deepEqual(state.events, ['git', 'http-log']);
  }
});

test('rejects lifecycle evidence failure or overclaim after the first three stages complete', async () => {
  const cases: SharedCanvasRemediationCandidateCoordinatorDependencies['validateLifecycle'][] = [
    async () => {
      throw new Error(`${SECRET} ${DATA_ROOT}`);
    },
    async () => ({
      status: 'oracle-ready',
      code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY',
      registryEventCount: 8,
      shutdownSignal: 'SIGTERM',
      boundedShutdown: false as true,
    }),
    async () =>
      ({
        status: 'oracle-ready',
        code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY',
        registryEventCount: 8,
        shutdownSignal: 'SIGTERM',
        boundedShutdown: true,
        sharedActivationGreen: true,
      }) as Awaited<
        ReturnType<SharedCanvasRemediationCandidateCoordinatorDependencies['validateLifecycle']>
      >,
  ];

  for (const validateLifecycle of cases) {
    const state: FixtureState = { events: [] };
    await expectSafeCode(
      () =>
        coordinateSharedCanvasRemediationCandidateAcceptance(
          validDependencies(state, { validateLifecycle }),
        ),
      'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED',
    );
    assert.deepEqual(state.events, ['git', 'http-log', 'runtime']);
  }
});

test('normalizes synchronous callback throws and thenables to fixed stage codes', async () => {
  const stageCases: Array<{
    key: keyof SharedCanvasRemediationCandidateCoordinatorDependencies;
    code: string;
    expectedEvents: string[];
  }> = [
    {
      key: 'attestGit',
      code: 'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED',
      expectedEvents: [],
    },
    {
      key: 'validateHttpLog',
      code: 'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
      expectedEvents: ['git'],
    },
    {
      key: 'validateRuntimeHarness',
      code: 'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED',
      expectedEvents: ['git', 'http-log'],
    },
    {
      key: 'validateLifecycle',
      code: 'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED',
      expectedEvents: ['git', 'http-log', 'runtime'],
    },
  ];

  for (const { key, code, expectedEvents } of stageCases) {
    const state: FixtureState = { events: [] };
    const dependencies = validDependencies(state);
    dependencies[key] = (() => {
      throw new Error(`${SECRET} ${DATA_ROOT}`);
    }) as never;
    await expectSafeCode(
      () => coordinateSharedCanvasRemediationCandidateAcceptance(dependencies),
      code,
    );
    assert.deepEqual(state.events, expectedEvents);
  }
});

test('rejects non-exact dependency containers before callbacks or accessors can run', async () => {
  const cases: Array<{
    create(state: FixtureState, getterReads: { count: number }): unknown;
  }> = [
    {
      create: (state) => ({
        ...validDependencies(state),
        jointGatePass: true,
      }),
    },
    {
      create: (state) => {
        const dependencies = validDependencies(state) as Record<PropertyKey, unknown>;
        dependencies[Symbol('gate')] = true;
        return dependencies;
      },
    },
    {
      create: (state) => Object.create(validDependencies(state)) as unknown,
    },
    {
      create: (state, getterReads) => {
        const dependencies = validDependencies(state);
        Object.defineProperty(dependencies, 'attestGit', {
          configurable: true,
          enumerable: true,
          get() {
            getterReads.count += 1;
            return async () => ({ verifiedCommitCount: 8, verifiedWriteSetCount: 5 });
          },
        });
        return dependencies;
      },
    },
    {
      create: (state) =>
        new Proxy(validDependencies(state), {
          ownKeys() {
            throw new Error(`${SECRET} ${DATA_ROOT}`);
          },
        }),
    },
  ];

  for (const { create } of cases) {
    const state: FixtureState = { events: [] };
    const getterReads = { count: 0 };
    await expectSafeCode(
      () =>
        coordinateSharedCanvasRemediationCandidateAcceptance(
          create(state, getterReads) as SharedCanvasRemediationCandidateCoordinatorDependencies,
        ),
      'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED',
    );
    assert.deepEqual(state.events, []);
    assert.equal(getterReads.count, 0);
  }
});

test('calls a rejecting stage exactly once and never starts a later stage', async () => {
  const stageCases: Array<{
    key: keyof SharedCanvasRemediationCandidateCoordinatorDependencies;
    code: string;
    failureEvent: string;
    expectedEvents: string[];
  }> = [
    {
      key: 'attestGit',
      code: 'SHARED_CANVAS_CANDIDATE_GIT_ATTESTATION_FAILED',
      failureEvent: 'git-failed',
      expectedEvents: ['git-failed'],
    },
    {
      key: 'validateHttpLog',
      code: 'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
      failureEvent: 'http-log-failed',
      expectedEvents: ['git', 'http-log-failed'],
    },
    {
      key: 'validateRuntimeHarness',
      code: 'SHARED_CANVAS_CANDIDATE_RUNTIME_FAILED',
      failureEvent: 'runtime-failed',
      expectedEvents: ['git', 'http-log', 'runtime-failed'],
    },
    {
      key: 'validateLifecycle',
      code: 'SHARED_CANVAS_CANDIDATE_LIFECYCLE_FAILED',
      failureEvent: 'lifecycle-failed',
      expectedEvents: ['git', 'http-log', 'runtime', 'lifecycle-failed'],
    },
  ];

  for (const { key, code, failureEvent, expectedEvents } of stageCases) {
    const state: FixtureState = { events: [] };
    const dependencies = validDependencies(state);
    dependencies[key] = (() => {
      state.events.push(failureEvent);
      return Promise.reject(new Error(`${SECRET} ${DATA_ROOT}`));
    }) as never;

    await expectSafeCode(
      () => coordinateSharedCanvasRemediationCandidateAcceptance(dependencies),
      code,
    );
    assert.deepEqual(state.events, expectedEvents);
  }
});

test('assimilates rejecting thenables and normalizes hostile then accessors', async () => {
  const hostileThenables = [
    {
      then(_resolve: (value: unknown) => void, reject: (reason: unknown) => void) {
        reject(new Error(`${SECRET} ${DATA_ROOT}`));
      },
    },
    Object.defineProperty({}, 'then', {
      get() {
        throw new Error(`${SECRET} ${DATA_ROOT}`);
      },
    }),
  ];

  for (const thenable of hostileThenables) {
    const state: FixtureState = { events: [] };
    await expectSafeCode(
      () =>
        coordinateSharedCanvasRemediationCandidateAcceptance(
          validDependencies(state, {
            validateHttpLog: (() => thenable) as never,
          }),
        ),
      'SHARED_CANVAS_CANDIDATE_HTTP_LOG_FAILED',
    );
    assert.deepEqual(state.events, ['git']);
  }
});
