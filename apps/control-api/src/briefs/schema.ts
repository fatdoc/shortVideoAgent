import { z } from 'zod';

const briefText = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const uniqueTextList = (maxItems: number, maxLength: number) =>
  z
    .array(briefText(maxLength))
    .max(maxItems)
    .superRefine((items, context) => {
      if (new Set(items).size !== items.length) {
        context.addIssue({ code: z.ZodIssueCode.custom, message: 'values must be unique' });
      }
    });

export const browserSafeBriefFactSchema = z
  .object({
    text: briefText(500),
    sourceReference: briefText(500),
  })
  .strict();

export const browserSafeBriefPayloadSchema = z
  .object({
    objective: briefText(2_000),
    audience: uniqueTextList(20, 200).min(1),
    platforms: uniqueTextList(10, 100).min(1),
    brandFacts: z.array(browserSafeBriefFactSchema).min(1).max(20),
    prohibitedTerms: uniqueTextList(50, 200),
    requiredDisclosures: uniqueTextList(50, 500),
    factsConfirmed: z.literal(true),
  })
  .strict();

export const canonicalBriefPayloadSchema = z
  .object({
    objective: briefText(2_000),
    audience: uniqueTextList(20, 200),
    platforms: uniqueTextList(10, 100).min(1),
    brandPolicySnapshot: z
      .object({
        facts: z
          .array(
            z
              .object({
                factId: z.string().uuid(),
                text: briefText(500),
                sourceReference: briefText(500),
                approved: z.literal(true),
              })
              .strict(),
          )
          .min(1)
          .max(20),
        prohibitedTerms: uniqueTextList(50, 200),
        requiredDisclosures: uniqueTextList(50, 500),
        sourceDigest: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
      })
      .strict(),
  })
  .strict();

export const briefVersionSchema = z
  .object({
    payload: browserSafeBriefPayloadSchema,
  })
  .strict();

export type BrowserSafeBriefPayload = z.infer<typeof browserSafeBriefPayloadSchema>;
export type CanonicalBriefPayload = z.infer<typeof canonicalBriefPayloadSchema>;
