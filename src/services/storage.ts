import type { DemoWorkspace } from '../domain/types';

let inMemoryWorkspace: DemoWorkspace | null = null;

export function loadWorkspace(): DemoWorkspace | null {
  return inMemoryWorkspace ? structuredClone(inMemoryWorkspace) : null;
}

export function saveWorkspace(workspace: DemoWorkspace): void {
  inMemoryWorkspace = structuredClone(workspace);
}

export function clearWorkspace(): void {
  inMemoryWorkspace = null;
}

export function hasPersistedWorkspace(): boolean {
  return inMemoryWorkspace !== null;
}
