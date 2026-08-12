import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const BRIDGE_SOURCE_PATH = resolve(process.cwd(), 'src/services/pilotStoryCanvasBridge.ts');
const FORBIDDEN_DEMO_MODULES = new Set([
  './storyCanvasBridge',
  './controlPlaneMockAdapter',
  '../services/storyCanvasBridge',
  '../services/controlPlaneMockAdapter',
]);
const FORBIDDEN_DEMO_IDENTIFIERS = new Set(['storyCanvasBridge', 'controlPlaneMockAdapter']);
const FORBIDDEN_BROWSER_STORAGE = new Set(['localStorage', 'sessionStorage']);
const FORBIDDEN_DEMO_HEADER = 'x-storycanvas-demo-grant';

function fail(
  code:
    | 'PILOT_STORYCANVAS_BRIDGE_IMPLEMENTATION_REQUIRED'
    | 'PILOT_STORYCANVAS_BRIDGE_SOURCE_REQUIRED'
    | 'PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN'
    | 'PILOT_STORYCANVAS_DEMO_HEADER_FORBIDDEN'
    | 'PILOT_STORYCANVAS_BROWSER_STORAGE_FORBIDDEN'
    | 'PILOT_STORYCANVAS_SECRET_ADAPTER_ARGUMENT_FORBIDDEN',
): never {
  throw new Error(code);
}

function normalizeModuleSpecifier(value: string): string {
  return value.replace(/\.(?:[cm]?[jt]sx?)$/u, '');
}

function propertyNameText(name: ts.PropertyName | undefined): string | null {
  if (!name) return null;
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text;
  return null;
}

function isSecretBearingName(value: string): boolean {
  const normalized = value.replace(/[^a-z]/giu, '').toLowerCase();
  return (
    normalized.endsWith('grant') ||
    normalized === 'accesstoken' ||
    normalized === 'grantid' ||
    normalized.includes('digest')
  );
}

function adapterArgumentContainsSecret(node: ts.Node): boolean {
  let forbidden = false;
  const visit = (candidate: ts.Node): void => {
    if (forbidden) return;

    if (
      (ts.isPropertyAssignment(candidate) || ts.isShorthandPropertyAssignment(candidate)) &&
      isSecretBearingName(propertyNameText(candidate.name) ?? '')
    ) {
      forbidden = true;
      return;
    }

    if (
      ts.isIdentifier(candidate) &&
      isSecretBearingName(candidate.text) &&
      candidate.parent !== undefined
    ) {
      forbidden = true;
      return;
    }

    ts.forEachChild(candidate, visit);
  };

  visit(node);
  return forbidden;
}

function assertPilotStoryCanvasBridgeSourcePolicy(source: string): void {
  if (!source.trim()) fail('PILOT_STORYCANVAS_BRIDGE_SOURCE_REQUIRED');

  const sourceFile = ts.createSourceFile(
    BRIDGE_SOURCE_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );

  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      if (FORBIDDEN_DEMO_MODULES.has(normalizeModuleSpecifier(node.moduleSpecifier.text))) {
        fail('PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN');
      }
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0]) &&
      FORBIDDEN_DEMO_MODULES.has(normalizeModuleSpecifier(node.arguments[0].text))
    ) {
      fail('PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN');
    }

    if (ts.isIdentifier(node) && FORBIDDEN_DEMO_IDENTIFIERS.has(node.text)) {
      fail('PILOT_STORYCANVAS_DEMO_DEPENDENCY_FORBIDDEN');
    }

    if (ts.isStringLiteralLike(node) && node.text.toLowerCase() === FORBIDDEN_DEMO_HEADER) {
      fail('PILOT_STORYCANVAS_DEMO_HEADER_FORBIDDEN');
    }

    if (
      (ts.isIdentifier(node) && FORBIDDEN_BROWSER_STORAGE.has(node.text)) ||
      (ts.isStringLiteralLike(node) && FORBIDDEN_BROWSER_STORAGE.has(node.text))
    ) {
      fail('PILOT_STORYCANVAS_BROWSER_STORAGE_FORBIDDEN');
    }

    if (
      ts.isCallExpression(node) &&
      node.expression.kind !== ts.SyntaxKind.ImportKeyword &&
      node.arguments.some(adapterArgumentContainsSecret)
    ) {
      fail('PILOT_STORYCANVAS_SECRET_ADAPTER_ARGUMENT_FORBIDDEN');
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
}

describe('Pilot StoryCanvas shared bridge isolation boundary (RED-only)', () => {
  it('rejects Demo dependencies, Demo grant headers, browser storage, and secret-bearing adapter arguments', () => {
    const forbiddenSources = [
      `import { storyCanvasBridge } from './storyCanvasBridge';`,
      `import { controlPlaneMockAdapter } from './controlPlaneMockAdapter.ts';`,
      `const legacy = storyCanvasBridge;`,
      `const headers = { 'X-StoryCanvas-Demo-Grant': 'forbidden' };`,
      `const value = localStorage.getItem('pilot');`,
      `const value = window['sessionStorage'].getItem('pilot');`,
      `port.open({ rawGrant });`,
      `port.open({ credential: demoProjectGrant });`,
      `port.open({ accessToken: secret });`,
      `port.open({ grantId: secret });`,
      `port.open({ payloadDigest: secret });`,
      `port.open(grant);`,
    ];

    for (const source of forbiddenSources) {
      expect(() => assertPilotStoryCanvasBridgeSourcePolicy(source)).toThrow(
        /^PILOT_STORYCANVAS_/u,
      );
    }
  });

  it('allows a dependency-injected port to receive only non-secret Canvas Entry references', () => {
    expect(() =>
      assertPilotStoryCanvasBridgeSourcePolicy(`
        export function openPilotCanvas(port: PilotCanvasPort, entry: CanvasEntryReference) {
          return port.open({
            entryHandle: entry.entryHandle,
            projectId: entry.projectId,
          });
        }
      `),
    ).not.toThrow();
  });

  it('requires the future shared bridge implementation to satisfy the frozen isolation policy', () => {
    expect(existsSync(BRIDGE_SOURCE_PATH), 'PILOT_STORYCANVAS_BRIDGE_IMPLEMENTATION_REQUIRED').toBe(
      true,
    );

    const source = readFileSync(BRIDGE_SOURCE_PATH, 'utf8');
    expect(() => assertPilotStoryCanvasBridgeSourcePolicy(source)).not.toThrow();
  });
});
