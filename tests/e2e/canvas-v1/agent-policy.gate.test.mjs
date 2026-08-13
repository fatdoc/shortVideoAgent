import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixture = JSON.parse(fs.readFileSync(path.join(root, "tests/e2e/canvas-v1/agent-policy.fixture.json"), "utf8"));
const negativeVectors = JSON.parse(fs.readFileSync(path.join(root, "docs/program/contracts/canvas-v1/negative-vectors.json"), "utf8"));
const agentRoot = path.join(root, "apps/storycanvas/src/agents/canvas-v1");
const skillRoot = path.join(root, "apps/storycanvas/data/skills/canvas-v1");

function unique(values) {
  return [...new Set(values)];
}

function sourceFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(absolute);
    if (!entry.isFile() || !/\.(?:ts|tsx|md|json)$/u.test(entry.name) || /\.test\.[cm]?[jt]sx?$/u.test(entry.name)) return [];
    return [absolute];
  });
}

function extractConstArray(source, name) {
  const match = source.match(new RegExp(`export\\s+const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as\\s+const`, "u"));
  assert.ok(match, `${name} export is missing`);
  return [...match[1].matchAll(/["']([A-Z][A-Z0-9_]*)["']/gu)].map((item) => item[1]);
}

function importSpecifiers(source) {
  return [...source.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/gu)].map((match) => match[1]);
}

test("G4 policy fixture is closed and agrees with the frozen five-command cost boundary", () => {
  assert.equal(fixture.schemaVersion, "canvas-v1-agent-policy.v1");
  assert.equal(fixture.tools.length, 12);
  assert.deepEqual(unique(fixture.tools), fixture.tools);
  assert.deepEqual(unique([...fixture.readOnlyTools, ...Object.keys(fixture.commandTools)]).sort(), [...fixture.tools].sort());
  assert.deepEqual(fixture.highCostTools, [
    "create_virtual_character",
    "bind_asset_to_entity",
    "generate_shot",
    "select_shot_output",
    "export_playlist",
  ]);
  assert.equal(fixture.commandTools.sync_provider_asset, "SYNC_PROVIDER_ASSET");
  assert.ok(!fixture.highCostTools.includes("sync_provider_asset"));
  assert.equal(fixture.onlyWritePort, "ports.executeCanvasCommand -> CanvasCommandService.execute");
  assert.equal(fixture.blockedResult, "confirmation_required");
});

test("G4 fixture inherits all 38 contract vectors and browser-forbidden facts", () => {
  assert.equal(negativeVectors.vectors.length, 38);
  for (const key of negativeVectors.forbiddenBrowserKeys) {
    assert.ok(
      fixture.forbiddenToolParameterKeys.includes(key) || fixture.hostBoundContextKeys.includes(key),
      `agent policy lost forbidden key ${key}`,
    );
  }
  assert.deepEqual(fixture.forbiddenOutputValuePatterns, negativeVectors.forbiddenBrowserValuePatterns);
});

test("G4 UI, Story and Agent command parsers preserve one exact command enum", () => {
  const frontend = fs.readFileSync(path.join(root, "src/features/canvas-v1/model/contracts.ts"), "utf8");
  const story = fs.readFileSync(path.join(root, "apps/storycanvas/src/contracts/canvas-v1/index.ts"), "utf8");
  const expected = ["ANALYZE_ASSET_REQUIREMENTS", ...Object.values(fixture.commandTools)];
  assert.deepEqual(extractConstArray(frontend, "CANVAS_V1_COMMAND_TYPES"), expected);
  assert.deepEqual(extractConstArray(story, "CANVAS_V1_COMMAND_TYPES"), expected);

  const productFiles = sourceFiles(agentRoot);
  assert.ok(productFiles.length > 0, "EXPECTED_RED: apps/storycanvas/src/agents/canvas-v1 has not been implemented");
  const productSource = productFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  assert.match(productSource, /parseCanvasV1(?:Browser)?Contract/u, "Agent must use a strict Story CanvasCommand parser");
});

test("G4 Agent source and skill surface are whitelist-only and isolated from legacy authority", () => {
  const productFiles = sourceFiles(agentRoot);
  const skillFiles = sourceFiles(skillRoot);
  assert.ok(productFiles.length > 0, "EXPECTED_RED: Canvas V1 Agent source is absent");
  assert.ok(skillFiles.length > 0, "EXPECTED_RED: Canvas V1 Agent skill policy is absent");

  const productSource = productFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");
  const publicSurface = [...productFiles, ...skillFiles].map((file) => fs.readFileSync(file, "utf8")).join("\n");
  for (const toolName of fixture.tools) assert.match(publicSurface, new RegExp(`\\b${toolName}\\b`, "u"), `missing tool ${toolName}`);
  for (const specifier of importSpecifiers(productSource)) {
    for (const fragment of fixture.forbiddenImportFragments) {
      assert.ok(!specifier.toLowerCase().includes(fragment.toLowerCase()), `forbidden Agent import ${specifier}`);
    }
  }
  assert.match(productSource, /executeCanvasCommand/u, "Agent must expose only the common command-service write port");
  assert.doesNotMatch(productSource, /\.(?:insert|update|delete|del)\s*\(/u, "Agent source contains a direct persistence mutation");
  assert.doesNotMatch(productSource, /socket\s*\.\s*emit\s*\(/u, "Agent source contains a legacy socket mutation");
  assert.doesNotMatch(productSource, /\bconsole\s*\./u, "Agent source must not write tool values to public logs");
});
