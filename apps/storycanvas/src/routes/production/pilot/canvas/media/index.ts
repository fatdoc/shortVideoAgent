import { Readable } from "node:stream";
import express from "express";

import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { CanvasCommandServiceError } from "@/services/storycanvas/canvas-v1";
import type {
  CanvasV1ControlledMediaOpenInput,
  CanvasV1ControlledMediaOutput,
} from "@/services/storycanvas/canvas-v1/controlledMedia";
import { asyncCanvasRoute } from "@/services/storycanvas/canvas-v1/http";

export interface CanvasV1MediaRouteService {
  open(input: CanvasV1ControlledMediaOpenInput): Promise<CanvasV1ControlledMediaOutput>;
}

export interface CanvasV1MediaRouterOptions {
  resolveRequestScope(request: express.Request, response?: express.Response): Promise<CanvasProductionScope>;
  media: CanvasV1MediaRouteService;
}

export function createCanvasV1MediaRouter(options?: CanvasV1MediaRouterOptions): express.Router {
  const router = express.Router();
  router.get("/:assetId/preview", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    const scope = await options.resolveRequestScope(request, response);
    const output = await options.media.open({
      scope,
      assetId: String(request.params.assetId),
      range: request.header("range") ?? undefined,
    });
    response.status(output.status);
    response.setHeader("content-type", output.contentType);
    response.setHeader("accept-ranges", output.acceptRanges);
    response.setHeader("content-disposition", "inline");
    response.setHeader("content-security-policy", "default-src 'none'; sandbox");
    if (output.contentLength !== undefined) response.setHeader("content-length", String(output.contentLength));
    if (output.contentRange) response.setHeader("content-range", output.contentRange);
    await new Promise<void>((resolve, reject) => {
      const stream = Readable.fromWeb(output.body as never);
      stream.once("error", reject);
      response.once("finish", resolve);
      response.once("close", resolve);
      stream.pipe(response);
    });
  }));
  return router;
}

export default createCanvasV1MediaRouter();
