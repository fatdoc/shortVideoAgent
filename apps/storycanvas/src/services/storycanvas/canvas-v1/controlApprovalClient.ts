import type { CanvasCommandV01 } from '@/contracts/canvas-v1';
import type { CanvasProductionScope } from '../assets-v1';

const CONSUME_PATH = '/api/v1/internal/canvas-command-approvals/consume';
const MAX_RESPONSE_BYTES = 4 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export type CanvasApprovalFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export type ControlCanvasApprovalClientOptions = {
  controlApiBaseUrl: string;
  internalToken: string;
  fetch?: CanvasApprovalFetch;
  timeoutMs?: number;
};

function controlOrigin(value: string): URL {
  const parsed = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname);
  if (
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    (parsed.pathname !== '/' && parsed.pathname !== '') ||
    (parsed.protocol !== 'https:' && !(loopback && parsed.protocol === 'http:'))
  ) {
    throw new Error('Canvas approval Control API origin is invalid.');
  }
  return parsed;
}

function exactScope(command: CanvasCommandV01, scope: CanvasProductionScope): boolean {
  return (
    command.tenantId === scope.tenantId &&
    command.projectId === scope.projectId &&
    command.packageId === scope.packageId &&
    command.canvasSessionId === scope.canvasSessionId &&
    command.requestedByActorId === scope.actorId
  );
}

function strictConsumed(value: unknown, approvalId: string): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).sort().join(',') === 'approvalId,replayed,status' &&
    record.approvalId === approvalId &&
    UUID.test(approvalId) &&
    record.status === 'consumed' &&
    typeof record.replayed === 'boolean'
  );
}

export class ControlCanvasApprovalClient {
  private readonly endpoint: string;
  private readonly fetchImpl: CanvasApprovalFetch;
  private readonly timeoutMs: number;

  constructor(private readonly options: ControlCanvasApprovalClientOptions) {
    if (Buffer.byteLength(options.internalToken, 'utf8') < 32) {
      throw new Error('Canvas approval internal token is unavailable.');
    }
    this.endpoint = new URL(CONSUME_PATH, controlOrigin(options.controlApiBaseUrl)).toString();
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 5_000;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 10_000) {
      throw new Error('Canvas approval timeout is invalid.');
    }
  }

  async consume(command: CanvasCommandV01, scope: CanvasProductionScope): Promise<boolean> {
    if (!command.approvalId || !exactScope(command, scope)) return false;
    const body = JSON.stringify({
      approvalId: command.approvalId,
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      packageId: scope.packageId,
      canvasSessionId: scope.canvasSessionId,
      actorId: scope.actorId,
      commandType: command.commandType,
      action: { commandId: command.commandId, payload: command.payload },
      commandId: command.commandId,
    });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const response = await this.fetchImpl(this.endpoint, {
          method: 'POST',
          headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            'cache-control': 'no-store',
            'x-production-plane-internal-token': this.options.internalToken,
          },
          body,
          redirect: 'error',
          signal: AbortSignal.timeout(this.timeoutMs),
        });
        if (response.status === 503 && attempt === 0) continue;
        if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('json')) {
          return false;
        }
        const raw = await response.text();
        if (Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) return false;
        return strictConsumed(JSON.parse(raw), command.approvalId);
      } catch {
        if (attempt === 0) continue;
        return false;
      }
    }
    return false;
  }
}
