import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReceiptSyncResult, StoryCanvasTransportState } from '../domain/controlPlane';
import { DEMO_TENANT_ORGANIZATION_ID } from '../mocks/controlPlaneDemo';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { resolveActiveOrganization } from '../services/activeOrganization';
import { controlPlaneMockAdapter } from '../services/controlPlaneMockAdapter';
import { saveWorkspace } from '../services/storage';
import { storyCanvasBridge, type SendPackageResult } from '../services/storyCanvasBridge';
import { useControlPlaneStore } from './controlPlaneStore';
import { resetDemoExperience } from './demoExperienceStore';
import { useProjectStore } from './projectStore';

const TEST_NOW = new Date('2026-08-03T12:00:00.000Z');

function resetStores() {
  const workspace = cloneDemoWorkspace();
  saveWorkspace(workspace);
  controlPlaneMockAdapter.resetDemoReady(workspace);
  storyCanvasBridge.resetOffline();
  const snapshot = controlPlaneMockAdapter.getState();
  useProjectStore.setState({
    workspace,
    loading: false,
    error: null,
    hydrated: true,
    lastAction: null,
  });
  useControlPlaneStore.setState({
    snapshot,
    loading: false,
    error: null,
    lastAction: null,
    lastSourceChain: null,
    bootstrapResult: storyCanvasBridge.bootstrap(),
    lastPackageDispatch: null,
    lastReceiptSync: null,
    handoffState: storyCanvasBridge.getHandoffState(),
    activeOrganization: resolveActiveOrganization(snapshot, DEMO_TENANT_ORGANIZATION_ID),
  });
}

function prepareRuntimeEvidence() {
  const run = controlPlaneMockAdapter.runCanonicalSuccess();
  const snapshot = controlPlaneMockAdapter.getState();
  const productionPackage = snapshot.package;
  if (!productionPackage) throw new Error('Expected canonical package.');

  const transport: StoryCanvasTransportState = {
    ...storyCanvasBridge.getState(),
    phase: 'accepted',
    connected: true,
    retryCount: 0,
    lastAttemptAt: '2026-08-03T11:59:00.000Z',
    lastConnectedAt: '2026-08-03T11:59:01.000Z',
    deepLink: `http://localhost:50188/project/${productionPackage.projectId}`,
    packageId: productionPackage.packageId,
    projectId: productionPackage.projectId,
    lastError: null,
  };
  storyCanvasBridge.restoreState(transport);

  const dispatch: SendPackageResult = {
    response: {
      status: 'accepted',
      result: 'accepted',
      packageId: productionPackage.packageId,
      projectId: productionPackage.projectId,
      duplicate: false,
      deepLink: transport.deepLink,
      acceptedAt: '2026-08-03T11:59:01.000Z',
    },
    transport,
  };
  const receiptSync: ReceiptSyncResult = {
    transport,
    items: [
      {
        receiptId: snapshot.generationTaskReceipts[0].generationTaskId,
        deliveryId: 'delivery-before-reset',
        kind: 'generation-task',
        status: 'accepted',
        acked: true,
        error: null,
      },
    ],
  };
  useControlPlaneStore.setState({
    snapshot: controlPlaneMockAdapter.getState(),
    lastPackageDispatch: dispatch,
    lastReceiptSync: receiptSync,
    lastSourceChain: run.sourceChain,
    bootstrapResult: storyCanvasBridge.bootstrap(),
  });

  return { dispatch, receiptSync, sourceChain: run.sourceChain };
}

describe('resetDemoExperience store orchestration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(TEST_NOW);
    resetStores();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('clears stale package, receipt, and source-chain evidence after a successful reset', async () => {
    prepareRuntimeEvidence();

    const result = await resetDemoExperience();
    const projectState = useProjectStore.getState();
    const controlPlaneState = useControlPlaneStore.getState();

    expect(result.ok).toBe(true);
    expect(projectState).toMatchObject({
      loading: false,
      error: null,
      hydrated: true,
      lastAction: 'resetDemoExperience',
    });
    expect(projectState.workspace.activeScriptId).toBe('script-a');
    expect(controlPlaneState).toMatchObject({
      loading: false,
      error: null,
      lastAction: 'resetDemoExperience',
      lastPackageDispatch: null,
      lastReceiptSync: null,
      lastSourceChain: null,
    });
    expect(controlPlaneState.snapshot.package).toBeNull();
    expect(controlPlaneState.snapshot.generationTaskReceipts).toEqual([]);
    expect(controlPlaneState.snapshot.assetReceipts).toEqual([]);
    expect(controlPlaneState.bootstrapResult.status).toBe('offline');
    expect(controlPlaneState.handoffState.status).toBe('closed');
  });

  it('clears stale delivery evidence when the previous active organization is rejected', async () => {
    prepareRuntimeEvidence();
    const activeOrganization = useControlPlaneStore.getState().activeOrganization;
    if (!activeOrganization) throw new Error('Expected active organization.');
    useControlPlaneStore.setState({
      activeOrganization: {
        ...activeOrganization,
        activeOrganizationId: 'organization-missing',
      },
    });

    const result = await resetDemoExperience();
    const controlPlaneState = useControlPlaneStore.getState();

    expect(result.ok).toBe(true);
    expect(controlPlaneState).toMatchObject({
      activeOrganization: null,
      loading: false,
      lastAction: 'resetDemoExperience:organization-rejected',
      lastPackageDispatch: null,
      lastReceiptSync: null,
      lastSourceChain: null,
      error: {
        code: 'ROUTE_ID_REJECTED',
        retryable: false,
        details: { organizationId: 'organization-missing' },
      },
    });
    expect(controlPlaneState.snapshot.package).toBeNull();
    expect(controlPlaneState.bootstrapResult.status).toBe('offline');
    expect(controlPlaneState.handoffState.status).toBe('closed');
  });

  it('preserves the rolled-back runtime evidence when reset fails', async () => {
    const evidence = prepareRuntimeEvidence();
    const dirtyWorkspace = cloneDemoWorkspace();
    dirtyWorkspace.activeScriptId = 'script-c';
    saveWorkspace(dirtyWorkspace);
    useProjectStore.setState({ workspace: dirtyWorkspace });
    const previousSnapshot = controlPlaneMockAdapter.getState();
    vi.spyOn(controlPlaneMockAdapter, 'resetDemoReady').mockImplementationOnce(() => {
      throw new Error('forced reset failure');
    });

    const result = await resetDemoExperience();
    const projectState = useProjectStore.getState();
    const controlPlaneState = useControlPlaneStore.getState();

    expect(result.ok).toBe(false);
    expect(projectState.workspace).toEqual(dirtyWorkspace);
    expect(projectState).toMatchObject({
      loading: false,
      error: 'forced reset failure',
      hydrated: true,
      lastAction: 'resetDemoExperience:failed',
    });
    expect(controlPlaneState.snapshot).toEqual(previousSnapshot);
    expect(controlPlaneState.lastPackageDispatch).toEqual(evidence.dispatch);
    expect(controlPlaneState.lastReceiptSync).toEqual(evidence.receiptSync);
    expect(controlPlaneState.lastSourceChain).toEqual(evidence.sourceChain);
    expect(controlPlaneState).toMatchObject({
      loading: false,
      lastAction: 'resetDemoExperience:failed',
      error: {
        code: 'CONTRACT_VALIDATION_FAILED',
        message: 'forced reset failure',
        retryable: true,
      },
    });
  });
});
