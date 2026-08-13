import type { CanvasCommandV01 } from "@/contracts/canvas-v1";
import type { CanvasAgentToolName } from "./types";

export const CANVAS_AGENT_TOOL_NAMES = [
  "list_project_assets",
  "inspect_asset_readiness",
  "analyze_script_entities",
  "propose_missing_assets",
  "create_virtual_character",
  "sync_provider_asset",
  "bind_asset_to_entity",
  "generate_shot",
  "get_generation_task",
  "select_shot_output",
  "save_canvas_document",
  "export_playlist",
] as const satisfies readonly CanvasAgentToolName[];

export const CANVAS_AGENT_HIGH_COST_TOOLS = new Set<CanvasAgentToolName>([
  "create_virtual_character",
  "bind_asset_to_entity",
  "generate_shot",
  "select_shot_output",
  "export_playlist",
]);

export const CANVAS_AGENT_COMMAND_TYPES: Partial<Record<CanvasAgentToolName, CanvasCommandV01["commandType"]>> = {
  create_virtual_character: "CREATE_VIRTUAL_CHARACTER",
  sync_provider_asset: "SYNC_PROVIDER_ASSET",
  bind_asset_to_entity: "BIND_ASSET_TO_ENTITY",
  generate_shot: "GENERATE_SHOT",
  select_shot_output: "SELECT_SHOT_OUTPUT",
  save_canvas_document: "SAVE_CANVAS_DOCUMENT",
  export_playlist: "EXPORT_PLAYLIST",
};

export function isCanvasAgentToolName(value: string): value is CanvasAgentToolName {
  return (CANVAS_AGENT_TOOL_NAMES as readonly string[]).includes(value);
}
