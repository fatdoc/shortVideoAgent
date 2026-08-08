export type RegistrationErrorCode =
  | 'INVALID_REGISTRATION_REQUEST'
  | 'REGISTRATION_TERMS_NOT_ACCEPTED'
  | 'INVITATION_UNAVAILABLE'
  | 'REGISTRATION_CONFLICT'
  | 'REGISTRATION_IDEMPOTENCY_CONFLICT'
  | 'TERMS_NOT_AVAILABLE'
  | 'EMAIL_VERIFICATION_UNAVAILABLE'
  | 'EMAIL_VERIFICATION_FAILED';

export class RegistrationDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: RegistrationErrorCode,
  ) {
    super(message);
  }
}

export class RegistrationValidationError extends RegistrationDomainError {
  constructor(message = 'Registration request is invalid.') {
    super(message, 400, 'INVALID_REGISTRATION_REQUEST');
  }
}

export class RegistrationTermsNotAcceptedError extends RegistrationDomainError {
  constructor() {
    super('Explicit Terms acceptance is required.', 400, 'REGISTRATION_TERMS_NOT_ACCEPTED');
  }
}

export class RegistrationInvitationUnavailableError extends RegistrationDomainError {
  constructor() {
    super('Invitation is unavailable.', 404, 'INVITATION_UNAVAILABLE');
  }
}

export class RegistrationConflictError extends RegistrationDomainError {
  constructor() {
    super(
      'Registration cannot be completed with the supplied identity.',
      409,
      'REGISTRATION_CONFLICT',
    );
  }
}

export class RegistrationIdempotencyConflictError extends RegistrationDomainError {
  constructor() {
    super(
      'Registration idempotency key was already used with different facts.',
      409,
      'REGISTRATION_IDEMPOTENCY_CONFLICT',
    );
  }
}

export class RegistrationTermsNotAvailableError extends RegistrationDomainError {
  constructor() {
    super('Current registration Terms are unavailable.', 503, 'TERMS_NOT_AVAILABLE');
  }
}

export class EmailVerificationUnavailableError extends RegistrationDomainError {
  constructor() {
    super('Email verification is unavailable.', 503, 'EMAIL_VERIFICATION_UNAVAILABLE');
  }
}

export class EmailVerificationFailedError extends RegistrationDomainError {
  constructor() {
    super('Email verification failed.', 400, 'EMAIL_VERIFICATION_FAILED');
  }
}
