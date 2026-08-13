import type {
  AssetRecordV01,
  CanvasCommandV01,
  CanvasDocumentV01,
  CanvasEventV01,
  CanvasV1Scope,
  ShotAssetRequirementV01,
  ShotReadinessV01,
} from "@/contracts/canvas-v1";

export interface CanvasAgentAuthority extends CanvasV1Scope {
  actorId: string;
}

export function canvasAgentContractScope(authority: CanvasAgentAuthority): CanvasV1Scope {
  return {
    tenantId: authority.tenantId,
    projectId: authority.projectId,
    packageId: authority.packageId,
    canvasSessionId: authority.canvasSessionId,
  };
}

export interface CanvasAgentReadPorts {
  listProjectAssets(authority: CanvasAgentAuthority): Promise<unknown[]>;
  listShotRequirements(shotId: string, authority: CanvasAgentAuthority): Promise<unknown[]>;
  getShotReadiness(shotId: string, authority: CanvasAgentAuthority): Promise<unknown | null>;
  getGenerationEvent(commandId: string, authority: CanvasAgentAuthority): Promise<unknown | null>;
}

export interface CanvasAgentWritePort {
  executeCanvasCommand(command: CanvasCommandV01): Promise<CanvasEventV01>;
}

export type CanvasAgentPorts = CanvasAgentReadPorts & CanvasAgentWritePort;

export interface CanvasAgentRuntimeOptions {
  authority: CanvasAgentAuthority;
  ports: CanvasAgentPorts;
  now?: () => Date;
  randomId?: () => string;
}

export interface CanvasAgentPendingAction {
  commandId: string;
  commandType: CanvasCommandV01["commandType"];
  payload: CanvasCommandV01["payload"];
}

export interface CanvasAgentMissingAssetPlanItem {
  requirementId: string;
  shotId: string;
  category: ShotAssetRequirementV01["assetCategory"];
  entityId: string | null;
  action: "provide_or_authorize_asset" | "complete_provider_or_binding";
  reasonCodes: ShotReadinessV01["reasonCodes"];
}

export type CanvasAgentToolResult = {
  status: "ok" | "blocked" | "confirmation_required" | "dispatched" | "failed";
  tool: CanvasAgentToolName;
  assets?: AssetRecordV01[];
  readiness?: ShotReadinessV01;
  requirements?: ShotAssetRequirementV01[];
  analysis?: {
    shotId: string;
    categories: ShotAssetRequirementV01["assetCategory"][];
    entityIds: string[];
    requirementCount: number;
  };
  plan?: CanvasAgentMissingAssetPlanItem[];
  reasonCodes?: ShotReadinessV01["reasonCodes"];
  pendingAction?: CanvasAgentPendingAction;
  event?: CanvasEventV01;
  error?: { code: CanvasAgentSafeErrorCode; retryable: boolean };
};

export type CanvasAgentSafeErrorCode =
  | "CANVAS_AGENT_TOOL_INPUT_INVALID"
  | "CANVAS_AGENT_CONFIRMATION_INVALID"
  | "CANVAS_AGENT_SCOPE_MISMATCH"
  | "CANVAS_AGENT_OUTPUT_UNSAFE"
  | "CANVAS_AGENT_CAPABILITY_BLOCKED"
  | "CANVAS_SCHEMA_INVALID"
  | "CANVAS_SCOPE_MISMATCH"
  | "CANVAS_SESSION_INVALID"
  | "CANVAS_RIGHTS_NOT_AUTHORIZED"
  | "CANVAS_ASSET_NOT_APPROVED"
  | "CANVAS_PROVIDER_NOT_ACTIVE"
  | "CANVAS_ENTITY_BINDING_NOT_APPROVED"
  | "CANVAS_SHOT_NOT_READY"
  | "CANVAS_CAPABILITY_UNAVAILABLE"
  | "CANVAS_APPROVAL_REQUIRED"
  | "CANVAS_APPROVAL_INVALID"
  | "CANVAS_COMMAND_IDEMPOTENCY_CONFLICT"
  | "CANVAS_DOCUMENT_VERSION_CONFLICT"
  | "CANVAS_PROVIDER_FAILED"
  | "CANVAS_OUTPUT_REGISTRATION_FAILED";

export type CanvasAgentDocumentInput = Pick<
  CanvasDocumentV01,
  "documentId" | "version" | "shots" | "playlist"
>;

export type CanvasAgentToolName =
  | "list_project_assets"
  | "inspect_asset_readiness"
  | "analyze_script_entities"
  | "propose_missing_assets"
  | "create_virtual_character"
  | "sync_provider_asset"
  | "bind_asset_to_entity"
  | "generate_shot"
  | "get_generation_task"
  | "select_shot_output"
  | "save_canvas_document"
  | "export_playlist";
