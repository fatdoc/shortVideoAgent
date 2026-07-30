import type { Knex } from "knex";
import type { ModelsConfig } from "./models.schema";

export const STORYCANVAS_TEXT_AGENT_KEYS = [
  "scriptAgent",
  "productionAgent",
  "universalAi",
  "scriptAgent:decisionAgent",
  "scriptAgent:supervisionAgent",
  "scriptAgent:storySkeletonAgent",
  "scriptAgent:adaptationStrategyAgent",
  "scriptAgent:scriptAgent",
  "productionAgent:decisionAgent",
  "productionAgent:supervisionAgent",
  "productionAgent:deriveAssetsAgent",
  "productionAgent:generateAssetsAgent",
  "productionAgent:directorPlanAgent",
  "productionAgent:storyboardGenAgent",
  "productionAgent:storyboardPanelAgent",
  "productionAgent:storyboardTableAgent",
] as const;

export async function bindAgentModels(knex: Knex, config: ModelsConfig): Promise<number> {
  const modelName = `${config.llm.vendor}:${config.llm.model}`;
  return knex("o_agentDeploy").whereIn("key", [...STORYCANVAS_TEXT_AGENT_KEYS]).update({
    model: config.llm.model,
    modelName,
    vendorId: config.llm.vendor,
  });
}
