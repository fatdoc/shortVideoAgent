export type StoryboardContractErrorCode =
  'STORYBOARD_SCHEMA_INVALID' | 'STORYBOARD_SECRET_FIELD_FORBIDDEN' | 'STORYBOARD_DIGEST_MISMATCH';

const safeMessages: Record<StoryboardContractErrorCode, string> = {
  STORYBOARD_SCHEMA_INVALID: 'Storyboard draft contract cannot be accepted.',
  STORYBOARD_SECRET_FIELD_FORBIDDEN: 'Storyboard draft contract contains a forbidden field.',
  STORYBOARD_DIGEST_MISMATCH: 'Storyboard draft contract integrity check failed.',
};

export class StoryboardContractError extends Error {
  readonly status = 422;
  readonly category = 'storyboard_contract';
  readonly retryable = false;

  constructor(readonly code: StoryboardContractErrorCode) {
    super(safeMessages[code]);
    this.name = 'StoryboardContractError';
  }
}
