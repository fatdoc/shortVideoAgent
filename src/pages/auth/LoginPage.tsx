import {
  ArrowRightOutlined,
  CheckCircleFilled,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Alert, Button, Form, Input, Tag, Typography } from 'antd';
import { useState } from 'react';
import haidilaoLogo from '../../components/brand/assets/haidilao-logo.png';
import { DEMO_IDENTITIES, type DemoIdentity } from '../../domain/demoIdentity';
import { DEMO_AUTH_NOTICE, DEMO_AUTH_PASSWORD } from '../../services/demoAuth';
import { useAuthStore } from '../../stores/authStore';
import '../../design/d2-auth.css';

interface LoginValues {
  account: string;
  password: string;
}

const identityTone = {
  platform: 'blue',
  channel: 'gold',
  tenant: 'red',
  production: 'cyan',
} as const;

export function LoginPage() {
  const [form] = Form.useForm<LoginValues>();
  const login = useAuthStore((state) => state.login);
  const storeError = useAuthStore((state) => state.error);
  const clearStoreError = useAuthStore((state) => state.clearError);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState('tenant');

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

  const loginAsIdentity = (identity: DemoIdentity) => {
    setSelectedAccount(identity.loginName);
    form.setFieldsValue({
      account: identity.loginName,
      password: DEMO_AUTH_PASSWORD,
    });
    submitLogin({
      account: identity.loginName,
      password: DEMO_AUTH_PASSWORD,
    });
  };

  return (
    <main className="d2-auth-page" data-testid="login-page">
      <section className="d2-auth-shell">
        <header className="d2-auth-productbar">
          <div className="d2-auth-product">
            <span className="d2-auth-product-mark">VA</span>
            <span>
              <strong>短视频营销 Agent</strong>
              <small>品牌事实驱动的内容生产平台</small>
            </span>
          </div>
          <Tag color="processing">D2 内部演示环境</Tag>
        </header>

        <div className="d2-auth-content">
          <section className="d2-auth-preview" aria-label="海底捞品牌大脑预览">
            <div className="d2-auth-preview-heading">
              <img src={haidilaoLogo} alt="海底捞品牌标识" />
              <div>
                <div className="d2-auth-preview-titleline">
                  <Typography.Title level={3}>海底捞三里屯店</Typography.Title>
                  <Tag color="success" icon={<CheckCircleFilled />}>资料已认证</Tag>
                </div>
                <Typography.Text type="secondary">
                  北京市朝阳区三里屯路 · 火锅 · 本地生活商家
                </Typography.Text>
              </div>
            </div>

            <div className="d2-auth-metrics">
              <div><span>品牌事实</span><strong>8</strong><small>C1—C8 唯一事实源</small></div>
              <div><span>套餐 / 商品</span><strong>28</strong><small>含团购与门店套餐</small></div>
              <div><span>禁用词</span><strong>6</strong><small>生成前自动校验</small></div>
              <div><span>风险提醒</span><strong className="is-safe">0</strong><small>当前可进入生产</small></div>
            </div>

            <div className="d2-auth-preview-grid">
              <article className="d2-auth-preview-card">
                <div className="d2-auth-card-title">
                  <span>商家基本资料</span><Tag color="green">正常营业</Tag>
                </div>
                <dl>
                  <div><dt>品牌主体</dt><dd>海底捞国际控股有限公司</dd></div>
                  <div><dt>服务门店</dt><dd>海底捞火锅（三里屯店）</dd></div>
                  <div><dt>内容定位</dt><dd>服务体验、聚餐场景、暖心陪伴</dd></div>
                </dl>
              </article>

              <article className="d2-auth-preview-card">
                <div className="d2-auth-card-title"><span>事实语料</span><a>查看事实库</a></div>
                <ul className="d2-auth-fact-list">
                  <li><b>C1</b><span>创立于 1994 年，以服务体验著称</span></li>
                  <li><b>C3</b><span>门店提供生日庆祝及个性化服务</span></li>
                  <li><b>C7</b><span>所有价格与套餐以门店实时信息为准</span></li>
                </ul>
              </article>

              <article className="d2-auth-preview-card d2-auth-preview-card--risk">
                <div className="d2-auth-card-title"><span>生成规则</span><SafetyCertificateOutlined /></div>
                <p>引用事实必须留痕，禁用绝对化承诺，不虚构价格、门店能力或人物观点。</p>
                <div className="d2-auth-rule-status"><i /> 品牌规则已启用</div>
              </article>
            </div>

            <div className="d2-auth-preview-foot">
              登录后可查看完整品牌资料、套餐、事实库、老板 IP、引用记录与风险提醒
              <ArrowRightOutlined />
            </div>
          </section>

          <section className="d2-auth-login-panel">
            <div className="d2-auth-login-heading">
              <Typography.Title level={2}>登录工作台</Typography.Title>
              <Typography.Text type="secondary">选择身份后进入对应业务空间</Typography.Text>
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
              initialValues={{ account: 'tenant', password: DEMO_AUTH_PASSWORD }}
              onFinish={submitLogin}
              onValuesChange={clearError}
            >
              <Form.Item label="演示账号" name="account" rules={[{ required: true, message: '请输入演示账号' }]}>
                <Input size="large" prefix={<UserOutlined />} autoComplete="username" data-testid="login-account" />
              </Form.Item>
              <Form.Item label="演示密码" name="password" rules={[{ required: true, message: '请输入演示密码' }]}>
                <Input.Password size="large" prefix={<LockOutlined />} autoComplete="current-password" data-testid="login-password" />
              </Form.Item>
              <Button type="primary" htmlType="submit" size="large" block loading={submitting} data-testid="login-submit">
                登录并进入工作台 <ArrowRightOutlined />
              </Button>
            </Form>

            <div className="d2-auth-divider"><span>快速选择演示身份</span></div>
            <div className="d2-auth-identities" data-testid="demo-identities">
              {DEMO_IDENTITIES.map((identity) => (
                <button
                  key={identity.accountId}
                  type="button"
                  className={selectedAccount === identity.loginName ? 'is-selected' : ''}
                  onClick={() => loginAsIdentity(identity)}
                  data-testid={`demo-identity-${identity.accountKind}`}
                >
                  <span className={`d2-auth-role-dot is-${identityTone[identity.accountKind]}`} />
                  <span><strong>{identity.displayName}</strong><small>{identity.roleLabel}</small></span>
                  <em>{identity.loginName}</em>
                </button>
              ))}
            </div>

            <p className="d2-auth-notice">统一密码：{DEMO_AUTH_PASSWORD}</p>
            <p className="d2-auth-legal">{DEMO_AUTH_NOTICE}</p>
          </section>
        </div>
      </section>
    </main>
  );
}
