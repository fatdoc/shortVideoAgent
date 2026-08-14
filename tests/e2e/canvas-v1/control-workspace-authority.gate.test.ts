import express from "../../../apps/control-api/node_modules/express/index.js";
import request from "../../../apps/control-api/node_modules/supertest/index.js";
import { describe, expect, it, vi } from "vitest";

import { createInternalCanvasWorkspaceAuthorityRouter } from "../../../apps/control-api/src/assets/internalWorkspaceAuthorityRoutes";
import { CanvasWorkspaceAuthorityService } from "../../../apps/control-api/src/assets/workspaceAuthorityService";
import { canvasAssetError } from "../../../apps/control-api/src/assets/errors";

const token = "cv6-independent-control-workspace-authority-token";
const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  actorId: "12121212-1212-4212-8212-121212121212",
} as const;
const occurredAt = "2026-08-14T02:03:00.100Z";

function authorityRequest(overrides: Record<string, unknown> = {}) {
  return {
    objectType: "CanvasWorkspaceAuthorityRequest",
    contractVersion: "0.1",
    ...scope,
    requestId: "req-cv6-workspace-authority",
    occurredAt: "2026-08-14T02:03:00.000Z",
    ...overrides,
  };
}

function record(
  assetId: string,
  category: "human" | "virtual_character" | "store" | "product",
  overrides: Record<string, unknown> = {},
) {
  return {
    assetId,
    tenantId: scope.tenantId,
    projectId: scope.projectId,
    packageId: scope.packageId,
    canvasSessionId: "pcs_ORIGINALCREATIONSESSION1234567890",
    category,
    displayName: `asset-${category}`,
    provenanceKind: "customer_upload" as const,
    sourceAssetId: null,
    declaredByActorId: scope.actorId,
    declaredAt: new Date("2026-08-14T01:00:00.000Z"),
    rightsStatus: "authorized" as const,
    rightsBasis: "customer_owned" as const,
    rightsValidFrom: new Date("2026-08-14T01:00:00.000Z"),
    rightsValidUntil: null,
    rightsReviewedByActorId: scope.actorId,
    rightsReviewedAt: new Date("2026-08-14T01:00:00.000Z"),
    approvalStatus: "approved" as const,
    approvalReviewedByActorId: scope.actorId,
    approvalReviewedAt: new Date("2026-08-14T01:00:00.000Z"),
    storageReference: `private/${assetId}.png`,
    checksum: `sha256:${"a".repeat(64)}`,
    reuseScope: "project" as const,
    controlledPreviewUrl: `/api/canvas-v1/assets/${assetId}/preview`,
    createdAt: new Date("2026-08-14T01:00:00.000Z"),
    updatedAt: new Date("2026-08-14T01:00:00.000Z"),
    ...overrides,
  };
}

function serviceHarness(records = [
  record("70707070-7070-4070-8070-707070707070", "product"),
  record("99999999-9999-4999-8999-999999999999", "store"),
  record("88888888-8888-4888-8888-888888888888", "virtual_character"),
  record("60606060-6060-4060-8060-606060606060", "human"),
]) {
  const calls: string[] = [];
  const sessionAuthority = {
    assertActiveSession: vi.fn(async () => { calls.push("session"); }),
  };
  const productionAuthority = {
    readExact: vi.fn(async () => {
      calls.push("production");
      return {
        projectName: "真实门店项目",
        scriptId: "44444444-4444-4444-8444-444444444444",
        scriptVersion: 3,
        storyboardId: "55555555-5555-4555-8555-555555555555",
        storyboardVersion: 2,
      };
    }),
  };
  const assets = { listAssets: vi.fn(async () => { calls.push("assets"); return records; }) };
  const service = new CanvasWorkspaceAuthorityService({
    sessionAuthority,
    productionAuthority,
    assets,
    now: () => new Date(occurredAt),
  });
  return { calls, service, sessionAuthority, productionAuthority, assets };
}

describe("CV6 independent Control Workspace Authority gate", () => {
  it("authenticates before malformed parsing, enforces 16 KiB and returns fixed non-echo errors", async () => {
    const service = { read: vi.fn() };
    const app = express();
    app.use("/api/v1/internal", createInternalCanvasWorkspaceAuthorityRouter({ internalToken: token, service }));
    const unauthorized = await request(app)
      .post("/api/v1/internal/canvas-workspace-authorities")
      .set("content-type", "application/json")
      .send("{private-malformed");
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.error.code).toBe("CANVAS_WORKSPACE_AUTHORITY_INTERNAL_AUTH_INVALID");

    const malformed = await request(app)
      .post("/api/v1/internal/canvas-workspace-authorities")
      .set("x-production-plane-internal-token", token)
      .set("content-type", "application/json")
      .send("{private-malformed");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("CANVAS_WORKSPACE_AUTHORITY_REQUEST_INVALID");

    const oversized = await request(app)
      .post("/api/v1/internal/canvas-workspace-authorities")
      .set("x-production-plane-internal-token", token)
      .set("content-type", "application/json")
      .send(JSON.stringify({ ...authorityRequest(), padding: "x".repeat(17 * 1024) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("CANVAS_WORKSPACE_AUTHORITY_REQUEST_TOO_LARGE");
    expect(service.read).not.toHaveBeenCalled();
    expect([unauthorized, malformed, oversized].every((value) => value.headers["cache-control"] === "no-store")).toBe(true);
    expect(JSON.stringify([unauthorized.body, malformed.body, oversized.body])).not.toMatch(
      /private-malformed|padding|cv6-independent-control-workspace/i,
    );
  });

  it("checks exact active session before Package authority and returns exact numeric versions and safe sorted assets", async () => {
    const h = serviceHarness();
    const result = await h.service.read(authorityRequest());
    expect(h.calls).toEqual(["session", "production", "assets"]);
    expect(h.sessionAuthority.assertActiveSession).toHaveBeenCalledWith(scope);
    expect(h.productionAuthority.readExact).toHaveBeenCalledWith({
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      packageId: scope.packageId,
      now: new Date(occurredAt),
    });
    expect(result.project).toEqual({ projectName: "真实门店项目" });
    expect(result.approvedScript).toEqual({ scriptId: "44444444-4444-4444-8444-444444444444", version: 3 });
    expect(result.approvedStoryboard).toEqual({ storyboardId: "55555555-5555-4555-8555-555555555555", version: 2 });
    expect(result.assets.map(({ category, assetId }) => [category, assetId])).toEqual([
      ["human", "60606060-6060-4060-8060-606060606060"],
      ["virtual_character", "88888888-8888-4888-8888-888888888888"],
      ["store", "99999999-9999-4999-8999-999999999999"],
      ["product", "70707070-7070-4070-8070-707070707070"],
    ]);
    expect(result.assets.every((asset) => asset.canvasSessionId === scope.canvasSessionId)).toBe(true);
    expect(result.completeness).toEqual({ project: true, approvedScript: true, approvedStoryboard: true, assets: true });
    expect(JSON.stringify(result)).not.toMatch(
      /storageReference|checksum|contentBase64|asset:\/\/|provider|signedUrl|internalToken|packageSnapshot|payloadDigest/i,
    );
  });

  it("preserves the unique pending casting but blocks zero and multiple without a partial aggregate", async () => {
    const pending = record("88888888-8888-4888-8888-888888888888", "virtual_character", {
      rightsStatus: "pending",
      rightsValidFrom: null,
      rightsReviewedByActorId: null,
      rightsReviewedAt: null,
      approvalStatus: "pending",
      approvalReviewedByActorId: null,
      approvalReviewedAt: null,
    });
    await expect(serviceHarness([pending]).service.read(authorityRequest())).resolves.toMatchObject({
      assets: [{ assetId: pending.assetId, rights: { status: "pending" }, approval: { status: "pending" } }],
    });
    for (const [records, code] of [
      [[], "PRIMARY_VIRTUAL_CHARACTER_MISSING"],
      [[
        record("88888888-8888-4888-8888-888888888888", "virtual_character"),
        record("89898989-8989-4989-8989-898989898989", "virtual_character"),
      ], "PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS"],
    ] as const) {
      const h = serviceHarness([...records]);
      await expect(h.service.read(authorityRequest())).rejects.toMatchObject({ code });
      expect(h.calls).toEqual(["session", "production", "assets"]);
    }
  });

  it("fails exact-session authority closed before all downstream reads and performs no alternate write", async () => {
    const h = serviceHarness();
    h.sessionAuthority.assertActiveSession.mockRejectedValueOnce(
      canvasAssetError("CANVAS_SESSION_INVALID", "private exact-scope mismatch"),
    );
    await expect(h.service.read(authorityRequest({ actorId: "20202020-2020-4020-8020-202020202020" })))
      .rejects.toMatchObject({ code: "CANVAS_WORKSPACE_AUTHORITY_SESSION_INVALID" });
    expect(h.calls).toEqual([]);
    expect(h.productionAuthority.readExact).not.toHaveBeenCalled();
    expect(h.assets.listAssets).not.toHaveBeenCalled();
    expect(Object.keys(h.productionAuthority)).toEqual(["readExact"]);
    expect(Object.keys(h.assets)).toEqual(["listAssets"]);
  });

  it("HTTP casting errors contain no partial assets, authority or raw dependency detail", async () => {
    for (const code of ["PRIMARY_VIRTUAL_CHARACTER_MISSING", "PRIMARY_VIRTUAL_CHARACTER_AMBIGUOUS"] as const) {
      const service = { read: vi.fn(async () => { throw Object.assign(new Error(code), { code }); }) };
      const app = express();
      app.use("/api/v1/internal", createInternalCanvasWorkspaceAuthorityRouter({ internalToken: token, service }));
      const response = await request(app)
        .post("/api/v1/internal/canvas-workspace-authorities")
        .set("x-production-plane-internal-token", token)
        .set("x-request-id", authorityRequest().requestId)
        .set("content-type", "application/json")
        .send(authorityRequest());
      // Non-domain error-shaped objects must remain contained rather than trusted by code alone.
      expect(response.status).toBe(503);
      expect(response.body.error.code).toBe("CANVAS_WORKSPACE_AUTHORITY_DEPENDENCY_UNAVAILABLE");
      expect(JSON.stringify(response.body)).not.toMatch(/assets|storage|checksum|provider|private/i);
    }
  });
});
