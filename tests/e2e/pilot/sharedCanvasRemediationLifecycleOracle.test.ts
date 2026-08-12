import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SharedCanvasRemediationLifecycleOracleError,
  assertSafeSharedCanvasRemediationLifecycleEvidence,
  type SharedCanvasRemediationLifecycleEvidence,
  type SharedCanvasRemediationLifecycleOracleResult,
} from './sharedCanvasRemediationLifecycleOracle.js';

const INTERNAL_TOKEN = 'INTERNAL_TOKEN_DO_NOT_ECHO_20260812';
const DATA_ROOT = '/private/tmp/pilot-canvas-lifecycle-secret-root';
const AUTHORITY_SECRET = 'RAW_AUTHORITY_DO_NOT_ECHO_20260812';
const LEAK_SENTINELS = [INTERNAL_TOKEN, DATA_ROOT, AUTHORITY_SECRET] as const;

function registryEvents(capacity: number) {
  return [
    { kind: 'authority-issued', activeCount: 1 },
    { kind: 'authority-deduplicated', activeCount: 1 },
    { kind: 'authority-issued', activeCount: 2 },
    { kind: 'expired-observed', activeCount: 2 },
    { kind: 'expired-purged', activeCount: 1 },
    { kind: 'capacity-filled', activeCount: capacity },
    { kind: 'capacity-evicted', activeCount: capacity },
    { kind: 'shutdown-cleared', activeCount: 0 },
  ] as const;
}

function validEvidence(
  overrides: Partial<SharedCanvasRemediationLifecycleEvidence> = {},
): SharedCanvasRemediationLifecycleEvidence {
  return {
    registry: {
      capacity: 2,
      events: registryEvents(2).map((event) => ({ ...event })),
    },
    shutdown: {
      signal: 'SIGTERM',
      durationMs: 4_999,
      registryCleared: true,
      rawAuthorityReadableAfterShutdown: false,
      httpClosed: true,
      socketIoClosed: true,
      webSocketClosed: true,
      pendingTimerCount: 0,
      exitCode: 0,
    },
    ...overrides,
  };
}

async function expectSafeCode(
  action: () => unknown | Promise<unknown>,
  code: string,
  forbidden: readonly string[] = LEAK_SENTINELS,
): Promise<void> {
  await assert.rejects(Promise.resolve().then(action), (error: unknown) => {
    assert.ok(error instanceof SharedCanvasRemediationLifecycleOracleError);
    assert.equal(error.message, code);
    assert.equal(error.stack, undefined);
    assert.match(error.message, /^[A-Z0-9_]+$/);
    for (const value of forbidden) {
      if (value.length === 0) continue;
      assert.equal(error.message.includes(value), false);
    }
    return true;
  });
}

function assertNoGateFields(result: SharedCanvasRemediationLifecycleOracleResult): void {
  for (const forbidden of [
    'pass',
    'gatePass',
    'jointGatePass',
    'goldenPathComplete',
    'realEditorLoaded',
    'bRemediationAccepted',
    'sharedActivationGreen',
  ]) {
    assert.equal(Object.hasOwn(result, forbidden), false);
  }
}

test('accepts the exact bounded lifecycle scenario without declaring remediation or Gate completion', () => {
  const result = assertSafeSharedCanvasRemediationLifecycleEvidence({
    evidence: validEvidence(),
    sensitiveValues: LEAK_SENTINELS,
  });

  assert.deepEqual(result, {
    status: 'oracle-ready',
    code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY',
    registryEventCount: 8,
    shutdownSignal: 'SIGTERM',
    boundedShutdown: true,
  });
  assertNoGateFields(result);
});

test('accepts SIGTERM and SIGINT only when every cleanup surface closes within 5000ms', () => {
  for (const signal of ['SIGTERM', 'SIGINT'] as const) {
    for (const durationMs of [0, 1, 4_999, 5_000]) {
      const evidence = validEvidence();
      evidence.shutdown.signal = signal;
      evidence.shutdown.durationMs = durationMs;
      const result = assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence });
      assert.equal(result.shutdownSignal, signal);
      assert.equal(result.boundedShutdown, true);
    }
  }
});

test('rejects missing, extra, prototype-bearing, cyclic, or getter-based evidence safely', async () => {
  const extra = validEvidence() as SharedCanvasRemediationLifecycleEvidence & {
    rawAuthority?: string;
  };
  extra.rawAuthority = AUTHORITY_SECRET;

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;

  const getter = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(getter, 'registry', {
    enumerable: true,
    get: () => {
      throw new Error(`${INTERNAL_TOKEN} ${DATA_ROOT}`);
    },
  });
  getter.shutdown = validEvidence().shutdown;

  for (const evidence of [null, [], {}, extra, cyclic, getter, new Date()]) {
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID',
    );
  }
});

test('normalizes input getters and reflection traps to the fixed non-leaking evidence code', async () => {
  const getterInput = Object.create(null) as Record<string, unknown>;
  Object.defineProperty(getterInput, 'evidence', {
    enumerable: true,
    get: () => {
      throw new Error(`${INTERNAL_TOKEN} ${DATA_ROOT}`);
    },
  });

  const reflectionTrap = new Proxy(
    {},
    {
      getPrototypeOf: () => {
        throw new Error(`${AUTHORITY_SECRET} ${DATA_ROOT}`);
      },
    },
  );

  for (const input of [getterInput, reflectionTrap]) {
    await expectSafeCode(
      () =>
        assertSafeSharedCanvasRemediationLifecycleEvidence(
          input as unknown as { evidence: unknown },
        ),
      'SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID',
    );
  }
});

test('rejects sparse or property-bearing registry event arrays before accepting lifecycle evidence', async () => {
  const sparse = validEvidence();
  sparse.registry.events = new Array(
    8,
  ) as SharedCanvasRemediationLifecycleEvidence['registry']['events'];

  const propertyBearing = validEvidence();
  Object.defineProperty(propertyBearing.registry.events, 'jointGatePass', {
    enumerable: true,
    value: true,
  });

  const oversized = validEvidence();
  oversized.registry.events.length = 1_000_000_000;

  for (const evidence of [sparse, propertyBearing, oversized]) {
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID',
    );
  }
});

test('accepts any explicit safe capacity while proving fill and deterministic eviction at that bound', () => {
  for (const capacity of [2, 3, 64, 1_024, Number.MAX_SAFE_INTEGER]) {
    const evidence = validEvidence();
    evidence.registry.capacity = capacity;
    evidence.registry.events = registryEvents(capacity).map((event) => ({ ...event }));
    const result = assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence });
    assert.equal(result.registryEventCount, 8);
  }
});

test('requires the exact registry lifecycle sequence without guessing B production capacity', async () => {
  const mutations: Array<(evidence: SharedCanvasRemediationLifecycleEvidence) => void> = [
    (evidence) => {
      evidence.registry.capacity = 0;
    },
    (evidence) => {
      evidence.registry.events.pop();
    },
    (evidence) => {
      evidence.registry.events.reverse();
    },
    (evidence) => {
      evidence.registry.events[1] = { kind: 'authority-issued', activeCount: 1 };
    },
    (evidence) => {
      evidence.registry.events[5] = { kind: 'capacity-filled', activeCount: 1 };
    },
    (evidence) => {
      evidence.registry.events[6] = { kind: 'capacity-evicted', activeCount: 1 };
    },
  ];

  for (const mutate of mutations) {
    const evidence = validEvidence();
    mutate(evidence);
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_REGISTRY_EVIDENCE_INVALID',
    );
  }
});

test('requires every registry count to be a safe non-negative integer bounded by capacity', async () => {
  for (const activeCount of [-1, 1.5, Number.NaN, 3]) {
    const evidence = validEvidence();
    evidence.registry.events[2] = { kind: 'authority-issued', activeCount };
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_REGISTRY_EVIDENCE_INVALID',
      [String(activeCount)],
    );
  }
});

test('requires shutdown to clear the registry and make raw authority unreadable', async () => {
  const cases: Array<(evidence: SharedCanvasRemediationLifecycleEvidence) => void> = [
    (evidence) => {
      evidence.shutdown.registryCleared = false;
    },
    (evidence) => {
      evidence.shutdown.rawAuthorityReadableAfterShutdown = true;
    },
    (evidence) => {
      evidence.registry.events[7] = { kind: 'shutdown-cleared', activeCount: 1 };
    },
  ];

  for (const mutate of cases) {
    const evidence = validEvidence();
    mutate(evidence);
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_REGISTRY_NOT_CLEARED',
    );
  }
});

test('requires HTTP, Socket.IO, and WebSocket shutdown evidence together', async () => {
  for (const field of ['httpClosed', 'socketIoClosed', 'webSocketClosed'] as const) {
    const evidence = validEvidence();
    evidence.shutdown[field] = false;
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_SHUTDOWN_FALSE_SUCCESS',
    );
  }
});

test('rejects shutdown outside the inclusive 0 through 5000ms bound', async () => {
  for (const durationMs of [-1, 5_001, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    const evidence = validEvidence();
    evidence.shutdown.durationMs = durationMs;
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_SHUTDOWN_DURATION_INVALID',
      [String(durationMs)],
    );
  }
});

test('requires zero pending timers after shutdown', async () => {
  for (const pendingTimerCount of [-1, 1, 2, 1.5, Number.NaN]) {
    const evidence = validEvidence();
    evidence.shutdown.pendingTimerCount = pendingTimerCount;
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_SHUTDOWN_TIMER_LEAK',
      [String(pendingTimerCount)],
    );
  }
});

test('rejects false-success exit status and every non-zero exit status', async () => {
  const falseSuccess = validEvidence();
  falseSuccess.shutdown.httpClosed = false;
  falseSuccess.shutdown.exitCode = 0;
  await expectSafeCode(
    () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence: falseSuccess }),
    'SHARED_CANVAS_SHUTDOWN_FALSE_SUCCESS',
  );

  for (const exitCode of [-1, 1, 2, 1.5, Number.NaN]) {
    const evidence = validEvidence();
    evidence.shutdown.exitCode = exitCode;
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_SHUTDOWN_EXIT_INVALID',
      [String(exitCode)],
    );
  }
});

test('rejects unknown signals and malformed shutdown fields without echoing them', async () => {
  for (const signal of ['', 'SIGKILL', 'SIGUSR1', INTERNAL_TOKEN]) {
    const evidence = validEvidence();
    evidence.shutdown.signal = signal as 'SIGTERM';
    await expectSafeCode(
      () => assertSafeSharedCanvasRemediationLifecycleEvidence({ evidence }),
      'SHARED_CANVAS_SHUTDOWN_EVIDENCE_INVALID',
      [signal],
    );
  }
});

test('rejects sensitive values anywhere in raw lifecycle evidence', async () => {
  for (const secret of LEAK_SENTINELS) {
    const evidence = validEvidence() as SharedCanvasRemediationLifecycleEvidence & {
      diagnostics?: string;
    };
    evidence.diagnostics = `shutdown diagnostics: ${secret}`;
    await expectSafeCode(
      () =>
        assertSafeSharedCanvasRemediationLifecycleEvidence({
          evidence,
          sensitiveValues: LEAK_SENTINELS,
        }),
      'SHARED_CANVAS_LIFECYCLE_SENSITIVE_CONTENT',
    );
  }
});
