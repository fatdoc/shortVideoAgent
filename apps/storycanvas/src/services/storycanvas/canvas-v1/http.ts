import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { CanvasCommandServiceError, toCanvasHttpError } from "./errors";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const FORBIDDEN_KEYS = new Set([
  "remoteassetid", "asseturi", "groupid", "providerassetid", "providergroupid", "providertaskid",
  "accesstoken", "authorization", "cookie", "grant", "projectgrant", "productionpackage", "packagesnapshot",
  "payloaddigest", "approvedscriptdigest", "approvedstoryboarddigest", "idempotencykey", "internaltoken",
  "credential", "secret", "password", "localpath", "databaseid", "providerrawbody", "providerrawmessage", "userconfirmed",
]);
const FORBIDDEN_VALUES = ["asset://", "bearer ", "x-amz-credential=", "x-amz-signature=", "x-tos-signature=", "access_token="];

export function canvasRequestId(request: Request): string {
  const supplied = request.header("x-request-id");
  return supplied && REQUEST_ID_PATTERN.test(supplied) ? supplied : crypto.randomUUID();
}

export function installCanvasResponseBoundary(request: Request, response: Response, next: NextFunction): void {
  const requestId = canvasRequestId(request);
  response.locals.canvasRequestId = requestId;
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-request-id", requestId);
  response.setHeader("x-content-type-options", "nosniff");
  next();
}

export function sendCanvasError(response: Response, error: unknown): void {
  const safe = toCanvasHttpError(error);
  response.status(safe.status).json({
    error: {
      code: safe.code,
      message: safe.message,
      retryable: safe.retryable,
      requestId: String(response.locals.canvasRequestId || crypto.randomUUID()),
    },
  });
}

export function requireCanvasCsrf(request: Request, response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return next();
  if (request.header("x-storycanvas-csrf") !== "pilot-canvas-v1") {
    sendCanvasError(response, new CanvasCommandServiceError("CANVAS_SESSION_INVALID"));
    return;
  }
  next();
}

function browserPayloadSafe(value: unknown): boolean {
  if (Array.isArray(value)) return value.every(browserPayloadSafe);
  if (!value || typeof value !== "object") {
    return typeof value !== "string" || !FORBIDDEN_VALUES.some((marker) => value.toLowerCase().includes(marker));
  }
  return Object.entries(value).every(([key, child]) =>
    !FORBIDDEN_KEYS.has(key.toLowerCase()) && browserPayloadSafe(child));
}

export function requireCanvasBrowserSafeBody(request: Request, response: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method) || browserPayloadSafe(request.body)) return next();
  sendCanvasError(response, new CanvasCommandServiceError("CANVAS_SCHEMA_INVALID"));
}

export function canvasJsonErrorBoundary(error: unknown, _request: Request, response: Response, next: NextFunction): void {
  if (error && typeof error === "object" && "type" in error
    && ["entity.too.large", "entity.parse.failed"].includes(String((error as { type?: unknown }).type))) {
    sendCanvasError(response, new CanvasCommandServiceError("CANVAS_SCHEMA_INVALID"));
    return;
  }
  next(error);
}

export function asyncCanvasRoute(
  handler: (request: Request, response: Response) => Promise<void>,
) {
  return (request: Request, response: Response, next: NextFunction) => {
    void handler(request, response).catch((error) => {
      if (response.headersSent) return next(error);
      sendCanvasError(response, error);
    });
  };
}
