import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SharedCanvasRemediationGitAttestationError,
  attestSharedCanvasRemediationGit,
  type SharedCanvasRemediationGitAttestationInput,
  type SharedCanvasRemediationGitProbe,
  type SharedCanvasRemediationGitProbeResult,
} from './sharedCanvasRemediationGitAttestation.js';

const REPOSITORY_ROOT = '/workspace/shortVideoAgent';
const COMMITS = {
  baseline: '1111111111111111111111111111111111111111',
  red: '2222222222222222222222222222222222222222',
  parser: '3333333333333333333333333333333333333333',
  lifecycle: '4444444444444444444444444444444444444444',
  log: '5555555555555555555555555555555555555555',
  docs: '6666666666666666666666666666666666666666',
  candidate: '7777777777777777777777777777777777777777',
  requiredA: '8888888888888888888888888888888888888888',
} as const;
const RESPONSE_DOCUMENT =
  'docs/collaboration/production-plane/B_TO_A_AGENT_SHARED_CANVAS_CAPABILITY_REMEDIATION_RESPONSE_2026-08-12.md';
const FORBIDDEN_PATH = 'src/config/pilotE2eProxy.ts';
const SECRET = 'FAKE_GIT_FAILURE_SECRET_DO_NOT_USE';

const VALID_WRITE_SETS: Record<string, string> = {
  [COMMITS.red]: changes([
    ['A', 'apps/storycanvas/src/routes/production/pilot/canvas/requestSafety.test.ts'],
  ]),
  [COMMITS.parser]: changes([
    ['M', 'apps/storycanvas/src/app.ts'],
    ['A', 'apps/storycanvas/src/routes/production/pilot/canvas/requestSafety.test.ts'],
  ]),
  [COMMITS.lifecycle]: changes([
    ['M', 'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts'],
    ['M', 'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.test.ts'],
  ]),
  [COMMITS.log]: changes([
    ['M', 'apps/storycanvas/src/utils/db.ts'],
    ['A', 'apps/storycanvas/src/utils/db.pilot.test.ts'],
  ]),
  [COMMITS.docs]: changes([['A', RESPONSE_DOCUMENT]]),
};

type GitCall = {
  executable: string;
  args: readonly string[];
  options: {
    cwd: string;
    shell: false;
    encoding: 'buffer';
    maxBuffer: number;
    stdio: readonly ['ignore', 'pipe', 'ignore'];
  };
};

function changes(entries: ReadonlyArray<readonly [string, ...string[]]>): string {
  return `${entries.flat().join('\0')}\0`;
}

function input(
  overrides: Partial<SharedCanvasRemediationGitAttestationInput['commits']> = {},
): SharedCanvasRemediationGitAttestationInput {
  return {
    repositoryRoot: REPOSITORY_ROOT,
    commits: { ...COMMITS, ...overrides },
  };
}

function successfulProbe(writeSets: Record<string, string> = VALID_WRITE_SETS): {
  calls: GitCall[];
  probe: SharedCanvasRemediationGitProbe;
} {
  const calls: GitCall[] = [];
  const probe: SharedCanvasRemediationGitProbe = async (executable, args, options) => {
    calls.push({ executable, args, options });
    if (args[0] === 'diff-tree') {
      const commit = args.at(-1);
      return result(0, commit ? writeSets[commit] : undefined);
    }
    return result(0);
  };
  return { calls, probe };
}

function queuedProbe(queued: Array<SharedCanvasRemediationGitProbeResult | Error>): {
  calls: GitCall[];
  probe: SharedCanvasRemediationGitProbe;
} {
  const calls: GitCall[] = [];
  const probe: SharedCanvasRemediationGitProbe = async (executable, args, options) => {
    calls.push({ executable, args, options });
    const next = queued.shift();
    if (next instanceof Error) throw next;
    return next ?? result(0);
  };
  return { calls, probe };
}

function result(status: number | null, stdout = ''): SharedCanvasRemediationGitProbeResult {
  return { status, stdout: Buffer.from(stdout), signal: null, error: undefined };
}

async function expectSafeCode(
  promise: Promise<unknown>,
  code: string,
  forbidden: readonly string[] = [],
): Promise<void> {
  await assert.rejects(promise, (error: Error) => {
    assert.ok(error instanceof SharedCanvasRemediationGitAttestationError);
    assert.equal(error.message, code);
    assert.equal(error.stack, undefined);
    const serialized = JSON.stringify(error);
    for (const value of [
      ...Object.values(COMMITS),
      REPOSITORY_ROOT,
      FORBIDDEN_PATH,
      SECRET,
      ...forbidden,
    ]) {
      if (value.length === 0) continue;
      assert.doesNotMatch(
        serialized,
        new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      );
    }
    return true;
  });
}

test('requires every attestation to be a complete 40-character SHA before Git is invoked', async () => {
  for (const [role, value, code] of [
    ['baseline', '', 'SHARED_CANVAS_ATTESTATION_REQUIRED'],
    ['red', '2222222', 'SHARED_CANVAS_COMMIT_INVALID'],
    ['parser', 'z'.repeat(40), 'SHARED_CANVAS_COMMIT_INVALID'],
    ['candidate', `${COMMITS.candidate}0`, 'SHARED_CANVAS_COMMIT_INVALID'],
  ] as const) {
    const git = successfulProbe();
    await expectSafeCode(
      attestSharedCanvasRemediationGit(input({ [role]: value }), { git: git.probe }),
      code,
    );
    assert.equal(git.calls.length, 0);
  }
});

test('requires the seven atomic remediation role SHAs to be pairwise distinct', async () => {
  const atomicRoles = [
    'baseline',
    'red',
    'parser',
    'lifecycle',
    'log',
    'docs',
    'candidate',
  ] as const;

  for (let sourceIndex = 0; sourceIndex < atomicRoles.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < atomicRoles.length; targetIndex += 1) {
      const sourceRole = atomicRoles[sourceIndex];
      const targetRole = atomicRoles[targetIndex];
      const duplicate =
        targetIndex === atomicRoles.length - 1
          ? COMMITS[sourceRole].toUpperCase()
          : COMMITS[sourceRole];
      const git = successfulProbe();

      await expectSafeCode(
        attestSharedCanvasRemediationGit(input({ [targetRole]: duplicate }), { git: git.probe }),
        'SHARED_CANVAS_COMMIT_ORDER_INVALID',
      );
      assert.equal(git.calls.length, 0);
    }
  }
});

test('treats differently-cased forms of one SHA as the same atomic commit', async () => {
  const git = successfulProbe();
  const duplicateSha = 'abcdefabcdefabcdefabcdefabcdefabcdefabcd';

  await expectSafeCode(
    attestSharedCanvasRemediationGit(
      input({
        baseline: duplicateSha,
        red: duplicateSha.toUpperCase(),
      }),
      { git: git.probe },
    ),
    'SHARED_CANVAS_COMMIT_ORDER_INVALID',
  );
  assert.equal(git.calls.length, 0);
});

test('allows requiredA to reuse an atomic-role SHA while still requiring its ancestor probe', async () => {
  const git = successfulProbe();
  const attestation = await attestSharedCanvasRemediationGit(
    input({ requiredA: COMMITS.baseline }),
    { git: git.probe },
  );

  assert.deepEqual(attestation, {
    verifiedCommitCount: 8,
    verifiedWriteSetCount: 5,
  });
  assert.deepEqual(git.calls[14]?.args, [
    'merge-base',
    '--is-ancestor',
    COMMITS.baseline,
    COMMITS.candidate,
  ]);
});

test('rejects an empty or non-absolute repository root before invoking Git', async () => {
  for (const repositoryRoot of [
    '',
    'relative/repository',
    './shortVideoAgent',
    '  /tmp/repository',
  ]) {
    const git = successfulProbe();
    await expectSafeCode(
      attestSharedCanvasRemediationGit(
        {
          ...input(),
          repositoryRoot,
        },
        { git: git.probe },
      ),
      'SHARED_CANVAS_GIT_PROBE_FAILED',
      [repositoryRoot],
    );
    assert.equal(git.calls.length, 0);
  }
});

test('accepts the ordered atomic remediation chain through shell-free bounded Git probes', async () => {
  const git = successfulProbe();

  const attestation = await attestSharedCanvasRemediationGit(input(), { git: git.probe });

  assert.deepEqual(attestation, {
    verifiedCommitCount: 8,
    verifiedWriteSetCount: 5,
  });
  assert.deepEqual(
    git.calls.slice(0, 8).map(({ executable, args }) => ({ executable, args })),
    Object.values(COMMITS).map((commit) => ({
      executable: 'git',
      args: ['cat-file', '-e', `${commit}^{commit}`],
    })),
  );
  assert.deepEqual(
    git.calls.slice(8, 15).map(({ args }) => args),
    [
      ['merge-base', '--is-ancestor', COMMITS.baseline, COMMITS.red],
      ['merge-base', '--is-ancestor', COMMITS.red, COMMITS.parser],
      ['merge-base', '--is-ancestor', COMMITS.parser, COMMITS.lifecycle],
      ['merge-base', '--is-ancestor', COMMITS.lifecycle, COMMITS.log],
      ['merge-base', '--is-ancestor', COMMITS.log, COMMITS.docs],
      ['merge-base', '--is-ancestor', COMMITS.docs, COMMITS.candidate],
      ['merge-base', '--is-ancestor', COMMITS.requiredA, COMMITS.candidate],
    ],
  );
  assert.deepEqual(
    git.calls.slice(15).map(({ args }) => args),
    [COMMITS.red, COMMITS.parser, COMMITS.lifecycle, COMMITS.log, COMMITS.docs].map((commit) => [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-r',
      '-z',
      commit,
    ]),
  );
  for (const call of git.calls) {
    assert.equal(call.executable, 'git');
    assert.equal(call.options.cwd, REPOSITORY_ROOT);
    assert.equal(call.options.shell, false);
    assert.equal(call.options.encoding, 'buffer');
    assert.deepEqual(call.options.stdio, ['ignore', 'pipe', 'ignore']);
    assert.ok(call.options.maxBuffer > 0 && call.options.maxBuffer <= 1_048_576);
  }
});

test('fails closed when a commit object is missing or Git probing fails', async () => {
  const missing = queuedProbe([result(128)]);
  await expectSafeCode(
    attestSharedCanvasRemediationGit(input(), { git: missing.probe }),
    'SHARED_CANVAS_COMMIT_INVALID',
  );
  assert.equal(missing.calls.length, 1);

  const thrown = queuedProbe([
    new Error(`fatal: ${SECRET} ${COMMITS.baseline} ${REPOSITORY_ROOT}`),
  ]);
  await expectSafeCode(
    attestSharedCanvasRemediationGit(input(), { git: thrown.probe }),
    'SHARED_CANVAS_GIT_PROBE_FAILED',
  );

  const abnormal = queuedProbe([result(null)]);
  await expectSafeCode(
    attestSharedCanvasRemediationGit(input(), { git: abnormal.probe }),
    'SHARED_CANVAS_GIT_PROBE_FAILED',
  );
});

test('requires the baseline and every remediation role to precede the candidate', async () => {
  for (let failedEdge = 0; failedEdge < 6; failedEdge += 1) {
    const queue = [
      ...Array.from({ length: 8 }, () => result(0)),
      ...Array.from({ length: failedEdge }, () => result(0)),
      result(1),
    ];
    const git = queuedProbe(queue);
    await expectSafeCode(
      attestSharedCanvasRemediationGit(input(), { git: git.probe }),
      'SHARED_CANVAS_COMMIT_ORDER_INVALID',
    );
    assert.equal(git.calls.length, 9 + failedEdge);
  }
});

test('requires the designated A baseline to be an ancestor of the candidate', async () => {
  const git = queuedProbe([
    ...Array.from({ length: 8 }, () => result(0)),
    ...Array.from({ length: 6 }, () => result(0)),
    result(1),
  ]);

  await expectSafeCode(
    attestSharedCanvasRemediationGit(input(), { git: git.probe }),
    'SHARED_CANVAS_REQUIRED_A_BASELINE_MISSING',
  );
});

test('normalizes unexpected merge-base and diff-tree failures to one safe Git code', async () => {
  const mergeFailure = queuedProbe([
    ...Array.from({ length: 8 }, () => result(0)),
    result(128, `${SECRET}\0${FORBIDDEN_PATH}\0`),
  ]);
  await expectSafeCode(
    attestSharedCanvasRemediationGit(input(), { git: mergeFailure.probe }),
    'SHARED_CANVAS_GIT_PROBE_FAILED',
  );

  const diffFailure = queuedProbe([
    ...Array.from({ length: 15 }, () => result(0)),
    result(128, `${SECRET}\0${FORBIDDEN_PATH}\0`),
  ]);
  await expectSafeCode(
    attestSharedCanvasRemediationGit(input(), { git: diffFailure.probe }),
    'SHARED_CANVAS_GIT_PROBE_FAILED',
  );
});

test('enforces the RED and GREEN role write sets', async () => {
  const invalidSets: Array<[string, string]> = [
    [COMMITS.red, changes([['M', 'apps/storycanvas/src/app.ts']])],
    [COMMITS.parser, changes([['M', 'apps/storycanvas/src/utils/db.ts']])],
    [COMMITS.lifecycle, changes([['M', 'apps/storycanvas/src/utils/getPath.ts']])],
    [COMMITS.log, changes([['M', 'apps/storycanvas/src/agents/productionAgent/index.ts']])],
  ];

  for (const [commit, invalidWriteSet] of invalidSets) {
    const git = successfulProbe({ ...VALID_WRITE_SETS, [commit]: invalidWriteSet });
    await expectSafeCode(
      attestSharedCanvasRemediationGit(input(), { git: git.probe }),
      'SHARED_CANVAS_WRITE_SET_VIOLATION',
      [invalidWriteSet],
    );
  }
});

test('rejects forbidden shared, Control API, Golden Path, and vendor paths in every role', async () => {
  const forbiddenPaths = [
    'apps/storycanvas/data/vendor/byteplus.ts',
    'apps/control-api/src/server.ts',
    'src/app/Router.tsx',
    'src/app/Router.pilot.test.tsx',
    'src/services/pilotStoryCanvasBridge.ts',
    'src/services/pilotStoryCanvasBridge.test.ts',
    'src/config/pilotE2eProxy.ts',
    'src/config/pilotE2eProxy.test.ts',
    'tests/e2e/pilot/browser/ab-golden-path.spec.ts',
  ];

  for (const forbiddenPath of forbiddenPaths) {
    for (const roleCommit of [
      COMMITS.red,
      COMMITS.parser,
      COMMITS.lifecycle,
      COMMITS.log,
      COMMITS.docs,
    ]) {
      const git = successfulProbe({
        ...VALID_WRITE_SETS,
        [roleCommit]: changes([['M', forbiddenPath]]),
      });
      await expectSafeCode(
        attestSharedCanvasRemediationGit(input(), { git: git.probe }),
        'SHARED_CANVAS_WRITE_SET_VIOLATION',
        [forbiddenPath],
      );
    }
  }
});

test('requires the docs role to add exactly the frozen response document', async () => {
  for (const invalidDocs of [
    changes([['M', RESPONSE_DOCUMENT]]),
    changes([['A', 'docs/collaboration/production-plane/UNPLANNED.md']]),
    changes([
      ['A', RESPONSE_DOCUMENT],
      ['A', 'docs/program/threads/C0/STATUS.md'],
    ]),
  ]) {
    const git = successfulProbe({ ...VALID_WRITE_SETS, [COMMITS.docs]: invalidDocs });
    await expectSafeCode(
      attestSharedCanvasRemediationGit(input(), { git: git.probe }),
      'SHARED_CANVAS_DOCS_WRITE_SET_INVALID',
      [invalidDocs],
    );
  }
});

test('rejects empty, malformed, renamed, deleted, or oversized Git write-set output safely', async () => {
  const cases = [
    '',
    'M\0unterminated',
    changes([['R100', 'apps/storycanvas/src/app.ts', 'apps/storycanvas/src/app-renamed.ts']]),
    changes([['D', 'apps/storycanvas/src/app.ts']]),
    `${'M\0apps/storycanvas/src/app.ts\0'.repeat(9_000)}`,
  ];

  for (const invalidOutput of cases) {
    const git = successfulProbe({ ...VALID_WRITE_SETS, [COMMITS.parser]: invalidOutput });
    await expectSafeCode(
      attestSharedCanvasRemediationGit(input(), { git: git.probe }),
      invalidOutput.length > 131_072
        ? 'SHARED_CANVAS_GIT_PROBE_FAILED'
        : 'SHARED_CANVAS_WRITE_SET_VIOLATION',
      [invalidOutput.slice(0, 128)],
    );
  }
});
