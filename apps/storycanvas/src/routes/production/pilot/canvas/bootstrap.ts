import express from "express";
import crypto from "node:crypto";
import {
  PilotCanvasAuthorityRegistry,
  PilotCanvasRedemptionClient,
  PilotCanvasRedemptionError,
  createControlApiSessionVerifier,
  createPilotCanvasSafeBootstrapRouter,
} from "@/services/storycanvas/pilotCanvasCapability";

const router = express.Router();
let delegate: express.Router | null = null;
let blockedCode = "PILOT_CANVAS_CAPABILITY_BLOCKED";

function loadDelegate(): express.Router | null {
  if (delegate) return delegate;
  if (process.env.STORYCANVAS_PILOT_CANVAS_ENABLED !== "true") return null;
  try {
    const controlApiBaseUrl = process.env.CONTROL_API_BASE_URL?.trim() ?? "";
    const internalToken = process.env.PRODUCTION_PLANE_INTERNAL_TOKEN?.trim() ?? "";
    const allowedOrigin = process.env.STORYCANVAS_PILOT_ALLOWED_ORIGIN?.trim() ?? "";
    const authorityRegistry = new PilotCanvasAuthorityRegistry(new PilotCanvasRedemptionClient({
      controlApiBaseUrl,
      internalToken,
    }));
    delegate = createPilotCanvasSafeBootstrapRouter({
      allowedOrigin,
      verifySession: createControlApiSessionVerifier({ controlApiBaseUrl }),
      redeem: (entry) => authorityRegistry.openEntry(entry),
    });
    return delegate;
  } catch (error) {
    blockedCode = error instanceof PilotCanvasRedemptionError
      ? error.code
      : "PILOT_CANVAS_CONFIGURATION_ERROR";
    return null;
  }
}

router.use((request, response, next) => {
  const active = loadDelegate();
  if (active) {
    active(request, response, next);
    return;
  }
  const suppliedRequestId = request.header("x-request-id");
  const requestId = suppliedRequestId && /^[A-Za-z0-9._:-]{1,128}$/.test(suppliedRequestId)
    ? suppliedRequestId
    : crypto.randomUUID();
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-request-id", requestId);
  response.status(503).json({
    error: {
      code: blockedCode,
      message: "Pilot Canvas capability is not ready.",
      retryable: false,
      requestId,
    },
  });
});

export default router;
