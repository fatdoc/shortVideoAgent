import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CanvasWorkspaceContractError,
  parseCanvasWorkspaceV01,
} from './workspaceContract';

type Mutation = { op: 'add' | 'replace' | 'remove'; path: string; value?: unknown };
type Vector = { id: string; operation: string; mutations?: Mutation[]; expectedCode?: string };

const contractRoot = path.resolve(process.cwd(), 'docs/program/contracts/canvas-v1');
const fixture = JSON.parse(fs.readFileSync(path.join(contractRoot, 'fixtures/workspace-materialization.json'), 'utf8'));
const matrix = JSON.parse(fs.readFileSync(path.join(contractRoot, 'workspace-materialization-negative-vectors.json'), 'utf8')) as { vectors: Vector[] };

function mutate<T>(value: T, mutations: Mutation[] = []): T {
  const output = structuredClone(value) as unknown;
  for (const mutation of mutations) {
    const segments = mutation.path.split('/').slice(1).map((part) => part.replace(/~1/g, '/').replace(/~0/g, '~'));
    let parent = output as Record<string, unknown> | unknown[];
    for (const segment of segments.slice(0, -1)) parent = (parent as Record<string, unknown>)[segment] as Record<string, unknown> | unknown[];
    const key = segments.at(-1)!;
    if (mutation.op === 'remove') {
      if (Array.isArray(parent)) parent.splice(Number(key), 1);
      else delete (parent as Record<string, unknown>)[key];
    } else if (Array.isArray(parent)) {
      if (mutation.op === 'add' && Number(key) >= parent.length) parent.push(mutation.value);
      else parent[Number(key)] = mutation.value;
    } else (parent as Record<string, unknown>)[key] = mutation.value;
  }
  return output as T;
}

function codeOf(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof CanvasWorkspaceContractError ? error.code : String(error);
  }
}

describe('CanvasWorkspace/0.1 browser parser', () => {
  it('accepts the canonical browser-safe workspace fixture', () => {
    expect(parseCanvasWorkspaceV01(fixture.workspaceResponse)).toEqual(fixture.workspaceResponse);
  });

  it('matches Story on every executable workspace negative vector', () => {
    for (const vector of matrix.vectors.filter(({ operation }) => operation === 'parse-workspace')) {
      expect(
        codeOf(() => parseCanvasWorkspaceV01(mutate(fixture.workspaceResponse, vector.mutations))),
        vector.id,
      ).toBe(vector.expectedCode);
    }
  });

  it('cannot accept the server-only materialization response', () => {
    expect(codeOf(() => parseCanvasWorkspaceV01(fixture.materializationResponse)))
      .toBe('CANVAS_WORKSPACE_BROWSER_UNSAFE');
  });
});
