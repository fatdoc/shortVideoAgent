import type { Knex } from "knex";
import { bindAgentModels } from "./bindAgentModels";
import { loadModels } from "./loadModels";
import { seedVendorConfig } from "./seedVendorConfig";

export async function initializeModels(knex: Knex): Promise<void> {
  if (process.env.MODELS_AUTO_SEED === "0") return;
  const config = await loadModels();
  await seedVendorConfig(knex, config);
  await bindAgentModels(knex, config);
}
