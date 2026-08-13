export const CANVAS_ASSET_ERROR_STATUS = {
  CANVAS_SCHEMA_INVALID: 400,
  CANVAS_BROWSER_PROJECTION_UNSAFE: 400,
  CANVAS_ASSET_NOT_FOUND: 404,
  CANVAS_ASSET_LIFECYCLE_INVALID: 409,
  CANVAS_APPROVAL_REQUIRED: 400,
  CANVAS_APPROVAL_INVALID: 403,
  CANVAS_SESSION_INVALID: 403,
  CANVAS_SESSION_CONFLICT: 409,
} as const;

export type CanvasAssetErrorCode = keyof typeof CANVAS_ASSET_ERROR_STATUS;

export class CanvasAssetDomainError extends Error {
  constructor(
    readonly code: CanvasAssetErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CanvasAssetDomainError';
  }
}

export function canvasAssetError(
  code: CanvasAssetErrorCode,
  message: string,
): CanvasAssetDomainError {
  return new CanvasAssetDomainError(code, message);
}
