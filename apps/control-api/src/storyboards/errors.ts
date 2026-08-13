export type StoryboardContractErrorCode =
  'STORYBOARD_SCHEMA_INVALID' | 'STORYBOARD_SECRET_FIELD_FORBIDDEN' | 'STORYBOARD_DIGEST_MISMATCH';

const safeContractMessages: Record<StoryboardContractErrorCode, string> = {
  STORYBOARD_SCHEMA_INVALID: 'Storyboard draft contract cannot be accepted.',
  STORYBOARD_SECRET_FIELD_FORBIDDEN: 'Storyboard draft contract contains a forbidden field.',
  STORYBOARD_DIGEST_MISMATCH: 'Storyboard draft contract integrity check failed.',
};

export class StoryboardContractError extends Error {
  readonly status = 422;
  readonly category = 'storyboard_contract';
  readonly retryable = false;

  constructor(readonly code: StoryboardContractErrorCode) {
    super(safeContractMessages[code]);
    this.name = 'StoryboardContractError';
  }
}

export type StoryboardAuthorityErrorCode =
  | 'STORYBOARD_ACTOR_INVALID'
  | 'STORYBOARD_NOT_FOUND'
  | 'STORYBOARD_INPUT_INVALID'
  | 'STORYBOARD_SCRIPT_NOT_APPROVED'
  | 'STORYBOARD_SCRIPT_DIGEST_MISMATCH'
  | 'STORYBOARD_STALE_REVISION'
  | 'STORYBOARD_STALE_VERSION'
  | 'STORYBOARD_APPROVAL_STATE_INVALID'
  | 'STORYBOARD_IDEMPOTENCY_CONFLICT'
  | 'STORYBOARD_CONFLICT'
  | 'STORYBOARD_STORAGE_ERROR';

const safeAuthorityPolicies: Record<
  StoryboardAuthorityErrorCode,
  { status: number; message: string }
> = {
  STORYBOARD_ACTOR_INVALID: { status: 403, message: 'Storyboard authority is not authorized.' },
  STORYBOARD_NOT_FOUND: { status: 404, message: 'Storyboard authority resource was not found.' },
  STORYBOARD_INPUT_INVALID: { status: 422, message: 'Storyboard authority input is invalid.' },
  STORYBOARD_SCRIPT_NOT_APPROVED: {
    status: 409,
    message: 'Storyboard authority precondition is not satisfied.',
  },
  STORYBOARD_SCRIPT_DIGEST_MISMATCH: {
    status: 409,
    message: 'Storyboard authority precondition is not satisfied.',
  },
  STORYBOARD_STALE_REVISION: {
    status: 409,
    message: 'Storyboard draft revision is stale.',
  },
  STORYBOARD_STALE_VERSION: {
    status: 409,
    message: 'Storyboard authority version is stale.',
  },
  STORYBOARD_APPROVAL_STATE_INVALID: {
    status: 409,
    message: 'Storyboard approval transition is not allowed.',
  },
  STORYBOARD_IDEMPOTENCY_CONFLICT: {
    status: 409,
    message: 'Storyboard idempotency key conflicts with an existing request.',
  },
  STORYBOARD_CONFLICT: { status: 409, message: 'Storyboard authority request conflicts.' },
  STORYBOARD_STORAGE_ERROR: { status: 500, message: 'Storyboard authority is unavailable.' },
};

export class StoryboardAuthorityError extends Error {
  readonly status: number;
  readonly category = 'storyboard_authority';
  readonly retryable = false;

  constructor(readonly code: StoryboardAuthorityErrorCode) {
    const policy = safeAuthorityPolicies[code];
    super(policy.message);
    this.name = 'StoryboardAuthorityError';
    this.status = policy.status;
  }
}
