export type CommissionAuditErrorCode =
  'COMMISSION_SCOPE_NOT_FOUND' | 'COMMISSION_PERMISSION_DENIED';

export class CommissionAuditDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: CommissionAuditErrorCode,
  ) {
    super(message);
  }
}

export class CommissionScopeNotFoundError extends CommissionAuditDomainError {
  constructor() {
    super(
      'The requested Commission audit scope does not exist.',
      404,
      'COMMISSION_SCOPE_NOT_FOUND',
    );
  }
}

export class CommissionPermissionDeniedError extends CommissionAuditDomainError {
  constructor() {
    super(
      'The active role cannot read Commission audit results.',
      403,
      'COMMISSION_PERMISSION_DENIED',
    );
  }
}
