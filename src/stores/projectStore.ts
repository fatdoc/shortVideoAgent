import { create } from 'zustand';
import type { DemoWorkspace, ProjectBrief, ScriptVersion } from '../domain/types';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { mockApi } from '../services/mockApi';
import { loadWorkspace, saveWorkspace } from '../services/storage';

interface ProjectState {
  workspace: DemoWorkspace;
  loading: boolean;
  error: string | null;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  setBrief: (brief: ProjectBrief) => Promise<void>;
  setActiveScript: (scriptId: string) => Promise<void>;
  updateScript: (script: ScriptVersion) => Promise<void>;
  reset: () => Promise<void>;
}

const initial = loadWorkspace() ?? cloneDemoWorkspace();

export const useProjectStore = create<ProjectState>((set) => ({
  workspace: initial,
  loading: false,
  error: null,
  hydrated: false,

  hydrate: async () => {
    set({ loading: true, error: null });
    try {
      const workspace = await mockApi.getWorkspace();
      set({ workspace, loading: false, hydrated: true });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '加载失败',
        hydrated: true,
      });
    }
  },

  setBrief: async (brief) => {
    set({ loading: true, error: null });
    try {
      const workspace = await mockApi.saveBrief(brief);
      set({ workspace, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '保存 Brief 失败',
      });
    }
  },

  setActiveScript: async (scriptId) => {
    set({ loading: true, error: null });
    try {
      const workspace = await mockApi.setActiveScript(scriptId);
      set({ workspace, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '切换脚本失败',
      });
    }
  },

  updateScript: async (script) => {
    set({ loading: true, error: null });
    try {
      const workspace = await mockApi.updateScript(script);
      set({ workspace, loading: false });
    } catch (error) {
      set({
        loading: false,
        error: error instanceof Error ? error.message : '更新脚本失败',
      });
    }
  },

  reset: async () => {
    set({ loading: true, error: null });
    try {
      const workspace = await mockApi.resetWorkspace();
      set({ workspace, loading: false, hydrated: true });
    } catch (error) {
      const workspace = cloneDemoWorkspace();
      saveWorkspace(workspace);
      set({
        workspace,
        loading: false,
        error: error instanceof Error ? error.message : '重置失败',
        hydrated: true,
      });
    }
  },
}));
