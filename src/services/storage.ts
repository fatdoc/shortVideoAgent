import { STORAGE_KEY } from '../domain/constants';
import type { DemoWorkspace } from '../domain/types';

export function loadWorkspace(): DemoWorkspace | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as DemoWorkspace;
  } catch {
    return null;
  }
}

export function saveWorkspace(workspace: DemoWorkspace): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
}

export function clearWorkspace(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(STORAGE_KEY);
}
