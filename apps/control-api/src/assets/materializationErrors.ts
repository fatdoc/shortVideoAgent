export const CANVAS_MATERIALIZATION_ERROR_POLICY = {
  CANVAS_MATERIALIZATION_INTERNAL_AUTH_INVALID: {
    status: 401,
    retryable: false,
    message: 'Canvas materialization internal authentication is invalid.',
  },
  CANVAS_MATERIALIZATION_REQUEST_INVALID: {
    status: 400,
    retryable: false,
    message: 'Canvas materialization request is invalid.',
  },
  CANVAS_MATERIALIZATION_REQUEST_TOO_LARGE: {
    status: 413,
    retryable: false,
    message: 'Canvas materialization request is too large.',
  },
  CANVAS_MATERIALIZATION_RESPONSE_INVALID: {
    status: 503,
    retryable: true,
    message: 'Canvas materialization response is unavailable.',
  },
  CANVAS_MATERIALIZATION_SESSION_INVALID: {
    status: 401,
    retryable: false,
    message: 'Canvas materialization session is invalid.',
  },
  CANVAS_MATERIALIZATION_SCOPE_MISMATCH: {
    status: 404,
    retryable: false,
    message: 'Canvas materialization scope was not found.',
  },
  CANVAS_MATERIALIZATION_ASSET_NOT_FOUND: {
    status: 404,
    retryable: false,
    message: 'Canvas materialization asset was not found.',
  },
  CANVAS_MATERIALIZATION_RIGHTS_NOT_AUTHORIZED: {
    status: 409,
    retryable: false,
    message: 'Canvas materialization asset rights are not authorized.',
  },
  CANVAS_MATERIALIZATION_ASSET_NOT_APPROVED: {
    status: 409,
    retryable: false,
    message: 'Canvas materialization asset is not approved.',
  },
  CANVAS_MATERIALIZATION_CATEGORY_UNSUPPORTED: {
    status: 422,
    retryable: false,
    message: 'Canvas materialization category is unsupported.',
  },
  CANVAS_MATERIALIZATION_SOURCE_UNAVAILABLE: {
    status: 503,
    retryable: true,
    message: 'Canvas materialization source is unavailable.',
  },
  CANVAS_MATERIALIZATION_SOURCE_EMPTY: {
    status: 422,
    retryable: false,
    message: 'Canvas materialization source is empty.',
  },
  CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE: {
    status: 413,
    retryable: false,
    message: 'Canvas materialization source is too large.',
  },
  CANVAS_MATERIALIZATION_MIME_UNSUPPORTED: {
    status: 415,
    retryable: false,
    message: 'Canvas materialization source MIME is unsupported.',
  },
  CANVAS_MATERIALIZATION_CONTENT_INTEGRITY_FAILED: {
    status: 409,
    retryable: false,
    message: 'Canvas materialization content integrity failed.',
  },
  CANVAS_MATERIALIZATION_IDEMPOTENCY_CONFLICT: {
    status: 409,
    retryable: false,
    message: 'Canvas materialization attempt conflicts with existing authority.',
  },
  CANVAS_MATERIALIZATION_DEPENDENCY_UNAVAILABLE: {
    status: 503,
    retryable: true,
    message: 'Canvas materialization dependency is unavailable.',
  },
} as const;

export type CanvasMaterializationErrorCode = keyof typeof CANVAS_MATERIALIZATION_ERROR_POLICY;

export class CanvasMaterializationError extends Error {
  constructor(readonly code: CanvasMaterializationErrorCode) {
    super(code);
    this.name = 'CanvasMaterializationError';
  }
}

export function materializationError(code: CanvasMaterializationErrorCode): CanvasMaterializationError {
  return new CanvasMaterializationError(code);
}
