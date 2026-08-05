import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GrantSecurityError,
  HttpActiveGrantIntrospector,
  loadHttpGrantIntrospector,
} from "./security";

const internalToken = "internal-token-at-least-thirty-two-characters";
const fixedNow = new Date("2026-08-05T01:05:00.000Z");
const active = {
  active: true as const,
  grantId: "grant-project-pilot-01-v1",
  tenantId: "tenant-pilot-01",
  projectId: "project-pilot-01",
  packageId: "package-project-pilot-01-v1",
  capabilities: ["video.generate"],
  scopes: ["production.package.read", "production.task.write"],
  exp: 1_785_892_201,
};

test("HTTP introspection sends only the two authorization headers and accepts A05.4 active context", async () => {
  let observed: RequestInit | undefined;
  const introspector = new HttpActiveGrantIntrospector({
    url: "http://127.0.0.1/api/v1/internal/project-grants/introspect",
    internalToken,
    allowInsecureHttp: true,
    now: () => fixedNow,
    fetchImpl: async (_input, init) => {
      observed = init;
      return new Response(JSON.stringify(active), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.deepEqual(await introspector.introspect("project-grant-token"), active);
  assert.equal(observed?.method, "POST");
  assert.deepEqual(observed?.headers, {
    Authorization: "Bearer project-grant-token",
    "X-Production-Plane-Internal-Token": internalToken,
  });
  assert.equal(observed?.body, undefined);
  assert.equal(observed?.redirect, "error");
});

test("HTTP introspection maps expiry and fails closed for rejection, network failure, and malformed success", async () => {
  const create = (fetchImpl: typeof fetch) => new HttpActiveGrantIntrospector({
    url: "http://127.0.0.1/api/v1/internal/project-grants/introspect",
    internalToken,
    allowInsecureHttp: true,
    now: () => fixedNow,
    fetchImpl,
  });
  await assert.rejects(
    () => create(async () => new Response(null, { status: 410 })).introspect("token"),
    (error: unknown) => error instanceof GrantSecurityError && error.code === "GRANT_EXPIRED",
  );
  await assert.rejects(
    () => create(async () => new Response("do-not-reflect-upstream", { status: 401 })).introspect("token"),
    (error: unknown) => error instanceof GrantSecurityError && error.code === "GRANT_INVALID" && !error.message.includes("upstream"),
  );
  await assert.rejects(
    () => create(async () => { throw new Error("network secret"); }).introspect("token"),
    (error: unknown) => error instanceof GrantSecurityError && error.code === "GRANT_INVALID" && !error.message.includes("secret"),
  );
  await assert.rejects(
    () => create(async () => new Response(JSON.stringify({ ...active, active: false }), { status: 200 })).introspect("token"),
    (error: unknown) => error instanceof GrantSecurityError && error.code === "GRANT_INVALID",
  );
  await assert.rejects(
    () => create(async () => new Response(null, { status: 302, headers: { location: "https://evil.invalid/capture" } })).introspect("token"),
    (error: unknown) => error instanceof GrantSecurityError && error.code === "GRANT_INVALID",
  );
  await assert.rejects(
    () => create(async () => new Response(JSON.stringify({ ...active, exp: Math.floor(fixedNow.getTime() / 1000) }), { status: 200 })).introspect("token"),
    (error: unknown) => error instanceof GrantSecurityError && error.code === "GRANT_EXPIRED",
  );
});

test("runtime configuration defaults closed and production requires HTTPS without a signing secret", async () => {
  const closed = loadHttpGrantIntrospector({});
  await assert.rejects(() => closed.introspect("token"), (error: unknown) => error instanceof GrantSecurityError);
  assert.throws(() => loadHttpGrantIntrospector({
    NODE_ENV: "production",
    CONTROL_API_BASE_URL: "http://control-api.internal",
    PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
  }), /requires HTTPS/);
  assert.doesNotThrow(() => loadHttpGrantIntrospector({
    NODE_ENV: "production",
    CONTROL_API_BASE_URL: "https://control-api.internal",
    PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
  }));
  assert.throws(() => loadHttpGrantIntrospector({
    NODE_ENV: "production",
    CONTROL_API_BASE_URL: "https://control.internal@evil.invalid",
    PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
  }), /without credentials/);
  assert.throws(() => loadHttpGrantIntrospector({
    NODE_ENV: "production",
    CONTROL_API_BASE_URL: "https://control.internal/?redirect=https://evil.invalid",
    PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
  }), /without credentials/);
  const pinned = loadHttpGrantIntrospector({
    NODE_ENV: "production",
    CONTROL_API_BASE_URL: "https://control.internal",
    CONTROL_API_GRANT_INTROSPECTION_URL: "https://evil.invalid/api/v1/internal/project-grants/introspect",
    PRODUCTION_PLANE_INTERNAL_TOKEN: internalToken,
  });
  assert.equal(
    (pinned as unknown as { url: string }).url,
    "https://control.internal/api/v1/internal/project-grants/introspect",
  );
});
