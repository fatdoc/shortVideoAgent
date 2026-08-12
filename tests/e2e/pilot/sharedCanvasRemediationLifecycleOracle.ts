export type SharedCanvasRegistryLifecycleEventKind =
  | 'authority-issued'
  | 'authority-deduplicated'
  | 'expired-observed'
  | 'expired-purged'
  | 'capacity-evicted'
  | 'shutdown-cleared';

export interface SharedCanvasRegistryLifecycleEvent {
  kind: SharedCanvasRegistryLifecycleEventKind;
  activeCount: number;
}

export interface SharedCanvasRemediationLifecycleEvidence {
  registry: {
    capacity: number;
    events: SharedCanvasRegistryLifecycleEvent[];
  };
  shutdown: {
    signal: 'SIGTERM' | 'SIGINT';
    durationMs: number;
    registryCleared: boolean;
    rawAuthorityReadableAfterShutdown: boolean;
    httpClosed: boolean;
    socketIoClosed: boolean;
    webSocketClosed: boolean;
    pendingTimerCount: number;
    exitCode: number;
  };
}

export interface SharedCanvasRemediationLifecycleOracleInput {
  evidence: unknown;
  sensitiveValues?: readonly string[];
}

export interface SharedCanvasRemediationLifecycleOracleResult {
  status: 'oracle-ready';
  code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY';
  registryEventCount: 8;
  shutdownSignal: 'SIGTERM' | 'SIGINT';
  boundedShutdown: true;
}

export type SharedCanvasRemediationLifecycleOracleErrorCode =
  | 'SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID'
  | 'SHARED_CANVAS_LIFECYCLE_SENSITIVE_CONTENT'
  | 'SHARED_CANVAS_REGISTRY_EVIDENCE_INVALID'
  | 'SHARED_CANVAS_REGISTRY_NOT_CLEARED'
  | 'SHARED_CANVAS_SHUTDOWN_EVIDENCE_INVALID'
  | 'SHARED_CANVAS_SHUTDOWN_FALSE_SUCCESS'
  | 'SHARED_CANVAS_SHUTDOWN_DURATION_INVALID'
  | 'SHARED_CANVAS_SHUTDOWN_TIMER_LEAK'
  | 'SHARED_CANVAS_SHUTDOWN_EXIT_INVALID';

export class SharedCanvasRemediationLifecycleOracleError extends Error {
  constructor(readonly code: SharedCanvasRemediationLifecycleOracleErrorCode) {
    super(code);
    this.name = 'SharedCanvasRemediationLifecycleOracleError';
    this.stack = undefined;
  }
}

const MAX_EVIDENCE_NODES = 256;
const MAX_EVIDENCE_DEPTH = 8;
const MAX_EVIDENCE_STRING_LENGTH = 4_096;
const EXPECTED_REGISTRY_EVENTS = [
  { kind: 'authority-issued', activeCount: 1 },
  { kind: 'authority-deduplicated', activeCount: 1 },
  { kind: 'authority-issued', activeCount: 2 },
  { kind: 'expired-observed', activeCount: 2 },
  { kind: 'expired-purged', activeCount: 1 },
  { kind: 'authority-issued', activeCount: 2 },
  { kind: 'capacity-evicted', activeCount: 2 },
  { kind: 'shutdown-cleared', activeCount: 0 },
] as const;

function fail(code: SharedCanvasRemediationLifecycleOracleErrorCode): never {
  throw new SharedCanvasRemediationLifecycleOracleError(code);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownKeysExactly(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Reflect.ownKeys(record);
  return (
    keys.length === expected.length &&
    keys.every((key) => typeof key === 'string' && expected.includes(key))
  );
}

function ownDataValues(record: object, expected: readonly string[]): Record<string, unknown> {
  const descriptors = Object.getOwnPropertyDescriptors(record);
  const values: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
  for (const key of expected) {
    const descriptor = descriptors[key];
    if (
      descriptor === undefined ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !Object.hasOwn(descriptor, 'value')
    ) {
      fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    }
    values[key] = descriptor.value;
  }
  return values;
}

function normalizedSensitiveValues(values: readonly string[] | undefined): readonly string[] {
  if (values === undefined) return [];
  if (!Array.isArray(values)) fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');

  const normalized: string[] = [];
  for (const value of values) {
    if (
      typeof value !== 'string' ||
      value.length < 8 ||
      value.length > MAX_EVIDENCE_STRING_LENGTH
    ) {
      fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    }
    normalized.push(value);
  }
  return normalized;
}

function inspectRawEvidence(value: unknown, sensitiveValues: readonly string[]): void {
  const active = new Set<object>();
  let visitedNodes = 0;

  const visit = (current: unknown, depth: number): void => {
    visitedNodes += 1;
    if (visitedNodes > MAX_EVIDENCE_NODES || depth > MAX_EVIDENCE_DEPTH) {
      fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    }

    if (typeof current === 'string') {
      if (current.length > MAX_EVIDENCE_STRING_LENGTH) {
        fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
      }
      if (sensitiveValues.some((secret) => current.includes(secret))) {
        fail('SHARED_CANVAS_LIFECYCLE_SENSITIVE_CONTENT');
      }
      return;
    }
    if (
      current === null ||
      typeof current === 'boolean' ||
      typeof current === 'number' ||
      typeof current === 'undefined'
    ) {
      return;
    }
    if (typeof current !== 'object') fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');

    const object = current as object;
    if (active.has(object)) fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    if (!Array.isArray(object) && !isPlainRecord(object)) {
      fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    }

    active.add(object);
    try {
      const descriptors = Object.getOwnPropertyDescriptors(object);
      for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== 'string') fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
        if (key.length > MAX_EVIDENCE_STRING_LENGTH) {
          fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
        }
        if (sensitiveValues.some((secret) => key.includes(secret))) {
          fail('SHARED_CANVAS_LIFECYCLE_SENSITIVE_CONTENT');
        }
        const descriptor = descriptors[key];
        if (
          descriptor === undefined ||
          descriptor.get !== undefined ||
          descriptor.set !== undefined ||
          !Object.hasOwn(descriptor, 'value')
        ) {
          fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
        }
        visit(descriptor.value, depth + 1);
      }
    } finally {
      active.delete(object);
    }
  };

  visit(value, 0);
}

function parseEvidence(value: unknown): SharedCanvasRemediationLifecycleEvidence {
  if (!isPlainRecord(value) || !ownKeysExactly(value, ['registry', 'shutdown'])) {
    fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  }

  const evidenceValues = ownDataValues(value, ['registry', 'shutdown']);
  const registry = evidenceValues.registry;
  const shutdown = evidenceValues.shutdown;
  if (
    !isPlainRecord(registry) ||
    !ownKeysExactly(registry, ['capacity', 'events']) ||
    !isPlainRecord(shutdown) ||
    !ownKeysExactly(shutdown, [
      'signal',
      'durationMs',
      'registryCleared',
      'rawAuthorityReadableAfterShutdown',
      'httpClosed',
      'socketIoClosed',
      'webSocketClosed',
      'pendingTimerCount',
      'exitCode',
    ])
  ) {
    fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  }

  const registryValues = ownDataValues(registry, ['capacity', 'events']);
  const shutdownKeys = [
    'signal',
    'durationMs',
    'registryCleared',
    'rawAuthorityReadableAfterShutdown',
    'httpClosed',
    'socketIoClosed',
    'webSocketClosed',
    'pendingTimerCount',
    'exitCode',
  ] as const;
  const shutdownValues = ownDataValues(shutdown, shutdownKeys);
  const events = registryValues.events;
  if (!Array.isArray(events) || events.length > EXPECTED_REGISTRY_EVENTS.length) {
    fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  }
  const expectedArrayKeys = [
    ...Array.from({ length: events.length }, (_, index) => String(index)),
    'length',
  ];
  if (!ownKeysExactly(events as unknown as Record<string, unknown>, expectedArrayKeys)) {
    fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  }

  const eventDescriptors = Object.getOwnPropertyDescriptors(events);
  const parsedEvents: SharedCanvasRegistryLifecycleEvent[] = [];
  for (let index = 0; index < events.length; index += 1) {
    const descriptor = eventDescriptors[String(index)];
    if (
      descriptor === undefined ||
      descriptor.get !== undefined ||
      descriptor.set !== undefined ||
      !Object.hasOwn(descriptor, 'value')
    ) {
      fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    }
    const event = descriptor.value;
    if (!isPlainRecord(event) || !ownKeysExactly(event, ['kind', 'activeCount'])) {
      fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
    }
    const eventValues = ownDataValues(event, ['kind', 'activeCount']);
    parsedEvents.push(eventValues as unknown as SharedCanvasRegistryLifecycleEvent);
  }

  return {
    registry: {
      capacity: registryValues.capacity as number,
      events: parsedEvents,
    },
    shutdown: shutdownValues as unknown as SharedCanvasRemediationLifecycleEvidence['shutdown'],
  };
}

function parseInput(value: unknown): SharedCanvasRemediationLifecycleOracleInput {
  if (!isPlainRecord(value)) fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  const keys = Reflect.ownKeys(value);
  if (
    keys.some((key) => typeof key !== 'string') ||
    (keys.length !== 1 && keys.length !== 2) ||
    !keys.includes('evidence') ||
    (keys.length === 2 && !keys.includes('sensitiveValues'))
  ) {
    fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  }
  const values = ownDataValues(
    value,
    keys.length === 2 ? ['evidence', 'sensitiveValues'] : ['evidence'],
  );
  return {
    evidence: values.evidence,
    ...(keys.length === 2
      ? { sensitiveValues: values.sensitiveValues as readonly string[] | undefined }
      : {}),
  };
}

function assertRegistryEvidence(evidence: SharedCanvasRemediationLifecycleEvidence): void {
  if (evidence.registry.capacity !== 2 || evidence.registry.events.length !== 8) {
    fail('SHARED_CANVAS_REGISTRY_EVIDENCE_INVALID');
  }

  if (
    evidence.shutdown.registryCleared !== true ||
    evidence.shutdown.rawAuthorityReadableAfterShutdown !== false
  ) {
    fail('SHARED_CANVAS_REGISTRY_NOT_CLEARED');
  }

  for (let index = 0; index < EXPECTED_REGISTRY_EVENTS.length; index += 1) {
    const actual = evidence.registry.events[index];
    const expected = EXPECTED_REGISTRY_EVENTS[index];
    if (index === 7 && actual?.kind === 'shutdown-cleared' && actual.activeCount !== 0) {
      fail('SHARED_CANVAS_REGISTRY_NOT_CLEARED');
    }
    if (
      actual === undefined ||
      !Number.isSafeInteger(actual.activeCount) ||
      actual.activeCount < 0 ||
      actual.activeCount > evidence.registry.capacity ||
      actual.kind !== expected.kind ||
      actual.activeCount !== expected.activeCount
    ) {
      fail('SHARED_CANVAS_REGISTRY_EVIDENCE_INVALID');
    }
  }
}

function assertShutdownEvidence(evidence: SharedCanvasRemediationLifecycleEvidence): void {
  const shutdown = evidence.shutdown;
  if (shutdown.signal !== 'SIGTERM' && shutdown.signal !== 'SIGINT') {
    fail('SHARED_CANVAS_SHUTDOWN_EVIDENCE_INVALID');
  }
  if (
    !Number.isSafeInteger(shutdown.durationMs) ||
    shutdown.durationMs < 0 ||
    shutdown.durationMs > 5_000
  ) {
    fail('SHARED_CANVAS_SHUTDOWN_DURATION_INVALID');
  }
  if (!Number.isSafeInteger(shutdown.pendingTimerCount) || shutdown.pendingTimerCount !== 0) {
    fail('SHARED_CANVAS_SHUTDOWN_TIMER_LEAK');
  }
  if (!Number.isSafeInteger(shutdown.exitCode) || shutdown.exitCode !== 0) {
    fail('SHARED_CANVAS_SHUTDOWN_EXIT_INVALID');
  }
  if (
    shutdown.httpClosed !== true ||
    shutdown.socketIoClosed !== true ||
    shutdown.webSocketClosed !== true
  ) {
    fail('SHARED_CANVAS_SHUTDOWN_FALSE_SUCCESS');
  }
}

export function assertSafeSharedCanvasRemediationLifecycleEvidence(
  input: SharedCanvasRemediationLifecycleOracleInput,
): SharedCanvasRemediationLifecycleOracleResult {
  try {
    const parsedInput = parseInput(input);
    const sensitiveValues = normalizedSensitiveValues(parsedInput.sensitiveValues);
    inspectRawEvidence(parsedInput.evidence, sensitiveValues);
    const evidence = parseEvidence(parsedInput.evidence);
    assertRegistryEvidence(evidence);
    assertShutdownEvidence(evidence);

    return {
      status: 'oracle-ready',
      code: 'A_REM_VAL_4_LIFECYCLE_ORACLE_READY',
      registryEventCount: 8,
      shutdownSignal: evidence.shutdown.signal,
      boundedShutdown: true,
    };
  } catch (error) {
    if (error instanceof SharedCanvasRemediationLifecycleOracleError) throw error;
    fail('SHARED_CANVAS_LIFECYCLE_EVIDENCE_INVALID');
  }
}
