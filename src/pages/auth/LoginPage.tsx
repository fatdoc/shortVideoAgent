import {
  ArrowRightOutlined,
  MailOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { Alert, Button, Form, Input, Select, type InputRef } from 'antd';
import { useRef, useState } from 'react';
import { pilotRuntime } from '../../config/pilotRuntime';
import { useAuthStore } from '../../stores/authStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';
import { PILOT_LOCAL_ACCOUNT_CHOICES } from './pilotLocalAccounts';
import '../../design/d2-auth.css';

interface LoginValues {
  account: string;
  password: string;
}

interface LoginPageProps {
  onRegister?: () => void;
}

const entrySteps = ['资料建档', '素材归集', '脚本确认', '分镜成片', '发布投放', '线索跟进'];

function AuthProcessRail() {
  return (
    <section className="d2-auth-process" aria-label="工作流概览">
      <ol>
        {entrySteps.map((step, index) => (
          <li key={step}>
            <span>{index + 1}</span>
            <strong>{step}</strong>
          </li>
        ))}
      </ol>
      <p>登录后按权限进入对应工作区；无可用资料或服务未接通时，页面会显示空态或阻断原因。</p>
    </section>
  );
}

function DemoLoginPage() {
  const [form] = Form.useForm<LoginValues>();
  const login = useAuthStore((state) => state.login);
  const storeError = useAuthStore((state) => state.error);
  const clearStoreError = useAuthStore((state) => state.clearError);
  const [submitting, setSubmitting] = useState(false);

  const clearError = () => clearStoreError();

  const submitLogin = (values: LoginValues) => {
    clearError();
    setSubmitting(true);
    login({
      loginName: values.account.trim(),
      password: values.password,
    });
    setSubmitting(false);
  };

  return (
    <main className="d2-auth-page va-auth-page" data-testid="login-page">
      <section className="d2-auth-shell va-auth-shell">
        <div className="d2-auth-content">
          <section className="d2-auth-intro" aria-label="入口说明">
            <h1>从资料到获客线索</h1>
            <p>受控工作台入口只处理登录、会话恢复和跳转；业务内容在登录后按真实权限加载。</p>
            <AuthProcessRail />
          </section>

          <section className="d2-auth-login-panel">
            <div className="d2-auth-login-heading">
              <h2>登录工作台</h2>
              <p>使用已配置的账号进入可访问空间</p>
            </div>

            {storeError ? (
              <Alert
                className="d2-auth-error"
                type="error"
                showIcon
                closable
                message={storeError}
                onClose={clearError}
                data-testid="login-error"
              />
            ) : null}

            <Form<LoginValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              initialValues={{ account: 'tenant' }}
              onFinish={submitLogin}
              onValuesChange={clearError}
            >
              <Form.Item
                label="邮箱"
                name="account"
                rules={[{ required: true, message: '请输入邮箱' }]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  autoComplete="username"
                  data-testid="login-account"
                />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  size="large"
                  prefix={<LockOutlined />}
                  autoComplete="current-password"
                  data-testid="login-password"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={submitting}
                data-testid="login-submit"
              >
                登录并进入工作台 <ArrowRightOutlined />
              </Button>
            </Form>
            <p className="d2-auth-legal">登录或注册即代表你同意当前发布的《用户须知》。</p>
          </section>
        </div>
      </section>
    </main>
  );
}

function PilotLoginPage({ onRegister }: LoginPageProps) {
  const [form] = Form.useForm<LoginValues>();
  const passwordInput = useRef<InputRef>(null);
  const localAccounts = import.meta.env.DEV ? PILOT_LOCAL_ACCOUNT_CHOICES : [];
  const login = usePilotAuthStore((state) => state.login);
  const status = usePilotAuthStore((state) => state.status);
  const storeError = usePilotAuthStore((state) => state.error);
  const requestId = usePilotAuthStore((state) => state.requestId);
  const clearError = usePilotAuthStore((state) => state.clearError);

  const submitLogin = async (values: LoginValues) => {
    clearError();
    await login({ email: values.account.trim(), password: values.password });
  };

  const selectLocalAccount = (email: string) => {
    clearError();
    form.setFieldValue('account', email);
    passwordInput.current?.focus();
  };

  return (
    <main className="d2-auth-page va-auth-page" data-testid="pilot-login-page">
      <section className="d2-auth-shell va-auth-shell d2-auth-shell--pilot">
        <div className="d2-auth-pilot-content">
          <section className="d2-auth-intro d2-auth-pilot-intro">
            <h1>受控真实试点</h1>
            <p>此入口仅接受已加入白名单的账号。身份、组织和权限由服务端验证。</p>
            <ul>
              <li>注册需完成条款确认、邮箱验证或有效邀请校验</li>
              <li>服务异常会明确提示，不会切换到替代数据</li>
              <li>浏览器不会展示密码或会话凭据</li>
            </ul>
          </section>

          <section className="d2-auth-login-panel">
            <div className="d2-auth-login-heading">
              <h2>登录工作台</h2>
              <p>使用已配置的账号进入可访问空间</p>
            </div>

            {storeError ? (
              <Alert
                className="d2-auth-error"
                type="error"
                showIcon
                closable
                message={storeError}
                description={requestId ? `请求 ID：${requestId}` : undefined}
                onClose={clearError}
                data-testid="pilot-login-error"
              />
            ) : null}

            <Form<LoginValues>
              form={form}
              layout="vertical"
              requiredMark={false}
              onFinish={submitLogin}
              onValuesChange={clearError}
            >
              {localAccounts.length > 0 ? (
                <Form.Item label="快捷账号" extra="仅填充邮箱，实际权限由服务端账号决定">
                  <Select
                    id="pilot-local-account"
                    aria-label="快捷账号"
                    size="large"
                    placeholder="选择本地开发账号"
                    options={localAccounts.map((account) => ({
                      label: account.label,
                      value: account.email,
                    }))}
                    onChange={selectLocalAccount}
                    data-testid="pilot-local-account-select"
                  />
                </Form.Item>
              ) : null}
              <Form.Item
                label="企业邮箱"
                name="account"
                rules={[
                  { required: true, message: '请输入企业邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' },
                ]}
              >
                <Input
                  size="large"
                  prefix={<MailOutlined />}
                  autoComplete="username"
                  data-testid="pilot-login-email"
                />
              </Form.Item>
              <Form.Item
                label="密码"
                name="password"
                rules={[{ required: true, message: '请输入密码' }]}
              >
                <Input.Password
                  ref={passwordInput}
                  size="large"
                  prefix={<LockOutlined />}
                  autoComplete="current-password"
                  data-testid="pilot-login-password"
                />
              </Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                block
                loading={status === 'authenticating'}
                data-testid="pilot-login-submit"
              >
                登录真实试点 <ArrowRightOutlined />
              </Button>
              {onRegister ? (
                <Button type="link" block onClick={onRegister} data-testid="pilot-register-entry">
                  创建账号
                </Button>
              ) : null}
            </Form>
          </section>
        </div>
      </section>
    </main>
  );
}

export function LoginPage({ onRegister }: LoginPageProps = {}) {
  return pilotRuntime.mode === 'pilot' ? (
    <PilotLoginPage onRegister={onRegister} />
  ) : (
    <DemoLoginPage />
  );
}
