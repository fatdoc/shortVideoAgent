import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  PublicRegistrationApiError,
  type PublicInvitationPreview,
  type PublicRegistrationCompletion,
  type PublicRegistrationTerms,
} from '../../services/publicRegistrationApi';
import { RegistrationPage } from './RegistrationPage';

const terms: PublicRegistrationTerms = {
  termsDocumentId: '11111111-1111-4111-8111-111111111111',
  termsVersionId: '22222222-2222-4222-8222-222222222222',
  documentCode: 'registration-notice',
  title: '用户注册须知',
  versionLabel: '2026-08-08',
  locale: 'zh-CN',
  content: '这是经过发布的正式用户注册须知。',
  contentDigest: 'a'.repeat(64),
  effectiveAt: '2026-08-08T00:00:00.000Z',
  mustReaccept: true,
};

const invitation: PublicInvitationPreview = {
  invitationType: 'CHANNEL',
  targetRoleCode: null,
  targetOrganizationId: null,
  attributionChannelId: '33333333-3333-4333-8333-333333333333',
  expiresAt: '2026-08-15T00:00:00.000Z',
  remainingUses: 7,
};

const completion: PublicRegistrationCompletion = {
  registration: {
    registrationId: '44444444-4444-4444-8444-444444444444',
    userId: '55555555-5555-4555-8555-555555555555',
    tenantId: '66666666-6666-4666-8666-666666666666',
    membershipId: '77777777-7777-4777-8777-777777777777',
    registrationPath: 'DIRECT',
    completedAt: '2026-08-08T01:00:00.000Z',
  },
  replayed: false,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, resolve, reject };
}

function api(
  overrides: Partial<{
    loadCurrentTerms: () => Promise<PublicRegistrationTerms>;
    previewInvitation: (token: string) => Promise<PublicInvitationPreview>;
    register: (
      input: Parameters<RegistrationPageApi['register']>[0],
    ) => Promise<PublicRegistrationCompletion>;
  }> = {},
): RegistrationPageApi {
  return {
    loadCurrentTerms: vi.fn().mockResolvedValue(terms),
    previewInvitation: vi.fn().mockResolvedValue(invitation),
    register: vi.fn().mockResolvedValue(completion),
    ...overrides,
  };
}

type RegistrationPageApi = {
  loadCurrentTerms: () => Promise<PublicRegistrationTerms>;
  previewInvitation: (token: string) => Promise<PublicInvitationPreview>;
  register: (input: {
    email: string;
    password: string;
    displayName: string;
    tenantDisplayName?: string;
    invitationToken?: string;
    termsVersionId: string;
    locale: string;
    accepted: boolean;
    emailVerificationToken: string;
    idempotencyKey: string;
  }) => Promise<PublicRegistrationCompletion>;
};

const evidence = {
  createEvidence: vi.fn().mockResolvedValue('verified-email-evidence'),
};

function fillDirectForm() {
  fireEvent.change(screen.getByTestId('registration-email'), {
    target: { value: ' owner@example.com ' },
  });
  fireEvent.change(screen.getByTestId('registration-display-name'), {
    target: { value: ' Owner ' },
  });
  fireEvent.change(screen.getByTestId('registration-tenant-name'), {
    target: { value: ' Studio ' },
  });
  fireEvent.change(screen.getByTestId('registration-password'), {
    target: { value: 'correct-horse-123' },
  });
  fireEvent.change(screen.getByTestId('registration-password-confirm'), {
    target: { value: 'correct-horse-123' },
  });
  fireEvent.click(screen.getByTestId('registration-terms-accepted'));
}

describe('RegistrationPage', () => {
  it('loads only published Terms and keeps submission disabled while Terms are loading', async () => {
    const loading = deferred<PublicRegistrationTerms>();
    const client = api({ loadCurrentTerms: vi.fn(() => loading.promise) });
    render(<RegistrationPage api={client} emailVerification={evidence} />);

    expect(screen.getByTestId('registration-terms-loading')).toBeInTheDocument();
    expect(screen.getByTestId('registration-submit')).toBeDisabled();

    loading.resolve(terms);
    expect(await screen.findByText(terms.content)).toBeInTheDocument();
    expect(screen.getByText(`${terms.title} · ${terms.versionLabel}`)).toBeInTheDocument();
  });

  it('fails closed when current Terms are unavailable', async () => {
    const client = api({
      loadCurrentTerms: vi
        .fn()
        .mockRejectedValue(
          new PublicRegistrationApiError(
            'TERMS_NOT_AVAILABLE',
            '当前用户须知暂不可用。',
            404,
            'req-terms',
          ),
        ),
    });
    render(<RegistrationPage api={client} emailVerification={evidence} />);

    expect(await screen.findByText('用户须知暂未发布')).toBeInTheDocument();
    expect(screen.getByText('请求 ID：req-terms')).toBeInTheDocument();
    expect(screen.getByTestId('registration-submit')).toBeDisabled();
  });

  it('previews an invitation without rendering its token and requires an explicit switch when unavailable', async () => {
    const client = api({
      previewInvitation: vi
        .fn()
        .mockRejectedValue(
          new PublicRegistrationApiError('INVITATION_UNAVAILABLE', '邀请不可用。', 404, null),
        ),
    });
    const { container } = render(
      <RegistrationPage
        api={client}
        emailVerification={evidence}
        invitationToken="secret-invitation-token"
      />,
    );

    expect(await screen.findByText('当前邀请不可用')).toBeInTheDocument();
    expect(container.textContent).not.toContain('secret-invitation-token');
    expect(screen.getByTestId('registration-submit')).toBeDisabled();

    await userEvent.click(screen.getByRole('button', { name: '改为直接注册' }));
    expect(screen.getByText('直接注册')).toBeInTheDocument();
    expect(screen.getByTestId('registration-submit')).not.toBeDisabled();
  });

  it('validates fields and explicit Terms acceptance before requesting evidence or registration', async () => {
    const client = api();
    const evidencePort = { createEvidence: vi.fn().mockResolvedValue('evidence') };
    render(<RegistrationPage api={client} emailVerification={evidencePort} />);
    await screen.findByText(terms.content);

    fireEvent.click(screen.getByTestId('registration-submit'));

    expect(await screen.findByText('请输入有效的邮箱地址')).toBeInTheDocument();
    expect(screen.getByText('请阅读并接受当前用户须知')).toBeInTheDocument();
    expect(evidencePort.createEvidence).not.toHaveBeenCalled();
    expect(client.register).not.toHaveBeenCalled();
  });

  it('submits one strict direct-registration intent, does not auto-login, and links to login after success', async () => {
    const user = userEvent.setup();
    const client = api();
    const evidencePort = { createEvidence: vi.fn().mockResolvedValue('verified-email-evidence') };
    const onLogin = vi.fn();
    render(<RegistrationPage api={client} emailVerification={evidencePort} onLogin={onLogin} />);
    await screen.findByText(terms.content);
    fillDirectForm();
    await user.click(screen.getByTestId('registration-submit'));

    expect(await screen.findByRole('heading', { name: '注册申请已完成' })).toBeInTheDocument();
    expect(onLogin).not.toHaveBeenCalled();
    expect(evidencePort.createEvidence).toHaveBeenCalledWith('owner@example.com');
    expect(client.register).toHaveBeenCalledTimes(1);
    expect(client.register).toHaveBeenCalledWith({
      email: 'owner@example.com',
      password: 'correct-horse-123',
      displayName: 'Owner',
      tenantDisplayName: 'Studio',
      termsVersionId: terms.termsVersionId,
      locale: terms.locale,
      accepted: true,
      emailVerificationToken: 'verified-email-evidence',
      idempotencyKey: expect.any(String),
    });

    await user.click(screen.getByRole('button', { name: /前往登录/ }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('blocks duplicate clicks and treats a replay as the same successful registration', async () => {
    const user = userEvent.setup();
    const pending = deferred<PublicRegistrationCompletion>();
    const client = api({ register: vi.fn(() => pending.promise) });
    render(<RegistrationPage api={client} emailVerification={evidence} />);
    await screen.findByText(terms.content);
    fillDirectForm();

    const submit = screen.getByTestId('registration-submit');
    await user.click(submit);
    fireEvent.click(submit);
    expect(client.register).toHaveBeenCalledTimes(1);
    expect(submit).toBeDisabled();

    await act(async () => {
      pending.resolve({ ...completion, replayed: true });
    });
    expect(await screen.findByText('注册请求已安全恢复')).toBeInTheDocument();
  });

  it('reloads stale Terms, clears acceptance, and preserves non-sensitive form fields', async () => {
    const user = userEvent.setup();
    const updatedTerms = {
      ...terms,
      termsVersionId: '88888888-8888-4888-8888-888888888888',
      versionLabel: '2026-08-09',
      content: '更新后的正式用户注册须知。',
    };
    const loadCurrentTerms = vi
      .fn()
      .mockResolvedValueOnce(terms)
      .mockResolvedValueOnce(updatedTerms);
    const client = api({
      loadCurrentTerms,
      register: vi
        .fn()
        .mockRejectedValue(
          new PublicRegistrationApiError(
            'TERMS_VERSION_STALE',
            '用户须知已更新，请重新阅读并确认。',
            409,
            'req-stale',
          ),
        ),
    });
    render(<RegistrationPage api={client} emailVerification={evidence} />);
    await screen.findByText(terms.content);
    fillDirectForm();
    await user.click(screen.getByTestId('registration-submit'));

    expect(await screen.findByText(updatedTerms.content)).toBeInTheDocument();
    expect(screen.getByText('用户须知已更新，请重新阅读并确认。')).toBeInTheDocument();
    expect(screen.getByTestId('registration-terms-accepted')).not.toBeChecked();
    expect(screen.getByTestId('registration-email')).toHaveValue(' owner@example.com ');
    expect(loadCurrentTerms).toHaveBeenCalledTimes(2);
  });

  it('submits a Tenant member invitation without allowing a client-supplied Tenant name', async () => {
    const user = userEvent.setup();
    const memberInvitation: PublicInvitationPreview = {
      ...invitation,
      invitationType: 'TENANT_MEMBER',
      targetRoleCode: 'content_operator',
      targetOrganizationId: '99999999-9999-4999-8999-999999999999',
      attributionChannelId: null,
    };
    const client = api({
      previewInvitation: vi.fn().mockResolvedValue(memberInvitation),
      register: vi.fn().mockResolvedValue({
        ...completion,
        registration: {
          ...completion.registration,
          registrationPath: 'TENANT_MEMBER_INVITATION',
        },
      }),
    });
    render(
      <RegistrationPage
        api={client}
        emailVerification={evidence}
        invitationToken="member-invitation-secret"
      />,
    );

    expect(await screen.findByText('企业成员邀请')).toBeInTheDocument();
    expect(screen.queryByTestId('registration-tenant-name')).not.toBeInTheDocument();
    fireEvent.change(screen.getByTestId('registration-email'), {
      target: { value: 'member@example.com' },
    });
    fireEvent.change(screen.getByTestId('registration-display-name'), {
      target: { value: 'Member' },
    });
    fireEvent.change(screen.getByTestId('registration-password'), {
      target: { value: 'correct-horse-123' },
    });
    fireEvent.change(screen.getByTestId('registration-password-confirm'), {
      target: { value: 'correct-horse-123' },
    });
    fireEvent.click(screen.getByTestId('registration-terms-accepted'));
    await user.click(screen.getByTestId('registration-submit'));

    await screen.findByRole('heading', { name: '注册申请已完成' });
    expect(client.register).toHaveBeenCalledWith(
      expect.objectContaining({ invitationToken: 'member-invitation-secret' }),
    );
    expect(client.register).not.toHaveBeenCalledWith(
      expect.objectContaining({ tenantDisplayName: expect.anything() }),
    );
  });

  it('uses an unavailable production Evidence provider by default and never fabricates verification', async () => {
    const user = userEvent.setup();
    const client = api();
    render(<RegistrationPage api={client} />);
    await screen.findByText(terms.content);
    fillDirectForm();
    await user.click(screen.getByTestId('registration-submit'));

    expect(await screen.findByText('邮箱验证服务暂不可用')).toBeInTheDocument();
    expect(client.register).not.toHaveBeenCalled();
  });

  it('reuses one idempotency key for an unchanged retry and rotates it after facts change', async () => {
    const user = userEvent.setup();
    const client = api({
      register: vi
        .fn()
        .mockRejectedValue(
          new PublicRegistrationApiError(
            'REGISTRATION_RATE_LIMITED',
            '注册请求过多，请稍后重试。',
            429,
            'req-rate',
            2,
          ),
        ),
    });
    render(<RegistrationPage api={client} emailVerification={evidence} />);
    await screen.findByText(terms.content);
    fillDirectForm();

    await user.click(screen.getByTestId('registration-submit'));
    expect(await screen.findByText('请在 2 秒后重试。')).toBeInTheDocument();
    const firstKey = vi.mocked(client.register).mock.calls[0]?.[0].idempotencyKey;

    await user.click(screen.getByTestId('registration-submit'));
    const retryKey = vi.mocked(client.register).mock.calls[1]?.[0].idempotencyKey;
    expect(retryKey).toBe(firstKey);

    fireEvent.change(screen.getByTestId('registration-display-name'), {
      target: { value: ' Owner Updated ' },
    });
    await user.click(screen.getByTestId('registration-submit'));
    const changedKey = vi.mocked(client.register).mock.calls[2]?.[0].idempotencyKey;
    expect(changedKey).not.toBe(firstKey);
  });

  it.each([
    ['REGISTRATION_CONFLICT', '无法使用当前身份完成注册。', '无法使用当前身份完成注册'],
    ['EMAIL_VERIFICATION_UNAVAILABLE', '邮箱验证服务暂不可用。', '邮箱验证服务暂不可用'],
  ])('shows a safe fail-closed error for %s', async (code, message, expected) => {
    const user = userEvent.setup();
    const client = api({
      register: vi
        .fn()
        .mockRejectedValue(
          new PublicRegistrationApiError(
            code,
            message,
            code === 'REGISTRATION_CONFLICT' ? 409 : 503,
            'req-safe',
          ),
        ),
    });
    render(<RegistrationPage api={client} emailVerification={evidence} />);
    await screen.findByText(terms.content);
    fillDirectForm();
    await user.click(screen.getByTestId('registration-submit'));

    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.getByText('请求 ID：req-safe')).toBeInTheDocument();
    expect(screen.queryByText(/邮箱已存在|账号已停用/)).not.toBeInTheDocument();
  });
});
