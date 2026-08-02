import express from "express";
import type { Request, Response } from "express";
import { error, success } from "@/lib/responseFormat";
import { ProductionContractError } from "@/domain/productionContract";
import runtimeRouter from "./runtime";
import {
  acceptProductionPackage,
  acknowledgeProductionReceipt,
  getCanonicalD1Fixture,
  getProductionPackage,
  getProductionProject,
  listProductionArtifacts,
  listProductionAssets,
  listProductionPackageAttempts,
  listProductionReceipts,
  listProductionTasks,
  registerFallbackExport,
  runDeterministicDemoScenario,
} from "@/services/storycanvas/productionContractAdapter";

const router = express.Router();

router.use("/runtime", runtimeRouter);

function explicitGrantFromHeader(req: Request) {
  const encoded = req.header("x-storycanvas-demo-grant");
  if (!encoded) {
    throw new ProductionContractError(
      "EXPLICIT_GRANT_REQUIRED",
      "必须通过 X-StoryCanvas-Demo-Grant 提交 base64url(JSON grant)",
    );
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
  } catch {
    throw new ProductionContractError("GRANT_HEADER_INVALID", "X-StoryCanvas-Demo-Grant 不是有效 base64url JSON");
  }
}

function respondWithContractError(res: Response, cause: unknown) {
  const contractError = cause instanceof ProductionContractError
    ? cause
    : new ProductionContractError("PRODUCTION_ADAPTER_ERROR", cause instanceof Error ? cause.message : String(cause));
  const status = contractError.code.includes("CONFLICT")
    ? 409
    : contractError.code.includes("SCOPE")
      || contractError.code.includes("ENTITLED")
      || contractError.code.includes("GRANT")
      || contractError.code === "PACKAGE_EXPIRED"
      ? 403
      : contractError.code.includes("NOT_FOUND") || contractError.code === "PACKAGE_NOT_ACCEPTED"
        ? 404
        : 422;
  res.status(status).send(error(contractError.message, {
    code: contractError.code,
    details: contractError.details,
  }));
}

router.get("/demo/fixture", (_req, res) => {
  try {
    res.status(200).send(success(getCanonicalD1Fixture()));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.post("/demo/bootstrap", (_req, res) => {
  res.status(410).send(error(
    "本仓自举已禁用；请由控制平面显式 POST /packages 提交 package + 当前 grant",
    { code: "LEGACY_BOOTSTRAP_DISABLED", status: "rejected", deepLink: null },
  ));
});

router.post("/packages", async (req, res) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};
    if (!("package" in body) || !("grant" in body)) {
      throw new ProductionContractError(
        "EXPLICIT_GRANT_REQUIRED",
        "POST /packages 必须提交 body { package, grant }",
      );
    }
    const packageValue = body.package;
    const grantValue = body.grant;
    const requestedCapabilityId = typeof body.requestedCapabilityId === "string"
      ? body.requestedCapabilityId
      : undefined;
    const accepted = await acceptProductionPackage(packageValue, grantValue, requestedCapabilityId);
    res.status(accepted.duplicate ? 200 : 201).send(success(accepted, accepted.duplicate ? "幂等重放" : "生产包已接受"));
  } catch (cause) {
    const contractError = cause instanceof ProductionContractError
      ? cause
      : new ProductionContractError("PACKAGE_REJECTED", cause instanceof Error ? cause.message : String(cause));
    const status = contractError.code.includes("CONFLICT") ? 409
      : contractError.code.includes("GRANT")
        || contractError.code.includes("SCOPE")
        || contractError.code === "PACKAGE_EXPIRED"
        || contractError.code === "PACKAGE_NOT_YET_VALID"
        ? 403
        : 422;
    res.status(status).send(error(contractError.message, {
      code: contractError.code,
      status: "rejected",
      result: "rejected",
      deepLink: null,
      details: contractError.details,
    }));
  }
});

router.get("/packages/:packageId", async (req, res) => {
  try {
    const result = await getProductionPackage(req.params.packageId, explicitGrantFromHeader(req));
    if (!result) {
      res.status(404).send(error("生产包不存在", { code: "PACKAGE_NOT_FOUND" }));
      return;
    }
    res.status(200).send(success(result));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/package-attempts", async (req, res) => {
  try {
    if (typeof req.query.projectId !== "string") {
      throw new ProductionContractError("PROJECT_SCOPE_MISMATCH", "projectId query 必填");
    }
    res.status(200).send(success(await listProductionPackageAttempts({
      externalProjectId: req.query.projectId,
      idempotencyKey: typeof req.query.idempotencyKey === "string" ? req.query.idempotencyKey : undefined,
    }, explicitGrantFromHeader(req))));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/projects/:projectId", async (req, res) => {
  try {
    res.status(200).send(success(await getProductionProject(
      req.params.projectId,
      explicitGrantFromHeader(req),
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/projects/:projectId/entry", async (req, res) => {
  try {
    const project = await getProductionProject(req.params.projectId, explicitGrantFromHeader(req));
    res.status(200).send(success({
      projectId: project.project.projectId,
      packageId: project.package.packageId,
      packageVersion: project.package.packageVersion,
      digest: project.package.digest,
      storycanvasPath: project.links.storycanvasPath,
      returnPath: project.links.returnPath,
    }));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.post("/projects/:projectId/demo-provider/:scenario", async (req, res) => {
  try {
    if (req.params.scenario !== "success" && req.params.scenario !== "failure") {
      throw new ProductionContractError("DEMO_SCENARIO_NOT_FOUND", "scenario 只能是 success 或 failure");
    }
    if (!req.body?.grant) {
      throw new ProductionContractError("EXPLICIT_GRANT_REQUIRED", "Demo Provider 必须显式提交 body.grant");
    }
    const grantValue = req.body.grant;
    const result = await runDeterministicDemoScenario(
      req.params.projectId,
      req.params.scenario,
      grantValue,
    );
    res.status(200).send(success(result, result.duplicate ? "回执幂等重放" : "确定性 Demo 场景完成"));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/projects/:projectId/receipts", async (req, res) => {
  try {
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    if (!["pending", "delivered", "acknowledged"].includes(status)) {
      throw new ProductionContractError("OUTBOX_STATUS_INVALID", `不支持 status=${status}`);
    }
    res.status(200).send(success(await listProductionReceipts(
      req.params.projectId,
      status as "pending" | "delivered" | "acknowledged",
      explicitGrantFromHeader(req),
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/projects/:projectId/tasks", async (req, res) => {
  try {
    res.status(200).send(success(await listProductionTasks(
      req.params.projectId,
      explicitGrantFromHeader(req),
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/projects/:projectId/assets", async (req, res) => {
  try {
    res.status(200).send(success(await listProductionAssets(
      req.params.projectId,
      explicitGrantFromHeader(req),
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.post("/projects/:projectId/fallback-export", async (req, res) => {
  try {
    if (!req.body?.grant) {
      throw new ProductionContractError("EXPLICIT_GRANT_REQUIRED", "FALLBACK export 必须显式提交 body.grant");
    }
    res.status(201).send(success(
      await registerFallbackExport(req.params.projectId, req.body.grant),
      "本地合成 FALLBACK Demo 已登记；技术播放 QA passed，编辑/品牌 QA 未评估且仅限 DEMO_ONLY",
    ));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/projects/:projectId/artifacts", async (req, res) => {
  try {
    res.status(200).send(success(await listProductionArtifacts(
      req.params.projectId,
      explicitGrantFromHeader(req),
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.get("/receipts", async (req, res) => {
  try {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : "";
    const status = typeof req.query.status === "string" ? req.query.status : "pending";
    if (!projectId) throw new ProductionContractError("PROJECT_SCOPE_MISMATCH", "projectId query 必填");
    if (!["pending", "delivered", "acknowledged"].includes(status)) {
      throw new ProductionContractError("OUTBOX_STATUS_INVALID", `不支持 status=${status}`);
    }
    res.status(200).send(success(await listProductionReceipts(
      projectId,
      status as "pending" | "delivered" | "acknowledged",
      explicitGrantFromHeader(req),
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

router.post("/receipts/:id/ack", async (req, res) => {
  try {
    if (!req.body?.grant) {
      throw new ProductionContractError("EXPLICIT_GRANT_REQUIRED", "Receipt ack 必须显式提交 body.grant");
    }
    if (typeof req.body.deliveryId !== "string" || !req.body.deliveryId.trim()) {
      throw new ProductionContractError("DELIVERY_ID_REQUIRED", "Receipt ack 必须提交 deliveryId");
    }
    res.status(200).send(success(await acknowledgeProductionReceipt(
      req.params.id,
      req.body.grant,
      req.body.deliveryId,
    )));
  } catch (cause) {
    respondWithContractError(res, cause);
  }
});

export default router;
