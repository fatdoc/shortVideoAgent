import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_PROJECT_ID, STORAGE_KEY } from '../domain/constants';
import { mockApi } from '../services/mockApi';
import { clearWorkspace, loadWorkspace, saveWorkspace } from '../services/storage';
import { cloneDemoWorkspace } from '../mocks/demoWorkspace';

describe('storage + mockApi', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
  });

  it('persists workspace under versioned storage key', () => {
    const workspace = cloneDemoWorkspace();
    saveWorkspace(workspace);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeTruthy();
    expect(loadWorkspace()?.project.id).toBe(DEMO_PROJECT_ID);
  });

  it('getWorkspace seeds demo data when empty', async () => {
    const workspace = await mockApi.getWorkspace();
    expect(workspace.project.id).toBe(DEMO_PROJECT_ID);
    expect(loadWorkspace()?.project.id).toBe(DEMO_PROJECT_ID);
  });

  it('saveBrief updates brief and project meta', async () => {
    const base = await mockApi.getWorkspace();
    const next = await mockApi.saveBrief({
      ...base.brief,
      merchantName: '测试商家',
      cta: '到店核销',
    });
    expect(next.brief.merchantName).toBe('测试商家');
    expect(next.project.name).toContain('测试商家');
    expect(next.project.status).toBe('briefing');
    expect(loadWorkspace()?.brief.merchantName).toBe('测试商家');
  });

  it('setActiveScript switches and persists active script', async () => {
    await mockApi.getWorkspace();
    const next = await mockApi.setActiveScript('script-b');
    expect(next.activeScriptId).toBe('script-b');
    expect(loadWorkspace()?.activeScriptId).toBe('script-b');
  });

  it('resetWorkspace restores seed demo', async () => {
    await mockApi.setActiveScript('script-c');
    const reset = await mockApi.resetWorkspace();
    expect(reset.activeScriptId).toBe('script-a');
    expect(reset.brand.facts).toHaveLength(8);
    expect(reset.storyboard).toHaveLength(8);
  });
});
