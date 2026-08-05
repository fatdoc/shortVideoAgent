import { contractPayloadDigest } from './digest.js';
import type { IdempotencyInput } from './types.js';

export function productionIdempotencyDigest(
  tenantId: string,
  input: IdempotencyInput,
): string {
  return contractPayloadDigest({
    tenantId,
    operation: input.operation,
    idempotencyKey: input.key,
    scope: input.scope,
    payload: input.payload,
  });
}
