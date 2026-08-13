import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import express from "express";
import http from "node:http";
import {
  PilotCanvasRedemptionClient,
  PilotCanvasSessionRegistrationClient,
  PilotCanvasRedemptionError,
  PilotCanvasAuthorityRegistry,
  closePilotCanvasRuntimeResources,
  createPilotCanvasBootstrapRouter,
  createPilotCanvasSafeBootstrapRouter,
  getPilotCanvasRuntimeCapability,
  parseCanvasEntryRedemptionV01,
  parseProjectGrantV02,
  parseProjectProductionPackageV03,
  type PilotCanvasEntryReference,
} from "./pilotCanvasCapability";

const tenantId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const packageId = "33333333-3333-4333-8333-333333333333";
const grantId = "44444444-4444-4444-8444-444444444444";
const userId = "55555555-5555-4555-8555-555555555555";
const scriptVersionId = "66666666-6666-4666-8666-666666666666";
const storyboardVersionId = "77777777-7777-4777-8777-777777777777";
const briefVersionId = "88888888-8888-4888-8888-888888888888";
const handle = `ce_${"A".repeat(32)}`;
const accessToken = "header.payload.signature";
const internalToken = "storycanvas-internal-token-at-least-32-bytes";
const now = "2026-08-12T01:00:00.000Z";

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => `${JSON.stringify(key)}:${canonicalJson(child)}`)
    .join(",")}}`;
}

function payloadDigest(value: Record<string, unknown>): string {
  const unsigned = structuredClone(value);
  delete unsigned.payloadDigest;
  return `sha256:${crypto.createHash("sha256").update(canonicalJson(unsigned)).digest("hex")}`;
}

function redemption(overrides: Record<string, unknown> = {}) {
  const productionPackage: Record<string, unknown> = {
    objectType: "ProjectProductionPackage",
    contractVersion: "0.3",
    status: "ready",
    tenantId,
    projectId,
    packageId,
    idempotencyKey: "package-key-1",
    occurredAt: "2026-08-12T00:00:00.000Z",
    payloadDigest: "",
    packageVersion: 1,
    organizationId: tenantId,
    scriptVersionId,
    storyboardVersionId,
    approvedScriptDigest: `sha256:${"1".repeat(64)}`,
    approvedStoryboardDigest: `sha256:${"2".repeat(64)}`,
    briefSnapshot: {
      briefVersionId,
      objective: "门店到店获客",
      audience: ["附近顾客"],
      platforms: ["douyin"],
    },
    brandPolicySnapshot: {
      facts: [{ factId: "fact-1", text: "套餐有效", sourceReference: "brand-fact-1", approved: true }],
      prohibitedTerms: [],
      requiredDisclosures: ["以门店实际为准"],
      sourceDigest: `sha256:${"3".repeat(64)}`,
    },
    approvedScript: {
      scriptVersionId,
      payloadDigest: `sha256:${"1".repeat(64)}`,
      content: "探店脚本",
      approvedAt: "2026-08-12T00:00:00.000Z",
      approvedBy: userId,
    },
    approvedStoryboard: {
      storyboardVersionId,
      scriptVersionId,
      scriptPayloadDigest: `sha256:${"1".repeat(64)}`,
      payloadDigest: `sha256:${"2".repeat(64)}`,
      approvedAt: "2026-08-12T00:00:00.000Z",
      approvedBy: userId,
    },
    storyboard: [{ shotId: "shot-1", sequence: 1, description: "门头", durationSeconds: 3, sourceMode: "uploaded" }],
    target: { aspectRatio: "9:16", durationSeconds: 30, container: "mp4", videoCodec: "h264" },
    capabilityRequirements: ["video.generate", "media.export"],
    createdAt: "2026-08-12T00:00:00.000Z",
    expiresAt: "2026-08-12T02:00:00.000Z",
  };
  productionPackage.payloadDigest = payloadDigest(productionPackage);
  const grant: Record<string, unknown> = {
    objectType: "ProjectGrant",
    contractVersion: "0.2",
    tenantId,
    projectId,
    packageId,
    idempotencyKey: "grant-key-1",
    occurredAt: "2026-08-12T00:30:00.000Z",
    payloadDigest: "",
    grantId,
    capabilities: ["video.generate", "media.export"],
    scopes: ["production.package.read", "production.task.write"],
    tokenDigest: `sha256:${crypto.createHash("sha256").update(accessToken).digest("hex")}`,
    keyId: "key-1",
    issuedAt: "2026-08-12T00:30:00.000Z",
    expiresAt: "2026-08-12T01:30:00.000Z",
  };
  grant.payloadDigest = payloadDigest(grant);
  return {
    objectType: "CanvasEntryRedemption",
    contractVersion: "0.1",
    handle,
    tenantId,
    projectId,
    packageId,
    consumedAt: now,
    productionPackage,
    grant,
    tokenType: "Bearer",
    accessToken,
    replayed: false,
    ...overrides,
  };
}

const entry: PilotCanvasEntryReference = { handle, tenantId, projectId, packageId };

test("strictly parses the frozen redemption, Package v0.3 and Grant v0.2 contracts", () => {
  const value = redemption();
  assert.equal(parseCanvasEntryRedemptionV01(value).contractVersion, "0.1");
  assert.equal(parseProjectProductionPackageV03(value.productionPackage).contractVersion, "0.3");
  assert.equal(parseProjectGrantV02(value.grant).contractVersion, "0.2");
  assert.throws(() => parseProjectProductionPackageV03({ ...value.productionPackage, extra: true }));
  assert.throws(() => parseProjectGrantV02({ ...value.grant, expiresAt: value.grant.issuedAt }));
});

test("redeems server-side with a stable key and exact response-loss replay", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let attempt = 0;
  const client = new PilotCanvasRedemptionClient({
    controlApiBaseUrl: "https://control.example.test",
    internalToken,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      attempt += 1;
      if (attempt === 1) throw Object.assign(new Error("response lost"), { code: "ECONNRESET" });
      return new Response(JSON.stringify(redemption({ replayed: true })), {
        status: 200,
        headers: { "content-type": "application/json", "x-request-id": "request-replay", "idempotency-replayed": "true" },
      });
    },
  });

  const result = await client.redeem(entry);
  assert.equal(result.replayed, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, "https://control.example.test/api/v1/internal/canvas-entries/redeem");
  assert.equal(calls[0]?.init?.body, JSON.stringify(entry));
  assert.equal(calls[1]?.init?.body, calls[0]?.init?.body);
  const firstHeaders = new Headers(calls[0]?.init?.headers);
  const secondHeaders = new Headers(calls[1]?.init?.headers);
  assert.equal(firstHeaders.get("idempotency-key"), secondHeaders.get("idempotency-key"));
  assert.match(firstHeaders.get("idempotency-key") ?? "", /^sc-redeem-v1-[a-f0-9]{48}$/);
  assert.equal(firstHeaders.get("x-production-plane-internal-token"), internalToken);
});

test("registers the minted pcs authority with Control using exact response-loss replay", async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let attempt = 0;
  const registrar = new PilotCanvasSessionRegistrationClient({
    controlApiBaseUrl: "https://control.example.test",
    internalToken,
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      attempt += 1;
      if (attempt === 1) throw new Error("response lost");
      return new Response(JSON.stringify({
        status: "active",
        expiresAt: "2026-08-12T01:30:00.000Z",
        replayed: true,
      }), {
        status: 200,
        headers: {
          "content-type": "application/json",
          "idempotency-replayed": "true",
          "x-request-id": "register-replay",
        },
      });
    },
  });
  const registration = {
    ...entry,
    canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
    actorId: userId,
  };
  const result = await registrar.register(registration);
  assert.equal(result.replayed, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0]?.url, "https://control.example.test/api/v1/internal/canvas-asset-sessions");
  assert.equal(calls[0]?.init?.body, JSON.stringify(registration));
  assert.equal(calls[1]?.init?.body, calls[0]?.init?.body);
  assert.equal(
    new Headers(calls[0]?.init?.headers).get("x-production-plane-internal-token"),
    internalToken,
  );
});

test("does not save raw redemption or return pcs authority when Control registration fails", async () => {
  const registry = new PilotCanvasAuthorityRegistry({
    redeem: async () => redemption() as never,
  } as never, {
    registrar: {
      register: async () => {
        throw new PilotCanvasRedemptionError("PILOT_CANVAS_DEPENDENCY_UNAVAILABLE", 503, true);
      },
    },
    now: () => Date.parse(now),
  });
  await assert.rejects(() => registry.openEntry(entry, userId), (error: unknown) =>
    error instanceof PilotCanvasRedemptionError && error.code === "PILOT_CANVAS_DEPENDENCY_UNAVAILABLE",
  );
  assert.equal(registry.activeCount(), 0);
});

test("fails closed for strict response, scope, changed-handle binding and unsafe errors", async () => {
  for (const invalid of [
    redemption({ projectId: "99999999-9999-4999-8999-999999999999" }),
    { ...redemption(), extra: true },
    redemption({ accessToken: "not-a-token" }),
  ]) {
    const client = new PilotCanvasRedemptionClient({
      controlApiBaseUrl: "https://control.example.test",
      internalToken,
      fetchImpl: async () => new Response(JSON.stringify(invalid), { status: 200, headers: { "content-type": "application/json" } }),
    });
    await assert.rejects(() => client.redeem(entry), (error: unknown) => {
      assert.ok(error instanceof PilotCanvasRedemptionError);
      assert.equal(error.code, "PILOT_CANVAS_INVALID_RESPONSE");
      const serialized = JSON.stringify(error);
      for (const marker of [internalToken, accessToken, grantId, "payloadDigest", "stack"]) {
        assert.equal(serialized.includes(marker), false);
      }
      return true;
    });
  }

  let calls = 0;
  const client = new PilotCanvasRedemptionClient({
    controlApiBaseUrl: "https://control.example.test",
    internalToken,
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify(redemption()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });
  await client.redeem(entry);
  await assert.rejects(
    () => client.redeem({ ...entry, projectId: "99999999-9999-4999-8999-999999999999" }),
    (error: unknown) => error instanceof PilotCanvasRedemptionError && error.code === "PILOT_CANVAS_CONFLICT",
  );
  assert.equal(calls, 1);
});

test("browser bootstrap enforces Session, Origin and CSRF and returns only a safe projection", async () => {
  const application = express();
  application.use(express.json({ limit: "16kb", strict: true }));
  application.use("/api/production/pilot/canvas/bootstrap", createPilotCanvasBootstrapRouter({
    allowedOrigin: "https://pilot.example.test",
    verifySession: async (cookie) => cookie === "videoagent_session=session-value"
      ? { actorId: tenantId, tenantId, organizationType: "TENANT" as const, roles: ["content_operator" as const] }
      : cookie === "videoagent_session=no-production-role"
        ? { actorId: tenantId, tenantId, organizationType: "TENANT" as const, roles: ["pilot_support" as const] }
        : null,
    redeem: async () => ({ authorityId: "server-authority-1", expiresAt: "2026-08-12T01:30:00.000Z", requestId: "request-bootstrap" }),
  }));
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/production/pilot/canvas/bootstrap`;
  try {
    const forbidden = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) });
    assert.equal(forbidden.status, 403);
    const roleForbidden = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "https://pilot.example.test", cookie: "videoagent_session=no-production-role", "x-storycanvas-csrf": "pilot-canvas-bootstrap-v1" },
      body: JSON.stringify(entry),
    });
    assert.equal(roleForbidden.status, 403);
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://pilot.example.test",
        cookie: "videoagent_session=session-value",
        "x-storycanvas-csrf": "pilot-canvas-bootstrap-v1",
      },
      body: JSON.stringify(entry),
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("access-control-allow-origin"), "https://pilot.example.test");
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ["canvasSessionId", "expiresAt", "packageId", "projectId", "requestId", "schemaVersion", "status"]);
    const serialized = JSON.stringify(body);
    for (const marker of [internalToken, accessToken, grantId, "digest", "productionPackage"]) assert.equal(serialized.includes(marker), false);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("safe bootstrap parser returns fixed malformed and oversized envelopes", async () => {
  const application = express();
  application.use("/api/production/pilot/canvas/bootstrap", createPilotCanvasSafeBootstrapRouter({
    allowedOrigin: "https://pilot.example.test",
    verifySession: async () => null,
    redeem: async () => { throw new Error("invalid JSON must not redeem"); },
  }));
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/production/pilot/canvas/bootstrap`;
  try {
    for (const fixture of [
      {
        body: '{"unsafe":"SECRET_SENTINEL"',
        status: 400,
        code: "PILOT_CANVAS_MALFORMED_JSON",
        message: "Pilot Canvas request body is invalid.",
      },
      {
        body: JSON.stringify({ unsafe: "X".repeat(20_000) }),
        status: 413,
        code: "PILOT_CANVAS_REQUEST_TOO_LARGE",
        message: "Pilot Canvas request body is too large.",
      },
    ]) {
      const response = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", "x-request-id": "safe-parser-request" },
        body: fixture.body,
      });
      assert.equal(response.status, fixture.status);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-request-id"), "safe-parser-request");
      assert.deepEqual(await response.json(), {
        error: {
          code: fixture.code,
          message: fixture.message,
          requestId: "safe-parser-request",
          retryable: false,
        },
      });
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("authority registry and shutdown expose bounded lifecycle semantics", async () => {
  let clock = Date.parse(now);
  let calls = 0;
  const registry = new PilotCanvasAuthorityRegistry({
    redeem: async () => {
      calls += 1;
      return redemption() as never;
    },
  } as never, {
    capacity: 2,
    now: () => clock,
    registrar: {
      register: async () => ({ status: "active" as const, expiresAt: "2026-08-12T01:30:00.000Z", replayed: false }),
    },
  });
  const first = await registry.openEntry(entry, userId);
  assert.equal((await registry.openEntry(entry, userId)).authorityId, first.authorityId);
  assert.equal(calls, 1);
  const secondActorId = "99999999-9999-4999-8999-999999999999";
  const secondActor = await registry.openEntry(entry, secondActorId);
  assert.notEqual(secondActor.authorityId, first.authorityId);
  assert.equal(registry.readServerSessionAuthority(first.authorityId)?.actorId, userId);
  assert.equal(registry.readServerSessionAuthority(secondActor.authorityId)?.actorId, secondActorId);
  assert.equal(calls, 2);
  await registry.openEntry({ ...entry, handle: `ce_${"B".repeat(32)}` }, userId);
  const third = await registry.openEntry({ ...entry, handle: `ce_${"C".repeat(32)}` }, userId);
  assert.equal(registry.activeCount(), 2);
  assert.equal(registry.readServerAuthority(first.authorityId), null);

  clock = Date.parse("2026-08-12T01:31:00.000Z");
  assert.equal(registry.purgeExpired(), 2);
  assert.equal(registry.readServerAuthority(third.authorityId), null);

  const closed: string[] = [];
  const evidence = await closePilotCanvasRuntimeResources({
    signal: "SIGINT",
    timeoutMs: 5_000,
    registry,
    socketIo: { close: (callback) => { closed.push("socket.io"); callback(); } },
    webSocket: { close: (callback) => { closed.push("websocket"); callback(); } },
    http: { close: (callback) => { closed.push("http"); callback(); } },
  });
  assert.deepEqual(closed, ["socket.io", "websocket", "http"]);
  assert.equal(registry.activeCount(), 0);
  assert.deepEqual(evidence, {
    signal: "SIGINT",
    registryCleared: true,
    httpClosed: true,
    socketIoClosed: true,
    webSocketClosed: true,
    pendingTimerCount: 0,
  });
});

test("reports a dedicated deterministic capability without exposing configuration values", async () => {
  const capability = await getPilotCanvasRuntimeCapability({
    env: {
      STORYCANVAS_PILOT_CANVAS_ENABLED: "true",
      CONTROL_API_BASE_URL: "https://control.example.test",
      PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
      STORYCANVAS_PILOT_ALLOWED_ORIGIN: "https://pilot.example.test",
      STORYCANVAS_DATA_ROOT: "/tmp/storycanvas-pilot-test",
    },
    ensureDataRoot: async () => true,
    now: () => new Date(now),
  });
  assert.equal(capability.status, "ready");
  assert.equal(capability.code, "PILOT_CANVAS_CAPABILITY_READY");
  assert.equal(capability.checkedAt, now);
  assert.equal(capability.startCommand, "npm --prefix apps/storycanvas run start:pilot-canvas");
  const serialized = JSON.stringify(capability);
  for (const marker of [internalToken, "control.example.test", "/tmp/storycanvas-pilot-test"]) assert.equal(serialized.includes(marker), false);
});
