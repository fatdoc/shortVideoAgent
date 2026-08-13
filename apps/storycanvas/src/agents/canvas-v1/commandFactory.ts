import {
  parseCanvasV1BrowserContract,
  type CanvasCommandV01,
} from "@/contracts/canvas-v1";
import { assertCanvasAgentOutputSafe, CanvasAgentPolicyError } from "./policy";
import {
  canvasAgentContractScope,
  type CanvasAgentAuthority,
  type CanvasAgentPendingAction,
} from "./types";

export interface BuildCanvasAgentCommandInput {
  authority: CanvasAgentAuthority;
  commandId: string;
  commandType: CanvasCommandV01["commandType"];
  approvalId: string | null;
  payload: CanvasCommandV01["payload"];
  requestId: string;
  occurredAt: string;
}

export interface CanvasAgentCommandDraft extends Omit<CanvasCommandV01, "approvalId"> {
  approvalId: null;
}

const DRAFT_VALIDATION_APPROVAL_ID = "00000000-0000-4000-8000-000000000001";

function base(input: BuildCanvasAgentCommandInput): CanvasCommandV01 {
  return {
    objectType: "CanvasCommand",
    contractVersion: "0.1",
    ...canvasAgentContractScope(input.authority),
    commandId: input.commandId,
    commandType: input.commandType,
    requestedByActorId: input.authority.actorId,
    requestSource: "agent",
    approvalId: input.approvalId,
    payload: input.payload,
    requestId: input.requestId,
    occurredAt: input.occurredAt,
  };
}

export function buildCanvasAgentCommand(input: BuildCanvasAgentCommandInput): CanvasCommandV01 {
  try {
    const command = base(input);
    assertCanvasAgentOutputSafe(command);
    const parsed = parseCanvasV1BrowserContract(command);
    if (parsed.objectType !== "CanvasCommand") throw new Error("not-command");
    return parsed;
  } catch {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
}

export function buildCanvasAgentCommandDraft(
  input: Omit<BuildCanvasAgentCommandInput, "approvalId">,
): CanvasAgentCommandDraft {
  try {
    const validated = buildCanvasAgentCommand({
      ...input,
      approvalId: DRAFT_VALIDATION_APPROVAL_ID,
    });
    const draft = { ...validated, approvalId: null } as CanvasAgentCommandDraft;
    assertCanvasAgentOutputSafe(draft);
    return draft;
  } catch {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
}

export function pendingAction(draft: CanvasAgentCommandDraft): CanvasAgentPendingAction {
  return {
    commandId: draft.commandId,
    commandType: draft.commandType,
    payload: structuredClone(draft.payload),
  };
}

export function approveCanvasAgentCommand(
  draft: CanvasAgentCommandDraft,
  approvalId: string,
): CanvasCommandV01 {
  return buildCanvasAgentCommand({
    authority: {
      tenantId: draft.tenantId,
      projectId: draft.projectId,
      packageId: draft.packageId,
      canvasSessionId: draft.canvasSessionId,
      actorId: draft.requestedByActorId,
    },
    commandId: draft.commandId,
    commandType: draft.commandType,
    approvalId,
    payload: structuredClone(draft.payload),
    requestId: draft.requestId,
    occurredAt: draft.occurredAt,
  });
}
