import { z } from "zod";

const environmentVariableNameSchema = z
  .string()
  .regex(/^[A-Z][A-Z0-9_]*$/, "必须是大写环境变量名");

export const modelTargetSchema = z
  .object({
    vendor: z.string().trim().min(1),
    model: z.string().trim().min(1),
    baseUrlEnv: environmentVariableNameSchema,
    apiKeyEnv: environmentVariableNameSchema,
  })
  .strict();

export const modelsConfigSchema = z
  .object({
    version: z.literal(1),
    llm: modelTargetSchema,
    image: z
      .object({
        primary: modelTargetSchema,
        fallback: modelTargetSchema,
      })
      .strict(),
    video: modelTargetSchema,
  })
  .strict();

export type ModelTarget = z.infer<typeof modelTargetSchema>;
export type ModelsConfig = z.infer<typeof modelsConfigSchema>;
export type ModelCapability = "text" | "image" | "video" | "tts";
