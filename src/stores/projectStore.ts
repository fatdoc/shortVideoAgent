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
import { loadWorkspace, saveWorkspace } from '../services/storage';

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
  reset: () => Promise<void>;
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

export const useProjectStore = create<ProjectState>((set) => ({
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
    set({ loading: true, error: null, lastAction: 'reset' });
    try {
      const workspace = await mockApi.resetWorkspace();
      set({ workspace, loading: false, hydrated: true, lastAction: 'reset' });
    } catch (error) {
      const workspace = cloneDemoWorkspace();
      saveWorkspace(workspace);
      set({
        workspace,
        loading: false,
        error: error instanceof Error ? error.message : '重置失败',
        hydrated: true,
        lastAction: 'reset',
      });
    }
  },

  clearError: () => set({ error: null }),
}));
