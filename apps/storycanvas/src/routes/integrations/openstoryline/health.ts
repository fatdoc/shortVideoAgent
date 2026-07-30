import express from "express";
import { OpenStorylineClient } from "@/integrations/openstoryline";
import { success } from "@/lib/responseFormat";

const router = express.Router();

export default router.get("/", async (_req, res) => {
  const client = new OpenStorylineClient();
  const health = await client.healthCheck();

  return res.status(200).send(success(health));
});

