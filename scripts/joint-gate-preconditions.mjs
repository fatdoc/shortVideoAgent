import { spawnSync } from 'node:child_process';

export function validateSynchronizedGitCommit(
  value,
  { repositoryRoot = process.cwd(), spawnSyncImpl = spawnSync } = {},
) {
  if (!value) {
    return { ok: false, code: 'JOINT_GATE_B_BASELINE_ATTESTATION_REQUIRED' };
  }
  if (!/^[0-9a-f]{40}$/i.test(value)) {
    return { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_INVALID' };
  }

  try {
    const object = spawnSyncImpl('git', ['cat-file', '-e', `${value}^{commit}`], {
      cwd: repositoryRoot,
      shell: false,
      stdio: 'ignore',
    });
    if (object.status !== 0) {
      return { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_INVALID' };
    }

    const ancestor = spawnSyncImpl('git', ['merge-base', '--is-ancestor', value, 'HEAD'], {
      cwd: repositoryRoot,
      shell: false,
      stdio: 'ignore',
    });
    if (ancestor.status === 0) return { ok: true };
    if (ancestor.status === 1) {
      return { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_NOT_ANCESTOR' };
    }
    return { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_INVALID' };
  } catch {
    return { ok: false, code: 'JOINT_GATE_B_BASELINE_COMMIT_INVALID' };
  }
}
