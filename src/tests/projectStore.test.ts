import { beforeEach, describe, expect, it } from 'vitest';
import { useProjectStore } from '../stores/projectStore';
import { clearWorkspace } from '../services/storage';
import { DEMO_PROJECT_ID } from '../domain/constants';

describe('projectStore', () => {
  beforeEach(() => {
    clearWorkspace();
    window.localStorage.clear();
    useProjectStore.setState({
      workspace: useProjectStore.getState().workspace,
      loading: false,
      error: null,
      hydrated: false,
      lastAction: null,
    });
  });

  it('hydrates demo workspace', async () => {
    await useProjectStore.getState().hydrate();
    const state = useProjectStore.getState();
    expect(state.hydrated).toBe(true);
    expect(state.loading).toBe(false);
    expect(state.workspace.project.id).toBe(DEMO_PROJECT_ID);
    expect(state.workspace.brand.facts).toHaveLength(8);
  });

  it('setActiveScript updates store and lastAction', async () => {
    await useProjectStore.getState().hydrate();
    await useProjectStore.getState().setActiveScript('script-b');
    const state = useProjectStore.getState();
    expect(state.workspace.activeScriptId).toBe('script-b');
    expect(state.lastAction).toBe('setActiveScript');
    expect(state.error).toBeNull();
  });

  it('reset restores seed workspace', async () => {
    await useProjectStore.getState().hydrate();
    await useProjectStore.getState().setActiveScript('script-c');
    await useProjectStore.getState().reset();
    const state = useProjectStore.getState();
    expect(state.workspace.activeScriptId).toBe('script-a');
    expect(state.workspace.storyboard).toHaveLength(8);
  });
});
