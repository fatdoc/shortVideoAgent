import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import express from "express";

import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { installCanvasResponseBoundary } from "@/services/storycanvas/canvas-v1/http";
import { createCanvasV1MediaRouter } from ".";

const scope: CanvasProductionScope = {
  tenantId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333", canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212", localProjectId: 42,
};
const assetId = "13131313-1313-4313-8313-131313131313";

test("controlled media route authenticates before streaming safe range headers", async (context) => {
  let resolved = 0;
  let opened = 0;
  const app = express();
  app.use(installCanvasResponseBoundary);
  app.use(createCanvasV1MediaRouter({
    resolveRequestScope: async () => { resolved += 1; return scope; },
    media: { open: async (input) => {
      opened += 1;
      assert.equal(input.range, "bytes=0-4");
      return {
        status: 206,
        contentType: "video/mp4",
        contentLength: 5,
        contentRange: "bytes 0-4/5",
        acceptRanges: "bytes",
        body: new Response(Buffer.from("video")).body!,
      };
    } },
  }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  context.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/${assetId}/preview`, { headers: { range: "bytes=0-4" } });
  assert.equal(response.status, 206);
  assert.equal(await response.text(), "video");
  assert.equal(response.headers.get("content-range"), "bytes 0-4/5");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.has("location"), false);
  assert.equal(resolved, 1);
  assert.equal(opened, 1);
});
