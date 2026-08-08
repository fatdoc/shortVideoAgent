import {
  ArrowRightOutlined,
  CheckCircleFilled,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Checkbox, Form, Input, Skeleton, Tag, Typography } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PublicRegistrationApiError,
  publicRegistrationApi,
  type PublicInvitationPreview,
  type PublicRegistrationCompletion,
  type PublicRegistrationInput,
  type PublicRegistrationTerms,
} from '../../services/publicRegistrationApi';
import '../../design/d2-auth.css';

type RegistrationApi = Pick<
  typeof publicRegistrationApi,
  'loadCurrentTerms' | 'previewInvitation' | 'register'
>;

export interface EmailVerificationEvidenceProvider {
  createEvidence(email: string): Promise<string>;
}

export interface RegistrationPageProps {
  api?: RegistrationApi;
  emailVerification?: EmailVerificationEvidenceProvider;
  invitationToken?: string | null;
  onLogin?: () => void;
}

interface RegistrationValues {
  email: string;
  displayName: string;
  tenantDisplayName?: string;
  password: string;
  passwordConfirm: string;
  accepted: boolean;
}

type LoadState = 'loading' | 'ready' | 'error';

interface PageError {
  message: string;
  requestId: string | null;
  retryAfterSeconds: number | null;
}

const unavailableEmailVerification: EmailVerificationEvidenceProvider = {
  async createEvidence() {
    throw new PublicRegistrationApiError(
      'EMAIL_VERIFICATION_UNAVAILABLE',
      '邮箱验证服务暂不可用。',
      503,
      null,
    );
  },
};

const invitationLabels: Record<PublicInvitationPreview['invitationType'], string> = {
  PLATFORM: '平台邀请注册',
  CHANNEL: '渠道邀请注册',
  TENANT_MEMBER: '企业成员邀请',
};

const registrationPathLabels: Record<
  PublicRegistrationCompletion['registration']['registrationPath'],
  string
> = {
  DIRECT: '直接注册',
  PLATFORM_INVITATION: '平台邀请注册',
  CHANNEL_INVITATION: '渠道邀请注册',
  TENANT_MEMBER_INVITATION: '企业成员邀请注册',
};

function pageError(error: unknown): PageError {
  if (!(error instanceof PublicRegistrationApiError)) {
    return { message: '注册服务暂不可用，请稍后重试。', requestId: null, retryAfterSeconds: null };
  }

  const messages: Record<string, string> = {
    TERMS_NOT_AVAILABLE: '用户须知暂未发布',
    INVITATION_UNAVAILABLE: '当前邀请不可用',
    INVITATION_RATE_LIMITED: '邀请校验请求过多，请稍后重试',
    REGISTRATION_RATE_LIMITED: '注册请求过多，请稍后重试',
    REGISTRATION_CONFLICT: '无法使用当前身份完成注册',
    REGISTRATION_IDEMPOTENCY_CONFLICT: '注册信息已变化，请重新提交',
    TERMS_VERSION_STALE: '用户须知已更新，请重新阅读并确认。',
    EMAIL_VERIFICATION_UNAVAILABLE: '邮箱验证服务暂不可用',
    EMAIL_VERIFICATION_FAILED: '邮箱验证失败，请重新完成验证',
    CONTROL_API_UNREACHABLE: '无法连接注册服务，请检查服务状态后重试',
    PILOT_CONFIGURATION_ERROR: '当前注册运行配置不可用',
    INVALID_API_RESPONSE: '注册服务返回了无效响应，请联系管理员',
  };

  return {
    message: messages[error.code] ?? '注册服务暂不可用，请稍后重试。',
    requestId: error.requestId,
    retryAfterSeconds: error.retryAfterSeconds,
  };
}

function createIdempotencyKey(): string {
  return globalThis.crypto.randomUUID();
}

export function RegistrationPage({
  api = publicRegistrationApi,
  emailVerification = unavailableEmailVerification,
  invitationToken = null,
  onLogin,
}: RegistrationPageProps) {
  const [form] = Form.useForm<RegistrationValues>();
  const [termsState, setTermsState] = useState<LoadState>('loading');
  const [terms, setTerms] = useState<PublicRegistrationTerms | null>(null);
  const [termsError, setTermsError] = useState<PageError | null>(null);
  const [activeInvitationToken, setActiveInvitationToken] = useState(invitationToken);
  const [invitationState, setInvitationState] = useState<LoadState>(
    invitationToken ? 'loading' : 'ready',
  );
  const [invitation, setInvitation] = useState<PublicInvitationPreview | null>(null);
  const [invitationError, setInvitationError] = useState<PageError | null>(null);
  const [submitError, setSubmitError] = useState<PageError | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completion, setCompletion] = useState<PublicRegistrationCompletion | null>(null);
  const idempotencyKey = useRef<string | null>(null);

  const loadTerms = useCallback(async () => {
    setTermsState('loading');
    setTermsError(null);
    try {
      const current = await api.loadCurrentTerms();
      setTerms(current);
      setTermsState('ready');
      return current;
    } catch (error) {
      setTerms(null);
      setTermsError(pageError(error));
      setTermsState('error');
      return null;
    }
  }, [api]);

  useEffect(() => {
    void loadTerms();
  }, [loadTerms]);

  useEffect(() => {
    if (!activeInvitationToken) {
      setInvitation(null);
      setInvitationError(null);
      setInvitationState('ready');
      return;
    }

    let active = true;
    setInvitationState('loading');
    setInvitationError(null);
    void api
      .previewInvitation(activeInvitationToken)
      .then((preview) => {
        if (!active) return;
        setInvitation(preview);
        setInvitationState('ready');
        if (preview.invitationType === 'TENANT_MEMBER') {
          form.setFieldValue('tenantDisplayName', undefined);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        setInvitation(null);
        setInvitationError(pageError(error));
        setInvitationState('error');
      });

    return () => {
      active = false;
    };
  }, [activeInvitationToken, api, form]);

  const resetIntent = () => {
    idempotencyKey.current = null;
    setSubmitError(null);
  };

  const useDirectRegistration = () => {
    setActiveInvitationToken(null);
    setInvitation(null);
    setInvitationError(null);
    setInvitationState('ready');
    resetIntent();
  };

  const submitRegistration = async (values: RegistrationValues) => {
    if (!terms || termsState !== 'ready' || invitationState !== 'ready' || invitationError) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      const email = values.email.trim().toLowerCase();
      const emailVerificationToken = await emailVerification.createEvidence(email);
      const currentIdempotencyKey = idempotencyKey.current ?? createIdempotencyKey();
      idempotencyKey.current = currentIdempotencyKey;
      const createsTenant = invitation?.invitationType !== 'TENANT_MEMBER';
      const input: PublicRegistrationInput = {
        email,
        password: values.password,
        displayName: values.displayName.trim(),
        ...(createsTenant ? { tenantDisplayName: values.tenantDisplayName?.trim() } : {}),
        ...(activeInvitationToken ? { invitationToken: activeInvitationToken } : {}),
        termsVersionId: terms.termsVersionId,
        locale: terms.locale,
        accepted: values.accepted === true,
        emailVerificationToken,
        idempotencyKey: currentIdempotencyKey,
      };
      const result = await api.register(input);
      setCompletion(result);
    } catch (error) {
      if (error instanceof PublicRegistrationApiError && error.code === 'TERMS_VERSION_STALE') {
        form.setFieldsValue({ accepted: false, password: '', passwordConfirm: '' });
        idempotencyKey.current = null;
        const current = await loadTerms();
        if (current) setSubmitError(pageError(error));
      } else {
        setSubmitError(pageError(error));
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (completion) {
    return (
      <main className="d2-auth-page" data-testid="registration-success-page">
        <section className="d2-pilot-status-card d2-registration-success">
          <CheckCircleFilled className="d2-registration-success-icon" />
          <Typography.Title level={2}>注册申请已完成</Typography.Title>
          <Typography.Paragraph type="secondary">
            {registrationPathLabels[completion.registration.registrationPath]}
            已安全完成。系统不会自动登录，请使用刚注册的账号进入现有登录入口。
          </Typography.Paragraph>
          {completion.replayed ? <Alert type="info" showIcon message="注册请求已安全恢复" /> : null}
          <Button type="primary" size="large" block onClick={onLogin}>
            前往登录 <ArrowRightOutlined />
          </Button>
        </section>
      </main>
    );
  }

  const isTenantMemberInvitation = invitation?.invitationType === 'TENANT_MEMBER';
  const submitBlocked =
    termsState !== 'ready' || invitationState !== 'ready' || Boolean(invitationError) || submitting;

  return (
    <main className="d2-auth-page" data-testid="registration-page">
      <section className="d2-auth-shell d2-auth-shell--registration">
        <header className="d2-auth-productbar">
          <div className="d2-auth-product">
            <span className="d2-auth-product-mark">VA</span>
            <span>
              <strong>短视频营销 Agent</strong>
              <small>受控注册入口</small>
            </span>
          </div>
          <Tag color="processing">Pilot 注册准备态</Tag>
        </header>

        <div className="d2-registration-content">
          <section className="d2-registration-context">
            <SafetyCertificateOutlined />
            <Typography.Title level={2}>创建受控试点账号</Typography.Title>
            <Typography.Paragraph>
              注册来源、组织归属和角色由服务端验证。注册成功后不会自动登录，也不会在浏览器保存验证凭据或会话
              Token。
            </Typography.Paragraph>

            <div className="d2-registration-context-card">
              <strong>注册来源</strong>
              {invitationState === 'loading' ? (
                <Skeleton
                  active
                  paragraph={{ rows: 2 }}
                  data-testid="registration-invitation-loading"
                />
              ) : invitationError ? (
                <Alert
                  type="error"
                  showIcon
                  message={invitationError.message}
                  description={
                    <>
                      {invitationError.retryAfterSeconds
                        ? `请在 ${invitationError.retryAfterSeconds} 秒后重试。`
                        : '无法确认邀请来源，当前不会提交注册。'}
                      <Button type="link" onClick={useDirectRegistration}>
                        改为直接注册
                      </Button>
                    </>
                  }
                />
              ) : invitation ? (
                <div className="d2-registration-invitation">
                  <Tag color="blue">{invitationLabels[invitation.invitationType]}</Tag>
                  <span>剩余 {invitation.remainingUses} 次</span>
                  <span>有效期至 {new Date(invitation.expiresAt).toLocaleDateString('zh-CN')}</span>
                </div>
              ) : (
                <Tag>直接注册</Tag>
              )}
            </div>

            <div className="d2-registration-context-card">
              <strong>当前用户须知</strong>
              {termsState === 'loading' ? (
                <div data-testid="registration-terms-loading">
                  <Skeleton active paragraph={{ rows: 4 }} />
                </div>
              ) : termsError ? (
                <Alert
                  type="error"
                  showIcon
                  message={termsError.message}
                  description={
                    <>
                      {termsError.requestId ? <span>请求 ID：{termsError.requestId}</span> : null}
                      <Button type="link" onClick={() => void loadTerms()}>
                        重新加载
                      </Button>
                    </>
                  }
                />
              ) : terms ? (
                <div className="d2-registration-terms">
                  <div>
                    <strong>
                      {terms.title} · {terms.versionLabel}
                    </strong>
                    <Tag color={terms.mustReaccept ? 'gold' : 'default'}>
                      {terms.mustReaccept ? '变更后需重新确认' : '当前版本'}
                    </Tag>
                  </div>
                  <Typography.Paragraph>{terms.content}</Typography.Paragraph>
                </div>
              ) : null}
            </div>
          </section>

          <section className="d2-auth-login-panel d2-registration-form-panel">
            <div className="d2-auth-login-heading">
              <Typography.Title level={2}>填写注册信息</Typography.Title>
              <Typography.Text type="secondary">所有字段只用于本次受控注册请求</Typography.Text>
            </div>

            {submitError ? (
              <Alert
                className="d2-auth-error"
                type="error"
                showIcon
                message={submitError.message}
                description={
                  <>
                    {submitError.retryAfterSeconds ? (
                      <span>请在 {submitError.retryAfterSeconds} 秒后重试。</span>
                    ) : null}
                    {submitError.requestId ? <span>请求 ID：{submitError.requestId}</span> : null}
                  </>
                }
                data-testid="registration-error"
              />
            ) : null}

            <Form<RegistrationValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ accepted: false }}
              onFinish={submitRegistration}
              onValuesChange={resetIntent}
            >
              <Form.Item
                label="企业邮箱"
                name="email"
                rules={[
                  {
                    validator: (_, value: unknown) =>
                      typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
                        ? Promise.resolve()
                        : Promise.reject(new Error('请输入有效的邮箱地址')),
                  },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  autoComplete="email"
                  data-testid="registration-email"
                />
              </Form.Item>

              <Form.Item
                label="姓名"
                name="displayName"
                rules={[
                  { required: true, whitespace: true, message: '请输入姓名' },
                  { max: 200, message: '姓名不能超过 200 个字符' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<UserOutlined />}
                  autoComplete="name"
                  data-testid="registration-display-name"
                />
              </Form.Item>

              {!isTenantMemberInvitation ? (
                <Form.Item
                  label="企业 / 团队名称"
                  name="tenantDisplayName"
                  rules={[
                    { required: true, whitespace: true, message: '请输入企业或团队名称' },
                    { max: 300, message: '企业或团队名称不能超过 300 个字符' },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<TeamOutlined />}
                    autoComplete="organization"
                    data-testid="registration-tenant-name"
                  />
                </Form.Item>
              ) : null}

              <Form.Item
                label="密码"
                name="password"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 12, message: '密码至少需要 12 个字符' },
                  { max: 128, message: '密码不能超过 128 个字符' },
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  autoComplete="new-password"
                  data-testid="registration-password"
                />
              </Form.Item>

              <Form.Item
                label="确认密码"
                name="passwordConfirm"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请再次输入密码' },
                  ({ getFieldValue }) => ({
                    validator: (_, value: unknown) =>
                      !value || getFieldValue('password') === value
                        ? Promise.resolve()
                        : Promise.reject(new Error('两次输入的密码不一致')),
                  }),
                ]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  autoComplete="new-password"
                  data-testid="registration-password-confirm"
                />
              </Form.Item>

              <Form.Item
                name="accepted"
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value: unknown) =>
                      value === true
                        ? Promise.resolve()
                        : Promise.reject(new Error('请阅读并接受当前用户须知')),
                  },
                ]}
              >
                <Checkbox data-testid="registration-terms-accepted">
                  我已阅读并接受当前发布的用户须知版本
                </Checkbox>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting}
                disabled={submitBlocked}
                data-testid="registration-submit"
              >
                提交注册申请 <ArrowRightOutlined />
              </Button>
            </Form>

            <p className="d2-auth-legal">
              当前入口不会自动登录。正式用户须知或邮箱验证服务不可用时，注册将明确停止。
            </p>
          </section>
        </div>
      </section>
    </main>
  );
}
