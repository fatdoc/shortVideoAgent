import type { Knex } from 'knex';
import { describe, expect, it, vi } from 'vitest';
import { PilotE2eEnvironmentError } from './environment.js';
import {
  MigrationGateOperationError,
  runControlApiMigrationGate,
  type MigrationGateOutput,
  type MigrationGateRuntime,
} from './migrationGate.js';

const databaseUrl =
  'postgres://migration_gate_user:migration-gate-super-secret@127.0.0.1:5432/videoagent_control_test?application_name=secret-query';

function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    PILOT_E2E: 'true',
    CONTROL_API_TEST_DATABASE_URL: databaseUrl,
    ...overrides,
  };
}

function captureOutput(): {
  output: MigrationGateOutput;
  lines: string[];
} {
  const lines: string[] = [];
  return {
    lines,
    output: {
      info: (line) => lines.push(line),
      error: (line) => lines.push(line),
    },
  };
}

function runtime(overrides: Partial<MigrationGateRuntime> = {}): {
  value: MigrationGateRuntime;
  database: Knex;
} {
  const database = {} as Knex;
  return {
    database,
    value: {
      createDatabase: vi.fn(() => database),
      assertIdentity: vi.fn().mockResolvedValue(undefined),
      execute: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    },
  };
}

function expectNoSensitiveOutput(lines: string[]): void {
  const output = lines.join('\n');
  expect(output).not.toContain(databaseUrl);
  expect(output).not.toContain('migration_gate_user');
  expect(output).not.toContain('migration-gate-super-secret');
  expect(output).not.toContain('secret-query');
  expect(output).not.toContain('simulated-secret-error');
}

describe('Control API migration gate failure and recovery contract', () => {
  it('does not create a database connection when the environment is rejected', async () => {
    const gateRuntime = runtime();
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(
        environment({ PILOT_E2E: 'false' }),
        captured.output,
        gateRuntime.value,
      ),
    ).resolves.toBe(2);

    expect(captured.lines).toEqual(['MIGRATION_GATE_ENVIRONMENT_REJECTED PILOT_E2E_MODE_REQUIRED']);
    expect(gateRuntime.value.createDatabase).not.toHaveBeenCalled();
    expect(gateRuntime.value.execute).not.toHaveBeenCalled();
    expect(gateRuntime.value.cleanup).not.toHaveBeenCalled();
    expectNoSensitiveOutput(captured.lines);
  });

  it('reports a connection failure without cleanup SQL or raw error details', async () => {
    const gateRuntime = runtime({
      assertIdentity: vi.fn().mockRejectedValue(new Error('simulated-secret-error')),
    });
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(environment(), captured.output, gateRuntime.value),
    ).resolves.toBe(1);

    expect(captured.lines).toEqual(['MIGRATION_GATE_CONNECTION_FAILED']);
    expect(gateRuntime.value.execute).not.toHaveBeenCalled();
    expect(gateRuntime.value.cleanup).not.toHaveBeenCalled();
    expect(gateRuntime.value.destroy).toHaveBeenCalledWith(gateRuntime.database);
    expectNoSensitiveOutput(captured.lines);
  });

  it('reports current_database identity mismatch before destructive execution', async () => {
    const gateRuntime = runtime({
      assertIdentity: vi
        .fn()
        .mockRejectedValue(new PilotE2eEnvironmentError('PILOT_E2E_DATABASE_IDENTITY_MISMATCH')),
    });
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(environment(), captured.output, gateRuntime.value),
    ).resolves.toBe(1);

    expect(captured.lines).toEqual([
      'MIGRATION_GATE_DATABASE_IDENTITY_REJECTED PILOT_E2E_DATABASE_IDENTITY_MISMATCH',
    ]);
    expect(gateRuntime.value.execute).not.toHaveBeenCalled();
    expect(gateRuntime.value.cleanup).not.toHaveBeenCalled();
    expectNoSensitiveOutput(captured.lines);
  });

  it.each([
    'MIGRATION_GATE_RESET_FAILED',
    'MIGRATION_GATE_FORWARD_FAILED',
    'MIGRATION_GATE_FORWARD_VERIFICATION_FAILED',
    'MIGRATION_GATE_ROLLBACK_FAILED',
    'MIGRATION_GATE_ROLLBACK_VERIFICATION_FAILED',
    'MIGRATION_GATE_REAPPLY_FAILED',
    'MIGRATION_GATE_REAPPLY_VERIFICATION_FAILED',
  ])('preserves %s while still attempting verified cleanup', async (failureCode) => {
    const gateRuntime = runtime({
      execute: vi
        .fn()
        .mockRejectedValue(new MigrationGateOperationError(failureCode, 'simulated-secret-error')),
    });
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(environment(), captured.output, gateRuntime.value),
    ).resolves.toBe(1);

    expect(captured.lines).toEqual([
      'RUNNING_MIGRATION_GATE database=videoagent_control_test host=loopback',
      failureCode,
      'MIGRATION_GATE_CLEANUP_PASS',
    ]);
    expect(gateRuntime.value.cleanup).toHaveBeenCalledWith(gateRuntime.database);
    expect(gateRuntime.value.destroy).toHaveBeenCalledWith(gateRuntime.database);
    expect(captured.lines.join('\n')).not.toContain('MIGRATION_ROLLBACK_REAPPLY_PASS');
    expectNoSensitiveOutput(captured.lines);
  });

  it('reports cleanup failure in addition to the primary failure without overwriting it', async () => {
    const gateRuntime = runtime({
      execute: vi
        .fn()
        .mockRejectedValue(
          new MigrationGateOperationError(
            'MIGRATION_GATE_ROLLBACK_FAILED',
            'simulated-secret-error',
          ),
        ),
      cleanup: vi.fn().mockRejectedValue(new Error('simulated-secret-error')),
    });
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(environment(), captured.output, gateRuntime.value),
    ).resolves.toBe(1);

    expect(captured.lines).toEqual([
      'RUNNING_MIGRATION_GATE database=videoagent_control_test host=loopback',
      'MIGRATION_GATE_ROLLBACK_FAILED',
      'MIGRATION_GATE_CLEANUP_FAILED',
    ]);
    expectNoSensitiveOutput(captured.lines);
  });

  it('treats destroy failure as cleanup failure and never emits final PASS', async () => {
    const gateRuntime = runtime({
      destroy: vi.fn().mockRejectedValue(new Error('simulated-secret-error')),
    });
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(environment(), captured.output, gateRuntime.value),
    ).resolves.toBe(1);

    expect(captured.lines).toEqual([
      'RUNNING_MIGRATION_GATE database=videoagent_control_test host=loopback',
      'MIGRATION_GATE_CLEANUP_PASS',
      'MIGRATION_GATE_CLEANUP_FAILED',
    ]);
    expect(captured.lines.join('\n')).not.toContain('MIGRATION_ROLLBACK_REAPPLY_PASS');
    expectNoSensitiveOutput(captured.lines);
  });

  it('emits final PASS only after execution, cleanup, and destroy succeed', async () => {
    const gateRuntime = runtime();
    const captured = captureOutput();

    await expect(
      runControlApiMigrationGate(environment(), captured.output, gateRuntime.value),
    ).resolves.toBe(0);

    expect(captured.lines).toEqual([
      'RUNNING_MIGRATION_GATE database=videoagent_control_test host=loopback',
      'MIGRATION_GATE_CLEANUP_PASS',
      'MIGRATION_ROLLBACK_REAPPLY_PASS',
    ]);
    expectNoSensitiveOutput(captured.lines);
  });
});
