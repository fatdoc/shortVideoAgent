import { createHash, createHmac } from 'node:crypto';
import type { NormalizedPaymentEvent, PaymentMode } from './types.js';

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(',')}}`;
}

export type RechargeOrderDigestFacts = {
  tenantId: string;
  tenantOrganizationId: string;
  buyerUserId: string;
  buyerMembershipId: string;
  paymentMode: PaymentMode;
  conversionRuleVersionId: string;
  idempotencyKey: string;
};

export function rechargeOrderRequestDigest(
  secret: string,
  facts: RechargeOrderDigestFacts,
): string {
  return createHmac('sha256', secret).update(canonicalJson(facts), 'utf8').digest('hex');
}

export function paymentEventDigest(event: NormalizedPaymentEvent): string {
  return createHash('sha256')
    .update(
      canonicalJson({
        paymentMode: event.paymentMode,
        providerCode: event.providerCode,
        providerEventId: event.providerEventId,
        eventType: event.eventType,
        rechargeOrderId: event.rechargeOrderId,
        amountMinor: event.amountMinor,
        currency: event.currency,
        occurredAt: event.occurredAt.toISOString(),
      }),
      'utf8',
    )
    .digest('hex');
}
