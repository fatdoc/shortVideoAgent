import {
  CheckCircleOutlined,
  KeyOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCommercialChannelReference,
  type PilotInvitationManagement,
  type PilotInvitationStatusFilter,
  type PilotSession,
} from '../../services/pilotControlApi';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import './v3-ops.css';

const DIRECTORY_LIMIT = 100;

type InvitationScope = 'PLATFORM' | 'CHANNEL' | 'TENANT';
type ErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation-error'
  | 'service-error'
  | 'invalid-response';

interface SafeError {
  kind: ErrorKind;
  requestId: string | null;
}

interface ScopeContext {
  channel: PilotCommercialChannelReference | null;
  tenantId: string | null;
  activeChannels: PilotCommercialChannelReference[];
}

type DirectoryState =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty'; context: ScopeContext }
  | { phase: 'ready'; context: ScopeContext; invitations: PilotInvitationManagement[] }
  | { phase: 'error'; error: SafeError };

type MutationState =
  | { phase: 'idle' }
  | { phase: 'submitting'; action: 'create' | 'revoke' }
  | { phase: 'success'; message: string; replayed: boolean }
  | { phase: 'error'; error: SafeError };

interface AccessDecision {
  allowed: boolean;
  tenantId: string | null;
  deniedMessage: string;
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

function classifyError(error: unknown): SafeError {
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
  if (error.status === 422 || error.code.startsWith('INVALID_')) {
    if (error.code === 'INVALID_API_RESPONSE') {
      return { kind: 'invalid-response', requestId: error.requestId };
    }
    return { kind: 'validation-error', requestId: error.requestId };
  }
  if (error.code === 'INVALID_API_RESPONSE') {
    return { kind: 'invalid-response', requestId: error.requestId };
  }
  return { kind: 'service-error', requestId: error.requestId };
}

function accessFor(scope: InvitationScope, session: PilotSession | null): AccessDecision {
  if (!session || session.activeContext.organizationType !== scope) {
    return {
      allowed: false,
      tenantId: null,
      deniedMessage: `当前 Session 不是 ${scope} Organization Scope。`,
    };
  }
  const role =
    scope === 'PLATFORM'
      ? 'platform_admin'
      : scope === 'CHANNEL'
        ? 'channel_admin'
        : 'tenant_admin';
  if (!session.roles.includes(role) || !session.activeContext.roles.includes(role)) {
    return {
      allowed: false,
      tenantId: null,
      deniedMessage: `仅 ${role} 可管理当前 Organization 的邀请。`,
    };
  }
  if (scope === 'TENANT') {
    const tenantId = session.activeContext.tenantId;
    if (!tenantId || session.tenant?.id !== tenantId) {
      return {
        allowed: false,
        tenantId: null,
        deniedMessage: '当前 Session 缺少一致的 canonical tenantId。',
      };
    }
    return { allowed: true, tenantId, deniedMessage: '' };
  }
  return { allowed: true, tenantId: null, deniedMessage: '' };
}

function formatTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间不可用';
  return `${date.toISOString().replace('.000Z', 'Z')} (UTC)`;
}

function shortReference(value: string): string {
  return `${value.slice(0, 8)}…${value.slice(-4)}`;
}

const ERROR_CONTENT: Record<
  ErrorKind,
  { title: string; description: string; status: '403' | '404' | '500'; retryable: boolean }
> = {
  unauthorized: {
    status: '403',
    title: 'Pilot Session 已失效',
    description: '会话已失效，请重新登录。旧邀请目录与一次性 Token 已清除。',
    retryable: false,
  },
  forbidden: {
    status: '403',
    title: '无邀请管理权限',
    description: '当前会话无权管理该 Organization 的邀请；不会切换 Scope。',
    retryable: false,
  },
  'not-found': {
    status: '404',
    title: '邀请范围不可用',
    description: 'canonical Organization 或邀请资源不可用，未披露其他 Scope 信息。',
    retryable: false,
  },
  conflict: {
    status: '500',
    title: '邀请操作发生冲突',
    description: '服务端状态或幂等业务事实冲突，请重新读取目录后核对。',
    retryable: true,
  },
  'validation-error': {
    status: '500',
    title: '邀请输入未被接受',
    description: '请核对安全输入；页面不会显示服务端原始错误正文。',
    retryable: false,
  },
  'service-error': {
    status: '500',
    title: '邀请服务暂不可用',
    description: '无法完成真实 Control API 操作；不会回退 Demo、Mock 或本地数据。',
    retryable: true,
  },
  'invalid-response': {
    status: '500',
    title: '邀请响应无法安全解析',
    description: '服务端返回了无效投影，页面已 fail closed。',
    retryable: true,
  },
};

function ErrorPanel({ error, onRetry }: { error: SafeError; onRetry: () => void }) {
  const content = ERROR_CONTENT[error.kind];
  return (
    <section className="d1-surface" data-testid={`pilot-invitations-${error.kind}`}>
      <Result
        status={content.status}
        title={content.title}
        subTitle={content.description}
        extra={
          content.retryable ? (
            <Button aria-label="重试真实邀请目录" icon={<ReloadOutlined />} onClick={onRetry}>
              重试真实邀请目录
            </Button>
          ) : undefined
        }
      >
        {error.requestId ? <Alert type="info" message={`请求 ID：${error.requestId}`} /> : null}
      </Result>
    </section>
  );
}

function MutationNotice({ state }: { state: MutationState }) {
  if (state.phase === 'idle' || state.phase === 'submitting') return null;
  if (state.phase === 'success') {
    return (
      <Alert
        data-testid="pilot-invitation-mutation-success"
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message={state.message}
        description={
          state.replayed ? '服务端确认这是幂等重放；真实目录已刷新。' : '真实目录已刷新。'
        }
      />
    );
  }
  const content = ERROR_CONTENT[state.error.kind];
  return (
    <Alert
      data-testid={`pilot-invitation-mutation-${state.error.kind}`}
      type="error"
      showIcon
      message={content.title}
      description={
        <Space direction="vertical" size={4}>
          <span>{content.description}</span>
          {state.error.requestId ? <span>{`请求 ID：${state.error.requestId}`}</span> : null}
        </Space>
      }
    />
  );
}

function statusColor(status: PilotInvitationManagement['status']): string {
  if (status === 'active') return 'green';
  if (status === 'revoked') return 'red';
  if (status === 'exhausted') return 'orange';
  return 'default';
}

function InvitationDirectory({
  invitations,
  submitting,
  onRevoke,
}: {
  invitations: PilotInvitationManagement[];
  submitting: boolean;
  onRevoke: (invitation: PilotInvitationManagement) => void;
}) {
  return (
    <section className="d1-surface" data-testid="pilot-invitations-ready">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={4}>Invitation Directory</Typography.Title>
          <Typography.Text type="secondary">
            bounded {invitations.length} 条；Token 不从历史目录恢复。
          </Typography.Text>
        </div>
        <Tag>{invitations.length} 条</Tag>
      </div>
      <div className="d1-receipt-list">
        {invitations.map((record) => (
          <div className="d1-receipt-row" key={record.invitationId}>
            <span className="d1-receipt-icon is-asset">
              <KeyOutlined />
            </span>
            <div>
              <Space wrap size={6}>
                <Typography.Text strong>
                  {record.targetEmail ??
                    (record.invitationType === 'CHANNEL'
                      ? 'Channel reusable invitation'
                      : '未指定邮箱')}
                </Typography.Text>
                <Tag color={statusColor(record.status)}>{record.status}</Tag>
                <Tag>{record.invitationType}</Tag>
              </Space>
              <Typography.Text type="secondary">
                邀请引用 {shortReference(record.invitationId)} · 使用 {record.usedCount}/
                {record.maxUses} · 剩余 {record.remainingUses} · 有效期{' '}
                {formatTime(record.validFrom)} — {formatTime(record.expiresAt)}
              </Typography.Text>
            </div>
            <Typography.Text type="secondary">{record.remainingUses} remaining</Typography.Text>
            {record.status === 'active' ? (
              <Button
                aria-label="撤销邀请"
                danger
                icon={<StopOutlined />}
                disabled={submitting}
                onClick={() => onRevoke(record)}
              >
                撤销
              </Button>
            ) : (
              <Tag>只读</Tag>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function InvitationOperationsPage({ scope }: { scope: InvitationScope }) {
  const initialSession = usePilotAuthStore.getState().session;
  const [access] = useState(() => accessFor(scope, initialSession));
  const currentAuthStatus = usePilotAuthStore((state) => state.status);
  const [filter, setFilter] = useState<PilotInvitationStatusFilter>('all');
  const [directory, setDirectory] = useState<DirectoryState>({ phase: 'loading' });
  const [mutation, setMutation] = useState<MutationState>({ phase: 'idle' });
  const [targetEmail, setTargetEmail] = useState('');
  const [attributionChannelId, setAttributionChannelId] = useState('');
  const [oneTimeToken, setOneTimeToken] = useState<string | null>(null);
  const [replayedWithoutToken, setReplayedWithoutToken] = useState(false);
  const idempotencyRef = useRef<{ signature: string; key: string } | null>(null);

  const clearEphemeralToken = () => {
    setOneTimeToken(null);
    setReplayedWithoutToken(false);
  };

  const loadDirectory = useCallback(
    async (status: PilotInvitationStatusFilter, retrying: boolean, clearToken: boolean) => {
      if (!access.allowed) return;
      if (clearToken) clearEphemeralToken();
      setDirectory({ phase: retrying ? 'retrying' : 'loading' });
      try {
        let context: ScopeContext;
        let invitations: PilotInvitationManagement[];
        if (scope === 'PLATFORM') {
          const [channels, records] = await Promise.all([
            pilotControlApi.listActiveChannels(DIRECTORY_LIMIT),
            pilotControlApi.listPlatformInvitations(status, DIRECTORY_LIMIT),
          ]);
          context = { channel: null, tenantId: null, activeChannels: channels };
          invitations = records;
        } else if (scope === 'CHANNEL') {
          const channel = await pilotControlApi.readCurrentChannel();
          invitations = await pilotControlApi.listChannelInvitations(
            channel.channelId,
            status,
            DIRECTORY_LIMIT,
          );
          context = { channel, tenantId: null, activeChannels: [] };
        } else {
          const tenantId = access.tenantId;
          if (!tenantId) throw new Error('missing canonical tenantId');
          invitations = await pilotControlApi.listTenantInvitations(
            tenantId,
            status,
            DIRECTORY_LIMIT,
          );
          context = { channel: null, tenantId, activeChannels: [] };
        }
        setDirectory(
          invitations.length === 0
            ? { phase: 'empty', context }
            : { phase: 'ready', context, invitations },
        );
      } catch (error) {
        clearEphemeralToken();
        setDirectory({ phase: 'error', error: classifyError(error) });
      }
    },
    [access.allowed, access.tenantId, scope],
  );

  useEffect(() => {
    if (access.allowed) void loadDirectory('all', false, false);
  }, [access.allowed, loadDirectory]);

  const context =
    directory.phase === 'empty' || directory.phase === 'ready' ? directory.context : null;
  const submitting = mutation.phase === 'submitting';

  const safeMutationFailure = (error: unknown) => {
    const safeError = classifyError(error);
    if (safeError.kind === 'unauthorized') {
      clearEphemeralToken();
      setDirectory({ phase: 'error', error: safeError });
    }
    setMutation({ phase: 'error', error: safeError });
  };

  const currentIdempotencyKey = (signature: string): string => {
    if (idempotencyRef.current?.signature === signature) return idempotencyRef.current.key;
    const value = { signature, key: globalThis.crypto.randomUUID() };
    idempotencyRef.current = value;
    return value.key;
  };

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!context) return;
    clearEphemeralToken();
    setMutation({ phase: 'submitting', action: 'create' });
    const email = targetEmail.trim().toLowerCase();
    const signature = JSON.stringify({
      scope,
      email,
      attributionChannelId,
      context: context.channel?.channelId ?? context.tenantId,
    });
    const idempotencyKey = currentIdempotencyKey(signature);
    void (async () => {
      try {
        const result =
          scope === 'PLATFORM'
            ? await pilotControlApi.createPlatformInvitation({
                targetEmail: email,
                attributionChannelId: attributionChannelId || null,
                idempotencyKey,
              })
            : scope === 'CHANNEL' && context.channel
              ? await pilotControlApi.createChannelInvitation(context.channel.channelId, {
                  idempotencyKey,
                })
              : await pilotControlApi.createTenantInvitation(context.tenantId ?? '', {
                  targetEmail: email,
                  idempotencyKey,
                });
        idempotencyRef.current = null;
        await loadDirectory(filter, false, false);
        if (result.replayed) {
          setReplayedWithoutToken(true);
          setMutation({
            phase: 'success',
            message: '邀请创建已确认（幂等重放）。',
            replayed: true,
          });
        } else {
          setOneTimeToken(result.token);
          setMutation({ phase: 'success', message: '邀请已创建。', replayed: false });
        }
      } catch (error) {
        safeMutationFailure(error);
      }
    })();
  };

  const revoke = (record: PilotInvitationManagement) => {
    if (
      record.status !== 'active' ||
      !window.confirm('确认撤销该邀请？撤销后历史 Token 不可恢复。')
    ) {
      return;
    }
    clearEphemeralToken();
    setMutation({ phase: 'submitting', action: 'revoke' });
    void (async () => {
      try {
        const result = await pilotControlApi.revokeInvitation(record.invitationId);
        await loadDirectory(filter, false, false);
        setMutation({
          phase: 'success',
          message: result.replayed ? '邀请撤销已确认（幂等重放）。' : '邀请已撤销。',
          replayed: result.replayed,
        });
      } catch (error) {
        safeMutationFailure(error);
      }
    })();
  };

  if (!access.allowed) {
    return (
      <section className="d1-surface v3-ops-page" data-testid="pilot-invitations-permission-denied">
        <Result status="403" title="无邀请管理权限" subTitle={access.deniedMessage} />
      </section>
    );
  }

  if (currentAuthStatus !== 'authenticated') {
    const error =
      directory.phase === 'error' && directory.error.kind === 'unauthorized'
        ? directory.error
        : { kind: 'unauthorized' as const, requestId: null };
    return (
      <div className="v3-ops-page">
        <ErrorPanel error={error} onRetry={() => undefined} />
      </div>
    );
  }

  return (
    <Space className="v3-ops-page" direction="vertical" size={20} style={{ width: '100%' }}>
      <header className="d1-page-header">
        <div>
          <Space wrap>
            <Tag color="blue">PILOT</Tag>
            <Tag color="purple">{scope}</Tag>
            <Tag>bounded 100</Tag>
          </Space>
          <Typography.Title level={2}>{scope} Invitation Operations</Typography.Title>
          <Typography.Paragraph type="secondary">
            仅使用真实 Session Scope 与 Control API；历史 Invitation Token 不可读取或恢复。
          </Typography.Paragraph>
        </div>
        <Button
          aria-label="重新加载真实邀请目录"
          icon={<ReloadOutlined />}
          disabled={submitting}
          onClick={() => void loadDirectory(filter, true, true)}
        >
          重新加载真实邀请目录
        </Button>
      </header>

      <Alert
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="Token 安全边界"
        description="首次创建 Token 仅在当前内存区域显示；离开、刷新、再次创建、撤销或目录错误即清除。不写 URL、Storage、日志或历史目录。"
      />
      {context?.channel ? (
        <Alert
          type="info"
          message={
            <span>
              canonical Channel：<strong>{context.channel.displayName}</strong>
            </span>
          }
        />
      ) : null}
      <MutationNotice state={mutation} />
      {oneTimeToken ? (
        <Alert
          data-testid="pilot-invitation-one-time-token"
          type="success"
          showIcon
          icon={<KeyOutlined />}
          message="Invitation Token · 仅本次可见"
          description={<code>{oneTimeToken}</code>}
        />
      ) : null}
      {replayedWithoutToken ? (
        <Alert
          data-testid="pilot-invitation-replayed"
          type="info"
          message="幂等重放不恢复历史 Token"
        />
      ) : null}

      <section className="d1-surface">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <label>
            <Typography.Text>Invitation status filter</Typography.Text>
            <select
              aria-label="Invitation status filter"
              value={filter}
              disabled={submitting}
              onChange={(event) => {
                const next = event.target.value as PilotInvitationStatusFilter;
                setFilter(next);
                setMutation({ phase: 'idle' });
                void loadDirectory(next, false, true);
              }}
            >
              {['all', 'active', 'revoked', 'exhausted', 'expired'].map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          {context ? (
            <form onSubmit={submitCreate}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {scope !== 'CHANNEL' ? (
                  <label>
                    <Typography.Text>Target email</Typography.Text>
                    <input
                      aria-label="Target email"
                      type="email"
                      required
                      value={targetEmail}
                      disabled={submitting}
                      onChange={(event) => {
                        setTargetEmail(event.target.value);
                        idempotencyRef.current = null;
                      }}
                    />
                  </label>
                ) : null}
                {scope === 'PLATFORM' ? (
                  <label>
                    <Typography.Text>Attribution Channel</Typography.Text>
                    <select
                      aria-label="Attribution Channel"
                      value={attributionChannelId}
                      disabled={submitting}
                      onChange={(event) => {
                        setAttributionChannelId(event.target.value);
                        idempotencyRef.current = null;
                      }}
                    >
                      <option value="">不指定 attribution Channel</option>
                      {context.activeChannels.map((channel) => (
                        <option key={channel.channelId} value={channel.channelId}>
                          {channel.displayName}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
                <Button
                  aria-label="创建邀请"
                  htmlType="submit"
                  type="primary"
                  icon={<PlusOutlined />}
                  loading={mutation.phase === 'submitting' && mutation.action === 'create'}
                >
                  创建邀请
                </Button>
              </Space>
            </form>
          ) : null}
        </Space>
      </section>

      {directory.phase === 'loading' || directory.phase === 'retrying' ? (
        <section
          className="d1-surface"
          data-testid={
            directory.phase === 'loading'
              ? 'pilot-invitations-loading'
              : 'pilot-invitations-retrying'
          }
        >
          <Space direction="vertical" align="center" style={{ width: '100%', padding: 32 }}>
            <Spin size="large" />
            <Typography.Text strong>正在读取真实邀请目录…</Typography.Text>
            <Typography.Text type="secondary">旧目录与一次性 Token 已清空。</Typography.Text>
          </Space>
        </section>
      ) : null}
      {directory.phase === 'empty' ? (
        <section className="d1-surface" data-testid="pilot-invitations-empty">
          <Empty description="当前 bounded directory 没有邀请" />
        </section>
      ) : null}
      {directory.phase === 'ready' ? (
        <InvitationDirectory
          invitations={directory.invitations}
          submitting={submitting}
          onRevoke={revoke}
        />
      ) : null}
      {directory.phase === 'error' ? (
        <ErrorPanel
          error={directory.error}
          onRetry={() => void loadDirectory(filter, true, true)}
        />
      ) : null}
    </Space>
  );
}

export function PilotPlatformInvitationsPage() {
  return <InvitationOperationsPage scope="PLATFORM" />;
}

export function PilotChannelInvitationsPage() {
  return <InvitationOperationsPage scope="CHANNEL" />;
}

export function PilotTenantInvitationsPage() {
  return <InvitationOperationsPage scope="TENANT" />;
}
