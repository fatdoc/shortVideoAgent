#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const errors = [];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function nonEmpty(rel) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) {
    errors.push(`MISSING: ${rel}`);
    return;
  }
  const stat = fs.statSync(p);
  if (stat.isDirectory()) {
    const items = fs.readdirSync(p);
    if (items.length === 0) errors.push(`EMPTY_DIR: ${rel}`);
    return;
  }
  const content = fs.readFileSync(p, 'utf8').trim();
  if (!content) errors.push(`EMPTY_FILE: ${rel}`);
}

const requiredDocs = [
  'docs/00_README_FIRST.md',
  'README.md',
  'docs/memory/SHARED_MEMORY.md',
  'docs/memory/PRODUCT_SCOPE.md',
  'docs/memory/DEMO_STORY.md',
  'docs/memory/ARCHITECTURE.md',
  'docs/memory/ROUTES.md',
  'docs/memory/DATA_CONTRACTS.md',
  'docs/memory/INTERACTION_FLOW.md',
  'docs/memory/MOCK_DATA.md',
  'docs/memory/UI_REFERENCE_MAP.md',
  'docs/memory/DECISIONS.md',
  'docs/memory/RISKS_AND_BLOCKERS.md',
  'docs/memory/INTEGRATION_STATUS.md',
  'docs/ui/README.md',
  'docs/tasks/TASK_BOARD.md',
  'docs/tasks/DEPENDENCIES.md',
  'docs/tasks/ACCEPTANCE.md',
  'docs/tasks/DEMO_CHECKLIST.md',
  'docs/tasks/FILE_OWNERSHIP.md',
  'docs/tasks/GIT_WORKFLOW.md',
  'docs/tasks/GATE_0_REPORT.md',
  'docs/prompts/C0_GATE_REVIEW.md',
  'src/domain/types.ts',
  'src/domain/constants.ts',
  'src/mocks/demoWorkspace.ts',
  'src/app/Router.tsx',
];

for (const f of requiredDocs) nonEmpty(f);

for (let i = 0; i <= 7; i += 1) {
  nonEmpty(`docs/agents/C${i}_ROLE.md`);
}

for (let i = 1; i <= 7; i += 1) {
  nonEmpty(`docs/prompts/C${i}_START.md`);
  for (const name of ['STATUS.md', 'HANDOFF.md', 'CHANGELOG.md', 'REQUESTS.md']) {
    nonEmpty(`docs/threads/C${i}/${name}`);
  }
}

const pageDirs = [
  'src/pages/dashboard',
  'src/pages/brief',
  'src/pages/brand-brain',
  'src/pages/script-editor',
  'src/pages/storyboard',
  'src/pages/rough-cut',
];

for (const dir of pageDirs) {
  if (!exists(dir)) errors.push(`MISSING_DIR: ${dir}`);
  else nonEmpty(dir);
}

const uiDir = path.join(root, 'UI');
if (!fs.existsSync(uiDir)) {
  errors.push('MISSING_DIR: UI (reference images)');
} else {
  const images = fs.readdirSync(uiDir).filter((f) => f.toLowerCase().endsWith('.png'));
  if (images.length < 6) {
    errors.push(`UI_IMAGES: expected >= 6 png, found ${images.length}`);
  }
}

if (errors.length) {
  console.error('Governance validation FAILED:\n');
  for (const e of errors) console.error(` - ${e}`);
  process.exit(1);
}

console.log('Governance validation PASSED');
console.log(`Checked required docs, roles C0-C7, prompts C1-C7, thread memories, page dirs, data contracts, Gate0 report, UI refs.`);
