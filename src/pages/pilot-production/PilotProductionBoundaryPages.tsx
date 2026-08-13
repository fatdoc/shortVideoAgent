import { useEffect, useState } from 'react';

export type PilotCanvasEntryReference = {
  handle: string;
  tenantId: string;
  projectId: string;
  packageId: string;
};

export type PilotCanvasBootstrap = {
  schemaVersion: 'pilot-canvas-bootstrap.v1';
  status: 'ready';
  projectId: string;
  packageId: string;
  canvasSessionId: string;
  expiresAt: string;
  requestId: string;
};

export interface PilotCanvasEntryConsumer {
  openEntry(entry: PilotCanvasEntryReference): Promise<PilotCanvasBootstrap>;
}

const safeStatusCodes = new Set([401, 403, 404, 409, 410, 422, 500, 503]);
const requestIdPattern = /^[A-Za-z0-9._:-]{1,128}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const handlePattern = /^ce_[A-Za-z0-9_-]{32,64}$/;

export class PilotCanvasBootstrapError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(
    status: number,
    code: string,
    retryable: boolean,
    requestId: string | null,
  ) {
    super('Pilot Canvas could not be opened.');
    this.name = 'PilotCanvasBootstrapError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

function isExactBootstrap(value: unknown, entry: PilotCanvasEntryReference): value is PilotCanvasBootstrap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate).sort();
  const expectedKeys = ['canvasSessionId', 'expiresAt', 'packageId', 'projectId', 'requestId', 'schemaVersion', 'status'];
  return JSON.stringify(keys) === JSON.stringify(expectedKeys)
    && candidate.schemaVersion === 'pilot-canvas-bootstrap.v1'
    && candidate.status === 'ready'
    && candidate.projectId === entry.projectId
    && candidate.packageId === entry.packageId
    && typeof candidate.canvasSessionId === 'string'
    && /^pcs_[A-Za-z0-9_-]{32,64}$/.test(candidate.canvasSessionId)
    && typeof candidate.expiresAt === 'string'
    && Number.isFinite(Date.parse(candidate.expiresAt))
    && typeof candidate.requestId === 'string'
    && requestIdPattern.test(candidate.requestId);
}

function assertExactEntry(entry: PilotCanvasEntryReference): void {
  if (
    !handlePattern.test(entry.handle)
    || !uuidPattern.test(entry.tenantId)
    || !uuidPattern.test(entry.projectId)
    || !uuidPattern.test(entry.packageId)
  ) throw new PilotCanvasBootstrapError(422, 'PILOT_CANVAS_ENTRY_INVALID', false, null);
}

export function createPilotCanvasEntryConsumer(fetchImpl: typeof fetch = fetch): PilotCanvasEntryConsumer {
  return {
    async openEntry(entry) {
      assertExactEntry(entry);
      const response = await fetchImpl('/api/production/pilot/canvas/bootstrap', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          'x-storycanvas-csrf': 'pilot-canvas-bootstrap-v1',
        },
        body: JSON.stringify(entry),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: Record<string, unknown> } | null;
        const safeStatus = safeStatusCodes.has(response.status) ? response.status : 500;
        const code = typeof body?.error?.code === 'string' && /^PILOT_CANVAS_[A-Z0-9_]+$/.test(body.error.code)
          ? body.error.code
          : 'PILOT_CANVAS_BOOTSTRAP_FAILED';
        const suppliedRequestId = typeof body?.error?.requestId === 'string' ? body.error.requestId : response.headers.get('x-request-id');
        throw new PilotCanvasBootstrapError(
          safeStatus,
          code,
          body?.error?.retryable === true,
          suppliedRequestId && requestIdPattern.test(suppliedRequestId) ? suppliedRequestId : null,
        );
      }
      const result: unknown = await response.json().catch(() => null);
      if (!isExactBootstrap(result, entry)) {
        const suppliedRequestId = response.headers.get('x-request-id');
        throw new PilotCanvasBootstrapError(500, 'PILOT_CANVAS_BOOTSTRAP_INVALID', false, suppliedRequestId && requestIdPattern.test(suppliedRequestId) ? suppliedRequestId : null);
      }
      return result;
    },
  };
}

export function PilotScriptBoundaryPage({ projectId }: { projectId: string }) {
  return <main data-testid="pilot-script-boundary" data-project-id={projectId}>脚本工作区</main>;
}

export function PilotStoryboardBoundaryPage({ projectId }: { projectId: string }) {
  return <main data-testid="pilot-storyboard-boundary" data-project-id={projectId}>分镜工作区</main>;
}

type CanvasState =
  | { name: 'blocked' | 'loading' | 'ready' }
  | { name: 'error'; status: number; code: string; retryable: boolean; requestId: string | null };

export function PilotCanvasBoundaryPage({
  projectId,
  entry,
  consumer,
}: {
  projectId: string;
  entry: PilotCanvasEntryReference | null;
  consumer: PilotCanvasEntryConsumer;
}) {
  const [state, setState] = useState<CanvasState>({ name: entry ? 'loading' : 'blocked' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    if (!entry || entry.projectId !== projectId) {
      setState({ name: 'blocked' });
      return () => { active = false; };
    }
    setState({ name: 'loading' });
    consumer.openEntry(entry).then(
      (result) => {
        if (active) setState(result.projectId === projectId ? { name: 'ready' } : { name: 'error', status: 500, code: 'PILOT_CANVAS_SCOPE_INVALID', retryable: false, requestId: result.requestId });
      },
      (error: unknown) => {
        if (!active) return;
        const safe = error instanceof PilotCanvasBootstrapError
          ? error
          : new PilotCanvasBootstrapError(500, 'PILOT_CANVAS_BOOTSTRAP_FAILED', false, null);
        setState({ name: 'error', status: safe.status, code: safe.code, retryable: safe.retryable, requestId: safe.requestId });
      },
    );
    return () => { active = false; };
  }, [attempt, consumer, entry, projectId]);

  if (state.name === 'blocked') {
    return <main data-testid="pilot-storycanvas-boundary-blocked">生产包尚未准备，画布保持关闭。</main>;
  }
  if (state.name === 'loading') {
    return <main data-testid="pilot-storycanvas-boundary-loading">正在安全打开画布…</main>;
  }
  if (state.name === 'error') {
    return (
      <main data-testid="pilot-storycanvas-boundary-error" data-error-status={state.status} data-error-code={state.code}>
        <p>画布暂时无法打开。</p>
        {state.requestId ? <p data-testid="pilot-storycanvas-request-id">请求编号：{state.requestId}</p> : null}
        {state.retryable ? <button type="button" data-testid="pilot-storycanvas-retry" onClick={() => setAttempt((value) => value + 1)}>重试</button> : null}
      </main>
    );
  }
  return <main data-testid="pilot-storycanvas-boundary-ready">画布生产能力已就绪。</main>;
}
