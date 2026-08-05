import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ProductionContractError,
  assertGrantScope,
  assertPackageContract,
  demoProjectGrantSchema,
} from "../../../apps/storycanvas/src/domain/productionContract/v01.ts";

const repositoryRoot = process.cwd();
const v01FixtureDirectory = path.join(
  repositoryRoot,
  "apps/storycanvas/src/fixtures/production-contract/v0.1",
);
const v02FixtureDirectory = path.join(
  repositoryRoot,
  "docs/program/contracts/v0.2/fixtures",
);

function fixture(directory: string, name: string) {
  return JSON.parse(fs.readFileSync(path.join(directory, name), "utf8"));
}

function expectContractError(code: string, operation: () => unknown) {
  assert.throws(
    operation,
    (error: unknown) => error instanceof ProductionContractError && error.code === code,
  );
}

test("StoryCanvas v0.1 accepts its canonical production package with the real validator", () => {
  const productionPackage = fixture(v01FixtureDirectory, "project-production-package.json");
  assert.equal(assertPackageContract(productionPackage).packageId, productionPackage.packageId);
});

test("StoryCanvas v0.1 accepts the canonical grant inside its deterministic validity window", () => {
  const productionPackage = assertPackageContract(
    fixture(v01FixtureDirectory, "project-production-package.json"),
  );
  const grant = fixture(v01FixtureDirectory, "demo-project-grant.json");
  const evaluatedAt = new Date("2026-07-30T00:10:00.000Z");

  assert.equal(
    assertGrantScope(
      grant,
      productionPackage,
      "cap-production-base-generation",
      ["production.package.read", "production.receipt.write"],
      evaluatedAt,
    ).grantId,
    grant.grantId,
  );
});

test("StoryCanvas v0.1 rejects tenant, project, and package scope mismatches", () => {
  const productionPackage = assertPackageContract(
    fixture(v01FixtureDirectory, "project-production-package.json"),
  );
  const canonicalGrant = fixture(v01FixtureDirectory, "demo-project-grant.json");
  const evaluatedAt = new Date("2026-07-30T00:10:00.000Z");

  for (const mutation of [
    { tenantId: "tenant-other" },
    { projectId: "project-other" },
    { packageId: "package-other" },
  ]) {
    expectContractError("GRANT_SCOPE_MISMATCH", () => assertGrantScope(
      { ...canonicalGrant, ...mutation },
      productionPackage,
      "cap-production-base-generation",
      ["production.package.read"],
      evaluatedAt,
    ));
  }
});

test("StoryCanvas v0.1 rejects a capability outside the grant", () => {
  const productionPackage = assertPackageContract(
    fixture(v01FixtureDirectory, "project-production-package.json"),
  );
  const grant = fixture(v01FixtureDirectory, "demo-project-grant.json");

  expectContractError("CAPABILITY_SCOPE_DENIED", () => assertGrantScope(
    grant,
    productionPackage,
    "video.generate",
    ["production.package.read"],
    new Date("2026-07-30T00:10:00.000Z"),
  ));
});

test("StoryCanvas v0.1 rejects an expired grant", () => {
  const productionPackage = assertPackageContract(
    fixture(v01FixtureDirectory, "project-production-package.json"),
  );
  const grant = fixture(v01FixtureDirectory, "demo-project-grant.json");

  expectContractError("GRANT_EXPIRED", () => assertGrantScope(
    grant,
    productionPackage,
    "cap-production-base-generation",
    ["production.package.read"],
    new Date("2026-07-30T00:20:00.000Z"),
  ));
});

test("StoryCanvas v0.1 rejects package tampering when the digest is unchanged", () => {
  const productionPackage = fixture(v01FixtureDirectory, "project-production-package.json");
  productionPackage.creativeBriefSnapshot.notes = "tampered approved content";

  expectContractError("PACKAGE_DIGEST_MISMATCH", () => assertPackageContract(productionPackage));
});

test("StoryCanvas v0.1 does not silently accept a C01 v0.2 package", () => {
  assert.throws(() => assertPackageContract(
    fixture(v02FixtureDirectory, "project-production-package.json"),
  ));
});

test("StoryCanvas v0.1 does not silently accept a C01 v0.2 grant", () => {
  const result = demoProjectGrantSchema.safeParse(
    fixture(v02FixtureDirectory, "project-grant.json"),
  );
  assert.equal(result.success, false);
});
