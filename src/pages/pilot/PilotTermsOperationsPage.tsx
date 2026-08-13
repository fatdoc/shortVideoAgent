import {
  CheckCircleOutlined,
  EditOutlined,
  FileProtectOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { Alert, Button, Empty, Result, Space, Spin, Tag, Typography } from 'antd';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotCreateTermsDraftInput,
  type PilotTermsDocument,
  type PilotTermsVersion,
} from '../../services/pilotControlApi';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';

const DIRECTORY_LIMIT = 100;

type SafeErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not-found'
  | 'conflict'
  | 'validation-error'
  | 'service-error'
  | 'invalid-response';

interface SafeError {
  kind: SafeErrorKind;
  requestId: string | null;
}

type DocumentDirectoryState =
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' }
  | { phase: 'ready'; documents: PilotTermsDocument[] }
  | { phase: 'error'; error: SafeError };

type VersionDirectoryState =
  | { phase: 'idle' }
  | { phase: 'loading' | 'retrying' }
  | { phase: 'empty' }
  | { phase: 'ready'; versions: PilotTermsVersion[] }
  | { phase: 'error'; error: SafeError };

type MutationState =
  | { phase: 'idle' }
  | { phase: 'submitting' }
  | { phase: 'success'; message: string; replayed: boolean }
  | { phase: 'error'; error: SafeError };

interface DraftFields {
  versionLabel: string;
  locale: string;
  content: string;
  mustReaccept: boolean;
  supersedesTermsVersionId: string;
}

const EMPTY_DRAFT_FIELDS: DraftFields = {
  versionLabel: '',
  locale: '',
  content: '',
  mustReaccept: false,
  supersedesTermsVersionId: '',
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
  if (error.status === 422) return { kind: 'validation-error', requestId: error.requestId };
  if (error.code.startsWith('INVALID_TERMS_')) {
    return { kind: 'validation-error', requestId: error.requestId };
  }
  if (error.code === 'INVALID_API_RESPONSE') {
    return { kind: 'invalid-response', requestId: error.requestId };
  }
  return { kind: 'service-error', requestId: error.requestId };
}

function formatUtcTimestamp(value: string | null): string {
  if (!value) return '未设置';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '时间不可用';
  return `${date.toISOString().replace('.000Z', 'Z')} (UTC)`;
}

function localUtcInputToTimestamp(value: string): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])-([0-2]\d|3[01])T([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return null;
  }
  const date = new Date(`${value}:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 16) !== value) return null;
  return date.toISOString();
}

function isPlatformAdministrator(): boolean {
  const { status, session } = usePilotAuthStore.getState();
  return (
    status === 'authenticated' &&
    session?.activeContext.organizationType === 'PLATFORM' &&
    session.roles.includes('platform_admin') &&
    session.activeContext.roles.includes('platform_admin')
  );
}

const ERROR_CONTENT: Record<
  SafeErrorKind,
  { title: string; description: string; status: '403' | '404' | '500' }
> = {
  unauthorized: {
    status: '403',
    title: 'Pilot Session 已失效',
    description: '会话已失效，请重新登录。旧 Terms 管理投影已清除。',
  },
  forbidden: {
    status: '403',
    title: '无 Terms 管理权限',
    description: '当前会话无权访问 Platform Terms，系统不会切换到其他 Organization。',
  },
  'not-found': {
    status: '404',
    title: 'Terms 资源不可用',
    description: '目标资源不存在或不可见，页面不会披露其他 Organization 信息。',
  },
  conflict: {
    status: '500',
    title: 'Terms 操作发生冲突',
    description: '服务端状态已变化或业务事实冲突。请重新读取真实目录后再操作。',
  },
  'validation-error': {
    status: '500',
    title: 'Terms 输入未被接受',
    description: '请核对业务或法务提供的字段；页面不会展示服务端原始错误正文。',
  },
  'service-error': {
    status: '500',
    title: 'Terms 服务暂不可用',
    description: '无法完成真实 Control API 操作，请稍后重试。',
  },
  'invalid-response': {
    status: '500',
    title: 'Terms 响应无法安全解析',
    description: 'Control API 返回了无效投影；页面已 fail closed，未使用任何 Mock。',
  },
};

function DirectoryLoading({ kind, retrying }: { kind: 'Document' | 'Version'; retrying: boolean }) {
  return (
    <section
      className="d1-surface"
      data-testid={`pilot-terms-${kind === 'Document' ? 'documents' : 'versions'}-${retrying ? 'retrying' : 'loading'}`}
    >
      <Space direction="vertical" align="center" size={12} style={{ width: '100%', padding: 32 }}>
        <Spin size="large" />
        <Typography.Text
          strong
        >{`${kind} Directory ${retrying ? 'retrying' : 'loading'}`}</Typography.Text>
        <Typography.Text type="secondary">
          旧投影已清空；仅等待真实 Control API，不读取 Demo、Mock 或本地管理状态。
        </Typography.Text>
      </Space>
    </section>
  );
}

function DirectoryError({
  scope,
  error,
  onRetry,
}: {
  scope: 'documents' | 'versions';
  error: SafeError;
  onRetry: () => void;
}) {
  const content = ERROR_CONTENT[error.kind];
  const retryable =
    error.kind === 'service-error' ||
    error.kind === 'invalid-response' ||
    error.kind === 'validation-error';
  return (
    <section className="d1-surface" data-testid={`pilot-terms-${scope}-${error.kind}`}>
      <Result
        status={content.status}
        title={content.title}
        subTitle={content.description}
        extra={
          retryable ? (
            <Button
              aria-label={
                scope === 'documents' ? '重试 Document Directory' : '重试 Version Directory'
              }
              type="primary"
              icon={<ReloadOutlined />}
              onClick={onRetry}
            >
              {scope === 'documents' ? '重试 Document Directory' : '重试 Version Directory'}
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

function MutationNotice({ state }: { state: MutationState }) {
  if (state.phase === 'idle' || state.phase === 'submitting') return null;
  if (state.phase === 'success') {
    return (
      <Alert
        data-testid="pilot-terms-mutation-success"
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message={state.message}
        description={
          state.replayed
            ? '服务端确认这是幂等重放；目录已重新读取。'
            : '目录已重新读取真实服务端状态。'
        }
      />
    );
  }
  const content = ERROR_CONTENT[state.error.kind];
  return (
    <Alert
      data-testid={`pilot-terms-mutation-${state.error.kind}`}
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

function DocumentDirectory({
  documents,
  selectedDocumentId,
  onSelect,
}: {
  documents: PilotTermsDocument[];
  selectedDocumentId: string | null;
  onSelect: (documentId: string) => void;
}) {
  return (
    <section className="d1-surface" data-testid="pilot-terms-documents-ready">
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Typography.Title level={4}>真实 Document Directory</Typography.Title>
        {documents.map((document) => (
          <Button
            key={document.termsDocumentId}
            type={selectedDocumentId === document.termsDocumentId ? 'primary' : 'default'}
            block
            style={{ height: 'auto', padding: 12, textAlign: 'left' }}
            onClick={() => onSelect(document.termsDocumentId)}
          >
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Space wrap>
                <Typography.Text strong>{document.title}</Typography.Text>
                <Tag>{document.documentCode}</Tag>
                <Tag color={document.status === 'active' ? 'green' : 'default'}>
                  {document.status}
                </Tag>
              </Space>
              <Typography.Text type="secondary">
                更新于 {formatUtcTimestamp(document.updatedAt)}
              </Typography.Text>
            </Space>
          </Button>
        ))}
      </Space>
    </section>
  );
}

function VersionDirectory({
  versions,
  publishTimes,
  submitting,
  onEdit,
  onPublishTimeChange,
  onPublish,
  onRetire,
}: {
  versions: PilotTermsVersion[];
  publishTimes: Record<string, string>;
  submitting: boolean;
  onEdit: (version: PilotTermsVersion) => void;
  onPublishTimeChange: (versionId: string, value: string) => void;
  onPublish: (version: PilotTermsVersion) => void;
  onRetire: (version: PilotTermsVersion) => void;
}) {
  return (
    <section className="d1-surface" data-testid="pilot-terms-versions-ready">
      <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Typography.Title level={4}>真实 Version Directory</Typography.Title>
        {versions.map((version) => (
          <article
            key={version.termsVersionId}
            style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 16 }}
          >
            <Space direction="vertical" size={8} style={{ width: '100%' }}>
              <Space wrap>
                <Typography.Text strong>{version.versionLabel}</Typography.Text>
                <Tag
                  color={
                    version.status === 'DRAFT'
                      ? 'orange'
                      : version.status === 'PUBLISHED'
                        ? 'green'
                        : 'default'
                  }
                >
                  {version.status}
                </Tag>
                <Tag>{version.locale}</Tag>
                {version.mustReaccept ? <Tag color="red">MUST_REACCEPT</Tag> : null}
              </Space>
              <Typography.Paragraph style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
                {version.content}
              </Typography.Paragraph>
              <Typography.Text type="secondary">
                生效：{formatUtcTimestamp(version.effectiveAt)} · 更新：
                {formatUtcTimestamp(version.updatedAt)}
              </Typography.Text>
              {version.status === 'DRAFT' ? (
                <Space wrap align="end">
                  <Button
                    icon={<EditOutlined />}
                    disabled={submitting}
                    onClick={() => onEdit(version)}
                  >
                    编辑 {version.versionLabel}
                  </Button>
                  <label>
                    <Typography.Text>发布生效时间（UTC）</Typography.Text>
                    <input
                      aria-label={`Publish effective time ${version.termsVersionId}`}
                      type="datetime-local"
                      value={publishTimes[version.termsVersionId] ?? ''}
                      onChange={(event) =>
                        onPublishTimeChange(version.termsVersionId, event.target.value)
                      }
                      disabled={submitting}
                    />
                  </label>
                  <Button type="primary" disabled={submitting} onClick={() => onPublish(version)}>
                    发布 {version.versionLabel}
                  </Button>
                </Space>
              ) : null}
              {version.status === 'PUBLISHED' ? (
                <Button danger disabled={submitting} onClick={() => onRetire(version)}>
                  退役 {version.versionLabel}
                </Button>
              ) : null}
            </Space>
          </article>
        ))}
      </Space>
    </section>
  );
}

export function PilotTermsOperationsPage() {
  const [allowed] = useState(() => isPlatformAdministrator());
  const currentAuthStatus = usePilotAuthStore((state) => state.status);

  const [documentsState, setDocumentsState] = useState<DocumentDirectoryState>({
    phase: 'loading',
  });
  const [versionsState, setVersionsState] = useState<VersionDirectoryState>({ phase: 'idle' });
  const [selectedDocumentId, setSelectedDocumentId] = useState<string | null>(null);
  const [mutationState, setMutationState] = useState<MutationState>({ phase: 'idle' });
  const [documentCode, setDocumentCode] = useState('');
  const [documentTitle, setDocumentTitle] = useState('');
  const [draftFields, setDraftFields] = useState<DraftFields>(EMPTY_DRAFT_FIELDS);
  const [editingVersion, setEditingVersion] = useState<PilotTermsVersion | null>(null);
  const [editFields, setEditFields] = useState<DraftFields>(EMPTY_DRAFT_FIELDS);
  const [publishTimes, setPublishTimes] = useState<Record<string, string>>({});

  const loadVersions = useCallback(async (documentId: string, retrying: boolean) => {
    setVersionsState({ phase: retrying ? 'retrying' : 'loading' });
    try {
      const versions = await pilotControlApi.listTermsVersions(documentId, 'all', DIRECTORY_LIMIT);
      setVersionsState(versions.length === 0 ? { phase: 'empty' } : { phase: 'ready', versions });
    } catch (error) {
      const safeError = classifyError(error);
      if (safeError.kind === 'unauthorized') {
        setDocumentsState({ phase: 'error', error: safeError });
        setVersionsState({ phase: 'idle' });
        setSelectedDocumentId(null);
        return;
      }
      setVersionsState({ phase: 'error', error: safeError });
    }
  }, []);

  const loadDocuments = useCallback(
    async (retrying: boolean, preferredDocumentId?: string): Promise<void> => {
      if (!isPlatformAdministrator()) return;
      setDocumentsState({ phase: retrying ? 'retrying' : 'loading' });
      setVersionsState({ phase: 'idle' });
      setSelectedDocumentId(null);
      try {
        const documents = await pilotControlApi.listTermsDocuments('all', DIRECTORY_LIMIT);
        if (documents.length === 0) {
          setDocumentsState({ phase: 'empty' });
          return;
        }
        const selected =
          documents.find((document) => document.termsDocumentId === preferredDocumentId) ??
          documents[0];
        setDocumentsState({ phase: 'ready', documents });
        setSelectedDocumentId(selected.termsDocumentId);
        await loadVersions(selected.termsDocumentId, false);
      } catch (error) {
        setDocumentsState({ phase: 'error', error: classifyError(error) });
      }
    },
    [loadVersions],
  );

  useEffect(() => {
    if (!allowed) return;
    void loadDocuments(false);
  }, [allowed, loadDocuments]);

  const selectedDocument =
    documentsState.phase === 'ready'
      ? (documentsState.documents.find(
          (document) => document.termsDocumentId === selectedDocumentId,
        ) ?? null)
      : null;
  const submitting = mutationState.phase === 'submitting';

  const selectDocument = (documentId: string) => {
    if (documentId === selectedDocumentId) return;
    setSelectedDocumentId(documentId);
    setMutationState({ phase: 'idle' });
    setEditingVersion(null);
    void loadVersions(documentId, false);
  };

  const runMutation = async (
    action: () => Promise<{ preferredDocumentId: string; message: string; replayed?: boolean }>,
  ) => {
    setMutationState({ phase: 'submitting' });
    try {
      const result = await action();
      setEditingVersion(null);
      await loadDocuments(false, result.preferredDocumentId);
      setMutationState({
        phase: 'success',
        message: result.message,
        replayed: result.replayed ?? false,
      });
    } catch (error) {
      const safeError = classifyError(error);
      if (safeError.kind === 'unauthorized') {
        setDocumentsState({ phase: 'error', error: safeError });
        setVersionsState({ phase: 'idle' });
        setSelectedDocumentId(null);
        setEditingVersion(null);
      }
      setMutationState({ phase: 'error', error: safeError });
    }
  };

  const submitDocument = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = documentCode.trim();
    const title = documentTitle.trim();
    if (!code || !title) {
      setMutationState({
        phase: 'error',
        error: { kind: 'validation-error', requestId: null },
      });
      return;
    }
    void runMutation(async () => {
      const created = await pilotControlApi.createTermsDocument({ documentCode: code, title });
      setDocumentCode('');
      setDocumentTitle('');
      return {
        preferredDocumentId: created.termsDocumentId,
        message: 'Document 已创建，并已重新读取真实目录。',
      };
    });
  };

  const normalizedDraftInput = (fields: DraftFields): PilotCreateTermsDraftInput | null => {
    const versionLabel = fields.versionLabel.trim();
    const locale = fields.locale.trim();
    const content = fields.content.trim();
    if (!versionLabel || !locale || !content) return null;
    return {
      versionLabel,
      locale,
      content,
      mustReaccept: fields.mustReaccept,
      supersedesTermsVersionId: fields.supersedesTermsVersionId || null,
    };
  };

  const submitDraft = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDocumentId) return;
    const input = normalizedDraftInput(draftFields);
    if (!input) {
      setMutationState({
        phase: 'error',
        error: { kind: 'validation-error', requestId: null },
      });
      return;
    }
    const documentId = selectedDocumentId;
    void runMutation(async () => {
      await pilotControlApi.createTermsDraft(documentId, input);
      setDraftFields(EMPTY_DRAFT_FIELDS);
      return { preferredDocumentId: documentId, message: 'DRAFT 已创建。' };
    });
  };

  const startEditing = (version: PilotTermsVersion) => {
    setEditingVersion(version);
    setEditFields({
      versionLabel: version.versionLabel,
      locale: version.locale,
      content: version.content,
      mustReaccept: version.mustReaccept,
      supersedesTermsVersionId: version.supersedesTermsVersionId ?? '',
    });
    setMutationState({ phase: 'idle' });
  };

  const submitEdit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedDocumentId || !editingVersion || editingVersion.status !== 'DRAFT') return;
    const input = normalizedDraftInput(editFields);
    if (!input) {
      setMutationState({
        phase: 'error',
        error: { kind: 'validation-error', requestId: null },
      });
      return;
    }
    const documentId = selectedDocumentId;
    const versionId = editingVersion.termsVersionId;
    void runMutation(async () => {
      await pilotControlApi.updateTermsDraft(versionId, {
        ...input,
        effectiveAt: editingVersion.effectiveAt,
      });
      return { preferredDocumentId: documentId, message: 'DRAFT 已更新。' };
    });
  };

  const publishVersion = (version: PilotTermsVersion) => {
    if (!selectedDocumentId || version.status !== 'DRAFT') return;
    const effectiveAt = localUtcInputToTimestamp(publishTimes[version.termsVersionId] ?? '');
    if (!effectiveAt) {
      setMutationState({
        phase: 'error',
        error: { kind: 'validation-error', requestId: null },
      });
      return;
    }
    if (
      !window.confirm(
        `确认将 ${version.versionLabel} 发布为 PUBLISHED，并按所填 UTC 时间生效？此页面不会代替法务审批。`,
      )
    ) {
      return;
    }
    const documentId = selectedDocumentId;
    void runMutation(async () => {
      const result = await pilotControlApi.publishTermsVersion(version.termsVersionId, {
        effectiveAt,
      });
      return {
        preferredDocumentId: documentId,
        message: result.replayed ? 'Version 发布已确认（幂等重放）。' : 'Version 已发布。',
        replayed: result.replayed,
      };
    });
  };

  const retireVersion = (version: PilotTermsVersion) => {
    if (!selectedDocumentId || version.status !== 'PUBLISHED') return;
    if (
      !window.confirm(
        `确认将 ${version.versionLabel} 标记为 RETIRED？页面不会自动选择替代版本或批量退役。`,
      )
    ) {
      return;
    }
    const documentId = selectedDocumentId;
    void runMutation(async () => {
      const result = await pilotControlApi.retireTermsVersion(version.termsVersionId);
      return {
        preferredDocumentId: documentId,
        message: result.replayed ? 'Version 退役已确认（幂等重放）。' : 'Version 已退役。',
        replayed: result.replayed,
      };
    });
  };

  if (allowed && currentAuthStatus !== 'authenticated') {
    const unauthorizedError =
      documentsState.phase === 'error' && documentsState.error.kind === 'unauthorized'
        ? documentsState.error
        : mutationState.phase === 'error' && mutationState.error.kind === 'unauthorized'
          ? mutationState.error
          : { kind: 'unauthorized' as const, requestId: null };
    return <DirectoryError scope="documents" error={unauthorizedError} onRetry={() => undefined} />;
  }

  if (!allowed) {
    return (
      <section className="d1-surface" data-testid="pilot-terms-permission-denied">
        <Result
          status="403"
          title="仅 Platform 管理员可管理 Terms"
          subTitle="当前 Session Scope 不满足 PLATFORM + platform_admin；不会猜测或切换 Organization。"
        />
      </section>
    );
  }

  return (
    <Space direction="vertical" size={20} style={{ width: '100%' }}>
      <header className="d1-page-header">
        <div>
          <Space size={8} wrap>
            <Tag color="blue">PILOT</Tag>
            <Tag color="purple">PLATFORM</Tag>
            <Tag color="orange">TERMS OPERATIONS</Tag>
          </Space>
          <Typography.Title level={2}>Platform Terms Operations</Typography.Title>
          <Typography.Paragraph type="secondary">
            仅录入业务或法务提供的正文；系统不会 seed、代写或自动发布正式 Terms。
          </Typography.Paragraph>
        </div>
        <Button
          aria-label="重新加载 Document Directory"
          icon={<ReloadOutlined />}
          disabled={submitting}
          onClick={() => void loadDocuments(true, selectedDocumentId ?? undefined)}
        >
          重新加载 Document Directory
        </Button>
      </header>

      <Alert
        type="warning"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message="管理边界"
        description="DRAFT、PUBLISHED、RETIRED 均以真实服务端目录为准；不实现富文本附件、电子签章、法务审批、自动翻译、批量发布或 User Consent 明细导出。"
      />
      <MutationNotice state={mutationState} />

      {documentsState.phase === 'loading' || documentsState.phase === 'retrying' ? (
        <DirectoryLoading kind="Document" retrying={documentsState.phase === 'retrying'} />
      ) : null}
      {documentsState.phase === 'empty' ? (
        <section className="d1-surface" data-testid="pilot-terms-documents-empty">
          <Empty description={null}>
            <Typography.Title level={4}>没有真实 Terms Document</Typography.Title>
            <Typography.Paragraph type="secondary">
              可按业务或法务提供的文档代码与标题创建首个 Document；不会生成默认正文。
            </Typography.Paragraph>
          </Empty>
        </section>
      ) : null}
      {documentsState.phase === 'ready' ? (
        <DocumentDirectory
          documents={documentsState.documents}
          selectedDocumentId={selectedDocumentId}
          onSelect={selectDocument}
        />
      ) : null}
      {documentsState.phase === 'error' ? (
        <DirectoryError
          scope="documents"
          error={documentsState.error}
          onRetry={() => void loadDocuments(true)}
        />
      ) : null}

      <section className="d1-surface">
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Space wrap>
            <FileProtectOutlined />
            <Typography.Title level={4} style={{ margin: 0 }}>
              创建 Terms Document
            </Typography.Title>
          </Space>
          <form onSubmit={submitDocument}>
            <Space direction="vertical" size={10} style={{ width: '100%' }}>
              <label>
                <Typography.Text>Document code</Typography.Text>
                <input
                  aria-label="Document code"
                  value={documentCode}
                  onChange={(event) => setDocumentCode(event.target.value)}
                  disabled={submitting}
                />
              </label>
              <label>
                <Typography.Text>Document title</Typography.Text>
                <input
                  aria-label="Document title"
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  disabled={submitting}
                />
              </label>
              <Button
                aria-label="创建 Terms Document"
                htmlType="submit"
                type="primary"
                icon={<PlusOutlined />}
                loading={submitting}
              >
                创建 Terms Document
              </Button>
            </Space>
          </form>
        </Space>
      </section>

      {selectedDocument ? (
        <section className="d1-surface" data-testid="pilot-terms-create-draft">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Title level={4}>为 {selectedDocument.title} 创建 DRAFT</Typography.Title>
            <Typography.Paragraph type="secondary">
              正文必须由已授权的业务或法务人员提供；创建后仍是 DRAFT，不会自动发布。
            </Typography.Paragraph>
            <form onSubmit={submitDraft}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <label>
                  <Typography.Text>Draft version label</Typography.Text>
                  <input
                    aria-label="Draft version label"
                    value={draftFields.versionLabel}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        versionLabel: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label>
                  <Typography.Text>Draft locale</Typography.Text>
                  <input
                    aria-label="Draft locale"
                    value={draftFields.locale}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        locale: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label>
                  <Typography.Text>Draft content</Typography.Text>
                  <textarea
                    aria-label="Draft content"
                    rows={8}
                    value={draftFields.content}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label>
                  <input
                    aria-label="Draft must reaccept"
                    type="checkbox"
                    checked={draftFields.mustReaccept}
                    onChange={(event) =>
                      setDraftFields((current) => ({
                        ...current,
                        mustReaccept: event.target.checked,
                      }))
                    }
                    disabled={submitting}
                  />{' '}
                  发布后要求重新接受
                </label>
                <Button htmlType="submit" type="primary" loading={submitting}>
                  创建 DRAFT
                </Button>
              </Space>
            </form>
          </Space>
        </section>
      ) : null}

      {editingVersion ? (
        <section className="d1-surface" data-testid="pilot-terms-edit-draft">
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            <Typography.Title level={4}>编辑 DRAFT：{editingVersion.versionLabel}</Typography.Title>
            <form onSubmit={submitEdit}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                <label>
                  <Typography.Text>Edit DRAFT version label</Typography.Text>
                  <input
                    aria-label="Edit DRAFT version label"
                    value={editFields.versionLabel}
                    onChange={(event) =>
                      setEditFields((current) => ({
                        ...current,
                        versionLabel: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label>
                  <Typography.Text>Edit DRAFT locale</Typography.Text>
                  <input
                    aria-label="Edit DRAFT locale"
                    value={editFields.locale}
                    onChange={(event) =>
                      setEditFields((current) => ({
                        ...current,
                        locale: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label>
                  <Typography.Text>Edit DRAFT content</Typography.Text>
                  <textarea
                    aria-label="Edit DRAFT content"
                    rows={8}
                    value={editFields.content}
                    onChange={(event) =>
                      setEditFields((current) => ({
                        ...current,
                        content: event.target.value,
                      }))
                    }
                    disabled={submitting}
                  />
                </label>
                <label>
                  <input
                    aria-label="Edit DRAFT must reaccept"
                    type="checkbox"
                    checked={editFields.mustReaccept}
                    onChange={(event) =>
                      setEditFields((current) => ({
                        ...current,
                        mustReaccept: event.target.checked,
                      }))
                    }
                    disabled={submitting}
                  />{' '}
                  发布后要求重新接受
                </label>
                <Space>
                  <Button htmlType="submit" type="primary" loading={submitting}>
                    保存 DRAFT
                  </Button>
                  <Button disabled={submitting} onClick={() => setEditingVersion(null)}>
                    取消编辑
                  </Button>
                </Space>
              </Space>
            </form>
          </Space>
        </section>
      ) : null}

      {versionsState.phase === 'loading' || versionsState.phase === 'retrying' ? (
        <DirectoryLoading kind="Version" retrying={versionsState.phase === 'retrying'} />
      ) : null}
      {versionsState.phase === 'empty' ? (
        <section className="d1-surface" data-testid="pilot-terms-versions-empty">
          <Empty description={null}>
            <Typography.Title level={4}>没有真实 Terms Version</Typography.Title>
            <Typography.Paragraph type="secondary">
              当前 Document 尚无版本；请仅用业务或法务提供的正文创建 DRAFT。
            </Typography.Paragraph>
          </Empty>
        </section>
      ) : null}
      {versionsState.phase === 'ready' ? (
        <VersionDirectory
          versions={versionsState.versions}
          publishTimes={publishTimes}
          submitting={submitting}
          onEdit={startEditing}
          onPublishTimeChange={(versionId, value) =>
            setPublishTimes((current) => ({ ...current, [versionId]: value }))
          }
          onPublish={publishVersion}
          onRetire={retireVersion}
        />
      ) : null}
      {versionsState.phase === 'error' && selectedDocumentId ? (
        <DirectoryError
          scope="versions"
          error={versionsState.error}
          onRetry={() => void loadVersions(selectedDocumentId, true)}
        />
      ) : null}
    </Space>
  );
}
