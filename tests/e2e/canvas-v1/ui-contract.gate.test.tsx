import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  CanvasBootstrapV01,
  CanvasDocumentV01,
  ShotReadinessV01,
} from "../../../src/features/canvas-v1/model/contracts";
import { useCanvasV1ViewState } from "../../../src/features/canvas-v1/model/viewState";
import {
  CanvasV1Page,
  type CanvasAssetView,
  type CanvasShotView,
  type CanvasV1PageProps,
} from "../../../src/features/canvas-v1/pages/CanvasV1Page";

const scope = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
} as const;
const actorId = "12121212-1212-4212-8212-121212121212";
const shotId = "66666666-6666-4666-8666-666666666666";
const assetId = "88888888-8888-4888-8888-888888888888";
const occurredAt = "2026-08-14T02:00:00.000Z";

const bootstrap: CanvasBootstrapV01 = {
  objectType: "CanvasBootstrap",
  contractVersion: "0.1",
  ...scope,
  status: "ready",
  approvedScript: {
    scriptId: "44444444-4444-4444-8444-444444444444",
    version: 3,
    status: "approved",
  },
  approvedStoryboard: {
    storyboardId: "55555555-5555-4555-8555-555555555555",
    version: 2,
    status: "approved",
  },
  document: { documentId: "77777777-7777-4777-8777-777777777777", version: 4 },
  assetSummaries: [],
  capabilities: [{ capability: "video_generation", available: true, reasonCode: null }],
  requestId: "req-cv6-ui-gate",
  occurredAt,
};

const readiness: ShotReadinessV01 = {
  objectType: "ShotReadiness",
  contractVersion: "0.1",
  ...scope,
  readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  shotId,
  ready: true,
  reasonCodes: [],
  script: { scriptId: bootstrap.approvedScript.scriptId, version: 3, current: true },
  storyboard: { storyboardId: bootstrap.approvedStoryboard.storyboardId, version: 2, current: true },
  requirements: [{
    requirementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    assetId,
    scopeMatched: true,
    rightsStatus: "authorized",
    approvalStatus: "approved",
    providerStatus: "active",
    entityBindingStatus: "approved",
    capabilityAvailable: true,
    ready: true,
    reasonCodes: [],
  }],
  evaluatedAt: occurredAt,
  occurredAt,
};

function documentFixture(prompt = "原始恢复提示", version = 4): CanvasDocumentV01 {
  return {
    objectType: "CanvasDocument",
    contractVersion: "0.1",
    ...scope,
    documentId: bootstrap.document.documentId,
    status: "active",
    version,
    shots: [{ shotId, position: 0, selectedOutputAssetId: null, prompt, updatedAt: occurredAt }],
    playlist: { shotIds: [shotId] },
    createdAt: occurredAt,
    updatedAt: occurredAt,
    occurredAt,
  };
}

function shotFixture(overrides: Partial<CanvasShotView> = {}): CanvasShotView {
  return {
    shotId,
    sequence: 1,
    title: "门店开场",
    durationSeconds: 6,
    scriptText: "介绍招牌套餐。",
    storyboardText: "镜头缓慢推进。",
    readiness,
    requiredAssetLabels: ["门店讲解员"],
    outputs: [],
    ...overrides,
  };
}

const bindableAsset: CanvasAssetView = {
  assetId,
  category: "virtual_character",
  displayName: "门店讲解员",
  rightsStatus: "authorized",
  approvalStatus: "approved",
  providerStatus: "active",
  entityBindingStatus: "pending",
  controlledPreviewUrl: null,
  targetEntityId: "16161616-1616-4616-8616-161616161616",
};

function props(overrides: Partial<CanvasV1PageProps> = {}): CanvasV1PageProps {
  return {
    loadState: "loaded",
    bootstrap,
    document: documentFixture(),
    shots: [shotFixture()],
    assets: [bindableAsset],
    taskEvents: {},
    saveState: "saved",
    commandContext: { requestedByActorId: actorId, approvalId: null },
    onCommand: vi.fn(),
    ...overrides,
  };
}

describe("G3 independent UI contract", () => {
  beforeEach(() => useCanvasV1ViewState.getState().resetView());
  afterEach(cleanup);

  it("fails closed for high-cost asset binding when approval is absent", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<CanvasV1Page {...props({ onCommand })} />);

    await user.click(screen.getByRole("button", { name: "查看门店讲解员绑定" }));
    const bind = screen.getByRole("button", { name: "绑定到当前镜头" });
    expect(bind).toBeDisabled();
    await user.click(bind);
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("restores a refreshed document prompt for the same shot instead of retaining stale local state", () => {
    const initial = props({ commandContext: { requestedByActorId: actorId, approvalId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee" } });
    const view = render(<CanvasV1Page {...initial} />);
    expect(screen.getByRole("textbox", { name: "生成提示" })).toHaveValue("原始恢复提示");

    view.rerender(<CanvasV1Page {...initial} document={documentFixture("服务端刷新恢复提示", 5)} />);
    expect(screen.getByRole("textbox", { name: "生成提示" })).toHaveValue("服务端刷新恢复提示");
  });

  it("does not render server-only asset URIs from untrusted media view inputs", () => {
    const unsafeShot = shotFixture({
      thumbnailUrl: "asset://server-only-thumbnail",
      outputs: [{
        assetId: "19191919-1919-4919-8919-191919191919",
        kind: "image",
        previewUrl: "asset://server-only-output",
        selected: true,
      }],
    });
    render(<CanvasV1Page {...props({ shots: [unsafeShot] })} />);

    expect(document.documentElement.outerHTML.toLowerCase()).not.toContain("asset://");
  });
});
