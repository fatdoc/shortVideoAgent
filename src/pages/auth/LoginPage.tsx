import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { Alert, Button, Form, Input } from 'antd';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { pilotRuntime } from '../../config/pilotRuntime';
import { DEMO_AUTH_PASSWORD } from '../../services/demoAuth';
import { useAuthStore } from '../../stores/authStore';
import { usePilotAuthStore } from '../../stores/pilotAuthStore';

interface LoginValues { account: string; password: string }
interface LoginPageProps { onRegister?: () => void }

const workflow = ['门店建档', '资产归集', 'AI 探店脚本', '分镜成片', '发布配置', '线索归因'];

function AuthVisual() {
  return (
    <section className="store-auth-visual" aria-label="门店素材生成获客视频流程示意">
      <div><span className="store-eyebrow">门店素材 → 获客视频</span><h1>让门店资料变成<br />可执行的探店内容</h1><p>从门店建档到发布归因，每一步都保留来源、状态与人工确认。</p></div>
      <ol>{workflow.map((item,index)=><li key={item}><span>{index+1}</span><strong>{item}</strong><i /></li>)}</ol>
      <div className="auth-neutral-scene"><div className="scene-store"><i/><i/><i/></div><div className="scene-assets"><span/><span/><span/><span/></div><div className="scene-video"><b>9:16</b><span/></div><div className="scene-leads"><i/><i/><i/></div></div>
    </section>
  );
}

function DemoLoginPage() {
  const login = useAuthStore((state)=>state.login);
  const error = useAuthStore((state)=>state.error);
  const clearError = useAuthStore((state)=>state.clearError);
  const [submitting,setSubmitting]=useState(false);
  const submit=(values:LoginValues)=>{clearError();setSubmitting(true);login({loginName:values.account.trim(),password:values.password});setSubmitting(false)};
  return <main className="store-auth-page" data-testid="login-page"><AuthVisual/><section className="store-auth-form"><div><span className="store-eyebrow">门店获客工作台</span><h2>登录工作台</h2><p>使用已开通的工作账号继续。</p></div>{error?<Alert type="error" showIcon message={error} closable onClose={clearError} data-testid="login-error"/>:null}<Form<LoginValues> layout="vertical" initialValues={{account:'tenant',password:DEMO_AUTH_PASSWORD}} onFinish={submit} onValuesChange={clearError}><Form.Item label="邮箱或账号" name="account" rules={[{required:true,message:'请输入账号'}]}><Input size="large" prefix={<MailOutlined/>} autoComplete="username" data-testid="login-account"/></Form.Item><Form.Item label="密码" name="password" rules={[{required:true,message:'请输入密码'}]}><Input.Password size="large" prefix={<LockOutlined/>} autoComplete="current-password" data-testid="login-password"/></Form.Item><Button type="primary" htmlType="submit" size="large" block loading={submitting} data-testid="login-submit">登录</Button></Form><Link className="store-auth-link" to="/register">创建账号</Link><small>登录即代表你同意用户须知与数据使用说明。</small></section></main>;
}

function PilotLoginPage({onRegister}:LoginPageProps){
  const login=usePilotAuthStore((state)=>state.login);const status=usePilotAuthStore((state)=>state.status);const error=usePilotAuthStore((state)=>state.error);const requestId=usePilotAuthStore((state)=>state.requestId);const clearError=usePilotAuthStore((state)=>state.clearError);
  const submit=async(values:LoginValues)=>{clearError();await login({email:values.account.trim(),password:values.password})};
  return <main className="store-auth-page" data-testid="pilot-login-page"><AuthVisual/><section className="store-auth-form"><div><span className="store-eyebrow">安全登录</span><h2>白名单账号登录</h2><p>使用已获授权的企业邮箱继续。</p></div>{error?<Alert type="error" showIcon closable message={error} description={requestId?`请求 ID：${requestId}`:undefined} onClose={clearError} data-testid="pilot-login-error"/>:null}<Form<LoginValues> layout="vertical" onFinish={submit} onValuesChange={clearError}><Form.Item label="邮箱" name="account" rules={[{required:true,message:'请输入邮箱'},{type:'email',message:'请输入有效邮箱'}]}><Input size="large" prefix={<MailOutlined/>} autoComplete="username" data-testid="pilot-login-email"/></Form.Item><Form.Item label="密码" name="password" rules={[{required:true,message:'请输入密码'}]}><Input.Password size="large" prefix={<LockOutlined/>} autoComplete="current-password" data-testid="pilot-login-password"/></Form.Item><Button type="primary" htmlType="submit" size="large" block loading={status==='authenticating'} data-testid="pilot-login-submit">登录</Button>{onRegister?<Button type="link" block onClick={onRegister} data-testid="pilot-register-entry">创建账号</Button>:null}</Form><small>账号、密码和会话由现有认证服务处理。</small></section></main>;
}

export function LoginPage(props:LoginPageProps={}){return pilotRuntime.mode==='pilot'?<PilotLoginPage {...props}/>:<DemoLoginPage/>}
