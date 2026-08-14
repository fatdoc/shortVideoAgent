import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { PublicSession } from "../../../apps/control-api/src/auth/service.js";
import { createCanvasAssetRouter } from "../../../apps/control-api/src/assets/routes.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const actorId = "12121212-1212-4212-8212-121212121212";
const projectId = "22222222-2222-4222-8222-222222222222";
const trustedPackageId = "33333333-3333-4333-8333-333333333333";
const foreignSameProjectPackageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const trustedCanvasSessionId = "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678";
const foreignCanvasSessionId = "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321";
const sessionToken = "authenticated-browser-session";
const csrfSecret = "cv6-csrf-secret-with-at-least-32-bytes";
const origin = "https://app.videoagent.test";

const session: PublicSession = {
  user: { id: actorId, email: "actor@example.test", displayName: "Actor" },
  tenant: { id: tenantId, displayName: "Tenant" },
  roles: ["tenant_admin"],
  activeContext: {
    membershipId: "13131313-1313-4313-8313-131313131313",
    organizationId: "14141414-1414-4414-8414-141414141414",
    organizationType: "TENANT",
    organizationDisplayName: "Tenant",
    membershipVersion: 1,
    primaryRole: "tenant_admin",
    roles: ["tenant_admin"],
    tenantId,
  },
  expiresAt: "2026-08-14T04:00:00.000Z",
};

function mutationHeaders(input: request.Test): request.Test {
  const csrf = createHmac("sha256", csrfSecret).update(sessionToken).digest("base64url");
  return input
    .set("Cookie", `videoagent_session=${sessionToken}`)
    .set("Origin", origin)
    .set("x-csrf-token", csrf);
}

function assetBody() {
  return {
    packageId: foreignSameProjectPackageId,
    canvasSessionId: foreignCanvasSessionId,
    category: "image",
    displayName: "跨会话素材",
    provenance: { kind: "customer_upload", sourceAssetId: null },
    rights: { status: "pending", basis: "customer_owned", validFrom: null, validUntil: null },
    storageReference: "tenant-assets/cross-session.png",
    checksum: `sha256:${"a".repeat(64)}`,
    reuseScope: "project",
    controlledPreviewUrl: null,
  };
}

function approvalBody() {
  return {
    packageId: foreignSameProjectPackageId,
    canvasSessionId: foreignCanvasSessionId,
    commandType: "GENERATE_SHOT",
    action: {
      shotId: "66666666-6666-4666-8666-666666666666",
      readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    },
    expiresInSeconds: 120,
    replayPolicy: "single_use_replay_same_command",
  };
}

function harness() {
  const service = {
    createAsset: vi.fn(async (_actor, _projectId, input) => ({
      objectType: "AssetRecord",
      contractVersion: "0.1",
      tenantId,
      projectId,
      packageId: input.packageId,
      canvasSessionId: input.canvasSessionId,
      assetId: "88888888-8888-4888-8888-888888888888",
      category: input.category,
      displayName: input.displayName,
      provenance: {
        ...input.provenance,
        declaredByActorId: actorId,
        declaredAt: "2026-08-14T02:00:00.000Z",
      },
      rights: { ...input.rights, reviewedAt: null },
      approval: { status: "pending", reviewedByActorId: null, reviewedAt: null },
      controlledPreviewUrl: input.controlledPreviewUrl,
      createdAt: "2026-08-14T02:00:00.000Z",
      updatedAt: "2026-08-14T02:00:00.000Z",
      occurredAt: "2026-08-14T02:00:00.000Z",
    })),
    listAssets: vi.fn(async () => []),
    getAsset: vi.fn(),
    transitionRights: vi.fn(),
    transitionApproval: vi.fn(),
    createHighCostApproval: vi.fn(async () => ({
      approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      status: "active",
    })),
    readHighCostApproval: vi.fn(),
  };
  const router = createCanvasAssetRouter({
    service,
    policy: {
      canCreateProject: async () => true,
      listVisibleProjectIds: async () => null,
      resolveProjectAccess: async () => "manager",
    },
    resolveSession: async () => ({ session }),
    secureCookies: true,
    sessionTtlSeconds: 3600,
    allowedOrigins: [origin],
    csrfSecret,
  });
  const app = express();
  app.use(express.json());
  app.use("/api/v1", router);
  return { app, service };
}

describe("G2 frozen Canvas Entry/Package/Session authority", () => {
  it("rejects asset creation outside the authenticated actor's frozen package/session", async () => {
    const { app, service } = harness();
    const response = await mutationHeaders(
      request(app).post(`/api/v1/projects/${projectId}/canvas-assets`),
    ).send(assetBody());

    expect(response.status).toBe(403);
    expect(service.createAsset).not.toHaveBeenCalled();
  });

  it("rejects high-cost approval minting outside the frozen package/session", async () => {
    const { app, service } = harness();
    const response = await mutationHeaders(
      request(app).post(`/api/v1/projects/${projectId}/canvas-command-approvals`),
    ).send(approvalBody());

    expect(response.status).toBe(403);
    expect(service.createHighCostApproval).not.toHaveBeenCalled();
  });

  it("documents the trusted scope used by this negative gate", () => {
    expect(trustedPackageId).not.toBe(foreignSameProjectPackageId);
    expect(trustedCanvasSessionId).not.toBe(foreignCanvasSessionId);
  });
});
