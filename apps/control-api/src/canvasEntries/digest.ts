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

function hmacDigest(secret: string, value: unknown): string {
  return `sha256:${createHmac('sha256', secret).update(canonicalJson(value), 'utf8').digest('hex')}`;
}

export type CanvasEntryRequestFacts = {
  tenantId: string;
  projectId: string;
  packageId: string;
  idempotencyKey: string;
  ttlSeconds: number;
  createdBy: string;
};

export type CanvasEntryRedemptionRequestFacts = {
  handle: string;
  tenantId: string;
  projectId: string;
  packageId: string;
  idempotencyKey: string;
  redeemedBy: string;
};

export function canvasEntryRequestDigest(secret: string, facts: CanvasEntryRequestFacts): string {
  return hmacDigest(secret, {
    operation: 'canvas-entry.create',
    contractVersion: '0.2',
    ...facts,
  });
}

export function canvasEntryRedemptionRequestDigest(
  secret: string,
  facts: CanvasEntryRedemptionRequestFacts,
): string {
  return hmacDigest(secret, {
    operation: 'canvas-entry.redeem',
    contractVersion: '0.1',
    ...facts,
  });
}
