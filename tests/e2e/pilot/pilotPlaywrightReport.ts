const REPORT_REQUIRED = 'PILOT_E2E_REPORT_REQUIRED';
const REPORT_JSON_INVALID = 'PILOT_E2E_REPORT_JSON_INVALID';
const REPORT_SHAPE_INVALID = 'PILOT_E2E_REPORT_SHAPE_INVALID';
const REPORT_SUITES_EMPTY = 'PILOT_E2E_REPORT_SUITES_EMPTY';
const REPORT_STATS_INVALID = 'PILOT_E2E_REPORT_STATS_INVALID';
const REPORT_TOTAL_INVALID = 'PILOT_E2E_REPORT_TOTAL_INVALID';
const REPORT_EXPECTED_INVALID = 'PILOT_E2E_REPORT_EXPECTED_INVALID';
const REPORT_FAILED = 'PILOT_E2E_REPORT_FAILED';
const REPORT_SKIPPED = 'PILOT_E2E_REPORT_SKIPPED';
const REPORT_FLAKY = 'PILOT_E2E_REPORT_FLAKY';
const REPORT_INTERRUPTED = 'PILOT_E2E_REPORT_INTERRUPTED';
const REPORT_PASSED_MISMATCH = 'PILOT_E2E_REPORT_PASSED_MISMATCH';

const COUNT_FIELDS = [
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

const REQUIRED_PLAYWRIGHT_COUNT_FIELDS = ['expected', 'skipped', 'unexpected', 'flaky'] as const;

const RESULT_STATUSES = new Set(['passed', 'failed', 'timedOut', 'skipped', 'interrupted']);

type JsonRecord = Record<string, unknown>;
type CountField = (typeof COUNT_FIELDS)[number];

interface DerivedCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  fixme: number;
  flaky: number;
  interrupted: number;
}

export interface PilotPlaywrightReportSummary {
  total: number;
  expected: number;
  passed: number;
}

function fail(code: string): never {
  throw new Error(code);
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseReport(input: unknown): JsonRecord {
  if (input === undefined || input === null) fail(REPORT_REQUIRED);

  let report: unknown = input;
  if (typeof input === 'string') {
    if (input.trim().length === 0) fail(REPORT_REQUIRED);
    try {
      report = JSON.parse(input) as unknown;
    } catch {
      fail(REPORT_JSON_INVALID);
    }
  }

  if (!isRecord(report)) fail(REPORT_SHAPE_INVALID);
  return report;
}

function readStats(report: JsonRecord): JsonRecord {
  if (!isRecord(report.stats)) fail(REPORT_STATS_INVALID);

  const stats = report.stats;
  for (const field of REQUIRED_PLAYWRIGHT_COUNT_FIELDS) {
    if (!(field in stats)) fail(REPORT_STATS_INVALID);
  }
  for (const field of COUNT_FIELDS) {
    if (field in stats && !isSafeCount(stats[field])) fail(REPORT_STATS_INVALID);
  }
  return stats;
}

function isSafeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function count(stats: JsonRecord, field: CountField): number {
  const value = stats[field];
  return typeof value === 'number' ? value : 0;
}

function collectTests(suites: readonly unknown[]): JsonRecord[] {
  const tests: JsonRecord[] = [];
  for (const suiteValue of suites) {
    if (!isRecord(suiteValue)) fail(REPORT_SHAPE_INVALID);

    const nestedSuites = suiteValue.suites;
    if (nestedSuites !== undefined) {
      if (!Array.isArray(nestedSuites)) fail(REPORT_SHAPE_INVALID);
      tests.push(...collectTests(nestedSuites));
    }

    const specs = suiteValue.specs;
    if (specs === undefined) continue;
    if (!Array.isArray(specs)) fail(REPORT_SHAPE_INVALID);
    for (const specValue of specs) {
      if (!isRecord(specValue) || !Array.isArray(specValue.tests)) fail(REPORT_SHAPE_INVALID);
      for (const testValue of specValue.tests) {
        if (!isRecord(testValue)) fail(REPORT_SHAPE_INVALID);
        tests.push(testValue);
      }
    }
  }
  return tests;
}

function annotationTypes(test: JsonRecord): Set<string> {
  if (test.annotations === undefined) return new Set();
  if (!Array.isArray(test.annotations)) fail(REPORT_SHAPE_INVALID);

  const types = new Set<string>();
  for (const annotation of test.annotations) {
    if (!isRecord(annotation) || typeof annotation.type !== 'string') {
      fail(REPORT_SHAPE_INVALID);
    }
    types.add(annotation.type.toLowerCase());
  }
  return types;
}

function terminalStatuses(test: JsonRecord): string[] {
  if (!Array.isArray(test.results) || test.results.length === 0) fail(REPORT_SHAPE_INVALID);

  return test.results.map((result) => {
    if (!isRecord(result) || typeof result.status !== 'string') fail(REPORT_SHAPE_INVALID);
    if (!RESULT_STATUSES.has(result.status)) fail(REPORT_SHAPE_INVALID);
    return result.status;
  });
}

function deriveCounts(tests: readonly JsonRecord[]): DerivedCounts {
  const counts: DerivedCounts = {
    total: tests.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    fixme: 0,
    flaky: 0,
    interrupted: 0,
  };

  for (const reportTest of tests) {
    const annotations = annotationTypes(reportTest);
    const statuses = terminalStatuses(reportTest);
    const terminalStatus = statuses.at(-1);

    if (annotations.has('fixme')) counts.fixme += 1;
    if (
      annotations.has('skip') ||
      reportTest.expectedStatus === 'skipped' ||
      terminalStatus === 'skipped'
    ) {
      counts.skipped += 1;
    }

    if (terminalStatus === 'passed') counts.passed += 1;
    else if (terminalStatus === 'failed' || terminalStatus === 'timedOut') counts.failed += 1;
    else if (terminalStatus === 'interrupted') counts.interrupted += 1;

    if (
      terminalStatus === 'passed' &&
      statuses.slice(0, -1).some((status) => status !== 'passed' && status !== 'skipped')
    ) {
      counts.flaky += 1;
    }
  }

  return counts;
}

export function assertPilotPlaywrightReport(input: unknown): PilotPlaywrightReportSummary {
  const report = parseReport(input);
  const stats = readStats(report);

  if (!Array.isArray(report.suites) || report.suites.length === 0) {
    fail(REPORT_SUITES_EMPTY);
  }

  const derived = deriveCounts(collectTests(report.suites));
  const declaredTotal = 'total' in stats ? count(stats, 'total') : derived.total;
  if (derived.total <= 0 || declaredTotal <= 0 || declaredTotal !== derived.total) {
    fail(REPORT_TOTAL_INVALID);
  }

  const expected = count(stats, 'expected');
  if (expected <= 0) fail(REPORT_EXPECTED_INVALID);

  if (derived.failed > 0 || count(stats, 'failed') > 0 || count(stats, 'unexpected') > 0) {
    fail(REPORT_FAILED);
  }
  if (
    derived.skipped > 0 ||
    derived.fixme > 0 ||
    count(stats, 'skipped') > 0 ||
    count(stats, 'fixme') > 0
  ) {
    fail(REPORT_SKIPPED);
  }
  if (derived.flaky > 0 || count(stats, 'flaky') > 0) fail(REPORT_FLAKY);
  if (derived.interrupted > 0 || count(stats, 'interrupted') > 0) {
    fail(REPORT_INTERRUPTED);
  }

  const declaredPassed = 'passed' in stats ? count(stats, 'passed') : derived.passed;
  if (declaredPassed !== derived.passed || derived.passed !== expected) {
    fail(REPORT_PASSED_MISMATCH);
  }

  return {
    total: derived.total,
    expected,
    passed: derived.passed,
  };
}
