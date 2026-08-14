import express from "express";

import { parseCanvasV1BrowserContract, type CanvasBootstrapV01 } from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { CanvasCommandServiceError } from "@/services/storycanvas/canvas-v1";
import { asyncCanvasRoute } from "@/services/storycanvas/canvas-v1/http";

export interface CanvasV1FormalBootstrapRouterOptions {
  resolveRequestScope(request: express.Request, response?: express.Response): Promise<CanvasProductionScope>;
  prepare(scope: CanvasProductionScope, requestId: string): Promise<CanvasBootstrapV01>;
}

function assertBodylessGet(request: express.Request): void {
  if (request.headers["content-length"] || request.headers["transfer-encoding"]) {
    throw new CanvasCommandServiceError("CANVAS_SCHEMA_INVALID");
  }
}

export function createCanvasV1FormalBootstrapRouter(
  options?: CanvasV1FormalBootstrapRouterOptions,
): express.Router {
  const router = express.Router();
  router.get("/", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    assertBodylessGet(request);
    const scope = await options.resolveRequestScope(request, response);
    const bootstrap = await options.prepare(scope, String(response.locals.canvasRequestId));
    response.json(parseCanvasV1BrowserContract(bootstrap));
  }));
  return router;
}

export default createCanvasV1FormalBootstrapRouter();
