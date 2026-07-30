import crypto from "node:crypto";
import type { Knex } from "knex";
import { ZodError } from "zod";
import { db } from "@/utils/db";
import {
  D1_FIXTURE_ID,
  D1_SOURCE_SUITE_DIGEST,
  ProductionContractError,
  assertGrantScope,
  assertPackageContract,
  assetReceiptSchema,
  canonicalize,
  demoProjectGrantSchema,
  digestValue,
  generationTaskReceiptSchema,
  type AssetReceipt,
  type DemoProjectGrant,
  type GenerationTaskReceipt,
  type ProjectProductionPackage,
} from "@/domain/productionContract";
import canonicalPackageJson from "@/fixtures/production-contract/v0.1/project-production-package.json";
import canonicalGrantJson from "@/fixtures/production-contract/v0.1/demo-project-grant.json";
import successTaskReceiptJson from "@/fixtures/production-contract/v0.1/success-task-receipt.json";
import successAssetReceiptJson from "@/fixtures/production-contract/v0.1/success-asset-receipt.json";
import failureTaskReceiptJson from "@/fixtures/production-contract/v0.1/failure-task-receipt.json";
import truthManifestJson from "@/fixtures/production-contract/v0.1/capability-truth-manifest.json";
import { getMvpContinuityWorkspace } from "./continuityMemory";

const activeDatabase = db as Knex;
const EXTERNAL_SYSTEM = "saas-control-plane";
const D1_PROJECT_TYPE = "storycanvas-d1-production";
const REQUIRED_CAPABILITY = "cap-production-base-generation";
const STORYCANVAS_PATH = `/storycanvas/${D1_FIXTURE_ID}`;
const CONTROL_PLANE_RETURN_PATH = `/enterprise/projects/${D1_FIXTURE_ID}`;
const FALLBACK_MEDIA_PATH = "/media/d1/demo-local-001-fallback-synthetic-v1.mp4";
const FALLBACK_MEDIA_SHA256 = "55370297920ad6f957a3bbcdb4cbdc2ff088ba7594062a07c589b7a6db3727ef";
const FALLBACK_MEDIA_BYTE_SIZE = 2_155_679;
const FALLBACK_MEDIA_DURATION_SECONDS = 6;
const FALLBACK_MEDIA_WIDTH = 540;
const FALLBACK_MEDIA_HEIGHT = 960;

function storycanvasDeepLink() {
  const base = (process.env.STORYCANVAS_FRONTEND_URL || "http://localhost:50188").replace(/\/$/, "");
  return `${base}${STORYCANVAS_PATH}`;
}

function storycanvasMediaUrl(path: string) {
  const base = (process.env.STORYCANVAS_FRONTEND_URL || "http://localhost:50188").replace(/\/$/, "");
  return `${base}${path}`;
}

interface PackageRow {
  id: string;
  packageId: string;
  packageVersion: number;
  contractVersion: string;
  tenantId: string;
  externalProjectId: string;
  internalProjectId: number;
  idempotencyKey: string;
  payloadDigest: string;
  sourceSuiteDigest: string;
  capabilityIdsJson: string;
  snapshotJson: string;
  status: "accepted";
  acceptedAt: string;
  createdAt: string;
}

interface MappingRow {
  id: string;
  system: string;
  entityType: string;
  localId: string;
  externalId: string;
  metadataJson: string;
  createdAt: string;
}

function parseJson<T>(source: string | null | undefined, fallback: T): T {
  if (!source) return fallback;
  try {
    return JSON.parse(source) as T;
  } catch {
    return fallback;
  }
}

function stableUuid(scope: string, value: string) {
  const hash = crypto.createHash("sha256").update(`${scope}:${value}`).digest("hex");
  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `a${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

function safeSnapshot(value: unknown) {
  try {
    return canonicalize(value);
  } catch {
    return JSON.stringify({ unreadable: true });
  }
}

async function recordAttempt(
  values: {
    packageRecordId?: string | null;
    packageId?: string | null;
    packageVersion?: number | null;
    contractVersion?: string | null;
    tenantId?: string | null;
    externalProjectId?: string | null;
    idempotencyKey?: string | null;
    payloadDigest: string;
    snapshotJson: string;
    status: "accepted" | "duplicate" | "rejected";
    errorCode?: string | null;
    errorJson?: string | null;
  },
  transaction: Knex | Knex.Transaction = activeDatabase,
) {
  await transaction("sc_production_package_attempts").insert({
    id: crypto.randomUUID(),
    packageRecordId: values.packageRecordId ?? null,
    packageId: values.packageId ?? null,
    packageVersion: values.packageVersion ?? null,
    contractVersion: values.contractVersion ?? null,
    tenantId: values.tenantId ?? null,
    externalProjectId: values.externalProjectId ?? null,
    idempotencyKey: values.idempotencyKey ?? null,
    payloadDigest: values.payloadDigest,
    sourceSuiteDigest: D1_SOURCE_SUITE_DIGEST,
    snapshotJson: values.snapshotJson,
    status: values.status,
    errorCode: values.errorCode ?? null,
    errorJson: values.errorJson ?? null,
    createdAt: new Date().toISOString(),
  });
}

async function allocateIntegerId(
  transaction: Knex.Transaction,
  tableName: "o_project" | "o_script" | "o_storyboard",
  externalId: string,
) {
  const seed = crypto.createHash("sha256").update(`${tableName}:${externalId}`).digest().readUInt32BE(0);
  let candidate = Math.max(1, seed & 0x7fffffff);
  while (await transaction(tableName).where({ id: candidate }).first()) {
    candidate = candidate === 0x7fffffff ? 1 : candidate + 1;
  }
  return candidate;
}

async function findMapping(
  transaction: Knex | Knex.Transaction,
  entityType: string,
  externalId: string,
) {
  return transaction<MappingRow>("sc_external_mappings")
    .where({ system: EXTERNAL_SYSTEM, entityType, externalId })
    .first();
}

async function createMapping(
  transaction: Knex.Transaction,
  entityType: string,
  localId: string | number,
  externalId: string,
  metadata: Record<string, unknown> = {},
) {
  const existing = await findMapping(transaction, entityType, externalId);
  if (existing) {
    if (existing.localId !== String(localId)) {
      throw new ProductionContractError("EXTERNAL_ID_CONFLICT", `${entityType}/${externalId} 已映射到其他内部 ID`);
    }
    return existing;
  }
  const reverse = await transaction<MappingRow>("sc_external_mappings")
    .where({ system: EXTERNAL_SYSTEM, entityType, localId: String(localId) })
    .first();
  if (reverse && reverse.externalId !== externalId) {
    throw new ProductionContractError("LOCAL_ID_CONFLICT", `内部 ID ${localId} 已映射到 ${reverse.externalId}`);
  }
  const row: MappingRow = {
    id: stableUuid("external-mapping", `${entityType}:${externalId}`),
    system: EXTERNAL_SYSTEM,
    entityType,
    localId: String(localId),
    externalId,
    metadataJson: JSON.stringify(metadata),
    createdAt: new Date().toISOString(),
  };
  await transaction("sc_external_mappings").insert(row);
  return row;
}

async function resolveOrCreateIntegerMapping(
  transaction: Knex.Transaction,
  entityType: "project" | "script" | "shot",
  tableName: "o_project" | "o_script" | "o_storyboard",
  externalId: string,
) {
  const existing = await findMapping(transaction, entityType, externalId);
  if (existing) return Number(existing.localId);
  const localId = await allocateIntegerId(transaction, tableName, externalId);
  await createMapping(transaction, entityType, localId, externalId);
  return localId;
}

async function projectPackageSnapshot(
  transaction: Knex.Transaction,
  productionPackage: ProjectProductionPackage,
) {
  const now = new Date().toISOString();
  const projectId = await resolveOrCreateIntegerMapping(
    transaction,
    "project",
    "o_project",
    productionPackage.projectId,
  );
  const existingProject = await transaction("o_project").where({ id: projectId }).first();
  if (!existingProject) {
    await transaction("o_project").insert({
      id: projectId,
      projectType: D1_PROJECT_TYPE,
      name: productionPackage.creativeBriefSnapshot.merchantName,
      intro: productionPackage.creativeBriefSnapshot.notes,
      type: "本地生活",
      artStyle: "写实本地生活竖屏短视频；品牌与事实引用必须来自批准快照",
      videoRatio: productionPackage.target.aspectRatio,
      userId: 1,
      imageModel: "demo:deterministic-demo-v1",
      videoModel: "demo:deterministic-demo-v1",
      imageQuality: "720x1280",
      mode: "contract",
      createTime: Date.parse(productionPackage.createdAt),
    });
  }

  const profile = await transaction("sc_project_profile").where({ projectId }).first();
  if (!profile) {
    await transaction("sc_project_profile").insert({
      projectId,
      category: "local-life-food",
      status: "canvas_ready",
      briefJson: JSON.stringify({
        ...productionPackage.creativeBriefSnapshot,
        tenantId: productionPackage.tenantId,
        packageId: productionPackage.packageId,
        packageVersion: productionPackage.packageVersion,
        contractVersion: productionPackage.contractVersion,
        packageDigest: productionPackage.digest,
        sourceSuiteDigest: D1_SOURCE_SUITE_DIGEST,
      }),
      createdAt: now,
      updatedAt: now,
    });
  }

  const scriptId = await resolveOrCreateIntegerMapping(
    transaction,
    "script",
    "o_script",
    productionPackage.approvedScriptVersion.id,
  );
  if (!await transaction("o_script").where({ id: scriptId }).first()) {
    await transaction("o_script").insert({
      id: scriptId,
      name: productionPackage.approvedScriptVersion.name,
      content: productionPackage.approvedScriptVersion.blocks.map((block) => block.content).join("\n"),
      projectId,
      extractState: 1,
      createTime: Date.parse(productionPackage.approvedScriptVersion.createdAt),
    });
  }

  const scriptVersionId = stableUuid(
    "script-version",
    `${productionPackage.projectId}:${productionPackage.approvedScriptVersion.id}:1`,
  );
  if (!await transaction("sc_script_versions").where({ id: scriptVersionId }).first()) {
    await transaction("sc_script_versions").insert({
      id: scriptVersionId,
      projectId,
      scriptId,
      version: 1,
      structuredJson: JSON.stringify(productionPackage.approvedScriptVersion),
      source: "contract-v0.1",
      createdAt: productionPackage.approvedScriptVersion.createdAt,
    });
  }
  await transaction("sc_project_profile").where({ projectId }).update({
    currentScriptVersionId: scriptVersionId,
    updatedAt: now,
  });
  await createMapping(
    transaction,
    "script-version",
    scriptVersionId,
    productionPackage.approvedScriptVersion.id,
    { scriptId },
  );

  const sceneId = stableUuid("scene", `${productionPackage.projectId}:sanlitun-store`);
  if (!await transaction("sc_scenes").where({ id: sceneId }).first()) {
    await transaction("sc_scenes").insert({
      id: sceneId,
      projectId,
      title: productionPackage.creativeBriefSnapshot.merchantName,
      description: productionPackage.creativeBriefSnapshot.notes,
      location: productionPackage.creativeBriefSnapshot.address,
      sortOrder: 1,
    });
  }

  const shotMappings: Array<{ externalId: string; internalId: number; order: number }> = [];
  for (const shot of productionPackage.shotDrafts) {
    const storyboardId = await resolveOrCreateIntegerMapping(
      transaction,
      "shot",
      "o_storyboard",
      shot.id,
    );
    shotMappings.push({ externalId: shot.id, internalId: storyboardId, order: shot.order });
    if (!await transaction("o_storyboard").where({ id: storyboardId }).first()) {
      await transaction("o_storyboard").insert({
        id: storyboardId,
        scriptId,
        prompt: shot.description,
        duration: String(shot.duration),
        state: shot.status,
        reason: shot.matchStatus,
        videoDesc: shot.narration,
        shouldGenerateImage: shot.sourceType === "ai" ? 1 : 0,
        projectId,
        index: shot.order,
        createTime: Date.parse(productionPackage.createdAt) + shot.order,
      });
    }
    if (!await transaction("sc_shot_metadata").where({ storyboardId }).first()) {
      await transaction("sc_shot_metadata").insert({
        storyboardId,
        sceneId,
        shotType: shot.shotType,
        cameraMovement: shot.cameraPosition,
        visualDescription: shot.description,
        imagePrompt: `${shot.description}；${shot.screenText}；严格遵守批准 Claim 与禁用词规则。`,
        videoPrompt: `${shot.narration}；镜头：${shot.cameraPosition}。`,
        narration: shot.narration,
        onScreenText: shot.screenText,
        transitionName: "cut",
        materialStrategy: shot.sourceType,
        durationSeconds: shot.duration,
        locked: false,
        sortOrder: shot.order,
        generationStatus: shot.status === "done" ? "ready" : shot.matchStatus,
      });
    }
    await createMapping(transaction, "shot", storyboardId, shot.id, {
      order: shot.order,
      packageId: productionPackage.packageId,
    });
  }

  await ensureD1Continuity(transaction, productionPackage, projectId, shotMappings);
  await registerPackageInputAssets(transaction, productionPackage, projectId, shotMappings);

  return { projectId, scriptId, scriptVersionId, sceneId, shotMappings };
}

async function ensureD1Continuity(
  transaction: Knex.Transaction,
  productionPackage: ProjectProductionPackage,
  projectId: number,
  shotMappings: Array<{ externalId: string; internalId: number; order: number }>,
) {
  if (await transaction("sc_continuity_profiles").where({ projectId }).first()) return;
  const now = new Date().toISOString();
  const profileId = stableUuid("continuity-profile", productionPackage.projectId);
  const brandEntityId = stableUuid("entity", `${productionPackage.projectId}:haidilao-brand`);
  const locationEntityId = stableUuid("entity", `${productionPackage.projectId}:sanlitun-store`);
  const rightsEntityId = stableUuid("entity", `${productionPackage.projectId}:member-rights`);
  const aiShot = productionPackage.shotDrafts.find((shot) => shot.sourceType === "ai");

  await transaction("sc_continuity_profiles").insert({
    id: profileId,
    projectId,
    revision: 1,
    styleJson: JSON.stringify({
      visualStyle: "写实本地生活短视频",
      aspectRatio: productionPackage.target.aspectRatio,
      platform: productionPackage.target.platform,
      store: productionPackage.creativeBriefSnapshot.merchantName,
    }),
    rulesJson: JSON.stringify([
      ...productionPackage.riskRulesSnapshot.restrictions,
      `禁用词：${productionPackage.riskRulesSnapshot.prohibitedWords.join("、")}`,
      "连续性由实体和世界状态驱动；普通切镜不默认使用上一镜尾帧。",
    ]),
    createdAt: now,
    updatedAt: now,
  });

  const entities = [
    {
      id: brandEntityId,
      slug: "haidilao-brand",
      entityType: "brand",
      name: productionPackage.creativeBriefSnapshot.merchantName.split("·")[0],
      canonical: {
        brandId: productionPackage.brandId,
        approvedClaimIds: productionPackage.brandFactsSnapshot.map((claim) => claim.id),
        facts: productionPackage.brandFactsSnapshot,
      },
      state: { visible: true },
    },
    {
      id: locationEntityId,
      slug: "sanlitun-store",
      entityType: "location",
      name: productionPackage.creativeBriefSnapshot.merchantName,
      canonical: {
        storeId: productionPackage.storeId,
        city: productionPackage.creativeBriefSnapshot.city,
        address: productionPackage.creativeBriefSnapshot.address,
      },
      state: {
        serviceOpen: true,
        location: productionPackage.creativeBriefSnapshot.address,
      },
    },
    {
      id: rightsEntityId,
      slug: "member-rights",
      entityType: "object",
      name: `${aiShot?.description || "AI 内容"}图卡`,
      canonical: {
        claimIds: productionPackage.brandFactsSnapshot
          .filter((claim) => claim.type === "policy" || claim.type === "disclaimer")
          .map((claim) => claim.id),
        disclaimer: productionPackage.brandFactsSnapshot.find((claim) => claim.type === "disclaimer")?.text,
      },
      state: { generated: false, reviewStatus: "planned" },
    },
  ];
  await transaction("sc_entities").insert(entities.map((entity) => ({
    id: entity.id,
    projectId,
    slug: entity.slug,
    entityType: entity.entityType,
    name: entity.name,
    canonicalJson: JSON.stringify(entity.canonical),
    locked: true,
    createdAt: now,
    updatedAt: now,
  })));
  await transaction("sc_entity_versions").insert(entities.map((entity) => ({
    id: stableUuid("entity-version", `${entity.id}:1`),
    entityId: entity.id,
    version: 1,
    appearanceJson: "{}",
    stateJson: JSON.stringify(entity.state),
    approved: true,
    createdAt: now,
  })));

  for (const mapping of shotMappings) {
    const shot = productionPackage.shotDrafts.find((item) => item.id === mapping.externalId)!;
    const entitySlugs = shot.id === "shot-07"
      ? ["haidilao-brand", "sanlitun-store", "member-rights"]
      : ["haidilao-brand", "sanlitun-store"];
    await transaction("sc_shot_contracts").insert({
      projectId,
      shotId: mapping.internalId,
      worldRevision: 1,
      entitySlugsJson: JSON.stringify(entitySlugs),
      mustPreserveJson: JSON.stringify([
        `${productionPackage.creativeBriefSnapshot.merchantName} 品牌身份`,
        `${productionPackage.creativeBriefSnapshot.address} 门店上下文`,
        ...productionPackage.riskRulesSnapshot.restrictions,
      ]),
      requiredStateJson: JSON.stringify({
        "haidilao-brand.visible": true,
        "sanlitun-store.location": productionPackage.creativeBriefSnapshot.address,
      }),
      statePatchJson: JSON.stringify(shot.id === "shot-07"
        ? { "member-rights.generated": true, "member-rights.reviewStatus": "registered" }
        : {}),
      actionJson: JSON.stringify({ subject: shot.description, verb: "present-approved-shot" }),
      cameraJson: JSON.stringify({ shotSize: shot.shotType, position: shot.cameraPosition }),
      transitionJson: JSON.stringify({ relationType: mapping.order === 1 ? "opening" : "same-scene-cut" }),
      updatedAt: now,
    });
  }

  for (let index = 1; index < shotMappings.length; index += 1) {
    const from = shotMappings[index - 1];
    const to = shotMappings[index];
    await transaction("sc_shot_relations").insert({
      id: stableUuid("shot-relation", `${productionPackage.projectId}:${from.externalId}:${to.externalId}`),
      projectId,
      fromShotId: from.internalId,
      toShotId: to.internalId,
      relationType: "same-scene-cut",
      preserveJson: JSON.stringify(["品牌身份", "门店上下文", "批准事实", "竖屏写实风格"]),
      matchOn: "world-state",
      usePreviousEndFrame: false,
      createdAt: now,
      updatedAt: now,
    });
  }
}

async function registerPackageInputAssets(
  transaction: Knex.Transaction,
  productionPackage: ProjectProductionPackage,
  projectId: number,
  shotMappings: Array<{ externalId: string; internalId: number; order: number }>,
) {
  const now = new Date().toISOString();
  for (const shot of productionPackage.shotDrafts.filter((item) => item.assetId)) {
    const externalAssetId = shot.assetId!;
    const assetId = stableUuid("media-asset", `${productionPackage.projectId}:${externalAssetId}`);
    const storageReference = `demo://package-assets/${externalAssetId}`;
    if (!await transaction("sc_media_assets").where({ id: assetId }).first()) {
      await transaction("sc_media_assets").insert({
        id: assetId,
        projectId,
        type: "image",
        source: "package-snapshot",
        originalName: externalAssetId,
        mimeType: "application/x-demo-controlled-reference",
        byteSize: 0,
        localPath: storageReference,
        width: 720,
        height: 1280,
        provider: "ControlPlaneFixture",
        sha256: digestValue({ projectId: productionPackage.projectId, assetId: externalAssetId }).slice(7),
        rightsNote: "权利范围由不可变生产包快照约束；D1 不嵌入原始媒体字节。",
        metadataJson: JSON.stringify({
          externalAssetId,
          externalShotId: shot.id,
          storageReference,
          truthMode: productionPackage.truthMode,
        }),
        createdAt: now,
      });
    }
    await createMapping(transaction, "asset", assetId, externalAssetId, { externalShotId: shot.id });
    const shotMapping = shotMappings.find((item) => item.externalId === shot.id)!;
    const bindingId = stableUuid("reference-binding", `${productionPackage.projectId}:${shot.id}:${externalAssetId}`);
    if (!await transaction("sc_reference_bindings").where({ id: bindingId }).first()) {
      await transaction("sc_reference_bindings").insert({
        id: bindingId,
        projectId,
        entityId: null,
        shotId: shotMapping.internalId,
        assetId,
        sourceUri: storageReference,
        role: "scene_layout",
        view: "canonical",
        priority: 80,
        approved: true,
        createdAt: now,
      });
    }
  }
}

function publicPackage(row: PackageRow, duplicate = false) {
  const snapshot = parseJson<ProjectProductionPackage>(row.snapshotJson, {} as ProjectProductionPackage);
  return {
    packageRecordId: row.id,
    packageId: row.packageId,
    packageVersion: row.packageVersion,
    contractVersion: row.contractVersion,
    tenantId: row.tenantId,
    projectId: row.externalProjectId,
    internalProjectId: Number(row.internalProjectId),
    digest: snapshot.digest,
    sourceSuiteDigest: row.sourceSuiteDigest,
    idempotencyKey: row.idempotencyKey,
    status: row.status,
    result: duplicate ? "duplicate" : "accepted",
    duplicate,
    acceptedAt: row.acceptedAt,
    storycanvasPath: STORYCANVAS_PATH,
    deepLink: storycanvasDeepLink(),
    returnPath: CONTROL_PLANE_RETURN_PATH,
  };
}

export async function acceptProductionPackage(
  packageValue: unknown,
  grantValue: unknown,
  requestedCapabilityId = REQUIRED_CAPABILITY,
) {
  const payloadDigest = digestValue(packageValue);
  const unsafe = packageValue && typeof packageValue === "object"
    ? packageValue as Record<string, unknown>
    : {};
  const idempotencyKey = typeof unsafe.idempotencyKey === "string" ? unsafe.idempotencyKey : null;
  const snapshotJson = safeSnapshot(packageValue);

  try {
    if (!idempotencyKey) {
      throw new ProductionContractError("PACKAGE_SCHEMA_INVALID", "缺少 idempotencyKey");
    }
    if (unsafe.contractVersion !== "0.1") {
      throw new ProductionContractError(
        "CONTRACT_VERSION_UNSUPPORTED",
        `不支持 contractVersion=${String(unsafe.contractVersion)}`,
      );
    }
    const productionPackage = assertPackageContract(packageValue);
    assertGrantScope(grantValue, productionPackage, requestedCapabilityId, ["production.package.read"]);

    const existing = await activeDatabase<PackageRow>("sc_production_packages").where({ idempotencyKey }).first();
    if (existing) {
      if (existing.payloadDigest !== payloadDigest) {
        const conflict = new ProductionContractError("IDEMPOTENCY_CONFLICT", "同一幂等键收到不同生产包内容", {
          packageId: existing.packageId,
          packageVersion: existing.packageVersion,
        });
        await recordAttempt({
          packageRecordId: existing.id,
          packageId: typeof unsafe.packageId === "string" ? unsafe.packageId : null,
          packageVersion: typeof unsafe.packageVersion === "number" ? unsafe.packageVersion : null,
          contractVersion: typeof unsafe.contractVersion === "string" ? unsafe.contractVersion : null,
          tenantId: typeof unsafe.tenantId === "string" ? unsafe.tenantId : null,
          externalProjectId: typeof unsafe.projectId === "string" ? unsafe.projectId : null,
          idempotencyKey,
          payloadDigest,
          snapshotJson,
          status: "rejected",
          errorCode: conflict.code,
          errorJson: JSON.stringify(conflict.details),
        });
        throw conflict;
      }
      await recordAttempt({
        packageRecordId: existing.id,
        packageId: existing.packageId,
        packageVersion: existing.packageVersion,
        contractVersion: existing.contractVersion,
        tenantId: existing.tenantId,
        externalProjectId: existing.externalProjectId,
        idempotencyKey,
        payloadDigest,
        snapshotJson,
        status: "duplicate",
      });
      return publicPackage(existing, true);
    }

    return await activeDatabase.transaction(async (transaction) => {
      const versionRows = await transaction<PackageRow>("sc_production_packages")
        .where({
          packageId: productionPackage.packageId,
          packageVersion: productionPackage.packageVersion,
        });
      if (versionRows.some((row) => row.payloadDigest !== payloadDigest)) {
        throw new ProductionContractError(
          "PACKAGE_VERSION_IMMUTABLE",
          "同一 packageId/packageVersion 已存在不同内容",
        );
      }
      if (versionRows.length) {
        const original = versionRows[0];
        await recordAttempt({
          packageRecordId: original.id,
          packageId: original.packageId,
          packageVersion: original.packageVersion,
          contractVersion: original.contractVersion,
          tenantId: original.tenantId,
          externalProjectId: original.externalProjectId,
          idempotencyKey: productionPackage.idempotencyKey,
          payloadDigest,
          snapshotJson: original.snapshotJson,
          status: "duplicate",
        }, transaction);
        return publicPackage(original, true);
      }

      const projection = await projectPackageSnapshot(transaction, productionPackage);
      const now = new Date().toISOString();
      const row: PackageRow = {
        id: crypto.randomUUID(),
        packageId: productionPackage.packageId,
        packageVersion: productionPackage.packageVersion,
        contractVersion: productionPackage.contractVersion,
        tenantId: productionPackage.tenantId,
        externalProjectId: productionPackage.projectId,
        internalProjectId: projection.projectId,
        idempotencyKey: productionPackage.idempotencyKey,
        payloadDigest,
        sourceSuiteDigest: D1_SOURCE_SUITE_DIGEST,
        capabilityIdsJson: JSON.stringify(productionPackage.capabilityGrants.map((item) => item.capabilityId)),
        snapshotJson: canonicalize(productionPackage),
        status: "accepted",
        acceptedAt: now,
        createdAt: now,
      };
      await transaction("sc_production_packages").insert(row);
      await recordAttempt({
        packageRecordId: row.id,
        packageId: row.packageId,
        packageVersion: row.packageVersion,
        contractVersion: row.contractVersion,
        tenantId: row.tenantId,
        externalProjectId: row.externalProjectId,
        idempotencyKey: row.idempotencyKey,
        payloadDigest,
        snapshotJson: row.snapshotJson,
        status: "accepted",
      }, transaction);
      return publicPackage(row);
    });
  } catch (cause) {
    const known = cause instanceof ProductionContractError
      ? cause
      : new ProductionContractError(
        cause instanceof ZodError ? "PACKAGE_SCHEMA_INVALID" : "PACKAGE_REJECTED",
        cause instanceof Error ? cause.message : String(cause),
      );
    const alreadyRecorded = known.code === "IDEMPOTENCY_CONFLICT";
    if (!alreadyRecorded) {
      await recordAttempt({
        packageId: typeof unsafe.packageId === "string" ? unsafe.packageId : null,
        packageVersion: typeof unsafe.packageVersion === "number" ? unsafe.packageVersion : null,
        contractVersion: typeof unsafe.contractVersion === "string" ? unsafe.contractVersion : null,
        tenantId: typeof unsafe.tenantId === "string" ? unsafe.tenantId : null,
        externalProjectId: typeof unsafe.projectId === "string" ? unsafe.projectId : null,
        idempotencyKey,
        payloadDigest,
        snapshotJson,
        status: "rejected",
        errorCode: known.code,
        errorJson: JSON.stringify({ message: known.message, ...known.details }),
      });
    }
    throw known;
  }
}

async function requireAcceptedPackage(externalProjectId: string) {
  if (externalProjectId !== D1_FIXTURE_ID) {
    throw new ProductionContractError(
      "PROJECT_SCOPE_MISMATCH",
      `拒绝非 canonical StoryCanvas 项目 ${externalProjectId}`,
    );
  }
  const row = await activeDatabase<PackageRow>("sc_production_packages")
    .where({ externalProjectId, status: "accepted" })
    .orderBy("packageVersion", "desc")
    .first();
  if (!row) throw new ProductionContractError("PACKAGE_NOT_ACCEPTED", `项目 ${externalProjectId} 尚无 accepted 包`);
  return row;
}

async function authorizeAcceptedProject(
  externalProjectId: string,
  grantValue: unknown,
  requiredScopes: Array<"production.package.read" | "production.receipt.write">,
) {
  const packageRow = await requireAcceptedPackage(externalProjectId);
  const productionPackage = assertPackageContract(parseJson(packageRow.snapshotJson, null));
  const grant = assertGrantScope(
    grantValue,
    productionPackage,
    REQUIRED_CAPABILITY,
    requiredScopes,
  );
  return { packageRow, productionPackage, grant };
}

async function enqueueReceipt(
  packageRow: PackageRow,
  receiptType: "generation-task" | "asset" | "export",
  businessId: string,
  idempotencyKey: string,
  payload: GenerationTaskReceipt | AssetReceipt | Record<string, unknown>,
  transaction: Knex.Transaction,
) {
  const payloadDigest = digestValue(payload);
  const existing = await transaction("sc_receipt_outbox")
    .where({ receiptType, businessId })
    .first();
  if (existing) {
    if (existing.payloadDigest !== payloadDigest || existing.idempotencyKey !== idempotencyKey) {
      throw new ProductionContractError("RECEIPT_REPLAY_CONFLICT", `${receiptType}/${businessId} 回执重放冲突`);
    }
    return { row: existing, duplicate: true };
  }
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    projectId: packageRow.internalProjectId,
    externalProjectId: packageRow.externalProjectId,
    packageId: packageRow.packageId,
    receiptType,
    businessId,
    idempotencyKey,
    payloadDigest,
    payloadJson: canonicalize(payload),
    status: "pending",
    retryCount: 0,
    deliveryId: null,
    lastAttempt: null,
    deliveredAt: null,
    acknowledgedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await transaction("sc_receipt_outbox").insert(row);
  return { row, duplicate: false };
}

async function localShotId(transaction: Knex.Transaction, externalShotId: string) {
  const mapping = await findMapping(transaction, "shot", externalShotId);
  if (!mapping) throw new ProductionContractError("SHOT_MAPPING_NOT_FOUND", `未找到 ${externalShotId} 的稳定映射`);
  return Number(mapping.localId);
}

async function applyTaskReceipt(
  packageRow: PackageRow,
  receipt: GenerationTaskReceipt,
  transaction: Knex.Transaction,
) {
  const shotId = await localShotId(transaction, receipt.shotId);
  for (const externalAssetId of receipt.referenceAssetIds) {
    if (await findMapping(transaction, "asset", externalAssetId)) continue;
    const assetId = stableUuid("media-asset", `${receipt.projectId}:${externalAssetId}`);
    const storageReference = `demo://receipt-references/${externalAssetId}`;
    await transaction("sc_media_assets").insert({
      id: assetId,
      projectId: packageRow.internalProjectId,
      type: "image",
      source: "receipt-reference",
      originalName: externalAssetId,
      mimeType: "application/x-demo-controlled-reference",
      byteSize: 0,
      localPath: storageReference,
      provider: "ControlPlaneFixture",
      sha256: digestValue({ projectId: receipt.projectId, assetId: externalAssetId }).slice(7),
      rightsNote: "D1 canonical receipt reference；不包含或伪造媒体输出字节。",
      metadataJson: JSON.stringify({
        externalAssetId,
        externalShotId: receipt.shotId,
        storageReference,
        truthMode: receipt.truthMode,
        controlledReference: true,
      }),
      createdAt: receipt.createdAt,
    });
    await createMapping(transaction, "asset", assetId, externalAssetId, {
      externalShotId: receipt.shotId,
      source: "receipt-reference",
    });
  }
  const existing = await transaction("sc_tasks").where({ id: receipt.generationTaskId }).first();
  const taskPayload = {
    kind: receipt.taskType === "image.generate" ? "image" : "video",
    shotId,
    externalShotId: receipt.shotId,
    capabilityId: receipt.capabilityId,
    inputDigest: receipt.inputDigest,
    referenceAssetIds: receipt.referenceAssetIds,
    reservationReference: receipt.reservationReference,
    truthMode: receipt.truthMode,
  };
  const outputPayload = receipt.status === "succeeded"
    ? { mediaType: "image", outputAssetIds: receipt.outputAssetIds, controlledReference: true }
    : null;
  if (!existing) {
    await transaction("sc_tasks").insert({
      id: receipt.generationTaskId,
      projectId: packageRow.internalProjectId,
      storyboardId: shotId,
      taskType: `contract_${receipt.taskType.replace(".", "_")}`,
      provider: receipt.provider,
      status: receipt.status,
      progress: receipt.progress,
      inputJson: JSON.stringify(taskPayload),
      outputJson: outputPayload ? JSON.stringify(outputPayload) : null,
      errorJson: receipt.error ? JSON.stringify(receipt.error) : null,
      idempotencyKey: receipt.idempotencyKey,
      externalTaskId: receipt.generationTaskId,
      actualCost: null,
      createdAt: receipt.createdAt,
      updatedAt: receipt.completedAt,
    });
    await createMapping(transaction, "generation-task", receipt.generationTaskId, receipt.generationTaskId);
  } else {
    const existingDigest = digestValue({
      status: existing.status,
      inputJson: parseJson(existing.inputJson, {}),
      outputJson: parseJson(existing.outputJson, null),
      errorJson: parseJson(existing.errorJson, null),
    });
    const incomingDigest = digestValue({
      status: receipt.status,
      inputJson: taskPayload,
      outputJson: outputPayload,
      errorJson: receipt.error,
    });
    if (existingDigest !== incomingDigest) {
      throw new ProductionContractError("RECEIPT_REPLAY_CONFLICT", `${receipt.generationTaskId} 已有不同终态`);
    }
  }
}

async function applyAssetReceipt(
  packageRow: PackageRow,
  receipt: AssetReceipt,
  transaction: Knex.Transaction,
) {
  const shotId = await localShotId(transaction, receipt.shotId);
  const assetId = stableUuid("media-asset", `${receipt.projectId}:${receipt.assetId}`);
  const existing = await transaction("sc_media_assets").where({ id: assetId }).first();
  if (!existing) {
    await transaction("sc_media_assets").insert({
      id: assetId,
      projectId: packageRow.internalProjectId,
      type: receipt.type,
      source: "demo-generated",
      originalName: `${receipt.assetId}.png`,
      mimeType: receipt.mimeType,
      byteSize: 0,
      localPath: receipt.storageReference,
      durationMs: receipt.durationSeconds * 1000,
      width: receipt.dimensions.width,
      height: receipt.dimensions.height,
      provider: receipt.source,
      sha256: receipt.checksum.slice(7),
      rightsNote: receipt.rightsNote,
      metadataJson: JSON.stringify({
        externalAssetId: receipt.assetId,
        externalShotId: receipt.shotId,
        internalShotId: shotId,
        generationTaskId: receipt.generationTaskId,
        model: receipt.model,
        promptDigest: receipt.promptDigest,
        reviewStatus: receipt.reviewStatus,
        version: receipt.version,
        storageReference: receipt.storageReference,
        truthMode: receipt.truthMode,
        controlledReference: true,
      }),
      createdAt: receipt.createdAt,
    });
    await createMapping(transaction, "asset", assetId, receipt.assetId, {
      externalShotId: receipt.shotId,
      generationTaskId: receipt.generationTaskId,
    });
  } else if (`sha256:${existing.sha256}` !== receipt.checksum) {
    throw new ProductionContractError("ASSET_CHECKSUM_CONFLICT", `${receipt.assetId} checksum 与已登记资产不一致`);
  }
}

export async function runDeterministicDemoScenario(
  externalProjectId: string,
  scenario: "success" | "failure",
  grantValue: unknown,
) {
  const { packageRow } = await authorizeAcceptedProject(
    externalProjectId,
    grantValue,
    ["production.receipt.write"],
  );
  const taskReceipt = generationTaskReceiptSchema.parse(
    scenario === "success" ? successTaskReceiptJson : failureTaskReceiptJson,
  );
  const assetReceipt = scenario === "success" ? assetReceiptSchema.parse(successAssetReceiptJson) : null;
  if (
    taskReceipt.tenantId !== packageRow.tenantId
    || taskReceipt.projectId !== packageRow.externalProjectId
  ) {
    throw new ProductionContractError("RECEIPT_SCOPE_MISMATCH", "回执 tenant/project 与 accepted 包不一致");
  }

  return activeDatabase.transaction(async (transaction) => {
    await applyTaskReceipt(packageRow, taskReceipt, transaction);
    const taskOutbox = await enqueueReceipt(
      packageRow,
      "generation-task",
      taskReceipt.generationTaskId,
      taskReceipt.idempotencyKey,
      taskReceipt,
      transaction,
    );
    let assetOutbox = null;
    if (assetReceipt) {
      if (
        assetReceipt.tenantId !== packageRow.tenantId
        || assetReceipt.projectId !== packageRow.externalProjectId
        || assetReceipt.shotId !== taskReceipt.shotId
        || assetReceipt.generationTaskId !== taskReceipt.generationTaskId
        || !taskReceipt.outputAssetIds.includes(assetReceipt.assetId)
      ) {
        throw new ProductionContractError("ASSET_TASK_LINK_MISMATCH", "AssetReceipt 未关联成功任务输出");
      }
      await applyAssetReceipt(packageRow, assetReceipt, transaction);
      assetOutbox = await enqueueReceipt(
        packageRow,
        "asset",
        assetReceipt.assetId,
        assetReceipt.idempotencyKey,
        assetReceipt,
        transaction,
      );
    }
    return {
      scenario,
      task: taskReceipt,
      asset: assetReceipt,
      duplicate: taskOutbox.duplicate && (!assetOutbox || assetOutbox.duplicate),
      outbox: {
        taskReceiptId: taskOutbox.row.id,
        assetReceiptId: assetOutbox?.row.id ?? null,
        status: "pending",
      },
    };
  });
}

async function ensureFallbackExport(packageRow: PackageRow) {
  return activeDatabase.transaction(async (transaction) => {
    const snapshot = parseJson<ProjectProductionPackage>(packageRow.snapshotJson, {} as ProjectProductionPackage);
    const scriptMapping = await findMapping(transaction, "script-version", snapshot.approvedScriptVersion.id);
    if (!scriptMapping) throw new ProductionContractError("SCRIPT_MAPPING_NOT_FOUND", "缺少 script-a 映射");
    const assetId = stableUuid("media-asset", `${packageRow.externalProjectId}:fallback-export:v1`);
    const artifactId = stableUuid("export-artifact", `${packageRow.externalProjectId}:fallback:v1`);
    const externalAssetId = `asset-${packageRow.externalProjectId}-fallback-shot-05-synthetic-v1`;
    const externalArtifactId = `export-${packageRow.externalProjectId}-fallback-v1`;
    const checksum = `sha256:${FALLBACK_MEDIA_SHA256}`;
    const mediaUrl = storycanvasMediaUrl(FALLBACK_MEDIA_PATH);
    const sourceChain = {
      package: { packageId: packageRow.packageId, version: packageRow.packageVersion, digest: snapshot.digest },
      scriptVersion: snapshot.approvedScriptVersion.id,
      pipeline: "8-shot/basic-merge",
      shots: snapshot.shotDrafts.map((shot) => ({
        shotId: shot.id,
        role: shot.id === "shot-05" ? "synthetic-fallback-repair" : "canonical-package-reference",
      })),
      tasks: [successTaskReceiptJson.generationTaskId],
      excludedTasks: [{
        taskId: failureTaskReceiptJson.generationTaskId,
        reason: "failed-without-output-asset",
      }],
      assets: [
        ...snapshot.creativeBriefSnapshot.assetIds,
        successAssetReceiptJson.assetId,
        externalAssetId,
      ],
      repair: {
        shotId: "shot-05",
        assetId: externalAssetId,
        source: "SELF_GENERATED_SYNTHETIC",
        rights: "NO_THIRD_PARTY_ASSET",
        contentQuality: "DEMO_ONLY",
      },
      export: {
        artifactId,
        externalArtifactId,
        mode: "FALLBACK",
        truthMode: "FALLBACK",
        deliveryClaim: "DEMO_ONLY",
        provider: "LocalFFmpegLavfi",
        generator: "ffmpeg lavfi testsrc2 + sine",
        playable: true,
        mediaPath: FALLBACK_MEDIA_PATH,
        mediaUrl,
        checksum,
        byteSize: FALLBACK_MEDIA_BYTE_SIZE,
        durationSeconds: FALLBACK_MEDIA_DURATION_SECONDS,
        dimensions: { width: FALLBACK_MEDIA_WIDTH, height: FALLBACK_MEDIA_HEIGHT },
        codecs: { video: "h264", audio: "aac" },
      },
      qa: {
        technicalPlayback: {
          status: "passed",
          evidence: "ffmpeg deterministic parameters + single authorized ffprobe metadata capture",
        },
        editorial: {
          status: "not_evaluated",
          deliveryClaim: "DEMO_ONLY",
          note: "仅验证本地导出、播放与来源链，不代表正式内容质量。",
        },
        brand: {
          status: "not_approved",
          note: "不代表海底捞品牌审核通过或正式营销素材。",
        },
      },
    };
    const now = new Date().toISOString();
    const assetValues = {
      projectId: packageRow.internalProjectId,
      type: "video",
      source: "fallback",
      originalName: "demo-local-001-fallback-synthetic-v1.mp4",
      mimeType: "video/mp4",
      byteSize: FALLBACK_MEDIA_BYTE_SIZE,
      localPath: FALLBACK_MEDIA_PATH,
      durationMs: FALLBACK_MEDIA_DURATION_SECONDS * 1000,
      width: FALLBACK_MEDIA_WIDTH,
      height: FALLBACK_MEDIA_HEIGHT,
      fps: 30,
      provider: "LocalFFmpegLavfi",
      sha256: FALLBACK_MEDIA_SHA256,
      rightsNote: "SELF_GENERATED_SYNTHETIC / NO_THIRD_PARTY_ASSET；DEMO_ONLY，本地合成演示片，不代表正式品牌审核或营销交付。",
      metadataJson: JSON.stringify({
        externalAssetId,
        externalShotId: "shot-05",
        storageReference: FALLBACK_MEDIA_PATH,
        mediaUrl,
        truthMode: "FALLBACK",
        deliveryClaim: "DEMO_ONLY",
        reviewStatus: "demo_only",
        technicalQa: "passed",
        editorialQa: "not_evaluated",
        brandQa: "not_approved",
        playable: true,
        rightsSource: "SELF_GENERATED_SYNTHETIC",
        thirdPartyAssets: false,
        dimensions: { width: FALLBACK_MEDIA_WIDTH, height: FALLBACK_MEDIA_HEIGHT },
        durationSeconds: FALLBACK_MEDIA_DURATION_SECONDS,
        codecs: { video: "h264", audio: "aac" },
        sourceChain,
      }),
    };
    if (!await transaction("sc_media_assets").where({ id: assetId }).first()) {
      await transaction("sc_media_assets").insert({
        id: assetId,
        ...assetValues,
        createdAt: now,
      });
    } else {
      await transaction("sc_media_assets").where({ id: assetId }).update(assetValues);
    }
    await createMapping(transaction, "asset", assetId, externalAssetId, {
      externalShotId: "shot-05",
      truthMode: "FALLBACK",
      deliveryClaim: "DEMO_ONLY",
    });
    const row = {
      id: artifactId,
      projectId: packageRow.internalProjectId,
      externalProjectId: packageRow.externalProjectId,
      packageId: packageRow.packageId,
      scriptVersionId: scriptMapping.localId,
      taskId: null,
      assetId,
      timelineVersionId: null,
      mode: "FALLBACK",
      status: "demo_only",
      storageReference: FALLBACK_MEDIA_PATH,
      checksum,
      sourceChainJson: JSON.stringify(sourceChain),
      createdAt: now,
    };
    const existingArtifact = await transaction("sc_export_artifacts").where({ id: artifactId }).first();
    if (existingArtifact) {
      await transaction("sc_export_artifacts").where({ id: artifactId }).update({
        status: row.status,
        storageReference: row.storageReference,
        checksum: row.checksum,
        sourceChainJson: row.sourceChainJson,
      });
    } else {
      await transaction("sc_export_artifacts").insert(row);
    }
    await createMapping(
      transaction,
      "export-artifact",
      artifactId,
      externalArtifactId,
    );
    const exportReceipt = {
      contractVersion: "0.1",
      receiptType: "export",
      exportId: externalArtifactId,
      exportArtifactId: externalArtifactId,
      generationTaskId: successTaskReceiptJson.generationTaskId,
      tenantId: packageRow.tenantId,
      projectId: packageRow.externalProjectId,
      packageId: packageRow.packageId,
      status: "succeeded",
      outputAssetIds: [externalAssetId],
      checksum,
      error: null,
      shotIds: snapshot.shotDrafts.map((shot) => shot.id),
      repairAssetId: externalAssetId,
      mode: "FALLBACK",
      truthMode: "FALLBACK",
      deliveryClaim: "DEMO_ONLY",
      playable: true,
      technicalQa: "passed",
      editorialQa: "not_evaluated",
      brandQa: "not_approved",
      mediaPath: FALLBACK_MEDIA_PATH,
      mediaUrl,
      byteSize: FALLBACK_MEDIA_BYTE_SIZE,
      durationSeconds: FALLBACK_MEDIA_DURATION_SECONDS,
      dimensions: { width: FALLBACK_MEDIA_WIDTH, height: FALLBACK_MEDIA_HEIGHT },
      codecs: { video: "h264", audio: "aac" },
      rightsSource: "SELF_GENERATED_SYNTHETIC",
      thirdPartyAssets: false,
      createdAt: snapshot.createdAt,
      idempotencyKey: `receipt-${externalArtifactId}`,
    };
    const outbox = await enqueueReceipt(
      packageRow,
      "export",
      externalArtifactId,
      exportReceipt.idempotencyKey,
      exportReceipt,
      transaction,
    );
    return { row, outbox };
  });
}

export async function registerFallbackExport(
  externalProjectId: string,
  grantValue: unknown,
) {
  const { packageRow } = await authorizeAcceptedProject(
    externalProjectId,
    grantValue,
    ["production.receipt.write"],
  );
  const successTask = await activeDatabase("sc_tasks")
    .where({ id: successTaskReceiptJson.generationTaskId, projectId: packageRow.internalProjectId, status: "succeeded" })
    .first();
  const successAssetMapping = await findMapping(
    activeDatabase,
    "asset",
    successAssetReceiptJson.assetId,
  );
  const failureTask = await activeDatabase("sc_tasks")
    .where({ id: failureTaskReceiptJson.generationTaskId, projectId: packageRow.internalProjectId, status: "failed" })
    .first();
  if (!successTask || !successAssetMapping || !failureTask) {
    throw new ProductionContractError(
      "FALLBACK_PREREQUISITES_MISSING",
      "基础合并来源链缺少 canonical 成功任务/资产或失败任务证据",
    );
  }
  const ensured = await ensureFallbackExport(packageRow);
  return {
    ...publicArtifact(ensured.row),
    outbox: {
      receiptId: ensured.outbox.row.id,
      status: ensured.outbox.row.status,
      duplicate: ensured.outbox.duplicate,
    },
  };
}

function publicArtifact(row: Record<string, unknown>) {
  const sourceChain = parseJson<Record<string, any>>(String(row.sourceChainJson ?? ""), {});
  const exportMetadata = sourceChain.export ?? {};
  const qa = sourceChain.qa ?? {};
  return {
    ...row,
    projectId: row.externalProjectId,
    internalProjectId: row.projectId,
    truthMode: exportMetadata.truthMode ?? row.mode,
    deliveryClaim: exportMetadata.deliveryClaim,
    playable: Boolean(exportMetadata.playable),
    technicalQa: qa.technicalPlayback?.status,
    editorialQa: qa.editorial?.status,
    brandQa: qa.brand?.status,
    mediaPath: exportMetadata.mediaPath ?? row.storageReference,
    mediaUrl: exportMetadata.mediaUrl,
    byteSize: exportMetadata.byteSize,
    durationSeconds: exportMetadata.durationSeconds,
    dimensions: exportMetadata.dimensions,
    codecs: exportMetadata.codecs,
    sourceChain,
    sourceChainJson: undefined,
  };
}

export async function getProductionProject(externalProjectId: string, grantValue: unknown) {
  const { packageRow, productionPackage: snapshot } = await authorizeAcceptedProject(
    externalProjectId,
    grantValue,
    ["production.package.read"],
  );
  const mappings = await activeDatabase<MappingRow>("sc_external_mappings")
    .where({ system: EXTERNAL_SYSTEM })
    .whereIn("entityType", ["project", "script", "script-version", "shot", "asset", "generation-task", "export-artifact"]);
  const localShotMappings = new Map(
    mappings.filter((item) => item.entityType === "shot").map((item) => [item.externalId, Number(item.localId)]),
  );
  const metadataRows = await activeDatabase("sc_shot_metadata")
    .whereIn("storyboardId", [...localShotMappings.values()])
    .orderBy("sortOrder");
  const metadataById = new Map(metadataRows.map((row) => [Number(row.storyboardId), row]));
  const projectProfile = await activeDatabase("sc_project_profile")
    .where({ projectId: packageRow.internalProjectId })
    .first();
  const artifact = await activeDatabase("sc_export_artifacts")
    .where({ externalProjectId })
    .orderBy("createdAt", "desc")
    .first();
  const continuity = await getMvpContinuityWorkspace(packageRow.internalProjectId, activeDatabase);

  return {
    project: {
      tenantId: snapshot.tenantId,
      organizationId: snapshot.organizationId,
      projectId: snapshot.projectId,
      internalProjectId: packageRow.internalProjectId,
      name: snapshot.creativeBriefSnapshot.merchantName,
      city: snapshot.creativeBriefSnapshot.city,
      address: snapshot.creativeBriefSnapshot.address,
      platform: snapshot.target.platform,
      aspectRatio: snapshot.target.aspectRatio,
      durationSeconds: snapshot.target.durationSeconds,
      agentTemplateCode: snapshot.agentTemplateCode,
      status: projectProfile?.status ?? "canvas_ready",
    },
    package: publicPackage(packageRow),
    script: snapshot.approvedScriptVersion,
    claims: snapshot.brandFactsSnapshot,
    riskRules: snapshot.riskRulesSnapshot,
    shots: snapshot.shotDrafts.map((shot) => {
      const internalId = localShotMappings.get(shot.id);
      const metadata = internalId ? metadataById.get(internalId) : undefined;
      return {
        ...shot,
        internalId,
        imagePrompt: metadata?.imagePrompt ?? shot.description,
        videoPrompt: metadata?.videoPrompt ?? shot.narration,
      };
    }),
    capabilities: snapshot.capabilityGrants.map((item) => item.capabilityId),
    truthManifest: truthManifestJson,
    continuity,
    artifact: artifact ? publicArtifact(artifact) : null,
    mappings: mappings.map((mapping) => ({
      entityType: mapping.entityType,
      externalId: mapping.externalId,
      localId: mapping.localId,
    })),
    links: {
      storycanvasPath: STORYCANVAS_PATH,
      returnPath: CONTROL_PLANE_RETURN_PATH,
    },
  };
}

export async function getProductionPackage(packageId: string, grantValue: unknown) {
  if (packageId !== "package-demo-local-001-v1") {
    throw new ProductionContractError("PACKAGE_SCOPE_MISMATCH", `拒绝非 canonical package ${packageId}`);
  }
  const row = await activeDatabase<PackageRow>("sc_production_packages").where({ packageId }).first();
  if (!row) return null;
  await authorizeAcceptedProject(row.externalProjectId, grantValue, ["production.package.read"]);
  const attempts = await activeDatabase("sc_production_package_attempts")
    .where({ packageId })
    .orderBy("createdAt", "desc");
  return {
    ...publicPackage(row),
    snapshot: parseJson(row.snapshotJson, {}),
    attempts: attempts.map((attempt) => ({
      id: attempt.id,
      status: attempt.status,
      payloadDigest: attempt.payloadDigest,
      errorCode: attempt.errorCode,
      error: parseJson(attempt.errorJson, null),
      createdAt: attempt.createdAt,
    })),
  };
}

export async function listProductionPackageAttempts(filters: {
  externalProjectId: string;
  idempotencyKey?: string;
}, grantValue: unknown) {
  await authorizeAcceptedProject(filters.externalProjectId, grantValue, ["production.package.read"]);
  let query = activeDatabase("sc_production_package_attempts").orderBy("createdAt", "desc");
  query = query.where({ externalProjectId: filters.externalProjectId });
  if (filters.idempotencyKey) query = query.where({ idempotencyKey: filters.idempotencyKey });
  const rows = await query;
  return rows.map((attempt) => ({
    id: attempt.id,
    packageRecordId: attempt.packageRecordId,
    packageId: attempt.packageId,
    packageVersion: attempt.packageVersion,
    contractVersion: attempt.contractVersion,
    tenantId: attempt.tenantId,
    projectId: attempt.externalProjectId,
    idempotencyKey: attempt.idempotencyKey,
    payloadDigest: attempt.payloadDigest,
    sourceSuiteDigest: attempt.sourceSuiteDigest,
    status: attempt.status,
    errorCode: attempt.errorCode,
    error: parseJson(attempt.errorJson, null),
    createdAt: attempt.createdAt,
  }));
}

function publicReceiptOutboxRow(row: Record<string, unknown>) {
  return {
    id: row.id,
    receiptType: row.receiptType,
    businessId: row.businessId,
    idempotencyKey: row.idempotencyKey,
    payloadDigest: row.payloadDigest,
    status: row.status,
    retryCount: Number(row.retryCount),
    deliveryId: row.deliveryId,
    lastAttempt: row.lastAttempt,
    deliveredAt: row.deliveredAt,
    acknowledgedAt: row.acknowledgedAt,
    lastError: parseJson(String(row.lastErrorJson ?? ""), null),
    payload: parseJson(String(row.payloadJson ?? ""), {}),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function listProductionReceipts(
  externalProjectId: string,
  status: "pending" | "delivered" | "acknowledged",
  grantValue: unknown,
) {
  await authorizeAcceptedProject(externalProjectId, grantValue, ["production.receipt.write"]);
  return activeDatabase.transaction(async (transaction) => {
    const rows = await transaction("sc_receipt_outbox")
      .where({ externalProjectId, status })
      .orderBy("createdAt");
    if (status === "acknowledged") return rows.map(publicReceiptOutboxRow);

    const now = new Date().toISOString();
    const deliveredRows = [];
    for (const row of rows) {
      const deliveryId = row.deliveryId || `delivery-${row.id}`;
      const retryCount = status === "delivered" ? Number(row.retryCount) + 1 : Number(row.retryCount);
      const update = {
        status: "delivered",
        retryCount,
        deliveryId,
        lastAttempt: now,
        deliveredAt: row.deliveredAt || now,
        updatedAt: now,
      };
      await transaction("sc_receipt_outbox").where({ id: row.id }).update(update);
      deliveredRows.push({ ...row, ...update });
    }
    return deliveredRows.map(publicReceiptOutboxRow);
  });
}

export async function acknowledgeProductionReceipt(
  receiptId: string,
  grantValue: unknown,
  deliveryId: string,
) {
  const grant = demoProjectGrantSchema.parse(grantValue);
  const { packageRow } = await authorizeAcceptedProject(
    grant.projectId,
    grantValue,
    ["production.receipt.write"],
  );
  return activeDatabase.transaction(async (transaction) => {
    const row = await transaction("sc_receipt_outbox").where({ id: receiptId }).first();
    if (!row) throw new ProductionContractError("RECEIPT_NOT_FOUND", `Outbox receipt ${receiptId} 不存在`);
    if (
      row.externalProjectId !== packageRow.externalProjectId
      || Number(row.projectId) !== Number(packageRow.internalProjectId)
      || row.packageId !== packageRow.packageId
    ) {
      throw new ProductionContractError("RECEIPT_SCOPE_MISMATCH", "Outbox receipt 不属于当前 grant project/package");
    }
    if (row.status === "acknowledged") {
      if (row.deliveryId !== deliveryId) {
        throw new ProductionContractError("DELIVERY_ID_MISMATCH", "重复 ack 的 deliveryId 与原记录不一致");
      }
      return { ...publicReceiptOutboxRow(row), duplicate: true };
    }
    if (row.status !== "delivered") {
      throw new ProductionContractError("RECEIPT_NOT_DELIVERED", "Receipt 必须先由 pending delivery 查询领取");
    }
    if (row.deliveryId !== deliveryId) {
      throw new ProductionContractError("DELIVERY_ID_MISMATCH", "ack deliveryId 与投递记录不一致");
    }
    const now = new Date().toISOString();
    const update = {
      status: "acknowledged",
      acknowledgedAt: now,
      updatedAt: now,
    };
    await transaction("sc_receipt_outbox").where({ id: receiptId }).update(update);
    return { ...publicReceiptOutboxRow({ ...row, ...update }), duplicate: false };
  });
}

export async function listProductionTasks(externalProjectId: string, grantValue: unknown) {
  const { packageRow } = await authorizeAcceptedProject(
    externalProjectId,
    grantValue,
    ["production.package.read"],
  );
  const rows = await activeDatabase("sc_tasks")
    .where({ projectId: packageRow.internalProjectId })
    .where("taskType", "like", "contract_%")
    .orderBy("createdAt");
  return rows.map((row) => {
    const input = parseJson<Record<string, unknown>>(row.inputJson, {});
    return {
      generationTaskId: row.id,
      projectId: externalProjectId,
      shotId: input.externalShotId,
      taskType: input.kind === "image" ? "image.generate" : "video.generate",
      internalTaskType: row.taskType,
      provider: row.provider,
      status: row.status,
      progress: Number(row.progress),
      inputDigest: input.inputDigest,
      truthMode: input.truthMode ?? "MOCK-CONTRACT",
      output: parseJson(row.outputJson, null),
      error: parseJson(row.errorJson, null),
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  });
}

export async function listProductionAssets(externalProjectId: string, grantValue: unknown) {
  const { packageRow } = await authorizeAcceptedProject(
    externalProjectId,
    grantValue,
    ["production.package.read"],
  );
  const rows = await activeDatabase("sc_media_assets")
    .where({ projectId: packageRow.internalProjectId })
    .orderBy("createdAt");
  return rows.map((row) => {
    const metadata = parseJson<Record<string, unknown>>(row.metadataJson, {});
    const storageReference = typeof metadata.storageReference === "string"
      ? metadata.storageReference
      : String(row.localPath).startsWith("demo://")
        ? row.localPath
        : null;
    return {
      assetId: metadata.externalAssetId ?? row.id,
      internalAssetId: row.id,
      projectId: externalProjectId,
      shotId: metadata.externalShotId ?? null,
      type: row.type,
      source: row.source,
      mimeType: row.mimeType,
      dimensions: row.width && row.height ? { width: Number(row.width), height: Number(row.height) } : null,
      checksum: `sha256:${row.sha256}`,
      provider: row.provider,
      storageReference,
      mediaUrl: metadata.mediaUrl,
      byteSize: Number(row.byteSize ?? 0),
      durationSeconds: row.durationMs ? Number(row.durationMs) / 1000 : null,
      rightsNote: row.rightsNote,
      reviewStatus: metadata.reviewStatus ?? (row.source === "fallback" ? "fallback_ready" : "registered"),
      truthMode: metadata.truthMode,
      deliveryClaim: metadata.deliveryClaim,
      technicalQa: metadata.technicalQa,
      editorialQa: metadata.editorialQa,
      brandQa: metadata.brandQa,
      playable: Boolean(metadata.playable),
      rightsSource: metadata.rightsSource,
      thirdPartyAssets: metadata.thirdPartyAssets,
      controlledReference: Boolean(metadata.controlledReference || storageReference?.startsWith("demo://")),
      createdAt: row.createdAt,
    };
  });
}

export async function listProductionArtifacts(externalProjectId: string, grantValue: unknown) {
  await authorizeAcceptedProject(externalProjectId, grantValue, ["production.package.read"]);
  const rows = await activeDatabase("sc_export_artifacts")
    .where({ externalProjectId })
    .orderBy("createdAt");
  return rows.map(publicArtifact);
}

export function getCanonicalD1Fixture() {
  return {
    sourceSuiteDigest: D1_SOURCE_SUITE_DIGEST,
    package: canonicalPackageJson,
    grant: demoProjectGrantSchema.parse(canonicalGrantJson),
    successTaskReceipt: generationTaskReceiptSchema.parse(successTaskReceiptJson),
    successAssetReceipt: assetReceiptSchema.parse(successAssetReceiptJson),
    failureTaskReceipt: generationTaskReceiptSchema.parse(failureTaskReceiptJson),
    truthManifest: truthManifestJson,
  };
}
