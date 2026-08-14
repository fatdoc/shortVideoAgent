import express from "express";

import type { CanvasWorkspaceV01 } from "@/contracts/canvas-v1/workspaceMaterialization";
import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { CanvasCommandServiceError } from "@/services/storycanvas/canvas-v1";
import { asyncCanvasRoute } from "@/services/storycanvas/canvas-v1/http";

export interface CanvasV1WorkspaceRouterOptions {
  resolveRequestScope(request: express.Request, response?: express.Response): Promise<CanvasProductionScope>;
  read(scope: CanvasProductionScope, requestId: string): Promise<CanvasWorkspaceV01>;
}

export function createCanvasV1WorkspaceRouter(options?: CanvasV1WorkspaceRouterOptions): express.Router {
  const router = express.Router();
  router.get("/", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    if (request.headers["content-length"] || request.headers["transfer-encoding"]) {
      throw new CanvasCommandServiceError("CANVAS_SCHEMA_INVALID");
    }
    const scope = await options.resolveRequestScope(request, response);
    response.json(await options.read(scope, String(response.locals.canvasRequestId)));
  }));
  return router;
}

export default createCanvasV1WorkspaceRouter();
