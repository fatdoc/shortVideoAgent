import { isAbsolute } from 'node:path';

export type SharedCanvasRemediationGitAttestationErrorCode =
  | 'SHARED_CANVAS_ATTESTATION_REQUIRED'
  | 'SHARED_CANVAS_COMMIT_INVALID'
  | 'SHARED_CANVAS_COMMIT_ORDER_INVALID'
  | 'SHARED_CANVAS_REQUIRED_A_BASELINE_MISSING'
  | 'SHARED_CANVAS_WRITE_SET_VIOLATION'
  | 'SHARED_CANVAS_DOCS_WRITE_SET_INVALID'
  | 'SHARED_CANVAS_GIT_PROBE_FAILED';

export class SharedCanvasRemediationGitAttestationError extends Error {
  constructor(readonly code: SharedCanvasRemediationGitAttestationErrorCode) {
    super(code);
    this.name = 'SharedCanvasRemediationGitAttestationError';
    this.stack = undefined;
  }
}

export interface SharedCanvasRemediationCommitAttestations {
  baseline: string;
  red: string;
  parser: string;
  lifecycle: string;
  log: string;
  docs: string;
  candidate: string;
  requiredA: string;
}

export interface SharedCanvasRemediationGitAttestationInput {
  repositoryRoot: string;
  commits: SharedCanvasRemediationCommitAttestations;
}

export interface SharedCanvasRemediationGitProbeResult {
  status: number | null;
  stdout: Buffer;
  signal: NodeJS.Signals | null;
  error: Error | undefined;
}

export interface SharedCanvasRemediationGitProbeOptions {
  cwd: string;
  shell: false;
  encoding: 'buffer';
  maxBuffer: number;
  stdio: readonly ['ignore', 'pipe', 'ignore'];
}

export type SharedCanvasRemediationGitProbe = (
  executable: 'git',
  args: readonly string[],
  options: SharedCanvasRemediationGitProbeOptions,
) => SharedCanvasRemediationGitProbeResult | Promise<SharedCanvasRemediationGitProbeResult>;

export interface SharedCanvasRemediationGitAttestationDependencies {
  git: SharedCanvasRemediationGitProbe;
}

export interface SharedCanvasRemediationGitAttestationResult {
  verifiedCommitCount: number;
  verifiedWriteSetCount: number;
}

type RemediationRole = 'red' | 'parser' | 'lifecycle' | 'log' | 'docs';

type ChangedPath = {
  status: 'A' | 'M';
  path: string;
};

const FULL_COMMIT_SHA = /^[0-9a-f]{40}$/i;
const MAX_GIT_OUTPUT_BYTES = 131_072;
const GIT_MAX_BUFFER_BYTES = 262_144;
const RESPONSE_DOCUMENT =
  'docs/collaboration/production-plane/B_TO_A_AGENT_SHARED_CANVAS_CAPABILITY_REMEDIATION_RESPONSE_2026-08-12.md';

const COMMIT_ROLES = [
  'baseline',
  'red',
  'parser',
  'lifecycle',
  'log',
  'docs',
  'candidate',
  'requiredA',
] as const satisfies readonly (keyof SharedCanvasRemediationCommitAttestations)[];

const ATOMIC_COMMIT_ROLES = [
  'baseline',
  'red',
  'parser',
  'lifecycle',
  'log',
  'docs',
  'candidate',
] as const satisfies readonly (keyof SharedCanvasRemediationCommitAttestations)[];

const WRITE_SET_ROLES = ['red', 'parser', 'lifecycle', 'log', 'docs'] as const;

const FORBIDDEN_EXACT_PATHS = new Set([
  'apps/storycanvas/data/vendor/byteplus.ts',
  'src/app/Router.tsx',
  'src/app/Router.pilot.test.tsx',
  'src/services/pilotStoryCanvasBridge.ts',
  'src/services/pilotStoryCanvasBridge.test.ts',
  'src/config/pilotE2eProxy.ts',
  'src/config/pilotE2eProxy.test.ts',
  'tests/e2e/pilot/browser/ab-golden-path.spec.ts',
]);

const PARSER_RUNTIME_FILES = new Set([
  'apps/storycanvas/src/app.ts',
  'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts',
  'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.test.ts',
]);

const LIFECYCLE_FILES = new Set([
  'apps/storycanvas/src/app.ts',
  'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.ts',
  'apps/storycanvas/src/services/storycanvas/pilotCanvasCapability.test.ts',
]);

const LOG_CONTAINMENT_FILES = new Set([
  'apps/storycanvas/src/app.ts',
  'apps/storycanvas/src/app.test.ts',
  'apps/storycanvas/src/utils/db.ts',
  'apps/storycanvas/src/utils/db.test.ts',
  'apps/storycanvas/src/utils/db.pilot.test.ts',
  'apps/storycanvas/src/utils/getPath.ts',
  'apps/storycanvas/src/utils/getPath.test.ts',
  'apps/storycanvas/src/utils/getPath.pilot.test.ts',
]);

function fail(code: SharedCanvasRemediationGitAttestationErrorCode): never {
  throw new SharedCanvasRemediationGitAttestationError(code);
}

function assertRepositoryRoot(repositoryRoot: string): void {
  if (
    typeof repositoryRoot !== 'string' ||
    repositoryRoot.length === 0 ||
    repositoryRoot.trim() !== repositoryRoot ||
    !isAbsolute(repositoryRoot)
  ) {
    fail('SHARED_CANVAS_GIT_PROBE_FAILED');
  }
}

function assertCommitAttestations(commits: SharedCanvasRemediationCommitAttestations): void {
  for (const role of COMMIT_ROLES) {
    const commit = commits?.[role];
    if (typeof commit !== 'string' || commit.length === 0) {
      fail('SHARED_CANVAS_ATTESTATION_REQUIRED');
    }
    if (!FULL_COMMIT_SHA.test(commit)) fail('SHARED_CANVAS_COMMIT_INVALID');
  }

  const atomicCommits = ATOMIC_COMMIT_ROLES.map((role) => commits[role].toLowerCase());
  if (new Set(atomicCommits).size !== atomicCommits.length) {
    fail('SHARED_CANVAS_COMMIT_ORDER_INVALID');
  }
}

function gitOptions(repositoryRoot: string): SharedCanvasRemediationGitProbeOptions {
  return {
    cwd: repositoryRoot,
    shell: false,
    encoding: 'buffer',
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    stdio: ['ignore', 'pipe', 'ignore'],
  };
}

async function probeGit(
  repositoryRoot: string,
  dependencies: SharedCanvasRemediationGitAttestationDependencies,
  args: readonly string[],
): Promise<SharedCanvasRemediationGitProbeResult> {
  let result: SharedCanvasRemediationGitProbeResult;
  try {
    result = await dependencies.git('git', args, gitOptions(repositoryRoot));
  } catch {
    fail('SHARED_CANVAS_GIT_PROBE_FAILED');
  }

  if (
    !result ||
    result.error !== undefined ||
    result.signal !== null ||
    !Buffer.isBuffer(result.stdout) ||
    result.stdout.byteLength > MAX_GIT_OUTPUT_BYTES
  ) {
    fail('SHARED_CANVAS_GIT_PROBE_FAILED');
  }
  return result;
}

async function assertCommitObjects(
  input: SharedCanvasRemediationGitAttestationInput,
  dependencies: SharedCanvasRemediationGitAttestationDependencies,
): Promise<void> {
  for (const role of COMMIT_ROLES) {
    const commit = input.commits[role];
    const result = await probeGit(input.repositoryRoot, dependencies, [
      'cat-file',
      '-e',
      `${commit}^{commit}`,
    ]);
    if (result.status === null) fail('SHARED_CANVAS_GIT_PROBE_FAILED');
    if (result.status !== 0) fail('SHARED_CANVAS_COMMIT_INVALID');
  }
}

async function readAncestorStatus(
  input: SharedCanvasRemediationGitAttestationInput,
  dependencies: SharedCanvasRemediationGitAttestationDependencies,
  ancestor: string,
  descendant: string,
): Promise<boolean> {
  const result = await probeGit(input.repositoryRoot, dependencies, [
    'merge-base',
    '--is-ancestor',
    ancestor,
    descendant,
  ]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  fail('SHARED_CANVAS_GIT_PROBE_FAILED');
}

async function assertCommitOrder(
  input: SharedCanvasRemediationGitAttestationInput,
  dependencies: SharedCanvasRemediationGitAttestationDependencies,
): Promise<void> {
  const { commits } = input;
  const orderedEdges: ReadonlyArray<readonly [string, string]> = [
    [commits.baseline, commits.red],
    [commits.red, commits.parser],
    [commits.parser, commits.lifecycle],
    [commits.lifecycle, commits.log],
    [commits.log, commits.docs],
    [commits.docs, commits.candidate],
  ];

  for (const [ancestor, descendant] of orderedEdges) {
    if (!(await readAncestorStatus(input, dependencies, ancestor, descendant))) {
      fail('SHARED_CANVAS_COMMIT_ORDER_INVALID');
    }
  }

  if (!(await readAncestorStatus(input, dependencies, commits.requiredA, commits.candidate))) {
    fail('SHARED_CANVAS_REQUIRED_A_BASELINE_MISSING');
  }
}

function parseChangedPaths(stdout: Buffer): ChangedPath[] {
  if (stdout.byteLength === 0 || stdout.at(-1) !== 0) {
    fail('SHARED_CANVAS_WRITE_SET_VIOLATION');
  }

  const fields = stdout.toString('utf8').split('\0');
  fields.pop();
  if (fields.length === 0 || fields.length % 2 !== 0) {
    fail('SHARED_CANVAS_WRITE_SET_VIOLATION');
  }

  const changes: ChangedPath[] = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    const path = fields[index + 1];
    if ((status !== 'A' && status !== 'M') || !isSafeRepositoryPath(path)) {
      fail('SHARED_CANVAS_WRITE_SET_VIOLATION');
    }
    changes.push({ status, path });
  }
  return changes;
}

function isSafeRepositoryPath(path: string): boolean {
  return (
    path.length > 0 &&
    !path.startsWith('/') &&
    !path.startsWith('../') &&
    !path.includes('/../') &&
    !path.includes('\\') &&
    !path.includes('\r') &&
    !path.includes('\n')
  );
}

function isForbiddenPath(path: string): boolean {
  return path.startsWith('apps/control-api/') || FORBIDDEN_EXACT_PATHS.has(path);
}

function isStoryCanvasTest(path: string): boolean {
  return /^apps\/storycanvas\/src\/.+\.test\.tsx?$/.test(path);
}

function isPilotCanvasRoute(path: string): boolean {
  return /^apps\/storycanvas\/src\/routes\/production\/pilot\/canvas\/.+\.tsx?$/.test(path);
}

function isParserWrite(path: string): boolean {
  return PARSER_RUNTIME_FILES.has(path) || isPilotCanvasRoute(path);
}

function isLifecycleWrite(path: string): boolean {
  return LIFECYCLE_FILES.has(path) || isPilotCanvasRoute(path);
}

function isLogContainmentWrite(path: string): boolean {
  return LOG_CONTAINMENT_FILES.has(path);
}

function assertRoleWriteSet(role: RemediationRole, changes: readonly ChangedPath[]): void {
  if (changes.some(({ path }) => isForbiddenPath(path))) {
    fail('SHARED_CANVAS_WRITE_SET_VIOLATION');
  }

  if (role === 'docs') {
    if (
      changes.length !== 1 ||
      changes[0].status !== 'A' ||
      changes[0].path !== RESPONSE_DOCUMENT
    ) {
      fail('SHARED_CANVAS_DOCS_WRITE_SET_INVALID');
    }
    return;
  }

  const valid = changes.every(({ path }) => {
    switch (role) {
      case 'red':
        return isStoryCanvasTest(path);
      case 'parser':
        return isParserWrite(path);
      case 'lifecycle':
        return isLifecycleWrite(path);
      case 'log':
        return isLogContainmentWrite(path);
    }
  });
  if (!valid) fail('SHARED_CANVAS_WRITE_SET_VIOLATION');
}

async function assertWriteSets(
  input: SharedCanvasRemediationGitAttestationInput,
  dependencies: SharedCanvasRemediationGitAttestationDependencies,
): Promise<void> {
  for (const role of WRITE_SET_ROLES) {
    const result = await probeGit(input.repositoryRoot, dependencies, [
      'diff-tree',
      '--no-commit-id',
      '--name-status',
      '-r',
      '-z',
      input.commits[role],
    ]);
    if (result.status !== 0) fail('SHARED_CANVAS_GIT_PROBE_FAILED');
    assertRoleWriteSet(role, parseChangedPaths(result.stdout));
  }
}

export async function attestSharedCanvasRemediationGit(
  input: SharedCanvasRemediationGitAttestationInput,
  dependencies: SharedCanvasRemediationGitAttestationDependencies,
): Promise<SharedCanvasRemediationGitAttestationResult> {
  assertRepositoryRoot(input.repositoryRoot);
  assertCommitAttestations(input.commits);
  await assertCommitObjects(input, dependencies);
  await assertCommitOrder(input, dependencies);
  await assertWriteSets(input, dependencies);

  return {
    verifiedCommitCount: COMMIT_ROLES.length,
    verifiedWriteSetCount: WRITE_SET_ROLES.length,
  };
}
