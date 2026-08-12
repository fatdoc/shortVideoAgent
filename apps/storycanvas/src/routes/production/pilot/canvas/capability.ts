import express from "express";
import { getPilotCanvasRuntimeCapability } from "@/services/storycanvas/pilotCanvasCapability";

const router = express.Router();

router.get("/", async (_request, response) => {
  const capability = await getPilotCanvasRuntimeCapability();
  response.setHeader("cache-control", "no-store");
  response.status(capability.status === "ready" ? 200 : 503).json(capability);
});

export default router;
