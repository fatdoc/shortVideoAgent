import type { Knex } from "knex";

export interface PersistCharacterAssetBindingInput {
  projectId: number;
  entityId: string;
  canonical: Record<string, unknown>;
  assetId: string;
  assetLocalPath: string;
  remoteAssetId?: string;
  assetUri?: string;
  characterProfile?: unknown;
  referenceId: string;
  timestamp: string;
}

export function assertTrustedCharacterBindings(shotId: number, unboundCharacters: string[]) {
  if (!unboundCharacters.length) return;
  throw new Error(
    `镜头 ${String(shotId).padStart(2, "0")} 的人物`
    + `“${unboundCharacters.join("、")}”尚未绑定可信虚拟人物资产。`
    + "请先在角色库绑定全局人物身份，再生成视频。",
  );
}

export async function persistCharacterAssetBinding(
  database: Knex,
  input: PersistCharacterAssetBindingInput,
) {
  await database.transaction(async (transaction) => {
    await transaction("sc_entities").where({ id: input.entityId }).update({
      canonicalJson: JSON.stringify({
        ...input.canonical,
        characterAssetId: input.assetId,
        remoteAssetId: input.remoteAssetId,
        assetUri: input.assetUri,
        characterProfile: input.characterProfile,
      }),
      updatedAt: input.timestamp,
    });
    const reference = await transaction("sc_reference_bindings")
      .where({
        projectId: input.projectId,
        entityId: input.entityId,
        role: "character_identity",
      })
      .orderBy("priority", "desc")
      .first();
    const referenceValues = {
      assetId: input.assetId,
      sourceUri: `oss:${input.assetLocalPath}`,
      view: "character-board",
      priority: 120,
      approved: true,
    };
    if (reference) {
      await transaction("sc_reference_bindings").where({ id: reference.id }).update(referenceValues);
    } else {
      await transaction("sc_reference_bindings").insert({
        id: input.referenceId,
        projectId: input.projectId,
        entityId: input.entityId,
        shotId: null,
        role: "character_identity",
        ...referenceValues,
        createdAt: input.timestamp,
      });
    }
    const profile = await transaction("sc_continuity_profiles")
      .where({ projectId: input.projectId })
      .first();
    if (profile) {
      const nextRevision = Number(profile.revision) + 1;
      await transaction("sc_continuity_profiles").where({ projectId: input.projectId }).update({
        revision: nextRevision,
        updatedAt: input.timestamp,
      });
      await transaction("sc_shot_contracts").where({ projectId: input.projectId }).update({
        worldRevision: nextRevision,
        updatedAt: input.timestamp,
      });
    }
  });
}
