import type { PrepareHighCostApprovalRequest } from '../features/canvas-v1/hooks/useCanvasCommandApprovalFlow';
import type {
  AssetRecordV01,
  CanvasCommandV01,
  CanvasDocumentV01,
  CanvasV1Scope,
  ShotReadinessV01,
} from '../features/canvas-v1/model/contracts';
import type { CanvasWorkspaceV01 } from '../features/canvas-v1/model/workspaceContract';
import {
  legacyOpenRequest,
  parseCanonicalCanvasRouteSelection,
  type CanvasRouteSelection,
} from '../features/canvas-v1/api/activation';
import { PilotStoryCanvasBridgeError } from '../features/canvas-v1/api/errors';
import {
  createPilotStoryCanvasHttpPort,
  type CanvasApprovalProjection,
  type PilotStoryCanvasHttpPort,
} from '../features/canvas-v1/api/httpPort';

export interface PilotCanvasActivationInput extends CanvasRouteSelection {
  activationAttemptId: string;
}

export interface PilotCanvasActivationState {
  selection: CanvasRouteSelection;
  canvasSessionId: string;
  workspace: CanvasWorkspaceV01;
}

export interface PilotStoryCanvasBridge {
  activate(input: PilotCanvasActivationInput): Promise<PilotCanvasActivationState>;
  prepareApproval(
    state: PilotCanvasActivationState,
    request: PrepareHighCostApprovalRequest,
  ): Promise<CanvasApprovalProjection>;
  dispatch(
    state: PilotCanvasActivationState,
    command: CanvasCommandV01,
  ): ReturnType<PilotStoryCanvasHttpPort['dispatch']>;
  refreshWorkspace(state: PilotCanvasActivationState): Promise<PilotCanvasActivationState>;
}

function fail(code: string): never {
  throw new PilotStoryCanvasBridgeError(code);
}

function sameScope(value: CanvasV1Scope, expected: CanvasWorkspaceV01): boolean {
  return (
    value.tenantId === expected.tenantId &&
    value.projectId === expected.projectId &&
    value.packageId === expected.packageId &&
    value.canvasSessionId === expected.canvasSessionId
  );
}

function assertBootstrapAgreement(
  formal: CanvasWorkspaceV01['bootstrap'],
  workspace: CanvasWorkspaceV01,
): void {
  const embedded = workspace.bootstrap;
  if (
    !sameScope(formal, workspace) ||
    formal.status !== embedded.status ||
    formal.approvedScript.scriptId !== embedded.approvedScript.scriptId ||
    formal.approvedScript.version !== embedded.approvedScript.version ||
    formal.approvedStoryboard.storyboardId !== embedded.approvedStoryboard.storyboardId ||
    formal.approvedStoryboard.version !== embedded.approvedStoryboard.version ||
    formal.document.documentId !== embedded.document.documentId ||
    formal.document.version !== embedded.document.version
  ) {
    fail('CANVAS_BOOTSTRAP_WORKSPACE_MISMATCH');
  }
}

function assertDocument(document: CanvasDocumentV01, workspace: CanvasWorkspaceV01): void {
  if (
    !sameScope(document, workspace) ||
    JSON.stringify(document) !== JSON.stringify(workspace.document)
  ) {
    fail('CANVAS_DOCUMENT_REFRESH_MISMATCH');
  }
}

function assertAssets(assets: AssetRecordV01[], workspace: CanvasWorkspaceV01): void {
  if (assets.length !== workspace.assets.length) fail('CANVAS_ASSET_REFRESH_MISMATCH');
  for (const [index, asset] of assets.entries()) {
    const expected = workspace.assets[index];
    if (
      !expected ||
      !sameScope(asset, workspace) ||
      asset.assetId !== expected.assetId ||
      asset.category !== expected.category ||
      asset.displayName !== expected.displayName ||
      asset.rights.status !== expected.rightsStatus ||
      asset.approval.status !== expected.approvalStatus ||
      asset.controlledPreviewUrl !== expected.controlledPreviewUrl
    ) {
      fail('CANVAS_ASSET_REFRESH_MISMATCH');
    }
  }
}

function assertReadiness(
  readiness: ShotReadinessV01,
  workspace: CanvasWorkspaceV01,
  shotId: string,
): void {
  const expected = workspace.shots.find((shot) => shot.shotId === shotId)?.readiness;
  if (
    !expected ||
    !sameScope(readiness, workspace) ||
    readiness.shotId !== shotId ||
    JSON.stringify(readiness) !== JSON.stringify(expected)
  ) {
    fail('CANVAS_READINESS_REFRESH_MISMATCH');
  }
}

function assertState(state: PilotCanvasActivationState): void {
  if (
    state.selection.projectId !== state.workspace.projectId ||
    state.selection.packageId !== state.workspace.packageId ||
    state.canvasSessionId !== state.workspace.canvasSessionId
  ) {
    fail('CANVAS_STATE_SCOPE_MISMATCH');
  }
}

export function createPilotStoryCanvasBridge(
  options: {
    port?: PilotStoryCanvasHttpPort;
  } = {},
): PilotStoryCanvasBridge {
  const port = options.port ?? createPilotStoryCanvasHttpPort();

  return {
    async activate(input) {
      const selection = parseCanonicalCanvasRouteSelection({
        projectId: input.projectId,
        search: `?packageId=${encodeURIComponent(input.packageId)}`,
      });
      const firstCsrf = await port.acquireControlCsrf(selection.projectId);
      const activation = await port.activate(
        selection.projectId,
        selection.packageId,
        { activationAttemptId: input.activationAttemptId },
        firstCsrf,
      );
      const opened = await port.openLegacy(legacyOpenRequest(activation.entry));
      const formal = await port.readBootstrap(opened.canvasSessionId, selection);
      const workspace = await port.readWorkspace(opened.canvasSessionId, selection);
      if (
        activation.entry.tenantId !== formal.tenantId ||
        activation.entry.tenantId !== workspace.tenantId
      ) {
        fail('CANVAS_ACTIVATION_TENANT_MISMATCH');
      }
      assertBootstrapAgreement(formal, workspace);
      // Acquire again because activation may rotate the authenticated browser session.
      await port.acquireControlCsrf(selection.projectId);
      return { selection, canvasSessionId: opened.canvasSessionId, workspace };
    },

    async prepareApproval(state, request) {
      assertState(state);
      if (
        request.tenantId !== state.workspace.tenantId ||
        request.projectId !== state.workspace.projectId ||
        request.packageId !== state.workspace.packageId ||
        request.canvasSessionId !== state.workspace.canvasSessionId ||
        request.requestedByActorId !== state.workspace.project.requestedByActorId
      ) {
        fail('CANVAS_APPROVAL_SCOPE_MISMATCH');
      }
      const csrf = await port.acquireControlCsrf(state.selection.projectId);
      return port.prepareApproval(
        state.selection.projectId,
        {
          packageId: state.selection.packageId,
          canvasSessionId: state.canvasSessionId,
          commandType: request.commandType,
          action: {
            commandId: request.action.commandId,
            payload: structuredClone(request.action.payload),
          },
          expiresInSeconds: 60,
          replayPolicy: 'single_use_replay_same_command',
        },
        csrf,
      );
    },

    dispatch(state, command) {
      assertState(state);
      if (
        !sameScope(command, state.workspace) ||
        command.requestedByActorId !== state.workspace.project.requestedByActorId
      ) {
        fail('CANVAS_COMMAND_SCOPE_MISMATCH');
      }
      return port.dispatch(command);
    },

    async refreshWorkspace(state) {
      assertState(state);
      const workspace = await port.readWorkspace(state.canvasSessionId, state.selection);
      if (
        workspace.tenantId !== state.workspace.tenantId ||
        workspace.project.requestedByActorId !== state.workspace.project.requestedByActorId ||
        workspace.document.documentId !== state.workspace.document.documentId
      ) {
        fail('CANVAS_WORKSPACE_REFRESH_MISMATCH');
      }
      const document = await port.readDocument(
        state.canvasSessionId,
        workspace.document.documentId,
      );
      assertDocument(document, workspace);
      const assets = await port.readAssets(state.canvasSessionId);
      assertAssets(assets, workspace);
      for (const shot of workspace.shots) {
        const readiness = await port.readReadiness(state.canvasSessionId, shot.shotId);
        assertReadiness(readiness, workspace, shot.shotId);
      }
      return { selection: state.selection, canvasSessionId: state.canvasSessionId, workspace };
    },
  };
}
