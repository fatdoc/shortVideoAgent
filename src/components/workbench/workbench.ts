import type { ControlPlaneDemoState, Membership } from '../../domain/controlPlane';
import { DEMO_PROJECT_ID, ROUTES } from '../../domain/constants';

export type WorkbenchKind = 'platform' | 'channel' | 'tenant' | 'production';

export interface WorkbenchOption {
  kind: WorkbenchKind;
  label: string;
  shortLabel: string;
  home: string;
}

export interface ActiveWorkbenchContext {
  kind: WorkbenchKind;
  label: string;
  organizationType: Membership['organizationType'];
  organizationId: string;
  organizationName: string;
  tenantId: string | null;
  projectId: string | null;
  roleCodes: string[];
  scopeLabels: string[];
}

export const WORKBENCH_OPTIONS: WorkbenchOption[] = [
  {
    kind: 'platform',
    label: '平台管理工作台',
    shortLabel: '平台管理员',
    home: '/platform/overview',
  },
  {
    kind: 'channel',
    label: '渠道代理工作台',
    shortLabel: '代理商',
    home: '/channel/overview',
  },
  {
    kind: 'tenant',
    label: '企业客户工作台',
    shortLabel: '企业客户',
    home: ROUTES.brand(DEMO_PROJECT_ID),
  },
  {
    kind: 'production',
    label: '媒体生产工作台',
    shortLabel: '媒体生产',
    home: '/production/overview',
  },
];

export function resolveWorkbenchKind(pathname: string): WorkbenchKind {
  if (pathname.startsWith('/platform')) return 'platform';
  if (pathname.startsWith('/channel')) return 'channel';
  if (pathname.startsWith('/production')) return 'production';
  return 'tenant';
}

function findMembership(
  snapshot: ControlPlaneDemoState,
  type: Membership['organizationType'],
): Membership | undefined {
  return snapshot.commercial.memberships.find(
    (membership) => membership.organizationType === type && membership.status === 'active',
  );
}

function scopeLabels(membership: Membership | undefined): string[] {
  if (!membership) return ['NO_ACTIVE_SCOPE'];
  return membership.dataScopes.map((scope) => {
    if (scope.kind === 'PROJECT_SET') {
      return `${scope.kind} · ${scope.projectIds?.join(', ') ?? '—'}`;
    }
    if (scope.kind === 'TENANT_WIDE') {
      return `${scope.kind} · ${scope.tenantId ?? '—'}`;
    }
    return scope.kind;
  });
}

export function getActiveWorkbenchContext(
  snapshot: ControlPlaneDemoState,
  kind: WorkbenchKind,
): ActiveWorkbenchContext {
  const option = WORKBENCH_OPTIONS.find((item) => item.kind === kind)!;

  if (kind === 'platform') {
    const membership = findMembership(snapshot, 'PLATFORM');
    return {
      kind,
      label: option.label,
      organizationType: 'PLATFORM',
      organizationId: membership?.organizationId ?? snapshot.commercial.platform.platformId,
      organizationName: snapshot.commercial.platform.displayName,
      tenantId: null,
      projectId: null,
      roleCodes: membership?.roleCodes ?? [],
      scopeLabels: scopeLabels(membership),
    };
  }

  if (kind === 'channel') {
    const membership = findMembership(snapshot, 'CHANNEL');
    const organization = snapshot.commercial.channels.find(
      (channel) => channel.channelOrganizationId === membership?.organizationId,
    );
    return {
      kind,
      label: option.label,
      organizationType: 'CHANNEL',
      organizationId: organization?.channelOrganizationId ?? 'channel-unavailable',
      organizationName: organization?.displayName ?? '渠道组织不可用',
      tenantId: null,
      projectId: null,
      roleCodes: membership?.roleCodes ?? [],
      scopeLabels: scopeLabels(membership),
    };
  }

  const membership = findMembership(snapshot, 'TENANT');
  return {
    kind,
    label: option.label,
    organizationType: 'TENANT',
    organizationId: membership?.organizationId ?? 'tenant-organization-unavailable',
    organizationName:
      kind === 'production'
        ? `${snapshot.commercial.tenant.displayName} · 媒体生产`
        : snapshot.commercial.tenant.displayName,
    tenantId: snapshot.commercial.tenant.tenantId,
    projectId:
      membership?.dataScopes.find((scope) => scope.kind === 'PROJECT_SET')?.projectIds?.[0] ?? null,
    roleCodes:
      kind === 'production'
        ? (membership?.roleCodes.filter((role) => role.startsWith('production.')) ?? [])
        : (membership?.roleCodes.filter((role) => role.startsWith('tenant.')) ?? []),
    scopeLabels: scopeLabels(membership),
  };
}
