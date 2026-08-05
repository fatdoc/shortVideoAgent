export type ProductionErrorCode =
  | 'SCHEMA_INVALID'
  | 'TENANT_SCOPE_MISMATCH'
  | 'PROJECT_SCOPE_MISMATCH'
  | 'CAPABILITY_SCOPE_DENIED'
  | 'GRANT_INVALID'
  | 'GRANT_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT';

export type ProductionErrorCategory = 'schema' | 'scope' | 'grant' | 'idempotency';

const safePolicies: Record<
  ProductionErrorCode,
  { status: number; message: string; category: ProductionErrorCategory }
> = {
  SCHEMA_INVALID: { status: 422, message: 'Request cannot be accepted.', category: 'schema' },
  TENANT_SCOPE_MISMATCH: {
    status: 403,
    message: 'Request scope is not authorized.',
    category: 'scope',
  },
  PROJECT_SCOPE_MISMATCH: {
    status: 403,
    message: 'Request scope is not authorized.',
    category: 'scope',
  },
  CAPABILITY_SCOPE_DENIED: {
    status: 403,
    message: 'Requested capability is not authorized.',
    category: 'scope',
  },
  GRANT_INVALID: {
    status: 401,
    message: 'Project authorization is invalid.',
    category: 'grant',
  },
  GRANT_EXPIRED: {
    status: 410,
    message: 'Project authorization has expired.',
    category: 'grant',
  },
  IDEMPOTENCY_CONFLICT: {
    status: 409,
    message: 'Request conflicts with an earlier request.',
    category: 'idempotency',
  },
};

const safeIdentifier = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const safeReasonCode = /^[A-Z][A-Z0-9_]{0,63}$/;
const safeFieldPath = /^[A-Za-z0-9_$.[\]-]{1,128}$/;
const forbiddenValues = [
  /(?:x-tos-(?:signature|credential|security-token)|tos-signature)(?:=|%3d|\s*:)/i,
  /x-amz-[a-z0-9-]+(?:=|%3d|\s*:)/i,
  /\bbearer\s+[a-z0-9._~+/=-]{8,}/i,
  /\b(?:api[_-]?key|client[_-]?secret|access[_-]?token|secret(?:[_-]?key)?|token)\s*[:=]\s*[^\s,;]{6,}/i,
  /\b(?:sk-(?:live|test|proj)[-_a-z0-9]{8,}|aklt[a-z0-9]{8,})\b/i,
  /-----begin(?:[ a-z0-9_-]+)private key-----/i,
  /https?:\/\/[^\s]*[?&](?:signature|sig|credential|security-token)=/i,
  /(?:\b(?:full[_-]?script|script[_-]?(?:content|text)|prompt[_-]?(?:content|text|body)|input[_-]?prompt)\s*[:=]|(?:脚本全文|脚本正文|提示词正文|完整提示词)\s*[:：])/i,
  /(?:\b(?:asset|resource|project)\b.{0,80}\b(?:exists?|found)\b.{0,80}\btenant\b|\btenant\b.{0,80}\b(?:has|contains|owns)\b.{0,80}\b(?:asset|resource|project)\b)/i,
  /(?:租户.{0,80}(?:存在|拥有|包含).{0,80}(?:资源|素材|项目)|(?:资源|素材|项目).{0,80}存在于.{0,80}租户)/i,
  /\btenant[-_:][a-z0-9._:-]+\b/i,
];

export type SafeProductionError = {
  status: number;
  code: ProductionErrorCode;
  message: string;
  category: ProductionErrorCategory;
  retryable: false;
  details: Record<string, unknown>;
};

function isForbidden(value: string): boolean {
  return value.length > 256 || forbiddenValues.some((pattern) => pattern.test(value));
}

function safeDetails(details: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details)) {
    if (key === 'reasonCode' && typeof value === 'string' && safeReasonCode.test(value)) {
      safe[key] = value;
    } else if (
      ['provider', 'providerCode', 'operation', 'storageStage', 'receiptType', 'conflictField'].includes(
        key,
      ) &&
      typeof value === 'string' &&
      safeIdentifier.test(value) &&
      !isForbidden(value)
    ) {
      safe[key] = value;
    } else if (
      key === 'fieldPaths' &&
      Array.isArray(value) &&
      value.length <= 32 &&
      value.every((item) => typeof item === 'string' && safeFieldPath.test(item))
    ) {
      safe[key] = value;
    } else if (
      key === 'retryAfterSeconds' &&
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= 86_400
    ) {
      safe[key] = value;
    } else if (
      key === 'attempt' &&
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= 1_000
    ) {
      safe[key] = value;
    }
  }
  return safe;
}

export function safeProductionError(error: ProductionDomainError): SafeProductionError {
  const policy = safePolicies[error.code];
  return {
    status: policy.status,
    code: error.code,
    message: policy.message,
    category: policy.category,
    retryable: false,
    details: safeDetails(error.details),
  };
}

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
