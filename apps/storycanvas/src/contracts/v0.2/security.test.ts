import assert from "node:assert/strict";
import { test } from "node:test";
import {
  GrantSecurityError,
  HttpActiveGrantIntrospector,
  loadHttpGrantIntrospector,
} from "./security";

const internalToken = "internal-token-at-least-thirty-two-characters";
const active = {
  active: true as const,
  tenantId: "tenant-pilot-01",
  projectId: "project-pilot-01",
  packageId: "package-project-pilot-01-v1",
  capabilities: ["video.generate"],
  scopes: ["production.package.read", "production.task.write"],
  exp: 1_785_892_201,
};

test("HTTP introspection sends only the two authorization headers and accepts A05.3 active context", async () => {
  let observed: RequestInit | undefined;
  const introspector = new HttpActiveGrantIntrospector({
    url: "http://127.0.0.1/introspect",
    internalToken,
    allowInsecureHttp: true,
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
});

test("HTTP introspection maps expiry and fails closed for rejection, network failure, and malformed success", async () => {
  const create = (fetchImpl: typeof fetch) => new HttpActiveGrantIntrospector({
    url: "http://127.0.0.1/introspect",
    internalToken,
    allowInsecureHttp: true,
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
});
