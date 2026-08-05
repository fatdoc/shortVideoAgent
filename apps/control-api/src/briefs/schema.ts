import { z } from 'zod';

export const briefVersionSchema = z
  .object({
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
