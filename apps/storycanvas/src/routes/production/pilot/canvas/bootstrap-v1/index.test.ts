import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import test from "node:test";
import express from "express";

import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { installCanvasResponseBoundary } from "@/services/storycanvas/canvas-v1/http";
import { createCanvasV1FormalBootstrapRouter } from ".";

const fixture = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "../../docs/program/contracts/canvas-v1/fixtures/workspace-materialization.json"), "utf8"));
const scope: CanvasProductionScope = {
  tenantId: fixture.workspaceResponse.tenantId,
  projectId: fixture.workspaceResponse.projectId,
  packageId: fixture.workspaceResponse.packageId,
  canvasSessionId: fixture.workspaceResponse.canvasSessionId,
  actorId: fixture.workspaceResponse.project.requestedByActorId,
  localProjectId: 42,
};

test("formal bootstrap GET returns the strict browser-safe object without CSRF", async (context) => {
  const app = express();
  app.use(installCanvasResponseBoundary);
  app.use(createCanvasV1FormalBootstrapRouter({
    resolveRequestScope: async () => scope,
    prepare: async () => fixture.workspaceResponse.bootstrap,
  }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/`, { headers: { "x-request-id": "req-formal-bootstrap" } });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), fixture.workspaceResponse.bootstrap);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
