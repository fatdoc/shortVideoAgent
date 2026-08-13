import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { test } from "node:test";
import express from "express";
import {
  PilotCanvasAuthorityRegistry,
  type PilotCanvasEntryReference,
} from "./pilotCanvasCapability";
import * as pilotCapability from "./pilotCanvasCapability";

const tenantId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const packageId = "33333333-3333-4333-8333-333333333333";
const entry: PilotCanvasEntryReference = {
  handle: `ce_${"A".repeat(32)}`,
  tenantId,
  projectId,
  packageId,
};

type SafeBootstrapFactory = (options: {
  allowedOrigin: string;
  verifySession(cookie: string): Promise<null>;
  redeem(input: PilotCanvasEntryReference): Promise<never>;
}) => express.Router;

async function listen(application: express.Express): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(application);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    server,
    url: `http://127.0.0.1:${address.port}/api/production/pilot/canvas/bootstrap`,
  };
}

async function close(server: http.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

test("malformed and oversized Pilot bootstrap JSON use the fixed safe envelope without logging secrets", async () => {
  const createSafeRouter = (pilotCapability as Record<string, unknown>)
    .createPilotCanvasSafeBootstrapRouter as SafeBootstrapFactory | undefined;
  assert.equal(typeof createSafeRouter, "function");

  const application = express();
  application.use(
    "/api/production/pilot/canvas/bootstrap",
    createSafeRouter!({
      allowedOrigin: "https://pilot.example.test",
      verifySession: async () => null,
      redeem: async () => { throw new Error("must not redeem invalid JSON"); },
    }),
  );
  const runtime = await listen(application);
  const stdout: string[] = [];
  const stderr: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...values: unknown[]) => stdout.push(values.join(" "));
  console.error = (...values: unknown[]) => stderr.push(values.join(" "));
  const sentinel = "SECRET_BODY_TOKEN_DIGEST_PACKAGE_PROVIDER_DATA_ROOT";

  try {
    for (const fixture of [
      {
        status: 400,
        code: "PILOT_CANVAS_MALFORMED_JSON",
        message: "Pilot Canvas request body is invalid.",
        body: `{"tenantId":"${sentinel}"`,
      },
      {
        status: 413,
        code: "PILOT_CANVAS_REQUEST_TOO_LARGE",
        message: "Pilot Canvas request body is too large.",
        body: JSON.stringify({ value: sentinel.repeat(2_000) }),
      },
    ]) {
      const response = await fetch(runtime.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          cookie: `videoagent_session=${sentinel}`,
          origin: "https://pilot.example.test",
          "x-request-id": "safe-request-id",
          "x-storycanvas-csrf": sentinel,
        },
        body: fixture.body,
      });
      assert.equal(response.status, fixture.status);
      assert.equal(response.headers.get("content-type")?.includes("application/json"), true);
      assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-request-id"), "safe-request-id");
      assert.deepEqual(await response.json(), {
        error: {
          code: fixture.code,
          message: fixture.message,
          requestId: "safe-request-id",
          retryable: false,
        },
      });
    }
    assert.equal(stdout.join("\n").includes(sentinel), false);
    assert.equal(stderr.join("\n").includes(sentinel), false);
    assert.equal(stderr.join("\n").includes("SyntaxError"), false);
  } finally {
    console.log = originalLog;
    console.error = originalError;
    await close(runtime.server);
  }
});

test("authority registry deduplicates, purges expiry, bounds capacity and clears raw authority", async () => {
  let currentTime = Date.parse("2026-08-12T01:00:00.000Z");
  let redeemCalls = 0;
  const fakeClient = {
    redeem: async (input: PilotCanvasEntryReference) => {
      redeemCalls += 1;
      const expiresAt = new Date(currentTime + 10 * 60 * 1_000).toISOString();
      return {
        handle: input.handle,
        tenantId: input.tenantId,
        projectId: input.projectId,
        packageId: input.packageId,
        grant: { expiresAt },
        productionPackage: { expiresAt },
      };
    },
  };
  const Registry = PilotCanvasAuthorityRegistry as unknown as new (
    client: unknown,
    options: { capacity: number; now(): number },
  ) => PilotCanvasAuthorityRegistry;
  const registry = new Registry(fakeClient, {
    capacity: 2,
    now: () => currentTime,
    registrar: {
      register: async () => ({
        status: "active" as const,
        expiresAt: new Date(currentTime + 10 * 60 * 1_000).toISOString(),
        replayed: false,
      }),
    },
  });

  const first = await registry.openEntry(entry);
  const duplicate = await registry.openEntry(entry);
  assert.equal(duplicate.authorityId, first.authorityId);
  assert.equal(redeemCalls, 1);

  const second = await registry.openEntry({ ...entry, handle: `ce_${"B".repeat(32)}` });
  await registry.openEntry({ ...entry, handle: `ce_${"C".repeat(32)}` });
  assert.equal(registry.readServerAuthority(first.authorityId), null);
  assert.notEqual(registry.readServerAuthority(second.authorityId), null);

  currentTime = Date.parse("2026-08-12T01:11:00.000Z");
  assert.equal((registry as unknown as { purgeExpired(): number }).purgeExpired(), 2);
  assert.equal(registry.readServerAuthority(second.authorityId), null);

  const afterExpiry = await registry.openEntry(entry);
  assert.notEqual(afterExpiry.authorityId, first.authorityId);
  registry.clear();
  assert.equal(registry.readServerAuthority(afterExpiry.authorityId), null);
  assert.equal((registry as unknown as { activeCount(): number }).activeCount(), 0);
});

test("Pilot routes are mounted before the legacy tokenKey gate", async () => {
  const appSource = await readFile(path.resolve(process.cwd(), "src/app.ts"), "utf8");
  const pilotBoundary = appSource.indexOf("installPilotCanvasRequestBoundary");
  const legacyTokenKey = appSource.indexOf('where("key", "tokenKey")');
  assert.ok(pilotBoundary >= 0);
  assert.ok(legacyTokenKey >= 0);
  assert.ok(pilotBoundary < legacyTokenKey);
});

test("Pilot runtime logs contain no data paths", async () => {
  const appSource = await readFile(path.resolve(process.cwd(), "src/app.ts"), "utf8");
  assert.equal(appSource.includes('console.log("文件目录:", ossDir)'), false);
  assert.equal(appSource.includes('console.log("文件目录:", skillsDir)'), false);
  assert.equal(appSource.includes('console.log("文件目录:", assetsDir)'), false);
});

test("bounded shutdown clears authority and closes HTTP, Socket.IO and WebSocket resources", async () => {
  const closeRuntime = (pilotCapability as Record<string, unknown>)
    .closePilotCanvasRuntimeResources as undefined | ((input: Record<string, unknown>) => Promise<Record<string, unknown>>);
  assert.equal(typeof closeRuntime, "function");

  const calls: string[] = [];
  const evidence = await closeRuntime!({
    signal: "SIGTERM",
    timeoutMs: 5_000,
    registry: { clear: () => calls.push("registry") },
    http: { close: (callback: (error?: Error) => void) => { calls.push("http"); callback(); } },
    socketIo: { close: (callback: () => void) => { calls.push("socket.io"); callback(); } },
    webSocket: { close: (callback: () => void) => { calls.push("websocket"); callback(); } },
  });
  assert.deepEqual(calls, ["registry", "socket.io", "websocket", "http"]);
  assert.deepEqual(evidence, {
    signal: "SIGTERM",
    registryCleared: true,
    httpClosed: true,
    socketIoClosed: true,
    webSocketClosed: true,
    pendingTimerCount: 0,
  });
});
