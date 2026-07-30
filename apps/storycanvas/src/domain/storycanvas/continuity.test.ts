import assert from "node:assert/strict";
import { test } from "node:test";
import {
  continuityEntitySchema,
  continuityProfileSchema,
  resolveShotContext,
  shotContractSchema,
  shotRelationSchema,
  worldEventSchema,
  replayWorldStateAtShot,
  worldStateAtShot,
} from ".";

const projectId = 1;
const profile = continuityProfileSchema.parse({
  id: "10000000-0000-4000-8000-000000000001",
  projectId,
  revision: 3,
  style: { visualStyle: "写实电影感", palette: "暖色" },
  rules: ["人物身份不得变化"],
});
const entities = [
  continuityEntitySchema.parse({
    id: "20000000-0000-4000-8000-000000000001",
    projectId,
    slug: "customer",
    entityType: "character",
    name: "顾客",
    canonical: { description: "棕色长发，米白连衣裙" },
    appearance: { outfit: "米白连衣裙" },
    initialState: { holding: null, emotion: "期待" },
    locked: true,
  }),
  continuityEntitySchema.parse({
    id: "20000000-0000-4000-8000-000000000002",
    projectId,
    slug: "cup-a",
    entityType: "object",
    name: "咖啡杯 A",
    canonical: { description: "哑光米白陶瓷杯" },
    appearance: { color: "米白" },
    initialState: { fillLevel: 0, owner: null },
    locked: false,
  }),
];
const events = [
  worldEventSchema.parse({
    id: "30000000-0000-4000-8000-000000000001",
    projectId,
    afterShotId: 3,
    sortOrder: 0,
    eventType: "coffee-finished",
    title: "咖啡完成",
    preconditions: { "cup-a.fillLevel": 0 },
    statePatch: { "cup-a.fillLevel": 0.9 },
  }),
];

test("world state is reconstructed from entity memory and prior events", () => {
  assert.equal(worldStateAtShot(entities, events, 3)["cup-a.fillLevel"], 0);
  assert.equal(worldStateAtShot(entities, events, 4)["cup-a.fillLevel"], 0.9);
  assert.equal(worldStateAtShot(entities, events, 4)["customer.emotion"], "期待");
});

test("shot context compiler combines canon, current state, action, and cut contract", () => {
  const contract = shotContractSchema.parse({
    projectId,
    shotId: 4,
    worldRevision: 3,
    entitySlugs: ["customer", "cup-a"],
    mustPreserve: ["顾客身份", "咖啡杯造型"],
    requiredState: { "cup-a.fillLevel": 0.9 },
    statePatch: { "cup-a.owner": "customer" },
    action: { subject: "customer", verb: "taste", object: "cup-a" },
    camera: { shotSize: "close-up" },
    transition: { relationType: "same-scene-cut" },
  });
  const relation = shotRelationSchema.parse({
    id: "40000000-0000-4000-8000-000000000001",
    projectId,
    fromShotId: 3,
    toShotId: 4,
    relationType: "same-scene-cut",
    preserve: ["杯子状态"],
    matchOn: "object",
    usePreviousEndFrame: false,
  });
  const resolved = resolveShotContext({
    profile,
    entities,
    events,
    contract,
    relation,
    references: [],
    basePrompt: "女生端起咖啡轻抿后微笑",
  });

  assert.deepEqual(resolved.errors, []);
  assert.match(resolved.resolvedPrompt, /顾客：description=棕色长发/);
  assert.match(resolved.resolvedPrompt, /cup-a\.fillLevel=0\.9/);
  assert.match(resolved.resolvedPrompt, /same-scene-cut/);
  assert.match(resolved.resolvedPrompt, /女生端起咖啡轻抿后微笑/);
  assert.ok(resolved.warnings.some((warning) => warning.includes("尚未绑定批准参考")));
});

test("shot context rejects a state contradiction before generation", () => {
  const contract = shotContractSchema.parse({
    projectId,
    shotId: 4,
    worldRevision: 3,
    entitySlugs: ["cup-a"],
    mustPreserve: [],
    requiredState: { "cup-a.fillLevel": 0 },
    statePatch: {},
    action: {},
    camera: {},
    transition: {},
  });
  const resolved = resolveShotContext({
    profile,
    entities,
    events,
    contract,
    relation: null,
    references: [],
    basePrompt: "空杯特写",
  });

  assert.ok(resolved.errors.some((error) => error.includes("应为 0，当前为 0.9")));
});

test("world event preconditions and previous-frame policy are enforced", () => {
  const contradictoryEvents = [
    worldEventSchema.parse({
      ...events[0],
      preconditions: { "cup-a.fillLevel": 0.5 },
    }),
  ];
  const replay = replayWorldStateAtShot(entities, contradictoryEvents, 4);
  assert.ok(replay.errors.some((error) => error.includes("要求 cup-a.fillLevel=0.5")));

  const contract = shotContractSchema.parse({
    projectId,
    shotId: 4,
    worldRevision: 3,
    entitySlugs: ["cup-a"],
    mustPreserve: [],
    requiredState: { "cup-a.fillLevel": 0.9 },
    statePatch: {},
    action: {},
    camera: {},
    transition: { relationType: "same-scene-cut" },
  });
  const relation = shotRelationSchema.parse({
    id: "40000000-0000-4000-8000-000000000002",
    projectId,
    fromShotId: 3,
    toShotId: 4,
    relationType: "same-scene-cut",
    preserve: [],
    matchOn: null,
    usePreviousEndFrame: true,
  });
  const resolved = resolveShotContext({
    profile,
    entities,
    events,
    contract,
    relation,
    references: [],
    basePrompt: "咖啡杯切镜",
  });
  assert.ok(resolved.errors.includes("只有连续动作镜头可以使用上一尾帧"));
});
