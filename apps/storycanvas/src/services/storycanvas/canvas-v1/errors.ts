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

const SAFE_MESSAGES: Record<CanvasPublicErrorCode, string> = {
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

const HTTP_STATUS: Partial<Record<CanvasPublicErrorCode, number>> = {
  CANVAS_SCHEMA_INVALID: 422,
  CANVAS_SESSION_INVALID: 401,
  CANVAS_SCOPE_MISMATCH: 403,
  CANVAS_APPROVAL_REQUIRED: 409,
  CANVAS_APPROVAL_INVALID: 403,
  CANVAS_COMMAND_IDEMPOTENCY_CONFLICT: 409,
  CANVAS_DOCUMENT_VERSION_CONFLICT: 409,
  CANVAS_PROVIDER_FAILED: 502,
  CANVAS_OUTPUT_REGISTRATION_FAILED: 502,
};

export class CanvasCommandServiceError extends Error {
  readonly status: number;
  readonly retryable: boolean;

  constructor(readonly code: CanvasPublicErrorCode) {
    super(SAFE_MESSAGES[code]);
    this.name = "CanvasCommandServiceError";
    this.status = HTTP_STATUS[code] ?? 409;
    this.retryable = code === "CANVAS_PROVIDER_FAILED" || code === "CANVAS_OUTPUT_REGISTRATION_FAILED";
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, retryable: this.retryable };
  }
}

export function toCanvasCommandServiceError(error: unknown): CanvasCommandServiceError {
  if (error instanceof CanvasCommandServiceError) return error;
  if (error && typeof error === "object" && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && code in SAFE_MESSAGES) return new CanvasCommandServiceError(code as CanvasPublicErrorCode);
  }
  return new CanvasCommandServiceError("CANVAS_PROVIDER_FAILED");
}
