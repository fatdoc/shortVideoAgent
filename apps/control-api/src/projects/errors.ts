export class IdempotencyConflictError extends Error {}

export class ContentConflictError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
  }
}
