import { createHash } from "node:crypto";
import express from "../../../apps/control-api/node_modules/express/index.js";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "../../../apps/control-api/node_modules/supertest/index.js";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createInternalCanvasAssetMaterializationRouter } from "../../../apps/control-api/src/assets/internalMaterializationRoutes";
import { parseCanvasAssetMaterializationResponse } from "../../../apps/control-api/src/assets/materializationParser";
import { CanvasAssetMaterializationService } from "../../../apps/control-api/src/assets/materializationService";
import { LocalCanvasAssetStorageReader } from "../../../apps/control-api/src/assets/materializationStorage";

const token = "cv6-independent-control-materialization-token";
const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  assetId: "88888888-8888-4888-8888-888888888888",
  actorId: "12121212-1212-4212-8212-121212121212",
} as const;

function materializationRequest(overrides: Record<string, unknown> = {}) {
  return {
    objectType: "CanvasAssetMaterializationRequest",
    contractVersion: "0.1",
    ...scope,
    materializationAttemptId: "90909090-9090-4090-8090-909090909090",
    requestId: "req-cv6-materialization-001",
    occurredAt: "2026-08-14T02:00:00.000Z",
    ...overrides,
  };
}

function responseFor(bytes: Buffer, overrides: Record<string, unknown> = {}) {
  const { actorId: _actor, ...responseScope } = scope;
  return {
    objectType: "CanvasAssetMaterialization",
    contractVersion: "0.1",
    ...responseScope,
    materializationAttemptId: materializationRequest().materializationAttemptId,
    materializationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    category: "virtual_character",
    mimeType: "image/jpeg",
    byteSize: bytes.length,
    checksum: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
    contentEncoding: "base64",
    contentBase64: bytes.toString("base64"),
    replayed: false,
    requestId: materializationRequest().requestId,
    occurredAt: materializationRequest().occurredAt,
    ...overrides,
  };
}

function codeOf(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error && typeof error === "object" && "code" in error
      ? String(error.code)
      : `${error instanceof Error ? error.name : "Error"}:${error instanceof Error ? error.message : String(error)}`;
  }
}

const tempRoots: string[] = [];
afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((value) => rm(value, { recursive: true, force: true })));
});

describe("CV6 independent Control materialization gate", () => {
  it("keeps 3-byte JPEG, exact 8 MiB and 8 MiB plus one parser boundaries bounded", () => {
    const minimum = Buffer.from([0xff, 0xd8, 0xff]);
    expect(parseCanvasAssetMaterializationResponse(responseFor(minimum)).byteSize).toBe(3);

    const oneByte = Buffer.from([0xff]);
    expect(codeOf(() => parseCanvasAssetMaterializationResponse(responseFor(oneByte)))).toBe(
      "CANVAS_MATERIALIZATION_MIME_UNSUPPORTED",
    );

    const exact = Buffer.alloc(8 * 1024 * 1024);
    exact.set(minimum);
    expect(codeOf(() => parseCanvasAssetMaterializationResponse(responseFor(exact)))).toBe(null);
    expect(
      codeOf(() => parseCanvasAssetMaterializationResponse(responseFor(exact, { byteSize: exact.length + 1 }))),
    ).toBe("CANVAS_MATERIALIZATION_SOURCE_TOO_LARGE");
    for (const contentBase64 of ["not base64", `${minimum.toString("base64")}=`, "AB=="]) {
      expect(
        codeOf(() => parseCanvasAssetMaterializationResponse(responseFor(minimum, { contentBase64 }))),
      ).toBe("CANVAS_MATERIALIZATION_RESPONSE_INVALID");
    }
  });

  it("authenticates before JSON parsing, enforces 16 KiB and never echoes raw input or token", async () => {
    const service = { materialize: vi.fn(async () => responseFor(Buffer.from([0xff, 0xd8, 0xff]))) };
    const app = express();
    app.use("/api/v1/internal", createInternalCanvasAssetMaterializationRouter({ internalToken: token, service }));
    const unauthorized = await request(app)
      .post("/api/v1/internal/canvas-assets/materializations")
      .set("content-type", "application/json")
      .send("{raw-secret-broken");
    expect(unauthorized.status).toBe(401);
    expect(unauthorized.body.error.code).toBe("CANVAS_MATERIALIZATION_INTERNAL_AUTH_INVALID");

    const malformed = await request(app)
      .post("/api/v1/internal/canvas-assets/materializations")
      .set("x-production-plane-internal-token", token)
      .set("content-type", "application/json")
      .send("{raw-secret-broken");
    expect(malformed.status).toBe(400);
    expect(malformed.body.error.code).toBe("CANVAS_MATERIALIZATION_REQUEST_INVALID");

    const oversized = await request(app)
      .post("/api/v1/internal/canvas-assets/materializations")
      .set("x-production-plane-internal-token", token)
      .set("content-type", "application/json")
      .send(JSON.stringify({ ...materializationRequest(), rawSecretPadding: "z".repeat(17 * 1024) }));
    expect(oversized.status).toBe(413);
    expect(oversized.body.error.code).toBe("CANVAS_MATERIALIZATION_REQUEST_TOO_LARGE");
    expect(JSON.stringify([unauthorized.body, malformed.body, oversized.body])).not.toMatch(
      /raw-secret|rawSecretPadding|production-plane-internal-token|cv6-independent-control/i,
    );
    expect([unauthorized, malformed, oversized].every((value) => value.headers["cache-control"] === "no-store")).toBe(true);
    expect(service.materialize).not.toHaveBeenCalled();
  });

  it("contains local reads against traversal, schemes and final/intermediate symlinks", async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "cv6-control-materialization-root-"));
    const outsideRoot = await mkdtemp(join(tmpdir(), "cv6-control-materialization-outside-"));
    tempRoots.push(storageRoot, outsideRoot);
    await mkdir(join(storageRoot, "tenant-assets"));
    await mkdir(join(outsideRoot, "nested"));
    const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
    await writeFile(join(storageRoot, "tenant-assets", "ok.jpg"), jpeg);
    await writeFile(join(outsideRoot, "outside.jpg"), jpeg);
    await symlink(join(outsideRoot, "outside.jpg"), join(storageRoot, "tenant-assets", "final-link.jpg"));
    await symlink(join(outsideRoot, "nested"), join(storageRoot, "tenant-assets", "dir-link"));
    const reader = new LocalCanvasAssetStorageReader(storageRoot);
    await expect(reader.read("tenant-assets/ok.jpg")).resolves.toMatchObject({ byteSize: 3, mimeType: "image/jpeg" });
    for (const value of [
      "../outside.jpg",
      "tenant-assets/../../outside.jpg",
      "/etc/passwd",
      "file:///etc/passwd",
      "https://bucket.invalid/object",
      "asset://provider/raw",
      "tenant-assets/final-link.jpg",
      "tenant-assets/dir-link/missing.jpg",
    ]) await expect(reader.read(value)).rejects.toMatchObject({ code: "CANVAS_MATERIALIZATION_SOURCE_UNAVAILABLE" });
  });

  it("checks active exact session, asset scope, rights and approval before storage or persistence", async () => {
    const calls: string[] = [];
    const jpeg = Buffer.from([0xff, 0xd8, 0xff]);
    const checksum = `sha256:${createHash("sha256").update(jpeg).digest("hex")}`;
    const asset = {
      ...scope,
      canvasSessionId: "pcs_ORIGINALCREATIONSESSION1234567890",
      category: "virtual_character" as const,
      displayName: "Guide",
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
      storageReference: "tenant-assets/guide.jpg",
      checksum,
      reuseScope: "project" as const,
      controlledPreviewUrl: null,
      createdAt: new Date("2026-08-14T01:00:00.000Z"),
      updatedAt: new Date("2026-08-14T01:00:00.000Z"),
    };
    const sessionAuthority = { assertActiveSession: vi.fn(async () => { calls.push("session"); }) };
    const assets = { getAsset: vi.fn(async () => { calls.push("asset"); return asset; }) };
    const storage = { read: vi.fn(async () => { calls.push("storage"); return { bytes: jpeg, mimeType: "image/jpeg" as const, byteSize: 3, checksum }; }) };
    const attempts = { createOrReplay: vi.fn(async (input) => { calls.push("attempt"); return { kind: "created" as const, value: input }; }) };
    const service = new CanvasAssetMaterializationService({
      sessionAuthority,
      assets,
      storage,
      attempts,
      now: () => new Date("2026-08-14T02:00:00.000Z"),
      newId: () => "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    await expect(service.materialize(materializationRequest())).resolves.toMatchObject({ byteSize: 3 });
    expect(calls).toEqual(["session", "asset", "storage", "attempt"]);
    expect(sessionAuthority.assertActiveSession).toHaveBeenCalledWith({
      tenantId: scope.tenantId,
      projectId: scope.projectId,
      packageId: scope.packageId,
      canvasSessionId: scope.canvasSessionId,
      actorId: scope.actorId,
    });

    for (const changed of [
      { packageId: "30303030-3030-4030-8030-303030303030" },
      { rightsStatus: "revoked" },
      { approvalStatus: "pending" },
      { category: "store" },
    ]) {
      calls.length = 0;
      assets.getAsset.mockResolvedValueOnce({ ...asset, ...changed } as typeof asset);
      await expect(service.materialize(materializationRequest())).rejects.toMatchObject({
        code: expect.stringMatching(/^CANVAS_MATERIALIZATION_(?:SCOPE_MISMATCH|RIGHTS_NOT_AUTHORIZED|ASSET_NOT_APPROVED|CATEGORY_UNSUPPORTED)$/),
      });
      expect(storage.read).not.toHaveBeenCalledTimes(2);
    }
  });
});
