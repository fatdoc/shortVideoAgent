import { createHash, createHmac } from 'node:crypto';

export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export type CommissionSettlementRequestDigestFacts = {
  paymentMode: 'TEST';
  beneficiaryChannelId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  cutoffAt: string;
  idempotencyKey: string;
};

export function commissionSettlementRequestDigest(
  secret: string,
  facts: CommissionSettlementRequestDigestFacts,
): string {
  return createHmac('sha256', secret).update(canonicalJson(facts), 'utf8').digest('hex');
}

export function commissionSettlementSnapshotDigest(snapshot: unknown): string {
  return createHash('sha256').update(canonicalJson(snapshot), 'utf8').digest('hex');
}
