import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCommissionSettlementResult,
  type PilotCommercialChannelReference,
} from '../../services/pilotControlApi';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import './v3-ops.css';

const ACTIVE_CHANNEL_LIMIT = 100;
const FIXED_CURRENCY = 'CNY';

type DirectoryErrorKind =
  'unauthorized' | 'forbidden' | 'not-found' | 'service-error' | 'invalid-response';

type SubmitErrorKind =
  'unauthorized' | 'forbidden' | 'not-found' | 'conflict' | 'service-error' | 'invalid-response';

interface SafeError<K extends string> {
  kind: K;
  requestId: string | null;
}

type DirectoryState =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' }
  | { phase: 'ready'; channels: PilotCommercialChannelReference[] }
  | { phase: 'error'; error: SafeError<DirectoryErrorKind> };

type SubmitState =
  | { phase: 'idle' | 'submitting' }
  | { phase: 'success'; result: PilotCommissionSettlementResult }
  | { phase: 'error'; error: SafeError<SubmitErrorKind> };

interface SettlementFacts {
  beneficiaryChannelId: string;
  period: string;
  cutoff: string;
}

function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

function clearUnauthorizedPilotSession(): void {
  usePilotProjectContextStore.getState().reset();
  usePilotAuthStore.setState({
    status: 'anonymous',
    session: null,
    error: null,
    requestId: null,
  });
}

function classifyDirectoryError(error: unknown): SafeError<DirectoryErrorKind> {
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

function classifySubmitError(error: unknown): SafeError<SubmitErrorKind> {
  if (!(error instanceof PilotControlApiError)) {
    return { kind: 'service-error', requestId: null };
  }
  if (error.status === 401) {
    clearUnauthorizedPilotSession();
    return { kind: 'unauthorized', requestId: error.requestId };
  }
  if (error.status === 403) return { kind: 'forbidden', requestId: error.requestId };
  if (error.status === 404) return { kind: 'not-found', requestId: error.requestId };
  if (error.status === 409) return { kind: 'conflict', requestId: error.requestId };
  if (error.code === 'INVALID_API_RESPONSE') {
    return { kind: 'invalid-response', requestId: error.requestId };
  }
  return { kind: 'service-error', requestId: error.requestId };
}

function formatAmount(amountMinor: number, currency: string): string {
  return `${(amountMinor / 100).toFixed(2)} ${currency}`;
}

function formatUtcTimestamp(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间不可用';
  return `${date.toISOString().replace('.000Z', 'Z')} (UTC)`;
}

function periodStartFromMonth(month: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  return `${month}-01`;
}

function periodEndTimestamp(month: string): number | null {
  const periodStart = periodStartFromMonth(month);
  if (!periodStart) return null;
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  return Date.UTC(year, monthIndex + 1, 1);
}

function cutoffToUtc(cutoff: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/.test(cutoff)) {
    return null;
  }
  const date = new Date(`${cutoff}:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const normalized = date.toISOString();
  if (normalized.slice(0, 16) !== cutoff) return null;
  return normalized;
}

function SettlementHeader() {
  return (
    <header className="d1-page-header">
      <div>
        <Space size={8} wrap>
          <Tag color="blue">PILOT</Tag>
          <Tag color="gold">TEST</Tag>
          <Tag color="orange">draft</Tag>
          <Tag>NON_QUOTE</Tag>
        </Space>
        <Typography.Title level={2}>Platform TEST Settlement Draft</Typography.Title>
        <Typography.Paragraph type="secondary">
          仅使用真实 Control API 与 active Channel Directory 创建一次 TEST
          草稿；结果只用于审计验证。
        </Typography.Paragraph>
      </div>
    </header>
  );
}

function SettlementBoundaryNotice() {
  return (
    <Alert
      type="warning"
      showIcon
      icon={<SafetyCertificateOutlined />}
      message="TEST · draft · NON_QUOTE"
      description="本操作不形成任何资金状态或支付承诺；不包含 LIVE、真实比例、KYC、税务或 review/approve。"
    />
  );
}

const DIRECTORY_ERROR_CONTENT: Record<
  DirectoryErrorKind,
  { title: string; description: string; testId: string; retryable: boolean }
> = {
  unauthorized: {
    title: 'Pilot Session 已失效',
    description: '会话已失效，请重新登录。未保留旧 Channel Directory。',
    testId: 'pilot-settlement-channel-unauthorized',
    retryable: false,
  },
  forbidden: {
    title: '无 Channel Directory 权限',
    description: '当前会话无权读取 active Channel Directory，系统不会猜测或切换 Organization。',
    testId: 'pilot-settlement-channel-forbidden',
    retryable: false,
  },
  'not-found': {
    title: 'Channel Directory 不可用',
    description: '真实目录资源不可用，页面不会从 Commission 记录反推 beneficiary。',
    testId: 'pilot-settlement-channel-not-found',
    retryable: false,
  },
  'service-error': {
    title: 'Channel Directory 服务暂不可用',
    description: '无法完成真实 Control API 读取；不会回退演示或本地数据。',
    testId: 'pilot-settlement-channel-service-error',
    retryable: true,
  },
  'invalid-response': {
    title: 'Channel Directory 响应无效',
    description: '服务返回了无法安全解析的数据，页面已 fail closed。',
    testId: 'pilot-settlement-channel-invalid-response',
    retryable: true,
  },
};

function DirectoryErrorPanel({
  error,
  onRetry,
}: {
  error: SafeError<DirectoryErrorKind>;
  onRetry: () => void;
}) {
  const content = DIRECTORY_ERROR_CONTENT[error.kind];
  return (
    <section className="d1-surface" data-testid={content.testId}>
      <Result
        status={error.kind === 'not-found' ? '404' : error.kind === 'service-error' ? '500' : '403'}
        title={content.title}
        subTitle={content.description}
        extra={
          content.retryable ? (
            <Button type="primary" icon={<ReloadOutlined />} onClick={onRetry}>
              重试真实 Channel Directory
            </Button>
          ) : undefined
        }
      >
        {error.requestId ? <Alert type="info" message={`请求 ID：${error.requestId}`} /> : null}
      </Result>
    </section>
  );
}

const SUBMIT_ERROR_CONTENT: Record<
  SubmitErrorKind,
  { title: string; description: string; testId: string; status: '403' | '404' | '500' | 'warning' }
> = {
  unauthorized: {
    title: 'Pilot Session 已失效',
    description: '会话已失效，请重新登录。当前提交结果已清除。',
    testId: 'pilot-settlement-submit-unauthorized',
    status: '403',
  },
  forbidden: {
    title: '无 TEST Settlement 权限',
    description: '当前会话无权创建该草稿，系统不会切换 Organization。',
    testId: 'pilot-settlement-submit-forbidden',
    status: '403',
  },
  'not-found': {
    title: 'beneficiary Channel 不可用',
    description: '所选 active Channel 已不可用，请重新加载真实目录。',
    testId: 'pilot-settlement-submit-not-found',
    status: '404',
  },
  conflict: {
    title: 'TEST Settlement 幂等冲突',
    description: '同一幂等键对应的业务事实不一致。系统不会自动更换 key 绕过冲突。',
    testId: 'pilot-settlement-submit-conflict',
    status: 'warning',
  },
  'service-error': {
    title: 'TEST Settlement 服务暂不可用',
    description: '本次真实提交未确认成功；可使用相同业务事实与相同幂等键重试。',
    testId: 'pilot-settlement-submit-service-error',
    status: '500',
  },
  'invalid-response': {
    title: 'TEST Settlement 响应无效',
    description: '服务返回了无法安全解析的数据，页面不会展示未经验证的 Draft。',
    testId: 'pilot-settlement-submit-invalid-response',
    status: '500',
  },
};

function SubmitErrorPanel({
  error,
  onRetry,
  retrying,
}: {
  error: SafeError<SubmitErrorKind>;
  onRetry: () => void;
  retrying: boolean;
}) {
  const content = SUBMIT_ERROR_CONTENT[error.kind];
  const canRetry =
    error.kind === 'conflict' ||
    error.kind === 'service-error' ||
    error.kind === 'invalid-response';
  return (
    <section className="d1-surface" data-testid={content.testId}>
      <Result
        status={content.status}
        title={content.title}
        subTitle={content.description}
        extra={
          canRetry ? (
            <Button type="primary" icon={<ReloadOutlined />} loading={retrying} onClick={onRetry}>
              重试相同 TEST 事实
            </Button>
          ) : undefined
        }
      >
        {error.requestId ? <Alert type="info" message={`请求 ID：${error.requestId}`} /> : null}
      </Result>
    </section>
  );
}

function CurrentDraft({
  result,
  channel,
}: {
  result: PilotCommissionSettlementResult;
  channel: PilotCommercialChannelReference | undefined;
}) {
  const draft = result.settlement;
  return (
    <section className="d1-surface" data-testid="pilot-settlement-current-draft">
      <div className="d1-section-heading">
        <div>
          <Space size={8} wrap>
            <CheckCircleOutlined style={{ color: '#1677ff' }} />
            <Tag color="gold">TEST</Tag>
            <Tag color="orange">draft</Tag>
            <Tag>NON_QUOTE</Tag>
            {result.replayed ? <Tag color="blue">IDEMPOTENCY REPLAY</Tag> : null}
          </Space>
          <Typography.Title level={3}>当前 API 返回的 Draft</Typography.Title>
          <Typography.Paragraph type="secondary">
            只展示本次严格解析的服务响应；刷新页面后不会把本地结果冒充为服务端记录。
          </Typography.Paragraph>
        </div>
      </div>

      <div className="v3-ops-timeline">
        <div className="v3-ops-timeline-item">
          <Typography.Text>beneficiary Channel</Typography.Text>
          <strong>{channel?.displayName ?? '当前 Directory 未匹配'}</strong>
        </div>
        <div className="v3-ops-timeline-item">
          <Typography.Text>净额</Typography.Text>
          <strong>{formatAmount(draft.netAmountMinor, draft.currency)}</strong>
        </div>
        <div className="v3-ops-timeline-item">
          <Typography.Text>毛计提 / 冲正</Typography.Text>
          <span>
            {formatAmount(draft.grossAccrualAmountMinor, draft.currency)} /{' '}
            {formatAmount(draft.grossReversalAmountMinor, draft.currency)}
          </span>
        </div>
        <div className="v3-ops-timeline-item">
          <Typography.Text>条目</Typography.Text>
          <span>
            {draft.itemCount}（计提 {draft.accrualItemCount} / 冲正 {draft.reversalItemCount}）
          </span>
        </div>
        <div className="v3-ops-timeline-item">
          <Typography.Text>UTC 周期</Typography.Text>
          <span>
            {formatUtcTimestamp(draft.periodStart)} — {formatUtcTimestamp(draft.periodEnd)}
          </span>
        </div>
        <div className="v3-ops-timeline-item">
          <Typography.Text>UTC cutoff</Typography.Text>
          <span>{formatUtcTimestamp(draft.cutoffAt)}</span>
        </div>
      </div>
      <Space direction="vertical" size={10} style={{ width: '100%' }}>
        {draft.itemCount === 0 ? (
          <Alert
            type="success"
            showIcon
            message="零候选是有效审计结果，不是创建失败"
            description="服务已创建零额 TEST draft；页面不会虚构候选、金额或业务进度。"
          />
        ) : null}
        <Alert
          type="warning"
          showIcon
          message="TEST · draft · NON_QUOTE"
          description="非到账、非提现、非 paid、非自动打款。"
        />
      </Space>
    </section>
  );
}

export function PilotPlatformSettlementDraftPage() {
  const [directoryState, setDirectoryState] = useState<DirectoryState>({ phase: 'loading' });
  const [facts, setFacts] = useState<SettlementFacts>({
    beneficiaryChannelId: '',
    period: '',
    cutoff: '',
  });
  const [submitState, setSubmitState] = useState<SubmitState>({ phase: 'idle' });
  const [validationError, setValidationError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef(createIdempotencyKey());

  const loadDirectory = useCallback(async (retrying = false) => {
    setDirectoryState({ phase: retrying ? 'retrying' : 'loading' });
    setSubmitState({ phase: 'idle' });
    setValidationError(null);
    try {
      const channels = await pilotControlApi.listActiveChannels(ACTIVE_CHANNEL_LIMIT);
      if (channels.length === 0) {
        setFacts({ beneficiaryChannelId: '', period: '', cutoff: '' });
        setDirectoryState({ phase: 'empty' });
        return;
      }
      setFacts((current) => ({
        ...current,
        beneficiaryChannelId: channels.some(
          (channel) => channel.channelId === current.beneficiaryChannelId,
        )
          ? current.beneficiaryChannelId
          : '',
      }));
      setDirectoryState({ phase: 'ready', channels });
    } catch (error) {
      setFacts({ beneficiaryChannelId: '', period: '', cutoff: '' });
      setDirectoryState({ phase: 'error', error: classifyDirectoryError(error) });
    }
  }, []);

  useEffect(() => {
    void loadDirectory();
  }, [loadDirectory]);

  const updateFact = useCallback((field: keyof SettlementFacts, value: string) => {
    setFacts((current) => ({ ...current, [field]: value }));
    idempotencyKeyRef.current = createIdempotencyKey();
    setSubmitState({ phase: 'idle' });
    setValidationError(null);
  }, []);

  const submit = useCallback(async () => {
    if (directoryState.phase !== 'ready') return;
    const selectedChannel = directoryState.channels.find(
      (channel) => channel.channelId === facts.beneficiaryChannelId,
    );
    const periodStart = periodStartFromMonth(facts.period);
    const periodEnd = periodEndTimestamp(facts.period);
    const cutoffAt = cutoffToUtc(facts.cutoff);

    if (!selectedChannel) {
      setValidationError('请选择真实 active Channel Directory 中的 beneficiary。');
      return;
    }
    if (!periodStart || periodEnd === null) {
      setValidationError('请选择有效的 UTC 结算自然月。');
      return;
    }
    if (!cutoffAt) {
      setValidationError('请选择有效的 UTC 截止时间。');
      return;
    }
    if (Date.parse(cutoffAt) < periodEnd) {
      setValidationError('cutoffAt 不得早于该 UTC 自然月结束时间。');
      return;
    }

    setValidationError(null);
    setSubmitState({ phase: 'submitting' });
    try {
      const result = await pilotControlApi.createTestCommissionSettlement({
        paymentMode: 'TEST',
        beneficiaryChannelId: selectedChannel.channelId,
        currency: FIXED_CURRENCY,
        periodStart,
        cutoffAt,
        idempotencyKey: idempotencyKeyRef.current,
      });
      setSubmitState({ phase: 'success', result });
    } catch (error) {
      setSubmitState({ phase: 'error', error: classifySubmitError(error) });
    }
  }, [directoryState, facts]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submit();
  };

  const readyChannels = directoryState.phase === 'ready' ? directoryState.channels : [];
  const selectedChannel =
    submitState.phase === 'success'
      ? readyChannels.find(
          (channel) => channel.channelId === submitState.result.settlement.beneficiaryChannelId,
        )
      : undefined;

  return (
    <div className="d1-page-stack v3-ops-page">
      <SettlementHeader />
      <SettlementBoundaryNotice />

      {directoryState.phase === 'loading' || directoryState.phase === 'retrying' ? (
        <section className="d1-surface" data-testid="pilot-settlement-channel-loading">
          <Space
            direction="vertical"
            align="center"
            size={12}
            style={{ width: '100%', padding: 32 }}
          >
            <Spin size="large" />
            <Typography.Text strong>
              {directoryState.phase === 'retrying'
                ? '正在重新加载真实 active Channel Directory…'
                : '正在加载真实 active Channel Directory…'}
            </Typography.Text>
            <Typography.Text type="secondary">
              页面不会从 Commission 记录反推 Channel，也不会读取演示或本地数据。
            </Typography.Text>
          </Space>
        </section>
      ) : null}

      {directoryState.phase === 'empty' ? (
        <section className="d1-surface" data-testid="pilot-settlement-channel-empty">
          <Empty description={null}>
            <Typography.Title level={4}>当前没有可用的 active Channel</Typography.Title>
            <Typography.Paragraph type="secondary">
              无安全 beneficiary 候选，不能创建 TEST draft；请先由后端目录提供 canonical Channel。
            </Typography.Paragraph>
            <Space size={8} wrap>
              <Tag color="gold">TEST</Tag>
              <Tag color="orange">draft</Tag>
              <Tag>NON_QUOTE</Tag>
            </Space>
          </Empty>
        </section>
      ) : null}

      {directoryState.phase === 'error' ? (
        <DirectoryErrorPanel
          error={directoryState.error}
          onRetry={() => void loadDirectory(true)}
        />
      ) : null}

      {directoryState.phase === 'ready' ? (
        <section className="d1-surface" data-testid="pilot-settlement-draft-form">
          <div className="d1-section-heading">
            <div>
              <Space size={8} wrap>
                <ExclamationCircleOutlined style={{ color: '#d48806' }} />
                <Tag color="gold">TEST</Tag>
                <Tag color="orange">draft</Tag>
                <Tag>NON_QUOTE</Tag>
              </Space>
              <Typography.Title level={3}>确认 TEST Settlement 业务事实</Typography.Title>
              <Typography.Paragraph type="secondary">
                beneficiary 只能从本次真实 active Directory 选择；币种固定为 CNY，时间按 UTC 解释。
              </Typography.Paragraph>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <Space direction="vertical" size={18} style={{ width: '100%' }}>
              <label>
                <Typography.Text strong>Active beneficiary Channel</Typography.Text>
                <select
                  aria-label="Active beneficiary Channel"
                  value={facts.beneficiaryChannelId}
                  onChange={(event) => updateFact('beneficiaryChannelId', event.target.value)}
                  disabled={submitState.phase === 'submitting'}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: 40,
                    marginTop: 8,
                    padding: '8px 11px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                    background: '#fff',
                  }}
                >
                  <option value="">请选择 active Channel</option>
                  {directoryState.channels.map((channel) => (
                    <option key={channel.channelId} value={channel.channelId}>
                      {channel.displayName}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <Typography.Text strong>UTC 结算自然月</Typography.Text>
                <input
                  type="month"
                  aria-label="UTC 结算自然月"
                  value={facts.period}
                  onChange={(event) => updateFact('period', event.target.value)}
                  disabled={submitState.phase === 'submitting'}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: 40,
                    marginTop: 8,
                    padding: '8px 11px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                  }}
                />
              </label>

              <label>
                <Typography.Text strong>UTC 截止时间</Typography.Text>
                <input
                  type="datetime-local"
                  aria-label="UTC 截止时间"
                  value={facts.cutoff}
                  onChange={(event) => updateFact('cutoff', event.target.value)}
                  disabled={submitState.phase === 'submitting'}
                  style={{
                    display: 'block',
                    width: '100%',
                    minHeight: 40,
                    marginTop: 8,
                    padding: '8px 11px',
                    border: '1px solid #d9d9d9',
                    borderRadius: 6,
                  }}
                />
              </label>

              <Typography.Text>
                结算币种：<strong>{FIXED_CURRENCY}</strong>（固定，不接受任意输入）
              </Typography.Text>

              {validationError ? (
                <Alert
                  type="error"
                  showIcon
                  data-testid="pilot-settlement-validation-error"
                  message={validationError}
                />
              ) : null}

              <Alert
                type="warning"
                showIcon
                message="提交确认：TEST · draft · NON_QUOTE"
                description="创建结果不是到账、提现、paid 或自动打款凭证。"
              />

              <Button htmlType="submit" type="primary" loading={submitState.phase === 'submitting'}>
                创建 TEST draft
              </Button>
            </Space>
          </form>
        </section>
      ) : null}

      {submitState.phase === 'error' ? (
        <SubmitErrorPanel
          error={submitState.error}
          retrying={false}
          onRetry={() => void submit()}
        />
      ) : null}

      {submitState.phase === 'success' ? (
        <CurrentDraft result={submitState.result} channel={selectedChannel} />
      ) : null}
    </div>
  );
}
