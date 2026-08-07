export type TermsErrorCode =
  | 'TERMS_PERMISSION_DENIED'
  | 'TERMS_DOCUMENT_NOT_FOUND'
  | 'TERMS_VERSION_NOT_FOUND'
  | 'TERMS_STATE_CONFLICT'
  | 'TERMS_PUBLISH_CONFLICT'
  | 'TERMS_VERSION_STALE'
  | 'TERMS_ACCEPTANCE_REQUIRED'
  | 'TERMS_VALIDATION_FAILED'
  | 'TERMS_NOT_AVAILABLE';

export class TermsDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: TermsErrorCode,
  ) {
    super(message);
  }
}

export class TermsPermissionDeniedError extends TermsDomainError {
  constructor() {
    super(
      'Terms mutation is restricted to platform administrators.',
      403,
      'TERMS_PERMISSION_DENIED',
    );
  }
}

export class TermsDocumentNotFoundError extends TermsDomainError {
  constructor() {
    super('Terms document was not found.', 404, 'TERMS_DOCUMENT_NOT_FOUND');
  }
}

export class TermsVersionNotFoundError extends TermsDomainError {
  constructor() {
    super('Terms version was not found.', 404, 'TERMS_VERSION_NOT_FOUND');
  }
}

export class TermsStateConflictError extends TermsDomainError {
  constructor(message = 'Terms lifecycle state conflicts with this operation.') {
    super(message, 409, 'TERMS_STATE_CONFLICT');
  }
}

export class TermsPublishConflictError extends TermsDomainError {
  constructor() {
    super(
      'Terms version was already published with different facts.',
      409,
      'TERMS_PUBLISH_CONFLICT',
    );
  }
}

export class TermsVersionStaleError extends TermsDomainError {
  constructor() {
    super('The accepted Terms version is no longer current.', 409, 'TERMS_VERSION_STALE');
  }
}

export class TermsAcceptanceRequiredError extends TermsDomainError {
  constructor() {
    super('Explicit Terms acceptance is required.', 422, 'TERMS_ACCEPTANCE_REQUIRED');
  }
}

export class TermsValidationError extends TermsDomainError {
  constructor(message = 'Terms input is invalid.') {
    super(message, 422, 'TERMS_VALIDATION_FAILED');
  }
}

export class TermsNotAvailableError extends TermsDomainError {
  constructor() {
    super('Current Terms are not available.', 503, 'TERMS_NOT_AVAILABLE');
  }
}
