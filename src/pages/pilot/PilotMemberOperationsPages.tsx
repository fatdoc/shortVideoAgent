import { ReloadOutlined, SafetyCertificateOutlined, StopOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState } from 'react';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCurrentOrganizationMember,
  type PilotMemberStatusFilter,
  type PilotOrganizationType,
  type PilotSession,
} from '../../services/pilotControlApi';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';

const LIMIT = 100;
type ErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'last-admin'
  | 'stale'
  | 'inactive'
  | 'service-error'
  | 'invalid-response';
interface SafeError {
  kind: ErrorKind;
  requestId: string | null;
}
type Directory =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' }
  | { phase: 'ready'; members: PilotCurrentOrganizationMember[] }
  | { phase: 'error'; error: SafeError };
type Mutation =
  | { phase: 'idle' | 'submitting' }
  | { phase: 'success'; replayed: boolean }
  | { phase: 'error'; error: SafeError };

function clearSession() {
  usePilotProjectContextStore.getState().reset();
  usePilotAuthStore.setState({ status: 'anonymous', session: null, error: null, requestId: null });
}
function classify(error: unknown): SafeError {
  if (!(error instanceof PilotControlApiError)) return { kind: 'service-error', requestId: null };
  if (error.status === 401) {
    clearSession();
    return { kind: 'unauthorized', requestId: error.requestId };
  }
  if (error.code === 'MEMBER_LAST_ADMIN') return { kind: 'last-admin', requestId: error.requestId };
  if (error.code.includes('VERSION') || error.code.includes('STALE'))
    return { kind: 'stale', requestId: error.requestId };
  if (error.code.includes('NOT_ACTIVE') || error.code.includes('INACTIVE'))
    return { kind: 'inactive', requestId: error.requestId };
  if (error.status === 403) return { kind: 'forbidden', requestId: error.requestId };
  if (error.status === 404) return { kind: 'not-found', requestId: error.requestId };
  if (error.code === 'INVALID_API_RESPONSE')
    return { kind: 'invalid-response', requestId: error.requestId };
  return { kind: 'service-error', requestId: error.requestId };
}
const content: Record<ErrorKind, { title: string; detail: string }> = {
  unauthorized: {
    title: 'Pilot Session 已失效',
    detail: '会话已失效，请重新登录。旧成员目录已清除。',
  },
  forbidden: { title: '无成员管理权限', detail: '当前会话无权管理该 Organization。' },
  'not-found': { title: '成员资源不可用', detail: '成员或当前 Organization 不存在或不可见。' },
  'last-admin': {
    title: '不能停用最后一名管理员',
    detail: '为避免 Organization 失去管理员，操作已拒绝。',
  },
  stale: { title: '成员版本已变化', detail: 'expectedVersion 已过期，请重新读取真实目录后重试。' },
  inactive: {
    title: '成员已不是 active',
    detail: '不会对 inactive、suspended 或 expired 成员重复执行停用。',
  },
  'service-error': {
    title: '成员服务暂不可用',
    detail: '无法完成真实 Control API 操作，不会回退 Demo 或 Mock。',
  },
  'invalid-response': {
    title: '成员响应无法安全解析',
    detail: '服务端投影无效，页面已 fail closed。',
  },
};
function ErrorPanel({ error, retry }: { error: SafeError; retry: () => void }) {
  const c = content[error.kind];
  const canRetry =
    error.kind === 'service-error' || error.kind === 'invalid-response' || error.kind === 'stale';
  return (
    <section className="d1-surface" data-testid={`pilot-members-${error.kind}`}>
      <Result
        status={error.kind === 'not-found' ? '404' : error.kind === 'service-error' ? '500' : '403'}
        title={c.title}
        subTitle={c.detail}
        extra={
          canRetry ? (
            <Button aria-label="重试真实成员目录" icon={<ReloadOutlined />} onClick={retry}>
              重试真实成员目录
            </Button>
          ) : undefined
        }
      >
        {error.requestId ? <Alert type="info" message={`请求 ID：${error.requestId}`} /> : null}
      </Result>
    </section>
  );
}
function allowed(
  type: PilotOrganizationType,
  session: PilotSession | null,
): { ok: boolean; message: string } {
  const role =
    type === 'PLATFORM' ? 'platform_admin' : type === 'CHANNEL' ? 'channel_admin' : 'tenant_admin';
  const ok =
    session?.activeContext.organizationType === type &&
    session.roles.includes(role) &&
    session.activeContext.roles.includes(role) &&
    (type !== 'TENANT' ||
      (!!session.activeContext.tenantId && session.tenant?.id === session.activeContext.tenantId));
  return { ok: !!ok, message: `仅 ${role} 可管理当前 ${type} Organization 成员。` };
}
function Page({ type }: { type: PilotOrganizationType }) {
  const [access] = useState(() => allowed(type, usePilotAuthStore.getState().session));
  const auth = usePilotAuthStore((s) => s.status);
  const [filter, setFilter] = useState<PilotMemberStatusFilter>('all');
  const [directory, setDirectory] = useState<Directory>({ phase: 'loading' });
  const [mutation, setMutation] = useState<Mutation>({ phase: 'idle' });
  const load = useCallback(
    async (status: PilotMemberStatusFilter, retrying: boolean) => {
      if (!access.ok) return;
      setDirectory({ phase: retrying ? 'retrying' : 'loading' });
      try {
        const members = await pilotControlApi.listCurrentOrganizationMembers(status, LIMIT);
        setDirectory(members.length ? { phase: 'ready', members } : { phase: 'empty' });
      } catch (error) {
        setDirectory({ phase: 'error', error: classify(error) });
      }
    },
    [access.ok],
  );
  useEffect(() => {
    if (access.ok) void load('all', false);
  }, [access.ok, load]);
  const suspend = (member: PilotCurrentOrganizationMember) => {
    if (
      member.isCurrentActor ||
      member.status !== 'active' ||
      !window.confirm(`确认停用 ${member.displayName}？`)
    )
      return;
    setMutation({ phase: 'submitting' });
    void (async () => {
      try {
        const result = await pilotControlApi.suspendCurrentOrganizationMember(
          member.membershipId,
          member.version,
        );
        await load(filter, false);
        setMutation({ phase: 'success', replayed: result.replayed });
      } catch (error) {
        const safe = classify(error);
        if (safe.kind === 'unauthorized') setDirectory({ phase: 'error', error: safe });
        setMutation({ phase: 'error', error: safe });
      }
    })();
  };
  if (!access.ok)
    return (
      <section className="d1-surface" data-testid="pilot-members-permission-denied">
        <Result status="403" title="无成员管理权限" subTitle={access.message} />
      </section>
    );
  if (auth !== 'authenticated') {
    const error =
      directory.phase === 'error'
        ? directory.error
        : { kind: 'unauthorized' as const, requestId: null };
    return <ErrorPanel error={error} retry={() => undefined} />;
  }
  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <header className="d1-page-header">
        <div>
          <Space wrap>
            <Tag color="blue">PILOT</Tag>
            <Tag color="purple">{type}</Tag>
            <Tag>bounded 100</Tag>
          </Space>
          <Typography.Title level={2}>Current Organization Members</Typography.Title>
          <Typography.Paragraph type="secondary">
            只管理当前 Session Organization；不接受任意 Organization ID。
          </Typography.Paragraph>
        </div>
        <Button
          aria-label="重新加载真实成员目录"
          icon={<ReloadOutlined />}
          onClick={() => void load(filter, true)}
        >
          重新加载真实成员目录
        </Button>
      </header>
      <Alert
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="最小成员操作边界"
        description="仅支持 bounded 读取与 suspend；不实现角色编辑、新增、恢复、删除、批量、密码、MFA、全局 User suspend 或 Support Grant。"
      />
      {mutation.phase === 'success' ? (
        <Alert
          data-testid="pilot-member-mutation-success"
          type="success"
          message={mutation.replayed ? '成员停用已确认（幂等重放）。' : '成员已停用。'}
        />
      ) : null}
      {mutation.phase === 'error' ? (
        <Alert
          data-testid={`pilot-member-mutation-${mutation.error.kind}`}
          type="error"
          message={content[mutation.error.kind].title}
          description={
            <span>
              {content[mutation.error.kind].detail}
              {mutation.error.requestId ? ` 请求 ID：${mutation.error.requestId}` : ''}
            </span>
          }
        />
      ) : null}
      <section className="d1-surface">
        <label>
          <Typography.Text>Member status filter</Typography.Text>
          <select
            aria-label="Member status filter"
            value={filter}
            onChange={(e) => {
              const next = e.target.value as PilotMemberStatusFilter;
              setFilter(next);
              void load(next, false);
            }}
          >
            <option value="all">all</option>
            <option value="active">active</option>
            <option value="suspended">suspended</option>
            <option value="expired">expired</option>
          </select>
        </label>
      </section>
      {directory.phase === 'loading' || directory.phase === 'retrying' ? (
        <section className="d1-surface" data-testid={`pilot-members-${directory.phase}`}>
          <Spin />
          <Typography.Text>正在读取真实成员目录…</Typography.Text>
        </section>
      ) : null}
      {directory.phase === 'empty' ? (
        <section className="d1-surface" data-testid="pilot-members-empty">
          <Empty description="当前 bounded directory 没有成员" />
        </section>
      ) : null}
      {directory.phase === 'ready' ? (
        <section className="d1-surface" data-testid="pilot-members-ready">
          <Space direction="vertical" style={{ width: '100%' }}>
            {directory.members.map((m) => (
              <article
                key={m.membershipId}
                style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}
              >
                <Space direction="vertical">
                  <Space wrap>
                    <Typography.Text strong>{m.displayName}</Typography.Text>
                    <Tag>{m.status}</Tag>
                    <Tag>{m.primaryRole}</Tag>
                    {m.isCurrentActor ? <Tag color="blue">SELF</Tag> : null}
                  </Space>
                  <Typography.Text>{m.email}</Typography.Text>
                  <Typography.Text type="secondary">Version {m.version}</Typography.Text>
                  {m.isCurrentActor ? (
                    <Typography.Text type="secondary">当前登录成员不可停用</Typography.Text>
                  ) : m.status === 'active' ? (
                    <Button
                      aria-label="停用成员"
                      danger
                      icon={<StopOutlined />}
                      onClick={() => suspend(m)}
                    >
                      停用成员
                    </Button>
                  ) : (
                    <Typography.Text type="secondary">非 active 成员无停用动作</Typography.Text>
                  )}
                </Space>
              </article>
            ))}
          </Space>
        </section>
      ) : null}
      {directory.phase === 'error' ? (
        <ErrorPanel error={directory.error} retry={() => void load(filter, true)} />
      ) : null}
    </Space>
  );
}
export function PilotPlatformMembersPage() {
  return <Page type="PLATFORM" />;
}
export function PilotChannelMembersPage() {
  return <Page type="CHANNEL" />;
}
export function PilotTenantMembersPage() {
  return <Page type="TENANT" />;
}
