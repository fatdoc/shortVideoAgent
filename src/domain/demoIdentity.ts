export const DEMO_IDENTITY_CONTRACT_VERSION = '1.0' as const;

export type DemoAccountKind =
  | 'platform'
  | 'channel'
  | 'tenant'
  | 'production';

export type DemoWorkbench =
  | 'platform'
  | 'channel'
  | 'tenant'
  | 'production';

export type DemoOrganizationType = 'PLATFORM' | 'CHANNEL' | 'TENANT';

export const DEMO_SESSION_VERSION = 1 as const;

export type DemoRole =
  | 'platform_admin'
  | 'channel_agent'
  | 'enterprise_admin'
  | 'content_operator';

export type DemoSessionOrganizationType =
  | 'platform'
  | 'channel'
  | 'enterprise';

export type DemoSessionWorkbench =
  | 'platform'
  | 'channel'
  | 'enterprise'
  | 'production';

export interface DemoOrganizationIdentity {
  organizationId: string;
  organizationName: string;
  organizationType: DemoOrganizationType;
}

export interface DemoMembershipIdentity {
  membershipId: string;
  principalId: string;
  organizationId: string;
  organizationType: DemoOrganizationType;
  roleCodes: readonly string[];
  status: 'active';
}

export interface DemoIdentity {
  contractVersion: typeof DEMO_IDENTITY_CONTRACT_VERSION;
  accountId: string;
  accountKind: DemoAccountKind;
  loginName: string;
  displayName: string;
  roleLabel: string;
  activeOrganization: DemoOrganizationIdentity;
  activeMembership: DemoMembershipIdentity;
  allowedWorkbenches: readonly DemoWorkbench[];
  defaultRoute: string;
}

export interface DemoAccountSummary {
  accountId: string;
  accountKind: DemoAccountKind;
  loginName: string;
  displayName: string;
  roleLabel: string;
  organizationName: string;
  allowedWorkbenches: readonly DemoWorkbench[];
  defaultRoute: string;
}

export interface DemoLoginCredentials {
  loginName: string;
  password: string;
}

export interface DemoSession {
  version: typeof DEMO_SESSION_VERSION;
  sessionId: string;
  identityId: string;
  role: DemoRole;
  organizationId: string;
  organizationType: DemoSessionOrganizationType;
  defaultWorkbench: DemoSessionWorkbench;
  issuedAt: string;
  expiresAt: string;
}

const PLATFORM_ORGANIZATION: DemoOrganizationIdentity = {
  organizationId: 'platform-videoagent',
  organizationName: '短视频营销 Agent 平台',
  organizationType: 'PLATFORM',
};

const CHANNEL_ORGANIZATION: DemoOrganizationIdentity = {
  organizationId: 'channel-demo-level-1',
  organizationName: '华北一级渠道',
  organizationType: 'CHANNEL',
};

const TENANT_ORGANIZATION: DemoOrganizationIdentity = {
  organizationId: 'tenant-demo-hdl',
  organizationName: '海底捞三里屯店',
  organizationType: 'TENANT',
};

export const DEMO_IDENTITIES: readonly DemoIdentity[] = [
  {
    contractVersion: DEMO_IDENTITY_CONTRACT_VERSION,
    accountId: 'demo-account-platform',
    accountKind: 'platform',
    loginName: 'platform',
    displayName: '平台管理员',
    roleLabel: '平台总管理员',
    activeOrganization: PLATFORM_ORGANIZATION,
    activeMembership: {
      membershipId: 'membership-demo-platform-admin',
      principalId: 'principal-demo-platform',
      organizationId: PLATFORM_ORGANIZATION.organizationId,
      organizationType: PLATFORM_ORGANIZATION.organizationType,
      roleCodes: ['platform.admin'],
      status: 'active',
    },
    allowedWorkbenches: ['platform'],
    defaultRoute: '/platform/overview',
  },
  {
    contractVersion: DEMO_IDENTITY_CONTRACT_VERSION,
    accountId: 'demo-account-channel',
    accountKind: 'channel',
    loginName: 'channel',
    displayName: '渠道负责人',
    roleLabel: '一级代理管理员',
    activeOrganization: CHANNEL_ORGANIZATION,
    activeMembership: {
      membershipId: 'membership-demo-channel-level-1',
      principalId: 'principal-demo-channel',
      organizationId: CHANNEL_ORGANIZATION.organizationId,
      organizationType: CHANNEL_ORGANIZATION.organizationType,
      roleCodes: ['channel.admin'],
      status: 'active',
    },
    allowedWorkbenches: ['channel'],
    defaultRoute: '/channel/overview',
  },
  {
    contractVersion: DEMO_IDENTITY_CONTRACT_VERSION,
    accountId: 'demo-account-tenant',
    accountKind: 'tenant',
    loginName: 'tenant',
    displayName: '企业老板',
    roleLabel: '租户企业管理员',
    activeOrganization: TENANT_ORGANIZATION,
    activeMembership: {
      membershipId: 'membership-demo-tenant-owner',
      principalId: 'principal-demo-tenant',
      organizationId: TENANT_ORGANIZATION.organizationId,
      organizationType: TENANT_ORGANIZATION.organizationType,
      roleCodes: ['tenant.owner'],
      status: 'active',
    },
    allowedWorkbenches: ['tenant'],
    defaultRoute: '/projects/demo-local-001/brand',
  },
  {
    contractVersion: DEMO_IDENTITY_CONTRACT_VERSION,
    accountId: 'demo-account-production',
    accountKind: 'production',
    loginName: 'production',
    displayName: '视频制作人',
    roleLabel: '媒体生产操作员',
    activeOrganization: TENANT_ORGANIZATION,
    activeMembership: {
      membershipId: 'membership-demo-production-operator',
      principalId: 'principal-demo-production',
      organizationId: TENANT_ORGANIZATION.organizationId,
      organizationType: TENANT_ORGANIZATION.organizationType,
      roleCodes: ['production.operator'],
      status: 'active',
    },
    allowedWorkbenches: ['production'],
    defaultRoute: '/production/overview',
  },
] as const;

export const DEMO_ACCOUNTS: readonly DemoAccountSummary[] =
  DEMO_IDENTITIES.map((identity) => ({
    accountId: identity.accountId,
    accountKind: identity.accountKind,
    loginName: identity.loginName,
    displayName: identity.displayName,
    roleLabel: identity.roleLabel,
    organizationName: identity.activeOrganization.organizationName,
    allowedWorkbenches: identity.allowedWorkbenches,
    defaultRoute: identity.defaultRoute,
  }));

export function findDemoIdentityByAccountId(
  accountId: string,
): DemoIdentity | null {
  return (
    DEMO_IDENTITIES.find((identity) => identity.accountId === accountId) ?? null
  );
}

export function findDemoIdentityByLoginName(
  loginName: string,
): DemoIdentity | null {
  const normalizedLoginName = loginName.trim().toLowerCase();
  return (
    DEMO_IDENTITIES.find(
      (identity) => identity.loginName === normalizedLoginName,
    ) ?? null
  );
}

export function canAccessDemoWorkbench(
  identity: DemoIdentity | null,
  workbench: DemoWorkbench,
): boolean {
  return identity?.allowedWorkbenches.includes(workbench) ?? false;
}
