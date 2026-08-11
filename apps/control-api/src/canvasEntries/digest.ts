import { createHmac } from 'node:crypto';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export type CanvasEntryRequestFacts = {
  tenantId: string;
  projectId: string;
  packageId: string;
  idempotencyKey: string;
  ttlSeconds: number;
  createdBy: string;
};

export function canvasEntryRequestDigest(secret: string, facts: CanvasEntryRequestFacts): string {
  return `sha256:${createHmac('sha256', secret)
    .update(
      canonicalJson({
        operation: 'canvas-entry.create',
        contractVersion: '0.2',
        ...facts,
      }),
      'utf8',
    )
    .digest('hex')}`;
}
