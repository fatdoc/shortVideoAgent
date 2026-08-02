import crypto from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import type { Knex } from "knex";
import {
  assertGrantScope,
  assertPackageContract,
  digestValue,
  type ProjectProductionPackage,
} from "@/domain/productionContract";
import {
  cameraPlanSchema,
  generationPlanSchema,
  phase1ReferenceRoleSchema,
  type CameraPlan,
  type Phase1ReferenceRole,
} from "@/domain/storycanvas";
import {
  defaultPlayableAssetValidator,
  RealRuntimeAdapterDisabled,
  type PlayableAssetValidator,
  type RuntimeProviderAdapter,
  type RuntimeProviderOutput,
  type RuntimeProviderRequest,
} from "./phase1RuntimeAdapter";

const EXTERNAL_SYSTEM = "saas-control-plane";
const REQUIRED_CAPABILITY = "cap-production-base-generation";

function stableUuid(scope: string, value: string) {
  const hash = crypto.createHash("sha256").update(`${scope}:${value}`).digest("hex");
  return [hash.slice(0, 8), hash.slice(8, 12), `4${hash.slice(13, 16)}`, `a${hash.slice(17, 20)}`, hash.slice(20, 32)].join("-");
}

function parseJson<T>(source: unknown, fallback: T): T {
  if (typeof source !== "string" || !source) return fallback;
  try { return JSON.parse(source) as T; } catch { return fallback; }
}

function money(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export class Phase1RuntimeError extends Error {
  constructor(public readonly code: string, message: string, public readonly details: Record<string, unknown> = {}) {
    super(message);
    this.name = "Phase1RuntimeError";
  }
}

interface PackageRow {
  id: string;
  packageId: string;
  packageVersion: number;
  tenantId: string;
  externalProjectId: string;
  internalProjectId: number;
  snapshotJson: string;
  status: string;
}

interface PlanInput {
  imagePrompt: string;
  videoPrompt: string;
  negativePrompt?: string;
  recommendedImageModel?: string | null;
  recommendedVideoModel?: string | null;
  referenceAssetIds?: string[];
  continuityEntityIds?: string[];
  cameraPlan?: Partial<CameraPlan>;
  estimatedCredit: number;
  generatedBy: string;
  idempotencyKey: string;
  approvedByOperator?: string | null;
}

interface CreateTaskInput {
  shotId: string;
  taskType: "image-generation" | "video-generation";
  model: string;
  modelVersion?: string | null;
  idempotencyKey: string;
  reservedCredit: number;
  parameters?: Record<string, unknown>;
  parentAttemptId?: string | null;
}

export class Phase1RuntimeService {
  private readonly now: () => Date;
  private readonly adapter: RuntimeProviderAdapter;
  private readonly validateAsset: PlayableAssetValidator;

  constructor(private readonly database: Knex, options: {
    adapter?: RuntimeProviderAdapter;
    validator?: PlayableAssetValidator;
    clock?: () => Date;
  } = {}) {
    this.adapter = options.adapter ?? new RealRuntimeAdapterDisabled();
    this.validateAsset = options.validator ?? defaultPlayableAssetValidator;
    this.now = options.clock ?? (() => new Date());
  }

  private timestamp() { return this.now().toISOString(); }

  async assertSchemaReady() {
    for (const table of ["sc_production_shots", "sc_generation_plans", "sc_shot_attempts", "sc_runtime_credit_entries", "sc_rough_cuts"]) {
      if (!await this.database.schema.hasTable(table)) {
        throw new Phase1RuntimeError("RUNTIME_SCHEMA_NOT_READY", `Phase1 Runtime 表 ${table} 尚未迁移`);
      }
    }
  }

  private async packageForProject(externalProjectId: string, transaction: Knex | Knex.Transaction = this.database) {
    const row = await transaction<PackageRow>("sc_production_packages")
      .where({ externalProjectId, status: "accepted" })
      .orderBy("acceptedAt", "desc")
      .first();
    if (!row) throw new Phase1RuntimeError("PACKAGE_NOT_ACCEPTED", `项目 ${externalProjectId} 没有 accepted Package`);
    return { row, snapshot: assertPackageContract(parseJson(row.snapshotJson, null)) };
  }

  async authorizeProject(externalProjectId: string, grantValue: unknown, scopes: Array<"production.package.read" | "production.receipt.write">) {
    const context = await this.packageForProject(externalProjectId);
    assertGrantScope(grantValue, context.snapshot, REQUIRED_CAPABILITY, scopes, this.now());
    return context;
  }

  async synchronizeProductionShots(externalProjectId: string) {
    await this.assertSchemaReady();
    return this.database.transaction(async (transaction) => {
      const { row: packageRow, snapshot } = await this.packageForProject(externalProjectId, transaction);
      const now = this.timestamp();
      const cta = snapshot.approvedScriptVersion.blocks.find((block) => block.type === "cta")?.content ?? snapshot.creativeBriefSnapshot.cta;
      const disclaimer = snapshot.approvedScriptVersion.blocks.find((block) => block.type === "disclaimer")?.content ?? "";
      const claimIds = snapshot.approvedScriptVersion.blocks.flatMap((block) => block.claimIds);
      const uniqueClaimIds = [...new Set(claimIds)];
      const records = [];

      for (const draft of [...snapshot.shotDrafts].sort((left, right) => left.order - right.order)) {
        const mapping = await transaction("sc_external_mappings")
          .where({ system: EXTERNAL_SYSTEM, entityType: "shot", externalId: draft.id })
          .first();
        if (!mapping) throw new Phase1RuntimeError("SHOT_MAPPING_MISSING", `缺少稳定 Shot Mapping: ${draft.id}`);
        const storyboardId = Number(mapping.localId);
        const metadata = await transaction("sc_shot_metadata").where({ storyboardId }).first();
        const continuity = await transaction("sc_shot_contracts")
          .where({ projectId: packageRow.internalProjectId, shotId: storyboardId })
          .first();
        const id = stableUuid("phase1-production-shot", `${externalProjectId}:${draft.id}`);
        const lockedBusinessFields = {
          approvedScriptVersionId: snapshot.approvedScriptVersion.id,
          approvedScriptSegment: { narration: draft.narration, screenText: draft.screenText, description: draft.description },
          brandFacts: snapshot.brandFactsSnapshot,
          requiredCTA: cta,
          requiredDisclaimer: disclaimer,
          prohibitedTerms: snapshot.riskRulesSnapshot.prohibitedWords,
          restrictions: snapshot.riskRulesSnapshot.restrictions,
        };
        const editableCreativeFields = {
          visualPrompt: metadata?.imagePrompt ?? draft.description,
          videoPrompt: metadata?.videoPrompt ?? draft.narration,
          framing: draft.shotType,
          cameraAngle: draft.cameraPosition,
          cameraMovement: continuity ? parseJson<Record<string, unknown>>(continuity.cameraJson, {}) : {},
          visualStyle: null,
          modelOptions: {},
        };
        const shotContract = {
          narrativePurpose: draft.description,
          requiredFacts: snapshot.brandFactsSnapshot.map((fact) => fact.text),
          requiredClaims: uniqueClaimIds,
          requiredCTA: cta,
          requiredDisclaimer: disclaimer,
          prohibitedTerms: snapshot.riskRulesSnapshot.prohibitedWords,
          subjects: [draft.description],
          location: snapshot.creativeBriefSnapshot.address,
          action: draft.narration || draft.description,
          framing: draft.shotType,
          cameraAngle: draft.cameraPosition,
          cameraMovement: draft.cameraPosition,
          startState: continuity ? parseJson(continuity.requiredStateJson, {}) : {},
          endState: continuity ? parseJson(continuity.statePatchJson, {}) : {},
          continuityRequirements: continuity ? parseJson(continuity.mustPreserveJson, []) : snapshot.riskRulesSnapshot.restrictions,
          duration: draft.duration,
          aspectRatio: snapshot.target.aspectRatio,
        };
        const existing = await transaction("sc_production_shots").where({ id }).first();
        const values = {
          projectId: packageRow.internalProjectId,
          storyboardId,
          externalProjectId,
          externalStoryboardShotId: draft.id,
          productionPackageId: packageRow.id,
          sequence: draft.order,
          title: draft.description,
          duration: draft.duration,
          approvedScriptSegmentJson: JSON.stringify(lockedBusinessFields.approvedScriptSegment),
          claimIdsJson: JSON.stringify(uniqueClaimIds),
          brandFactIdsJson: JSON.stringify(snapshot.brandFactsSnapshot.map((fact) => fact.id)),
          lockedBusinessFieldsJson: JSON.stringify(lockedBusinessFields),
          shotContractJson: JSON.stringify(shotContract),
          updatedAt: now,
        };
        if (existing) {
          await transaction("sc_production_shots").where({ id }).update(values);
        } else {
          await transaction("sc_production_shots").insert({
            id,
            ...values,
            editableCreativeFieldsJson: JSON.stringify(editableCreativeFields),
            status: "planning",
            selectedAttemptId: null,
            createdAt: now,
          });
        }
        records.push(await transaction("sc_production_shots").where({ id }).first());
      }
      return records.map((record) => this.publicShot(record));
    });
  }

  private publicShot(row: Record<string, any>): any {
    return {
      id: row.id,
      projectId: Number(row.projectId),
      externalProjectId: row.externalProjectId,
      externalStoryboardShotId: row.externalStoryboardShotId,
      productionPackageId: row.productionPackageId,
      sequence: Number(row.sequence),
      title: row.title,
      duration: Number(row.duration),
      approvedScriptSegment: parseJson(row.approvedScriptSegmentJson, {}),
      claimIds: parseJson(row.claimIdsJson, []),
      brandFactIds: parseJson(row.brandFactIdsJson, []),
      lockedBusinessFields: parseJson(row.lockedBusinessFieldsJson, {}),
      editableCreativeFields: parseJson(row.editableCreativeFieldsJson, {}),
      shotContract: parseJson(row.shotContractJson, {}),
      status: row.status,
      selectedAttemptId: row.selectedAttemptId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  async listProjectState(externalProjectId: string) {
    const shots = await this.database("sc_production_shots").where({ externalProjectId }).orderBy("sequence");
    const shotIds = shots.map((shot) => shot.id);
    const plans = shotIds.length ? await this.database("sc_generation_plans").whereIn("productionShotId", shotIds).orderBy(["productionShotId", "planVersion"]) : [];
    const attempts = shotIds.length ? await this.database("sc_shot_attempts").whereIn("productionShotId", shotIds).orderBy(["productionShotId", "attemptNumber"]) : [];
    const tasks = shotIds.length ? await this.database("sc_tasks").whereIn("productionShotId", shotIds).orderBy("createdAt") : [];
    const assets = shotIds.length ? await this.database("sc_media_assets").whereIn("productionShotId", shotIds).orderBy("createdAt") : [];
    const roughCuts = await this.database("sc_rough_cuts").where({ externalProjectId }).orderBy("createdAt");
    const credits = shots[0] ? await this.database("sc_runtime_credit_entries").where({ projectId: shots[0].projectId }).orderBy("createdAt") : [];
    return {
      shots: shots.map((shot) => this.publicShot(shot)),
      plans: plans.map((plan) => this.publicPlan(plan)),
      attempts: attempts.map((attempt) => this.publicAttempt(attempt)),
      tasks: tasks.map((task) => this.publicTask(task)),
      assets: assets.map((asset) => this.publicAsset(asset)),
      roughCuts: roughCuts.map((cut) => this.publicRoughCut(cut)),
      credits,
    };
  }

  async saveGenerationPlan(shotId: string, input: PlanInput) {
    const existing = await this.database("sc_generation_plans").where({ idempotencyKey: input.idempotencyKey }).first();
    if (existing) return { ...this.publicPlan(existing), duplicate: true };
    const shot = await this.database("sc_production_shots").where({ id: shotId }).first();
    if (!shot) throw new Phase1RuntimeError("SHOT_NOT_FOUND", `Production Shot ${shotId} 不存在`);
    const latest = await this.database("sc_generation_plans").where({ productionShotId: shotId }).max<{ max?: number }>("planVersion as max").first();
    const now = this.timestamp();
    const planVersion = Number(latest?.max ?? 0) + 1;
    const id = stableUuid("phase1-generation-plan", `${shotId}:${input.idempotencyKey}`);
    const parsed = generationPlanSchema.parse({
      id,
      shotId,
      planVersion,
      imagePrompt: input.imagePrompt,
      videoPrompt: input.videoPrompt,
      negativePrompt: input.negativePrompt ?? "",
      recommendedImageModel: input.recommendedImageModel ?? null,
      recommendedVideoModel: input.recommendedVideoModel ?? null,
      referenceAssetIds: input.referenceAssetIds ?? [],
      continuityEntityIds: input.continuityEntityIds ?? [],
      cameraPlan: cameraPlanSchema.parse(input.cameraPlan ?? {}),
      estimatedCredit: input.estimatedCredit,
      generatedBy: input.generatedBy,
      status: input.approvedByOperator ? "approved" : "awaiting_confirmation",
      approvedByOperator: input.approvedByOperator ?? null,
      approvedAt: input.approvedByOperator ? now : null,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    await this.database.transaction(async (transaction) => {
      await transaction("sc_generation_plans").where({ productionShotId: shotId, status: "approved" }).update({ status: "superseded", updatedAt: now });
      await transaction("sc_generation_plans").insert({
        id: parsed.id,
        productionShotId: shotId,
        planVersion,
        imagePrompt: parsed.imagePrompt,
        videoPrompt: parsed.videoPrompt,
        negativePrompt: parsed.negativePrompt,
        recommendedImageModel: parsed.recommendedImageModel,
        recommendedVideoModel: parsed.recommendedVideoModel,
        referenceAssetIdsJson: JSON.stringify(parsed.referenceAssetIds),
        continuityEntityIdsJson: JSON.stringify(parsed.continuityEntityIds),
        cameraPlanJson: JSON.stringify(parsed.cameraPlan),
        estimatedCredit: parsed.estimatedCredit,
        generatedBy: parsed.generatedBy,
        status: parsed.status,
        approvedByOperator: parsed.approvedByOperator,
        approvedAt: parsed.approvedAt,
        idempotencyKey: parsed.idempotencyKey,
        createdAt: now,
        updatedAt: now,
      });
      await transaction("sc_production_shots").where({ id: shotId }).update({ status: parsed.status === "approved" ? "ready" : "awaiting_confirmation", updatedAt: now });
    });
    return { ...parsed, duplicate: false };
  }

  async confirmGenerationPlan(shotId: string, planVersion: number, operatorId: string) {
    if (!Number.isInteger(planVersion) || planVersion <= 0) {
      throw new Phase1RuntimeError("PLAN_VERSION_INVALID", "Generation Plan 版本必须为正整数");
    }
    const plan = await this.database("sc_generation_plans")
      .where({ productionShotId: shotId, planVersion })
      .first();
    if (!plan) throw new Phase1RuntimeError("PLAN_NOT_FOUND", `Generation Plan v${planVersion} 不存在`);
    if (plan.status === "approved" && plan.approvedByOperator) {
      return { ...this.publicPlan(plan), duplicate: true };
    }
    const now = this.timestamp();
    await this.database.transaction(async (transaction) => {
      await transaction("sc_generation_plans")
        .where({ productionShotId: shotId, status: "approved" })
        .whereNot({ planVersion })
        .update({ status: "superseded", updatedAt: now });
      await transaction("sc_generation_plans")
        .where({ productionShotId: shotId, planVersion })
        .update({ status: "approved", approvedByOperator: operatorId, approvedAt: now, updatedAt: now });
      await transaction("sc_production_shots")
        .where({ id: shotId })
        .update({ status: "ready", updatedAt: now });
    });
    return {
      ...this.publicPlan(await this.database("sc_generation_plans").where({ productionShotId: shotId, planVersion }).first()),
      duplicate: false,
    };
  }

  private publicPlan(row: Record<string, any>) {
    return {
      id: row.id, shotId: row.productionShotId, planVersion: Number(row.planVersion), imagePrompt: row.imagePrompt,
      videoPrompt: row.videoPrompt, negativePrompt: row.negativePrompt, recommendedImageModel: row.recommendedImageModel,
      recommendedVideoModel: row.recommendedVideoModel, referenceAssetIds: parseJson(row.referenceAssetIdsJson, []),
      continuityEntityIds: parseJson(row.continuityEntityIdsJson, []), cameraPlan: parseJson(row.cameraPlanJson, {}),
      estimatedCredit: money(row.estimatedCredit), generatedBy: row.generatedBy, status: row.status,
      approvedByOperator: row.approvedByOperator, approvedAt: row.approvedAt, idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }

  async updateCreativeFields(shotId: string, patch: Record<string, unknown>) {
    const forbidden = new Set(["price", "prices", "cta", "requiredCTA", "address", "businessHours", "claims", "brandFacts", "prohibitedTerms", "disclaimer", "requiredDisclaimer"]);
    const inspect = (value: unknown, path = "editableCreativeFields") => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return;
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (forbidden.has(key)) throw new Phase1RuntimeError("LOCKED_BUSINESS_FIELD", `${path}.${key} 属于已审批商业事实，production.operator 不得修改`);
        inspect(child, `${path}.${key}`);
      }
    };
    inspect(patch);
    const allowed = new Set([
      "visualPrompt", "imagePrompt", "videoPrompt", "negativePrompt", "framing", "cameraAngle",
      "cameraMovement", "visualStyle", "modelOptions", "imageModel", "videoModel",
    ]);
    const unknown = Object.keys(patch).filter((key) => !allowed.has(key));
    if (unknown.length) throw new Phase1RuntimeError("CREATIVE_FIELD_NOT_ALLOWED", `不可编辑字段：${unknown.join(",")}`);
    const shot = await this.database("sc_production_shots").where({ id: shotId }).first();
    if (!shot) throw new Phase1RuntimeError("SHOT_NOT_FOUND", `Production Shot ${shotId} 不存在`);
    const merged = { ...parseJson(shot.editableCreativeFieldsJson, {}), ...patch };
    await this.database("sc_production_shots").where({ id: shotId }).update({ editableCreativeFieldsJson: JSON.stringify(merged), updatedAt: this.timestamp() });
    return merged;
  }

  async replaceReferences(shotId: string, references: Array<{ assetId?: string | null; referenceRole: Phase1ReferenceRole; sourceUri?: string | null; metadata?: Record<string, unknown> }>) {
    const now = this.timestamp();
    await this.database.transaction(async (transaction) => {
      if (!await transaction("sc_production_shots").where({ id: shotId }).first()) throw new Phase1RuntimeError("SHOT_NOT_FOUND", `Production Shot ${shotId} 不存在`);
      await transaction("sc_shot_references").where({ productionShotId: shotId }).delete();
      if (references.length) await transaction("sc_shot_references").insert(references.map((reference, index) => ({
        id: stableUuid("phase1-shot-reference", `${shotId}:${reference.referenceRole}:${index}`),
        productionShotId: shotId,
        assetId: reference.assetId ?? null,
        referenceRole: phase1ReferenceRoleSchema.parse(reference.referenceRole),
        sourceUri: reference.sourceUri ?? null,
        sortOrder: index,
        metadataJson: JSON.stringify(reference.metadata ?? {}),
        createdAt: now,
      })));
    });
    return this.database("sc_shot_references").where({ productionShotId: shotId }).orderBy("sortOrder");
  }

  private compilePrompt(shot: Record<string, any>, plan: Record<string, any>, taskType: CreateTaskInput["taskType"]) {
    const locked = parseJson<Record<string, unknown>>(shot.lockedBusinessFieldsJson, {});
    const contract = parseJson<Record<string, unknown>>(shot.shotContractJson, {});
    const creative = parseJson<Record<string, unknown>>(shot.editableCreativeFieldsJson, {});
    const requestedPrompt = taskType === "image-generation"
      ? (creative.imagePrompt || creative.visualPrompt || plan.imagePrompt)
      : (creative.videoPrompt || plan.videoPrompt);
    return {
      requestedPrompt,
      resolvedPrompt: [
        `【Approved Business Facts】${JSON.stringify(locked)}`,
        `【Shot Contract】${JSON.stringify(contract)}`,
        `【Visual Continuity】${JSON.stringify({ startState: contract.startState, endState: contract.endState, continuityRequirements: contract.continuityRequirements })}`,
        `【Operator Creative Input】${JSON.stringify(creative)}`,
        `【Generation Plan】${requestedPrompt}`,
      ].join("\n"),
    };
  }

  async createTask(input: CreateTaskInput) {
    const duplicate = await this.database("sc_tasks").where({ idempotencyKey: input.idempotencyKey }).first();
    if (duplicate) return { task: this.publicTask(duplicate), attempt: this.publicAttempt(await this.database("sc_shot_attempts").where({ generationTaskId: duplicate.id }).first()), duplicate: true };
    const shot = await this.database("sc_production_shots").where({ id: input.shotId }).first();
    if (!shot) throw new Phase1RuntimeError("SHOT_NOT_FOUND", `Production Shot ${input.shotId} 不存在`);
    const plan = await this.database("sc_generation_plans").where({ productionShotId: input.shotId, status: "approved" }).orderBy("planVersion", "desc").first();
    if (!plan) throw new Phase1RuntimeError("PLAN_CONFIRMATION_REQUIRED", "制作人员必须先确认 Generation Plan");
    if (this.adapter.mode !== "DEMO") throw new Phase1RuntimeError("REAL_PROVIDER_DISABLED", "本阶段 REAL Runtime Adapter 默认禁用");
    if (input.reservedCredit <= 0) throw new Phase1RuntimeError("CREDIT_RESERVE_INVALID", "reservedCredit 必须大于 0");
    const refs = await this.database("sc_shot_references").where({ productionShotId: input.shotId }).orderBy("sortOrder");
    const currentCount = await this.database("sc_shot_attempts").where({ productionShotId: input.shotId }).count<{ count: number }>("id as count").first();
    const attemptNumber = Number(currentCount?.count ?? 0) + 1;
    const taskId = stableUuid("phase1-runtime-task", input.idempotencyKey);
    const attemptId = stableUuid("phase1-shot-attempt", input.idempotencyKey);
    const now = this.timestamp();
    const prompts = this.compilePrompt(shot, plan, input.taskType);
    const inputAssetIds = refs.map((reference) => reference.assetId).filter(Boolean);
    await this.database.transaction(async (transaction) => {
      await transaction("sc_tasks").insert({
        id: taskId,
        projectId: shot.projectId,
        storyboardId: shot.storyboardId,
        productionShotId: shot.id,
        attemptId,
        taskType: `runtime_${input.taskType.replace("-", "_")}`,
        provider: this.adapter.provider,
        model: input.model,
        modelVersion: input.modelVersion ?? null,
        status: "queued",
        progress: 0,
        requestedPrompt: prompts.requestedPrompt,
        resolvedPrompt: prompts.resolvedPrompt,
        negativePrompt: plan.negativePrompt,
        inputAssetIdsJson: JSON.stringify(inputAssetIds),
        outputAssetIdsJson: "[]",
        inputJson: JSON.stringify({ parameters: input.parameters ?? {}, planId: plan.id, externalShotId: shot.externalStoryboardShotId }),
        outputJson: null,
        errorJson: null,
        idempotencyKey: input.idempotencyKey,
        externalTaskId: null,
        estimatedCost: plan.estimatedCredit,
        actualCost: null,
        reservedCredit: input.reservedCredit,
        consumedCredit: 0,
        releasedCredit: 0,
        runtimeMode: this.adapter.mode,
        createdAt: now,
        updatedAt: now,
      });
      await transaction("sc_shot_attempts").insert({
        id: attemptId,
        productionShotId: shot.id,
        generationTaskId: taskId,
        attemptNumber,
        parentAttemptId: input.parentAttemptId ?? null,
        assetId: null,
        thumbnailAssetId: null,
        promptSnapshotJson: JSON.stringify({ userEditedPrompt: prompts.requestedPrompt, agentPlanPrompt: input.taskType === "image-generation" ? plan.imagePrompt : plan.videoPrompt, resolvedPrompt: prompts.resolvedPrompt, providerPrompt: null }),
        modelSnapshotJson: JSON.stringify({ provider: this.adapter.provider, model: input.model, modelVersion: input.modelVersion ?? null }),
        parameterSnapshotJson: JSON.stringify(input.parameters ?? {}),
        referenceSnapshotJson: JSON.stringify(refs),
        qualityStatus: "pending",
        operatorDecision: "undecided",
        isSelected: false,
        createdAt: now,
        updatedAt: now,
      });
      await this.applyCredit(transaction, { projectId: shot.projectId, taskId, attemptId }, "reserve", input.reservedCredit);
      await transaction("sc_production_shots").where({ id: shot.id }).update({ status: "generating", updatedAt: now });
    });
    return {
      task: this.publicTask(await this.database("sc_tasks").where({ id: taskId }).first()),
      attempt: this.publicAttempt(await this.database("sc_shot_attempts").where({ id: attemptId }).first()),
      duplicate: false,
    };
  }

  async getTask(taskId: string) {
    const task = await this.database("sc_tasks").where({ id: taskId }).first();
    if (!task) throw new Phase1RuntimeError("TASK_NOT_FOUND", `Runtime Task ${taskId} 不存在`);
    return this.publicTask(task);
  }

  async retryTask(taskId: string, idempotencyKey: string) {
    const task = await this.database("sc_tasks").where({ id: taskId }).first();
    const attempt = task ? await this.database("sc_shot_attempts").where({ generationTaskId: taskId }).first() : null;
    if (!task || !attempt) throw new Phase1RuntimeError("TASK_NOT_FOUND", `Runtime Task ${taskId} 不存在`);
    if (!["failed", "cancelled"].includes(task.status)) throw new Phase1RuntimeError("RETRY_NOT_ALLOWED", "只有 failed/cancelled Task 可以重试");
    return this.createTask({
      shotId: task.productionShotId,
      taskType: String(task.taskType).includes("image") ? "image-generation" : "video-generation",
      model: task.model,
      modelVersion: task.modelVersion,
      idempotencyKey,
      reservedCredit: money(task.reservedCredit),
      parameters: parseJson<Record<string, any>>(task.inputJson, {}).parameters ?? {},
      parentAttemptId: attempt.id,
    });
  }

  async startTask(taskId: string) {
    const task = await this.database("sc_tasks").where({ id: taskId }).first();
    if (!task) throw new Phase1RuntimeError("TASK_NOT_FOUND", `Runtime Task ${taskId} 不存在`);
    if (task.status === "succeeded") return { task: this.publicTask(task), duplicate: true };
    if (task.status !== "queued") throw new Phase1RuntimeError("TASK_START_NOT_ALLOWED", `status=${task.status} 不允许启动`);
    const request = this.providerRequest(task);
    let submitted: { providerTaskId: string };
    try {
      submitted = await this.adapter.submit(request);
    } catch (cause) {
      await this.finalizeFailure(
        task,
        "PROVIDER_SUBMIT_FAILED",
        cause instanceof Error ? cause.message : String(cause),
        "failed",
      );
      throw cause;
    }
    const now = this.timestamp();
    await this.database("sc_tasks").where({ id: taskId }).update({ status: "running", progress: 10, externalTaskId: submitted.providerTaskId, startedAt: now, updatedAt: now });
    return { task: this.publicTask(await this.database("sc_tasks").where({ id: taskId }).first()), duplicate: false };
  }

  async pollTask(taskId: string) {
    const task = await this.database("sc_tasks").where({ id: taskId }).first();
    if (!task) throw new Phase1RuntimeError("TASK_NOT_FOUND", `Runtime Task ${taskId} 不存在`);
    if (["succeeded", "failed", "cancelled"].includes(task.status)) return this.publicTask(task);
    if (task.status !== "running" || !task.externalTaskId) throw new Phase1RuntimeError("TASK_NOT_RUNNING", "Task 尚未提交到 Runtime Provider");
    const result = await this.adapter.poll(task.externalTaskId, this.providerRequest(task));
    if (result.status === "running") {
      await this.database("sc_tasks").where({ id: taskId }).update({ progress: result.progress, updatedAt: this.timestamp() });
      return this.publicTask(await this.database("sc_tasks").where({ id: taskId }).first());
    }
    if (result.status === "failed") {
      await this.finalizeFailure(task, result.errorCode, result.errorMessage, "failed");
      return this.publicTask(await this.database("sc_tasks").where({ id: taskId }).first());
    }
    return this.finalizeSuccess(task, result.output);
  }

  async runDemoTask(taskId: string) {
    await this.startTask(taskId);
    return this.pollTask(taskId);
  }

  private providerRequest(task: Record<string, any>): RuntimeProviderRequest {
    return {
      taskId: task.id,
      attemptId: task.attemptId,
      projectId: Number(task.projectId),
      shotId: task.productionShotId,
      taskType: String(task.taskType).includes("image") ? "image-generation" : "video-generation",
      model: task.model,
      resolvedPrompt: task.resolvedPrompt,
      negativePrompt: task.negativePrompt ?? "",
      inputAssetIds: parseJson(task.inputAssetIdsJson, []),
      parameters: parseJson<Record<string, any>>(task.inputJson, {}).parameters ?? {},
    };
  }

  private async finalizeSuccess(task: Record<string, any>, output: RuntimeProviderOutput) {
    const now = this.timestamp();
    await this.database("sc_tasks").where({ id: task.id }).update({ status: "validating", progress: 90, updatedAt: now });
    const validation = await this.validateAsset(output);
    const file = output.localPath ? await stat(output.localPath).catch(() => null) : null;
    const bytes = output.localPath && file?.isFile() ? await readFile(output.localPath) : Buffer.from(output.remoteUrl ?? "");
    const assetId = stableUuid("phase1-runtime-asset", task.id);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    const assetType = String(task.taskType).includes("image") ? "image" : "video";
    const valid = validation.status === "valid" && (assetType !== "video" || validation.playable) && Boolean(output.playableUrl || output.remoteUrl || output.localPath);
    await this.database.transaction(async (transaction) => {
      await transaction("sc_media_assets").insert({
        id: assetId,
        projectId: task.projectId,
        productionShotId: task.productionShotId,
        attemptId: task.attemptId,
        type: assetType,
        source: "mock",
        originalName: output.localPath?.split(/[\\/]/).pop() ?? null,
        mimeType: output.mimeType,
        byteSize: file?.size ?? bytes.length,
        localPath: output.localPath ?? output.remoteUrl ?? "runtime://missing",
        remoteUrl: output.remoteUrl,
        playableUrl: output.playableUrl,
        thumbnailUrl: null,
        thumbnailPath: null,
        durationMs: validation.durationSeconds ? Math.round(validation.durationSeconds * 1000) : null,
        width: validation.width ?? output.width,
        height: validation.height ?? output.height,
        fps: null,
        provider: task.provider,
        prompt: task.resolvedPrompt,
        sha256,
        rightsNote: "PHASE1_DEMO_FIXTURE_ONLY / NOT_A_REAL_PROVIDER_OUTPUT",
        validationStatus: valid ? "valid" : validation.status,
        validationJson: JSON.stringify(validation),
        validatedAt: now,
        metadataJson: JSON.stringify({ ...output.metadata, providerTaskId: output.providerTaskId, sentPrompt: output.sentPrompt, playable: valid }),
        createdAt: now,
      });
      await transaction("sc_shot_attempts").where({ id: task.attemptId }).update({
        assetId,
        qualityStatus: valid ? "valid" : "invalid",
        promptSnapshotJson: JSON.stringify({
          ...parseJson(await transaction("sc_shot_attempts").where({ id: task.attemptId }).first().then((row) => row.promptSnapshotJson), {}),
          providerPrompt: output.sentPrompt,
        }),
        updatedAt: now,
      });
      if (!valid) return;
      const consumed = Math.min(money(task.reservedCredit), Math.max(0, output.actualCredit));
      const remainder = Math.max(0, money(task.reservedCredit) - consumed);
      const creditScope = { projectId: Number(task.projectId), id: String(task.id), attemptId: String(task.attemptId) };
      await this.applyCredit(transaction, creditScope, "consume", consumed);
      if (remainder > 0) await this.applyCredit(transaction, creditScope, "release", remainder);
      await transaction("sc_tasks").where({ id: task.id }).update({
        status: "succeeded",
        progress: 100,
        outputAssetIdsJson: JSON.stringify([assetId]),
        outputJson: JSON.stringify({ assetId, providerTaskId: output.providerTaskId, validation }),
        actualCost: output.actualCredit,
        consumedCredit: consumed,
        releasedCredit: remainder,
        completedAt: now,
        updatedAt: now,
      });
      await transaction("sc_production_shots").where({ id: task.productionShotId }).update({ status: "has_candidates", updatedAt: now });
      await this.enqueueRuntimeReceipts(transaction, { ...task, status: "succeeded", outputAssetIds: [assetId], actualCredit: consumed }, assetId, output, validation);
    });
    if (!valid) {
      await this.finalizeFailure(task, "ASSET_VALIDATION_FAILED", `生成结果未通过可访问/可播放验证：${validation.status}`, "failed", assetId);
    }
    return this.publicTask(await this.database("sc_tasks").where({ id: task.id }).first());
  }

  private async finalizeFailure(task: Record<string, any>, errorCode: string, errorMessage: string, status: "failed" | "cancelled", invalidAssetId?: string) {
    const current = await this.database("sc_tasks").where({ id: task.id }).first();
    if (!current || ["succeeded", "failed", "cancelled"].includes(current.status)) return;
    const releasable = Math.max(0, money(current.reservedCredit) - money(current.consumedCredit) - money(current.releasedCredit));
    const now = this.timestamp();
    await this.database.transaction(async (transaction) => {
      if (releasable > 0) await this.applyCredit(transaction, current, "release", releasable);
      await transaction("sc_tasks").where({ id: current.id }).update({
        status,
        progress: status === "cancelled" ? Number(current.progress) : 100,
        errorCode,
        errorMessage,
        errorJson: JSON.stringify({ code: errorCode, message: errorMessage, retryable: status === "failed" }),
        releasedCredit: money(current.releasedCredit) + releasable,
        completedAt: status === "failed" ? now : null,
        cancelledAt: status === "cancelled" ? now : null,
        updatedAt: now,
      });
      await transaction("sc_shot_attempts").where({ id: current.attemptId }).update({ qualityStatus: invalidAssetId ? "invalid" : "blocked", updatedAt: now });
      await transaction("sc_production_shots").where({ id: current.productionShotId }).update({ status: "blocked", updatedAt: now });
      await this.enqueueRuntimeReceipts(transaction, { ...current, status: "failed", errorCode, errorMessage, actualCredit: 0, outputAssetIds: [] });
    });
  }

  async cancelTask(taskId: string) {
    const task = await this.database("sc_tasks").where({ id: taskId }).first();
    if (!task) throw new Phase1RuntimeError("TASK_NOT_FOUND", `Runtime Task ${taskId} 不存在`);
    if (["succeeded", "failed", "cancelled"].includes(task.status)) return { ...this.publicTask(task), duplicate: true };
    if (task.externalTaskId) await this.adapter.cancel(task.externalTaskId, this.providerRequest(task));
    await this.finalizeFailure(task, "TASK_CANCELLED", "制作人员取消生成任务", "cancelled");
    return { ...this.publicTask(await this.database("sc_tasks").where({ id: taskId }).first()), duplicate: false };
  }

  private async applyCredit(transaction: Knex.Transaction, task: { projectId: number; id?: string; taskId?: string; attemptId: string }, operation: "reserve" | "consume" | "release", amount: number) {
    if (amount <= 0) return;
    const taskId = task.id ?? task.taskId!;
    const idempotencyKey = `phase1-credit:${taskId}:${operation}`;
    if (await transaction("sc_runtime_credit_entries").where({ idempotencyKey }).first()) return;
    await transaction("sc_runtime_credit_entries").insert({
      id: stableUuid("phase1-credit-entry", idempotencyKey),
      projectId: task.projectId,
      taskId,
      attemptId: task.attemptId,
      operation,
      amount,
      unit: "AI_VIDEO_CREDIT",
      idempotencyKey,
      metadataJson: JSON.stringify({ taskId, attemptId: task.attemptId }),
      createdAt: this.timestamp(),
    });
  }

  private async enqueueRuntimeReceipts(
    transaction: Knex.Transaction,
    task: Record<string, any>,
    assetId?: string,
    output?: RuntimeProviderOutput,
    validation?: Awaited<ReturnType<PlayableAssetValidator>>,
  ) {
    const shot = await transaction("sc_production_shots").where({ id: task.productionShotId }).first();
    const { row: packageRow } = await this.packageForProject(shot.externalProjectId, transaction);
    const now = this.timestamp();
    const taskPayload = {
      contractVersion: "0.1",
      generationTaskId: task.id,
      tenantId: packageRow.tenantId,
      projectId: packageRow.externalProjectId,
      shotId: shot.externalStoryboardShotId,
      taskType: String(task.taskType).includes("image") ? "image.generate" : "video.generate",
      capabilityId: REQUIRED_CAPABILITY,
      provider: task.provider,
      model: task.model,
      status: task.status === "succeeded" ? "succeeded" : "failed",
      progress: 100,
      inputDigest: digestValue({ prompt: task.resolvedPrompt, references: parseJson(task.inputAssetIdsJson, []) }),
      referenceAssetIds: parseJson(task.inputAssetIdsJson, []),
      reservationReference: `phase1-credit:${task.id}:reserve`,
      actualCredits: task.status === "succeeded" ? { value: Math.round(task.actualCredit), unit: "AI_VIDEO_CREDIT", dataMode: "DEMO", quoteStatus: "NON_QUOTE", label: "演示数据 · 非正式报价" } : null,
      outputAssetIds: task.outputAssetIds ?? [],
      error: task.status === "succeeded" ? null : { code: task.errorCode, message: task.errorMessage, retryable: task.errorCode !== "TASK_CANCELLED", details: {} },
      createdAt: task.createdAt,
      startedAt: task.startedAt ?? task.createdAt,
      completedAt: now,
      idempotencyKey: `phase1-task-receipt:${task.id}`,
      truthMode: "MOCK-CONTRACT",
    };
    await this.enqueueReceipt(transaction, packageRow, "task", task.id, taskPayload.idempotencyKey, taskPayload);
    if (assetId && output && validation?.status === "valid" && validation.playable) {
      const asset = await transaction("sc_media_assets").where({ id: assetId }).first();
      const assetPayload = {
        contractVersion: "0.1",
        assetId,
        tenantId: packageRow.tenantId,
        projectId: packageRow.externalProjectId,
        shotId: shot.externalStoryboardShotId,
        type: asset.type,
        mimeType: asset.mimeType,
        dimensions: { width: Number(asset.width), height: Number(asset.height) },
        durationSeconds: Number(asset.durationMs) / 1000,
        checksum: `sha256:${asset.sha256}`,
        source: task.provider,
        model: task.model,
        generationTaskId: task.id,
        promptDigest: digestValue(output.sentPrompt),
        storageReference: asset.localPath,
        rightsNote: asset.rightsNote,
        reviewStatus: "registered",
        version: 1,
        idempotencyKey: `phase1-asset-receipt:${assetId}`,
        createdAt: now,
        truthMode: "MOCK-CONTRACT",
      };
      await this.enqueueReceipt(transaction, packageRow, "asset", assetId, assetPayload.idempotencyKey, assetPayload);
    }
  }

  private async enqueueReceipt(transaction: Knex.Transaction, packageRow: PackageRow, receiptType: string, businessId: string, idempotencyKey: string, payload: unknown) {
    const existing = await transaction("sc_receipt_outbox").where({ receiptType, businessId }).first();
    if (existing) return existing;
    const now = this.timestamp();
    const payloadDigest = digestValue(payload);
    const row = {
      id: stableUuid("phase1-receipt", `${receiptType}:${businessId}`),
      projectId: packageRow.internalProjectId,
      externalProjectId: packageRow.externalProjectId,
      packageId: packageRow.packageId,
      receiptType,
      businessId,
      idempotencyKey,
      payloadDigest,
      payloadJson: JSON.stringify(payload),
      status: "pending",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await transaction("sc_receipt_outbox").insert(row);
    return row;
  }

  async decideAttempt(shotId: string, attemptId: string, decision: "selected" | "alternative" | "rejected") {
    const attempt = await this.database("sc_shot_attempts").where({ id: attemptId, productionShotId: shotId }).first();
    if (!attempt) throw new Phase1RuntimeError("ATTEMPT_NOT_FOUND", `Shot Attempt ${attemptId} 不存在`);
    if (decision === "selected") {
      const asset = attempt.assetId ? await this.database("sc_media_assets").where({ id: attempt.assetId }).first() : null;
      if (!asset || asset.validationStatus !== "valid" || asset.type !== "video" || !asset.playableUrl) {
        throw new Phase1RuntimeError("ATTEMPT_NOT_SELECTABLE", "只有 valid 且可播放的视频 Attempt 可以被采用");
      }
    }
    const now = this.timestamp();
    await this.database.transaction(async (transaction) => {
      if (decision === "selected") {
        await transaction("sc_shot_attempts").where({ productionShotId: shotId, isSelected: true }).update({ isSelected: false, operatorDecision: "alternative", updatedAt: now });
      }
      await transaction("sc_shot_attempts").where({ id: attemptId }).update({ operatorDecision: decision, isSelected: decision === "selected", updatedAt: now });
      if (decision === "selected") await transaction("sc_production_shots").where({ id: shotId }).update({ selectedAttemptId: attemptId, status: "selected", updatedAt: now });
      if (decision !== "selected") {
        const shot = await transaction("sc_production_shots").where({ id: shotId }).first();
        if (shot?.selectedAttemptId === attemptId) await transaction("sc_production_shots").where({ id: shotId }).update({ selectedAttemptId: null, status: "has_candidates", updatedAt: now });
      }
    });
    return this.publicAttempt(await this.database("sc_shot_attempts").where({ id: attemptId }).first());
  }

  async createRoughCut(externalProjectId: string, idempotencyKey: string) {
    const duplicate = await this.database("sc_rough_cuts").where({ idempotencyKey }).first();
    if (duplicate) return { ...this.publicRoughCut(duplicate), duplicate: true };
    const shots = await this.database("sc_production_shots").where({ externalProjectId }).orderBy("sequence");
    if (shots.length !== 8) throw new Phase1RuntimeError("ROUGH_CUT_SHOT_COUNT_INVALID", `主成片要求 8 镜，当前 ${shots.length} 镜`);
    const selections = [];
    for (const shot of shots) {
      if (!shot.selectedAttemptId) throw new Phase1RuntimeError("ROUGH_CUT_SELECTION_MISSING", `镜头 ${shot.externalStoryboardShotId} 尚未选择版本`);
      const attempt = await this.database("sc_shot_attempts").where({ id: shot.selectedAttemptId, isSelected: true }).first();
      const asset = attempt?.assetId ? await this.database("sc_media_assets").where({ id: attempt.assetId }).first() : null;
      if (!attempt || !asset || asset.validationStatus !== "valid" || asset.type !== "video" || !asset.playableUrl) {
        throw new Phase1RuntimeError("ROUGH_CUT_ASSET_INVALID", `镜头 ${shot.externalStoryboardShotId} 没有 valid 可播放视频`);
      }
      selections.push({ shotId: shot.id, externalShotId: shot.externalStoryboardShotId, attemptId: attempt.id, taskId: attempt.generationTaskId, assetId: asset.id, sequence: Number(shot.sequence), duration: Number(asset.durationMs) / 1000 });
    }
    const { row: packageRow, snapshot } = await this.packageForProject(externalProjectId);
    const now = this.timestamp();
    const id = stableUuid("phase1-rough-cut", idempotencyKey);
    await this.database("sc_rough_cuts").insert({
      id,
      projectId: packageRow.internalProjectId,
      externalProjectId,
      productionPackageId: packageRow.id,
      orderedShotSelectionsJson: JSON.stringify(selections),
      totalDuration: selections.reduce((sum, selection) => sum + selection.duration, 0),
      aspectRatio: snapshot.target.aspectRatio,
      previewAssetId: null,
      approvalStatus: "awaiting_tenant_approval",
      idempotencyKey,
      createdAt: now,
      updatedAt: now,
    });
    return { ...this.publicRoughCut(await this.database("sc_rough_cuts").where({ id }).first()), duplicate: false };
  }

  async approveRoughCut(roughCutId: string, actor: { id: string; role: string }) {
    if (actor.role !== "tenant.owner") throw new Phase1RuntimeError("TENANT_APPROVAL_REQUIRED", "只有 tenant.owner 可以确认粗剪");
    const roughCut = await this.database("sc_rough_cuts").where({ id: roughCutId }).first();
    if (!roughCut) throw new Phase1RuntimeError("ROUGH_CUT_NOT_FOUND", `RoughCut ${roughCutId} 不存在`);
    const now = this.timestamp();
    await this.database("sc_rough_cuts").where({ id: roughCutId }).update({ approvalStatus: "approved", approvedBy: actor.id, approvedAt: now, updatedAt: now });
    return this.publicRoughCut(await this.database("sc_rough_cuts").where({ id: roughCutId }).first());
  }

  async createExportArtifact(roughCutId: string, assetId: string, options: { exportType?: "main" | "platform_variant"; platformVariant?: string } = {}) {
    const roughCut = await this.database("sc_rough_cuts").where({ id: roughCutId }).first();
    if (!roughCut || roughCut.approvalStatus !== "approved") throw new Phase1RuntimeError("ROUGH_CUT_APPROVAL_REQUIRED", "企业确认粗剪后才能导出");
    const asset = await this.database("sc_media_assets").where({ id: assetId, projectId: roughCut.projectId }).first();
    if (!asset || asset.validationStatus !== "valid" || asset.type !== "video" || !asset.playableUrl) throw new Phase1RuntimeError("EXPORT_ASSET_INVALID", "Export Receipt 必须引用 valid 可播放导出资产");
    const { row: packageRow, snapshot } = await this.packageForProject(roughCut.externalProjectId);
    const selections = parseJson<Array<Record<string, unknown>>>(roughCut.orderedShotSelectionsJson, []);
    const attempts = await this.database("sc_shot_attempts").whereIn("id", selections.map((item) => String(item.attemptId)));
    const tasks = await this.database("sc_tasks").whereIn("id", attempts.map((item) => item.generationTaskId));
    const credits = await this.database("sc_runtime_credit_entries").whereIn("taskId", tasks.map((item) => item.id));
    const profile = await this.database("sc_project_profile").where({ projectId: packageRow.internalProjectId }).first();
    if (!profile?.currentScriptVersionId) throw new Phase1RuntimeError("SCRIPT_VERSION_MISSING", "导出来源链缺少批准脚本版本");
    const exportType = options.exportType ?? "main";
    const platformVariant = options.platformVariant ?? "primary";
    const id = stableUuid("phase1-export-artifact", `${roughCutId}:${exportType}:${platformVariant}`);
    const now = this.timestamp();
    const manifest = { exportType, platformVariant, aspectRatio: roughCut.aspectRatio, totalDuration: Number(roughCut.totalDuration), orderedShotSelections: selections, assetId };
    const provenance = {
      projectId: roughCut.externalProjectId,
      briefDigest: digestValue(snapshot.creativeBriefSnapshot),
      approvedScriptId: snapshot.approvedScriptVersion.id,
      storyboardShotIds: snapshot.shotDrafts.map((shot) => shot.id),
      packageId: packageRow.packageId,
      packageDigest: snapshot.digest,
      shots: selections,
      attempts: attempts.map((attempt) => this.publicAttempt(attempt)),
      tasks: tasks.map((task) => this.publicTask(task)),
      generatedAssetIds: attempts.map((attempt) => attempt.assetId),
      roughCutId,
      exportAssetId: assetId,
      creditLedger: credits,
      brandFactIds: snapshot.brandFactsSnapshot.map((fact) => fact.id),
    };
    const existing = await this.database("sc_export_artifacts").where({ id }).first();
    if (!existing) {
      await this.database.transaction(async (transaction) => {
        await transaction("sc_export_artifacts").insert({
          id,
          projectId: packageRow.internalProjectId,
          externalProjectId: packageRow.externalProjectId,
          packageId: packageRow.packageId,
          scriptVersionId: profile.currentScriptVersionId,
          taskId: null,
          assetId,
          timelineVersionId: null,
          roughCutId,
          exportType,
          platformVariant,
          mode: "PHASE1_PRIMARY",
          status: "succeeded",
          storageReference: asset.localPath,
          checksum: `sha256:${asset.sha256}`,
          sourceChainJson: JSON.stringify(provenance),
          manifestJson: JSON.stringify(manifest),
          provenanceJson: JSON.stringify(provenance),
          approvedAt: roughCut.approvedAt,
          createdAt: now,
        });
        const receipt = {
          contractVersion: "0.1",
          receiptType: "export",
          exportId: id,
          exportArtifactId: id,
          tenantId: packageRow.tenantId,
          projectId: packageRow.externalProjectId,
          packageId: packageRow.packageId,
          status: "succeeded",
          outputAssetIds: [assetId],
          checksum: `sha256:${asset.sha256}`,
          shotIds: snapshot.shotDrafts.map((shot) => shot.id),
          mode: "PHASE1_PRIMARY",
          truthMode: "MOCK-CONTRACT",
          playable: true,
          mediaPath: asset.localPath,
          mediaUrl: asset.playableUrl,
          createdAt: now,
          idempotencyKey: `phase1-export-receipt:${id}`,
          provenance,
        };
        await this.enqueueReceipt(transaction, packageRow, "export", id, receipt.idempotencyKey, receipt);
      });
    }
    const row = await this.database("sc_export_artifacts").where({ id }).first();
    return { ...row, manifest: parseJson(row.manifestJson, {}), provenance: parseJson(row.provenanceJson, {}), duplicate: Boolean(existing) };
  }

  private publicTask(row: Record<string, any>): any {
    if (!row) return null;
    return {
      id: row.id, shotId: row.productionShotId, attemptId: row.attemptId, taskType: row.taskType,
      provider: row.provider, model: row.model, modelVersion: row.modelVersion, providerTaskId: row.externalTaskId,
      requestedPrompt: row.requestedPrompt, resolvedPrompt: row.resolvedPrompt, negativePrompt: row.negativePrompt,
      inputAssetIds: parseJson(row.inputAssetIdsJson, []), outputAssetIds: parseJson(row.outputAssetIdsJson, []),
      status: row.status, progress: Number(row.progress), errorCode: row.errorCode, errorMessage: row.errorMessage,
      idempotencyKey: row.idempotencyKey, reservedCredit: money(row.reservedCredit), consumedCredit: money(row.consumedCredit),
      releasedCredit: money(row.releasedCredit), createdAt: row.createdAt, startedAt: row.startedAt, completedAt: row.completedAt,
    };
  }

  private publicAttempt(row: Record<string, any>): any {
    if (!row) return null;
    return {
      id: row.id, shotId: row.productionShotId, generationTaskId: row.generationTaskId,
      attemptNumber: Number(row.attemptNumber), parentAttemptId: row.parentAttemptId, assetId: row.assetId,
      thumbnailAssetId: row.thumbnailAssetId, promptSnapshot: parseJson(row.promptSnapshotJson, {}),
      modelSnapshot: parseJson(row.modelSnapshotJson, {}), parameterSnapshot: parseJson(row.parameterSnapshotJson, {}),
      referenceSnapshot: parseJson(row.referenceSnapshotJson, []), qualityStatus: row.qualityStatus,
      operatorDecision: row.operatorDecision, isSelected: Boolean(row.isSelected), createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }

  private publicAsset(row: Record<string, any>): any {
    return {
      id: row.id, projectId: Number(row.projectId), shotId: row.productionShotId, attemptId: row.attemptId,
      assetType: row.type, sourceType: row.source, provider: row.provider, localPath: row.localPath,
      remoteUrl: row.remoteUrl, playableUrl: row.playableUrl, thumbnailUrl: row.thumbnailUrl, mimeType: row.mimeType,
      width: row.width ? Number(row.width) : null, height: row.height ? Number(row.height) : null,
      duration: row.durationMs ? Number(row.durationMs) / 1000 : null, sha256: row.sha256, size: Number(row.byteSize),
      rightsNote: row.rightsNote, validationStatus: row.validationStatus, validation: parseJson(row.validationJson, {}), createdAt: row.createdAt,
    };
  }

  private publicRoughCut(row: Record<string, any>): any {
    return {
      id: row.id, projectId: Number(row.projectId), externalProjectId: row.externalProjectId,
      orderedShotSelections: parseJson(row.orderedShotSelectionsJson, []), totalDuration: Number(row.totalDuration),
      aspectRatio: row.aspectRatio, previewAssetId: row.previewAssetId, approvalStatus: row.approvalStatus,
      approvedBy: row.approvedBy, approvedAt: row.approvedAt, idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }
}
