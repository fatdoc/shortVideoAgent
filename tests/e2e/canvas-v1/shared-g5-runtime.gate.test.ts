import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  createCanvasActivationAttemptId,
  parseCanonicalCanvasRouteSelection,
} from '../../../src/features/canvas-v1/api/index';
import { createPilotStoryCanvasBridge } from '../../../src/services/pilotStoryCanvasBridge';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const activation = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'docs/program/contracts/canvas-v1/fixtures/activation-transport.json'),
    'utf8',
  ),
);
const workspace = JSON.parse(
  fs.readFileSync(
    path.join(rootDir, 'docs/program/contracts/canvas-v1/fixtures/workspace-materialization.json'),
    'utf8',
  ),
).workspaceResponse;

const projectId = activation.activationResponse.entry.projectId;
const packageId = activation.activationResponse.entry.packageId;
const attemptId = activation.activationRequest.activationAttemptId;

test('canonical route requires one explicit lowercase Package UUID and no other query state', () => {
  assert.deepEqual(
    parseCanonicalCanvasRouteSelection({ projectId, search: `?packageId=${packageId}` }),
    { projectId, packageId },
  );

  for (const input of [
    { projectId, search: '' },
    { projectId, search: '?packageId=latest' },
    { projectId, search: `?packageId=${packageId}&packageId=${packageId}` },
    { projectId, search: `?packageId=${packageId}&extra=true` },
    { projectId, search: `?packageId=${packageId}&activationAttemptId=${attemptId}` },
    { projectId: projectId.toUpperCase(), search: `?packageId=${packageId}` },
  ])
    assert.throws(() => parseCanonicalCanvasRouteSelection(input));
});

test('activation attempts are fresh UUIDs and touch no URL, Storage, DOM or console sink', () => {
  const beforeHref = globalThis.location?.href;
  const beforeHistoryLength = globalThis.history?.length;
  const storageWrites: string[] = [];
  const logs: unknown[][] = [];
  const originalLog = console.log;
  const originalLocalSet = globalThis.localStorage?.setItem.bind(globalThis.localStorage);
  const originalSessionSet = globalThis.sessionStorage?.setItem.bind(globalThis.sessionStorage);
  if (globalThis.localStorage)
    globalThis.localStorage.setItem = (key, value) => storageWrites.push(`local:${key}:${value}`);
  if (globalThis.sessionStorage)
    globalThis.sessionStorage.setItem = (key, value) =>
      storageWrites.push(`session:${key}:${value}`);
  console.log = (...values) => logs.push(values);
  try {
    const first = createCanvasActivationAttemptId();
    const second = createCanvasActivationAttemptId();
    assert.match(first, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.match(second, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    assert.notEqual(first, second);
    assert.deepEqual(storageWrites, []);
    assert.deepEqual(logs, []);
    assert.equal(globalThis.location?.href, beforeHref);
    assert.equal(globalThis.history?.length, beforeHistoryLength);
    assert.equal(globalThis.document?.body.textContent?.includes(first), false);
  } finally {
    console.log = originalLog;
    if (globalThis.localStorage && originalLocalSet)
      globalThis.localStorage.setItem = originalLocalSet;
    if (globalThis.sessionStorage && originalSessionSet)
      globalThis.sessionStorage.setItem = originalSessionSet;
  }
});

function bridgePort(overrides: Record<string, unknown> = {}) {
  const calls: Array<{ name: string; args: unknown[] }> = [];
  const method =
    (name: string, result: unknown) =>
    async (...args: unknown[]) => {
      calls.push({ name, args });
      return structuredClone(result);
    };
  return {
    calls,
    port: {
      acquireControlCsrf: method('acquireControlCsrf', 'csrf-safe-value'),
      activate: method('activate', activation.activationResponse),
      openLegacy: method('openLegacy', activation.legacyOpenResponse),
      readBootstrap: method('readBootstrap', activation.formalBootstrapResponse),
      readWorkspace: method('readWorkspace', workspace),
      readDocument: method('readDocument', workspace.document),
      readAssets: method('readAssets', workspace.assets),
      readReadiness: method('readReadiness', workspace.shots[0].readiness),
      prepareApproval: method('prepareApproval', activation.approvalPrepareResponse),
      dispatch: method('dispatch', workspace.shots[0].event),
      ...overrides,
    },
  };
}

test('bridge performs activation, exact four-field open, formal bootstrap and workspace in order', async () => {
  const harness = bridgePort();
  const bridge = createPilotStoryCanvasBridge({ port: harness.port });
  const result = await bridge.activate({ projectId, packageId, activationAttemptId: attemptId });

  assert.deepEqual(
    harness.calls.map(({ name }) => name),
    ['acquireControlCsrf', 'activate', 'openLegacy', 'readBootstrap', 'readWorkspace'],
  );
  assert.deepEqual(harness.calls[2].args[0], activation.legacyOpenRequest);
  assert.equal(result.canvasSessionId, activation.legacyOpenResponse.canvasSessionId);
  assert.equal(result.csrfToken, 'csrf-safe-value');
  assert.deepEqual(result.workspace, workspace);
});

test('strict response parsing rejects unknown fields and stops before downstream dispatch', async () => {
  const poisoned = { ...activation.activationResponse, unexpected: true };
  const harness = bridgePort({
    activate: async (...args: unknown[]) => {
      harness.calls.push({ name: 'activate', args });
      return poisoned;
    },
  });
  const bridge = createPilotStoryCanvasBridge({ port: harness.port });

  await assert.rejects(bridge.activate({ projectId, packageId, activationAttemptId: attemptId }));
  assert.deepEqual(
    harness.calls.map(({ name }) => name),
    ['acquireControlCsrf', 'activate'],
  );
});

test('scope poison in formal bootstrap or workspace fails closed without defaults', async () => {
  for (const poisonedMethod of ['readBootstrap', 'readWorkspace'] as const) {
    const base =
      poisonedMethod === 'readBootstrap' ? activation.formalBootstrapResponse : workspace;
    const harness = bridgePort({
      [poisonedMethod]: async (...args: unknown[]) => {
        harness.calls.push({ name: poisonedMethod, args });
        return { ...structuredClone(base), packageId: '30303030-3030-4030-8030-303030303030' };
      },
    });
    const bridge = createPilotStoryCanvasBridge({ port: harness.port });
    await assert.rejects(bridge.activate({ projectId, packageId, activationAttemptId: attemptId }));
    assert.equal(
      harness.calls.some(({ name }) => name === 'prepareApproval'),
      false,
    );
    assert.equal(
      harness.calls.some(({ name }) => name === 'dispatch'),
      false,
    );
  }
});

test('approval and dispatch pass through the same complete command object', async () => {
  const harness = bridgePort();
  const bridge = createPilotStoryCanvasBridge({ port: harness.port });
  const pending = structuredClone(activation.commandDispatchRequest);
  const action = { commandId: pending.commandId, payload: pending.payload };
  const approvalRequest = { ...activation.approvalPrepareRequest, action };

  const approval = await bridge.prepareApproval(projectId, approvalRequest, 'csrf-safe-value');
  const command = { ...pending, approvalId: approval.approvalId };
  await bridge.dispatch(command);

  const prepare = harness.calls.find(({ name }) => name === 'prepareApproval');
  const dispatch = harness.calls.find(({ name }) => name === 'dispatch');
  assert.deepEqual(prepare?.args, [projectId, approvalRequest, 'csrf-safe-value']);
  assert.strictEqual(dispatch?.args[0], command);
  assert.deepEqual(action, { commandId: command.commandId, payload: command.payload });
});

test('refresh reads workspace/document/assets/readiness through the shared session-bound port', async () => {
  const harness = bridgePort();
  const bridge = createPilotStoryCanvasBridge({ port: harness.port });
  await bridge.refresh({
    canvasSessionId: workspace.canvasSessionId,
    documentId: workspace.document.documentId,
    shotId: workspace.shots[0].shotId,
  });
  assert.deepEqual(
    harness.calls.map(({ name }) => name),
    ['readWorkspace', 'readDocument', 'readAssets', 'readReadiness'],
  );
});
