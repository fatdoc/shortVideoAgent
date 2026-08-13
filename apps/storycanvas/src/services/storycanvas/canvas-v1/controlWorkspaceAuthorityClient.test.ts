import assert from "node:assert/strict";
import test from "node:test";

import type { CanvasWorkspaceAuthorityRequestV01 } from "@/contracts/canvas-v1/workspaceMaterialization";
import { ControlCanvasWorkspaceAuthorityClient } from "./controlWorkspaceAuthorityClient";

const request: CanvasWorkspaceAuthorityRequestV01 = {
  objectType: "CanvasWorkspaceAuthorityRequest",
  contractVersion: "0.1",
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
  requestId: "req-workspace-authority",
  occurredAt: "2026-08-14T02:03:00.000Z",
};

const virtualCharacter = {
  objectType: "AssetRecord",
  contractVersion: "0.1",
  tenantId: request.tenantId,
  projectId: request.projectId,
  packageId: request.packageId,
  canvasSessionId: request.canvasSessionId,
  assetId: "88888888-8888-4888-8888-888888888888",
  category: "virtual_character",
  displayName: "门店讲解员",
  provenance: {
    kind: "customer_upload",
    sourceAssetId: null,
    declaredByActorId: request.actorId,
    declaredAt: "2026-08-14T01:40:00.000Z",
  },
  rights: {
    status: "authorized",
    basis: "customer_owned",
    validFrom: "2026-08-14T01:40:00.000Z",
    validUntil: null,
    reviewedAt: "2026-08-14T01:42:00.000Z",
  },
  approval: {
    status: "approved",
    reviewedByActorId: request.actorId,
    reviewedAt: "2026-08-14T01:43:00.000Z",
  },
  controlledPreviewUrl: "/api/canvas-v1/assets/88888888-8888-4888-8888-888888888888/preview",
  createdAt: "2026-08-14T01:40:00.000Z",
  updatedAt: "2026-08-14T01:43:00.000Z",
  occurredAt: "2026-08-14T01:43:00.000Z",
};

function authority(overrides: Record<string, unknown> = {}) {
  return {
    objectType: "CanvasWorkspaceAuthority",
    contractVersion: "0.1",
    tenantId: request.tenantId,
    projectId: request.projectId,
    packageId: request.packageId,
    canvasSessionId: request.canvasSessionId,
    project: { projectName: "门店探店获客视频" },
    approvedScript: { scriptId: "44444444-4444-4444-8444-444444444444", version: 3 },
    approvedStoryboard: { storyboardId: "55555555-5555-4555-8555-555555555555", version: 2 },
    assets: [virtualCharacter],
    completeness: { project: true, approvedScript: true, approvedStoryboard: true, assets: true },
    requestId: request.requestId,
    occurredAt: "2026-08-14T02:03:00.100Z",
    ...overrides,
  };
}

test("workspace authority client sends the exact server-only request and accepts only a bound strict response", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const client = new ControlCanvasWorkspaceAuthorityClient({
    controlApiBaseUrl: "https://control.example.test",
    internalToken: "t".repeat(48),
    fetch: async (url, init) => {
      capturedUrl = String(url);
      capturedInit = init;
      return new Response(JSON.stringify(authority()), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    },
  });

  assert.deepEqual(await client.fetch(request), authority());
  assert.equal(capturedUrl, "https://control.example.test/api/v1/internal/canvas-workspace-authorities");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("x-production-plane-internal-token"), "t".repeat(48));
  assert.equal(headers.get("x-request-id"), request.requestId);
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), request);
});

test("workspace authority client rejects scope drift and unsafe dependency output", async () => {
  for (const response of [
    new Response(JSON.stringify(authority({ projectId: "99999999-9999-4999-8999-999999999999" })), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
    new Response(JSON.stringify({ ...authority(), providerAssetId: "secret" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  ]) {
    const client = new ControlCanvasWorkspaceAuthorityClient({
      controlApiBaseUrl: "https://control.example.test",
      internalToken: "t".repeat(48),
      fetch: async () => response,
    });
    await assert.rejects(() => client.fetch(request), (error: unknown) =>
      (error as { code?: unknown }).code === "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE");
  }
});
