export type CommercialChannelErrorCode = 'CHANNEL_SCOPE_NOT_FOUND' | 'CHANNEL_PERMISSION_DENIED';

export class CommercialChannelDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: CommercialChannelErrorCode,
  ) {
    super(message);
  }
}

export class CommercialChannelScopeNotFoundError extends CommercialChannelDomainError {
  constructor() {
    super('The requested Commercial Channel scope does not exist.', 404, 'CHANNEL_SCOPE_NOT_FOUND');
  }
}

export class CommercialChannelPermissionDeniedError extends CommercialChannelDomainError {
  constructor() {
    super(
      'The active role cannot access Commercial Channel references.',
      403,
      'CHANNEL_PERMISSION_DENIED',
    );
  }
}
