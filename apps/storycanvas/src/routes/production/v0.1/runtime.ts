import path from "node:path";
import express from "express";
import type { Request, Response } from "express";
import type { Knex } from "knex";
import { error, success } from "@/lib/responseFormat";
import { db } from "@/utils/db";
import { Phase1RuntimeError, Phase1RuntimeService } from "@/services/storycanvas/phase1Runtime";
import { DemoFixtureRuntimeAdapter, RealRuntimeAdapterDisabled } from "@/services/storycanvas/phase1RuntimeAdapter";

const router = express.Router();
const mode = process.env.STORYCANVAS_RUNTIME_MODE === "REAL" ? "REAL" : "DEMO";
const adapter = mode === "REAL"
  ? new RealRuntimeAdapterDisabled()
  : new DemoFixtureRuntimeAdapter({
      fixturePath: process.env.STORYCANVAS_DEMO_VIDEO_FIXTURE
        ?? path.resolve(process.cwd(), "../../public/media/d1/demo-local-001-fallback-synthetic-v1.mp4"),
      outputDirectory: process.env.STORYCANVAS_DEMO_OUTPUT_DIR ?? path.join(process.cwd(), "data", "oss", "phase1-runtime"),
      playableBaseUrl: process.env.STORYCANVAS_DEMO_PLAYABLE_BASE_URL ?? "http://localhost:10588/oss/phase1-runtime",
    });
const runtime = new Phase1RuntimeService(db as Knex, { adapter });

function grant(req: Request) {
  if (req.body?.grant) return req.body.grant;
  const encoded = req.header("x-storycanvas-demo-grant");
  if (!encoded) throw new Phase1RuntimeError("EXPLICIT_GRANT_REQUIRED", "必须提交 body.grant 或 X-StoryCanvas-Demo-Grant");
  try { return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
  catch { throw new Phase1RuntimeError("GRANT_HEADER_INVALID", "Grant Header 不是有效 base64url JSON"); }
}

function respond(res: Response, cause: unknown) {
  const runtimeError = cause instanceof Phase1RuntimeError
    ? cause
    : new Phase1RuntimeError("PHASE1_RUNTIME_ERROR", cause instanceof Error ? cause.message : String(cause));
  const status = runtimeError.code.includes("NOT_FOUND") ? 404
    : runtimeError.code.includes("REQUIRED") || runtimeError.code.includes("LOCKED") || runtimeError.code.includes("ALLOWED") ? 403
      : runtimeError.code.includes("DISABLED") || runtimeError.code.includes("NOT_READY") ? 503
        : 422;
  res.status(status).send(error(runtimeError.message, { code: runtimeError.code, details: runtimeError.details }));
}

router.post("/projects/:projectId/sync", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.synchronizeProductionShots(req.params.projectId)));
  } catch (cause) { respond(res, cause); }
});

router.get("/projects/:projectId/state", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.listProjectState(req.params.projectId)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/plans/demo", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    await runtime.synchronizeProductionShots(req.params.projectId);
    const state = await runtime.listProjectState(req.params.projectId);
    const plans = [];
    for (const shot of state.shots) {
      const contract = shot.shotContract ?? {};
      const purpose = contract.narrativePurpose || shot.title;
      const cameraMovement = typeof contract.cameraMovement === "string"
        ? contract.cameraMovement
        : contract.cameraMovement?.movementType || contract.cameraMovement?.type || "";
      plans.push(await runtime.saveGenerationPlan(shot.id, {
        imagePrompt: `${shot.title}。画面目标：${purpose}`,
        videoPrompt: `${shot.title}。镜头动作：${contract.action || purpose}。运镜：${cameraMovement || "保持分镜要求"}`,
        negativePrompt: Array.isArray(contract.prohibitedTerms) ? contract.prohibitedTerms.join("，") : "",
        recommendedImageModel: "demo-image-disabled",
        recommendedVideoModel: "storycanvas-demo-fixture-v1",
        referenceAssetIds: [],
        continuityEntityIds: [],
        cameraPlan: { movementType: cameraMovement || null },
        estimatedCredit: 120,
        generatedBy: "phase1-demo-planner",
        idempotencyKey: `phase1-demo-plan:${req.params.projectId}:${shot.id}:v2`,
      }));
    }
    res.status(201).send(success({ mode: "DEMO", plans }));
  } catch (cause) { respond(res, cause); }
});

router.put("/projects/:projectId/shots/:shotId/creative", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.updateCreativeFields(req.params.shotId, req.body?.patch ?? {})));
  } catch (cause) { respond(res, cause); }
});

router.put("/projects/:projectId/shots/:shotId/references", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.replaceReferences(req.params.shotId, req.body?.references ?? [])));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/shots/:shotId/plans", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(201).send(success(await runtime.saveGenerationPlan(req.params.shotId, req.body)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/shots/:shotId/plans/:planVersion/confirm", async (req, res) => {
  try {
    const grantValue = grant(req) as { subject?: { id?: string } };
    await runtime.authorizeProject(req.params.projectId, grantValue, ["production.package.read"]);
    res.status(200).send(success(await runtime.confirmGenerationPlan(
      req.params.shotId,
      Number(req.params.planVersion),
      grantValue.subject?.id ?? "production.operator",
    )));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/shots/:shotId/tasks", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read", "production.receipt.write"]);
    res.status(201).send(success(await runtime.createTask({ ...req.body, shotId: req.params.shotId })));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/tasks/:taskId/run", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.receipt.write"]);
    res.status(200).send(success(await runtime.runDemoTask(req.params.taskId)));
  } catch (cause) { respond(res, cause); }
});

router.get("/projects/:projectId/tasks/:taskId", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.getTask(req.params.taskId)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/tasks/:taskId/poll", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.receipt.write"]);
    res.status(200).send(success(await runtime.pollTask(req.params.taskId)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/tasks/:taskId/cancel", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.receipt.write"]);
    res.status(200).send(success(await runtime.cancelTask(req.params.taskId)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/tasks/:taskId/retry", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.receipt.write"]);
    res.status(201).send(success(await runtime.retryTask(req.params.taskId, req.body?.idempotencyKey)));
  } catch (cause) { respond(res, cause); }
});

router.put("/projects/:projectId/shots/:shotId/attempts/:attemptId/decision", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.decideAttempt(req.params.shotId, req.params.attemptId, req.body?.decision)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/rough-cuts", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(201).send(success(await runtime.createRoughCut(req.params.projectId, req.body?.idempotencyKey)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/rough-cuts/:roughCutId/approve", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.package.read"]);
    res.status(200).send(success(await runtime.approveRoughCut(req.params.roughCutId, req.body?.actor)));
  } catch (cause) { respond(res, cause); }
});

router.post("/projects/:projectId/rough-cuts/:roughCutId/export", async (req, res) => {
  try {
    await runtime.authorizeProject(req.params.projectId, grant(req), ["production.receipt.write"]);
    res.status(201).send(success(await runtime.createExportArtifact(req.params.roughCutId, req.body?.assetId, req.body?.options)));
  } catch (cause) { respond(res, cause); }
});

export default router;
