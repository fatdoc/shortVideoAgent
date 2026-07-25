import type { DemoWorkspace, ProjectBrief, ScriptVersion } from '../domain/types';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { loadWorkspace, saveWorkspace } from './storage';

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

function ensureWorkspace(): DemoWorkspace {
  return loadWorkspace() ?? cloneDemoWorkspace();
}

export const mockApi = {
  async getWorkspace(): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    saveWorkspace(workspace);
    return structuredClone(workspace);
  },

  async saveBrief(brief: ProjectBrief): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.brief = brief;
    workspace.project.updatedAt = new Date().toISOString();
    workspace.project.status = 'briefing';
    saveWorkspace(workspace);
    return structuredClone(workspace);
  },

  async setActiveScript(scriptId: string): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.activeScriptId = scriptId;
    workspace.project.updatedAt = new Date().toISOString();
    saveWorkspace(workspace);
    return structuredClone(workspace);
  },

  async updateScript(script: ScriptVersion): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.scripts = workspace.scripts.map((item) => (item.id === script.id ? script : item));
    workspace.project.updatedAt = new Date().toISOString();
    saveWorkspace(workspace);
    return structuredClone(workspace);
  },

  async resetWorkspace(): Promise<DemoWorkspace> {
    await delay(120);
    const workspace = cloneDemoWorkspace();
    saveWorkspace(workspace);
    return structuredClone(workspace);
  },
};
