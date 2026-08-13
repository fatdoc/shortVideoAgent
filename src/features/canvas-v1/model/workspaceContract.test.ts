import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  CanvasWorkspaceContractError,
  assertCanvasWorkspaceAuthorityMatchesRequest,
  deriveCanvasShotRequirementId,
  deriveCanvasTargetEntityId,
  parseCanvasWorkspaceAuthorityRequestV01,
  parseCanvasWorkspaceAuthorityV01,
  parseCanvasWorkspaceBlockedErrorV01,
  parseCanvasWorkspaceV01,
  selectPrimaryVirtualCharacter,
} from './workspaceContract';

type Mutation = { op: 'add' | 'replace' | 'remove'; path: string; value?: unknown };
type Vector = {
  id: string;
  operation: string;
  mutations?: Mutation[];
  expectedCode?: string;
  expectedOutcome?: string;
  expectedValue?: string;
  shotId?: string;
};

const contractRoot = path.resolve(process.cwd(), 'docs/program/contracts/canvas-v1');
const fixture = JSON.parse(fs.readFileSync(path.join(contractRoot, 'fixtures/workspace-materialization.json'), 'utf8'));
const matrix = JSON.parse(fs.readFileSync(path.join(contractRoot, 'workspace-materialization-negative-vectors.json'), 'utf8')) as { vectors: Vector[] };
const authorityFixture = JSON.parse(fs.readFileSync(path.join(contractRoot, 'fixtures/workspace-authority.json'), 'utf8'));
const authorityMatrix = JSON.parse(fs.readFileSync(path.join(contractRoot, 'workspace-authority-negative-vectors.json'), 'utf8')) as { vectors: Vector[] };

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
    for (const vector of matrix.vectors) {
      const actual = vector.operation === 'parse-workspace'
        ? codeOf(() => parseCanvasWorkspaceV01(mutate(fixture.workspaceResponse, vector.mutations)))
        : vector.operation === 'parse-workspace-error'
          ? codeOf(() => parseCanvasWorkspaceBlockedErrorV01(mutate(fixture.workspaceError, vector.mutations)))
          : undefined;
      if (actual !== undefined) expect(actual, vector.id).toBe(vector.expectedCode);
    }
  });

  it('cannot accept the server-only materialization response', () => {
    expect(codeOf(() => parseCanvasWorkspaceV01(fixture.materializationResponse)))
      .toBe('CANVAS_WORKSPACE_BROWSER_UNSAFE');
  });

  it('matches Story for the authority-safe aggregate, casting and deterministic IDs', () => {
    const request = parseCanvasWorkspaceAuthorityRequestV01(authorityFixture.authorityRequest);
    const response = parseCanvasWorkspaceAuthorityV01(authorityFixture.authorityResponse);
    expect(() => assertCanvasWorkspaceAuthorityMatchesRequest(response, request)).not.toThrow();
    expect(parseCanvasWorkspaceBlockedErrorV01(fixture.workspaceError)).toEqual(fixture.workspaceError);
    for (const vector of authorityMatrix.vectors) {
      let actual: string | null = null;
      if (vector.operation === 'parse-authority-request') {
        actual = codeOf(() => parseCanvasWorkspaceAuthorityRequestV01(mutate(authorityFixture.authorityRequest, vector.mutations)));
      } else if (vector.operation === 'parse-authority-response') {
        actual = codeOf(() => parseCanvasWorkspaceAuthorityV01(mutate(authorityFixture.authorityResponse, vector.mutations)));
      } else if (vector.operation === 'authority-response-match') {
        actual = codeOf(() => assertCanvasWorkspaceAuthorityMatchesRequest(
          parseCanvasWorkspaceAuthorityV01(mutate(authorityFixture.authorityResponse, vector.mutations)),
          parseCanvasWorkspaceAuthorityRequestV01(authorityFixture.authorityRequest),
        ));
      } else if (vector.operation === 'select-primary-virtual-character') {
        actual = codeOf(() => selectPrimaryVirtualCharacter(
          parseCanvasWorkspaceAuthorityV01(mutate(authorityFixture.authorityResponse, vector.mutations)),
        ));
        if (vector.expectedOutcome === 'selected_but_readiness_blocked') actual = actual ?? 'selected_but_readiness_blocked';
      } else if (vector.operation === 'derive-target-entity-id') {
        actual = deriveCanvasTargetEntityId(response, selectPrimaryVirtualCharacter(response).assetId);
      } else if (vector.operation === 'derive-shot-requirement-id') {
        actual = deriveCanvasShotRequirementId(response, vector.shotId!, selectPrimaryVirtualCharacter(response).assetId);
      } else continue;
      expect(actual, vector.id).toBe(vector.expectedCode ?? vector.expectedValue ?? vector.expectedOutcome);
    }
  });
});
