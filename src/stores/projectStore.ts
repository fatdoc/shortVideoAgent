import { create } from 'zustand';
import type {
  BrandProfile,
  DemoWorkspace,
  ProjectBrief,
  ScriptVersion,
  StoryboardShot,
  Timeline,
} from '../domain/types';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { mockApi } from '../services/mockApi';
import { loadWorkspace } from '../services/storage';
import type { ControlPlaneErrorShape } from '../domain/controlPlane';
import type { DemoExperienceResetResult } from '../services/demoExperienceReset';
import { controlPlaneMockAdapter } from '../services/controlPlaneMockAdapter';

interface ProjectState {
  workspace: DemoWorkspace;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  lastAction: string | null;
  hydrate: () => Promise<void>;
  setBrief: (brief: ProjectBrief) => Promise<void>;
  updateBrand: (brand: BrandProfile) => Promise<void>;
  setActiveScript: (scriptId: string) => Promise<void>;
  updateScript: (script: ScriptVersion) => Promise<void>;
  updateStoryboard: (storyboard: StoryboardShot[]) => Promise<void>;
  updateTimeline: (timeline: Timeline) => Promise<void>;
  reset: () => Promise<DemoExperienceResetResult>;
  setResetPending: () => void;
  applyResetSnapshot: (workspace: DemoWorkspace) => void;
  applyResetFailure: (
    workspace: DemoWorkspace | null,
    error: ControlPlaneErrorShape,
  ) => void;
  clearError: () => void;
}

const initial = loadWorkspace() ?? cloneDemoWorkspace();

async function runAction(
  set: (
    partial:
      | Partial<ProjectState>
      | ((state: ProjectState) => Partial<ProjectState>),
  ) => void,
  actionName: string,
  action: () => Promise<DemoWorkspace>,
) {
  set({ loading: true, error: null, lastAction: actionName });
  try {
    const workspace = await action();
    set({ workspace, loading: false, hydrated: true, lastAction: actionName });
  } catch (error) {
    set({
      loading: false,
      hydrated: true,
      error: error instanceof Error ? error.message : `${actionName} 失败`,
      lastAction: actionName,
    });
  }
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  workspace: initial,
  loading: false,
  error: null,
  hydrated: false,
  lastAction: null,

  hydrate: async () => {
    await runAction(set, 'hydrate', () => mockApi.getWorkspace());
  },

  setBrief: async (brief) => {
    await runAction(set, 'setBrief', () => mockApi.saveBrief(brief));
  },

  updateBrand: async (brand) => {
    await runAction(set, 'updateBrand', () => mockApi.updateBrand(brand));
  },

  setActiveScript: async (scriptId) => {
    await runAction(set, 'setActiveScript', () => mockApi.setActiveScript(scriptId));
  },

  updateScript: async (script) => {
    await runAction(set, 'updateScript', () => mockApi.updateScript(script));
  },

  updateStoryboard: async (storyboard) => {
    await runAction(set, 'updateStoryboard', () => mockApi.updateStoryboard(storyboard));
  },

  updateTimeline: async (timeline) => {
    await runAction(set, 'updateTimeline', () => mockApi.updateTimeline(timeline));
  },

  reset: async () => {
    try {
      const { resetDemoExperience } = await import('./demoExperienceStore');
      return await resetDemoExperience();
    } catch (error) {
      const resetError: ControlPlaneErrorShape = {
        code: 'CONTRACT_VALIDATION_FAILED',
        message:
          error instanceof Error
            ? error.message
            : 'Demo 原子重置入口加载失败',
        retryable: true,
        details: {},
      };
      set({
        loading: false,
        error: resetError.message,
        hydrated: true,
        lastAction: 'reset',
      });
      return {
        ok: false,
        stateName: 'RESET_FAILED',
        workspace: structuredClone(get().workspace),
        controlPlane: controlPlaneMockAdapter.getState(),
        error: resetError,
      };
    }
  },

  setResetPending: () =>
    set({ loading: true, error: null, lastAction: 'resetDemoExperience' }),

  applyResetSnapshot: (workspace) =>
    set({
      workspace,
      loading: false,
      error: null,
      hydrated: true,
      lastAction: 'resetDemoExperience',
    }),

  applyResetFailure: (workspace, error) =>
    set((state) => ({
      workspace: workspace ?? state.workspace,
      loading: false,
      error: error.message,
      hydrated: true,
      lastAction: 'resetDemoExperience:failed',
    })),

  clearError: () => set({ error: null }),
}));
