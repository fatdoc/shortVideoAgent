import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AB_GOLDEN_PATH_EVIDENCE_STEPS,
  assertAbGoldenPathEvidenceContract,
  type AbGoldenPathCanvasSelectorRoles,
} from './abGoldenPathEvidenceContract.js';

type MutableRecord = Record<string, unknown>;

const DISTINCT_SELECTORS: AbGoldenPathCanvasSelectorRoles = {
  bootstrapAuthorityReady: 'pilot-storycanvas-boundary-ready',
  realEditorLoaded: 'pilot-storycanvas-editor-loaded',
};

function reportWithSteps(stepTitles: readonly string[]): MutableRecord {
  return {
    suites: [
      {
        title: 'A/B Golden Path',
        specs: [
          {
            title: 'uses approved production authorities',
            tests: [
              {
                expectedStatus: 'passed',
                annotations: [],
                results: [
                  {
                    status: 'passed',
                    steps: stepTitles.map((title) => ({ title, category: 'test.step' })),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    stats: { expected: 1, skipped: 0, unexpected: 0, flaky: 0 },
  };
}

function assertSafeError(
  report: unknown,
  selectors: AbGoldenPathCanvasSelectorRoles,
  code: string,
  forbidden?: RegExp,
): void {
  assert.throws(
    () => assertAbGoldenPathEvidenceContract(report, selectors),
    (error: Error) => {
      assert.equal(error.message, code);
      assert.equal(error.stack, undefined);
      if (forbidden) assert.doesNotMatch(error.message, forbidden);
      return true;
    },
  );
}

test('rejects bootstrap authority as real editor evidence', () => {
  const bootstrapOnly = AB_GOLDEN_PATH_EVIDENCE_STEPS.slice(0, 7);

  assertSafeError(
    reportWithSteps(bootstrapOnly),
    DISTINCT_SELECTORS,
    'PILOT_E2E_REAL_EDITOR_EVIDENCE_REQUIRED',
    /bootstrap|selector|package|canvasSession/i,
  );
});

test('rejects selector aliasing between bootstrap authority and the real editor', () => {
  assertSafeError(
    reportWithSteps(AB_GOLDEN_PATH_EVIDENCE_STEPS),
    {
      bootstrapAuthorityReady: 'pilot-storycanvas-boundary-ready',
      realEditorLoaded: 'pilot-storycanvas-boundary-ready',
    },
    'PILOT_E2E_CANVAS_SELECTOR_ALIAS_FORBIDDEN',
    /pilot-storycanvas-boundary-ready/i,
  );
});

test('accepts the complete ordered semantic evidence without declaring gate completion', () => {
  const result = assertAbGoldenPathEvidenceContract(
    reportWithSteps(AB_GOLDEN_PATH_EVIDENCE_STEPS),
    DISTINCT_SELECTORS,
  );

  assert.deepEqual(result, {
    verifiedStepCount: AB_GOLDEN_PATH_EVIDENCE_STEPS.length,
    highestVerifiedStage: 'browser-surface-security-verified',
  });
  assert.equal('gateComplete' in result, false);
  assert.equal('jointGatePass' in result, false);
  assert.equal('goldenPathComplete' in result, false);
});

test('rejects missing, duplicate, and out-of-order evidence steps with fixed safe codes', () => {
  const missing = AB_GOLDEN_PATH_EVIDENCE_STEPS.filter(
    (step) => step !== 'abgp/05/exact-production-package',
  );
  assertSafeError(
    reportWithSteps(missing),
    DISTINCT_SELECTORS,
    'PILOT_E2E_GOLDEN_PATH_EVIDENCE_INCOMPLETE',
  );

  const duplicate = [...AB_GOLDEN_PATH_EVIDENCE_STEPS];
  duplicate.splice(4, 0, duplicate[3]);
  assertSafeError(
    reportWithSteps(duplicate),
    DISTINCT_SELECTORS,
    'PILOT_E2E_GOLDEN_PATH_EVIDENCE_DUPLICATE',
  );

  const outOfOrder = [...AB_GOLDEN_PATH_EVIDENCE_STEPS];
  [outOfOrder[2], outOfOrder[3]] = [outOfOrder[3], outOfOrder[2]];
  assertSafeError(
    reportWithSteps(outOfOrder),
    DISTINCT_SELECTORS,
    'PILOT_E2E_GOLDEN_PATH_EVIDENCE_ORDER_INVALID',
  );
});

test('rejects malformed or oversized report step structures without echoing them', () => {
  const malformed = reportWithSteps(AB_GOLDEN_PATH_EVIDENCE_STEPS);
  const suite = (malformed.suites as MutableRecord[])[0];
  const spec = (suite.specs as MutableRecord[])[0];
  const reportTest = (spec.tests as MutableRecord[])[0];
  const result = (reportTest.results as MutableRecord[])[0];
  result.steps = 'FAKE_SENSITIVE_STEP_SHAPE_DO_NOT_USE';
  assertSafeError(
    malformed,
    DISTINCT_SELECTORS,
    'PILOT_E2E_GOLDEN_PATH_EVIDENCE_SHAPE_INVALID',
    /FAKE_SENSITIVE_STEP_SHAPE_DO_NOT_USE/,
  );

  const oversized = reportWithSteps(
    Array.from({ length: 65 }, (_, index) => `FAKE_OVERSIZED_STEP_${index}`),
  );
  assertSafeError(
    oversized,
    DISTINCT_SELECTORS,
    'PILOT_E2E_GOLDEN_PATH_EVIDENCE_LIMIT_EXCEEDED',
    /FAKE_OVERSIZED_STEP/,
  );
});
