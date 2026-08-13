import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertPilotPlaywrightReport,
  type PilotPlaywrightReportSummary,
} from './pilotPlaywrightReport.js';

type MutableRecord = Record<string, unknown>;

function validReport(): MutableRecord {
  return {
    suites: [
      {
        title: 'A/B Golden Path',
        specs: [
          {
            title: 'opens the approved Canvas entry',
            tests: [
              {
                expectedStatus: 'passed',
                annotations: [],
                results: [{ status: 'passed' }],
              },
            ],
          },
        ],
      },
    ],
    stats: {
      expected: 1,
      skipped: 0,
      unexpected: 0,
      flaky: 0,
    },
  };
}

function stats(report: MutableRecord): MutableRecord {
  return report.stats as MutableRecord;
}

function firstTest(report: MutableRecord): MutableRecord {
  const suite = (report.suites as MutableRecord[])[0];
  const spec = (suite.specs as MutableRecord[])[0];
  return (spec.tests as MutableRecord[])[0];
}

function assertSafeError(input: unknown, code: string, forbidden?: string): void {
  assert.throws(
    () => assertPilotPlaywrightReport(input),
    (error: Error) => {
      assert.equal(error.message, code);
      if (forbidden) assert.doesNotMatch(error.message, new RegExp(forbidden));
      return true;
    },
  );
}

test('accepts a zero-skip Playwright JSON report from an object or JSON text', () => {
  const expected: PilotPlaywrightReportSummary = {
    total: 1,
    expected: 1,
    passed: 1,
  };

  assert.deepEqual(assertPilotPlaywrightReport(validReport()), expected);
  assert.deepEqual(assertPilotPlaywrightReport(JSON.stringify(validReport())), expected);
});

test('rejects a missing report with a fixed safe code', () => {
  for (const input of [undefined, null, '', '   ']) {
    assertSafeError(input, 'PILOT_E2E_REPORT_REQUIRED');
  }
});

test('rejects invalid JSON without echoing report content', () => {
  const unsafeJson = '{"secret":"FAKE_REPORT_SECRET_DO_NOT_USE"';
  assertSafeError(unsafeJson, 'PILOT_E2E_REPORT_JSON_INVALID', 'FAKE_REPORT_SECRET_DO_NOT_USE');
});

test('rejects a report without a non-empty suites array', () => {
  for (const suites of [undefined, null, 'not-an-array', []]) {
    const report = validReport();
    report.suites = suites;
    assertSafeError(report, 'PILOT_E2E_REPORT_SUITES_EMPTY');
  }
});

test('rejects reports whose derived or declared total is not positive', () => {
  const emptyReport = validReport();
  (emptyReport.suites as MutableRecord[])[0].specs = [];
  assertSafeError(emptyReport, 'PILOT_E2E_REPORT_TOTAL_INVALID');

  const declaredZero = validReport();
  stats(declaredZero).total = 0;
  assertSafeError(declaredZero, 'PILOT_E2E_REPORT_TOTAL_INVALID');
});

test('rejects reports whose expected count is not positive', () => {
  const report = validReport();
  stats(report).expected = 0;
  assertSafeError(report, 'PILOT_E2E_REPORT_EXPECTED_INVALID');
});

test('rejects failed or unexpected results', () => {
  const failed = validReport();
  (firstTest(failed).results as MutableRecord[])[0].status = 'failed';
  assertSafeError(failed, 'PILOT_E2E_REPORT_FAILED');

  const unexpected = validReport();
  stats(unexpected).unexpected = 1;
  assertSafeError(unexpected, 'PILOT_E2E_REPORT_FAILED', '1');

  const declaredFailed = validReport();
  stats(declaredFailed).failed = 1;
  assertSafeError(declaredFailed, 'PILOT_E2E_REPORT_FAILED');
});

test('rejects skipped and fixme results', () => {
  const skipped = validReport();
  stats(skipped).skipped = 1;
  assertSafeError(skipped, 'PILOT_E2E_REPORT_SKIPPED');

  const fixme = validReport();
  firstTest(fixme).annotations = [{ type: 'fixme', description: 'synthetic reason' }];
  assertSafeError(fixme, 'PILOT_E2E_REPORT_SKIPPED');

  const declaredFixme = validReport();
  stats(declaredFixme).fixme = 1;
  assertSafeError(declaredFixme, 'PILOT_E2E_REPORT_SKIPPED');
});

test('rejects flaky results', () => {
  const report = validReport();
  stats(report).flaky = 1;
  assertSafeError(report, 'PILOT_E2E_REPORT_FLAKY');
});

test('rejects interrupted results', () => {
  const report = validReport();
  (firstTest(report).results as MutableRecord[])[0].status = 'interrupted';
  assertSafeError(report, 'PILOT_E2E_REPORT_INTERRUPTED');

  const declaredInterrupted = validReport();
  stats(declaredInterrupted).interrupted = 1;
  assertSafeError(declaredInterrupted, 'PILOT_E2E_REPORT_INTERRUPTED');
});

test('rejects reports whose passed count does not equal expected', () => {
  const report = validReport();
  stats(report).expected = 2;
  assertSafeError(report, 'PILOT_E2E_REPORT_PASSED_MISMATCH');

  const declaredMismatch = validReport();
  stats(declaredMismatch).passed = 2;
  assertSafeError(declaredMismatch, 'PILOT_E2E_REPORT_PASSED_MISMATCH');
});

test('rejects non-safe count statistics with a fixed safe code', () => {
  const fields = [
    'total',
    'expected',
    'passed',
    'failed',
    'unexpected',
    'skipped',
    'fixme',
    'flaky',
    'interrupted',
  ] as const;
  const invalidValues = [
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1.5,
    -1,
    Number.MAX_SAFE_INTEGER + 1,
  ];

  for (const field of fields) {
    for (const value of invalidValues) {
      const report = validReport();
      stats(report)[field] = value;
      assertSafeError(report, 'PILOT_E2E_REPORT_STATS_INVALID');
    }
  }
});

test('never echoes report fields or values in validation errors', () => {
  const report = validReport();
  stats(report).unexpected = 987654321;
  report.internalPayload = 'FAKE_INTERNAL_REPORT_PAYLOAD_DO_NOT_USE';

  assertSafeError(report, 'PILOT_E2E_REPORT_FAILED', '987654321');
});
