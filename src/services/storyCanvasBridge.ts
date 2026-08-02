import {
  CONTROL_PLANE_FIXTURE_ID,
  type AssetReceipt,
  type ControlPlaneBootstrapResult,
  type DemoProjectGrant,
  type ExportReceipt,
  type GenerationTaskReceipt,
  type ProjectProductionPackage,
  type ReceiptOutboxEnvelope,
  type ReceiptSyncItemResult,
  type ReceiptSyncResult,
  type StandardReceiptError,
  type StoryCanvasApiEnvelope,
  type StoryCanvasHandoffState,
  type StoryCanvasPackageResponse,
  type StoryCanvasTransportState,
} from '../domain/controlPlane';
import { digestValue } from '../domain/controlPlaneUtils';
import {
  CAPABILITY_IDS,
  DEFAULT_STORYCANVAS_API_BASE,
  DEMO_FAILURE_TASK_ID,
  DEMO_PACKAGE_ID,
  DEMO_SUCCESS_TASK_ID,
} from '../mocks/controlPlaneDemo';
import { requireCanonicalRoute } from './canonicalRouteGuard';
import {
  ControlPlaneMockError,
  controlPlaneMockAdapter,
} from './controlPlaneMockAdapter';

export const STORYCANVAS_ENDPOINTS = {
  packages: '/packages',
  receipts: '/receipts',
  receiptAck: (receiptId: string) =>
    `/receipts/${encodeURIComponent(receiptId)}/ack`,
} as const;

export const STORYCANVAS_DEMO_GRANT_HEADER =
  'X-StoryCanvas-Demo-Grant' as const;
export const STORYCANVAS_HANDOFF_ORIGIN =
  'http://localhost:50188' as const;

export interface StoryCanvasBridgeConfig {
  baseUrl?: string;
  fetcher?: typeof fetch;
}

export interface SendPackageResult {
  response: StoryCanvasPackageResponse | null;
  transport: StoryCanvasTransportState;
}

type BridgeStateListener = (
  transport: StoryCanvasTransportState,
  handoff: StoryCanvasHandoffState,
) => void;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '');
}

function transportError(
  code: string,
  message: string,
  retryable: boolean,
  details: Record<string, string> = {},
): StandardReceiptError {
  return { code, message, retryable, details };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function base64UrlJson(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function isApiEnvelope(value: unknown): value is StoryCanvasApiEnvelope<unknown> {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.code === 'number' &&
    typeof candidate.message === 'string' &&
    'data' in candidate
  );
}

function apiError(
  envelope: StoryCanvasApiEnvelope<unknown>,
  httpStatus: number,
  fallbackCode: string,
): StandardReceiptError {
  const data =
    envelope.data && typeof envelope.data === 'object'
      ? (envelope.data as Record<string, unknown>)
      : {};
  const details =
    data.details && typeof data.details === 'object'
      ? Object.fromEntries(
          Object.entries(data.details as Record<string, unknown>).map(
            ([key, value]) => [key, String(value)],
          ),
        )
      : {};
  return transportError(
    typeof data.code === 'string' ? data.code : fallbackCode,
    envelope.message || 'StoryCanvas contract request failed.',
    httpStatus >= 500,
    { httpStatus: String(httpStatus), ...details },
  );
}

export function assertCurrentDemoGrant(
  productionPackage: ProjectProductionPackage,
  grant: DemoProjectGrant,
  requiredScopes: Array<
    'production.package.read' | 'production.receipt.write'
  >,
  now = new Date(),
): DemoProjectGrant {
  requireCanonicalRoute(grant.tenantId, grant.projectId);
  const exactCapability =
    grant.capabilityIds.length === 1 &&
    grant.capabilityIds[0] === CAPABILITY_IDS.baseGeneration;
  const exactScopes =
    grant.scopes.join(',') ===
    'production.package.read,production.receipt.write';
  if (
    grant.grantId !== 'grant-demo-local-001-v1' ||
    grant.mockHandle !== 'mock-handle:grant-demo-local-001-v1' ||
    grant.tenantId !== productionPackage.tenantId ||
    grant.organizationId !== productionPackage.organizationId ||
    grant.organizationType !== productionPackage.organizationType ||
    grant.projectId !== productionPackage.projectId ||
    grant.packageId !== productionPackage.packageId ||
    grant.packageVersion !== productionPackage.packageVersion ||
    !exactCapability ||
    !exactScopes ||
    requiredScopes.some((scope) => !grant.scopes.includes(scope)) ||
    !productionPackage.capabilityGrants.some(
      (item) => item.capabilityId === CAPABILITY_IDS.baseGeneration,
    )
  ) {
    throw new ControlPlaneMockError(
      'GRANT_SCOPE_MISMATCH',
      'Current Demo grant 与 C5 tenant/organization/project/package/capability/scope 不一致。',
      { grantId: grant.grantId },
    );
  }
  const issuedAt = Date.parse(grant.issuedAt);
  const expiresAt = Date.parse(grant.expiresAt);
  const nowMs = now.getTime();
  if (
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt - issuedAt !== 15 * 60 * 1000 ||
    issuedAt > nowMs + 30_000 ||
    issuedAt < Date.parse(productionPackage.createdAt) ||
    expiresAt > Date.parse(productionPackage.expiresAt)
  ) {
    throw new ControlPlaneMockError(
      'GRANT_SCOPE_MISMATCH',
      'Current Demo grant 的 15 分钟有效期不在生产包有效期内。',
      { issuedAt: grant.issuedAt, expiresAt: grant.expiresAt },
    );
  }
  if (expiresAt <= nowMs) {
    throw new ControlPlaneMockError(
      'GRANT_EXPIRED',
      'Current Demo grant 已过期，必须重新签发；禁止重试生产动作。',
      { expiresAt: grant.expiresAt },
    );
  }
  return clone(grant);
}

export class StoryCanvasBridge {
  private readonly fetcher: typeof fetch;
  private state: StoryCanvasTransportState;
  private handoff: StoryCanvasHandoffState;
  private listeners = new Set<BridgeStateListener>();
  private childWindow: Window | null = null;
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private handoffTimer: ReturnType<typeof setTimeout> | null = null;
  private acceptedAttempt = false;

  constructor(config: StoryCanvasBridgeConfig = {}) {
    this.fetcher = config.fetcher ?? globalThis.fetch.bind(globalThis);
    this.state = {
      baseUrl: normalizeBaseUrl(
        config.baseUrl ?? DEFAULT_STORYCANVAS_API_BASE,
      ),
      phase: 'offline',
      connected: false,
      retryCount: 0,
      lastAttemptAt: null,
      lastConnectedAt: null,
      deepLink: null,
      packageId: null,
      projectId: null,
      lastError: null,
    };
    this.handoff = {
      status: 'idle',
      origin: STORYCANVAS_HANDOFF_ORIGIN,
      openedAt: null,
      expiresAt: null,
      readyAt: null,
      error: null,
    };
  }

  subscribe(listener: BridgeStateListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  configureBaseUrl(baseUrl: string): StoryCanvasTransportState {
    this.clearHandoff('closed');
    this.acceptedAttempt = false;
    this.state = {
      ...this.state,
      baseUrl: normalizeBaseUrl(baseUrl),
      phase: 'offline',
      connected: false,
      retryCount: 0,
      lastAttemptAt: null,
      lastConnectedAt: null,
      deepLink: null,
      packageId: null,
      projectId: null,
      lastError: null,
    };
    return this.publishState();
  }

  getState(): StoryCanvasTransportState {
    return clone(this.state);
  }

  getHandoffState(): StoryCanvasHandoffState {
    return clone(this.handoff);
  }

  resetOffline(): StoryCanvasTransportState {
    this.clearHandoff('closed');
    this.acceptedAttempt = false;
    this.state = {
      ...this.state,
      phase: 'offline',
      connected: false,
      retryCount: 0,
      lastAttemptAt: null,
      lastConnectedAt: null,
      deepLink: null,
      packageId: null,
      projectId: null,
      lastError: null,
    };
    return this.publishState();
  }

  restoreState(state: StoryCanvasTransportState): StoryCanvasTransportState {
    this.clearHandoff('closed');
    this.state = clone(state);
    this.acceptedAttempt = [
      'accepted',
      'duplicate',
      'handoff_waiting',
      'handoff_ready',
      'handoff_timeout',
    ].includes(state.phase);
    return this.publishState();
  }

  bootstrap(): ControlPlaneBootstrapResult {
    const snapshot = controlPlaneMockAdapter.getState();
    if (
      this.state.phase === 'error' ||
      this.state.phase === 'rejected' ||
      this.state.phase === 'handoff_timeout'
    ) {
      return {
        status: 'error',
        snapshot,
        transport: this.getState(),
        retryable: this.state.lastError?.retryable ?? false,
        error: clone(this.state.lastError),
      };
    }
    if (!this.state.connected) {
      return {
        status: 'offline',
        snapshot,
        transport: this.getState(),
        retryable: true,
        error:
          this.state.lastError ??
          transportError(
            'STORYCANVAS_OFFLINE',
            'StoryCanvas Bridge 尚未完成 HTTP 握手。',
            true,
          ),
      };
    }
    return {
      status: 'ready',
      snapshot,
      transport: this.getState(),
      retryable: false,
      error: null,
    };
  }

  async sendPackage(
    productionPackage: ProjectProductionPackage,
    grant: DemoProjectGrant,
  ): Promise<SendPackageResult> {
    requireCanonicalRoute(
      productionPackage.tenantId,
      productionPackage.projectId,
    );
    assertCurrentDemoGrant(
      productionPackage,
      grant,
      ['production.package.read'],
    );
    this.clearHandoff('closed');
    this.acceptedAttempt = false;
    this.state = {
      ...this.state,
      phase: this.state.retryCount > 0 ? 'retrying' : 'connecting',
      connected: false,
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
    };
    this.publishState();

    try {
      const response = await this.fetcher(
        `${this.state.baseUrl}${STORYCANVAS_ENDPOINTS.packages}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ package: productionPackage, grant }),
        },
      );
      const raw = (await response.json()) as unknown;
      if (!isApiEnvelope(raw)) {
        throw new Error('StoryCanvas package 响应不是 {code,data,message}。');
      }
      const data =
        raw.data && typeof raw.data === 'object'
          ? (raw.data as Record<string, unknown>)
          : {};
      const result =
        data.result === 'duplicate' || data.duplicate === true
          ? 'duplicate'
          : data.result === 'accepted' || data.status === 'accepted'
            ? 'accepted'
            : 'rejected';
      const packageId =
        typeof data.packageId === 'string'
          ? data.packageId
          : productionPackage.packageId;
      const projectId =
        typeof data.projectId === 'string'
          ? data.projectId
          : productionPackage.projectId;
      const deepLink =
        typeof data.deepLink === 'string' ? data.deepLink : null;
      const accepted =
        response.ok &&
        raw.code === 200 &&
        data.status === 'accepted' &&
        (result === 'accepted' || result === 'duplicate') &&
        packageId === productionPackage.packageId &&
        projectId === productionPackage.projectId;

      if (!accepted) {
        const error = apiError(
          raw,
          response.status,
          'STORYCANVAS_PACKAGE_REJECTED',
        );
        const rejected: StoryCanvasPackageResponse = {
          status: 'rejected',
          result: 'rejected',
          packageId,
          projectId,
          duplicate: false,
          deepLink,
          error,
        };
        this.state = {
          ...this.state,
          phase: 'rejected',
          connected: response.ok,
          lastError: error,
          packageId,
          projectId,
          deepLink,
        };
        return {
          response: rejected,
          transport: this.publishState(),
        };
      }

      const acceptedResponse: StoryCanvasPackageResponse = {
        status: 'accepted',
        result,
        packageId,
        projectId,
        duplicate: result === 'duplicate',
        deepLink,
        acceptedAt:
          typeof data.acceptedAt === 'string' ? data.acceptedAt : undefined,
      };
      this.acceptedAttempt = true;
      this.state = {
        ...this.state,
        phase: result,
        connected: true,
        retryCount: 0,
        lastConnectedAt: new Date().toISOString(),
        deepLink,
        packageId,
        projectId,
        lastError: null,
      };
      return {
        response: acceptedResponse,
        transport: this.publishState(),
      };
    } catch (error) {
      this.acceptedAttempt = false;
      this.state = {
        ...this.state,
        phase: 'error',
        connected: false,
        lastError: transportError(
          'STORYCANVAS_HTTP_ERROR',
          error instanceof Error ? error.message : 'StoryCanvas HTTP 请求失败。',
          true,
        ),
      };
      return { response: null, transport: this.publishState() };
    }
  }

  async retryPackage(
    productionPackage: ProjectProductionPackage,
    grant: DemoProjectGrant,
  ): Promise<SendPackageResult> {
    assertCurrentDemoGrant(
      productionPackage,
      grant,
      ['production.package.read'],
    );
    this.state = {
      ...this.state,
      phase: 'retrying',
      connected: false,
      retryCount: this.state.retryCount + 1,
      lastError: null,
    };
    this.publishState();
    return this.sendPackage(productionPackage, grant);
  }

  async pollPendingReceipts(
    productionPackage: ProjectProductionPackage,
    grant: DemoProjectGrant,
  ): Promise<ReceiptSyncResult> {
    requireCanonicalRoute(
      productionPackage.tenantId,
      productionPackage.projectId,
    );
    assertCurrentDemoGrant(
      productionPackage,
      grant,
      ['production.receipt.write'],
    );
    if (
      !this.acceptedAttempt ||
      this.state.packageId !== productionPackage.packageId ||
      this.state.projectId !== productionPackage.projectId
    ) {
      throw new ControlPlaneMockError(
        'TRANSPORT_REJECTED',
        '发包尚未被 StoryCanvas accepted/duplicate，不能轮询回执。',
      );
    }

    try {
      let pending = await this.fetchReceiptBatch(
        'pending',
        productionPackage,
        grant,
      );
      if (pending.length === 0) {
        pending = await this.fetchReceiptBatch(
          'delivered',
          productionPackage,
          grant,
        );
      }
      const ordered = [...pending].sort((left, right) => {
        const priority = {
          'generation-task': 0,
          asset: 1,
          export: 2,
        } as const;
        return (
          priority[left.receiptType] - priority[right.receiptType] ||
          left.createdAt.localeCompare(right.createdAt)
        );
      });
      const items: ReceiptSyncItemResult[] = [];
      for (const envelope of ordered) {
        const validationError = this.validateEnvelope(
          envelope,
          productionPackage,
        );
        if (validationError) {
          items.push({
            receiptId: envelope.id,
            deliveryId: envelope.deliveryId,
            kind: envelope.receiptType,
            status: 'rejected',
            acked: false,
            error: validationError,
          });
          continue;
        }

        try {
          const preview = this.preflightReceipt(grant, envelope);
          const ack = await this.ackReceipt(envelope, grant);
          if (!ack.ok) {
            items.push({
              receiptId: envelope.id,
              deliveryId: envelope.deliveryId,
              kind: envelope.receiptType,
              status: 'ack_error',
              acked: false,
              error: ack.error,
            });
            continue;
          }
          const acceptance = this.applyReceipt(grant, envelope);
          items.push({
            receiptId: envelope.id,
            deliveryId: envelope.deliveryId,
            kind: envelope.receiptType,
            status:
              preview.duplicate || acceptance.duplicate || ack.duplicate
                ? 'duplicate'
                : 'accepted',
            acked: true,
            error: null,
          });
        } catch (error) {
          items.push({
            receiptId: envelope.id,
            deliveryId: envelope.deliveryId,
            kind: envelope.receiptType,
            status: 'rejected',
            acked: false,
            error: transportError(
              'RECEIPT_REJECTED',
              error instanceof Error ? error.message : '回执被安全拒绝。',
              false,
            ),
          });
        }
      }
      this.state = {
        ...this.state,
        connected: true,
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
      };
      return { transport: this.publishState(), items };
    } catch (error) {
      this.state = {
        ...this.state,
        phase: 'error',
        connected: false,
        lastError: transportError(
          'STORYCANVAS_RECEIPT_POLL_ERROR',
          error instanceof Error ? error.message : 'Receipt Outbox 轮询失败。',
          true,
        ),
      };
      return { transport: this.publishState(), items: [] };
    }
  }

  openCanvasWithGrant(
    productionPackage: ProjectProductionPackage,
    grant: DemoProjectGrant,
    timeoutMs = 15_000,
  ): StoryCanvasHandoffState {
    if (
      !this.acceptedAttempt ||
      !this.state.deepLink ||
      this.state.packageId !== productionPackage.packageId ||
      this.state.projectId !== productionPackage.projectId
    ) {
      throw new ControlPlaneMockError(
        'TRANSPORT_REJECTED',
        '只有 accepted/duplicate package attempt 才能打开 StoryCanvas。',
      );
    }
    assertCurrentDemoGrant(
      productionPackage,
      grant,
      ['production.package.read', 'production.receipt.write'],
    );
    const target = new URL(this.state.deepLink);
    if (target.origin !== STORYCANVAS_HANDOFF_ORIGIN) {
      throw new ControlPlaneMockError(
        'HANDOFF_ORIGIN_REJECTED',
        'StoryCanvas deepLink origin 非白名单，已拒绝打开。',
        { origin: target.origin },
      );
    }
    if (typeof window === 'undefined') {
      throw new ControlPlaneMockError(
        'TRANSPORT_OFFLINE',
        '当前环境不能打开 StoryCanvas 子窗。',
      );
    }

    this.clearHandoff('closed');
    const openedAt = new Date();
    this.handoff = {
      status: 'opening',
      origin: STORYCANVAS_HANDOFF_ORIGIN,
      openedAt: openedAt.toISOString(),
      expiresAt: new Date(openedAt.getTime() + timeoutMs).toISOString(),
      readyAt: null,
      error: null,
    };
    this.notifyListeners();
    const child = window.open(this.state.deepLink, '_blank');
    if (!child) {
      this.handoff = {
        ...this.handoff,
        status: 'error',
        error: transportError(
          'STORYCANVAS_WINDOW_BLOCKED',
          'StoryCanvas 子窗被浏览器阻止。',
          true,
        ),
      };
      this.notifyListeners();
      return this.getHandoffState();
    }
    this.childWindow = child;
    this.handoff = {
      ...this.handoff,
      status: 'waiting_for_grant_request',
    };
    this.state = {
      ...this.state,
      phase: 'handoff_waiting',
      connected: true,
      lastError: null,
    };
    this.publishState();

    this.messageHandler = (event: MessageEvent) => {
      if (
        event.origin !== STORYCANVAS_HANDOFF_ORIGIN ||
        event.source !== this.childWindow ||
        !event.data ||
        typeof event.data !== 'object'
      ) {
        return;
      }
      const message = event.data as Record<string, unknown>;
      if (message.type === 'storycanvas:d1-grant-request') {
        if (
          message.projectId !== CONTROL_PLANE_FIXTURE_ID ||
          message.packageId !== DEMO_PACKAGE_ID
        ) {
          this.failHandoff(
            'HANDOFF_IDENTITY_MISMATCH',
            'StoryCanvas grant request 缺少或携带错误的 canonical projectId/packageId。',
          );
          return;
        }
        try {
          assertCurrentDemoGrant(
            productionPackage,
            grant,
            ['production.package.read', 'production.receipt.write'],
          );
          this.childWindow?.postMessage(
            {
              type: 'storycanvas:d1-grant',
              projectId: CONTROL_PLANE_FIXTURE_ID,
              packageId: DEMO_PACKAGE_ID,
              grant,
            },
            STORYCANVAS_HANDOFF_ORIGIN,
          );
          this.handoff = { ...this.handoff, status: 'grant_sent' };
          this.notifyListeners();
        } catch (error) {
          this.failHandoff(
            error instanceof ControlPlaneMockError
              ? error.code
              : 'GRANT_HANDOFF_FAILED',
            error instanceof Error ? error.message : 'Grant handoff 失败。',
          );
        }
        return;
      }
      if (message.type === 'storycanvas:d1-ready') {
        if (
          message.projectId !== CONTROL_PLANE_FIXTURE_ID ||
          message.packageId !== DEMO_PACKAGE_ID
        ) {
          this.failHandoff(
            'HANDOFF_IDENTITY_MISMATCH',
            'StoryCanvas ready 缺少或携带错误的 canonical projectId/packageId。',
          );
          return;
        }
        this.handoff = {
          ...this.handoff,
          status: 'ready',
          readyAt: new Date().toISOString(),
          error: null,
        };
        this.state = {
          ...this.state,
          phase: 'handoff_ready',
          connected: true,
          lastConnectedAt: new Date().toISOString(),
          lastError: null,
        };
        this.publishState();
        this.detachHandoffListeners();
      }
    };
    window.addEventListener('message', this.messageHandler);
    this.handoffTimer = setTimeout(() => {
      this.handoff = {
        ...this.handoff,
        status: 'timeout',
        error: transportError(
          'HANDOFF_TIMEOUT',
          'StoryCanvas grant handoff 等待超时。',
          true,
        ),
      };
      this.state = {
        ...this.state,
        phase: 'handoff_timeout',
        lastError: this.handoff.error,
      };
      this.publishState();
      this.detachHandoffListeners();
    }, timeoutMs);
    return this.getHandoffState();
  }

  clearHandoff(status: 'idle' | 'closed' = 'closed'): StoryCanvasHandoffState {
    this.detachHandoffListeners();
    this.childWindow = null;
    this.handoff = {
      status,
      origin: STORYCANVAS_HANDOFF_ORIGIN,
      openedAt: null,
      expiresAt: null,
      readyAt: null,
      error: null,
    };
    this.notifyListeners();
    return this.getHandoffState();
  }

  private async fetchReceiptBatch(
    status: 'pending' | 'delivered',
    productionPackage: ProjectProductionPackage,
    grant: DemoProjectGrant,
  ): Promise<ReceiptOutboxEnvelope[]> {
    const url = new URL(
      `${this.state.baseUrl}${STORYCANVAS_ENDPOINTS.receipts}`,
    );
    url.searchParams.set('projectId', productionPackage.projectId);
    url.searchParams.set('status', status);
    const response = await this.fetcher(url.toString(), {
      method: 'GET',
      headers: {
        [STORYCANVAS_DEMO_GRANT_HEADER]: base64UrlJson(grant),
      },
    });
    const raw = (await response.json()) as unknown;
    if (!isApiEnvelope(raw)) {
      throw new Error('StoryCanvas receipt 响应不是 {code,data,message}。');
    }
    if (!response.ok || raw.code !== 200 || !Array.isArray(raw.data)) {
      throw new Error(
        apiError(
          raw,
          response.status,
          'STORYCANVAS_RECEIPT_LIST_REJECTED',
        ).message,
      );
    }
    return raw.data.map((item) =>
      this.normalizeReceiptEnvelope(item, productionPackage),
    );
  }

  private normalizeReceiptEnvelope(
    value: unknown,
    productionPackage: ProjectProductionPackage,
  ): ReceiptOutboxEnvelope {
    if (!value || typeof value !== 'object') {
      throw new Error('C5 Outbox item 不是 object。');
    }
    const row = value as Record<string, unknown>;
    const payload =
      row.payload && typeof row.payload === 'object'
        ? (row.payload as
            | GenerationTaskReceipt
            | AssetReceipt
            | ExportReceipt)
        : null;
    const projectId =
      typeof row.projectId === 'string'
        ? row.projectId
        : payload && 'projectId' in payload
          ? payload.projectId
          : '';
    const payloadDigest =
      typeof row.payloadDigest === 'string'
        ? row.payloadDigest
        : typeof row.digest === 'string'
          ? row.digest
          : '';
    const normalized = {
      ...row,
      projectId,
      packageId:
        typeof row.packageId === 'string'
          ? row.packageId
          : productionPackage.packageId,
      packageDigest:
        typeof row.packageDigest === 'string'
          ? row.packageDigest
          : productionPackage.digest,
      payloadDigest,
      digest:
        typeof row.digest === 'string' ? row.digest : payloadDigest,
      payload,
    } as unknown as ReceiptOutboxEnvelope;
    if (
      typeof normalized.id !== 'string' ||
      !['generation-task', 'asset', 'export'].includes(
        String(normalized.receiptType),
      ) ||
      typeof normalized.businessId !== 'string' ||
      typeof normalized.deliveryId !== 'string' ||
      normalized.status !== 'delivered' ||
      !payload
    ) {
      throw new Error('C5 delivered Outbox envelope 字段不完整。');
    }
    return normalized;
  }

  private validateEnvelope(
    envelope: ReceiptOutboxEnvelope,
    productionPackage: ProjectProductionPackage,
  ): StandardReceiptError | null {
    const payload = envelope.payload;
    const payloadDigest = digestValue(payload);
    const payloadTenantId =
      payload && typeof payload === 'object' && 'tenantId' in payload
        ? payload.tenantId
        : null;
    const payloadProjectId =
      payload && typeof payload === 'object' && 'projectId' in payload
        ? payload.projectId
        : null;
    const generationTaskId =
      payload && typeof payload === 'object' && 'generationTaskId' in payload
        ? payload.generationTaskId
        : null;
    const businessMatches =
      (envelope.receiptType === 'generation-task' &&
        'generationTaskId' in payload &&
        envelope.businessId === payload.generationTaskId) ||
      (envelope.receiptType === 'asset' &&
        'assetId' in payload &&
        envelope.businessId === payload.assetId) ||
      (envelope.receiptType === 'export' &&
        'exportId' in payload &&
        envelope.businessId === payload.exportId);
    const taskMatches =
      typeof generationTaskId === 'string' &&
      [DEMO_SUCCESS_TASK_ID, DEMO_FAILURE_TASK_ID].includes(
        generationTaskId as
          | typeof DEMO_SUCCESS_TASK_ID
          | typeof DEMO_FAILURE_TASK_ID,
      );
    const identityMatches =
      envelope.status === 'delivered' &&
      envelope.projectId === productionPackage.projectId &&
      envelope.packageId === productionPackage.packageId &&
      envelope.packageDigest === productionPackage.digest &&
      payloadTenantId === productionPackage.tenantId &&
      payloadProjectId === productionPackage.projectId &&
      (envelope.payloadDigest === payloadDigest ||
        envelope.digest === payloadDigest) &&
      envelope.deliveryId.length > 0;
    if (identityMatches && businessMatches && taskMatches) return null;
    return transportError(
      'RECEIPT_SCOPE_MISMATCH',
      '回执 envelope/payload/digest/tenant/project/package/task 不匹配，未 ACK、未入账。',
      false,
      { receiptId: envelope.id },
    );
  }

  private preflightReceipt(
    grant: DemoProjectGrant,
    envelope: ReceiptOutboxEnvelope,
  ) {
    if (envelope.receiptType === 'generation-task') {
      return controlPlaneMockAdapter.preflightGenerationTaskReceipt(
        grant.grantId,
        envelope.payload as GenerationTaskReceipt,
      );
    }
    if (envelope.receiptType === 'asset') {
      return controlPlaneMockAdapter.preflightAssetReceipt(
        grant.grantId,
        envelope.payload as AssetReceipt,
      );
    }
    return controlPlaneMockAdapter.preflightExportReceipt(
      grant.grantId,
      envelope.payload as ExportReceipt,
    );
  }

  private applyReceipt(
    grant: DemoProjectGrant,
    envelope: ReceiptOutboxEnvelope,
  ) {
    if (envelope.receiptType === 'generation-task') {
      return controlPlaneMockAdapter.receiveGenerationTaskReceipt(
        grant.grantId,
        envelope.payload as GenerationTaskReceipt,
      );
    }
    if (envelope.receiptType === 'asset') {
      return controlPlaneMockAdapter.receiveAssetReceipt(
        grant.grantId,
        envelope.payload as AssetReceipt,
      );
    }
    return controlPlaneMockAdapter.receiveExportReceipt(
      grant.grantId,
      envelope.payload as ExportReceipt,
    );
  }

  private async ackReceipt(
    envelope: ReceiptOutboxEnvelope,
    grant: DemoProjectGrant,
  ): Promise<
    | { ok: true; duplicate: boolean }
    | { ok: false; duplicate: false; error: StandardReceiptError }
  > {
    try {
      const response = await this.fetcher(
        `${this.state.baseUrl}${STORYCANVAS_ENDPOINTS.receiptAck(envelope.id)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ grant, deliveryId: envelope.deliveryId }),
        },
      );
      const raw = (await response.json()) as unknown;
      if (!isApiEnvelope(raw)) {
        return {
          ok: false,
          duplicate: false,
          error: transportError(
            'STORYCANVAS_ACK_INVALID',
            'ACK 响应不是 {code,data,message}；本地状态保持零变化。',
            true,
          ),
        };
      }
      const data =
        raw.data && typeof raw.data === 'object'
          ? (raw.data as Record<string, unknown>)
          : {};
      const success =
        response.ok &&
        raw.code === 200 &&
        data.id === envelope.id &&
        data.deliveryId === envelope.deliveryId &&
        data.status === 'acknowledged';
      if (!success) {
        return {
          ok: false,
          duplicate: false,
          error: apiError(raw, response.status, 'STORYCANVAS_ACK_REJECTED'),
        };
      }
      return { ok: true, duplicate: data.duplicate === true };
    } catch (error) {
      return {
        ok: false,
        duplicate: false,
        error: transportError(
          'STORYCANVAS_ACK_ERROR',
          `${
            error instanceof Error ? error.message : 'ACK 请求失败'
          }；本地 Task/Asset/Credit 保持零变化。`,
          true,
        ),
      };
    }
  }

  private failHandoff(code: string, message: string) {
    this.handoff = {
      ...this.handoff,
      status: 'error',
      error: transportError(code, message, false),
    };
    this.state = {
      ...this.state,
      phase: 'error',
      lastError: this.handoff.error,
    };
    this.publishState();
    this.detachHandoffListeners();
  }

  private detachHandoffListeners() {
    if (this.messageHandler && typeof window !== 'undefined') {
      window.removeEventListener('message', this.messageHandler);
    }
    this.messageHandler = null;
    if (this.handoffTimer !== null) clearTimeout(this.handoffTimer);
    this.handoffTimer = null;
    this.childWindow = null;
  }

  private notifyListeners() {
    const transport = this.getState();
    const handoff = this.getHandoffState();
    this.listeners.forEach((listener) => listener(transport, handoff));
  }

  private publishState(): StoryCanvasTransportState {
    controlPlaneMockAdapter.setTransportState(this.state);
    this.notifyListeners();
    return this.getState();
  }
}

export const storyCanvasBridge = new StoryCanvasBridge();
