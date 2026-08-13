import { createHmac } from "node:crypto";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import type { PublicSession } from "../../../apps/control-api/src/auth/service.js";
import { CanvasAssetDomainError } from "../../../apps/control-api/src/assets/errors.js";
import { createCanvasAssetRouter } from "../../../apps/control-api/src/assets/routes.js";
import { CanvasAssetAuthorityService } from "../../../apps/control-api/src/assets/service.js";
import type { CanvasAssetAuthorityStore } from "../../../apps/control-api/src/assets/types.js";

const tenantId = "11111111-1111-4111-8111-111111111111";
const actorId = "12121212-1212-4212-8212-121212121212";
const projectId = "22222222-2222-4222-8222-222222222222";
const foreignPackageId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
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
    packageId: foreignPackageId,
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
    packageId: foreignPackageId,
    canvasSessionId: foreignCanvasSessionId,
    commandType: "GENERATE_SHOT",
    action: { shotId: "66666666-6666-4666-8666-666666666666" },
    expiresInSeconds: 120,
    replayPolicy: "single_use_replay_same_command",
  };
}

function harness(withSessionAuthority: boolean) {
  const calls: string[] = [];
  const createAsset = vi.fn();
  const createHighCostApproval = vi.fn();
  const store = {
    createAsset,
    createHighCostApproval,
  } as unknown as CanvasAssetAuthorityStore;
  const authority = new CanvasAssetAuthorityService(store, "a".repeat(32), {
    sessionAuthority: withSessionAuthority
      ? {
          assertActiveSession: vi.fn(async () => {
            calls.push("session-authority");
            throw new CanvasAssetDomainError(
              "CANVAS_SESSION_INVALID",
              "Canvas session authority is invalid.",
            );
          }),
        }
      : undefined,
  });
  const resolveProjectAccess = vi.fn(async () => {
    calls.push("project-policy");
    return "manager" as const;
  });
  const router = createCanvasAssetRouter({
    service: authority,
    policy: {
      canCreateProject: async () => true,
      listVisibleProjectIds: async () => null,
      resolveProjectAccess,
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
  return { app, calls, createAsset, createHighCostApproval, resolveProjectAccess };
}

describe("G2 Wave 2 production-wired Canvas session authority", () => {
  it.each([
    ["asset creation", "/api/v1/projects/22222222-2222-4222-8222-222222222222/canvas-assets", assetBody],
    [
      "high-cost approval minting",
      "/api/v1/projects/22222222-2222-4222-8222-222222222222/canvas-command-approvals",
      approvalBody,
    ],
  ])("rejects forged scope before persistence for %s", async (_name, path, body) => {
    const gate = harness(true);
    const response = await mutationHeaders(request(gate.app).post(path)).send(body());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CANVAS_SESSION_INVALID");
    expect(gate.calls).toEqual(["project-policy", "session-authority"]);
    expect(gate.resolveProjectAccess).toHaveBeenCalledOnce();
    expect(gate.createAsset).not.toHaveBeenCalled();
    expect(gate.createHighCostApproval).not.toHaveBeenCalled();
  });

  it("fails closed when the production service has no session authority verifier", async () => {
    const gate = harness(false);
    const response = await mutationHeaders(
      request(gate.app).post(`/api/v1/projects/${projectId}/canvas-assets`),
    ).send(assetBody());

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CANVAS_SESSION_INVALID");
    expect(gate.calls).toEqual(["project-policy"]);
    expect(gate.createAsset).not.toHaveBeenCalled();
  });
});
