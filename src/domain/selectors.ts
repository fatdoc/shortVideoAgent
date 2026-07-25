import type { DemoWorkspace, ScriptVersion, StoryboardShot } from './types';
import { DEMO_PROJECT_ID } from './constants';

export function getActiveScript(workspace: DemoWorkspace): ScriptVersion | undefined {
  return (
    workspace.scripts.find((script) => script.id === workspace.activeScriptId) ??
    workspace.scripts[0]
  );
}

export function getShotById(
  workspace: DemoWorkspace,
  shotId: string,
): StoryboardShot | undefined {
  return workspace.storyboard.find((shot) => shot.id === shotId);
}

export function getFactIds(workspace: DemoWorkspace): string[] {
  return workspace.brand.facts.map((fact) => fact.id);
}

export function isDemoProject(projectId: string | undefined): boolean {
  return projectId === DEMO_PROJECT_ID;
}

export function summarizeWorkspace(workspace: DemoWorkspace) {
  const matched = workspace.storyboard.filter((s) => s.matchStatus === 'matched').length;
  const missing = workspace.storyboard.filter((s) => s.matchStatus === 'missing').length;
  const reshoot = workspace.storyboard.filter((s) => s.matchStatus === 'reshoot').length;
  const active = getActiveScript(workspace);

  return {
    projectId: workspace.project.id,
    projectName: workspace.project.name,
    owner: workspace.project.owner,
    status: workspace.project.status,
    progress: workspace.project.progress,
    factCount: workspace.brand.facts.length,
    scriptCount: workspace.scripts.length,
    activeScriptId: workspace.activeScriptId,
    activeScriptName: active?.name ?? '-',
    shotCount: workspace.storyboard.length,
    matchedShots: matched,
    missingShots: missing,
    reshootShots: reshoot,
    assetCount: workspace.assets.length,
    timelineDuration: workspace.timeline.duration,
  };
}
