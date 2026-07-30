import { Button, Result, Tag, Typography } from 'antd';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  ProductionControlSurface,
  type ProductionView,
} from '../../components/production/ProductionControlSurface';
import {
  CanonicalRouteError,
  requireCanonicalRoute,
} from '../../services/canonicalRouteGuard';
import { useControlPlaneStore } from '../../stores/controlPlaneStore';

interface ProductionWorkbenchPageProps {
  view?: ProductionView;
}

export function ProductionWorkbenchPage({
  view = 'all',
}: ProductionWorkbenchPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();
  const snapshot = useControlPlaneStore((state) => state.snapshot);
  const tenantIdFromDeepLink = new URLSearchParams(location.search).get('tenantId');
  const activeTenantId = snapshot.commercial.tenant.tenantId;
  let routeError: CanonicalRouteError | null = null;

  if (projectId) {
    try {
      requireCanonicalRoute(
        tenantIdFromDeepLink ?? activeTenantId,
        projectId,
      );
    } catch (error) {
      routeError =
        error instanceof CanonicalRouteError
          ? error
          : new CanonicalRouteError('canonical route 校验失败。', {
              receivedTenantId: tenantIdFromDeepLink ?? activeTenantId,
              receivedProjectId: projectId,
            });
    }
  }

  if (routeError) {
    return (
      <Result
        status="403"
        title="ROUTE_ID_REJECTED"
        subTitle={`${routeError.message} Tenant=${
          routeError.details.receivedTenantId
        } · Project=${routeError.details.receivedProjectId}`}
        extra={
          <Button type="primary" onClick={() => navigate('/production/overview')}>
            返回媒体生产工作台
          </Button>
        }
      />
    );
  }

  return (
    <div className="d1-page-stack">
      <header className="d1-page-header">
        <div>
          <Tag color="purple">
            TENANT {activeTenantId} · PROJECT {projectId ?? snapshot.fixtureId}
          </Tag>
          <Typography.Title level={2}>媒体生产工作台</Typography.Title>
          <Typography.Paragraph type="secondary">
            生产包、任务、资产和来源链；不读取客户价格、渠道关系或供应商密钥。
          </Typography.Paragraph>
        </div>
      </header>
      <ProductionControlSurface view={view} />
    </div>
  );
}
