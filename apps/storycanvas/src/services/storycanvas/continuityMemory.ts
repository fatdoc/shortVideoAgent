import crypto from "node:crypto";
import type { Knex } from "knex";
import {
  continuityEntitySchema,
  continuityProfileSchema,
  referenceBindingSchema,
  resolveShotContext,
  shotContractSchema,
  shotRelationSchema,
  type ContinuityEntity,
  type ContinuityProfile,
  type ReferenceBinding,
  type ShotContract,
  type ShotRelation,
  type WorldEvent,
  worldEventSchema,
} from "@/domain/storycanvas";

type JsonRecord = Record<string, unknown>;

function scopedUuid(projectId: number, key: string) {
  const value = crypto.createHash("sha256").update(`storycanvas:${projectId}:${key}`).digest("hex");
  return [
    value.slice(0, 8),
    value.slice(8, 12),
    `4${value.slice(13, 16)}`,
    `a${value.slice(17, 20)}`,
    value.slice(20, 32),
  ].join("-");
}

async function resolveDatabase(database?: Knex) {
  if (database) return database;
  return (await import("@/utils/db")).db;
}

interface ProfileRow {
  id: string;
  projectId: number;
  revision: number;
  styleJson: string;
  rulesJson: string;
}

interface EntityRow {
  id: string;
  projectId: number;
  slug: string;
  entityType: "character" | "object" | "location" | "brand";
  name: string;
  canonicalJson: string;
  locked: number | boolean;
}

interface EntityVersionRow {
  entityId: string;
  appearanceJson: string;
  stateJson: string;
}

interface WorldEventRow {
  id: string;
  projectId: number;
  afterShotId: number | null;
  sortOrder: number;
  eventType: string;
  title: string;
  preconditionsJson: string;
  statePatchJson: string;
}

interface ShotContractRow {
  projectId: number;
  shotId: number;
  worldRevision: number;
  entitySlugsJson: string;
  mustPreserveJson: string;
  requiredStateJson: string;
  statePatchJson: string;
  actionJson: string;
  cameraJson: string;
  transitionJson: string;
}

interface ShotRelationRow {
  id: string;
  projectId: number;
  fromShotId: number;
  toShotId: number;
  relationType: ShotRelation["relationType"];
  preserveJson: string;
  matchOn: string | null;
  usePreviousEndFrame: number | boolean;
}

interface ReferenceBindingRow {
  id: string;
  projectId: number;
  entityId: string | null;
  shotId: number | null;
  assetId: string | null;
  sourceUri: string | null;
  role: ReferenceBinding["role"];
  view: string;
  priority: number;
  approved: number | boolean;
}

function parseJson<T>(source: string | null | undefined, fallback: T): T {
  if (!source) return fallback;
  try {
    return JSON.parse(source) as T;
  } catch {
    return fallback;
  }
}

function defaultEntities(projectId: number, now: string) {
  const entityIds = {
    brand: scopedUuid(projectId, "entity:nancheng-brand"),
    cafe: scopedUuid(projectId, "entity:cafe-interior"),
    barista: scopedUuid(projectId, "entity:barista"),
    customer: scopedUuid(projectId, "entity:customer"),
    pourOver: scopedUuid(projectId, "entity:pour-over-set"),
    cup: scopedUuid(projectId, "entity:coffee-cup-a"),
  };
  return [
    {
      entity: {
        id: entityIds.brand,
        projectId,
        slug: "nancheng-brand",
        entityType: "brand",
        name: "南城咖啡品牌",
        canonical: {
          description: "克制的木质门头与南城咖啡品牌标识",
          invariants: ["门头材质与字形保持一致", "不新增其他品牌标识"],
        },
        appearance: { versionName: "夏日门店版本" },
        initialState: { visible: true },
        locked: true,
      },
      reference: { sourceUri: "./media/shot-01-storefront.png", role: "brand", view: "storefront", priority: 80 },
    },
    {
      entity: {
        id: entityIds.cafe,
        projectId,
        slug: "cafe-interior",
        entityType: "location",
        name: "南城咖啡室内",
        canonical: {
          description: "木质吧台位于右侧，落地窗与窗边座位位于左侧，咖啡器具集中在吧台中央",
          invariants: ["空间左右关系固定", "木质与暖色自然光保持一致"],
        },
        appearance: { palette: "暖木色与奶油白", layoutVersion: "interior-v1" },
        initialState: {
          timeOfDay: "夏日下午",
          lightDirection: "右侧窗户入光",
          crowdLevel: "安静",
        },
        locked: true,
      },
      reference: { sourceUri: "./media/reference-cafe.png", role: "scene_layout", view: "wide", priority: 90 },
    },
    {
      entity: {
        id: entityIds.barista,
        projectId,
        slug: "barista",
        entityType: "character",
        name: "咖啡师",
        canonical: {
          description: "年轻咖啡师，短发，白色衬衫与深色围裙",
          invariants: ["脸型与发型不变", "工作服不变"],
        },
        appearance: { outfit: "白色衬衫、深色围裙", hairstyle: "利落短发" },
        initialState: { location: "cafe-interior", emotion: "专注", holding: null },
        locked: true,
      },
      reference: { sourceUri: "./media/reference-barista.png", role: "character_identity", view: "portrait", priority: 100 },
    },
    {
      entity: {
        id: entityIds.customer,
        projectId,
        slug: "customer",
        entityType: "character",
        name: "顾客女生",
        canonical: {
          description: "年轻女生，棕色长发，米白色夏日连衣裙",
          invariants: ["脸型与发色不变", "米白色连衣裙不变"],
        },
        appearance: { outfit: "米白色短袖连衣裙", hairstyle: "棕色长发自然披肩" },
        initialState: { location: "cafe-window-seat", emotion: "期待", holding: null },
        locked: true,
      },
      reference: { sourceUri: "./media/shot-04-tasting.png", role: "character_identity", view: "three-quarter", priority: 100 },
    },
    {
      entity: {
        id: entityIds.pourOver,
        projectId,
        slug: "pour-over-set",
        entityType: "object",
        name: "手冲器具",
        canonical: {
          description: "透明玻璃分享壶、锥形滤杯与细嘴手冲壶",
          invariants: ["器具造型和材质不变"],
        },
        appearance: { material: "玻璃、深色金属" },
        initialState: { location: "bar-counter", kettleState: "ready" },
        locked: true,
      },
      reference: { sourceUri: "./media/shot-03-pourover.png", role: "prop_identity", view: "close-up", priority: 85 },
    },
    {
      entity: {
        id: entityIds.cup,
        projectId,
        slug: "coffee-cup-a",
        entityType: "object",
        name: "米白咖啡杯 A",
        canonical: {
          description: "矮圆柱形哑光米白陶瓷杯，无 Logo",
          invariants: ["杯型、颜色和材质不变"],
        },
        appearance: { color: "哑光米白", material: "陶瓷" },
        initialState: {
          location: "bar-counter",
          owner: null,
          fillLevel: 0,
          temperature: "empty",
        },
        locked: true,
      },
      reference: { sourceUri: "./media/shot-04-tasting.png", role: "prop_identity", view: "in-use", priority: 75 },
    },
  ].map(({ entity, reference }, index) => ({
    entity: continuityEntitySchema.parse(entity),
    version: {
      id: scopedUuid(projectId, `entity-version:${index + 1}`),
      entityId: entity.id,
      version: 1,
      appearanceJson: JSON.stringify(entity.appearance),
      stateJson: JSON.stringify(entity.initialState),
      approved: true,
      createdAt: now,
    },
    reference: {
      id: scopedUuid(projectId, `reference:${index + 1}`),
      projectId,
      entityId: entity.id,
      shotId: null,
      assetId: null,
      sourceUri: reference.sourceUri,
      role: reference.role,
      view: reference.view,
      priority: reference.priority,
      approved: true,
      createdAt: now,
    },
  }));
}

function defaultEvents(projectId: number) {
  const definitions = [
    {
      afterShotId: 2,
      eventType: "action-ready",
      title: "咖啡师开始手冲",
      preconditions: { "barista.holding": null },
      statePatch: { "barista.holding": "pour-over-set" },
    },
    {
      afterShotId: 3,
      eventType: "coffee-finished",
      title: "手冲咖啡完成",
      preconditions: { "coffee-cup-a.fillLevel": 0, "barista.holding": "pour-over-set" },
      statePatch: {
        "coffee-cup-a.fillLevel": 0.9,
        "coffee-cup-a.temperature": "hot",
        "barista.holding": null,
        "pour-over-set.kettleState": "placed",
      },
    },
    {
      afterShotId: 4,
      eventType: "coffee-tasted",
      title: "顾客完成第一次品尝",
      preconditions: { "coffee-cup-a.fillLevel": 0.9 },
      statePatch: {
        "coffee-cup-a.fillLevel": 0.75,
        "coffee-cup-a.location": "customer-hand",
        "coffee-cup-a.owner": "customer",
        "customer.holding": "coffee-cup-a",
        "customer.emotion": "满意",
      },
    },
    {
      afterShotId: 5,
      eventType: "closing-tableau",
      title: "杯子留在窗边，时间进入黄昏",
      preconditions: { "coffee-cup-a.owner": "customer" },
      statePatch: {
        "coffee-cup-a.location": "window-table",
        "coffee-cup-a.owner": null,
        "customer.holding": null,
        "cafe-interior.timeOfDay": "黄昏",
      },
    },
  ];

  return definitions.map((event, index) => worldEventSchema.parse({
    id: scopedUuid(projectId, `world-event:${index + 1}`),
    projectId,
    afterShotId: event.afterShotId,
    sortOrder: index,
    eventType: event.eventType,
    title: event.title,
    preconditions: event.preconditions,
    statePatch: event.statePatch,
  }));
}

function defaultContracts(projectId: number) {
  const definitions: Array<Omit<ShotContract, "projectId" | "worldRevision">> = [
    {
      shotId: 1,
      entitySlugs: ["nancheng-brand", "cafe-interior"],
      mustPreserve: ["品牌门头", "夏日下午自然光", "写实电影感"],
      requiredState: { "nancheng-brand.visible": true, "cafe-interior.timeOfDay": "夏日下午" },
      statePatch: {},
      action: { subject: "南城咖啡门店", verb: "建立空间与品牌" },
      camera: { shotSize: "wide", movement: "slow-push-in", screenDirection: "forward" },
      transition: { relationType: "opening" },
    },
    {
      shotId: 2,
      entitySlugs: ["nancheng-brand", "cafe-interior", "barista", "pour-over-set"],
      mustPreserve: ["品牌身份", "室内左右关系", "咖啡师身份与围裙", "手冲器具", "下午光线"],
      requiredState: { "cafe-interior.timeOfDay": "夏日下午" },
      statePatch: { "barista.holding": "pour-over-set" },
      action: { subject: "镜头", verb: "从入口进入并建立吧台空间" },
      camera: { shotSize: "wide-to-medium", movement: "walk-in", screenDirection: "left-to-right" },
      transition: { relationType: "cross-scene-cut" },
    },
    {
      shotId: 3,
      entitySlugs: ["barista", "cafe-interior", "pour-over-set", "coffee-cup-a"],
      mustPreserve: ["咖啡师身份与围裙", "手冲器具造型", "吧台与入光方向"],
      requiredState: { "barista.holding": "pour-over-set", "coffee-cup-a.fillLevel": 0 },
      statePatch: {
        "coffee-cup-a.fillLevel": 0.9,
        "coffee-cup-a.temperature": "hot",
        "barista.holding": null,
        "pour-over-set.kettleState": "placed",
      },
      action: { subject: "barista", verb: "pour", object: "coffee-cup-a" },
      camera: { shotSize: "macro", movement: "follow-water", screenDirection: "left-to-right" },
      transition: { relationType: "same-scene-cut", matchOn: "space" },
    },
    {
      shotId: 4,
      entitySlugs: ["customer", "cafe-interior", "coffee-cup-a"],
      mustPreserve: ["顾客身份与米白连衣裙", "米白咖啡杯造型", "窗边座位与光线方向"],
      requiredState: { "coffee-cup-a.fillLevel": 0.9, "coffee-cup-a.temperature": "hot" },
      statePatch: {
        "coffee-cup-a.fillLevel": 0.75,
        "coffee-cup-a.location": "customer-hand",
        "coffee-cup-a.owner": "customer",
        "customer.holding": "coffee-cup-a",
        "customer.emotion": "满意",
      },
      action: { subject: "customer", verb: "taste", object: "coffee-cup-a" },
      camera: { shotSize: "close-up-to-medium", movement: "tilt-up", screenDirection: "left-to-right" },
      transition: { relationType: "same-scene-cut", matchOn: "object" },
    },
    {
      shotId: 5,
      entitySlugs: ["cafe-interior", "coffee-cup-a", "nancheng-brand"],
      mustPreserve: ["咖啡杯身份", "窗边桌面", "暖色电影感"],
      requiredState: { "coffee-cup-a.fillLevel": 0.75, "coffee-cup-a.owner": "customer" },
      statePatch: {
        "coffee-cup-a.location": "window-table",
        "coffee-cup-a.owner": null,
        "cafe-interior.timeOfDay": "黄昏",
      },
      action: { subject: "镜头", verb: "离开人物并停留在窗边杯子" },
      camera: { shotSize: "medium-to-wide", movement: "slow-pull-out", screenDirection: "backward" },
      transition: { relationType: "time-jump", matchOn: "coffee-cup-a" },
    },
  ];

  return definitions.map((contract) => shotContractSchema.parse({
    ...contract,
    projectId,
    worldRevision: 1,
  }));
}

function defaultRelations(projectId: number) {
  const definitions: Array<Omit<ShotRelation, "id" | "projectId">> = [
    { fromShotId: 1, toShotId: 2, relationType: "cross-scene-cut", preserve: ["品牌", "时间", "画风"], matchOn: "movement", usePreviousEndFrame: false },
    { fromShotId: 2, toShotId: 3, relationType: "same-scene-cut", preserve: ["室内布局", "光线方向"], matchOn: "space", usePreviousEndFrame: false },
    { fromShotId: 3, toShotId: 4, relationType: "same-scene-cut", preserve: ["咖啡杯状态", "室内光线"], matchOn: "object", usePreviousEndFrame: false },
    { fromShotId: 4, toShotId: 5, relationType: "time-jump", preserve: ["咖啡杯身份", "窗边空间", "暖色调"], matchOn: "object", usePreviousEndFrame: false },
  ];
  return definitions.map((relation, index) => shotRelationSchema.parse({
    id: scopedUuid(projectId, `shot-relation:${index + 1}`),
    projectId,
    ...relation,
  }));
}

export async function ensureMvpContinuityMemory(projectId: number, database?: Knex) {
  const activeDatabase = await resolveDatabase(database);
  const existing = await activeDatabase<ProfileRow>("sc_continuity_profiles").where({ projectId }).first();
  if (existing) return existing.id;

  const now = new Date().toISOString();
  const profileId = scopedUuid(projectId, "continuity-profile");
  const entities = defaultEntities(projectId, now);
  const events = defaultEvents(projectId);
  const contracts = defaultContracts(projectId);
  const relations = defaultRelations(projectId);

  await activeDatabase.transaction(async (transaction) => {
    await transaction("sc_continuity_profiles").insert({
      id: profileId,
      projectId,
      revision: 1,
      styleJson: JSON.stringify({
        visualStyle: "写实电影感",
        palette: "自然暖色、木质与奶油白",
        aspectRatio: "9:16",
        lensLanguage: "35mm 为主，特写使用浅景深",
        lighting: "自然光方向稳定，允许叙事性的下午到黄昏变化",
      }),
      rulesJson: JSON.stringify([
        "人物脸型、发型和已锁定服装不得无意变化",
        "关键物品的杯型、颜色、材质和品牌标识不得变化",
        "场景固定布局、左右关系和主光方向不得跳变",
        "切镜依靠镜头契约保持世界状态，不默认复制上一镜头构图",
      ]),
      createdAt: now,
      updatedAt: now,
    });

    await transaction("sc_entities").insert(entities.map(({ entity }) => ({
      id: entity.id,
      projectId: entity.projectId,
      slug: entity.slug,
      entityType: entity.entityType,
      name: entity.name,
      canonicalJson: JSON.stringify(entity.canonical),
      locked: entity.locked,
      createdAt: now,
      updatedAt: now,
    })));
    await transaction("sc_entity_versions").insert(entities.map(({ version }) => version));
    await transaction("sc_reference_bindings").insert(entities.map(({ reference }) => reference));
    await transaction("sc_world_events").insert(events.map((event) => ({
      id: event.id,
      projectId: event.projectId,
      afterShotId: event.afterShotId,
      sortOrder: event.sortOrder,
      eventType: event.eventType,
      title: event.title,
      preconditionsJson: JSON.stringify(event.preconditions),
      statePatchJson: JSON.stringify(event.statePatch),
      createdAt: now,
    })));
    await transaction("sc_shot_contracts").insert(contracts.map((contract) => ({
      projectId: contract.projectId,
      shotId: contract.shotId,
      worldRevision: contract.worldRevision,
      entitySlugsJson: JSON.stringify(contract.entitySlugs),
      mustPreserveJson: JSON.stringify(contract.mustPreserve),
      requiredStateJson: JSON.stringify(contract.requiredState),
      statePatchJson: JSON.stringify(contract.statePatch),
      actionJson: JSON.stringify(contract.action),
      cameraJson: JSON.stringify(contract.camera),
      transitionJson: JSON.stringify(contract.transition),
      updatedAt: now,
    })));
    await transaction("sc_shot_relations").insert(relations.map((relation) => ({
      id: relation.id,
      projectId: relation.projectId,
      fromShotId: relation.fromShotId,
      toShotId: relation.toShotId,
      relationType: relation.relationType,
      preserveJson: JSON.stringify(relation.preserve),
      matchOn: relation.matchOn,
      usePreviousEndFrame: relation.usePreviousEndFrame,
      createdAt: now,
      updatedAt: now,
    })));
  });

  return profileId;
}

async function loadMvpContinuity(projectId: number, database?: Knex) {
  const activeDatabase = await resolveDatabase(database);
  await ensureMvpContinuityMemory(projectId, activeDatabase);
  const [profileRow, entityRows, versionRows, eventRows, contractRows, relationRows, referenceRows] = await Promise.all([
    activeDatabase<ProfileRow>("sc_continuity_profiles").where({ projectId }).first(),
    activeDatabase<EntityRow>("sc_entities").where({ projectId }).orderBy("entityType").orderBy("name"),
    activeDatabase<EntityVersionRow>("sc_entity_versions")
      .whereIn("entityId", activeDatabase("sc_entities").select("id").where({ projectId }))
      .where({ approved: true })
      .orderBy("version", "desc"),
    activeDatabase<WorldEventRow>("sc_world_events").where({ projectId }).orderBy("sortOrder"),
    activeDatabase<ShotContractRow>("sc_shot_contracts").where({ projectId }).orderBy("shotId"),
    activeDatabase<ShotRelationRow>("sc_shot_relations").where({ projectId }).orderBy("fromShotId"),
    activeDatabase<ReferenceBindingRow>("sc_reference_bindings").where({ projectId }).orderBy("priority", "desc"),
  ]);
  if (!profileRow) throw new Error("连续性档案不存在");

  const profile = continuityProfileSchema.parse({
    id: profileRow.id,
    projectId: Number(profileRow.projectId),
    revision: Number(profileRow.revision),
    style: parseJson<JsonRecord>(profileRow.styleJson, {}),
    rules: parseJson<string[]>(profileRow.rulesJson, []),
  });
  const latestVersionByEntity = new Map<string, EntityVersionRow>();
  for (const row of versionRows) {
    if (!latestVersionByEntity.has(row.entityId)) latestVersionByEntity.set(row.entityId, row);
  }
  const entities = entityRows.map((row) => {
    const version = latestVersionByEntity.get(row.id);
    return continuityEntitySchema.parse({
      id: row.id,
      projectId: Number(row.projectId),
      slug: row.slug,
      entityType: row.entityType,
      name: row.name,
      canonical: parseJson<JsonRecord>(row.canonicalJson, {}),
      appearance: parseJson<JsonRecord>(version?.appearanceJson, {}),
      initialState: parseJson<JsonRecord>(version?.stateJson, {}),
      locked: Boolean(row.locked),
    });
  });
  const events = eventRows.map((row) => worldEventSchema.parse({
    id: row.id,
    projectId: Number(row.projectId),
    afterShotId: row.afterShotId === null ? null : Number(row.afterShotId),
    sortOrder: Number(row.sortOrder),
    eventType: row.eventType,
    title: row.title,
    preconditions: parseJson<JsonRecord>(row.preconditionsJson, {}),
    statePatch: parseJson<JsonRecord>(row.statePatchJson, {}),
  }));
  const contracts = contractRows.map((row) => shotContractSchema.parse({
    projectId: Number(row.projectId),
    shotId: Number(row.shotId),
    worldRevision: Number(row.worldRevision),
    entitySlugs: parseJson<string[]>(row.entitySlugsJson, []),
    mustPreserve: parseJson<string[]>(row.mustPreserveJson, []),
    requiredState: parseJson<JsonRecord>(row.requiredStateJson, {}),
    statePatch: parseJson<JsonRecord>(row.statePatchJson, {}),
    action: parseJson<JsonRecord>(row.actionJson, {}),
    camera: parseJson<JsonRecord>(row.cameraJson, {}),
    transition: parseJson<JsonRecord>(row.transitionJson, {}),
  }));
  const relations = relationRows.map((row) => shotRelationSchema.parse({
    id: row.id,
    projectId: Number(row.projectId),
    fromShotId: Number(row.fromShotId),
    toShotId: Number(row.toShotId),
    relationType: row.relationType,
    preserve: parseJson<string[]>(row.preserveJson, []),
    matchOn: row.matchOn,
    usePreviousEndFrame: Boolean(row.usePreviousEndFrame),
  }));
  const references = referenceRows.map((row) => referenceBindingSchema.parse({
    id: row.id,
    projectId: Number(row.projectId),
    entityId: row.entityId,
    shotId: row.shotId === null ? null : Number(row.shotId),
    assetId: row.assetId,
    sourceUri: row.sourceUri,
    role: row.role,
    view: row.view,
    priority: Number(row.priority),
    approved: Boolean(row.approved),
  }));

  return { profile, entities, events, contracts, relations, references };
}

function fallbackContract(projectId: number, shotId: number, revision: number): ShotContract {
  return shotContractSchema.parse({
    projectId,
    shotId,
    worldRevision: revision,
    entitySlugs: [],
    mustPreserve: ["项目视觉风格"],
    requiredState: {},
    statePatch: {},
    action: { subject: `shot-${shotId}`, verb: "follow-local-prompt" },
    camera: {},
    transition: { relationType: shotId === 1 ? "opening" : "same-scene-cut" },
  });
}

export async function resolveMvpShotContext(
  projectId: number,
  shotId: number,
  basePrompt: string,
  database?: Knex,
) {
  const memory = await loadMvpContinuity(projectId, database);
  const contract = memory.contracts.find((candidate) => candidate.shotId === shotId)
    ?? fallbackContract(projectId, shotId, memory.profile.revision);
  const relation = memory.relations.find((candidate) => candidate.toShotId === shotId) ?? null;
  return resolveShotContext({
    profile: memory.profile,
    entities: memory.entities,
    events: memory.events,
    contract,
    relation,
    references: memory.references,
    basePrompt,
  });
}

export async function getMvpContinuityWorkspace(projectId: number, database?: Knex) {
  const memory = await loadMvpContinuity(projectId, database);
  const references = await Promise.all(memory.references.map(async (reference) => {
    if (!reference.sourceUri?.startsWith("oss:")) return reference;
    const { default: u } = await import("@/utils");
    return {
      ...reference,
      sourceUri: await u.oss.getFileUrl(reference.sourceUri.slice("oss:".length)),
    };
  }));
  const shots = Object.fromEntries(memory.contracts.map((contract) => {
    const relation = memory.relations.find((candidate) => candidate.toShotId === contract.shotId) ?? null;
    const resolved = resolveShotContext({
      profile: memory.profile,
      entities: memory.entities,
      events: memory.events,
      contract,
      relation,
      references,
      basePrompt: "镜头局部提示词由画布在生成时提供",
    });
    return [String(contract.shotId), {
      contract,
      relation,
      stateAtStart: resolved.stateAtStart,
      errors: resolved.errors,
      warnings: resolved.warnings,
      entities: contract.entitySlugs
        .map((slug) => memory.entities.find((entity) => entity.slug === slug))
        .filter(Boolean),
      references: resolved.references,
    }];
  }));

  return {
    profile: memory.profile,
    entities: memory.entities.map((entity) => ({
      ...entity,
      references: references.filter((reference) => reference.entityId === entity.id),
    })),
    events: memory.events,
    relations: memory.relations,
    shots,
  };
}

export interface UpdateShotContinuityInput {
  entitySlugs?: string[];
  relationType?: ShotRelation["relationType"];
  preserve?: string[];
  matchOn?: string | null;
  usePreviousEndFrame?: boolean;
}

export async function updateMvpShotContinuity(
  projectId: number,
  shotId: number,
  patch: UpdateShotContinuityInput,
  database?: Knex,
) {
  const activeDatabase = await resolveDatabase(database);
  await ensureMvpContinuityMemory(projectId, activeDatabase);
  const now = new Date().toISOString();

  await activeDatabase.transaction(async (transaction) => {
    const profile = await transaction<ProfileRow>("sc_continuity_profiles").where({ projectId }).first();
    if (!profile) throw new Error("连续性档案不存在");
    const existingContract = await transaction<ShotContractRow>("sc_shot_contracts").where({ projectId, shotId }).first();
    const currentRevision = Number(profile.revision);
    const nextRevision = currentRevision + 1;

    if (patch.entitySlugs) {
      const validSlugs = new Set((await transaction<EntityRow>("sc_entities").where({ projectId }).select("slug")).map((row) => row.slug));
      const unknown = patch.entitySlugs.find((slug) => !validSlugs.has(slug));
      if (unknown) throw new Error(`实体记忆 ${unknown} 不存在`);
    }

    const currentContract = existingContract
      ? {
          entitySlugs: parseJson<string[]>(existingContract.entitySlugsJson, []),
          transition: parseJson<JsonRecord>(existingContract.transitionJson, {}),
        }
      : {
          entitySlugs: [],
          transition: { relationType: shotId === 1 ? "opening" : "same-scene-cut" },
        };
    const entitySlugs = patch.entitySlugs ?? currentContract.entitySlugs;
    const transition = {
      ...currentContract.transition,
      ...(patch.relationType ? { relationType: patch.relationType } : {}),
      ...(patch.matchOn !== undefined ? { matchOn: patch.matchOn } : {}),
    };

    if (existingContract) {
      await transaction("sc_shot_contracts").where({ projectId, shotId }).update({
        worldRevision: nextRevision,
        entitySlugsJson: JSON.stringify(entitySlugs),
        transitionJson: JSON.stringify(transition),
        updatedAt: now,
      });
    } else {
      const fallback = fallbackContract(projectId, shotId, nextRevision);
      await transaction("sc_shot_contracts").insert({
        projectId,
        shotId,
        worldRevision: nextRevision,
        entitySlugsJson: JSON.stringify(entitySlugs),
        mustPreserveJson: JSON.stringify(fallback.mustPreserve),
        requiredStateJson: JSON.stringify(fallback.requiredState),
        statePatchJson: JSON.stringify(fallback.statePatch),
        actionJson: JSON.stringify(fallback.action),
        cameraJson: JSON.stringify(fallback.camera),
        transitionJson: JSON.stringify(transition),
        updatedAt: now,
      });
    }

    if (shotId > 1 && (
      patch.relationType !== undefined
      || patch.preserve !== undefined
      || patch.matchOn !== undefined
      || patch.usePreviousEndFrame !== undefined
    )) {
      const relation = await transaction<ShotRelationRow>("sc_shot_relations").where({ projectId, toShotId: shotId }).first();
      const values = {
        relationType: patch.relationType ?? relation?.relationType ?? "same-scene-cut",
        preserveJson: JSON.stringify(patch.preserve ?? parseJson<string[]>(relation?.preserveJson, ["项目视觉风格"])),
        matchOn: patch.matchOn !== undefined ? patch.matchOn : relation?.matchOn ?? null,
        usePreviousEndFrame: patch.usePreviousEndFrame ?? Boolean(relation?.usePreviousEndFrame),
        updatedAt: now,
      };
      if (values.usePreviousEndFrame && values.relationType !== "continuous-action") {
        throw new Error("只有连续动作镜头可以使用上一尾帧");
      }
      if (relation) {
        await transaction("sc_shot_relations").where({ id: relation.id }).update(values);
      } else {
        await transaction("sc_shot_relations").insert({
          id: crypto.randomUUID(),
          projectId,
          fromShotId: shotId - 1,
          toShotId: shotId,
          ...values,
          createdAt: now,
        });
      }
    }

    await transaction("sc_continuity_profiles").where({ projectId }).update({
      revision: nextRevision,
      updatedAt: now,
    });
  });

  return getMvpContinuityWorkspace(projectId, activeDatabase);
}
