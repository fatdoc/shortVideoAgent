import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import request from "../../../apps/control-api/node_modules/supertest/index.js";
import { createApp } from "../../../apps/control-api/src/app.ts";
import { loadConfig } from "../../../apps/control-api/src/config.ts";
import { contractPayloadDigest, tokenDigest } from "../../../apps/control-api/src/production/digest.ts";
import {
  ProductionDomainError,
  ProductionIdempotencyConflictError,
} from "../../../apps/control-api/src/production/errors.ts";
import { assertGrantRequestAllowed } from "../../../apps/control-api/src/production/grantPolicy.ts";
import { productionIdempotencyDigest } from "../../../apps/control-api/src/production/idempotency.ts";
import { createInternalProjectGrantRouter } from "../../../apps/control-api/src/production/internalRoutes.ts";
import {
  type ProjectGrantClaims,
  ProjectGrantTokenService,
} from "../../../apps/control-api/src/production/grantToken.ts";
import { createProductionRouter } from "../../../apps/control-api/src/production/routes.ts";
import type {
  IdempotencyInput,
  ProductionStore,
  ProjectGrant,
  ProjectProductionPackage,
} from "../../../apps/control-api/src/production/types.ts";

const tenantA = "10000000-0000-4000-8000-000000000001";
const tenantB = "20000000-0000-4000-8000-000000000001";
const userA = "10000000-0000-4000-8000-000000000002";
const userB = "20000000-0000-4000-8000-000000000002";
const projectId = "10000000-0000-4000-8000-000000000003";
const scriptApproved = "10000000-0000-4000-8000-000000000004";
const scriptUnapproved = "10000000-0000-4000-8000-000000000014";
const scriptRevoked = "10000000-0000-4000-8000-000000000024";
const packageId = "10000000-0000-4000-8000-000000000005";
const issuedAt = new Date("2026-08-05T01:00:00.000Z");
const tokenService = new ProjectGrantTokenService(
  "q1-test-only-signing-secret-at-least-32-characters",
  "q1-test-kid",
  () => issuedAt,
);
const q1ProductionPlaneInternalToken =
  "q1-production-plane-internal-token-independent-20260805";

function assertAcceptedByC01(standardError: unknown) {
  const source = path.join(process.cwd(), "docs/program/contracts/v0.2");
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "videoagent-q1-a3-error-"));
  const target = path.join(temporaryRoot, "v0.2");
  fs.cpSync(source, target, { recursive: true });
  try {
    fs.writeFileSync(
      path.join(target, "fixtures/standard-error.json"),
      `${JSON.stringify(standardError, null, 2)}\n`,
    );
    const result = spawnSync(process.execPath, ["--test", path.join(target, "validate-contract.mjs")], {
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

function productionPackage(key: string): ProjectProductionPackage {
  const unsigned = {
    objectType: "ProjectProductionPackage" as const,
    contractVersion: "0.2" as const,
    tenantId: tenantA,
    projectId,
    idempotencyKey: key,
    occurredAt: issuedAt.toISOString(),
    packageId,
    packageVersion: 1,
    organizationId: tenantA,
    briefSnapshot: {
      briefVersionId: "10000000-0000-4000-8000-000000000006",
      objective: "Controlled pilot video",
      audience: ["pilot audience"],
      platforms: ["douyin"],
    },
    brandPolicySnapshot: {
      facts: [],
      prohibitedTerms: [],
      requiredDisclosures: ["controlled pilot"],
      sourceDigest: `sha256:${"1".repeat(64)}`,
    },
    approvedScript: {
      scriptVersionId: scriptApproved,
      content: "Approved pilot script.",
      approvedAt: "2026-08-05T00:59:00.000Z",
      approvedBy: userA,
    },
    storyboard: [{
      shotId: "shot-1",
      sequence: 1,
      description: "Opening",
      durationSeconds: 5,
      sourceMode: "mixed" as const,
    }],
    target: {
      aspectRatio: "9:16",
      durationSeconds: 15,
      container: "mp4" as const,
      videoCodec: "h264" as const,
    },
    capabilityRequirements: ["video.generate" as const],
    createdAt: issuedAt.toISOString(),
    expiresAt: "2026-08-05T07:00:00.000Z",
  };
  return { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) };
}

function claims(grantId: string): ProjectGrantClaims {
  const seconds = Math.floor(issuedAt.getTime() / 1000);
  return {
    iss: "videoagent-control-plane",
    aud: "storycanvas-production-plane",
    jti: grantId,
    tenantId: tenantA,
    projectId,
    packageId,
    capabilities: ["video.generate"],
    scopes: ["production.package.read", "production.task.write"],
    contractVersion: "0.2",
    nonce: "10000000-0000-4000-8000-000000000009",
    iat: seconds,
    nbf: seconds,
    exp: seconds + 600,
  };
}

class FakeProductionStore implements ProductionStore {
  private packageRequest: { digest: string; value: ProjectProductionPackage } | undefined;
  private grantRequest: { digest: string; value: { grant: ProjectGrant; tokenType: "Bearer"; accessToken: string } } | undefined;

  async createPackage(actor: { tenantId: string }, _projectId: string, input: { scriptVersionId: string }, idempotency: IdempotencyInput) {
    if (actor.tenantId !== tenantA) return null;
    if (input.scriptVersionId === scriptUnapproved) {
      throw new ProductionDomainError(
        "当前批准脚本不具备生产资格。",
        403,
        "CAPABILITY_SCOPE_DENIED",
        "scope",
        { reasonCode: "SCRIPT_NOT_APPROVED" },
      );
    }
    if (input.scriptVersionId === scriptRevoked) {
      throw new ProductionDomainError(
        "当前批准脚本不具备生产资格。",
        403,
        "CAPABILITY_SCOPE_DENIED",
        "scope",
        { reasonCode: "APPROVAL_REVOKED" },
      );
    }
    const digest = contractPayloadDigest(idempotency.payload);
    if (this.packageRequest) {
      if (this.packageRequest.digest !== digest) throw new ProductionIdempotencyConflictError();
      return { value: this.packageRequest.value, replayed: true };
    }
    const value = productionPackage(idempotency.key);
    this.packageRequest = { digest, value };
    return { value, replayed: false };
  }

  async getPackage(actor: { tenantId: string }) {
    return actor.tenantId === tenantA ? productionPackage("package-key-1") : null;
  }

  async issueGrant(actor: { tenantId: string }, _projectId: string, input: any, idempotency: IdempotencyInput) {
    if (actor.tenantId !== tenantA || input.packageId !== packageId) return null;
    assertGrantRequestAllowed(
      ["video.generate"],
      input.requestedCapabilities,
      input.requestedScopes,
    );
    const digest = contractPayloadDigest(idempotency.payload);
    if (this.grantRequest) {
      if (this.grantRequest.digest !== digest) throw new ProductionIdempotencyConflictError();
      return { value: this.grantRequest.value, replayed: true };
    }
    const grantId = "10000000-0000-4000-8000-000000000008";
    const accessToken = tokenService.issue(claims(grantId));
    const unsigned = {
      objectType: "ProjectGrant" as const,
      contractVersion: "0.2" as const,
      tenantId: tenantA,
      projectId,
      idempotencyKey: idempotency.key,
      occurredAt: issuedAt.toISOString(),
      grantId,
      packageId,
      capabilities: input.requestedCapabilities,
      scopes: input.requestedScopes,
      tokenDigest: tokenDigest(accessToken),
      keyId: tokenService.keyId,
      issuedAt: issuedAt.toISOString(),
      expiresAt: "2026-08-05T01:10:00.000Z",
    };
    const grant = { ...unsigned, payloadDigest: contractPayloadDigest(unsigned) } as ProjectGrant;
    const value = { grant, tokenType: "Bearer" as const, accessToken };
    this.grantRequest = { digest, value };
    return { value, replayed: false };
  }
}

function app(store = new FakeProductionStore()) {
  const router = createProductionRouter({
    store,
    resolveSession: async (token) => {
      const session = token === "tenant-a" ? { tenantId: tenantA, userId: userA }
        : token === "tenant-b" ? { tenantId: tenantB, userId: userB }
          : null;
      return session ? {
        session: {
          user: { id: session.userId, email: "pilot@example.com", displayName: "Pilot" },
          tenant: { id: session.tenantId, displayName: "Pilot tenant" },
          roles: ["tenant_admin"],
          expiresAt: "2026-08-05T08:00:00.000Z",
        },
      } : null;
    },
    secureCookies: false,
    sessionTtlSeconds: 28_800,
  });
  return createApp({
    appVersion: "q1-test",
    nodeEnv: "test",
    readinessProbe: async () => undefined,
    productionRouter: router,
  });
}

function packageRequest(application: ReturnType<typeof app>, key: string, scriptVersionId = scriptApproved) {
  return request(application)
    .post(`/api/v1/projects/${projectId}/production-packages`)
    .set("cookie", "videoagent_session=tenant-a")
    .set("idempotency-key", key)
    .send({ scriptVersionId, capabilityRequirements: ["video.generate"] });
}

test("A3 HTTP package success, exact replay, and same-key conflict", async () => {
  const application = app();
  const created = await packageRequest(application, "package-key-1");
  const replayed = await packageRequest(application, "package-key-1");
  const conflict = await request(application)
    .post(`/api/v1/projects/${projectId}/production-packages`)
    .set("cookie", "videoagent_session=tenant-a")
    .set("idempotency-key", "package-key-1")
    .send({
      scriptVersionId: scriptApproved,
      capabilityRequirements: ["video.generate"],
      expiresInSeconds: 300,
    });

  assert.equal(created.status, 201);
  assert.equal(created.body.payloadDigest, contractPayloadDigest(created.body));
  assert.equal(replayed.status, 200);
  assert.equal(replayed.headers["idempotency-replayed"], "true");
  assert.equal(replayed.body.packageId, created.body.packageId);
  assert.equal(conflict.status, 409);
  assert.equal(conflict.body.error.code, "IDEMPOTENCY_CONFLICT");
  assertAcceptedByC01(conflict.body);
});

test("A3 HTTP blocks unapproved and revoked script decisions", async () => {
  for (const [scriptVersionId, reasonCode] of [
    [scriptUnapproved, "SCRIPT_NOT_APPROVED"],
    [scriptRevoked, "APPROVAL_REVOKED"],
  ]) {
    const response = await packageRequest(app(), `package-${reasonCode}`, scriptVersionId);
    assert.equal(response.status, 403);
    assert.equal(response.body.error.code, "CAPABILITY_SCOPE_DENIED");
    assert.equal(response.body.error.details.reasonCode, reasonCode);
    assertAcceptedByC01(response.body);
  }
});

test("A3 HTTP keeps cross-tenant package existence opaque", async () => {
  const response = await request(app())
    .get(`/api/v1/projects/${projectId}/production-packages/${packageId}`)
    .set("cookie", "videoagent_session=tenant-b");
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "PROJECT_SCOPE_MISMATCH");
  assert.equal(response.body.error.message, "Request scope is not authorized.");
  assert.doesNotMatch(JSON.stringify(response.body), new RegExp(tenantA));
  assertAcceptedByC01(response.body);
});

test("A3 HTTP grant is signed, replay-safe, and least-privilege", async () => {
  const application = app();
  const send = (key: string, scopes = ["production.package.read", "production.task.write"]) =>
    request(application)
      .post(`/api/v1/projects/${projectId}/production-grants`)
      .set("cookie", "videoagent_session=tenant-a")
      .set("idempotency-key", key)
      .send({
        packageId,
        requestedCapabilities: ["video.generate"],
        requestedScopes: scopes,
      });
  const created = await send("grant-key-1");
  const replayed = await send("grant-key-1");
  const overScoped = await send("grant-key-over", ["production.export.write"]);

  assert.equal(created.status, 201);
  assert.equal(created.headers["cache-control"], "no-store");
  assert.equal(created.body.grant.tokenDigest, tokenDigest(created.body.accessToken));
  assert.deepEqual(tokenService.verify(created.body.accessToken).scopes, [
    "production.package.read",
    "production.task.write",
  ]);
  assert.equal(replayed.status, 200);
  assert.equal(replayed.body.accessToken, created.body.accessToken);
  assert.equal(overScoped.status, 403);
  assert.equal(overScoped.body.error.code, "CAPABILITY_SCOPE_DENIED");
  assertAcceptedByC01(overScoped.body);
});

test("A3 real token verifier rejects tampering and expiry", () => {
  let now = issuedAt;
  const verifier = new ProjectGrantTokenService(
    "q1-expiry-signing-secret-at-least-32-characters",
    "q1-expiry-kid",
    () => now,
  );
  const token = verifier.issue(claims("10000000-0000-4000-8000-000000000018"));
  const parts = token.split(".");
  const signature = parts[2] ?? "";
  const replacement = signature.endsWith("x") ? "y" : "x";
  const tampered = `${parts[0]}.${parts[1]}.${signature.slice(0, -1)}${replacement}`;
  assert.throws(() => verifier.verify(tampered), (error: any) => error.code === "GRANT_INVALID");
  now = new Date("2026-08-05T01:10:31.000Z");
  assert.throws(() => verifier.verify(token), (error: any) => error.code === "GRANT_EXPIRED");
});

test("A3 public StandardError messages are C01.1 catalog compliant", async () => {
  const response = await packageRequest(app(), "package-unapproved", scriptUnapproved);
  const policy = JSON.parse(fs.readFileSync(
    path.join(process.cwd(), "docs/program/contracts/v0.2/error-safety-policy.json"),
    "utf8",
  ));
  const allowed = policy.messageCatalog[response.body.error.code] as string[];
  assert.equal(allowed.includes(response.body.error.message), true);
  assertAcceptedByC01(response.body);
});

test("A3 schema rejection is a complete C01 StandardError", async () => {
  const response = await request(app())
    .post(`/api/v1/projects/${projectId}/production-packages`)
    .set("cookie", "videoagent_session=tenant-a")
    .set("idempotency-key", "schema-error-key")
    .send({
      scriptVersionId: scriptApproved,
      capabilityRequirements: ["video.generate"],
      tenantId: tenantB,
    });
  assert.equal(response.status, 422);
  assert.equal(response.body.error.code, "SCHEMA_INVALID");
  assertAcceptedByC01(response.body);
});

test("A3 idempotency digest binds the path project", () => {
  const command = {
    operation: "production.package.create",
    key: "same-key",
    scope: { projectId: "project-a" },
    payload: { scriptVersionId: scriptApproved, capabilityRequirements: ["video.generate"] },
  };
  assert.notEqual(
    productionIdempotencyDigest(tenantA, command),
    productionIdempotencyDigest(tenantA, {
      ...command,
      scope: { projectId: "project-b" },
    }),
  );
});

test("A3 configuration requires an independent Grant signing secret and active kid", () => {
  const config = loadConfig({
    NODE_ENV: "test",
    SESSION_SECRET: "q1-session-secret-at-least-32-characters",
    PROJECT_GRANT_SIGNING_SECRET: "q1-grant-secret-independent-at-least-32-characters",
    PROJECT_GRANT_ACTIVE_KID: "q1-kid-v1",
    PRODUCTION_PLANE_INTERNAL_TOKEN: q1ProductionPlaneInternalToken,
  });
  assert.notEqual(config.projectGrantSigningSecret, config.sessionSecret);
  assert.equal(config.projectGrantActiveKid, "q1-kid-v1");
  assert.throws(() => loadConfig({
    NODE_ENV: "test",
    SESSION_SECRET: "q1-shared-secret-at-least-32-characters",
    PROJECT_GRANT_SIGNING_SECRET: "q1-shared-secret-at-least-32-characters",
    PROJECT_GRANT_ACTIVE_KID: "q1-kid-v1",
    PRODUCTION_PLANE_INTERNAL_TOKEN: q1ProductionPlaneInternalToken,
  }), /must be independent/);
  assert.notEqual(config.productionPlaneInternalToken, config.sessionSecret);
  assert.notEqual(config.productionPlaneInternalToken, config.projectGrantSigningSecret);
});

test("A3 introspection returns grantId only from verified signed claims", async () => {
  let verificationCount = 0;
  const internalRouter = createInternalProjectGrantRouter({
    internalToken: q1ProductionPlaneInternalToken,
    verifier: {
      verifyActiveGrantToken: async (token) => {
        verificationCount += 1;
        return tokenService.verify(token);
      },
    },
  });
  const application = createApp({
    appVersion: "q1-test",
    nodeEnv: "test",
    readinessProbe: async () => undefined,
    internalProductionRouter: internalRouter,
  });
  const expected = claims("10000000-0000-4000-8000-000000000088");
  const grantToken = tokenService.issue(expected);
  const introspect = () => request(application)
    .post("/api/v1/internal/project-grants/introspect")
    .set("x-production-plane-internal-token", q1ProductionPlaneInternalToken)
    .set("authorization", `Bearer ${grantToken}`);

  const accepted = await introspect();
  assert.equal(accepted.status, 200);
  assert.equal(accepted.body.grantId, expected.jti);
  assert.equal(accepted.body.tenantId, expected.tenantId);
  assert.equal(accepted.body.projectId, expected.projectId);
  assert.equal(verificationCount, 1);

  const forgedGrantId = "20000000-0000-4000-8000-000000000099";
  const rejected = await introspect().send({ grantId: forgedGrantId });
  assert.equal(rejected.status, 422);
  assert.equal(rejected.body.error.code, "SCHEMA_INVALID");
  assert.doesNotMatch(rejected.text, new RegExp(forgedGrantId));
  assert.doesNotMatch(rejected.text, new RegExp(grantToken.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.equal(verificationCount, 1);
});
