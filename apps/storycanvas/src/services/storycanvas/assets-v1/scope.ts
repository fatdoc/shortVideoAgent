import type { CanvasV1Scope } from "@/contracts/canvas-v1";

export type CanvasProductionErrorCode = "CANVAS_SCOPE_MISMATCH" | "CANVAS_SESSION_INVALID";

export class CanvasProductionScopeError extends Error {
  readonly status: number;
  readonly retryable = false;

  constructor(readonly code: CanvasProductionErrorCode) {
    super(code === "CANVAS_SESSION_INVALID"
      ? "Canvas session is not active."
      : "Canvas scope does not match the active session.");
    this.name = "CanvasProductionScopeError";
    this.status = code === "CANVAS_SESSION_INVALID" ? 401 : 403;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, retryable: this.retryable };
  }
}

export interface CanvasProductionAuthority extends CanvasV1Scope {
  actorId: string;
  localProjectId: number;
  expiresAt: string;
}

export type CanvasProductionScope = Omit<CanvasProductionAuthority, "expiresAt">;

export interface ProductionScopeClaims extends CanvasV1Scope {
  actorId: string;
}

export interface ProductionScopeAdapterOptions {
  readAuthority(canvasSessionId: string): Promise<CanvasProductionAuthority | null> | CanvasProductionAuthority | null;
  now?: () => Date;
}

const SESSION_PATTERN = /^pcs_[A-Za-z0-9_-]{24,128}$/;

function exactScope(authority: CanvasProductionAuthority, claims: ProductionScopeClaims): boolean {
  return authority.tenantId === claims.tenantId
    && authority.projectId === claims.projectId
    && authority.packageId === claims.packageId
    && authority.canvasSessionId === claims.canvasSessionId
    && authority.actorId === claims.actorId;
}

export class ProductionScopeAdapter {
  private readonly now: () => Date;

  constructor(private readonly options: ProductionScopeAdapterOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async resolve(canvasSessionId: string, claims: ProductionScopeClaims): Promise<CanvasProductionScope> {
    if (!SESSION_PATTERN.test(canvasSessionId) || canvasSessionId !== claims.canvasSessionId) {
      throw new CanvasProductionScopeError("CANVAS_SESSION_INVALID");
    }
    const authority = await this.options.readAuthority(canvasSessionId);
    if (!authority || Date.parse(authority.expiresAt) <= this.now().getTime()) {
      throw new CanvasProductionScopeError("CANVAS_SESSION_INVALID");
    }
    if (!Number.isSafeInteger(authority.localProjectId) || authority.localProjectId < 1 || !exactScope(authority, claims)) {
      throw new CanvasProductionScopeError("CANVAS_SCOPE_MISMATCH");
    }
    const { expiresAt: _expiresAt, ...scope } = authority;
    return scope;
  }
}

export function assertExactCanvasProductionScope(
  expected: Pick<CanvasProductionScope, keyof CanvasV1Scope>,
  value: Pick<CanvasV1Scope, keyof CanvasV1Scope>,
): void {
  if (expected.tenantId !== value.tenantId
    || expected.projectId !== value.projectId
    || expected.packageId !== value.packageId
    || expected.canvasSessionId !== value.canvasSessionId) {
    throw new CanvasProductionScopeError("CANVAS_SCOPE_MISMATCH");
  }
}
