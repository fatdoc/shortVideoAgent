import type {
  ControlPlaneDemoState,
  ControlPlaneErrorShape,
} from '../domain/controlPlane';
import type { DemoWorkspace } from '../domain/types';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import {
  ControlPlaneMockError,
  controlPlaneMockAdapter,
} from './controlPlaneMockAdapter';
import { clearDemoScriptApproval } from './controlPlanePersistence';
import {
  clearWorkspace,
  loadWorkspace,
  saveWorkspace,
} from './storage';
import { storyCanvasBridge } from './storyCanvasBridge';

export type DemoExperienceResetResult =
  | {
      ok: true;
      stateName: 'DEMO_READY';
      workspace: DemoWorkspace;
      controlPlane: ControlPlaneDemoState;
      error: null;
    }
  | {
      ok: false;
      stateName: 'RESET_FAILED';
      workspace: DemoWorkspace | null;
      controlPlane: ControlPlaneDemoState;
      error: ControlPlaneErrorShape;
    };

function resetError(error: unknown): ControlPlaneErrorShape {
  if (error instanceof ControlPlaneMockError) {
    return {
      code: error.code,
      message: error.message,
      retryable: error.retryable,
      details: error.details,
    };
  }
  return {
    code: 'CONTRACT_VALIDATION_FAILED',
    message: error instanceof Error ? error.message : 'Demo 原子重置失败。',
    retryable: true,
    details: {},
  };
}

export async function resetDemoExperienceTransaction(): Promise<DemoExperienceResetResult> {
  const previousWorkspace = loadWorkspace();
  const previousControlPlane = controlPlaneMockAdapter.createCheckpoint();
  const previousTransport = storyCanvasBridge.getState();
  const nextWorkspace = cloneDemoWorkspace();

  try {
    saveWorkspace(nextWorkspace);
    controlPlaneMockAdapter.resetDemoReady(nextWorkspace);
    storyCanvasBridge.resetOffline();
    return {
      ok: true,
      stateName: 'DEMO_READY',
      workspace: structuredClone(nextWorkspace),
      controlPlane: controlPlaneMockAdapter.getState(),
      error: null,
    };
  } catch (error) {
    try {
      if (previousWorkspace) saveWorkspace(previousWorkspace);
      else clearWorkspace();
      controlPlaneMockAdapter.restoreCheckpoint(previousControlPlane);
      storyCanvasBridge.restoreState(previousTransport);
      if (previousControlPlane.state.scriptApprovals.length === 0) {
        clearDemoScriptApproval();
      }
    } catch (rollbackError) {
      return {
        ok: false,
        stateName: 'RESET_FAILED',
        workspace: previousWorkspace
          ? structuredClone(previousWorkspace)
          : null,
        controlPlane: previousControlPlane.state,
        error: {
          code: 'CONTRACT_VALIDATION_FAILED',
          message: 'Demo 重置失败，且旧快照恢复失败；不得展示 DEMO_READY。',
          retryable: false,
          details: {
            resetError:
              error instanceof Error ? error.message : String(error),
            rollbackError:
              rollbackError instanceof Error
                ? rollbackError.message
                : String(rollbackError),
          },
        },
      };
    }
    return {
      ok: false,
      stateName: 'RESET_FAILED',
      workspace: previousWorkspace
        ? structuredClone(previousWorkspace)
        : null,
      controlPlane: controlPlaneMockAdapter.getState(),
      error: resetError(error),
    };
  }
}
