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
  'docs/program/README.md',
  'docs/program/PROJECT_CHARTER.md',
  'docs/program/COMMON_MEMORY.md',
  'docs/program/GLOSSARY.md',
  'docs/program/ARCHITECTURE.md',
  'docs/program/REPOSITORY_MAP.md',
  'docs/program/INTEGRATION_CONTRACT.md',
  'docs/program/ROLE_BOUNDARIES.md',
  'docs/program/ROLE_WORKBENCHES.md',
  'docs/program/DECISION_RIGHTS.md',
  'docs/program/EMPLOYEE_RULES.md',
  'docs/program/AUTONOMY_PROTOCOL.md',
  'docs/program/ROADMAP_AND_GATES.md',
  'docs/program/SOURCE_REGISTER.md',
  'docs/program/templates/REQUEST_TEMPLATE.md',
  'docs/program/templates/HANDOFF_TEMPLATE.md',
  'docs/program/templates/ADR_TEMPLATE.md',
  'docs/memory/SHARED_MEMORY.md',
  'docs/memory/DECISIONS.md',
  'docs/tasks/DEPENDENCIES.md',
  'docs/tasks/ACCEPTANCE.md',
  'docs/tasks/FILE_OWNERSHIP.md',
  'docs/tasks/GIT_WORKFLOW.md',
  'src/domain/types.ts',
  'src/domain/constants.ts',
  'src/mocks/demoWorkspace.ts',
  'src/app/Router.tsx',
];

for (const file of requiredDocs) nonEmpty(file);

for (let i = 0; i <= 8; i += 1) {
  nonEmpty(`docs/program/employees/C${i}_RECRUITMENT.md`);
  nonEmpty(`docs/program/missions/C${i}_FIRST_MISSION.md`);
  for (const name of ['STATUS.md', 'PLAN.md', 'HANDOFF.md', 'CHANGELOG.md', 'REQUESTS.md']) {
    nonEmpty(`docs/program/threads/C${i}/${name}`);
  }
}

for (let i = 0; i <= 7; i += 1) nonEmpty(`docs/agents/C${i}_ROLE.md`);
for (let i = 1; i <= 7; i += 1) nonEmpty(`docs/prompts/C${i}_START.md`);

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
  const images = fs.readdirSync(uiDir).filter((file) => file.toLowerCase().endsWith('.png'));
  if (images.length < 6) errors.push(`UI_IMAGES: expected >= 6 png, found ${images.length}`);
}

if (errors.length) {
  console.error('Governance validation FAILED:\n');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('Governance validation PASSED');
console.log('Checked program memory, employees C0-C8, first missions, thread memories, legacy roles, page dirs, contracts and UI refs.');
