import express from "express";

import { parseCanvasV1BrowserContract, type CanvasDocumentV01 } from "@/contracts/canvas-v1";
import type { CanvasProductionScope } from "@/services/storycanvas/assets-v1";
import { CanvasCommandServiceError } from "@/services/storycanvas/canvas-v1";
import { asyncCanvasRoute } from "@/services/storycanvas/canvas-v1/http";

export interface CanvasV1DocumentRouteService {
  read(input: { scope: CanvasProductionScope; documentId: string }): Promise<CanvasDocumentV01 | null>;
  create(input: {
    scope: CanvasProductionScope;
    documentId: string;
    shots: CanvasDocumentV01["shots"];
    playlist: CanvasDocumentV01["playlist"];
  }): Promise<CanvasDocumentV01>;
}

export interface CanvasV1DocumentsRouterOptions {
  resolveRequestScope(request: express.Request): Promise<CanvasProductionScope>;
  documents: CanvasV1DocumentRouteService;
}

export function createCanvasV1DocumentsRouter(options?: CanvasV1DocumentsRouterOptions): express.Router {
  const router = express.Router();
  router.get("/:documentId", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    const scope = await options.resolveRequestScope(request);
    const document = await options.documents.read({ scope, documentId: String(request.params.documentId) });
    if (!document) throw new CanvasCommandServiceError("CANVAS_DOCUMENT_VERSION_CONFLICT");
    response.json({ document: parseCanvasV1BrowserContract(document), requestId: response.locals.canvasRequestId });
  }));
  router.post("/", asyncCanvasRoute(async (request, response) => {
    if (!options) throw new CanvasCommandServiceError("CANVAS_CAPABILITY_UNAVAILABLE");
    const body = request.body as Partial<Pick<CanvasDocumentV01, "documentId" | "shots" | "playlist">>;
    if (!body || typeof body.documentId !== "string" || !Array.isArray(body.shots) || !body.playlist) {
      throw new CanvasCommandServiceError("CANVAS_SCHEMA_INVALID");
    }
    const scope = await options.resolveRequestScope(request);
    const document = await options.documents.create({
      scope,
      documentId: body.documentId,
      shots: body.shots,
      playlist: body.playlist,
    });
    response.status(201).json({ document: parseCanvasV1BrowserContract(document), requestId: response.locals.canvasRequestId });
  }));
  return router;
}

export default createCanvasV1DocumentsRouter();
