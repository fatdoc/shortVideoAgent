import assert from 'node:assert/strict';
import test from 'node:test';
import type { PilotProcessOutput, PilotProcessSpec } from './pilotProcessHarness.js';
import {
  SharedCanvasNoPostgresRuntimeAcceptanceError,
  runSharedCanvasNoPostgresRuntimeAcceptance,
  type SharedCanvasNoPostgresRuntimeAcceptanceDependencies,
  type SharedCanvasNoPostgresRuntimeAcceptanceOptions,
  type SharedCanvasNoPostgresRuntimeAcceptanceResult,
} from './sharedCanvasNoPostgresRuntimeAcceptance.js';

const REPOSITORY_ROOT = '/workspace/shortVideoAgent';
const STORYCANVAS_PORT = 10_588;
const CONTROL_API_PORT = 43_121;
const ALLOWED_ORIGIN = 'http://127.0.0.1:5173';
const DATA_ROOT = '/private/tmp/pilot-canvas-no-postgres-safe-root';
const INTERNAL_TOKEN = 'INTERNAL_TOKEN_DO_NOT_ECHO_20260812';
const LEAK_SENTINELS = [
  REPOSITORY_ROOT,
  DATA_ROOT,
  INTERNAL_TOKEN,
  'DATABASE_URL=postgres://secret',
  'PILOT_E2E_BROWSER_CHANNEL=chrome',
  'AB_GOLDEN_PATH_SECRET',
] as const;

const OPTIONS: SharedCanvasNoPostgresRuntimeAcceptanceOptions = {
  repositoryRoot: REPOSITORY_ROOT,
  storyCanvasPort: STORYCANVAS_PORT,
  allowedOrigin: ALLOWED_ORIGIN,
};

const EXPECTED_RESULT: SharedCanvasNoPostgresRuntimeAcceptanceResult = {
  status: 'harness-ready',
  code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY',
  controlApiRequestCount: 2,
  storyCanvasStarted: true,
  storyCanvasStopped: true,
  dataRootRemoved: true,
};

interface FixtureState {
  events: string[];
  generateSecretCalls: number;
  createTemporaryDataRootCalls: number;
  startSyntheticControlApiCalls: number;
  createProcessHarnessCalls: number;
  createStoryCanvasProcessSpecCalls: number;
  processStartCalls: number;
  processStopCalls: number;
  controlCloseCalls: number;
  removeTemporaryDataRootCalls: number;
  processSpecInput?: Readonly<Record<string, unknown>>;
  processSpec?: PilotProcessSpec;
  syntheticInput?: Readonly<Record<string, unknown>>;
  removedRoot?: string;
}

interface Fixture {
  state: FixtureState;
  dependencies: SharedCanvasNoPostgresRuntimeAcceptanceDependencies;
}

function validRuntimeOutput(): PilotProcessOutput {
  return {
    stdout: `PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:${STORYCANVAS_PORT}\nPILOT_CANVAS_RUNTIME_STOPPED\n`,
    stderr: '',
    stdoutTruncated: false,
    stderrTruncated: false,
  };
}

function processSpec(): PilotProcessSpec {
  return {
    command: 'npm',
    args: ['--prefix', 'apps/storycanvas', 'run', 'start:pilot-canvas'],
    cwd: REPOSITORY_ROOT,
    env: {},
    readinessProbe: () => true,
    readinessTimeoutMs: 15_000,
    readinessIntervalMs: 50,
    outputLimitBytes: 64 * 1024,
    stopTimeoutMs: 5_000,
  };
}

function createFixture(
  overrides: Partial<SharedCanvasNoPostgresRuntimeAcceptanceDependencies> = {},
): Fixture {
  const state: FixtureState = {
    events: [],
    generateSecretCalls: 0,
    createTemporaryDataRootCalls: 0,
    startSyntheticControlApiCalls: 0,
    createProcessHarnessCalls: 0,
    createStoryCanvasProcessSpecCalls: 0,
    processStartCalls: 0,
    processStopCalls: 0,
    controlCloseCalls: 0,
    removeTemporaryDataRootCalls: 0,
  };
  let stopped = false;

  const dependencies: SharedCanvasNoPostgresRuntimeAcceptanceDependencies = {
    generateSecret: () => {
      state.generateSecretCalls += 1;
      state.events.push('secret.generate');
      return INTERNAL_TOKEN;
    },
    createTemporaryDataRoot: async () => {
      state.createTemporaryDataRootCalls += 1;
      state.events.push('root.create');
      return DATA_ROOT;
    },
    startSyntheticControlApi: async (input) => {
      state.startSyntheticControlApiCalls += 1;
      state.events.push('control.start');
      state.syntheticInput = input;
      return {
        origin: `http://127.0.0.1:${CONTROL_API_PORT}`,
        port: CONTROL_API_PORT,
        requestCount: () => 2,
        close: async () => {
          state.controlCloseCalls += 1;
          state.events.push('control.close');
        },
      };
    },
    createProcessHarness: () => {
      state.createProcessHarnessCalls += 1;
      state.events.push('harness.create');
      return {
        start: async (spec) => {
          state.processStartCalls += 1;
          state.events.push('harness.start');
          state.processSpec = spec;
          return {
            output: () => {
              state.events.push('managed.output');
              return stopped
                ? validRuntimeOutput()
                : {
                    ...validRuntimeOutput(),
                    stdout: `PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:${STORYCANVAS_PORT}\n`,
                  };
            },
          };
        },
        stop: async () => {
          state.processStopCalls += 1;
          state.events.push('harness.stop');
          stopped = true;
        },
      };
    },
    createStoryCanvasProcessSpec: (input) => {
      state.createStoryCanvasProcessSpecCalls += 1;
      state.events.push('spec.create');
      state.processSpecInput = input;
      return processSpec();
    },
    removeTemporaryDataRoot: async (path) => {
      state.removeTemporaryDataRootCalls += 1;
      state.events.push('root.remove');
      state.removedRoot = path;
    },
    ...overrides,
  };

  return { state, dependencies };
}

function sideEffectCount(state: FixtureState): number {
  return (
    state.generateSecretCalls +
    state.createTemporaryDataRootCalls +
    state.startSyntheticControlApiCalls +
    state.createProcessHarnessCalls +
    state.createStoryCanvasProcessSpecCalls +
    state.processStartCalls +
    state.processStopCalls +
    state.controlCloseCalls +
    state.removeTemporaryDataRootCalls
  );
}

async function assertFixedRejection(
  action: () => Promise<unknown>,
  expectedCode: string,
  forbidden: readonly string[] = LEAK_SENTINELS,
): Promise<void> {
  await assert.rejects(action, (error: unknown) => {
    assert.ok(error instanceof SharedCanvasNoPostgresRuntimeAcceptanceError);
    assert.equal(error.message, expectedCode);
    assert.equal(error.stack, undefined);
    assert.match(error.message, /^[A-Z0-9_]+$/);
    for (const value of forbidden) assert.equal(error.message.includes(value), false);
    return true;
  });
}

test('freezes the exact harness-ready result type without Gate completion fields', () => {
  assert.deepEqual(EXPECTED_RESULT, {
    status: 'harness-ready',
    code: 'A_REM_VAL_3_RUNTIME_HARNESS_READY',
    controlApiRequestCount: 2,
    storyCanvasStarted: true,
    storyCanvasStopped: true,
    dataRootRemoved: true,
  });
  for (const forbidden of [
    'pass',
    'gatePass',
    'jointGatePass',
    'goldenPathComplete',
    'realEditorLoaded',
    'bCapabilityAccepted',
  ]) {
    assert.equal(Object.hasOwn(EXPECTED_RESULT, forbidden), false);
  }
});

test('rejects empty, relative, or filesystem-root repository roots before every dependency side effect', async () => {
  for (const repositoryRoot of ['', '   ', '.', 'relative/repository', '/']) {
    const fixture = createFixture();
    await assertFixedRejection(
      () =>
        runSharedCanvasNoPostgresRuntimeAcceptance(
          { ...OPTIONS, repositoryRoot },
          fixture.dependencies,
        ),
      'SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
      [repositoryRoot],
    );
    assert.equal(sideEffectCount(fixture.state), 0);
  }
});

test('rejects invalid StoryCanvas ports before every dependency side effect', async () => {
  for (const storyCanvasPort of [0, -1, 65_536, Number.NaN, 1.5]) {
    const fixture = createFixture();
    await assertFixedRejection(
      () =>
        runSharedCanvasNoPostgresRuntimeAcceptance(
          { ...OPTIONS, storyCanvasPort },
          fixture.dependencies,
        ),
      'SHARED_CANVAS_RUNTIME_PORT_INVALID',
      [String(storyCanvasPort)],
    );
    assert.equal(sideEffectCount(fixture.state), 0);
  }
});

test('rejects non-origin, credentialed, path, query, fragment, and non-HTTP allowed origins before side effects', async () => {
  const invalidOrigins = [
    '',
    'localhost:5173',
    'file:///tmp/index.html',
    'http://user:secret@127.0.0.1:5173',
    'http://127.0.0.1:5173/path',
    'http://127.0.0.1:5173?secret=value',
    'http://127.0.0.1:5173#fragment',
  ];

  for (const allowedOrigin of invalidOrigins) {
    const fixture = createFixture();
    await assertFixedRejection(
      () =>
        runSharedCanvasNoPostgresRuntimeAcceptance(
          { ...OPTIONS, allowedOrigin },
          fixture.dependencies,
        ),
      'SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
      [allowedOrigin, 'user:secret', 'secret=value'],
    );
    assert.equal(sideEffectCount(fixture.state), 0);
  }
});

test('rejects an unsafe generated secret before creating data roots, servers, or processes', async () => {
  for (const generatedSecret of ['', '   ', 'short']) {
    const fixture = createFixture({ generateSecret: () => generatedSecret });
    await assertFixedRejection(
      () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
      'SHARED_CANVAS_RUNTIME_ACCEPTANCE_CONFIG_INVALID',
      [generatedSecret],
    );
    assert.equal(fixture.state.createTemporaryDataRootCalls, 0);
    assert.equal(fixture.state.startSyntheticControlApiCalls, 0);
    assert.equal(fixture.state.createProcessHarnessCalls, 0);
  }
});

test('rejects relative, root, or repository-contained temporary data roots before starting Control API or processes', async () => {
  for (const dataRoot of ['relative-root', '/', `${REPOSITORY_ROOT}/apps/storycanvas/data`]) {
    const fixture = createFixture({ createTemporaryDataRoot: async () => dataRoot });
    await assertFixedRejection(
      () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
      'SHARED_CANVAS_RUNTIME_DATA_ROOT_INVALID',
      [dataRoot],
    );
    assert.equal(fixture.state.startSyntheticControlApiCalls, 0);
    assert.equal(fixture.state.createProcessHarnessCalls, 0);
    assert.equal(fixture.state.createStoryCanvasProcessSpecCalls, 0);
    assert.equal(fixture.state.removeTemporaryDataRootCalls, 0);
  }
});

test('requires an exact loopback synthetic origin whose URL port equals the handle port', async () => {
  const cases = [
    { origin: `http://localhost:${CONTROL_API_PORT}`, port: CONTROL_API_PORT },
    { origin: `https://127.0.0.1:${CONTROL_API_PORT}`, port: CONTROL_API_PORT },
    { origin: `http://127.0.0.1:${CONTROL_API_PORT}/api`, port: CONTROL_API_PORT },
    { origin: `http://127.0.0.1:${CONTROL_API_PORT + 1}`, port: CONTROL_API_PORT },
    { origin: `http://127.0.0.1:${CONTROL_API_PORT}`, port: CONTROL_API_PORT + 1 },
  ];

  for (const synthetic of cases) {
    const fixture = createFixture({
      startSyntheticControlApi: async () => ({
        ...synthetic,
        requestCount: () => 0,
        close: async () => {
          fixture.state.controlCloseCalls += 1;
          fixture.state.events.push('control.close');
        },
      }),
    });
    await assertFixedRejection(
      () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
      'SHARED_CANVAS_RUNTIME_CONTROL_API_ORIGIN_INVALID',
      [synthetic.origin],
    );
    assert.equal(fixture.state.createProcessHarnessCalls, 0);
    assert.deepEqual(fixture.state.events.slice(-2), ['control.close', 'root.remove']);
  }
});

test('rejects a synthetic Control API port collision before creating or starting a process', async () => {
  const fixture = createFixture({
    startSyntheticControlApi: async () => ({
      origin: `http://127.0.0.1:${STORYCANVAS_PORT}`,
      port: STORYCANVAS_PORT,
      requestCount: () => 0,
      close: async () => {
        fixture.state.controlCloseCalls += 1;
        fixture.state.events.push('control.close');
      },
    }),
  });

  await assertFixedRejection(
    () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
    'SHARED_CANVAS_RUNTIME_PORT_CONFLICT',
  );
  assert.equal(fixture.state.createProcessHarnessCalls, 0);
  assert.equal(fixture.state.createStoryCanvasProcessSpecCalls, 0);
  assert.deepEqual(fixture.state.events.slice(-2), ['control.close', 'root.remove']);
});

test('passes only the minimal non-DB, non-Chrome, non-Golden-Path input into the StoryCanvas process spec factory', async () => {
  const fixture = createFixture();
  await runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies);

  assert.deepEqual(fixture.state.syntheticInput, {
    host: '127.0.0.1',
    port: 0,
    internalToken: INTERNAL_TOKEN,
  });
  assert.deepEqual(fixture.state.processSpecInput, {
    repositoryRoot: REPOSITORY_ROOT,
    controlApiOrigin: `http://127.0.0.1:${CONTROL_API_PORT}`,
    allowedOrigin: ALLOWED_ORIGIN,
    dataRoot: DATA_ROOT,
    internalToken: INTERNAL_TOKEN,
    storyCanvasPort: STORYCANVAS_PORT,
  });

  const keys = Object.keys(fixture.state.processSpecInput ?? {});
  for (const forbidden of [
    'databaseUrl',
    'controlApiTestDatabaseUrl',
    'postgresUrl',
    'browserChannel',
    'chromeExecutable',
    'playwright',
    'goldenPath',
    'runAbGoldenPath',
    'pilotE2eAbGoldenPath',
  ]) {
    assert.equal(keys.includes(forbidden), false);
  }
  assert.equal(fixture.state.processSpec, processSpec());
});

test('returns the exact harness-ready result and cleans up stop then close then remove after validating stopped output', async () => {
  const fixture = createFixture();
  const result = await runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies);

  assert.deepEqual(result, EXPECTED_RESULT);
  assert.deepEqual(fixture.state.events.slice(-4), [
    'harness.stop',
    'managed.output',
    'control.close',
    'root.remove',
  ]);
  assert.equal(fixture.state.processStartCalls, 1);
  assert.equal(fixture.state.processStopCalls, 1);
  assert.equal(fixture.state.controlCloseCalls, 1);
  assert.equal(fixture.state.removeTemporaryDataRootCalls, 1);
  assert.equal(fixture.state.removedRoot, DATA_ROOT);
});

test('maps process start failures to a fixed code and still closes Control API and removes the temporary root', async () => {
  const fixture = createFixture({
    createProcessHarness: () => ({
      start: async () => {
        fixture.state.processStartCalls += 1;
        fixture.state.events.push('harness.start');
        throw new Error(`spawn failed ${INTERNAL_TOKEN} ${DATA_ROOT}`);
      },
      stop: async () => {
        fixture.state.processStopCalls += 1;
        fixture.state.events.push('harness.stop');
      },
    }),
  });

  await assertFixedRejection(
    () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
    'SHARED_CANVAS_RUNTIME_START_FAILED',
  );
  assert.deepEqual(fixture.state.events.slice(-3), [
    'harness.stop',
    'control.close',
    'root.remove',
  ]);
});

test('maps unsafe runtime output to a fixed security code after stop without leaking diagnostics', async () => {
  const fixture = createFixture({
    createProcessHarness: () => ({
      start: async () => ({
        output: () => ({
          stdout: `PILOT_CANVAS_RUNTIME_READY http://127.0.0.1:${STORYCANVAS_PORT}\n${DATA_ROOT}\n`,
          stderr: `Error: ${INTERNAL_TOKEN}\n    at secret (${REPOSITORY_ROOT}/runtime.ts:1:1)`,
          stdoutTruncated: false,
          stderrTruncated: false,
        }),
      }),
      stop: async () => {
        fixture.state.processStopCalls += 1;
        fixture.state.events.push('harness.stop');
      },
    }),
  });

  await assertFixedRejection(
    () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
    'SHARED_CANVAS_RUNTIME_SECURITY_VIOLATION',
  );
  assert.deepEqual(fixture.state.events.slice(-3), [
    'harness.stop',
    'control.close',
    'root.remove',
  ]);
});

test('maps any cleanup failure to one fixed code while attempting every remaining cleanup step in order', async () => {
  const cleanupCases: ReadonlyArray<'stop' | 'close' | 'remove'> = ['stop', 'close', 'remove'];

  for (const failingStep of cleanupCases) {
    const fixture = createFixture({
      createProcessHarness: () => ({
        start: async () => ({ output: validRuntimeOutput }),
        stop: async () => {
          fixture.state.processStopCalls += 1;
          fixture.state.events.push('harness.stop');
          if (failingStep === 'stop') throw new Error(`stop leaked ${INTERNAL_TOKEN}`);
        },
      }),
      startSyntheticControlApi: async () => ({
        origin: `http://127.0.0.1:${CONTROL_API_PORT}`,
        port: CONTROL_API_PORT,
        requestCount: () => 2,
        close: async () => {
          fixture.state.controlCloseCalls += 1;
          fixture.state.events.push('control.close');
          if (failingStep === 'close') throw new Error(`close leaked ${DATA_ROOT}`);
        },
      }),
      removeTemporaryDataRoot: async () => {
        fixture.state.removeTemporaryDataRootCalls += 1;
        fixture.state.events.push('root.remove');
        if (failingStep === 'remove') throw new Error(`remove leaked ${REPOSITORY_ROOT}`);
      },
    });

    await assertFixedRejection(
      () => runSharedCanvasNoPostgresRuntimeAcceptance(OPTIONS, fixture.dependencies),
      'SHARED_CANVAS_RUNTIME_CLEANUP_FAILED',
    );
    assert.deepEqual(fixture.state.events.slice(-3), [
      'harness.stop',
      'control.close',
      'root.remove',
    ]);
    assert.equal(fixture.state.processStopCalls, 1);
    assert.equal(fixture.state.controlCloseCalls, 1);
    assert.equal(fixture.state.removeTemporaryDataRootCalls, 1);
  }
});
