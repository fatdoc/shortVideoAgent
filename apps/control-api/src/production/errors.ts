export type ProductionErrorCode =
  | 'SCHEMA_INVALID'
  | 'CAPABILITY_SCOPE_DENIED'
  | 'GRANT_INVALID'
  | 'GRANT_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT';

export type ProductionErrorCategory = 'schema' | 'scope' | 'grant' | 'idempotency';

export class ProductionDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: ProductionErrorCode,
    readonly category: ProductionErrorCategory,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export class ProductionIdempotencyConflictError extends ProductionDomainError {
  constructor() {
    super(
      'Idempotency-Key 已用于不同请求。',
      409,
      'IDEMPOTENCY_CONFLICT',
      'idempotency',
    );
  }
}
