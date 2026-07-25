import { describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID, ROUTES } from '../domain/constants';
import { getActiveScript, getFactIds, summarizeWorkspace } from '../domain/selectors';
import { demoWorkspace } from '../mocks/demoWorkspace';

describe('demo workspace contract', () => {
  it('uses unified demo project id', () => {
    expect(demoWorkspace.project.id).toBe(DEMO_PROJECT_ID);
    expect(demoWorkspace.brief.projectId).toBe(DEMO_PROJECT_ID);
  });

  it('contains C1-C8 brand facts', () => {
    const ids = demoWorkspace.brand.facts.map((fact) => fact.id);
    expect(ids).toEqual(['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8']);
    expect(getFactIds(demoWorkspace)).toEqual(ids);
  });

  it('contains eight storyboard shots ordered 1-8', () => {
    expect(demoWorkspace.storyboard).toHaveLength(8);
    expect(demoWorkspace.storyboard.map((shot) => shot.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('exposes three script versions and active script-a', () => {
    expect(demoWorkspace.scripts.map((s) => s.id)).toEqual(['script-a', 'script-b', 'script-c']);
    expect(demoWorkspace.activeScriptId).toBe('script-a');
    expect(getActiveScript(demoWorkspace)?.id).toBe('script-a');
  });

  it('summarizes workspace for shell placeholders', () => {
    const summary = summarizeWorkspace(demoWorkspace);
    expect(summary.projectId).toBe(DEMO_PROJECT_ID);
    expect(summary.factCount).toBe(8);
    expect(summary.shotCount).toBe(8);
    expect(summary.scriptCount).toBe(3);
  });

  it('keeps frozen route helpers stable', () => {
    expect(ROUTES.dashboard).toBe('/dashboard');
    expect(ROUTES.projectNew).toBe('/projects/new');
    expect(ROUTES.brand(DEMO_PROJECT_ID)).toBe(`/projects/${DEMO_PROJECT_ID}/brand`);
    expect(ROUTES.script(DEMO_PROJECT_ID)).toBe(`/projects/${DEMO_PROJECT_ID}/script`);
    expect(ROUTES.storyboard(DEMO_PROJECT_ID)).toBe(`/projects/${DEMO_PROJECT_ID}/storyboard`);
    expect(ROUTES.roughCut(DEMO_PROJECT_ID)).toBe(`/projects/${DEMO_PROJECT_ID}/rough-cut`);
  });
});
