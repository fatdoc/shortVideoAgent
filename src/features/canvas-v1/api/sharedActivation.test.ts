import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { CanvasCommandV01 } from '../model/contracts';
import {
  createCanvasActivationAttemptId,
  createPilotStoryCanvasHttpPort,
  parseCanvasActivationResponse,
  parseCanonicalCanvasRouteSelection,
  parseFormalCanvasBootstrap,
  parseFormalCanvasWorkspace,
  parseLegacyCanvasOpenResponse,
} from './index';

const activation = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'docs/program/contracts/canvas-v1/fixtures/activation-transport.json'),
    'utf8',
  ),
) as Record<string, any>;
const workspace = JSON.parse(
  readFileSync(
    resolve(process.cwd(), 'docs/program/contracts/canvas-v1/fixtures/workspace-materialization.json'),
    'utf8',
  ),
) as Record<string, any>;

const projectId = '22222222-2222-4222-8222-222222222222';
const packageId = '33333333-3333-4333-8333-333333333333';
const attemptId = '90909090-9090-4090-8090-909090909090';
const canvasSessionId = 'pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678';

function json(value: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json', ...init.headers },
    ...init,
  });
}

describe('G5 Shared activation transport 25-vector RED', () => {
  it('01 accepts only the canonical explicit project/package selection', () => {
    expect(parseCanonicalCanvasRouteSelection({ projectId, search: `?packageId=${packageId}` })).toEqual({
      projectId,
      packageId,
    });
  });

  it('02 rejects a missing package query', () => {
    expect(() => parseCanonicalCanvasRouteSelection({ projectId, search: '' })).toThrow(
      'CANVAS_ACTIVATION_PACKAGE_REQUIRED',
    );
  });

  it('03 rejects latest as a package selector', () => {
    expect(() => parseCanonicalCanvasRouteSelection({ projectId, search: '?packageId=latest' })).toThrow(
      'CANVAS_ACTIVATION_PACKAGE_INVALID',
    );
  });

  it('04 rejects duplicate package selectors even when their values match', () => {
    expect(() =>
      parseCanonicalCanvasRouteSelection({
        projectId,
        search: `?packageId=${packageId}&packageId=${packageId}`,
      }),
    ).toThrow('CANVAS_ACTIVATION_INPUT_INVALID');
  });

  it('05 rejects unknown query fields', () => {
    expect(() =>
      parseCanonicalCanvasRouteSelection({ projectId, search: `?packageId=${packageId}&latest=true` }),
    ).toThrow('CANVAS_ACTIVATION_INPUT_INVALID');
  });

  it('06 contains activationAttemptId outside URL/query', () => {
    expect(() =>
      parseCanonicalCanvasRouteSelection({
        projectId,
        search: `?packageId=${packageId}&activationAttemptId=${attemptId}`,
      }),
    ).toThrow('CANVAS_ACTIVATION_INPUT_INVALID');
  });

  it('07 rejects a non-canonical project route parameter', () => {
    expect(() =>
      parseCanonicalCanvasRouteSelection({ projectId: projectId.toUpperCase(), search: `?packageId=${packageId}` }),
    ).toThrow('CANVAS_ACTIVATION_PROJECT_INVALID');
  });

  it('08 creates a page-memory canonical UUID without storage or logging', () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(createCanvasActivationAttemptId(() => attemptId)).toBe(attemptId);
    expect(log).not.toHaveBeenCalled();
  });

  it('09 rejects a non-canonical activation attempt source', () => {
    expect(() => createCanvasActivationAttemptId(() => 'latest')).toThrow(
      'CANVAS_ACTIVATION_INPUT_INVALID',
    );
  });

  it('10 parses the exact activation response', () => {
    expect(
      parseCanvasActivationResponse(activation.activationResponse, { projectId, packageId }),
    ).toEqual(activation.activationResponse);
  });

  it('11 rejects server-derived idempotency authority in the activation response', () => {
    expect(() =>
      parseCanvasActivationResponse(
        { ...activation.activationResponse, derivedIdempotencyKey: 'server-only' },
        { projectId, packageId },
      ),
    ).toThrow('CANVAS_BROWSER_PROJECTION_UNSAFE');
  });

  it('12 rejects activation scope drift', () => {
    expect(() =>
      parseCanvasActivationResponse(
        {
          ...activation.activationResponse,
          entry: { ...activation.activationResponse.entry, packageId: projectId },
        },
        { projectId, packageId },
      ),
    ).toThrow('CANVAS_ACTIVATION_SCOPE_MISMATCH');
  });

  it('13 rejects a second replay authority in headers', () => {
    expect(() =>
      parseCanvasActivationResponse(
        activation.activationResponse,
        { projectId, packageId },
        'true',
      ),
    ).toThrow('CANVAS_ACTIVATION_RESPONSE_INVALID');
  });

  it('14 parses legacy open separately from formal bootstrap', () => {
    expect(parseLegacyCanvasOpenResponse(activation.legacyOpenResponse, { projectId, packageId })).toEqual(
      activation.legacyOpenResponse,
    );
  });

  it('15 rejects a formal-bootstrap discriminator in legacy open', () => {
    expect(() =>
      parseLegacyCanvasOpenResponse(
        { ...activation.legacyOpenResponse, schemaVersion: 'CanvasBootstrap/0.1' },
        { projectId, packageId },
      ),
    ).toThrow('PILOT_CANVAS_BOOTSTRAP_INVALID');
  });

  it('16 parses formal CanvasBootstrap/0.1 under exact scope', () => {
    expect(
      parseFormalCanvasBootstrap(activation.formalBootstrapResponse, {
        projectId,
        packageId,
        canvasSessionId,
      }),
    ).toEqual(activation.formalBootstrapResponse);
  });

  it('17 rejects legacy open as formal bootstrap', () => {
    expect(() =>
      parseFormalCanvasBootstrap(activation.legacyOpenResponse, {
        projectId,
        packageId,
        canvasSessionId,
      }),
    ).toThrow('CANVAS_SCHEMA_INVALID');
  });

  it('18 rejects formal bootstrap package drift', () => {
    expect(() =>
      parseFormalCanvasBootstrap(
        { ...activation.formalBootstrapResponse, packageId: projectId },
        { projectId, packageId, canvasSessionId },
      ),
    ).toThrow('CANVAS_SCOPE_MISMATCH');
  });

  it('19 parses the complete formal workspace', () => {
    expect(
      parseFormalCanvasWorkspace(workspace.workspaceResponse, {
        projectId,
        packageId,
        canvasSessionId,
      }),
    ).toEqual(workspace.workspaceResponse);
  });

  it('20 rejects workspace/session mismatch', () => {
    expect(() =>
      parseFormalCanvasWorkspace(workspace.workspaceResponse, {
        projectId,
        packageId,
        canvasSessionId: 'pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321',
      }),
    ).toThrow('CANVAS_WORKSPACE_SCOPE_MISMATCH');
  });

  it('21 acquires Control CSRF only from the existing safe-read response header', async () => {
    const fetchImpl = vi.fn(async () =>
      json({ assets: [] }, { headers: { 'x-csrf-token': 'A'.repeat(43) } }),
    );
    await expect(createPilotStoryCanvasHttpPort({ fetchImpl }).acquireControlCsrf(projectId)).resolves.toBe(
      'A'.repeat(43),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      `/api/v1/projects/${projectId}/canvas-assets`,
      expect.objectContaining({ method: 'GET', credentials: 'same-origin' }),
    );
  });

  it('22 sends strict activation without a browser Idempotency-Key', async () => {
    const fetchImpl = vi.fn(async () => json(activation.activationResponse));
    await createPilotStoryCanvasHttpPort({ fetchImpl }).activate(
      projectId,
      packageId,
      { activationAttemptId: attemptId },
      'A'.repeat(43),
    );
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', body: JSON.stringify({ activationAttemptId: attemptId }) });
    expect(new Headers(init?.headers).has('idempotency-key')).toBe(false);
  });

  it('23 projects exactly four fields into legacy open', async () => {
    const fetchImpl = vi.fn(async () => json(activation.legacyOpenResponse));
    await createPilotStoryCanvasHttpPort({ fetchImpl }).openLegacy(activation.legacyOpenRequest);
    const [, init] = fetchImpl.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toEqual(activation.legacyOpenRequest);
  });

  it('24 reads formal bootstrap/workspace with the explicit pcs header and no body', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(activation.formalBootstrapResponse))
      .mockResolvedValueOnce(json(workspace.workspaceResponse));
    const port = createPilotStoryCanvasHttpPort({ fetchImpl });
    await port.readBootstrap(canvasSessionId, { projectId, packageId });
    await port.readWorkspace(canvasSessionId, { projectId, packageId });
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin' });
      expect(init?.body).toBeUndefined();
      expect(new Headers(init?.headers).get('x-canvas-session-id')).toBe(canvasSessionId);
    }
  });

  it('25 binds approval TTL/action and dispatches the unchanged strict command', async () => {
    const command = activation.commandDispatchRequest as CanvasCommandV01;
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(json(activation.approvalPrepareResponse))
      .mockResolvedValueOnce(json({ event: workspace.workspaceResponse.shots[0].event, requestId: 'req-dispatch-1' }));
    const port = createPilotStoryCanvasHttpPort({ fetchImpl });
    await port.prepareApproval(
      projectId,
      {
        packageId,
        canvasSessionId,
        commandType: 'GENERATE_SHOT',
        action: { commandId: command.commandId, payload: command.payload },
        expiresInSeconds: 60,
        replayPolicy: 'single_use_replay_same_command',
      },
      'A'.repeat(43),
    );
    await port.dispatch(command);
    expect(JSON.parse(String(fetchImpl.mock.calls[0]![1]?.body))).toEqual({
      packageId,
      canvasSessionId,
      commandType: 'GENERATE_SHOT',
      action: { commandId: command.commandId, payload: command.payload },
      expiresInSeconds: 60,
      replayPolicy: 'single_use_replay_same_command',
    });
    expect(JSON.parse(String(fetchImpl.mock.calls[1]![1]?.body))).toEqual(command);
  });
});
