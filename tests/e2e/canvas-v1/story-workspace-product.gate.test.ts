import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import type { CanvasWorkspaceAuthorityRequestV01 } from "../../../apps/storycanvas/src/contracts/canvas-v1/workspaceMaterialization.js";

const rootDir = process.cwd();
const contractDir = path.join(rootDir, "docs/program/contracts/canvas-v1");
const authorityFixture = JSON.parse(fs.readFileSync(
  path.join(contractDir, "fixtures/workspace-authority.json"),
  "utf8",
));
const request = authorityFixture.authorityRequest as CanvasWorkspaceAuthorityRequestV01;

function codeOf(error: unknown): string | null {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: unknown }).code)
    : null;
}

test("Control workspace authority client sends one exact server-only request and rejects response scope drift", async () => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlWorkspaceAuthorityClient.js"
  );
  const Client = module.ControlCanvasWorkspaceAuthorityClient;
  assert.equal(typeof Client, "function");

  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const client = new Client({
    controlApiBaseUrl: "https://control.example.test/",
    internalToken: "i".repeat(48),
    fetch: async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(JSON.stringify(authorityFixture.authorityResponse), {
        status: 200,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    },
  });

  assert.deepEqual(await client.fetch(request), authorityFixture.authorityResponse);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, "https://control.example.test/api/v1/internal/canvas-workspace-authorities");
  assert.equal(calls[0]?.init?.method, "POST");
  const headers = new Headers(calls[0]?.init?.headers);
  assert.equal(headers.get("content-type"), "application/json");
  assert.equal(headers.get("x-production-plane-internal-token"), "i".repeat(48));
  assert.equal(headers.get("x-request-id"), request.requestId);
  assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), request);

  const drifted = structuredClone(authorityFixture.authorityResponse);
  drifted.canvasSessionId = "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321";
  const rejectingClient = new Client({
    controlApiBaseUrl: "https://control.example.test",
    internalToken: "i".repeat(48),
    fetch: async () => new Response(JSON.stringify(drifted), {
      status: 200,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    }),
  });
  await assert.rejects(
    () => rejectingClient.fetch(request),
    (error: unknown) => codeOf(error) === "CANVAS_WORKSPACE_AUTHORITY_INVALID_RESPONSE",
  );
});

test("workspace authority dependency failure is fixed and cannot echo internal authority", async () => {
  const module = await import(
    "../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlWorkspaceAuthorityClient.js"
  );
  const Client = module.ControlCanvasWorkspaceAuthorityClient;
  const marker = "storageReference=/private/root/person.png token=never-echo";
  const client = new Client({
    controlApiBaseUrl: "https://control.example.test",
    internalToken: "i".repeat(48),
    fetch: async () => new Response(marker, {
      status: 503,
      headers: { "content-type": "text/plain", "cache-control": "no-store" },
    }),
  });
  await assert.rejects(async () => client.fetch(request), (error: unknown) => {
    const serialized = `${String(error)} ${JSON.stringify(error)}`.toLowerCase();
    assert.equal(serialized.includes("storagereference"), false);
    assert.equal(serialized.includes("never-echo"), false);
    assert.equal(serialized.includes("/private/root"), false);
    return codeOf(error) === "CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE";
  });
});

test("all frozen Story G5 runtime modules are importable through their public exports", async () => {
  const surfaces = [
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspacePrepare.js", "CanvasV1WorkspacePreparer"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/workspaceProjection.js", "CanvasV1WorkspaceReader"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlAssetMaterializationClient.js", "ControlCanvasAssetMaterializationClient"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/assetMaterialization.js", "CanvasV1AssetMaterializer"],
    ["../../../apps/storycanvas/src/services/storycanvas/canvas-v1/controlledMedia.js", "CanvasV1ControlledMediaService"],
    ["../../../apps/storycanvas/src/routes/production/pilot/canvas/bootstrap-v1/index.js", "createCanvasV1FormalBootstrapRouter"],
    ["../../../apps/storycanvas/src/routes/production/pilot/canvas/workspace/index.js", "createCanvasV1WorkspaceRouter"],
    ["../../../apps/storycanvas/src/routes/production/pilot/canvas/media/index.js", "createCanvasV1MediaRouter"],
  ] as const;
  for (const [modulePath, exportName] of surfaces) {
    const module = await import(modulePath);
    assert.equal(typeof module[exportName], "function", `${modulePath}#${exportName}`);
  }
});
