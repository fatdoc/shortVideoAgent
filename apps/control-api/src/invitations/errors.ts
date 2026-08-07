export type InvitationErrorCode =
  | 'INVITATION_PERMISSION_DENIED'
  | 'INVITATION_NOT_FOUND'
  | 'INVITATION_UNAVAILABLE'
  | 'INVITATION_STATE_CONFLICT'
  | 'INVITATION_IDEMPOTENCY_CONFLICT'
  | 'INVITATION_SCOPE_CONFLICT'
  | 'INVITATION_VALIDATION_FAILED';

export class InvitationDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: InvitationErrorCode,
  ) {
    super(message);
  }
}

export class InvitationPermissionDeniedError extends InvitationDomainError {
  constructor() {
    super(
      'The active organization role cannot manage Invitations.',
      403,
      'INVITATION_PERMISSION_DENIED',
    );
  }
}

export class InvitationNotFoundError extends InvitationDomainError {
  constructor() {
    super(
      'Invitation was not found in the active organization scope.',
      404,
      'INVITATION_NOT_FOUND',
    );
  }
}

export class InvitationUnavailableError extends InvitationDomainError {
  constructor() {
    super('Invitation is unavailable.', 404, 'INVITATION_UNAVAILABLE');
  }
}

export class InvitationStateConflictError extends InvitationDomainError {
  constructor(message = 'Invitation lifecycle state conflicts with this operation.') {
    super(message, 409, 'INVITATION_STATE_CONFLICT');
  }
}

export class InvitationIdempotencyConflictError extends InvitationDomainError {
  constructor() {
    super(
      'Invitation idempotency key was already used with different facts.',
      409,
      'INVITATION_IDEMPOTENCY_CONFLICT',
    );
  }
}

export class InvitationScopeConflictError extends InvitationDomainError {
  constructor() {
    super(
      'Invitation scope is not valid for the active organization.',
      409,
      'INVITATION_SCOPE_CONFLICT',
    );
  }
}

export class InvitationValidationError extends InvitationDomainError {
  constructor(message = 'Invitation input is invalid.') {
    super(message, 422, 'INVITATION_VALIDATION_FAILED');
  }
}
