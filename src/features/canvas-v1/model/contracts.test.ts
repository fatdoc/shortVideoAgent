import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  CanvasV1ContractError,
  assertCanvasDocumentVersion,
  assertCanvasScope,
  assertCanvasSessionActive,
  decideCanvasCommandReplay,
  parseCanvasV1BrowserContract,
  parseCanvasV1Contract,
  restoreCanvasDocumentForSession,
} from './contracts';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../');
const contractDir = path.join(rootDir, 'docs/program/contracts/canvas-v1');
const matrix = JSON.parse(fs.readFileSync(path.join(contractDir, 'negative-vectors.json'), 'utf8'));
const loadFixture = (fileName: string) =>
  JSON.parse(fs.readFileSync(path.join(contractDir, 'fixtures', fileName), 'utf8'));

type Mutation = { op: 'add' | 'replace' | 'remove'; path: string; value?: unknown };

function mutate(source: unknown, mutations: Mutation[] = []) {
  const output = structuredClone(source) as Record<string, unknown>;
  for (const mutation of mutations) {
    const parts = mutation.path.slice(1).split('/');
    const leaf = parts.pop()!;
    let parent: any = output;
    for (const part of parts) parent = parent[part];
    if (mutation.op === 'remove') delete parent[leaf];
    else parent[leaf] = structuredClone(mutation.value);
  }
  return output;
}

function runVector(vector: any) {
  const fixture = mutate(loadFixture(vector.fixture), vector.mutations);
  switch (vector.operation) {
    case 'parse':
      return parseCanvasV1Contract(fixture);
    case 'parseBrowser':
      return parseCanvasV1BrowserContract(fixture);
    case 'assertScope':
      return assertCanvasScope(parseCanvasV1Contract(fixture), vector.expectedScope);
    case 'decideReplay':
      return decideCanvasCommandReplay(
        parseCanvasV1Contract(fixture),
        parseCanvasV1Contract(mutate(loadFixture(vector.fixture), vector.relatedMutations)),
      );
    case 'assertDocumentVersion':
      return assertCanvasDocumentVersion(parseCanvasV1Contract(fixture), vector.expectedVersion);
    case 'assertSessionActive':
      return assertCanvasSessionActive(vector.sessionActive);
    default:
      throw new Error(`unknown conformance operation ${vector.operation}`);
  }
}

describe('Canvas V1 frontend contract conformance', () => {
  it('accepts all nine canonical fixtures without transformation', () => {
    for (const fileName of Object.values(matrix.fixtureFiles) as string[]) {
      const fixture = loadFixture(fileName);
      expect(parseCanvasV1Contract(fixture)).toEqual(fixture);
    }
  });

  it('accepts the canonical blocked readiness with a missing binding', () => {
    const fileName = matrix.additionalPositiveFixtures.ShotReadinessBindingMissing;
    const fixture = loadFixture(fileName);
    expect(parseCanvasV1Contract(fixture)).toEqual(fixture);
    expect(fixture.requirements[0].entityBindingStatus).toBeNull();
    expect(fixture.reasonCodes).toEqual(['ENTITY_BINDING_MISSING']);
  });

  it('accepts only the eight browser-safe projections', () => {
    for (const objectType of matrix.browserSafeObjectTypes as string[]) {
      const fixture = loadFixture(matrix.fixtureFiles[objectType]);
      expect(parseCanvasV1BrowserContract(fixture)).toEqual(fixture);
    }
    expect(() =>
      parseCanvasV1BrowserContract(loadFixture(matrix.fixtureFiles.ProviderAssetBinding)),
    ).toThrowError(expect.objectContaining({ code: 'CANVAS_BROWSER_PROJECTION_UNSAFE' }));
  });

  it('rejects every frozen negative vector with the same stable code as backend', () => {
    for (const vector of matrix.vectors) {
      try {
        runVector(vector);
        throw new Error(`negative vector unexpectedly passed: ${vector.id}`);
      } catch (error) {
        expect(error, vector.id).toBeInstanceOf(CanvasV1ContractError);
        expect((error as CanvasV1ContractError).code, vector.id).toBe(vector.expectedCode);
      }
    }
  });

  it('freezes same-payload replay and stable document recovery under a new valid session', () => {
    const replayCase = matrix.positiveSemanticCases.find((item: any) => item.operation === 'decideReplay');
    const command = parseCanvasV1Contract(loadFixture(replayCase.fixture));
    expect(decideCanvasCommandReplay(command, command)).toEqual({ outcome: 'replay', replayed: true });

    const recoveryCase = matrix.positiveSemanticCases.find((item: any) => item.operation === 'restoreDocument');
    const document = parseCanvasV1Contract(loadFixture(recoveryCase.fixture));
    if (document.objectType !== 'CanvasDocument') throw new Error('document recovery fixture has wrong objectType');
    const restored = restoreCanvasDocumentForSession(document, recoveryCase.newCanvasSessionId);
    expect(restored.documentId).toBe(document.documentId);
    expect(restored.version).toBe(document.version);
    expect(restored.canvasSessionId).toBe(recoveryCase.newCanvasSessionId);
  });
});
