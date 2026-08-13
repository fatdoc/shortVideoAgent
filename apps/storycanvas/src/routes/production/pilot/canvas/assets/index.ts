import express from "express";

import {
  parseCanvasV1BrowserContract,
  type AssetRecordV01,
  type ShotReadinessV01,
} from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { CanvasCommandServiceError } from "@/services/storycanvas/canvas-v1";
import { asyncCanvasRoute } from "@/services/storycanvas/canvas-v1/http";

export interface CanvasV1AssetRouteService {
  list(scope: CanvasProductionScope): Promise<AssetRecordV01[]>;
  getReadiness(shotId: string, scope: CanvasProductionScope): Promise<ShotReadinessV01 | null>;
}

export interface CanvasV1AssetsRouterOptions {
  resolveRequestScope(request: express.Request): Promise<CanvasProductionScope>;
  assets: CanvasV1AssetRouteService;
}

export function createCanvasV1AssetsRouter(options?: CanvasV1AssetsRouterOptions): express.Router {
  const router = express.Router();
  router.get("/", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    const scope = await options.resolveRequestScope(request);
    const assets = await options.assets.list(scope);
    response.json({
      assets: assets.map((asset) => parseCanvasV1BrowserContract(asset)),
      requestId: response.locals.canvasRequestId,
    });
  }));
  router.get("/readiness/:shotId", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    const scope = await options.resolveRequestScope(request);
    const readiness = await options.assets.getReadiness(String(request.params.shotId), scope);
    if (!readiness) throw new CanvasCommandServiceError("CANVAS_SHOT_NOT_READY");
    response.json({ readiness: parseCanvasV1BrowserContract(readiness), requestId: response.locals.canvasRequestId });
  }));
  return router;
}

export default createCanvasV1AssetsRouter();
