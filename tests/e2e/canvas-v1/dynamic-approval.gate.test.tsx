import React, { useState } from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HighCostApprovalDialog } from "../../../src/features/canvas-v1/components/HighCostApprovalDialog";
import type {
  CanvasCommandType,
  CanvasCommandV01,
} from "../../../src/features/canvas-v1/model/contracts";
import {
  type CanvasCommandExecutionContext,
  type PrepareHighCostApproval,
  useCanvasCommandApprovalFlow,
} from "../../../src/features/canvas-v1/hooks/useCanvasCommandApprovalFlow";

const context: CanvasCommandExecutionContext = {
  tenantId: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  packageId: "33333333-3333-4333-8333-333333333333",
  canvasSessionId: "pcs_ABCDEFGHIJKLMNOPQRSTUVWX12345678",
  requestedByActorId: "12121212-1212-4212-8212-121212121212",
};

const commandId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const legacyApprovalId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const preparedApprovalId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const shotId = "66666666-6666-4666-8666-666666666666";
const assetId = "88888888-8888-4888-8888-888888888888";
const entityId = "16161616-1616-4616-8616-161616161616";
const documentId = "77777777-7777-4777-8777-777777777777";

const payloads = {
  ANALYZE_ASSET_REQUIREMENTS: { shotId },
  CREATE_VIRTUAL_CHARACTER: { assetId, entityId, prompt: "门店讲解员，暖色自然光。" },
  SYNC_PROVIDER_ASSET: { assetId },
  BIND_ASSET_TO_ENTITY: { assetId, entityId },
  GENERATE_SHOT: {
    shotId,
    readinessId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    prompt: "店员在入口介绍招牌套餐。",
    referenceAssetIds: [assetId],
  },
  SELECT_SHOT_OUTPUT: {
    shotId,
    outputAssetId: "19191919-1919-4919-8919-191919191919",
    documentId,
    expectedVersion: 4,
  },
  SAVE_CANVAS_DOCUMENT: {
    documentId,
    expectedVersion: 4,
    shots: [{
      shotId,
      position: 0,
      selectedOutputAssetId: null,
      prompt: "店员在入口介绍招牌套餐。",
      updatedAt: "2026-08-14T02:01:00.000Z",
    }],
    playlist: { shotIds: [shotId] },
  },
  EXPORT_PLAYLIST: { documentId, expectedVersion: 4 },
} satisfies Record<CanvasCommandType, CanvasCommandV01["payload"]>;

const highCostTypes = [
  "CREATE_VIRTUAL_CHARACTER",
  "BIND_ASSET_TO_ENTITY",
  "GENERATE_SHOT",
  "SELECT_SHOT_OUTPUT",
  "EXPORT_PLAYLIST",
] as const;

function makeCommand(commandType: CanvasCommandType): CanvasCommandV01 {
  return {
    objectType: "CanvasCommand",
    contractVersion: "0.1",
    ...context,
    commandId,
    commandType,
    requestSource: "user",
    approvalId: legacyApprovalId,
    payload: structuredClone(payloads[commandType]),
    requestId: "req-cv6-dynamic-approval",
    occurredAt: "2026-08-14T02:02:00.000Z",
  };
}

interface HarnessProps {
  executionContext?: CanvasCommandExecutionContext;
  prepare?: PrepareHighCostApproval;
  dispatch: (command: CanvasCommandV01) => void | Promise<void>;
}

function Harness({ executionContext = context, prepare, dispatch }: HarnessProps) {
  const flow = useCanvasCommandApprovalFlow({
    context: executionContext,
    prepareHighCostApproval: prepare,
    onCommand: dispatch,
  });
  const [commandType, setCommandType] = useState<CanvasCommandType>("GENERATE_SHOT");

  return (
    <>
      <label>
        命令类型
        <select value={commandType} onChange={(event) => setCommandType(event.target.value as CanvasCommandType)}>
          {Object.keys(payloads).map((type) => <option key={type}>{type}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={() => flow.requestCommand(makeCommand(commandType), {
          title: "确认当前高成本操作",
          summary: "门店开场 · 当前候选画面",
        })}
      >
        发起命令
      </button>
      <HighCostApprovalDialog
        approval={flow.approval}
        onCancel={flow.cancelApproval}
        onConfirm={flow.confirmApproval}
      />
    </>
  );
}

async function request(user: ReturnType<typeof userEvent.setup>, commandType: CanvasCommandType) {
  await user.selectOptions(screen.getByRole("combobox", { name: "命令类型" }), commandType);
  await user.click(screen.getByRole("button", { name: "发起命令" }));
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("CV6 dynamic high-cost approval gate", () => {
  it.each(highCostTypes)("binds exact %s draft, scope, actor, type, id and payload before dispatch", async (commandType) => {
    const user = userEvent.setup();
    const prepare = vi.fn<PrepareHighCostApproval>(async () => ({
      approvalId: preparedApprovalId,
      status: "active",
    }));
    const dispatch = vi.fn();
    render(<Harness prepare={prepare} dispatch={dispatch} />);

    await request(user, commandType);
    expect(prepare).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "确认并继续" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
    const prepareRequest = prepare.mock.calls[0][0];
    const dispatched = dispatch.mock.calls[0][0];
    expect(prepareRequest).toEqual({
      ...context,
      commandType,
      action: { commandId, payload: payloads[commandType] },
    });
    expect({
      tenantId: dispatched.tenantId,
      projectId: dispatched.projectId,
      packageId: dispatched.packageId,
      canvasSessionId: dispatched.canvasSessionId,
      requestedByActorId: dispatched.requestedByActorId,
      commandType: dispatched.commandType,
      commandId: dispatched.commandId,
      payload: dispatched.payload,
    }).toEqual({
      ...context,
      commandType: prepareRequest.commandType,
      commandId: prepareRequest.action.commandId,
      payload: prepareRequest.action.payload,
    });
    expect(dispatched.approvalId).toBe(preparedApprovalId);
    expect(dispatched.approvalId).not.toBe(legacyApprovalId);
    expect(Object.isFrozen(dispatched)).toBe(true);
    expect(Object.isFrozen(dispatched.payload)).toBe(true);
  });

  it.each(["ANALYZE_ASSET_REQUIREMENTS", "SYNC_PROVIDER_ASSET", "SAVE_CANVAS_DOCUMENT"] as const)(
    "dispatches low-cost %s without dialog or approval preparation",
    async (commandType) => {
      const user = userEvent.setup();
      const prepare = vi.fn<PrepareHighCostApproval>();
      const dispatch = vi.fn();
      render(<Harness prepare={prepare} dispatch={dispatch} />);

      await request(user, commandType);

      await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
      expect(prepare).not.toHaveBeenCalled();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(dispatch.mock.calls[0][0]).toEqual({ ...makeCommand(commandType), approvalId: null });
    },
  );

  it("ignores a legacy static approval and cancellation performs neither prepare nor dispatch", async () => {
    const user = userEvent.setup();
    const prepare = vi.fn<PrepareHighCostApproval>();
    const dispatch = vi.fn();
    render(<Harness prepare={prepare} dispatch={dispatch} />);

    await request(user, "GENERATE_SHOT");
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ["null", async () => null],
    ["throw", async () => { throw new Error("opaque upstream failure"); }],
    ["non-active", async () => ({ approvalId: preparedApprovalId, status: "expired" as const })],
    ["extra-field", async () => ({ approvalId: preparedApprovalId, status: "active" as const, internalToken: "redacted" })],
    ["invalid-uuid", async () => ({ approvalId: "approval-latest", status: "active" as const })],
  ])("fails closed for %s approval response", async (_case, result) => {
    const user = userEvent.setup();
    const dispatch = vi.fn();
    render(<Harness prepare={vi.fn(result as PrepareHighCostApproval)} dispatch={dispatch} />);

    await request(user, "GENERATE_SHOT");
    await user.click(screen.getByRole("button", { name: "确认并继续" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("未能取得有效操作确认");
    expect(document.body.textContent).not.toContain("opaque upstream failure");
    expect(document.body.textContent).not.toContain("internalToken");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it.each([
    ["tenantId", "10101010-1010-4010-8010-101010101010"],
    ["projectId", "20202020-2020-4020-8020-202020202020"],
    ["packageId", "30303030-3030-4030-8030-303030303030"],
    ["canvasSessionId", "pcs_ZYXWVUTSRQPONMLKJIHGFEDC87654321"],
    ["requestedByActorId", "29292929-2929-4929-8929-292929292929"],
  ] as const)("drops an in-flight approval after %s context drift", async (field, value) => {
    const user = userEvent.setup();
    let resolveApproval: ((projection: { approvalId: string; status: "active" }) => void) | undefined;
    const prepare = vi.fn<PrepareHighCostApproval>(() => new Promise((resolve) => { resolveApproval = resolve; }));
    const dispatch = vi.fn();
    const view = render(<Harness prepare={prepare} dispatch={dispatch} />);

    await request(user, "GENERATE_SHOT");
    await user.click(screen.getByRole("button", { name: "确认并继续" }));
    view.rerender(<Harness executionContext={{ ...context, [field]: value }} prepare={prepare} dispatch={dispatch} />);
    resolveApproval?.({ approvalId: preparedApprovalId, status: "active" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("deduplicates confirmation and retries response loss with the same complete object without preparing twice", async () => {
    const user = userEvent.setup();
    let resolveApproval: ((projection: { approvalId: string; status: "active" }) => void) | undefined;
    const prepare = vi.fn<PrepareHighCostApproval>(() => new Promise((resolve) => { resolveApproval = resolve; }));
    const dispatch = vi.fn()
      .mockRejectedValueOnce(new Error("response lost"))
      .mockResolvedValueOnce(undefined);
    render(<Harness prepare={prepare} dispatch={dispatch} />);

    await request(user, "GENERATE_SHOT");
    const confirm = screen.getByRole("button", { name: "确认并继续" });
    await Promise.all([user.click(confirm), user.click(confirm)]);
    expect(prepare).toHaveBeenCalledTimes(1);
    resolveApproval?.({ approvalId: preparedApprovalId, status: "active" });

    expect(await screen.findByRole("alert")).toHaveTextContent("提交结果未知");
    const firstDispatch = dispatch.mock.calls[0][0];
    const serialized = JSON.stringify(firstDispatch);
    await user.click(screen.getByRole("button", { name: "重试同一命令" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2));
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[1][0]).toBe(firstDispatch);
    expect(JSON.stringify(dispatch.mock.calls[1][0])).toBe(serialized);
  });

  it("keeps dialog, DOM, URL, storage and console safe while exposing basic accessible confirmation semantics", async () => {
    const user = userEvent.setup();
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const prepare = vi.fn<PrepareHighCostApproval>(async () => ({ approvalId: preparedApprovalId, status: "active" }));
    render(<Harness prepare={prepare} dispatch={vi.fn()} />);

    await request(user, "GENERATE_SHOT");
    const dialog = screen.getByRole("dialog", { name: "确认当前高成本操作" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAccessibleDescription("门店开场 · 当前候选画面");
    expect(screen.getByRole("button", { name: "确认并继续" })).toHaveFocus();
    const publicSurface = `${document.documentElement.outerHTML} ${window.location.href}`.toLowerCase();
    expect(publicSurface).not.toContain(context.projectId);
    expect(publicSurface).not.toContain(commandId);
    expect(publicSurface).not.toMatch(/asset:\/\/|bearer\s|idempotency|providerassetid|internal.?token|projectgrant|package.?snapshot/);
    expect(localSet).not.toHaveBeenCalled();
    expect(log).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
