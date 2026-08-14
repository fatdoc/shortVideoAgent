export type PilotLocalAccountChoice = {
  key: 'platform_admin' | 'channel_admin' | 'tenant_admin' | 'content_operator';
  label: string;
  email: string;
};

export const PILOT_LOCAL_ACCOUNT_CHOICES: readonly PilotLocalAccountChoice[] = [
  { key: 'platform_admin', label: '平台管理员', email: 'platform@videoagent.test' },
  { key: 'channel_admin', label: '渠道管理员', email: 'channel@videoagent.test' },
  { key: 'tenant_admin', label: '门店管理员', email: 'admin@videoagent.test' },
  { key: 'content_operator', label: '内容运营', email: 'operator@videoagent.test' },
] as const;

export function resolvePilotLocalAccountChoices(environment: {
  DEV?: boolean;
}): readonly PilotLocalAccountChoice[] {
  return environment.DEV === true ? PILOT_LOCAL_ACCOUNT_CHOICES : [];
}
