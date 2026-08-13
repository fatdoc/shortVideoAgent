import {
  assertCanvasScope,
  parseCanvasV1BrowserContract,
  type CanvasCommandV01,
  type CanvasV1BrowserContract,
} from "@/contracts/canvas-v1";
import type {
  CanvasAgentAuthority,
  CanvasAgentSafeErrorCode,
  CanvasAgentToolName,
} from "./types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

const FORBIDDEN_KEYS = new Set([
  "remoteassetid", "asseturi", "groupid", "providerassetid", "providergroupid", "providertaskid",
  "accesstoken", "authorization", "cookie", "grant", "projectgrant", "productionpackage", "packagesnapshot",
  "payloaddigest", "approvedscriptdigest", "approvedstoryboarddigest", "idempotencykey", "internaltoken",
  "credential", "secret", "password", "localpath", "databaseid", "providerrawbody", "providerrawmessage",
  "userconfirmed",
]);
const FORBIDDEN_VALUES = [
  "asset://", "bearer ", "x-amz-credential=", "x-amz-signature=", "x-tos-signature=", "access_token=",
];

const SAFE_PUBLIC_CODES = new Set<CanvasAgentSafeErrorCode>([
  "CANVAS_SCHEMA_INVALID",
  "CANVAS_SCOPE_MISMATCH",
  "CANVAS_SESSION_INVALID",
  "CANVAS_RIGHTS_NOT_AUTHORIZED",
  "CANVAS_ASSET_NOT_APPROVED",
  "CANVAS_PROVIDER_NOT_ACTIVE",
  "CANVAS_ENTITY_BINDING_NOT_APPROVED",
  "CANVAS_SHOT_NOT_READY",
  "CANVAS_CAPABILITY_UNAVAILABLE",
  "CANVAS_APPROVAL_REQUIRED",
  "CANVAS_APPROVAL_INVALID",
  "CANVAS_COMMAND_IDEMPOTENCY_CONFLICT",
  "CANVAS_DOCUMENT_VERSION_CONFLICT",
  "CANVAS_PROVIDER_FAILED",
  "CANVAS_OUTPUT_REGISTRATION_FAILED",
]);

const MESSAGES: Record<CanvasAgentSafeErrorCode, string> = {
  CANVAS_AGENT_TOOL_INPUT_INVALID: "Canvas Agent tool input is invalid.",
  CANVAS_AGENT_CONFIRMATION_INVALID: "Canvas Agent confirmation is invalid.",
  CANVAS_AGENT_SCOPE_MISMATCH: "Canvas Agent scope does not match.",
  CANVAS_AGENT_OUTPUT_UNSAFE: "Canvas Agent output is unsafe.",
  CANVAS_AGENT_CAPABILITY_BLOCKED: "Canvas Agent capability is blocked.",
  CANVAS_SCHEMA_INVALID: "Canvas request is invalid.",
  CANVAS_SCOPE_MISMATCH: "Canvas scope does not match.",
  CANVAS_SESSION_INVALID: "Canvas session is invalid.",
  CANVAS_RIGHTS_NOT_AUTHORIZED: "Asset rights are not authorized.",
  CANVAS_ASSET_NOT_APPROVED: "Asset is not approved.",
  CANVAS_PROVIDER_NOT_ACTIVE: "Provider asset is not active.",
  CANVAS_ENTITY_BINDING_NOT_APPROVED: "Entity binding is not approved.",
  CANVAS_SHOT_NOT_READY: "Shot is not ready.",
  CANVAS_CAPABILITY_UNAVAILABLE: "Canvas capability is unavailable.",
  CANVAS_APPROVAL_REQUIRED: "Explicit approval is required.",
  CANVAS_APPROVAL_INVALID: "Canvas approval is invalid.",
  CANVAS_COMMAND_IDEMPOTENCY_CONFLICT: "Canvas command conflicts with persisted truth.",
  CANVAS_DOCUMENT_VERSION_CONFLICT: "Canvas document version conflicts.",
  CANVAS_PROVIDER_FAILED: "Canvas provider operation failed.",
  CANVAS_OUTPUT_REGISTRATION_FAILED: "Canvas output registration failed.",
};

export class CanvasAgentPolicyError extends Error {
  readonly retryable: boolean;

  constructor(readonly code: CanvasAgentSafeErrorCode, retryable = false) {
    super(MESSAGES[code]);
    this.name = "CanvasAgentPolicyError";
    this.retryable = retryable;
  }

  toJSON() {
    return { name: this.name, code: this.code, message: this.message, retryable: this.retryable };
  }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return value as Record<string, unknown>;
}

function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  const record = object(value);
  if (Object.keys(record).sort().join(",") !== [...keys].sort().join(",")) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return record;
}

function uuid(value: unknown): string {
  if (typeof value !== "string" || !UUID.test(value)) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return value;
}

function boundedString(value: unknown, min: number, max: number): string {
  if (typeof value !== "string" || value.length < min || value.length > max) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return value;
}

function uuidArray(value: unknown, min: number, max: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  const values = value.map(uuid);
  if (new Set(values).size !== values.length) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return values;
}

function positiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return Number(value);
}

function documentShots(value: unknown) {
  if (!Array.isArray(value) || value.length > 1000) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
  return value;
}

export function parseCanvasAgentToolInput(name: CanvasAgentToolName, input: unknown): Record<string, unknown> {
  switch (name) {
    case "list_project_assets":
      return exact(input, []);
    case "inspect_asset_readiness":
    case "analyze_script_entities":
    case "propose_missing_assets": {
      const value = exact(input, ["shotId"]);
      return { shotId: uuid(value.shotId) };
    }
    case "create_virtual_character": {
      const value = exact(input, ["assetId", "entityId", "prompt"]);
      return { assetId: uuid(value.assetId), entityId: uuid(value.entityId), prompt: boundedString(value.prompt, 1, 4000) };
    }
    case "sync_provider_asset": {
      const value = exact(input, ["assetId"]);
      return { assetId: uuid(value.assetId) };
    }
    case "bind_asset_to_entity": {
      const value = exact(input, ["assetId", "entityId"]);
      return { assetId: uuid(value.assetId), entityId: uuid(value.entityId) };
    }
    case "generate_shot": {
      const value = exact(input, ["shotId", "readinessId", "prompt", "referenceAssetIds"]);
      return {
        shotId: uuid(value.shotId),
        readinessId: uuid(value.readinessId),
        prompt: boundedString(value.prompt, 1, 4000),
        referenceAssetIds: uuidArray(value.referenceAssetIds, 1, 50),
      };
    }
    case "get_generation_task": {
      const value = exact(input, ["commandId"]);
      return { commandId: uuid(value.commandId) };
    }
    case "select_shot_output": {
      const value = exact(input, ["shotId", "outputAssetId", "documentId", "expectedVersion"]);
      return {
        shotId: uuid(value.shotId),
        outputAssetId: uuid(value.outputAssetId),
        documentId: uuid(value.documentId),
        expectedVersion: positiveInteger(value.expectedVersion),
      };
    }
    case "save_canvas_document": {
      const value = exact(input, ["documentId", "expectedVersion", "shots", "playlist"]);
      const playlist = exact(value.playlist, ["shotIds"]);
      return {
        documentId: uuid(value.documentId),
        expectedVersion: positiveInteger(value.expectedVersion),
        shots: documentShots(value.shots),
        playlist: { shotIds: uuidArray(playlist.shotIds, 0, 1000) },
      };
    }
    case "export_playlist": {
      const value = exact(input, ["documentId", "expectedVersion"]);
      return { documentId: uuid(value.documentId), expectedVersion: positiveInteger(value.expectedVersion) };
    }
  }
}

export function assertCanvasAgentAuthority(authority: CanvasAgentAuthority): void {
  const values = [authority.tenantId, authority.projectId, authority.packageId, authority.actorId];
  if (!values.every((value) => UUID.test(value)) || !/^pcs_[A-Za-z0-9_-]{24,128}$/.test(authority.canvasSessionId)) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_SCOPE_MISMATCH");
  }
}

export function parseScopedBrowserContract(
  raw: unknown,
  authority: CanvasAgentAuthority,
): CanvasV1BrowserContract {
  try {
    assertCanvasAgentOutputSafe(raw);
    const parsed = parseCanvasV1BrowserContract(raw);
    assertCanvasScope(parsed, authority);
    return parsed;
  } catch {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
  }
}

export function assertCanvasAgentOutputSafe(value: unknown): void {
  if (Array.isArray(value)) {
    value.forEach(assertCanvasAgentOutputSafe);
    return;
  }
  if (!value || typeof value !== "object") {
    if (typeof value === "string" && FORBIDDEN_VALUES.some((marker) => value.toLowerCase().includes(marker))) {
      throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
    }
    return;
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new CanvasAgentPolicyError("CANVAS_AGENT_OUTPUT_UNSAFE");
    }
    assertCanvasAgentOutputSafe(child);
  }
}

export function safeError(error: unknown): { code: CanvasAgentSafeErrorCode; retryable: boolean } {
  if (error instanceof CanvasAgentPolicyError) return { code: error.code, retryable: error.retryable };
  if (error && typeof error === "object") {
    const candidate = error as { code?: unknown; retryable?: unknown };
    if (typeof candidate.code === "string" && SAFE_PUBLIC_CODES.has(candidate.code as CanvasAgentSafeErrorCode)) {
      return { code: candidate.code as CanvasAgentSafeErrorCode, retryable: candidate.retryable === true };
    }
  }
  return { code: "CANVAS_PROVIDER_FAILED", retryable: true };
}

export function assertCommandCorrelation(command: CanvasCommandV01): void {
  if (!UUID.test(command.commandId) || !SAFE_REQUEST_ID.test(command.requestId)) {
    throw new CanvasAgentPolicyError("CANVAS_AGENT_TOOL_INPUT_INVALID");
  }
}
