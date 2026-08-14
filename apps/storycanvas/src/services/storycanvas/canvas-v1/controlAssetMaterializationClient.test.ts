import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";

import type { CanvasAssetMaterializationRequestV01 } from "@/contracts/canvas-v1/workspaceMaterialization";
import { ControlCanvasAssetMaterializationClient } from "./controlAssetMaterializationClient";

const bytes = Buffer.from([0xff, 0xd8, 0xff]);
const request: CanvasAssetMaterializationRequestV01 = {
  objectType: "CanvasAssetMaterializationRequest", contractVersion: "0.1",
  tenantId: "11111111-1111-4111-8111-111111111111", projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333", canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  assetId: "88888888-8888-4888-8888-888888888888", actorId: "12121212-1212-4212-8212-121212121212",
  materializationAttemptId: "20202020-2020-4020-8020-202020202020", requestId: "req-materialization", occurredAt: "2026-08-14T02:06:00.000Z",
};
const response = {
  objectType: "CanvasAssetMaterialization", contractVersion: "0.1", tenantId: request.tenantId, projectId: request.projectId,
  packageId: request.packageId, canvasSessionId: request.canvasSessionId, assetId: request.assetId,
  materializationAttemptId: request.materializationAttemptId, materializationId: "19191919-1919-4919-8919-191919191919",
  category: "virtual_character", mimeType: "image/jpeg", byteSize: bytes.length,
  checksum: `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`, contentEncoding: "base64",
  contentBase64: bytes.toString("base64"), replayed: true, requestId: request.requestId, occurredAt: "2026-08-14T02:06:00.100Z",
};

test("materialization client replays the identical attempt once after response loss", async () => {
  const bodies: string[] = [];
  let calls = 0;
  const client = new ControlCanvasAssetMaterializationClient({
    controlApiBaseUrl: "https://control.example.test", internalToken: "t".repeat(48),
    fetch: async (url, init) => {
      calls += 1;
      assert.equal(String(url), "https://control.example.test/api/v1/internal/canvas-assets/materializations");
      bodies.push(String(init?.body));
      if (calls === 1) throw new Error("response lost");
      assert.equal(new Headers(init?.headers).get("x-production-plane-internal-token"), "t".repeat(48));
      return new Response(JSON.stringify(response), { status: 200, headers: { "content-type": "application/json" } });
    },
  });
  assert.deepEqual(await client.materialize(request), response);
  assert.equal(calls, 2);
  assert.equal(bodies[0], bodies[1]);
});

test("materialization client rejects response drift", async () => {
  const client = new ControlCanvasAssetMaterializationClient({
    controlApiBaseUrl: "https://control.example.test", internalToken: "t".repeat(48),
    fetch: async () => new Response(JSON.stringify({ ...response, assetId: "99999999-9999-4999-8999-999999999999" }), { status: 200, headers: { "content-type": "application/json" } }),
  });
  await assert.rejects(() => client.materialize(request), (error: unknown) =>
    (error as { code?: unknown }).code === "CANVAS_MATERIALIZATION_INVALID_RESPONSE");
});
