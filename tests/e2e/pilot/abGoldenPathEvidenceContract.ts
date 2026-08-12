const EVIDENCE_SHAPE_INVALID = 'PILOT_E2E_GOLDEN_PATH_EVIDENCE_SHAPE_INVALID';
const EVIDENCE_LIMIT_EXCEEDED = 'PILOT_E2E_GOLDEN_PATH_EVIDENCE_LIMIT_EXCEEDED';
const EVIDENCE_STEP_INVALID = 'PILOT_E2E_GOLDEN_PATH_EVIDENCE_STEP_INVALID';
const EVIDENCE_DUPLICATE = 'PILOT_E2E_GOLDEN_PATH_EVIDENCE_DUPLICATE';
const EVIDENCE_INCOMPLETE = 'PILOT_E2E_GOLDEN_PATH_EVIDENCE_INCOMPLETE';
const EVIDENCE_ORDER_INVALID = 'PILOT_E2E_GOLDEN_PATH_EVIDENCE_ORDER_INVALID';
const REAL_EDITOR_EVIDENCE_REQUIRED = 'PILOT_E2E_REAL_EDITOR_EVIDENCE_REQUIRED';
const CANVAS_SELECTOR_ALIAS_FORBIDDEN = 'PILOT_E2E_CANVAS_SELECTOR_ALIAS_FORBIDDEN';

const MAX_REPORT_TEXT_BYTES = 1_048_576;
const MAX_EVIDENCE_STEPS = 64;
const MAX_STEP_DEPTH = 8;
const MAX_SELECTOR_LENGTH = 128;

export const AB_GOLDEN_PATH_EVIDENCE_STEPS = [
  'abgp/01/session-authenticated',
  'abgp/02/canonical-project-context',
  'abgp/03/approved-script-authority',
  'abgp/04/approved-storyboard-authority',
  'abgp/05/exact-production-package',
  'abgp/06/canvas-entry-redeemed-server-side',
  'abgp/07/canvas-bootstrap-authority-ready',
  'abgp/08/real-canvas-editor-loaded',
  'abgp/09/browser-surface-security-verified',
] as const;

const BOOTSTRAP_AUTHORITY_STEP = AB_GOLDEN_PATH_EVIDENCE_STEPS[6];
const REAL_EDITOR_STEP = AB_GOLDEN_PATH_EVIDENCE_STEPS[7];
const ALLOWED_STEPS = new Set<string>(AB_GOLDEN_PATH_EVIDENCE_STEPS);

type JsonRecord = Record<string, unknown>;

export interface AbGoldenPathCanvasSelectorRoles {
  bootstrapAuthorityReady: string;
  realEditorLoaded: string;
}

export interface AbGoldenPathEvidenceSummary {
  verifiedStepCount: number;
  highestVerifiedStage: 'browser-surface-security-verified';
}

class AbGoldenPathEvidenceContractError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'AbGoldenPathEvidenceContractError';
    this.stack = undefined;
  }
}

function fail(code: string): never {
  throw new AbGoldenPathEvidenceContractError(code);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReport(input: unknown): JsonRecord {
  let report: unknown = input;
  if (typeof input === 'string') {
    if (Buffer.byteLength(input, 'utf8') > MAX_REPORT_TEXT_BYTES) fail(EVIDENCE_LIMIT_EXCEEDED);
    try {
      report = JSON.parse(input) as unknown;
    } catch {
      fail(EVIDENCE_SHAPE_INVALID);
    }
  }
  if (!isRecord(report)) fail(EVIDENCE_SHAPE_INVALID);
  return report;
}

function assertSelectorRole(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_SELECTOR_LENGTH ||
    value.trim() !== value
  ) {
    fail(EVIDENCE_SHAPE_INVALID);
  }
}

function assertDistinctSelectorRoles(selectors: AbGoldenPathCanvasSelectorRoles): void {
  if (!isRecord(selectors)) fail(EVIDENCE_SHAPE_INVALID);
  assertSelectorRole(selectors.bootstrapAuthorityReady);
  assertSelectorRole(selectors.realEditorLoaded);
  if (selectors.bootstrapAuthorityReady === selectors.realEditorLoaded) {
    fail(CANVAS_SELECTOR_ALIAS_FORBIDDEN);
  }
}

function pushStepTitle(target: string[], title: string): void {
  if (target.length >= MAX_EVIDENCE_STEPS) fail(EVIDENCE_LIMIT_EXCEEDED);
  target.push(title);
}

function collectStepTitles(steps: readonly unknown[], target: string[], depth: number): void {
  if (depth > MAX_STEP_DEPTH) fail(EVIDENCE_LIMIT_EXCEEDED);
  for (const stepValue of steps) {
    if (!isRecord(stepValue) || typeof stepValue.title !== 'string') {
      fail(EVIDENCE_SHAPE_INVALID);
    }
    pushStepTitle(target, stepValue.title);

    if (stepValue.steps !== undefined) {
      if (!Array.isArray(stepValue.steps)) fail(EVIDENCE_SHAPE_INVALID);
      collectStepTitles(stepValue.steps, target, depth + 1);
    }
  }
}

function collectResultSteps(results: readonly unknown[], target: string[]): void {
  if (results.length === 0) fail(EVIDENCE_SHAPE_INVALID);
  for (const resultValue of results) {
    if (!isRecord(resultValue)) fail(EVIDENCE_SHAPE_INVALID);
    if (resultValue.steps === undefined) continue;
    if (!Array.isArray(resultValue.steps)) fail(EVIDENCE_SHAPE_INVALID);
    collectStepTitles(resultValue.steps, target, 1);
  }
}

function collectTests(specs: readonly unknown[], target: string[]): void {
  for (const specValue of specs) {
    if (!isRecord(specValue) || !Array.isArray(specValue.tests)) fail(EVIDENCE_SHAPE_INVALID);
    for (const testValue of specValue.tests) {
      if (!isRecord(testValue) || !Array.isArray(testValue.results)) fail(EVIDENCE_SHAPE_INVALID);
      collectResultSteps(testValue.results, target);
    }
  }
}

function collectSuites(suites: readonly unknown[], target: string[]): void {
  for (const suiteValue of suites) {
    if (!isRecord(suiteValue)) fail(EVIDENCE_SHAPE_INVALID);
    if (suiteValue.suites !== undefined) {
      if (!Array.isArray(suiteValue.suites)) fail(EVIDENCE_SHAPE_INVALID);
      collectSuites(suiteValue.suites, target);
    }
    if (suiteValue.specs !== undefined) {
      if (!Array.isArray(suiteValue.specs)) fail(EVIDENCE_SHAPE_INVALID);
      collectTests(suiteValue.specs, target);
    }
  }
}

function readEvidenceSteps(report: JsonRecord): string[] {
  if (!Array.isArray(report.suites) || report.suites.length === 0) {
    fail(EVIDENCE_SHAPE_INVALID);
  }
  const steps: string[] = [];
  collectSuites(report.suites, steps);
  return steps;
}

function assertCanonicalEvidenceSteps(steps: readonly string[]): void {
  const seen = new Set<string>();
  for (const step of steps) {
    if (!ALLOWED_STEPS.has(step)) fail(EVIDENCE_STEP_INVALID);
    if (seen.has(step)) fail(EVIDENCE_DUPLICATE);
    seen.add(step);
  }

  if (seen.has(BOOTSTRAP_AUTHORITY_STEP) && !seen.has(REAL_EDITOR_STEP)) {
    fail(REAL_EDITOR_EVIDENCE_REQUIRED);
  }
  if (steps.length !== AB_GOLDEN_PATH_EVIDENCE_STEPS.length) fail(EVIDENCE_INCOMPLETE);

  for (let index = 0; index < AB_GOLDEN_PATH_EVIDENCE_STEPS.length; index += 1) {
    if (steps[index] !== AB_GOLDEN_PATH_EVIDENCE_STEPS[index]) fail(EVIDENCE_ORDER_INVALID);
  }
}

export function assertAbGoldenPathEvidenceContract(
  input: unknown,
  selectors: AbGoldenPathCanvasSelectorRoles,
): AbGoldenPathEvidenceSummary {
  assertDistinctSelectorRoles(selectors);
  const report = parseReport(input);
  const steps = readEvidenceSteps(report);
  assertCanonicalEvidenceSteps(steps);

  return {
    verifiedStepCount: AB_GOLDEN_PATH_EVIDENCE_STEPS.length,
    highestVerifiedStage: 'browser-surface-security-verified',
  };
}
