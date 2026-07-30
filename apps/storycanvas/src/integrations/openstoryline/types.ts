import { z } from "zod";
import {
  openStorylineClientConfigSchema,
  openStorylineHealthSchema,
} from "./schemas";

export type OpenStorylineClientConfig = z.infer<typeof openStorylineClientConfigSchema>;
export type OpenStorylineHealth = z.infer<typeof openStorylineHealthSchema>;

