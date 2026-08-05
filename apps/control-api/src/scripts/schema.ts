import { z } from 'zod';

export const scriptVersionSchema = z
  .object({
    payload: z.record(z.string(), z.unknown()),
  })
  .strict();
