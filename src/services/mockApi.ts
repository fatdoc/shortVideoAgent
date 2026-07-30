import type {
  BrandProfile,
  DemoWorkspace,
  ProjectBrief,
  ScriptVersion,
  StoryboardShot,
  Timeline,
} from '../domain/types';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';
import { loadWorkspace, saveWorkspace } from './storage';

const delay = (ms = 280) => new Promise((resolve) => setTimeout(resolve, ms));

function touch(workspace: DemoWorkspace): DemoWorkspace {
  workspace.project.updatedAt = new Date().toISOString();
  return workspace;
}

function ensureWorkspace(): DemoWorkspace {
  return loadWorkspace() ?? cloneDemoWorkspace();
}

function persist(workspace: DemoWorkspace): DemoWorkspace {
  saveWorkspace(workspace);
  return structuredClone(workspace);
}

export const mockApi = {
  async getWorkspace(): Promise<DemoWorkspace> {
    await delay();
    return persist(ensureWorkspace());
  },

  async resetWorkspace(): Promise<DemoWorkspace> {
    await delay();
    return persist(cloneDemoWorkspace());
  },

  async saveBrief(brief: ProjectBrief): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.brief = brief;
    workspace.project.name = `${brief.merchantName}探店视频`;
    workspace.project.businessType = brief.businessType;
    workspace.project.status = 'briefing';
    workspace.project.progress = Math.max(workspace.project.progress, 20);
    return persist(touch(workspace));
  },

  async updateBrand(brand: BrandProfile): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.brand = brand;
    workspace.project.status = 'briefing';
    workspace.project.progress = Math.max(workspace.project.progress, 30);
    return persist(touch(workspace));
  },

  async setActiveScript(scriptId: string): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    if (!workspace.scripts.some((script) => script.id === scriptId)) {
      throw new Error(`脚本不存在: ${scriptId}`);
    }
    workspace.activeScriptId = scriptId;
    workspace.project.status = 'scripting';
    workspace.project.progress = Math.max(workspace.project.progress, 42);
    return persist(touch(workspace));
  },

  async updateScript(script: ScriptVersion): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    const exists = workspace.scripts.some((item) => item.id === script.id);
    if (!exists) {
      throw new Error(`脚本不存在: ${script.id}`);
    }
    workspace.scripts = workspace.scripts.map((item) => (item.id === script.id ? script : item));
    workspace.project.status = 'scripting';
    workspace.project.progress = Math.max(workspace.project.progress, 48);
    return persist(touch(workspace));
  },

  async updateStoryboard(storyboard: StoryboardShot[]): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.storyboard = storyboard;
    workspace.project.status = 'storyboarding';
    workspace.project.progress = Math.max(workspace.project.progress, 60);
    return persist(touch(workspace));
  },

  async updateTimeline(timeline: Timeline): Promise<DemoWorkspace> {
    await delay();
    const workspace = ensureWorkspace();
    workspace.timeline = timeline;
    workspace.project.status = 'production';
    workspace.project.progress = Math.max(workspace.project.progress, 75);
    return persist(touch(workspace));
  },
};
