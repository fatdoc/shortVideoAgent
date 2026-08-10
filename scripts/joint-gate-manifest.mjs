export const JOINT_GATE_PHASE_IDS = [
  'root-unit',
  'control-api-postgres',
  'cross-plane-contract-v02',
  'storycanvas-v02-targeted',
  'pilot-browser-e2e',
  'ab-golden-path',
  'root-build',
  'control-api-build-typecheck',
  'storycanvas-build-targeted',
  'governance',
  'repository-diff-check',
  'migration-rollback-reapply',
];

const command = (executable, args, cwd = '.') => ({
  executable,
  args,
  cwd,
  shell: false,
});

export const jointGatePhases = [
  {
    id: 'root-unit',
    owner: 'A',
    requiredInFull: true,
    availability: 'ready',
    description:
      'Run the root Vitest suite without replacing Pilot evidence with Demo smoke tests.',
    commands: [command('npm', ['test'])],
    preconditions: [],
  },
  {
    id: 'control-api-postgres',
    owner: 'A',
    requiredInFull: true,
    availability: 'ready',
    description:
      'Run all Control API tests against a dedicated PostgreSQL database and reject silent PostgreSQL skips.',
    commands: [command('npm', ['--prefix', 'apps/control-api', 'test'])],
    preconditions: [
      {
        type: 'environment',
        name: 'CONTROL_API_TEST_DATABASE_URL',
        validator: 'dedicated-postgres-test-url',
      },
    ],
  },
  {
    id: 'cross-plane-contract-v02',
    owner: 'A/B',
    requiredInFull: true,
    availability: 'ready',
    description: 'Run C01 v0.2 plus A3/B3 contract, authorization, replay, and security oracles.',
    commands: [command('node', ['tests/e2e/pilot/run-contract-gate.mjs'])],
    preconditions: [],
  },
  {
    id: 'storycanvas-v02-targeted',
    owner: 'B',
    requiredInFull: true,
    availability: 'ready',
    description:
      'Run the frozen StoryCanvas v0.2 runtime, security, public route, and durable receiver tests explicitly.',
    commands: [command('node', ['scripts/run-storycanvas-v02-targeted.mjs'])],
    evidencePaths: [
      'apps/storycanvas/src/contracts/v0.2/runtime.test.ts',
      'apps/storycanvas/src/contracts/v0.2/security.test.ts',
      'apps/storycanvas/src/routes/production/v0.2/index.test.ts',
      'apps/storycanvas/src/services/storycanvas/pilotV02Receiver.test.ts',
    ],
    preconditions: [],
  },
  {
    id: 'pilot-browser-e2e',
    owner: 'A',
    requiredInFull: true,
    availability: 'ready',
    description:
      'Run the Wave 4 browser matrix with a real Session Cookie and deterministic dedicated database harness.',
    commands: [command('npm', ['run', 'test:e2e:pilot'])],
    preconditions: [
      {
        type: 'environment',
        name: 'CONTROL_API_TEST_DATABASE_URL',
        validator: 'dedicated-postgres-test-url',
      },
    ],
  },
  {
    id: 'ab-golden-path',
    owner: 'A/B',
    requiredInFull: true,
    availability: 'external',
    description:
      'Verify canonical Project Context through approved Script, Storyboard draft, Production Package, and Canvas entry.',
    commands: [command('npx', ['playwright', 'test', 'tests/e2e/pilot/ab-golden-path.spec.ts'])],
    preconditions: [
      {
        type: 'environment',
        name: 'JOINT_GATE_B_BASELINE_COMMIT',
        validator: 'non-empty',
      },
      {
        type: 'slice',
        name: 'A-BIZ-06E',
        code: 'AB_GOLDEN_PATH_NOT_IMPLEMENTED',
      },
    ],
  },
  {
    id: 'root-build',
    owner: 'A/B',
    requiredInFull: true,
    availability: 'ready',
    description: 'Build the unified SaaS TypeScript and Vite application.',
    commands: [command('npm', ['run', 'build'])],
    preconditions: [],
  },
  {
    id: 'control-api-build-typecheck',
    owner: 'A',
    requiredInFull: true,
    availability: 'ready',
    description: 'Build and typecheck the Control API independently.',
    commands: [
      command('npm', ['--prefix', 'apps/control-api', 'run', 'build']),
      command('npm', ['--prefix', 'apps/control-api', 'run', 'typecheck']),
    ],
    preconditions: [],
  },
  {
    id: 'storycanvas-build-targeted',
    owner: 'B',
    requiredInFull: true,
    availability: 'external',
    description:
      'Run the B-owned frozen StoryCanvas build/type gate only after a committed, synchronized clean baseline.',
    commands: [command('npm', ['--prefix', 'apps/storycanvas', 'run', 'build'])],
    preconditions: [
      {
        type: 'environment',
        name: 'JOINT_GATE_B_BASELINE_COMMIT',
        validator: 'non-empty',
      },
    ],
  },
  {
    id: 'governance',
    owner: 'A/B',
    requiredInFull: true,
    availability: 'ready',
    description: 'Validate program governance, contracts, roles, pages, and thread memory.',
    commands: [command('npm', ['run', 'validate:governance'])],
    preconditions: [],
  },
  {
    id: 'repository-diff-check',
    owner: 'A/B',
    requiredInFull: true,
    availability: 'ready',
    description:
      'Reject whitespace errors, staged whitespace errors, and uncommitted tracked StoryCanvas changes.',
    commands: [
      command('git', ['diff', '--check']),
      command('git', ['diff', '--cached', '--check']),
      command('git', ['diff', '--quiet', '--', 'apps/storycanvas']),
      command('git', ['diff', '--cached', '--quiet', '--', 'apps/storycanvas']),
    ],
    preconditions: [],
  },
  {
    id: 'migration-rollback-reapply',
    owner: 'A',
    requiredInFull: true,
    availability: 'planned',
    description:
      'Verify fresh migration, one-batch rollback, and deterministic reapply against the dedicated test database.',
    commands: [command('node', ['scripts/run-control-api-migration-gate.mjs'])],
    preconditions: [
      {
        type: 'environment',
        name: 'CONTROL_API_TEST_DATABASE_URL',
        validator: 'dedicated-postgres-test-url',
      },
      {
        type: 'slice',
        name: 'A-BIZ-06F',
        code: 'MIGRATION_ROLLBACK_GATE_NOT_IMPLEMENTED',
      },
    ],
  },
];

export function validateDedicatedPostgresTestUrl(value) {
  if (!value) {
    return { ok: false, code: 'CONTROL_API_TEST_DATABASE_URL_REQUIRED' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, code: 'CONTROL_API_TEST_DATABASE_URL_INVALID' };
  }

  if (!new Set(['postgres:', 'postgresql:']).has(parsed.protocol)) {
    return { ok: false, code: 'CONTROL_API_TEST_DATABASE_URL_INVALID_PROTOCOL' };
  }

  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  if (!databaseName.endsWith('_test') || databaseName === 'videoagent_control') {
    return { ok: false, code: 'CONTROL_API_TEST_DATABASE_URL_NOT_DEDICATED' };
  }

  return { ok: true, databaseName };
}
