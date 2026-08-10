import { describe, expect, it, vi } from 'vitest';
import {
  PilotE2eEnvironmentError,
  parsePilotE2eEnvironment,
  runWithVerifiedPilotE2eDatabase,
  safePilotE2eEnvironmentSummary,
  type PilotE2eDatabase,
} from './environment.js';

const dedicatedUrl =
  'postgres://pilot_user:super-secret-password@127.0.0.1:5432/videoagent_control_test';

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PILOT_E2E: 'true',
    CONTROL_API_TEST_DATABASE_URL: dedicatedUrl,
    PILOT_E2E_CONTROL_API_PORT: '10601',
    PILOT_E2E_WEB_PORT: '5175',
    ...overrides,
  };
}

describe('Pilot E2E environment contract', () => {
  it.each([
    [{ CONTROL_API_TEST_DATABASE_URL: undefined }, 'PILOT_E2E_DATABASE_URL_REQUIRED'],
    [
      { CONTROL_API_TEST_DATABASE_URL: 'mysql://localhost/videoagent_control_test' },
      'PILOT_E2E_DATABASE_PROTOCOL_INVALID',
    ],
    [
      { CONTROL_API_TEST_DATABASE_URL: 'postgres://localhost/videoagent_control' },
      'PILOT_E2E_DATABASE_NOT_DEDICATED',
    ],
    [
      { CONTROL_API_TEST_DATABASE_URL: 'postgres://localhost/not-a-test-db' },
      'PILOT_E2E_DATABASE_NOT_DEDICATED',
    ],
    [{ PILOT_E2E: 'false' }, 'PILOT_E2E_MODE_REQUIRED'],
    [{ PILOT_E2E_CONTROL_API_PORT: '5175' }, 'PILOT_E2E_PORT_CONFLICT'],
  ])('fails closed before startup with %s', (overrides, expectedCode) => {
    expect(() => parsePilotE2eEnvironment(environment(overrides))).toThrowError(
      expect.objectContaining({ code: expectedCode }),
    );
  });

  it('returns a bounded environment without exposing URL credentials', () => {
    const parsed = parsePilotE2eEnvironment(environment());

    expect(parsed).toEqual({
      databaseUrl: dedicatedUrl,
      databaseName: 'videoagent_control_test',
      controlApiHost: '127.0.0.1',
      controlApiPort: 10601,
      webHost: '127.0.0.1',
      webPort: 5175,
    });
    expect(safePilotE2eEnvironmentSummary(parsed)).toEqual({
      databaseName: 'videoagent_control_test',
      databaseHostCategory: 'loopback',
      controlApiOrigin: 'http://127.0.0.1:10601',
      webOrigin: 'http://127.0.0.1:5175',
    });
    expect(JSON.stringify(safePilotE2eEnvironmentSummary(parsed))).not.toContain('pilot_user');
    expect(JSON.stringify(safePilotE2eEnvironmentSummary(parsed))).not.toContain(
      'super-secret-password',
    );
  });

  it('decodes the database path before enforcing the dedicated suffix', () => {
    const parsed = parsePilotE2eEnvironment(
      environment({
        CONTROL_API_TEST_DATABASE_URL: 'postgresql://127.0.0.1:5432/videoagent%5Fcontrol%5Ftest',
      }),
    );

    expect(parsed.databaseName).toBe('videoagent_control_test');
  });
});

describe('Pilot E2E database identity guard', () => {
  it('runs a destructive operation only after current_database matches the URL path', async () => {
    const raw = vi.fn().mockResolvedValue({ rows: [{ database_name: 'videoagent_control_test' }] });
    const operation = vi.fn().mockResolvedValue('done');

    await expect(
      runWithVerifiedPilotE2eDatabase(
        { raw } satisfies PilotE2eDatabase,
        parsePilotE2eEnvironment(environment()),
        operation,
      ),
    ).resolves.toBe('done');

    expect(raw).toHaveBeenCalledWith('select current_database() as database_name');
    expect(operation).toHaveBeenCalledOnce();
  });

  it('rejects an actual database mismatch before the destructive operation and leaks no URL', async () => {
    const raw = vi.fn().mockResolvedValue({ rows: [{ database_name: 'videoagent_control' }] });
    const operation = vi.fn();
    const parsed = parsePilotE2eEnvironment(environment());

    let caught: unknown;
    try {
      await runWithVerifiedPilotE2eDatabase({ raw } satisfies PilotE2eDatabase, parsed, operation);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PilotE2eEnvironmentError);
    expect(caught).toMatchObject({ code: 'PILOT_E2E_DATABASE_IDENTITY_MISMATCH' });
    expect(String(caught)).not.toContain('pilot_user');
    expect(String(caught)).not.toContain('super-secret-password');
    expect(String(caught)).not.toContain(dedicatedUrl);
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects an invalid database identity response before the destructive operation', async () => {
    const operation = vi.fn();

    await expect(
      runWithVerifiedPilotE2eDatabase(
        { raw: vi.fn().mockResolvedValue({ rows: [] }) } satisfies PilotE2eDatabase,
        parsePilotE2eEnvironment(environment()),
        operation,
      ),
    ).rejects.toMatchObject({ code: 'PILOT_E2E_DATABASE_IDENTITY_INVALID' });
    expect(operation).not.toHaveBeenCalled();
  });
});
