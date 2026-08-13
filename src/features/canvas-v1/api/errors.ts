const REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/u;

export class PilotStoryCanvasBridgeError extends Error {
  readonly code: string;
  readonly status: number | null;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(
    code: string,
    options: { status?: number | null; retryable?: boolean; requestId?: string | null } = {},
  ) {
    super(code);
    this.name = 'PilotStoryCanvasBridgeError';
    this.code = code;
    this.status = options.status ?? null;
    this.retryable = options.retryable ?? false;
    this.requestId =
      options.requestId && REQUEST_ID.test(options.requestId) ? options.requestId : null;
  }
}

export function bridgeError(
  code: string,
  options?: ConstructorParameters<typeof PilotStoryCanvasBridgeError>[1],
): PilotStoryCanvasBridgeError {
  return new PilotStoryCanvasBridgeError(code, options);
}
