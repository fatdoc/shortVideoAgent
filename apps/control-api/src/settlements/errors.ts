export type CommissionSettlementErrorCode =
  | 'COMMISSION_SETTLEMENT_SCOPE_NOT_FOUND'
  | 'COMMISSION_SETTLEMENT_PERMISSION_DENIED'
  | 'COMMISSION_SETTLEMENT_VALIDATION_FAILED'
  | 'COMMISSION_SETTLEMENT_IDEMPOTENCY_CONFLICT'
  | 'COMMISSION_SETTLEMENT_PERIOD_CONFLICT'
  | 'COMMISSION_SETTLEMENT_EVIDENCE_INVALID';

export class CommissionSettlementDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: CommissionSettlementErrorCode,
  ) {
    super(message);
  }
}

export class CommissionSettlementScopeNotFoundError extends CommissionSettlementDomainError {
  constructor() {
    super(
      'The requested Commission Settlement scope does not exist.',
      404,
      'COMMISSION_SETTLEMENT_SCOPE_NOT_FOUND',
    );
  }
}

export class CommissionSettlementPermissionDeniedError extends CommissionSettlementDomainError {
  constructor() {
    super(
      'The active role cannot create Commission Settlement drafts.',
      403,
      'COMMISSION_SETTLEMENT_PERMISSION_DENIED',
    );
  }
}

export class CommissionSettlementValidationError extends CommissionSettlementDomainError {
  constructor(message = 'Commission Settlement input is invalid.') {
    super(message, 422, 'COMMISSION_SETTLEMENT_VALIDATION_FAILED');
  }
}

export class CommissionSettlementIdempotencyConflictError extends CommissionSettlementDomainError {
  constructor() {
    super(
      'Commission Settlement idempotency key was already used with different facts.',
      409,
      'COMMISSION_SETTLEMENT_IDEMPOTENCY_CONFLICT',
    );
  }
}

export class CommissionSettlementPeriodConflictError extends CommissionSettlementDomainError {
  constructor() {
    super(
      'A Commission Settlement already exists for this Channel, currency and period.',
      409,
      'COMMISSION_SETTLEMENT_PERIOD_CONFLICT',
    );
  }
}

export class CommissionSettlementEvidenceInvalidError extends CommissionSettlementDomainError {
  constructor(message = 'Commission Settlement TEST evidence is incomplete or inconsistent.') {
    super(message, 409, 'COMMISSION_SETTLEMENT_EVIDENCE_INVALID');
  }
}
