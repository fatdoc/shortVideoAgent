import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppProviders } from '../../app/Providers';
import {
  PilotControlApiError,
  pilotControlApi,
  type PilotSession,
  type PilotTermsDocument,
  type PilotTermsVersion,
} from '../../services/pilotControlApi';
import * as demoStore from '../../stores/controlPlaneStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { usePilotProjectContextStore } from '../../stores/pilotProjectContextStore';
import { PilotTermsOperationsPage } from './PilotTermsOperationsPage';

const DOCUMENT_ID = '10000000-0000-4000-8000-000000000001';
const OTHER_DOCUMENT_ID = '10000000-0000-4000-8000-000000000002';
const DRAFT_ID = '20000000-0000-4000-8000-000000000001';
const PUBLISHED_ID = '20000000-0000-4000-8000-000000000002';
const SENSITIVE_MESSAGE = 'SQL stack tokenDigest=SENSITIVE_MUST_NOT_RENDER';

const platformSession: PilotSession = {
  user: { id: 'user-platform', email: 'platform@example.com', displayName: '平台管理员' },
  tenant: null,
  roles: ['platform_admin'],
  activeContext: {
    membershipId: 'membership-platform',
    organizationId: 'a0000000-0000-4000-8000-000000000001',
    organizationType: 'PLATFORM',
    organizationDisplayName: '平台组织',
    membershipVersion: 1,
    primaryRole: 'platform_admin',
    roles: ['platform_admin'],
    tenantId: null,
  },
  expiresAt: '2026-08-11T00:00:00.000Z',
};

const channelSession: PilotSession = {
  ...platformSession,
  roles: ['channel_admin'],
  activeContext: {
    ...platformSession.activeContext,
    organizationType: 'CHANNEL',
    primaryRole: 'channel_admin',
    roles: ['channel_admin'],
  },
};

const documentRecord: PilotTermsDocument = {
  termsDocumentId: DOCUMENT_ID,
  documentCode: 'platform-service-terms',
  title: '平台服务条款',
  status: 'active',
  createdAt: '2026-08-09T01:00:00.000Z',
  updatedAt: '2026-08-09T01:00:00.000Z',
};

const otherDocumentRecord: PilotTermsDocument = {
  ...documentRecord,
  termsDocumentId: OTHER_DOCUMENT_ID,
  documentCode: 'privacy-notice',
  title: '隐私告知',
};

const draftRecord: PilotTermsVersion = {
  termsVersionId: DRAFT_ID,
  termsDocumentId: DOCUMENT_ID,
  versionLabel: '2026-08-draft',
  status: 'DRAFT',
  content: '由业务或法务提供的待审正文。',
  contentDigest: 'a'.repeat(64),
  locale: 'zh-CN',
  publishedAt: null,
  effectiveAt: null,
  publishedBy: null,
  supersedesTermsVersionId: null,
  mustReaccept: false,
  createdAt: '2026-08-09T02:00:00.000Z',
  updatedAt: '2026-08-09T02:00:00.000Z',
};

const publishedRecord: PilotTermsVersion = {
  ...draftRecord,
  termsVersionId: PUBLISHED_ID,
  versionLabel: '2026-08',
  status: 'PUBLISHED',
  publishedAt: '2026-08-09T03:00:00.000Z',
  effectiveAt: '2026-08-12T00:00:00.000Z',
  publishedBy: 'user-platform',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function renderPage() {
  return render(
    <AppProviders>
      <PilotTermsOperationsPage />
    </AppProviders>,
  );
}

function mockReadyDirectory(versions: PilotTermsVersion[] = [draftRecord]) {
  vi.spyOn(pilotControlApi, 'listTermsDocuments').mockResolvedValue([documentRecord]);
  vi.spyOn(pilotControlApi, 'listTermsVersions').mockResolvedValue(versions);
}

beforeEach(() => {
  vi.restoreAllMocks();
  usePilotAuthStore.setState({
    status: 'authenticated',
    session: platformSession,
    error: null,
    requestId: null,
  });
  usePilotProjectContextStore.getState().reset();
});

describe('A-BIZ-06C.3 Platform Terms Operations Page', () => {
  it('renders the real Document Directory loading then empty state without reading Demo Store', async () => {
    const response = deferred<PilotTermsDocument[]>();
    const demoStoreRead = vi.spyOn(demoStore, 'useControlPlaneStore');
    vi.spyOn(pilotControlApi, 'listTermsDocuments').mockReturnValue(response.promise);

    renderPage();

    expect(screen.getByTestId('pilot-terms-documents-loading')).toHaveTextContent(
      'Document Directory loading',
    );
    expect(pilotControlApi.listTermsDocuments).toHaveBeenCalledWith('all', 100);
    expect(demoStoreRead).not.toHaveBeenCalled();

    response.resolve([]);
    expect(await screen.findByTestId('pilot-terms-documents-empty')).toHaveTextContent(
      '没有真实 Terms Document',
    );
    expect(screen.queryByTestId('pilot-terms-versions-ready')).not.toBeInTheDocument();
  });

  it('selects a real Document and renders Version Directory loading then empty', async () => {
    const versions = deferred<PilotTermsVersion[]>();
    vi.spyOn(pilotControlApi, 'listTermsDocuments').mockResolvedValue([
      documentRecord,
      otherDocumentRecord,
    ]);
    vi.spyOn(pilotControlApi, 'listTermsVersions').mockReturnValue(versions.promise);

    renderPage();

    const documents = await screen.findByTestId('pilot-terms-documents-ready');
    expect(documents).toHaveTextContent('平台服务条款');
    expect(documents).toHaveTextContent('隐私告知');
    expect(screen.getByTestId('pilot-terms-versions-loading')).toHaveTextContent(
      'Version Directory loading',
    );
    expect(pilotControlApi.listTermsVersions).toHaveBeenCalledWith(DOCUMENT_ID, 'all', 100);

    versions.resolve([]);
    expect(await screen.findByTestId('pilot-terms-versions-empty')).toHaveTextContent(
      '没有真实 Terms Version',
    );
  });

  it('clears old Document rows while retrying a safe service error', async () => {
    const retry = deferred<PilotTermsDocument[]>();
    const list = vi
      .spyOn(pilotControlApi, 'listTermsDocuments')
      .mockResolvedValueOnce([documentRecord])
      .mockReturnValueOnce(retry.promise);
    vi.spyOn(pilotControlApi, 'listTermsVersions').mockResolvedValue([]);

    renderPage();
    await screen.findByTestId('pilot-terms-documents-ready');
    fireEvent.click(screen.getByRole('button', { name: '重新加载 Document Directory' }));

    expect(screen.getByTestId('pilot-terms-documents-retrying')).not.toHaveTextContent(
      documentRecord.title,
    );
    retry.reject(
      new PilotControlApiError('INTERNAL_ERROR', SENSITIVE_MESSAGE, 500, 'terms-docs-500'),
    );

    const error = await screen.findByTestId('pilot-terms-documents-service-error');
    expect(error).toHaveTextContent('请求 ID：terms-docs-500');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
    expect(list).toHaveBeenCalledTimes(2);

    vi.mocked(list).mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole('button', { name: '重试 Document Directory' }));
    expect(await screen.findByTestId('pilot-terms-documents-empty')).toBeInTheDocument();
  });

  it('supports Version Directory error and retry independently', async () => {
    vi.spyOn(pilotControlApi, 'listTermsDocuments').mockResolvedValue([documentRecord]);
    const list = vi
      .spyOn(pilotControlApi, 'listTermsVersions')
      .mockRejectedValueOnce(
        new PilotControlApiError('INVALID_API_RESPONSE', SENSITIVE_MESSAGE, null, 'versions-bad'),
      )
      .mockResolvedValueOnce([draftRecord]);

    renderPage();

    const error = await screen.findByTestId('pilot-terms-versions-invalid-response');
    expect(error).toHaveTextContent('请求 ID：versions-bad');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
    fireEvent.click(screen.getByRole('button', { name: '重试 Version Directory' }));

    expect(await screen.findByTestId('pilot-terms-versions-ready')).toHaveTextContent(
      draftRecord.versionLabel,
    );
    expect(list).toHaveBeenCalledTimes(2);
  });

  it('creates a Document then re-reads both real directories', async () => {
    const listDocuments = vi
      .spyOn(pilotControlApi, 'listTermsDocuments')
      .mockResolvedValueOnce([documentRecord])
      .mockResolvedValueOnce([documentRecord, otherDocumentRecord]);
    const listVersions = vi.spyOn(pilotControlApi, 'listTermsVersions').mockResolvedValue([]);
    const create = vi
      .spyOn(pilotControlApi, 'createTermsDocument')
      .mockResolvedValue(otherDocumentRecord);

    renderPage();
    await screen.findByTestId('pilot-terms-versions-empty');
    fireEvent.change(screen.getByLabelText('Document code'), {
      target: { value: 'privacy-notice' },
    });
    fireEvent.change(screen.getByLabelText('Document title'), {
      target: { value: '隐私告知' },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建 Terms Document' }));

    expect(await screen.findByTestId('pilot-terms-mutation-success')).toHaveTextContent(
      'Document 已创建，并已重新读取真实目录',
    );
    expect(create).toHaveBeenCalledWith({ documentCode: 'privacy-notice', title: '隐私告知' });
    expect(listDocuments).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(listVersions).toHaveBeenCalledWith(OTHER_DOCUMENT_ID, 'all', 100));
  });

  it('creates a DRAFT from explicit business/legal content and refreshes the directories', async () => {
    const listDocuments = vi
      .spyOn(pilotControlApi, 'listTermsDocuments')
      .mockResolvedValue([documentRecord]);
    const listVersions = vi
      .spyOn(pilotControlApi, 'listTermsVersions')
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([draftRecord]);
    const create = vi.spyOn(pilotControlApi, 'createTermsDraft').mockResolvedValue(draftRecord);

    renderPage();
    await screen.findByTestId('pilot-terms-versions-empty');
    fireEvent.change(screen.getByLabelText('Draft version label'), {
      target: { value: '2026-08-draft' },
    });
    fireEvent.change(screen.getByLabelText('Draft locale'), { target: { value: 'zh-CN' } });
    fireEvent.change(screen.getByLabelText('Draft content'), {
      target: { value: draftRecord.content },
    });
    fireEvent.click(screen.getByRole('button', { name: '创建 DRAFT' }));

    expect(create).toHaveBeenCalledWith(DOCUMENT_ID, {
      versionLabel: '2026-08-draft',
      content: draftRecord.content,
      locale: 'zh-CN',
      mustReaccept: false,
      supersedesTermsVersionId: null,
    });
    expect(await screen.findByTestId('pilot-terms-mutation-success')).toHaveTextContent(
      'DRAFT 已创建',
    );
    expect(listDocuments).toHaveBeenCalledTimes(2);
    expect(listVersions).toHaveBeenCalledTimes(2);
  });

  it('updates only a selected DRAFT and reloads server truth', async () => {
    mockReadyDirectory([draftRecord, publishedRecord]);
    const update = vi.spyOn(pilotControlApi, 'updateTermsDraft').mockResolvedValue({
      ...draftRecord,
      content: '业务或法务更新后的正文。',
    });

    renderPage();
    const versions = await screen.findByTestId('pilot-terms-versions-ready');
    fireEvent.click(within(versions).getByRole('button', { name: /编辑 2026-08-draft/ }));
    fireEvent.change(screen.getByLabelText('Edit DRAFT content'), {
      target: { value: '业务或法务更新后的正文。' },
    });
    fireEvent.click(screen.getByRole('button', { name: '保存 DRAFT' }));

    expect(update).toHaveBeenCalledWith(DRAFT_ID, {
      versionLabel: draftRecord.versionLabel,
      content: '业务或法务更新后的正文。',
      locale: draftRecord.locale,
      mustReaccept: false,
      supersedesTermsVersionId: null,
      effectiveAt: null,
    });
    expect(await screen.findByTestId('pilot-terms-mutation-success')).toHaveTextContent(
      'DRAFT 已更新',
    );
  });

  it('requires publish confirmation, reports replay, and refreshes server truth', async () => {
    mockReadyDirectory([draftRecord]);
    const publish = vi.spyOn(pilotControlApi, 'publishTermsVersion').mockResolvedValue({
      version: publishedRecord,
      replayed: true,
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await screen.findByTestId('pilot-terms-versions-ready');
    fireEvent.change(screen.getByLabelText(`Publish effective time ${DRAFT_ID}`), {
      target: { value: '2026-08-12T00:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /发布 2026-08-draft/ }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('PUBLISHED'));
    expect(publish).toHaveBeenCalledWith(DRAFT_ID, {
      effectiveAt: '2026-08-12T00:00:00.000Z',
    });
    expect(await screen.findByTestId('pilot-terms-mutation-success')).toHaveTextContent('幂等重放');
  });

  it('requires retire confirmation and reports a non-replayed result', async () => {
    mockReadyDirectory([publishedRecord]);
    const retired = { ...publishedRecord, status: 'RETIRED' as const };
    const retire = vi.spyOn(pilotControlApi, 'retireTermsVersion').mockResolvedValue({
      version: retired,
      replayed: false,
    });
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await screen.findByTestId('pilot-terms-versions-ready');
    fireEvent.click(screen.getByRole('button', { name: /退役 2026-08/ }));

    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('RETIRED'));
    expect(retire).toHaveBeenCalledWith(PUBLISHED_ID);
    expect(await screen.findByTestId('pilot-terms-mutation-success')).toHaveTextContent(
      'Version 已退役',
    );
  });

  it('renders a safe 409 conflict with Request ID and no raw server message', async () => {
    mockReadyDirectory([]);
    vi.spyOn(pilotControlApi, 'createTermsDraft').mockRejectedValue(
      new PilotControlApiError('TERMS_VERSION_CONFLICT', SENSITIVE_MESSAGE, 409, 'terms-409'),
    );

    renderPage();
    await screen.findByTestId('pilot-terms-versions-empty');
    fireEvent.change(screen.getByLabelText('Draft version label'), {
      target: { value: 'duplicate' },
    });
    fireEvent.change(screen.getByLabelText('Draft locale'), { target: { value: 'zh-CN' } });
    fireEvent.change(screen.getByLabelText('Draft content'), { target: { value: '合法正文' } });
    fireEvent.click(screen.getByRole('button', { name: '创建 DRAFT' }));

    const error = await screen.findByTestId('pilot-terms-mutation-conflict');
    expect(error).toHaveTextContent('请求 ID：terms-409');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
  });

  it('clears stale directories and all management controls on a 401 mutation response', async () => {
    mockReadyDirectory([draftRecord]);
    vi.spyOn(pilotControlApi, 'publishTermsVersion').mockRejectedValue(
      new PilotControlApiError(
        'AUTHENTICATION_REQUIRED',
        SENSITIVE_MESSAGE,
        401,
        'terms-mutation-401',
      ),
    );
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await screen.findByTestId('pilot-terms-versions-ready');
    fireEvent.change(screen.getByLabelText(`Publish effective time ${DRAFT_ID}`), {
      target: { value: '2026-08-12T00:00' },
    });
    fireEvent.click(screen.getByRole('button', { name: /发布 2026-08-draft/ }));

    const error = await screen.findByTestId('pilot-terms-documents-unauthorized');
    expect(error).toHaveTextContent('请求 ID：terms-mutation-401');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
    expect(document.body).not.toHaveTextContent(draftRecord.content);
    expect(screen.queryByRole('button', { name: '创建 Terms Document' })).not.toBeInTheDocument();
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null });
  });

  it('clears Pilot Session and Project Context on a 401 directory response', async () => {
    usePilotProjectContextStore.setState({
      status: 'ready',
      projects: [],
      activeProjectId: 'old-project',
      context: null,
      error: null,
      requestId: null,
    });
    vi.spyOn(pilotControlApi, 'listTermsDocuments').mockRejectedValue(
      new PilotControlApiError('AUTHENTICATION_REQUIRED', SENSITIVE_MESSAGE, 401, 'terms-401'),
    );

    renderPage();

    const error = await screen.findByTestId('pilot-terms-documents-unauthorized');
    expect(error).toHaveTextContent('请求 ID：terms-401');
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
    expect(usePilotAuthStore.getState()).toMatchObject({ status: 'anonymous', session: null });
    expect(usePilotProjectContextStore.getState()).toMatchObject({
      status: 'idle',
      activeProjectId: null,
    });
  });

  it.each([
    [403, 'pilot-terms-documents-forbidden'],
    [404, 'pilot-terms-documents-not-found'],
    [422, 'pilot-terms-documents-validation-error'],
    [500, 'pilot-terms-documents-service-error'],
  ])('maps HTTP %s to a safe state with Request ID', async (status, testId) => {
    vi.spyOn(pilotControlApi, 'listTermsDocuments').mockRejectedValue(
      new PilotControlApiError('SAFE_CODE', SENSITIVE_MESSAGE, status, `terms-${status}`),
    );

    renderPage();

    const error = await screen.findByTestId(testId);
    expect(error).toHaveTextContent(`请求 ID：terms-${status}`);
    expect(error).not.toHaveTextContent(SENSITIVE_MESSAGE);
  });

  it('fails closed for a non-Platform Session before any Terms API call', async () => {
    usePilotAuthStore.setState({
      status: 'authenticated',
      session: channelSession,
      error: null,
      requestId: null,
    });
    const list = vi.spyOn(pilotControlApi, 'listTermsDocuments').mockResolvedValue([]);

    renderPage();

    expect(await screen.findByTestId('pilot-terms-permission-denied')).toHaveTextContent(
      '仅 Platform 管理员可管理 Terms',
    );
    expect(list).not.toHaveBeenCalled();
  });

  it('states the legal/content and product boundaries without consent or publish automation', async () => {
    mockReadyDirectory([]);

    renderPage();
    await screen.findByTestId('pilot-terms-versions-empty');

    expect(screen.getByText(/仅录入业务或法务提供的正文/)).toBeInTheDocument();
    expect(screen.getByText(/不会自动发布/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /批量发布|自动发布|导出 Consent/ }),
    ).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('tokenDigest');
  });
});
