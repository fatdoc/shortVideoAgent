import {
  CONTROL_PLANE_FIXTURE_ID,
  type AuthorizationContext,
} from '../domain/controlPlane';
import { DEMO_TENANT_ID } from '../mocks/controlPlaneDemo';

export class CanonicalRouteError extends Error {
  readonly code = 'ROUTE_ID_REJECTED' as const;
  readonly details: Record<string, string>;

  constructor(message: string, details: Record<string, string>) {
    super(message);
    this.name = 'CanonicalRouteError';
    this.details = details;
  }
}

export interface CanonicalRouteIdentity {
  tenantId: typeof DEMO_TENANT_ID;
  projectId: typeof CONTROL_PLANE_FIXTURE_ID;
}

export function requireCanonicalRoute(
  tenantId: string,
  projectId: string,
): CanonicalRouteIdentity {
  if (
    tenantId !== DEMO_TENANT_ID ||
    projectId !== CONTROL_PLANE_FIXTURE_ID
  ) {
    throw new CanonicalRouteError(
      '路由 tenant/project 不是 canonical Demo 身份；已安全拒绝，未执行映射。',
      {
        expectedTenantId: DEMO_TENANT_ID,
        expectedProjectId: CONTROL_PLANE_FIXTURE_ID,
        receivedTenantId: tenantId,
        receivedProjectId: projectId,
      },
    );
  }
  return { tenantId, projectId };
}

export function requireCanonicalAuthorizationRoute(
  authorization: AuthorizationContext,
  projectId: string,
): CanonicalRouteIdentity {
  return requireCanonicalRoute(authorization.tenantId ?? '', projectId);
}
