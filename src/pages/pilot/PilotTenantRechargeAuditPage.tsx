import { AuditOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotRechargeOrderAudit,
  type PilotRechargeOrderStatus,
} from '../../services/pilotControlApi';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';

const RECHARGE_AUDIT_LIMIT = 50;

type RechargeErrorKind =
  'unauthorized' | 'forbidden' | 'not-found' | 'service-error' | 'invalid-response';

interface RechargeErrorState {
  kind: RechargeErrorKind;
  requestId: string | null;
}

type RechargeAuditState =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' }
  | { phase: 'ready'; orders: PilotRechargeOrderAudit[] }
  | { phase: 'error'; error: RechargeErrorState };

const STATUS_CONTENT: Record<
  PilotRechargeOrderStatus,
  { color: string; label: string; description: string }
> = {
  created: {
    color: 'default',
    label: 'created',
    description: 'TEST 订单事实已创建',
  },
  pending: {
    color: 'processing',
    label: 'pending',
    description: 'TEST 处理状态待终结',
  },
  paid: {
    color: 'success',
    label: 'paid',
    description: 'TEST 原子应用已记录',
  },
  partially_refunded: {
    color: 'warning',
    label: 'partially_refunded',
    description: 'TEST 部分退款状态（只读）',
  },
  refunded: {
    color: 'orange',
    label: 'refunded',
    description: 'TEST 全额冲正状态已记录',
  },
  cancelled: {
    color: 'default',
    label: 'cancelled',
    description: 'TEST 订单取消状态',
  },
  disputed: {
    color: 'error',
    label: 'disputed',
    description: 'TEST 争议状态待审计',
  },
};

function clearUnauthorizedPilotSession(): void {
  usePilotProjectContextStore.getState().reset();
  usePilotAuthStore.setState({
    status: 'anonymous',
    session: null,
    error: null,
    requestId: null,
  });
}

function classifyRechargeError(error: unknown): RechargeErrorState {
  if (!(error instanceof PilotControlApiError)) {
    return { kind: 'service-error', requestId: null };
  }
  if (error.status === 401) {
    clearUnauthorizedPilotSession();
    return { kind: 'unauthorized', requestId: error.requestId };
  }
  if (error.status === 403) return { kind: 'forbidden', requestId: error.requestId };
  if (error.status === 404) return { kind: 'not-found', requestId: error.requestId };
  if (error.code === 'INVALID_API_RESPONSE') {
    return { kind: 'invalid-response', requestId: error.requestId };
  }
  return { kind: 'service-error', requestId: error.requestId };
}

function formatAmount(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function formatCredits(value: number): string {
  return value.toLocaleString('zh-CN');
}

function formatAuditTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间不可用';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

function shortOrderReference(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function RechargeHeader({ canReload, onReload }: { canReload: boolean; onReload: () => void }) {
  return (
    <header className="d1-page-header">
      <div>
        <Space size={8} wrap>
          <Tag color="blue">PILOT</Tag>
          <Tag color="gold">TEST · READ ONLY</Tag>
          <Tag>BOUNDED 50</Tag>
        </Space>
        <Typography.Title level={2}>Tenant TEST RechargeOrder Audit</Typography.Title>
        <Typography.Paragraph type="secondary">
          只读取当前 Session canonical Tenant 的最小充值审计投影，不提供创建、支付模拟或退款动作。
        </Typography.Paragraph>
      </div>
      {canReload ? (
        <Button icon={<ReloadOutlined />} onClick={onReload}>
          重新加载真实充值审计
        </Button>
      ) : null}
    </header>
  );
}

function RechargeBoundaryNotice() {
  return (
    <Alert
      type="warning"
      showIcon
      icon={<SafetyCertificateOutlined />}
      message="TEST · READ ONLY · NON_QUOTE"
      description="这些记录非真实收款、非可用余额承诺；paid、refunded、disputed 仅为 TEST 审计状态，不代表真实支付、到账或退款完成。"
    />
  );
}

const ERROR_CONTENT: Record<
  RechargeErrorKind,
  { title: string; description: string; testId: string; retryable: boolean }
> = {
  unauthorized: {
    title: 'Pilot Session 已失效',
    description: '会话已失效，请重新登录。旧 RechargeOrder 投影已清除。',
    testId: 'pilot-tenant-recharge-unauthorized',
    retryable: false,
  },
  forbidden: {
    title: '无 Tenant 充值审计权限',
    description: '当前会话无权查看该 Tenant 的 TEST RechargeOrder。',
    testId: 'pilot-tenant-recharge-forbidden',
    retryable: false,
  },
  'not-found': {
    title: 'Tenant 充值审计范围不可用',
    description: '当前 canonical Tenant 或充值审计资源不可用，未披露其他 Tenant 信息。',
    testId: 'pilot-tenant-recharge-not-found',
    retryable: false,
  },
  'service-error': {
    title: 'Tenant 充值审计服务暂不可用',
    description: '无法完成真实 Control API 读取；不会回退 Demo、Mock 或本地商业数据。',
    testId: 'pilot-tenant-recharge-service-error',
    retryable: true,
  },
  'invalid-response': {
    title: 'Tenant 充值审计响应无效',
    description: '服务返回了无法安全解析的数据，页面已 fail closed。',
    testId: 'pilot-tenant-recharge-invalid-response',
    retryable: true,
  },
};

function RechargeErrorPanel({
  error,
  onRetry,
}: {
  error: RechargeErrorState;
  onRetry: () => void;
}) {
  const content = ERROR_CONTENT[error.kind];
  return (
    <section className="d1-surface" data-testid={content.testId}>
      <Result
        status={error.kind === 'not-found' ? '404' : error.kind === 'service-error' ? '500' : '403'}
        title={content.title}
        subTitle={content.description}
        extra={
          content.retryable ? (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              重试真实 RechargeOrder Audit
            </Button>
          ) : undefined
        }
      >
        {error.requestId ? <Alert type="info" message={`请求 ID：${error.requestId}`} /> : null}
      </Result>
    </section>
  );
}

function RechargeOrderRow({ order }: { order: PilotRechargeOrderAudit }) {
  const status = STATUS_CONTENT[order.status];
  return (
    <article
      style={{
        padding: 16,
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        background: '#fff',
      }}
    >
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Space size={8} wrap>
          <AuditOutlined />
          <Typography.Text strong>
            订单 {shortOrderReference(order.rechargeOrderId)}
          </Typography.Text>
          <Tag color="gold">TEST</Tag>
          <Tag color={status.color}>{status.label}</Tag>
        </Space>
        <Typography.Text type="secondary">{status.description}</Typography.Text>
        <Typography.Text>
          审计金额：<strong>{formatAmount(order.amountMinor, order.currency)}</strong>
        </Typography.Text>
        <Typography.Text>
          购买额度 {formatCredits(order.purchasedCredits)} · 赠送额度{' '}
          {formatCredits(order.bonusCredits)}
        </Typography.Text>
        <Typography.Text>
          赠送到期：
          {order.bonusExpiresInDays === null
            ? '无冻结天数'
            : `${order.bonusExpiresInDays.toLocaleString('zh-CN')} 天`}
        </Typography.Text>
        <Typography.Text type="secondary">
          创建 {formatAuditTime(order.createdAt)} UTC · 更新 {formatAuditTime(order.updatedAt)} UTC
        </Typography.Text>
      </Space>
    </article>
  );
}

export function PilotTenantRechargeAuditPage() {
  const session = usePilotAuthStore((state) => state.session);
  const [state, setState] = useState<RechargeAuditState>({ phase: 'loading' });

  const isTenantScope = session?.activeContext.organizationType === 'TENANT';
  const hasTenantAdminRole = session?.activeContext.roles.includes('tenant_admin') ?? false;
  const tenantId = isTenantScope ? (session?.activeContext.tenantId ?? null) : null;
  const contextAllowed = isTenantScope && hasTenantAdminRole && Boolean(tenantId);

  const load = useCallback(
    async (retrying = false) => {
      if (!contextAllowed || !tenantId) return;
      setState({ phase: retrying ? 'retrying' : 'loading' });
      try {
        const orders = await pilotControlApi.listTenantRechargeOrders(
          tenantId,
          RECHARGE_AUDIT_LIMIT,
        );
        setState(orders.length === 0 ? { phase: 'empty' } : { phase: 'ready', orders });
      } catch (error) {
        setState({ phase: 'error', error: classifyRechargeError(error) });
      }
    },
    [contextAllowed, tenantId],
  );

  useEffect(() => {
    if (contextAllowed) void load();
  }, [contextAllowed, load]);

  if (state.phase === 'error' && state.error.kind === 'unauthorized') {
    return (
      <div className="d1-page-stack">
        <RechargeHeader canReload={false} onReload={() => undefined} />
        <RechargeBoundaryNotice />
        <RechargeErrorPanel error={state.error} onRetry={() => undefined} />
      </div>
    );
  }

  if (!isTenantScope || !hasTenantAdminRole) {
    return (
      <div className="d1-page-stack">
        <RechargeHeader canReload={false} onReload={() => undefined} />
        <RechargeBoundaryNotice />
        <section className="d1-surface" data-testid="pilot-tenant-recharge-permission-denied">
          <Result
            status="403"
            title="无 Tenant 充值审计权限"
            subTitle="仅 tenant_admin 可查看当前 Tenant 的 TEST RechargeOrder；会话不会切换 Scope。"
          />
        </section>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div className="d1-page-stack">
        <RechargeHeader canReload={false} onReload={() => undefined} />
        <RechargeBoundaryNotice />
        <section className="d1-surface" data-testid="pilot-tenant-recharge-context-error">
          <Result
            status="404"
            title="canonical Tenant Context 不可用"
            subTitle="Session 未提供可验证的 tenantId，页面不会猜测 Organization、Project 或 URL 参数。"
          />
        </section>
      </div>
    );
  }

  const loading = state.phase === 'loading' || state.phase === 'retrying';

  return (
    <div className="d1-page-stack">
      <RechargeHeader
        canReload={!loading}
        onReload={() => {
          void load(true);
        }}
      />
      <RechargeBoundaryNotice />

      {loading ? (
        <section
          className="d1-surface"
          data-testid={
            state.phase === 'retrying'
              ? 'pilot-tenant-recharge-retrying'
              : 'pilot-tenant-recharge-loading'
          }
        >
          <Space
            direction="vertical"
            align="center"
            size={12}
            style={{ width: '100%', padding: 32 }}
          >
            <Spin size="large" />
            <Typography.Text strong>
              {state.phase === 'retrying'
                ? '正在重新加载真实 Tenant RechargeOrder Audit…'
                : '正在加载真实 Tenant RechargeOrder Audit…'}
            </Typography.Text>
            <Typography.Text type="secondary">
              旧投影已清空；只读取 Session canonical tenantId 的 bounded 50 条记录。
            </Typography.Text>
          </Space>
        </section>
      ) : null}

      {state.phase === 'empty' ? (
        <section className="d1-surface" data-testid="pilot-tenant-recharge-empty">
          <Empty description={null}>
            <Typography.Title level={4}>
              当前 bounded window 没有 TEST RechargeOrder
            </Typography.Title>
            <Typography.Paragraph type="secondary">
              空列表是有效审计结果；页面不会读取 Demo 数据或虚构充值记录。
            </Typography.Paragraph>
          </Empty>
        </section>
      ) : null}

      {state.phase === 'ready' ? (
        <section className="d1-surface" data-testid="pilot-tenant-recharge-ready">
          <div className="d1-section-heading">
            <div>
              <Typography.Title level={3}>当前 TEST RechargeOrder 审计窗口</Typography.Title>
              <Typography.Paragraph type="secondary">
                共 {state.orders.length} 条严格安全投影；退款/争议仅表示 TEST 审计状态。
              </Typography.Paragraph>
            </div>
            <Tag color="blue">{state.orders.length} / 50</Tag>
          </div>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {state.orders.map((order) => (
              <RechargeOrderRow key={order.rechargeOrderId} order={order} />
            ))}
          </Space>
        </section>
      ) : null}

      {state.phase === 'error' ? (
        <RechargeErrorPanel error={state.error} onRetry={() => void load(true)} />
      ) : null}
    </div>
  );
}
