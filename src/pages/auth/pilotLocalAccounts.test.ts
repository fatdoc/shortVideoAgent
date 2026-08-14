import { describe, expect, it } from 'vitest';
import { PILOT_LOCAL_ACCOUNT_CHOICES, resolvePilotLocalAccountChoices } from './pilotLocalAccounts';

describe('Pilot local account choices', () => {
  it('offers four non-secret identities only in development', () => {
    expect(resolvePilotLocalAccountChoices({ DEV: true })).toEqual(PILOT_LOCAL_ACCOUNT_CHOICES);
    expect(resolvePilotLocalAccountChoices({ DEV: false })).toEqual([]);
  });

  it('keeps the browser projection limited to labels and emails', () => {
    expect(PILOT_LOCAL_ACCOUNT_CHOICES).toEqual([
      { key: 'platform_admin', label: '平台管理员', email: 'platform@videoagent.test' },
      { key: 'channel_admin', label: '渠道管理员', email: 'channel@videoagent.test' },
      { key: 'tenant_admin', label: '门店管理员', email: 'admin@videoagent.test' },
      { key: 'content_operator', label: '内容运营', email: 'operator@videoagent.test' },
    ]);
    expect(JSON.stringify(PILOT_LOCAL_ACCOUNT_CHOICES)).not.toMatch(/password|secret|token/i);
  });
});
