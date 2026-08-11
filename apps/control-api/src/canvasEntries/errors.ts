export type CanvasEntryErrorCode =
  | 'CANVAS_ENTRY_SCHEMA_INVALID'
  | 'CANVAS_ENTRY_NOT_FOUND'
  | 'CANVAS_ENTRY_EXPIRED'
  | 'CANVAS_ENTRY_REPLAYED'
  | 'CANVAS_ENTRY_IDEMPOTENCY_CONFLICT';

export type CanvasEntryErrorCategory = 'schema' | 'scope' | 'entry' | 'idempotency';

const publicPolicies: Record<
  CanvasEntryErrorCode,
  { status: number; message: string; category: CanvasEntryErrorCategory }
> = {
  CANVAS_ENTRY_SCHEMA_INVALID: {
    status: 422,
    message: 'Canvas Entry request cannot be accepted.',
    category: 'schema',
  },
  CANVAS_ENTRY_NOT_FOUND: {
    status: 404,
    message: 'Canvas Entry was not found.',
    category: 'entry',
  },
  CANVAS_ENTRY_EXPIRED: {
    status: 410,
    message: 'Canvas Entry has expired.',
    category: 'entry',
  },
  CANVAS_ENTRY_REPLAYED: {
    status: 409,
    message: 'Canvas Entry has already been used.',
    category: 'entry',
  },
  CANVAS_ENTRY_IDEMPOTENCY_CONFLICT: {
    status: 409,
    message: 'Canvas Entry request conflicts with an earlier request.',
    category: 'idempotency',
  },
};

const jsonPointer = /^\/(?:[A-Za-z0-9_$.-]|~[01]|\/)*$/;

export type SafeCanvasEntryError = {
  status: number;
  code: CanvasEntryErrorCode;
  message: string;
  category: CanvasEntryErrorCategory;
  retryable: false;
  details: Record<string, unknown>;
};

function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const fieldPaths = details.fieldPaths;
  if (
    Array.isArray(fieldPaths) &&
    fieldPaths.length >= 1 &&
    fieldPaths.length <= 20 &&
    new Set(fieldPaths).size === fieldPaths.length &&
    fieldPaths.every(
      (path) =>
        typeof path === 'string' &&
        path.length <= 160 &&
        jsonPointer.test(path) &&
        !/(?:grant|token|authorization|cookie|secret|password|credential|provider)/i.test(path),
    )
  ) {
    return { fieldPaths };
  }
  return {};
}

export function safeCanvasEntryError(error: CanvasEntryDomainError): SafeCanvasEntryError {
  const policy = publicPolicies[error.code];
  return {
    status: policy.status,
    code: error.code,
    message: policy.message,
    category: policy.category,
    retryable: false,
    details: safeDetails(error.details),
  };
}

export class CanvasEntryDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: CanvasEntryErrorCode,
    readonly category: CanvasEntryErrorCategory,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export function canvasEntryError(
  code: CanvasEntryErrorCode,
  internalMessage: string,
  details: Record<string, unknown> = {},
): CanvasEntryDomainError {
  const policy = publicPolicies[code];
  return new CanvasEntryDomainError(internalMessage, policy.status, code, policy.category, details);
}
