import { describe, expect, it } from 'vitest';
import {
  PILOT_LOCAL_ACCOUNTS,
  createPilotLocalSecrets,
  parsePilotLocalAccountPassword,
} from './localAccounts.js';

describe('Pilot local accounts', () => {
  it('defines the four simple accounts with server-owned roles', () => {
    expect(PILOT_LOCAL_ACCOUNTS).toEqual([
      {
        accountKey: 'platformAdmin',
        email: 'platform@videoagent.test',
        displayName: '平台管理员',
        role: 'platform_admin',
      },
      {
        accountKey: 'channelAdminA',
        email: 'channel@videoagent.test',
        displayName: '渠道管理员',
        role: 'channel_admin',
      },
      {
        accountKey: 'tenantAdminA',
        email: 'admin@videoagent.test',
        displayName: '门店管理员',
        role: 'tenant_admin',
      },
      {
        accountKey: 'tenantOperatorA',
        email: 'operator@videoagent.test',
        displayName: '内容运营',
        role: 'content_operator',
      },
    ]);
  });

  it('creates local seed secrets without exposing the password in account metadata', () => {
    const password = 'Local-Only-2026!';
    const secrets = createPilotLocalSecrets(password);

    for (const account of PILOT_LOCAL_ACCOUNTS) {
      expect(secrets.accounts[account.accountKey]).toEqual({
        email: account.email,
        password,
      });
    }
    expect(JSON.stringify(PILOT_LOCAL_ACCOUNTS)).not.toContain(password);
  });

  it.each(['', 'short', 'alllowercase2026!', 'ALLUPPERCASE2026!', 'NoDigitsHere!', 'No-Symbol-2026']) (
    'rejects a weak shared password before touching the database: %s',
    (password) => {
      expect(() => parsePilotLocalAccountPassword(password)).toThrow(
        'PILOT_LOCAL_ACCOUNT_PASSWORD_INVALID',
      );
    },
  );
});
