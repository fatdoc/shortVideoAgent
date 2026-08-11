import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { jointGatePhases, validateDedicatedPostgresTestUrl } from './joint-gate-manifest.mjs';
import { validateSynchronizedGitCommit } from './joint-gate-preconditions.mjs';

const repositoryRoot = process.cwd();
const mode = process.argv[2];
const supportedModes = new Set(['--list', '--plan', '--full']);

if (!supportedModes.has(mode) || process.argv.length !== 3) {
  console.error('Usage: node scripts/run-joint-gate.mjs --list|--plan|--full');
  process.exitCode = 64;
} else if (mode === '--list' || mode === '--plan') {
  console.log('JOINT_GATE_RUNNER_READY FULL_GATE_NOT_YET_EXECUTED');
  for (const phase of jointGatePhases) {
    const commands = phase.commands
      .map(({ executable, args }) => [executable, ...args].join(' '))
      .join(' && ');
    if (mode === '--list') {
      console.log(`NOT_RUN ${phase.id} owner=${phase.owner} availability=${phase.availability}`);
    } else {
      console.log(
        `NOT_RUN ${phase.id} owner=${phase.owner} availability=${phase.availability} command=${commands}`,
      );
    }
  }
} else {
  const blockers = collectFullGateBlockers();
  if (blockers.length > 0) {
    console.error('JOINT_GATE_BLOCKED FULL_GATE_NOT_EXECUTED');
    for (const blocker of blockers) {
      console.error(`BLOCKED ${blocker.phaseId} ${blocker.code}`);
    }
    process.exitCode = 2;
  } else {
    process.exitCode = runFullGate();
  }
}

function collectFullGateBlockers() {
  const blockers = [];
  const postgres = validateDedicatedPostgresTestUrl(process.env.CONTROL_API_TEST_DATABASE_URL);
  if (!postgres.ok) {
    blockers.push({ phaseId: 'control-api-postgres', code: postgres.code });
  }

  for (const phase of jointGatePhases) {
    if (!phase.requiredInFull) continue;
    for (const precondition of phase.preconditions) {
      if (precondition.type === 'slice') {
        blockers.push({
          phaseId: phase.id,
          code: precondition.code ?? 'REQUIRED_PHASE_NOT_IMPLEMENTED',
        });
        continue;
      }
      if (precondition.type !== 'environment') continue;
      if (precondition.validator === 'dedicated-postgres-test-url') continue;
      if (precondition.validator === 'git-commit-ancestor') {
        const result = validateSynchronizedGitCommit(process.env[precondition.name], {
          repositoryRoot,
        });
        if (!result.ok) {
          blockers.push({ phaseId: phase.id, code: result.code });
        }
      }
    }
  }

  return uniqueBlockers(blockers);
}

function uniqueBlockers(blockers) {
  const seen = new Set();
  return blockers.filter(({ phaseId, code }) => {
    const key = `${phaseId}:${code}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function runFullGate() {
  const environment = sanitizedEnvironment();
  for (const phase of jointGatePhases) {
    if (!phase.requiredInFull) continue;
    console.log(`RUNNING ${phase.id}`);
    for (const command of phase.commands) {
      const executable = command.executable === 'node' ? process.execPath : command.executable;
      const cwd = path.resolve(repositoryRoot, command.cwd);
      const result = spawnSync(executable, command.args, {
        cwd,
        encoding: 'utf8',
        stdio: 'inherit',
        shell: false,
        env: environment,
      });
      if (result.status !== 0) {
        console.error(`FAIL ${phase.id} COMMAND_EXIT_${result.status ?? 1}`);
        return result.status ?? 1;
      }
    }
    console.log(`PASS ${phase.id}`);
  }
  console.log('JOINT_GATE_PASS');
  return 0;
}

function sanitizedEnvironment() {
  return {
    ...process.env,
    NODE_ENV: 'test',
    PILOT_E2E: 'true',
    PILOT_E2E_BROWSER_CHANNEL: 'chrome',
    ARK_API_KEY: '',
    BYTEPLUS_TTS_ACCESS_TOKEN: '',
    BYTEPLUS_TTS_APP_ID: '',
  };
}
