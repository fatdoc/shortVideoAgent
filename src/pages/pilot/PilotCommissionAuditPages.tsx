import {
  AuditOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCommercialChannelReference,
  type PilotCommissionAccrualAudit,
  type PilotCommissionCalculationAudit,
  type PilotCommissionReversalAudit,
  type PilotPaymentEventAudit,
} from '../../services/pilotControlApi';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import './v3-ops.css';

const AUDIT_LIST_LIMIT = 50;

type AuditErrorKind =
  'unauthorized' | 'forbidden' | 'not-found' | 'service-error' | 'invalid-response';

interface AuditErrorState {
  kind: AuditErrorKind;
  requestId: string | null;
}

interface PlatformAuditData {
  paymentEvents: PilotPaymentEventAudit[];
  calculations: PilotCommissionCalculationAudit[];
  accruals: PilotCommissionAccrualAudit[];
  reversals: PilotCommissionReversalAudit[];
  manualReviews: PilotCommissionCalculationAudit[];
}

interface ChannelAuditData {
  channel: PilotCommercialChannelReference;
  calculations: PilotCommissionCalculationAudit[];
  accruals: PilotCommissionAccrualAudit[];
  reversals: PilotCommissionReversalAudit[];
}

type PlatformAuditState =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' | 'ready'; data: PlatformAuditData }
  | { phase: 'error'; error: AuditErrorState };

type ChannelAuditState =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' | 'ready'; data: ChannelAuditData }
  | { phase: 'error'; error: AuditErrorState };

function clearUnauthorizedPilotSession(): void {
  usePilotProjectContextStore.getState().reset();
  usePilotAuthStore.setState({
    status: 'anonymous',
    session: null,
    error: null,
    requestId: null,
  });
}

function classifyAuditError(error: unknown): AuditErrorState {
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

function shortReference(value: string | null): string {
  if (!value) return '未分配';
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

function isPlatformEmpty(data: PlatformAuditData): boolean {
  return (
    data.paymentEvents.length === 0 &&
    data.calculations.length === 0 &&
    data.accruals.length === 0 &&
    data.reversals.length === 0 &&
    data.manualReviews.length === 0
  );
}

function isChannelEmpty(data: ChannelAuditData): boolean {
  return (
    data.calculations.length === 0 && data.accruals.length === 0 && data.reversals.length === 0
  );
}

function AuditHeader({
  title,
  description,
  contextLabel,
  onReload,
  canReload,
}: {
  title: string;
  description: string;
  contextLabel: string;
  onReload: () => void;
  canReload: boolean;
}) {
  return (
    <header className="d1-page-header">
      <div>
        <Space size={8} wrap>
          <Tag color="blue">PILOT</Tag>
          <Tag color="gold">TEST · READ ONLY</Tag>
          <Tag>{contextLabel}</Tag>
        </Space>
        <Typography.Title level={2}>{title}</Typography.Title>
        <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      </div>
      {canReload ? (
        <Button icon={<ReloadOutlined />} onClick={onReload}>
          重新加载真实审计
        </Button>
      ) : null}
    </header>
  );
}

function AuditLoading({ testId, retrying }: { testId: string; retrying: boolean }) {
  return (
    <section className="d1-surface" data-testid={testId}>
      <Space direction="vertical" align="center" size={12} style={{ width: '100%', padding: 32 }}>
        <Spin size="large" />
        <Typography.Text strong>
          {retrying ? '正在重新加载真实 Control API 审计…' : '正在加载真实 Control API 审计…'}
        </Typography.Text>
        <Typography.Text type="secondary">
          当前投影已清空；不会读取演示或本地商业数据。
        </Typography.Text>
      </Space>
    </section>
  );
}

const AUDIT_ERROR_CONTENT: Record<
  AuditErrorKind,
  { status: '403' | '404' | '500'; title: string; description: string; testId: string }
> = {
  unauthorized: {
    status: '403',
    title: 'Pilot Session 已失效',
    description: '会话已失效，请重新登录。旧商业投影已清除。',
    testId: 'pilot-commercial-audit-unauthorized',
  },
  forbidden: {
    status: '403',
    title: '无商业审计权限',
    description: '当前会话无权查看该审计范围。系统不会切换到其他 Organization。',
    testId: 'pilot-commercial-audit-forbidden',
  },
  'not-found': {
    status: '404',
    title: '审计范围不可用',
    description: '当前审计范围或 canonical 资源不可用，未披露其他 Organization 信息。',
    testId: 'pilot-commercial-audit-not-found',
  },
  'service-error': {
    status: '500',
    title: '商业审计服务暂不可用',
    description: '无法完成真实 Control API 读取，请稍后重试。',
    testId: 'pilot-commercial-audit-service-error',
  },
  'invalid-response': {
    status: '500',
    title: '商业审计响应无效',
    description: '服务返回了无法安全解析的数据；页面已 fail closed。',
    testId: 'pilot-commercial-audit-invalid-response',
  },
};

function AuditErrorPanel({ error, onRetry }: { error: AuditErrorState; onRetry: () => void }) {
  const content = AUDIT_ERROR_CONTENT[error.kind];
  const retryable = error.kind === 'service-error' || error.kind === 'invalid-response';
  return (
    <section className="d1-surface" data-testid={content.testId}>
      <Result
        status={content.status}
        title={content.title}
        subTitle={content.description}
        extra={
          retryable ? (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              重试真实 Control API
            </Button>
          ) : undefined
        }
      >
        {error.requestId ? (
          <Alert type="info" showIcon message={`请求 ID：${error.requestId}`} />
        ) : null}
      </Result>
    </section>
  );
}

function AuditEmpty({
  testId,
  title,
  description,
}: {
  testId: string;
  title: string;
  description: string;
}) {
  return (
    <section className="d1-surface" data-testid={testId}>
      <Empty description={null}>
        <Typography.Title level={4}>{title}</Typography.Title>
        <Typography.Paragraph type="secondary">{description}</Typography.Paragraph>
      </Empty>
    </section>
  );
}

function AuditSection({
  title,
  description,
  count,
  children,
}: {
  title: string;
  description: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section className="d1-surface">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={4}>{title}</Typography.Title>
          <Typography.Text type="secondary">{description}</Typography.Text>
        </div>
        <Tag color={count > 0 ? 'blue' : 'default'}>{count} 条</Tag>
      </div>
      {count > 0 ? children : <Typography.Text type="secondary">当前窗口暂无记录</Typography.Text>}
    </section>
  );
}

function AuditRow({
  icon,
  title,
  metadata,
  amount,
  status,
}: {
  icon: ReactNode;
  title: string;
  metadata: string;
  amount: string;
  status: ReactNode;
}) {
  return (
    <div className="d1-receipt-row">
      <span className="d1-receipt-icon is-asset">{icon}</span>
      <div>
        <Typography.Text strong>{title}</Typography.Text>
        <Typography.Text type="secondary">{metadata}</Typography.Text>
      </div>
      <Typography.Text strong>{amount}</Typography.Text>
      {status}
    </div>
  );
}

function CommercialAuditDisclaimer() {
  return (
    <Alert
      type="warning"
      showIcon
      message="TEST 审计事实 · 有界只读窗口"
      description="页面只展示真实 Control API 的最小安全投影，不表示已到账、可提现、paid 或自动打款；不提供真实比例、review/approve 或资金操作。"
    />
  );
}

function CalculationRows({ items }: { items: PilotCommissionCalculationAudit[] }) {
  return (
    <div className="d1-receipt-list">
      {items.map((item) => (
        <AuditRow
          key={item.commissionCalculationOutcomeId}
          icon={<AuditOutlined />}
          title={item.reasonCode}
          metadata={`${formatAuditTime(item.occurredAt)} · Channel ${shortReference(item.beneficiaryChannelId)} · Order ${shortReference(item.rechargeOrderId)}`}
          amount={formatAmount(item.basisAmountMinor, item.currency)}
          status={<Tag color={item.outcome === 'accrued' ? 'green' : 'gold'}>{item.outcome}</Tag>}
        />
      ))}
    </div>
  );
}

function AccrualRows({ items }: { items: PilotCommissionAccrualAudit[] }) {
  return (
    <div className="d1-receipt-list">
      {items.map((item) => (
        <AuditRow
          key={item.commissionAccrualId}
          icon={<CheckCircleOutlined />}
          title={`Accrual ${shortReference(item.commissionAccrualId)}`}
          metadata={`eligible ${formatAuditTime(item.eligibleAt)} · basis ${formatAmount(item.basisAmountMinor, item.currency)} · Order ${shortReference(item.rechargeOrderId)}`}
          amount={formatAmount(item.commissionAmountMinor, item.currency)}
          status={<Tag color="green">accrued</Tag>}
        />
      ))}
    </div>
  );
}

function ReversalRows({ items }: { items: PilotCommissionReversalAudit[] }) {
  return (
    <div className="d1-receipt-list">
      {items.map((item) => (
        <AuditRow
          key={item.commissionReversalId}
          icon={<ExclamationCircleOutlined />}
          title={`${item.reversalType} reversal`}
          metadata={`${formatAuditTime(item.occurredAt)} · Accrual ${shortReference(item.commissionAccrualId)} · Order ${shortReference(item.rechargeOrderId)}`}
          amount={`-${formatAmount(item.reversalAmountMinor, item.currency)}`}
          status={<Tag color="red">reversed</Tag>}
        />
      ))}
    </div>
  );
}

function PlatformAuditReady({ data }: { data: PlatformAuditData }) {
  return (
    <div data-testid="pilot-platform-commission-audit-ready" className="d1-page-stack v3-ops-page">
      <AuditSection
        title="Payment Events"
        description="仅显示 TEST 类型、处理状态、金额与安全时间字段。"
        count={data.paymentEvents.length}
      >
        <div className="d1-receipt-list">
          {data.paymentEvents.map((item) => (
            <AuditRow
              key={item.paymentEventId}
              icon={<SafetyCertificateOutlined />}
              title={item.eventType}
              metadata={`${formatAuditTime(item.occurredAt)} · Order ${shortReference(item.rechargeOrderId)}${item.errorCode ? ` · ${item.errorCode}` : ''}`}
              amount={formatAmount(item.amountMinor, item.currency)}
              status={
                <Tag color={item.processingStatus === 'applied' ? 'green' : 'gold'}>
                  {item.processingStatus}
                </Tag>
              }
            />
          ))}
        </div>
      </AuditSection>

      <AuditSection
        title="Commission Calculations"
        description="显示既有计算结果与安全 reason code，不推导真实比例。"
        count={data.calculations.length}
      >
        <CalculationRows items={data.calculations} />
      </AuditSection>

      <AuditSection
        title="Commission Accruals"
        description="只读显示 TEST 应计事实；不表示到账或可提现。"
        count={data.accruals.length}
      >
        <AccrualRows items={data.accruals} />
      </AuditSection>

      <AuditSection
        title="Commission Reversals"
        description="只读显示退款或拒付导致的 TEST 冲正事实。"
        count={data.reversals.length}
      >
        <ReversalRows items={data.reversals} />
      </AuditSection>

      <AuditSection
        title="Manual Reviews"
        description="只读队列，不提供 review/approve HTTP 或操作按钮。"
        count={data.manualReviews.length}
      >
        <div className="d1-receipt-list">
          {data.manualReviews.map((item) => (
            <AuditRow
              key={item.commissionCalculationOutcomeId}
              icon={<ExclamationCircleOutlined />}
              title="需平台人工处理"
              metadata={`${item.reasonCode} · ${formatAuditTime(item.occurredAt)} · Order ${shortReference(item.rechargeOrderId)}`}
              amount={formatAmount(item.basisAmountMinor, item.currency)}
              status={<Tag color="gold">manual_review</Tag>}
            />
          ))}
        </div>
      </AuditSection>
    </div>
  );
}

function ChannelAuditReady({ data }: { data: ChannelAuditData }) {
  return (
    <div data-testid="pilot-channel-commission-audit-ready" className="d1-page-stack v3-ops-page">
      <section className="d1-surface">
        <div className="d1-section-heading">
          <div>
            <Typography.Title level={4}>{data.channel.displayName}</Typography.Title>
            <Typography.Text type="secondary">
              canonical Channel {shortReference(data.channel.channelId)} · active
            </Typography.Text>
          </div>
          <Tag color="cyan">CHANNEL SCOPE</Tag>
        </div>
      </section>
      <AuditSection
        title="Commission Calculations"
        description="仅显示当前 canonical Channel 的 TEST 计算结果。"
        count={data.calculations.length}
      >
        <CalculationRows items={data.calculations} />
      </AuditSection>
      <AuditSection
        title="Commission Accruals"
        description="只读显示当前 canonical Channel 的 TEST 应计事实。"
        count={data.accruals.length}
      >
        <AccrualRows items={data.accruals} />
      </AuditSection>
      <AuditSection
        title="Commission Reversals"
        description="只读显示当前 canonical Channel 的退款/拒付冲正。"
        count={data.reversals.length}
      >
        <ReversalRows items={data.reversals} />
      </AuditSection>
    </div>
  );
}

export function PilotPlatformCommissionAuditPage() {
  const [state, setState] = useState<PlatformAuditState>({ phase: 'loading' });
  const requestSequence = useRef(0);

  const load = useCallback(async (retrying: boolean) => {
    const sequence = ++requestSequence.current;
    setState({ phase: retrying ? 'retrying' : 'loading' });
    try {
      const [paymentEvents, calculations, accruals, reversals, manualReviews] = await Promise.all([
        pilotControlApi.listPlatformPaymentEvents(AUDIT_LIST_LIMIT),
        pilotControlApi.listPlatformCommissionCalculations(AUDIT_LIST_LIMIT),
        pilotControlApi.listPlatformCommissionAccruals(AUDIT_LIST_LIMIT),
        pilotControlApi.listPlatformCommissionReversals(AUDIT_LIST_LIMIT),
        pilotControlApi.listPlatformCommissionManualReviews(AUDIT_LIST_LIMIT),
      ]);
      if (sequence !== requestSequence.current) return;
      const data = { paymentEvents, calculations, accruals, reversals, manualReviews };
      setState({ phase: isPlatformEmpty(data) ? 'empty' : 'ready', data });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setState({ phase: 'error', error: classifyAuditError(error) });
    }
  }, []);

  useEffect(() => {
    void load(false);
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  const reload = () => void load(true);
  const contextLabel = 'PLATFORM SCOPE · bounded 50';

  return (
    <div className="d1-page-stack v3-ops-page">
      <AuditHeader
        title="平台佣金审计"
        description="真实 Session Cookie 下的 TEST Payment、Calculation、Accrual、Reversal 与 Manual Review 安全投影。"
        contextLabel={contextLabel}
        onReload={reload}
        canReload={state.phase === 'ready' || state.phase === 'empty'}
      />
      <CommercialAuditDisclaimer />
      {state.phase === 'loading' ? (
        <AuditLoading testId="pilot-platform-commission-audit-loading" retrying={false} />
      ) : null}
      {state.phase === 'retrying' ? (
        <AuditLoading testId="pilot-platform-commission-audit-retrying" retrying />
      ) : null}
      {state.phase === 'error' ? <AuditErrorPanel error={state.error} onRetry={reload} /> : null}
      {state.phase === 'empty' ? (
        <AuditEmpty
          testId="pilot-platform-commission-audit-empty"
          title="当前窗口暂无 TEST 商业审计记录"
          description="这是有效的真实空列表，不代表完整历史，也不会回退演示数据。"
        />
      ) : null}
      {state.phase === 'ready' ? <PlatformAuditReady data={state.data} /> : null}
    </div>
  );
}

export function PilotChannelCommissionAuditPage() {
  const [state, setState] = useState<ChannelAuditState>({ phase: 'loading' });
  const requestSequence = useRef(0);

  const load = useCallback(async (retrying: boolean) => {
    const sequence = ++requestSequence.current;
    setState({ phase: retrying ? 'retrying' : 'loading' });
    try {
      const channel = await pilotControlApi.readCurrentChannel();
      const [calculations, accruals, reversals] = await Promise.all([
        pilotControlApi.listChannelCommissionCalculations(channel.channelId, AUDIT_LIST_LIMIT),
        pilotControlApi.listChannelCommissionAccruals(channel.channelId, AUDIT_LIST_LIMIT),
        pilotControlApi.listChannelCommissionReversals(channel.channelId, AUDIT_LIST_LIMIT),
      ]);
      if (sequence !== requestSequence.current) return;
      const data = { channel, calculations, accruals, reversals };
      setState({ phase: isChannelEmpty(data) ? 'empty' : 'ready', data });
    } catch (error) {
      if (sequence !== requestSequence.current) return;
      setState({ phase: 'error', error: classifyAuditError(error) });
    }
  }, []);

  useEffect(() => {
    void load(false);
    return () => {
      requestSequence.current += 1;
    };
  }, [load]);

  const reload = () => void load(true);
  const channel = state.phase === 'ready' || state.phase === 'empty' ? state.data.channel : null;

  return (
    <div className="d1-page-stack v3-ops-page">
      <AuditHeader
        title="渠道佣金审计"
        description="先由服务端解析 canonical Channel，再读取该 Channel 的 TEST Calculation、Accrual 与 Reversal。"
        contextLabel="CHANNEL SCOPE · bounded 50"
        onReload={reload}
        canReload={state.phase === 'ready' || state.phase === 'empty'}
      />
      <CommercialAuditDisclaimer />
      {state.phase === 'loading' ? (
        <AuditLoading testId="pilot-channel-commission-audit-loading" retrying={false} />
      ) : null}
      {state.phase === 'retrying' ? (
        <AuditLoading testId="pilot-channel-commission-audit-retrying" retrying />
      ) : null}
      {state.phase === 'error' ? <AuditErrorPanel error={state.error} onRetry={reload} /> : null}
      {state.phase === 'empty' ? (
        <AuditEmpty
          testId="pilot-channel-commission-audit-empty"
          title={`${channel?.displayName ?? '当前渠道'}暂无 TEST 佣金审计记录`}
          description="canonical Channel 已解析成功；这是有效的真实空列表，不接受 URL 或手工 Channel ID。"
        />
      ) : null}
      {state.phase === 'ready' ? <ChannelAuditReady data={state.data} /> : null}
    </div>
  );
}
