import type { Knex } from "knex";
import type { ModelsConfig, ModelTarget } from "./models.schema";
import { resolveModelTarget } from "./loadModels";

interface VendorSeed {
  id: string;
  inputValues: Record<string, string>;
  models: Array<Record<string, unknown> & { name: string; modelName: string; type: "text" | "image" | "video" }>;
}

function safeObject(value: unknown): Record<string, string> {
  if (typeof value !== "string" || value.length === 0) return {};
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  } catch {
    return {};
  }
}

function modelSeed(target: ModelTarget, type: "text" | "image" | "video") {
  const base = { name: target.model, modelName: target.model, type };
  if (type === "text") return { ...base, think: false };
  if (type === "image") return { ...base, mode: ["text", "singleImage", "multiReference"] };
  const seedance2 = target.model.includes("seedance-2-0");
  return {
    ...base,
    mode: ["text", "startFrameOptional"],
    audio: "optional",
    durationResolutionMap: [
      {
        duration: seedance2 ? [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15] : [4, 5, 6, 7, 8, 9, 10, 11, 12],
        resolution: seedance2 ? ["480p", "720p"] : ["480p", "720p", "1080p"],
      },
    ],
  };
}

function safeArray(value: unknown): any[] {
  if (typeof value !== "string" || value.length === 0) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildVendorSeeds(config: ModelsConfig, env: NodeJS.ProcessEnv): VendorSeed[] {
  const byVendor = new Map<string, VendorSeed>();
  const add = (target: ModelTarget, role: string, type: "text" | "image" | "video") => {
    const resolved = resolveModelTarget(target, env);
    const current = byVendor.get(target.vendor) ?? { id: target.vendor, inputValues: {}, models: [] };

    if (!current.inputValues.baseUrl || type === "text") current.inputValues.baseUrl = resolved.baseUrl;
    current.inputValues[`${role}BaseUrl`] = resolved.baseUrl;
    current.inputValues[`${role}ApiKeyEnv`] = target.apiKeyEnv;
    current.models.push(modelSeed(target, type));
    byVendor.set(target.vendor, current);
  };

  add(config.llm, "llm", "text");
  add(config.image.primary, "imagePrimary", "image");
  add(config.image.fallback, "imageFallback", "image");
  add(config.video, "video", "video");

  return [...byVendor.values()].map((seed) => ({
    ...seed,
    models: [...new Map(seed.models.map((model) => [`${model.type}:${model.modelName}`, model])).values()],
  }));
}

export async function seedVendorConfig(knex: Knex, config: ModelsConfig, env: NodeJS.ProcessEnv = process.env): Promise<string[]> {
  const seeds = buildVendorSeeds(config, env);

  await knex.transaction(async (transaction) => {
    for (const seed of seeds) {
      const existing = await transaction("o_vendorConfig").where({ id: seed.id }).first();
      const existingInputs = safeObject(existing?.inputValues);
      const existingModels = safeArray(existing?.models);
      const models = [...new Map([...existingModels, ...seed.models].map((model: any) => [model.modelName, model])).values()];

      const row = {
        inputValues: JSON.stringify({ ...existingInputs, ...seed.inputValues }),
        models: JSON.stringify(models),
        enable: 1,
      };

      if (existing) await transaction("o_vendorConfig").where({ id: seed.id }).update(row);
      else await transaction("o_vendorConfig").insert({ id: seed.id, ...row });
    }
  });

  return seeds.map((seed) => seed.id);
}
