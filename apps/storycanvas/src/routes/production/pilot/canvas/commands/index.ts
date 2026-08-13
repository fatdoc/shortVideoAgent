import express from "express";

import { parseCanvasV1BrowserContract, type CanvasEventV01 } from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import type { CanvasCommandService } from "@/services/storycanvas/canvas-v1";
import {
  asyncCanvasRoute,
  canvasJsonErrorBoundary,
  installCanvasResponseBoundary,
  requireCanvasBrowserSafeBody,
  requireCanvasCsrf,
} from "@/services/storycanvas/canvas-v1/http";
import {
  createCanvasV1AssetsRouter,
  type CanvasV1AssetRouteService,
} from "../assets";
import {
  createCanvasV1DocumentsRouter,
  type CanvasV1DocumentRouteService,
} from "../documents";

export interface CanvasV1ProductionRouterOptions {
  resolveRequestScope(request: express.Request): Promise<CanvasProductionScope>;
  commandService: Pick<CanvasCommandService, "execute">;
  assets: CanvasV1AssetRouteService;
  documents: CanvasV1DocumentRouteService;
  bodyLimit?: string | number;
}

export function createCanvasV1CommandsRouter(
  service?: Pick<CanvasCommandService, "execute">,
): express.Router {
  const router = express.Router();
  router.post("/", asyncCanvasRoute(async (request, response) => {
    if (!service) {
      const { CanvasCommandServiceError } = await import("@/services/storycanvas/canvas-v1");
      throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    }
    const event: CanvasEventV01 = await service.execute(request.body);
    response.status(event.replayed ? 200 : 202).json({
      event: parseCanvasV1BrowserContract(event),
      requestId: response.locals.canvasRequestId,
    });
  }));
  return router;
}

export function createCanvasV1ProductionRouter(options?: CanvasV1ProductionRouterOptions): express.Router {
  const router = express.Router();
  router.use(installCanvasResponseBoundary);
  router.use(express.json({ limit: options?.bodyLimit ?? "256kb", strict: true }));
  router.use(canvasJsonErrorBoundary);
  router.use(requireCanvasBrowserSafeBody);
  router.use(requireCanvasCsrf);
  router.use("/assets", createCanvasV1AssetsRouter(options ? {
    resolveRequestScope: options.resolveRequestScope,
    assets: options.assets,
  } : undefined));
  router.use("/commands", createCanvasV1CommandsRouter(options?.commandService));
  router.use("/documents", createCanvasV1DocumentsRouter(options ? {
    resolveRequestScope: options.resolveRequestScope,
    documents: options.documents,
  } : undefined));
  return router;
}

export default createCanvasV1ProductionRouter();
