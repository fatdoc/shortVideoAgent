export const CANVAS_WORKSPACE_AUTHORITY_ERROR_POLICY = {
  CANVAS_WORKSPACE_AUTHORITY_INTERNAL_AUTH_INVALID: {
    status: 401,
    retryable: false,
    message: 'Canvas workspace authority internal authentication is invalid.',
  },
  CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID: {
    status: 400,
    retryable: false,
    message: 'Canvas workspace authority request is invalid.',
  },
  CANVAS_WORKSPACE_AUTHORITY_REQUEST_TOO_LARGE: {
    status: 413,
    retryable: false,
    message: 'Canvas workspace authority request is too large.',
  },
  CANVAS_WORKSPACE_AUTHORITY_SESSION_INVALID: {
    status: 401,
    retryable: false,
    message: 'Canvas workspace authority session is invalid.',
  },
  CANVAS_WORKSPACE_AUTHORITY_SCOPE_MISMATCH: {
    status: 404,
    retryable: false,
    message: 'Canvas workspace authority scope was not found.',
  },
  CANVAS_WORKSPACE_AUTHORITY_PACKAGE_NOT_FOUND: {
    status: 404,
    retryable: false,
    message: 'Canvas workspace authority Package was not found.',
  },
  CANVAS_WORKSPACE_AUTHORITY_PROJECT_UNAVAILABLE: {
    status: 503,
    retryable: true,
    message: 'Canvas workspace project authority is unavailable.',
  },
  CANVAS_WORKSPACE_AUTHORITY_SCRIPT_UNAVAILABLE: {
    status: 409,
    retryable: false,
    message: 'Canvas workspace Script authority is unavailable.',
  },
  CANVAS_WORKSPACE_AUTHORITY_STORYBOARD_UNAVAILABLE: {
    status: 409,
    retryable: false,
    message: 'Canvas workspace Storyboard authority is unavailable.',
  },
  CANVAS_WORKSPACE_AUTHORITY_ASSETS_INCOMPLETE: {
    status: 503,
    retryable: true,
    message: 'Canvas workspace asset authority is incomplete.',
  },
  CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE: {
    status: 503,
    retryable: true,
    message: 'Canvas workspace authority dependency is unavailable.',
  },
  PRIMARY_VIRTUAL_CHARACTER_MISSING: {
    status: 409,
    retryable: false,
    message: 'A primary virtual character is required.',
  },
  PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS: {
    status: 409,
    retryable: false,
    message: 'The primary virtual character is ambiguous.',
  },
} as const;

export type CanvasWorkspaceAuthorityPublicErrorCode =
  keyof typeof CANVAS_WORKSPACE_AUTHORITY_ERROR_POLICY;

export type CanvasWorkspaceAuthorityContractErrorCode =
  | CanvasWorkspaceAuthorityPublicErrorCode
  | 'CANVAS_WORKSPACE_AUTHORITY_RESPONSE_INVALID'
  | 'CANVAS_WORKSPACE_AUTHORITY_BROWSER_UNSAFE'
  | 'CANVAS_WORKSPACE_AUTHORITY_ASSET_ORDER_INVALID'
  | 'CANVAS_WORKSPACE_AUTHORITY_INCOMPLETE';

export class CanvasWorkspaceAuthorityError extends Error {
  constructor(readonly code: CanvasWorkspaceAuthorityContractErrorCode) {
    super(code);
    this.name = 'CanvasWorkspaceAuthorityError';
  }
}

export function workspaceAuthorityError(
  code: CanvasWorkspaceAuthorityContractErrorCode,
): CanvasWorkspaceAuthorityError {
  return new CanvasWorkspaceAuthorityError(code);
}
