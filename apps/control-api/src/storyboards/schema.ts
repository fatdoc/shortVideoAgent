import { z } from 'zod';

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sha256DigestPattern = /^sha256:[0-9a-f]{64}$/;
const canonicalTimestampPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const stableIdentityPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const contractVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const semanticVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;
const issueCodePattern = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;

const canonicalUuidSchema = z.string().regex(canonicalUuidPattern);
const sha256DigestSchema = z.string().regex(sha256DigestPattern);
const canonicalTimestampSchema = z
  .string()
  .regex(canonicalTimestampPattern)
  .refine((value) => {
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
  });
const stableIdentitySchema = z.string().min(1).max(80).regex(stableIdentityPattern);

export const storyboardShotSchema = z
  .object({
    shotId: canonicalUuidSchema,
    sequence: z.number().int().positive().max(10_000),
    description: z
      .string()
      .min(1)
      .max(4_000)
      .refine((value) => value.trim() === value),
    durationSeconds: z.number().positive().max(3_600).multipleOf(0.001),
    sourceMode: z.enum(['uploaded', 'generated', 'mixed']),
  })
  .strict();

export const storyboardSourceReceiptSchema = z
  .object({
    providerId: stableIdentitySchema,
    sourceSystem: stableIdentitySchema,
    sourceContractVersion: z.string().max(32).regex(contractVersionPattern),
    commandId: canonicalUuidSchema,
    receiptId: canonicalUuidSchema,
    receiptDigest: sha256DigestSchema,
    receivedAt: canonicalTimestampSchema,
  })
  .strict();

export const storyboardGenerationPolicySchema = z
  .object({
    policyId: stableIdentitySchema,
    policyVersion: z.string().max(32).regex(semanticVersionPattern),
  })
  .strict();

export const storyboardValidationSummarySchema = z
  .object({
    status: z.enum(['passed', 'warnings']),
    issueCodes: z.array(z.string().min(1).max(120).regex(issueCodePattern)).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === 'passed' && value.issueCodes.length > 0) {
      context.addIssue({
        code: 'custom',
        path: ['issueCodes'],
        message: 'passed validation cannot contain issue codes',
      });
    }
    if (value.status === 'warnings' && value.issueCodes.length === 0) {
      context.addIssue({
        code: 'custom',
        path: ['issueCodes'],
        message: 'warnings validation requires issue codes',
      });
    }
    if (new Set(value.issueCodes).size !== value.issueCodes.length) {
      context.addIssue({
        code: 'custom',
        path: ['issueCodes'],
        message: 'issue codes must be unique',
      });
    }
    const sorted = [...value.issueCodes].sort();
    if (sorted.some((code, index) => code !== value.issueCodes[index])) {
      context.addIssue({
        code: 'custom',
        path: ['issueCodes'],
        message: 'issue codes must use canonical lexical order',
      });
    }
  });

export const storyboardDraftRevisionUnsignedSchema = z
  .object({
    objectType: z.literal('StoryboardDraftRevision'),
    contractVersion: z.literal('0.2'),
    status: z.literal('draft'),
    tenantId: canonicalUuidSchema,
    projectId: canonicalUuidSchema,
    approvedScriptVersionId: canonicalUuidSchema,
    approvedScriptDigest: sha256DigestSchema,
    draftRevisionId: canonicalUuidSchema,
    revisionNumber: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    previousRevisionId: canonicalUuidSchema.nullable(),
    shots: z.array(storyboardShotSchema).min(1).max(500),
    sourceReceipt: storyboardSourceReceiptSchema,
    generationPolicy: storyboardGenerationPolicySchema,
    validationSummary: storyboardValidationSummarySchema,
    createdAt: canonicalTimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.revisionNumber === 1 && value.previousRevisionId !== null) {
      context.addIssue({
        code: 'custom',
        path: ['previousRevisionId'],
        message: 'first revision cannot have a previous revision',
      });
    }
    if (value.revisionNumber > 1 && value.previousRevisionId === null) {
      context.addIssue({
        code: 'custom',
        path: ['previousRevisionId'],
        message: 'subsequent revision requires a previous revision',
      });
    }
    if (value.previousRevisionId === value.draftRevisionId) {
      context.addIssue({
        code: 'custom',
        path: ['previousRevisionId'],
        message: 'revision cannot reference itself',
      });
    }

    const shotIds = new Set<string>();
    value.shots.forEach((shot, index) => {
      if (shotIds.has(shot.shotId)) {
        context.addIssue({
          code: 'custom',
          path: ['shots', index, 'shotId'],
          message: 'shot IDs must be unique',
        });
      }
      shotIds.add(shot.shotId);
      if (shot.sequence !== index + 1) {
        context.addIssue({
          code: 'custom',
          path: ['shots', index, 'sequence'],
          message: 'shot sequence must be contiguous and ordered',
        });
      }
    });

    if (Date.parse(value.sourceReceipt.receivedAt) > Date.parse(value.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['sourceReceipt', 'receivedAt'],
        message: 'receipt cannot be received after draft creation',
      });
    }
  });

export const storyboardDraftRevisionSchema = storyboardDraftRevisionUnsignedSchema.safeExtend({
  payloadDigest: sha256DigestSchema,
});

export type StoryboardShot = z.infer<typeof storyboardShotSchema>;
export type StoryboardSourceReceipt = z.infer<typeof storyboardSourceReceiptSchema>;
export type StoryboardGenerationPolicy = z.infer<typeof storyboardGenerationPolicySchema>;
export type StoryboardValidationSummary = z.infer<typeof storyboardValidationSummarySchema>;
export type StoryboardDraftRevisionUnsigned = z.infer<typeof storyboardDraftRevisionUnsignedSchema>;
export type StoryboardDraftRevision = z.infer<typeof storyboardDraftRevisionSchema>;
