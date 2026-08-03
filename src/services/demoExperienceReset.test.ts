import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryCanvasTransportState } from '../domain/controlPlane';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { controlPlaneMockAdapter } from './controlPlaneMockAdapter';
import { resetDemoExperienceTransaction } from './demoExperienceReset';
import { loadWorkspace, saveWorkspace } from './storage';
import { storyCanvasBridge } from './storyCanvasBridge';

const TEST_NOW = new Date('2026-08-03T12:00:00.000Z');

function prepareDirtyExperience() {
  const canonicalWorkspace = cloneDemoWorkspace();
  saveWorkspace(canonicalWorkspace);
  controlPlaneMockAdapter.resetDemoReady(canonicalWorkspace);
  const run = controlPlaneMockAdapter.runCanonicalSuccess();
  const productionPackage = controlPlaneMockAdapter.getState().package;
  if (!productionPackage) throw new Error('Expected canonical package.');

  const transport: StoryCanvasTransportState = {
    ...storyCanvasBridge.getState(),
    phase: 'accepted',
    connected: true,
    retryCount: 2,
    lastAttemptAt: '2026-08-03T11:58:00.000Z',
    lastConnectedAt: '2026-08-03T11:58:01.000Z',
    deepLink: `http://localhost:50188/project/${productionPackage.projectId}`,
    packageId: productionPackage.packageId,
    projectId: productionPackage.projectId,
    lastError: null,
  };
  storyCanvasBridge.restoreState(transport);

  const dirtyWorkspace = cloneDemoWorkspace();
  dirtyWorkspace.activeScriptId = 'script-c';
  saveWorkspace(dirtyWorkspace);

  return {
    dirtyWorkspace,
    controlPlane: controlPlaneMockAdapter.getState(),
    transport: storyCanvasBridge.getState(),
    run,
  };
}

describe('resetDemoExperienceTransaction', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    const workspace = cloneDemoWorkspace();
    saveWorkspace(workspace);
    controlPlaneMockAdapter.resetDemoReady(workspace);
    storyCanvasBridge.resetOffline();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('restores the canonical workspace and clears runtime delivery evidence', async () => {
    const previous = prepareDirtyExperience();
    expect(previous.controlPlane.package).not.toBeNull();
    expect(previous.controlPlane.grants).toHaveLength(1);
    expect(previous.controlPlane.generationTaskReceipts).toHaveLength(1);
    expect(previous.controlPlane.assetReceipts).toHaveLength(1);
    expect(previous.run.sourceChain.assetReceipt).not.toBeNull();

    const result = await resetDemoExperienceTransaction();

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    expect(result.stateName).toBe('DEMO_READY');
    expect(result.workspace.activeScriptId).toBe('script-a');
    expect(loadWorkspace()?.activeScriptId).toBe('script-a');
    expect(result.controlPlane).toMatchObject({
      stateName: 'DEMO_READY',
      package: null,
      grants: [],
      generationTaskReceipts: [],
      assetReceipts: [],
      exportReceipts: [],
      transport: {
        phase: 'offline',
        connected: false,
        retryCount: 0,
        lastAttemptAt: null,
        lastConnectedAt: null,
        deepLink: null,
        packageId: null,
        projectId: null,
        lastError: null,
      },
    });
    expect(result.controlPlane.commercial.creditState).toMatchObject({
      wallet: {
        available: { value: 1000 },
        reserved: { value: 0 },
      },
      reservations: [],
    });
    expect(storyCanvasBridge.getState()).toMatchObject({
      phase: 'offline',
      connected: false,
      packageId: null,
      projectId: null,
      deepLink: null,
      lastError: null,
    });
    expect(storyCanvasBridge.getHandoffState()).toMatchObject({
      status: 'closed',
      openedAt: null,
      expiresAt: null,
      readyAt: null,
      error: null,
    });
  });

  it('rolls back workspace, adapter state, and transport when reset fails', async () => {
    const previous = prepareDirtyExperience();
    vi.spyOn(controlPlaneMockAdapter, 'resetDemoReady').mockImplementationOnce(() => {
      throw new Error('forced reset failure');
    });

    const result = await resetDemoExperienceTransaction();

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('Expected RESET_FAILED.');
    expect(result.stateName).toBe('RESET_FAILED');
    expect(result.error).toMatchObject({
      code: 'CONTRACT_VALIDATION_FAILED',
      message: 'forced reset failure',
      retryable: true,
    });
    expect(loadWorkspace()).toEqual(previous.dirtyWorkspace);
    expect(result.workspace).toEqual(previous.dirtyWorkspace);
    expect(controlPlaneMockAdapter.getState()).toEqual(previous.controlPlane);
    expect(result.controlPlane).toEqual(previous.controlPlane);
    expect(storyCanvasBridge.getState()).toEqual(previous.transport);
    expect(result.controlPlane.stateName).not.toBe('DEMO_READY');
  });
});
