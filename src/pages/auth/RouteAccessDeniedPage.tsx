import { Alert, Button, Result, Space, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import type { DemoRouteAccessDecision } from '../../domain/demoRouteAccess';
import { useAuthStore } from '../../stores/authStore';

type DeniedDecision = Extract<
  DemoRouteAccessDecision,
  { status: 'permission-denied' | 'scope-denied' }
>;

interface RouteAccessDeniedPageProps {
  decision: DeniedDecision;
}

export function RouteAccessDeniedPage({ decision }: RouteAccessDeniedPageProps) {
  const navigate = useNavigate();
  const identity = useAuthStore((state) => state.identity);
  const logout = useAuthStore((state) => state.logout);
  const errorCode =
    decision.status === 'scope-denied' ? 'ROUTE_ID_REJECTED' : 'ROUTE_PERMISSION_DENIED';
  const reason =
    decision.status === 'scope-denied'
      ? 'URL 中的 Tenant 或 Project 不是 canonical Demo 资源，系统未执行自动映射。'
      : '当前身份或当前已启用工作台不具备该路由权限。';

  return (
    <Result
      status="403"
      title={errorCode}
      subTitle={`${reason} 目标：${decision.descriptor.targetLabel}`}
      extra={
        <Space wrap>
          <Button
            type="primary"
            onClick={() => navigate(identity?.defaultRoute ?? '/login', { replace: true })}
          >
            返回我的工作台
          </Button>
          <Button
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
          >
            退出并切换身份
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" size={8} data-testid="route-access-denied">
        <Typography.Text>
          目标区域：{decision.descriptor.targetLabel} · {decision.pathname}
        </Typography.Text>
        <Typography.Text>
          当前身份：{identity?.displayName ?? '未识别'} · {identity?.roleLabel ?? '无有效角色'}
        </Typography.Text>
        <Typography.Text>
          当前组织：{identity?.activeOrganization.organizationName ?? '未识别'} ·{' '}
          {identity?.activeOrganization.organizationId ?? 'unresolved'}
        </Typography.Text>
        <Alert
          type="warning"
          showIcon
          message="前端 Demo 拒绝，不代表生产 RBAC 或服务端安全控制。"
        />
      </Space>
    </Result>
  );
}
