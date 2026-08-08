import {
  PaymentModeMismatchError,
  PaymentProviderUnavailableError,
  PaymentVerificationError,
} from './errors.js';
import type {
  NormalizedPaymentEvent,
  PaymentEventType,
  PaymentProvider,
  ProviderVerificationInput,
} from './types.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventTypes = new Set<PaymentEventType>([
  'payment_succeeded',
  'payment_failed',
  'refund_succeeded',
  'chargeback_succeeded',
]);

function payloadRecord(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new PaymentVerificationError();
  }
  return payload as Record<string, unknown>;
}

function boundedString(value: unknown, field: string, maximum: number): string {
  if (typeof value !== 'string') throw new PaymentVerificationError(`${field} is invalid.`);
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maximum) {
    throw new PaymentVerificationError(`${field} is invalid.`);
  }
  return normalized;
}

function uuid(value: unknown): string {
  const normalized = boundedString(value, 'rechargeOrderId', 36).toLowerCase();
  if (!uuidPattern.test(normalized)) {
    throw new PaymentVerificationError('rechargeOrderId is invalid.');
  }
  return normalized;
}

function amount(value: unknown): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new PaymentVerificationError('amountMinor is invalid.');
  }
  return value as number;
}

function currency(value: unknown): string {
  const normalized = boundedString(value, 'currency', 3).toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new PaymentVerificationError('currency is invalid.');
  }
  return normalized;
}

function eventType(value: unknown): PaymentEventType {
  if (typeof value !== 'string' || !eventTypes.has(value as PaymentEventType)) {
    throw new PaymentVerificationError('eventType is unsupported.');
  }
  return value as PaymentEventType;
}

function occurredAt(value: unknown): Date {
  if (typeof value !== 'string') throw new PaymentVerificationError('occurredAt is invalid.');
  const normalized = new Date(value);
  if (!Number.isFinite(normalized.getTime())) {
    throw new PaymentVerificationError('occurredAt is invalid.');
  }
  return normalized;
}

export class TestPaymentAdapter implements PaymentProvider {
  readonly mode = 'TEST' as const;

  async verify(input: ProviderVerificationInput): Promise<NormalizedPaymentEvent> {
    if (input.paymentMode !== this.mode) throw new PaymentModeMismatchError();
    const payload = payloadRecord(input.payload);
    return {
      paymentMode: 'TEST',
      providerCode: 'test-payment',
      providerEventId: boundedString(payload.providerEventId, 'providerEventId', 200),
      eventType: eventType(payload.eventType),
      rechargeOrderId: uuid(payload.rechargeOrderId),
      amountMinor: amount(payload.amountMinor),
      currency: currency(payload.currency),
      occurredAt: occurredAt(payload.occurredAt),
    };
  }
}

export class UnavailableLivePaymentAdapter implements PaymentProvider {
  readonly mode = 'LIVE' as const;

  async verify(): Promise<NormalizedPaymentEvent> {
    throw new PaymentProviderUnavailableError();
  }
}
