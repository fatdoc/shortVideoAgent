export type PilotCanvasRemediationErrorKind = 'malformed-json' | 'oversized-json';

export interface PilotCanvasErrorResponseInput {
  kind: PilotCanvasRemediationErrorKind;
  status: number;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
  body: unknown;
  requestBody?: string | Uint8Array;
  sensitiveValues?: readonly string[];
}

export interface PilotCanvasRuntimeOutputInput {
  expectedState: 'ready-stopped' | 'blocked';
  stdout: string;
  stderr: string;
  stdoutTruncated: boolean;
  stderrTruncated: boolean;
  dataRoot?: string;
  sensitiveValues?: readonly string[];
}

interface ExpectedErrorContract {
  status: number;
  code: string;
  message: string;
}

const ERROR_CONTRACTS: Readonly<Record<PilotCanvasRemediationErrorKind, ExpectedErrorContract>> = {
  'malformed-json': {
    status: 400,
    code: 'PILOT_CANVAS_MALFORMED_JSON',
    message: 'Pilot Canvas request body is invalid.',
  },
  'oversized-json': {
    status: 413,
    code: 'PILOT_CANVAS_REQUEST_TOO_LARGE',
    message: 'Pilot Canvas request body is too large.',
  },
};

const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const JSON_CONTENT_TYPE_PATTERN = /^application\/json(?:\s*;\s*charset=utf-8)?$/i;
const READY_PATTERN = /^PILOT_CANVAS_RUNTIME_READY http:\/\/127\.0\.0\.1:(\d{1,5})$/;
const MAX_EVIDENCE_NODES = 10_000;
const MAX_EVIDENCE_BYTES = 1024 * 1024;

const FORBIDDEN_RESPONSE_MARKERS = [
  /\bcookie\s*[:=]/i,
  /\bvideoagent_session\s*=/i,
  /\bx-storycanvas-csrf\s*[:=]/i,
  /\b(?:authorization|proxy-authorization)\s*[:=]/i,
  /["']?(?:access|internal|project[_-]?grant|production[_-]?plane[_-]?internal)[_-]?token["']?\s*[:=]/i,
  /["']?grant[_-]?id["']?\s*[:=]/i,
  /["']?(?:package|grant|entry|script|storyboard)(?:[_-]?payload)?[_-]?digest["']?\s*[:=]/i,
  /\bstorycanvas_data_root\s*[:=]/i,
  /(?:\/private)?\/tmp\/[^\s"'<>]*storycanvas[^\s"'<>]*/i,
  /\/private\/var\/folders\/[^\s"'<>]*storycanvas[^\s"'<>]*/i,
  /(?:^|\n)\s*at\s+(?:async\s+)?(?:[\w$.<>]+\s+\()?[^)\n]+:\d+:\d+\)?/m,
  /\bentity\.(?:parse\.failed|too\.large)\b/i,
  /\bSyntaxError\b/i,
  /\bUnexpected token\b/i,
] as const;

function fail(code: string): never {
  const error = new Error(code);
  error.stack = undefined;
  throw error;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function ownKeysExactly(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value).sort();
  return keys.length === expected.length && keys.every((key, index) => key === expected[index]);
}

function collectEvidenceText(input: unknown, failureCode: string): string {
  const pending: unknown[] = [input];
  const seen = new WeakSet<object>();
  const chunks: string[] = [];
  let nodes = 0;
  let bytes = 0;

  while (pending.length > 0) {
    const value = pending.pop();
    nodes += 1;
    if (nodes > MAX_EVIDENCE_NODES) fail(failureCode);

    if (value === null || value === undefined) continue;
    if (typeof value === 'string') {
      bytes += Buffer.byteLength(value);
      if (bytes > MAX_EVIDENCE_BYTES) fail(failureCode);
      chunks.push(value);
      continue;
    }
    if (typeof value === 'number' || typeof value === 'boolean') continue;
    if (typeof value !== 'object') fail(failureCode);
    if (seen.has(value)) fail(failureCode);
    seen.add(value);

    if (value instanceof Uint8Array) {
      const text = Buffer.from(value).toString('utf8');
      bytes += Buffer.byteLength(text);
      if (bytes > MAX_EVIDENCE_BYTES) fail(failureCode);
      chunks.push(text);
      continue;
    }

    let keys: string[];
    try {
      keys = Object.keys(value);
    } catch {
      fail(failureCode);
    }
    for (const key of keys) {
      chunks.push(key);
      bytes += Buffer.byteLength(key);
      if (bytes > MAX_EVIDENCE_BYTES) fail(failureCode);
      try {
        pending.push((value as Record<string, unknown>)[key]);
      } catch {
        fail(failureCode);
      }
    }
  }

  return chunks.join('\n');
}

function requestBodyNeedles(requestBody: string | Uint8Array | undefined): string[] {
  if (requestBody === undefined) return [];
  const text =
    typeof requestBody === 'string' ? requestBody : Buffer.from(requestBody).toString('utf8');
  const needles = new Set<string>();
  if (text.length >= 8 && text.length <= 4096) needles.add(text);
  for (const match of text.matchAll(/[A-Za-z0-9_.:/=-]{8,}/g)) {
    const value = match[0];
    needles.add(value.length <= 512 ? value : value.slice(0, 512));
    if (needles.size >= 128) break;
  }
  return [...needles];
}

function containsSensitiveContent(text: string, needles: readonly string[]): boolean {
  if (FORBIDDEN_RESPONSE_MARKERS.some((marker) => marker.test(text))) return true;
  return needles.some((needle) => needle.length >= 8 && text.includes(needle));
}

function normalizeHeaders(
  headers: PilotCanvasErrorResponseInput['headers'],
): Map<string, string | readonly string[] | undefined> {
  const normalized = new Map<string, string | readonly string[] | undefined>();
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();
    if (normalized.has(key)) fail('SHARED_CANVAS_HTTP_HEADERS_INVALID');
    normalized.set(key, value);
  }
  return normalized;
}

function singleHeader(
  headers: ReadonlyMap<string, string | readonly string[] | undefined>,
  name: string,
): string | undefined {
  const value = headers.get(name);
  return typeof value === 'string' ? value : undefined;
}

function assertResponseContentSafe(input: PilotCanvasErrorResponseInput): void {
  const responseText = collectEvidenceText(
    { headers: input.headers, body: input.body },
    'SHARED_CANVAS_HTTP_EVIDENCE_INVALID',
  );
  const needles = [
    ...requestBodyNeedles(input.requestBody),
    ...(input.sensitiveValues ?? []).filter((value) => value.length >= 8),
  ];
  if (containsSensitiveContent(responseText, needles)) {
    fail('SHARED_CANVAS_HTTP_SENSITIVE_CONTENT');
  }
}

export function assertSafePilotCanvasErrorResponse(input: PilotCanvasErrorResponseInput): void {
  const contract = ERROR_CONTRACTS[input.kind];
  if (input.status !== contract.status) fail('SHARED_CANVAS_HTTP_STATUS_INVALID');

  const headers = normalizeHeaders(input.headers);
  const contentType = singleHeader(headers, 'content-type');
  const cacheControl = singleHeader(headers, 'cache-control');
  if (
    contentType === undefined ||
    !JSON_CONTENT_TYPE_PATTERN.test(contentType) ||
    cacheControl?.toLowerCase() !== 'no-store'
  ) {
    fail('SHARED_CANVAS_HTTP_HEADERS_INVALID');
  }

  const headerRequestId = singleHeader(headers, 'x-request-id');
  if (headerRequestId === undefined || !REQUEST_ID_PATTERN.test(headerRequestId)) {
    fail('SHARED_CANVAS_HTTP_REQUEST_ID_INVALID');
  }

  assertResponseContentSafe(input);

  if (!isPlainRecord(input.body) || !ownKeysExactly(input.body, ['error'])) {
    fail('SHARED_CANVAS_HTTP_ENVELOPE_INVALID');
  }
  const envelope = input.body.error;
  if (
    !isPlainRecord(envelope) ||
    !ownKeysExactly(envelope, ['code', 'message', 'requestId', 'retryable'])
  ) {
    fail('SHARED_CANVAS_HTTP_ENVELOPE_INVALID');
  }
  if (
    envelope.code !== contract.code ||
    envelope.message !== contract.message ||
    envelope.retryable !== false
  ) {
    fail('SHARED_CANVAS_HTTP_ENVELOPE_INVALID');
  }
  if (
    typeof envelope.requestId !== 'string' ||
    !REQUEST_ID_PATTERN.test(envelope.requestId) ||
    envelope.requestId !== headerRequestId
  ) {
    fail('SHARED_CANVAS_HTTP_REQUEST_ID_INVALID');
  }
}

function assertRuntimeSensitiveContentSafe(input: PilotCanvasRuntimeOutputInput): void {
  const needles = [input.dataRoot, ...(input.sensitiveValues ?? [])].filter(
    (value): value is string => typeof value === 'string' && value.length >= 8,
  );
  if (needles.some((needle) => input.stdout.includes(needle))) {
    fail('SHARED_CANVAS_RUNTIME_SENSITIVE_CONTENT');
  }
}

function stdoutLines(stdout: string): string[] {
  const normalized = stdout.endsWith('\n') ? stdout.slice(0, -1) : stdout;
  return normalized === '' ? [] : normalized.split('\n');
}

function isReadyLine(line: string): boolean {
  const match = READY_PATTERN.exec(line);
  if (match === null) return false;
  const port = Number(match[1]);
  return Number.isInteger(port) && port >= 1 && port <= 65_535;
}

export function assertSafePilotCanvasRuntimeOutput(input: PilotCanvasRuntimeOutputInput): void {
  if (input.stdoutTruncated || input.stderrTruncated) {
    fail('SHARED_CANVAS_RUNTIME_OUTPUT_TRUNCATED');
  }
  if (input.stderr !== '') fail('SHARED_CANVAS_RUNTIME_STDERR_FORBIDDEN');

  assertRuntimeSensitiveContentSafe(input);

  const lines = stdoutLines(input.stdout);
  for (const line of lines) {
    if (
      line !== 'PILOT_CANVAS_RUNTIME_BLOCKED' &&
      line !== 'PILOT_CANVAS_RUNTIME_STOPPED' &&
      !isReadyLine(line)
    ) {
      fail('SHARED_CANVAS_RUNTIME_OUTPUT_INVALID');
    }
  }

  if (input.expectedState === 'blocked') {
    if (lines.length !== 1 || lines[0] !== 'PILOT_CANVAS_RUNTIME_BLOCKED') {
      fail('SHARED_CANVAS_RUNTIME_MARKER_INVALID');
    }
    return;
  }

  if (
    lines.length !== 2 ||
    !isReadyLine(lines[0] ?? '') ||
    lines[1] !== 'PILOT_CANVAS_RUNTIME_STOPPED'
  ) {
    fail('SHARED_CANVAS_RUNTIME_MARKER_INVALID');
  }
}
