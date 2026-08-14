import { createHash } from 'node:crypto';
import { z } from 'zod';
import { CanvasMaterializationError, materializationError } from './materializationErrors.js';
import {
  CANVAS_MATERIALIZATION_MAX_BYTES,
  CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES,
  type CanvasAssetMaterializationRequest,
  type CanvasAssetMaterializationResponse,
  type CanvasMaterializationMime,
} from './materializationTypes.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const SESSION = /^pcs_[A-Za-z0-9_-]{24,128}$/;
const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;
const MAX_MATERIALIZATION_BASE64_CHARS = 11_184_812;

function canonicalTimestamp(value: string): boolean {
  if (!TIMESTAMP.test(value)) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

const uuid = z.string().regex(UUID);
const timestamp = z.string().refine(canonicalTimestamp);
const common = {
  contractVersion: z.literal('0.1'),
  tenantId: uuid,
  projectId: uuid,
  packageId: uuid,
  canvasSessionId: z.string().regex(SESSION),
  assetId: uuid,
  materializationAttemptId: uuid,
  requestId: z.string().regex(REQUEST_ID),
  occurredAt: timestamp,
} as const;

const requestSchema = z
  .object({
    objectType: z.literal('CanvasAssetMaterializationRequest'),
    ...common,
    actorId: uuid,
  })
  .strict();

const responseSchema = z
  .object({
    objectType: z.literal('CanvasAssetMaterialization'),
    ...common,
    materializationId: uuid,
    category: z.literal('virtual_character'),
    mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    byteSize: z.number().int().min(1).max(CANVAS_MATERIALIZATION_MAX_BYTES),
    checksum: z.string().regex(/^sha256:[a-f0-9]{64}$/),
    contentEncoding: z.literal('base64'),
    contentBase64: z.string().min(4).max(MAX_MATERIALIZATION_BASE64_CHARS),
    replayed: z.boolean(),
  })
  .strict();

export function detectCanvasMaterializationMime(bytes: Buffer): CanvasMaterializationMime | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex'))) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

export function parseCanvasAssetMaterializationRequest(
  input: unknown,
): CanvasAssetMaterializationRequest {
  const parsed = requestSchema.safeParse(input);
  if (
    !parsed.success ||
    Buffer.byteLength(JSON.stringify(parsed.data), 'utf8') > CANVAS_MATERIALIZATION_MAX_REQUEST_BYTES
  ) {
    throw materializationError('CANVAS_MATERIALIZATION_REQUEST_INVALID');
  }
  return parsed.data;
}

function candidate(input: unknown): Record<string, unknown> | null {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : null;
}

function isBase64Alphabet(code: number): boolean {
  return (
    (code >= 0x41 && code <= 0x5a) ||
    (code >= 0x61 && code <= 0x7a) ||
    (code >= 0x30 && code <= 0x39) ||
    code === 0x2b ||
    code === 0x2f
  );
}

function decodeCanonicalBase64(value: string): Buffer | null {
  if (value.length < 4 || value.length % 4 !== 0) return null;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const contentLength = value.length - padding;
  if (
    (padding === 0 && contentLength % 4 !== 0) ||
    (padding === 1 && contentLength % 4 !== 3) ||
    (padding === 2 && contentLength % 4 !== 2)
  ) {
    return null;
  }
  for (let index = 0; index < contentLength; index += 1) {
    if (!isBase64Alphabet(value.charCodeAt(index))) return null;
  }
  for (let index = contentLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 0x3d) return null;
  }
  const bytes = Buffer.from(value, 'base64');
  return bytes.toString('base64') === value ? bytes : null;
}

function parseCanvasAssetMaterializationResponseInternal(
  input: unknown,
): CanvasAssetMaterializationResponse {
  const raw = candidate(input);
  if (raw?.category !== undefined && raw.category !== 'virtual_character') {
    throw materializationError('CANVAS_MATERIALIZATION_CATEGORY_UNSUPPORTED');
  }
  if (raw && (raw.byteSize === 0 || raw.contentBase64 === '')) {
    throw materializationError('CANVAS_MATERIALIZATION_SOURCE_EMPTY');
  }
  if (typeof raw?.byteSize === 'number' && raw.byteSize > CANVAS_MATERIALIZATION_MAX_BYTES) {
    throw materializationError('CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE');
  }
  if (
    raw?.mimeType !== undefined &&
    !['image/jpeg', 'image/png', 'image/webp'].includes(String(raw.mimeType))
  ) {
    throw materializationError('CANVAS_MATERIALIZATION_MIME_UNSUPPORTED');
  }
  if (
    typeof raw?.contentBase64 === 'string' &&
    raw.contentBase64.length > MAX_MATERIALIZATION_BASE64_CHARS
  ) {
    throw materializationError('CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE');
  }
  const decoded =
    typeof raw?.contentBase64 === 'string' ? decodeCanonicalBase64(raw.contentBase64) : null;
  if (typeof raw?.contentBase64 === 'string' && decoded === null) {
    throw materializationError('CANVAS_MATERIALIZATION_RESPONSE_INVALID');
  }
  const parsed = responseSchema.safeParse(input);
  if (!parsed.success) throw materializationError('CANVAS_MATERIALIZATION_RESPONSE_INVALID');
  const bytes = decoded!;
  if (bytes.length === 0) throw materializationError('CANVAS_MATERIALIZATION_SOURCE_EMPTY');
  if (bytes.length > CANVAS_MATERIALIZATION_MAX_BYTES) {
    throw materializationError('CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE');
  }
  const mimeType = detectCanvasMaterializationMime(bytes);
  if (!mimeType) throw materializationError('CANVAS_MATERIALIZATION_MIME_UNSUPPORTED');
  const checksum = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
  if (
    parsed.data.byteSize !== bytes.length ||
    parsed.data.mimeType !== mimeType ||
    parsed.data.checksum !== checksum
  ) {
    throw materializationError('CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED');
  }
  return parsed.data;
}

export function parseCanvasAssetMaterializationResponse(
  input: unknown,
): CanvasAssetMaterializationResponse {
  try {
    return parseCanvasAssetMaterializationResponseInternal(input);
  } catch (error) {
    if (error instanceof CanvasMaterializationError) throw error;
    throw materializationError('CANVAS_MATERIALIZATION_RESPONSE_INVALID');
  }
}
