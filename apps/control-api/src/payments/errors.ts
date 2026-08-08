export type PaymentFoundationErrorCode =
  | 'RECHARGE_PERMISSION_DENIED'
  | 'RECHARGE_VALIDATION_FAILED'
  | 'RECHARGE_RULE_UNAVAILABLE'
  | 'RECHARGE_SCOPE_CONFLICT'
  | 'RECHARGE_IDEMPOTENCY_CONFLICT'
  | 'PAYMENT_PROVIDER_UNAVAILABLE'
  | 'PAYMENT_PERMISSION_DENIED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'PAYMENT_MODE_MISMATCH'
  | 'PAYMENT_ORDER_CONFLICT'
  | 'PAYMENT_IDEMPOTENCY_CONFLICT';

export class PaymentFoundationDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: PaymentFoundationErrorCode,
  ) {
    super(message);
  }
}

export class RechargePermissionDeniedError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'The active Tenant role cannot create Recharge Orders.',
      403,
      'RECHARGE_PERMISSION_DENIED',
    );
  }
}

export class RechargeValidationError extends PaymentFoundationDomainError {
  constructor(message = 'Recharge Order input is invalid.') {
    super(message, 422, 'RECHARGE_VALIDATION_FAILED');
  }
}

export class RechargeRuleUnavailableError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'An active TEST Credit Conversion Rule is unavailable.',
      404,
      'RECHARGE_RULE_UNAVAILABLE',
    );
  }
}

export class RechargeScopeConflictError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'Recharge Order scope conflicts with the active Tenant context.',
      409,
      'RECHARGE_SCOPE_CONFLICT',
    );
  }
}

export class RechargeIdempotencyConflictError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'Recharge Order idempotency key was already used with different facts.',
      409,
      'RECHARGE_IDEMPOTENCY_CONFLICT',
    );
  }
}

export class PaymentPermissionDeniedError extends PaymentFoundationDomainError {
  constructor() {
    super('The active Platform role cannot list Payment Events.', 403, 'PAYMENT_PERMISSION_DENIED');
  }
}

export class PaymentProviderUnavailableError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'The requested payment provider mode is unavailable.',
      503,
      'PAYMENT_PROVIDER_UNAVAILABLE',
    );
  }
}

export class PaymentVerificationError extends PaymentFoundationDomainError {
  constructor(message = 'Payment Event verification failed.') {
    super(message, 400, 'PAYMENT_VERIFICATION_FAILED');
  }
}

export class PaymentModeMismatchError extends PaymentFoundationDomainError {
  constructor() {
    super('Payment Event mode does not match the selected provider.', 409, 'PAYMENT_MODE_MISMATCH');
  }
}

export class PaymentOrderConflictError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'Payment Event facts conflict with the referenced Recharge Order.',
      409,
      'PAYMENT_ORDER_CONFLICT',
    );
  }
}

export class PaymentIdempotencyConflictError extends PaymentFoundationDomainError {
  constructor() {
    super(
      'Payment Provider event identity was already used with different facts.',
      409,
      'PAYMENT_IDEMPOTENCY_CONFLICT',
    );
  }
}
