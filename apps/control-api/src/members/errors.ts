export type MemberErrorCode =
  | 'MEMBER_PERMISSION_DENIED'
  | 'MEMBER_NOT_FOUND'
  | 'MEMBER_SELF_SUSPEND_FORBIDDEN'
  | 'MEMBER_LAST_ADMIN_CONFLICT'
  | 'MEMBER_VERSION_CONFLICT'
  | 'MEMBER_STATUS_CONFLICT';

export class MemberDomainError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: MemberErrorCode,
  ) {
    super(message);
  }
}

export class MemberPermissionDeniedError extends MemberDomainError {
  constructor() {
    super(
      'The active role cannot manage current Organization members.',
      403,
      'MEMBER_PERMISSION_DENIED',
    );
  }
}

export class MemberNotFoundError extends MemberDomainError {
  constructor() {
    super(
      'The requested Membership does not exist in the current Organization.',
      404,
      'MEMBER_NOT_FOUND',
    );
  }
}

export class MemberSelfSuspendForbiddenError extends MemberDomainError {
  constructor() {
    super('The active Membership cannot suspend itself.', 409, 'MEMBER_SELF_SUSPEND_FORBIDDEN');
  }
}

export class MemberLastAdminConflictError extends MemberDomainError {
  constructor() {
    super(
      'The last active Organization administrator cannot be suspended.',
      409,
      'MEMBER_LAST_ADMIN_CONFLICT',
    );
  }
}

export class MemberVersionConflictError extends MemberDomainError {
  constructor() {
    super(
      'The Membership version does not match the expected version.',
      409,
      'MEMBER_VERSION_CONFLICT',
    );
  }
}

export class MemberStatusConflictError extends MemberDomainError {
  constructor() {
    super('The Membership status cannot be suspended.', 409, 'MEMBER_STATUS_CONFLICT');
  }
}
