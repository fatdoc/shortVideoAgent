import { z } from "zod";
import { toonflowIdSchema, uuidSchema } from "./common";

export const continuityEntityTypeSchema = z.enum(["character", "object", "location", "brand"]);
export const shotRelationTypeSchema = z.enum([
  "continuous-action",
  "same-scene-cut",
  "cross-scene-cut",
  "time-jump",
  "montage",
]);
export const referenceRoleSchema = z.enum([
  "character_identity",
  "outfit",
  "scene_layout",
  "prop_identity",
  "brand",
  "style",
  "first_frame",
  "previous_end_frame",
]);

const jsonRecordSchema = z.record(z.string(), z.unknown());

export const continuityProfileSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    revision: z.number().int().positive(),
    style: jsonRecordSchema,
    rules: z.array(z.string().trim().min(1).max(500)).max(50),
  })
  .strict();

export const continuityEntitySchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    slug: z.string().trim().min(1).max(100).regex(/^[a-z0-9-]+$/),
    entityType: continuityEntityTypeSchema,
    name: z.string().trim().min(1).max(200),
    canonical: jsonRecordSchema,
    appearance: jsonRecordSchema,
    initialState: jsonRecordSchema,
    locked: z.boolean(),
  })
  .strict();

export const worldEventSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    afterShotId: z.number().int().positive().nullable(),
    sortOrder: z.number().int().nonnegative(),
    eventType: z.string().trim().min(1).max(80),
    title: z.string().trim().min(1).max(200),
    preconditions: jsonRecordSchema,
    statePatch: jsonRecordSchema,
  })
  .strict();

export const shotContractSchema = z
  .object({
    projectId: toonflowIdSchema,
    shotId: z.number().int().positive(),
    worldRevision: z.number().int().positive(),
    entitySlugs: z.array(z.string().trim().min(1).max(100)).max(50),
    mustPreserve: z.array(z.string().trim().min(1).max(300)).max(100),
    requiredState: jsonRecordSchema,
    statePatch: jsonRecordSchema,
    action: jsonRecordSchema,
    camera: jsonRecordSchema,
    transition: jsonRecordSchema,
  })
  .strict();

export const shotRelationSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    fromShotId: z.number().int().positive(),
    toShotId: z.number().int().positive(),
    relationType: shotRelationTypeSchema,
    preserve: z.array(z.string().trim().min(1).max(300)).max(100),
    matchOn: z.string().trim().max(40).nullable(),
    usePreviousEndFrame: z.boolean(),
  })
  .strict();

export const referenceBindingSchema = z
  .object({
    id: uuidSchema,
    projectId: toonflowIdSchema,
    entityId: uuidSchema.nullable(),
    shotId: z.number().int().positive().nullable(),
    assetId: uuidSchema.nullable(),
    sourceUri: z.string().trim().min(1).max(2_000).nullable(),
    role: referenceRoleSchema,
    view: z.string().trim().min(1).max(40),
    priority: z.number().int(),
    approved: z.boolean(),
  })
  .strict();

export type FlatWorldState = Record<string, unknown>;
export type ContinuityProfile = z.infer<typeof continuityProfileSchema>;
export type ContinuityEntity = z.infer<typeof continuityEntitySchema>;
export type WorldEvent = z.infer<typeof worldEventSchema>;
export type ShotContract = z.infer<typeof shotContractSchema>;
export type ShotRelation = z.infer<typeof shotRelationSchema>;
export type ReferenceBinding = z.infer<typeof referenceBindingSchema>;

function valuesEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function describeRecord(record: Record<string, unknown>) {
  return Object.entries(record)
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join("、") : String(value)}`)
    .join("；");
}

export function initialWorldState(entities: readonly ContinuityEntity[]): FlatWorldState {
  const state: FlatWorldState = {};
  for (const entity of entities) {
    for (const [key, value] of Object.entries(entity.initialState)) {
      state[`${entity.slug}.${key}`] = value;
    }
  }
  return state;
}

export function worldStateAtShot(
  entities: readonly ContinuityEntity[],
  events: readonly WorldEvent[],
  shotId: number,
): FlatWorldState {
  return replayWorldStateAtShot(entities, events, shotId).state;
}

export function replayWorldStateAtShot(
  entities: readonly ContinuityEntity[],
  events: readonly WorldEvent[],
  shotId: number,
) {
  const state = initialWorldState(entities);
  const errors: string[] = [];
  const applicableEvents = events
    .filter((event) => event.afterShotId !== null && event.afterShotId < shotId)
    .sort((left, right) => left.sortOrder - right.sortOrder);
  for (const event of applicableEvents) {
    for (const [path, expected] of Object.entries(event.preconditions)) {
      if (!(path in state)) {
        errors.push(`世界事件“${event.title}”前置状态缺少 ${path}`);
      } else if (!valuesEqual(state[path], expected)) {
        errors.push(`世界事件“${event.title}”要求 ${path}=${String(expected)}，当时为 ${String(state[path])}`);
      }
    }
    Object.assign(state, event.statePatch);
  }
  return { state, errors };
}

export function validateShotContract(
  contract: ShotContract,
  entities: readonly ContinuityEntity[],
  stateAtStart: FlatWorldState,
) {
  const entitySlugs = new Set(entities.map((entity) => entity.slug));
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const slug of contract.entitySlugs) {
    if (!entitySlugs.has(slug)) errors.push(`镜头引用了不存在的实体 ${slug}`);
  }
  for (const [path, expected] of Object.entries(contract.requiredState)) {
    if (!(path in stateAtStart)) {
      errors.push(`镜头开始状态缺少 ${path}`);
    } else if (!valuesEqual(stateAtStart[path], expected)) {
      errors.push(`${path} 应为 ${String(expected)}，当前为 ${String(stateAtStart[path])}`);
    }
  }
  for (const path of Object.keys(contract.statePatch)) {
    const slug = path.split(".")[0];
    if (!contract.entitySlugs.includes(slug)) errors.push(`状态变化 ${path} 的实体未绑定到镜头`);
  }

  return { errors, warnings };
}

export interface ResolveShotContextInput {
  profile: ContinuityProfile;
  entities: readonly ContinuityEntity[];
  events: readonly WorldEvent[];
  contract: ShotContract;
  relation: ShotRelation | null;
  references: readonly ReferenceBinding[];
  basePrompt: string;
}

export function resolveShotContext(input: ResolveShotContextInput) {
  const replay = replayWorldStateAtShot(input.entities, input.events, input.contract.shotId);
  const stateAtStart = replay.state;
  const validation = validateShotContract(input.contract, input.entities, stateAtStart);
  validation.errors.unshift(...replay.errors);
  const selectedEntities = input.contract.entitySlugs
    .map((slug) => input.entities.find((entity) => entity.slug === slug))
    .filter((entity): entity is ContinuityEntity => Boolean(entity));
  const entityIds = new Set(selectedEntities.map((entity) => entity.id));
  const references = input.references
    .filter((reference) => reference.approved && (
      (reference.entityId && entityIds.has(reference.entityId))
      || reference.shotId === input.contract.shotId
    ))
    .sort((left, right) => right.priority - left.priority);

  for (const entity of selectedEntities) {
    if (entity.locked && !references.some((reference) => reference.entityId === entity.id)) {
      validation.warnings.push(`${entity.name} 已锁定，但尚未绑定批准参考`);
    }
  }
  if (
    input.relation
    && input.contract.transition.relationType
    && input.contract.transition.relationType !== input.relation.relationType
  ) {
    validation.errors.push("镜头契约与切镜关系不一致");
  }
  if (input.relation?.usePreviousEndFrame && input.relation.relationType !== "continuous-action") {
    validation.errors.push("只有连续动作镜头可以使用上一尾帧");
  }

  const promptSections = [
    `【项目视觉规则 v${input.profile.revision}】${describeRecord(input.profile.style)}`,
    selectedEntities.length
      ? `【实体标准】${selectedEntities.map((entity) => `${entity.name}：${describeRecord(entity.canonical)}；当前外观：${describeRecord(entity.appearance)}`).join("；")}`
      : "",
    Object.keys(input.contract.requiredState).length
      ? `【镜头开始状态】${describeRecord(input.contract.requiredState)}`
      : "",
    input.contract.mustPreserve.length
      ? `【必须保持】${input.contract.mustPreserve.join("；")}`
      : "",
    Object.keys(input.contract.action).length
      ? `【动作】${describeRecord(input.contract.action)}`
      : "",
    Object.keys(input.contract.camera).length
      ? `【摄影】${describeRecord(input.contract.camera)}`
      : "",
    input.relation
      ? `【切镜关系】${input.relation.relationType}；保持 ${input.relation.preserve.join("、") || "叙事连续"}${input.relation.matchOn ? `；匹配 ${input.relation.matchOn}` : ""}`
      : "",
    `【本镜头任务】${input.basePrompt.trim()}`,
    input.profile.rules.length
      ? `【禁止变化】${input.profile.rules.join("；")}`
      : "",
  ].filter(Boolean);

  return {
    contextVersion: `${input.profile.id}:r${input.profile.revision}`,
    worldRevision: input.profile.revision,
    shotId: input.contract.shotId,
    entitySlugs: input.contract.entitySlugs,
    stateAtStart,
    statePatch: input.contract.statePatch,
    transition: input.relation,
    references,
    resolvedPrompt: promptSections.join("\n"),
    errors: validation.errors,
    warnings: validation.warnings,
  };
}
