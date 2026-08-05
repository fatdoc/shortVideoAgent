import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import {
  assertContractObject,
  contractPayloadDigest,
  contractValidationIssues,
  PILOT_CONTRACT_SCHEMA_SOURCE_SHA256,
  PILOT_ERROR_POLICY_SOURCE_SHA256,
} from "./runtime";

const repositoryRoot = path.resolve(__dirname, "../../../../..");
const canonicalDirectory = path.join(repositoryRoot, "docs/program/contracts/v0.2");
const localDirectory = __dirname;

function readJson(filePath: string): Record<string, any> {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, any>;
}

function sha256(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

test("embedded v0.2 schema and error policy stay byte-for-byte aligned with C01", () => {
  const schema = path.join(canonicalDirectory, "pilot-contract-v0.2.schema.json");
  const policy = path.join(canonicalDirectory, "error-safety-policy.json");
  assert.equal(sha256(path.join(localDirectory, "pilot-contract-v0.2.schema.json")), sha256(schema));
  assert.equal(sha256(path.join(localDirectory, "error-safety-policy.json")), sha256(policy));
  assert.equal(sha256(schema), PILOT_CONTRACT_SCHEMA_SOURCE_SHA256);
  assert.equal(sha256(policy), PILOT_ERROR_POLICY_SOURCE_SHA256);
});

test("all nine frozen C01 v0.2 fixtures pass the receiver validator", () => {
  const fixtureDirectory = path.join(canonicalDirectory, "fixtures");
  const files = fs.readdirSync(fixtureDirectory).filter((file) => file.endsWith(".json"));
  assert.equal(files.length, 9);
  for (const file of files) assert.doesNotThrow(() => assertContractObject(readJson(path.join(fixtureDirectory, file))));
});

test("semantic digest tampering and unsafe StandardError content are rejected", () => {
  const command = readJson(path.join(canonicalDirectory, "fixtures/generation-task-command.json"));
  command.input.prompt = "tampered prompt";
  assert.ok(contractValidationIssues(command).some((issue) => issue.path === "/payloadDigest"));

  const standardError = readJson(path.join(canonicalDirectory, "fixtures/standard-error.json"));
  standardError.error.details.authorization = "Bearer SECRET";
  standardError.payloadDigest = contractPayloadDigest(standardError);
  assert.ok(contractValidationIssues(standardError).some((issue) => issue.path.includes("authorization")));
});
