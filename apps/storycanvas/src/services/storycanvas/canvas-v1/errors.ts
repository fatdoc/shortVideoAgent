export type CanvasPublicErrorCode =
  | "CANVAS_SCHEMA_INVALID"
  | "CANVAS_SCOPE_MISMATCH"
  | "CANVAS_SESSION_INVALID"
  | "CANVAS_RIGHTS_NOT_AUTHORIZED"
  | "CANVAS_ASSET_NOT_APPROVED"
  | "CANVAS_PROVIDER_NOT_ACTIVE"
  | "CANVAS_ENTITY_BINDING_NOT_APPROVED"
  | "CANVAS_SHOT_NOT_READY"
  | "CANVAS_CAPABILITY_UNAVAILABLE"
  | "CANVAS_APPROVAL_REQUIRED"
  | "CANVAS_APPROVAL_INVALID"
  | "CANVAS_COMMAND_IDEMPOTENCY_CONFLICT"
  | "CANVAS_DOCUMENT_VERSION_CONFLICT"
  | "CANVAS_PROVIDER_FAILED"
  | "CANVAS_OUTPUT_REGISTRATION_FAILED";

export type CanvasRouteErrorCode =
  | "PRIMARY_VIRTUAL_CHARACTER_MISSING"
  | "PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS"
  | "CANVAS_MEDIA_NOT_FOUND";

const COMMAND_SAFE_MESSAGES: Record<CanvasPublicErrorCode, string> = {
  CANVAS_SCHEMA_INVALID: "Canvas request is invalid.",
  CANVAS_SCOPE_MISMATCH: "Canvas scope does not match the active session.",
  CANVAS_SESSION_INVALID: "Canvas session is not active.",
  CANVAS_RIGHTS_NOT_AUTHORIZED: "Required asset rights are not authorized.",
  CANVAS_ASSET_NOT_APPROVED: "Required asset is not approved.",
  CANVAS_PROVIDER_NOT_ACTIVE: "Required provider asset is not active.",
  CANVAS_ENTITY_BINDING_NOT_APPROVED: "Required entity binding is not approved.",
  CANVAS_SHOT_NOT_READY: "Shot is not ready for generation.",
  CANVAS_CAPABILITY_UNAVAILABLE: "Required production capability is unavailable.",
  CANVAS_APPROVAL_REQUIRED: "This command requires approval.",
  CANVAS_APPROVAL_INVALID: "Command approval is not valid.",
  CANVAS_COMMAND_IDEMPOTENCY_CONFLICT: "Command conflicts with an earlier request.",
  CANVAS_DOCUMENT_VERSION_CONFLICT: "Canvas document has a newer version.",
  CANVAS_PROVIDER_FAILED: "Production provider could not complete the request.",
  CANVAS_OUTPUT_REGISTRATION_FAILED: "Generated output could not be registered.",
};

const ROUTE_SAFE_MESSAGES: Record<CanvasRouteErrorCode, string> = {
  PRIMARY_VIRTUAL_CHARACTER_MISSING: "Primary virtual character is required.",
  PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS: "Primary virtual character is ambiguous.",
  CANVAS_MEDIA_NOT_FOUND: "Controlled Canvas media was not found.",
};

const COMMAND_HTTP_STATUS: Partial<Record<CanvasPublicErrorCode, number>> = {
  CANVAS_SCHEMA_INVALID: 422,
  CANVAS_CAPABILITY_UNAVAILABLE: 503,
  CANVAS_SESSION_INVALID: 401,
  CANVAS_SCOPE_MISMATCH: 403,
  CANVAS_APPROVAL_REQUIRED: 409,
  CANVAS_APPROVAL_INVALID: 403,
  CANVAS_COMMAND_IDEMPOTENCY_CONFLICT: 409,
  CANVAS_DOCUMENT_VERSION_CONFLICT: 409,
  CANVAS_PROVIDER_FAILED: 502,
  CANVAS_OUTPUT_REGISTRATION_FAILED: 502,
};

const ROUTE_HTTP_STATUS: Record<CanvasRouteErrorCode, number> = {
  PRIMARY_VIRTUAL_CHARACTER_MISSING: 409,
  PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS: 409,
  CANVAS_MEDIA_NOT_FOUND: 404,
};

export class CanvasCommandServiceError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(readonly code: CanvasPublicErrorCode) {
    super(COMMAND_SAFE_MESSAGES[code]);
    this.name = "CanvasCommandServiceError";
    this.status = COMMAND_HTTP_STATUS[code] ?? 409;
    this.retryable = code === "CANVAS_PROVIDER_FAILED" || code === "CANVAS_OUTPUT_REGISTRATION_FAILED";
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, retryable: this.retryable };
  }
}

export class CanvasRouteError extends Error {
  readonly retryable = false;
  readonly status: number;

  constructor(readonly code: CanvasRouteErrorCode) {
    super(ROUTE_SAFE_MESSAGES[code]);
    this.name = "CanvasRouteError";
    this.status = ROUTE_HTTP_STATUS[code];
  }
}

export type CanvasHttpError = CanvasCommandServiceError | CanvasRouteError;

export function toCanvasCommandServiceError(error: unknown): CanvasCommandServiceError {
  if (error instanceof CanvasCommandServiceError) return error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code in COMMAND_SAFE_MESSAGES) return new CanvasCommandServiceError(code as CanvasPublicErrorCode);
  }
  return new CanvasCommandServiceError("CANVAS_PROVIDER_FAILED");
}

export function toCanvasHttpError(error: unknown): CanvasHttpError {
  if (error instanceof CanvasCommandServiceError || error instanceof CanvasRouteError) return error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code in COMMAND_SAFE_MESSAGES) return new CanvasCommandServiceError(code as CanvasPublicErrorCode);
    if (typeof code === "string" && code in ROUTE_SAFE_MESSAGES) return new CanvasRouteError(code as CanvasRouteErrorCode);
  }
  return new CanvasCommandServiceError("CANVAS_PROVIDER_FAILED");
}
