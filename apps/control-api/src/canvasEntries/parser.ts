import { z } from 'zod';
import { contractPayloadDigest, tokenDigest } from '../production/digest.js';
import { productionCapabilities, productionScopes } from '../production/types.js';
import { canvasEntryError } from './errors.js';
import {
  CANVAS_ENTRY_CONTRACT_VERSION,
  CANVAS_ENTRY_MAX_TTL_SECONDS,
  CANVAS_ENTRY_MIN_TTL_SECONDS,
  CANVAS_ENTRY_REDEMPTION_CONTRACT_VERSION,
  type CanvasEntryBinding,
  type CanvasEntryPublicDto,
  type CanvasEntryRedemptionValue,
  type CreateCanvasEntryCommand,
  type RedeemCanvasEntryInput,
  type RedeemCanvasEntryResult,
} from './types.js';

const uuidSchema = z.string().uuid();
const digestSchema = z.string().regex(/^sha256:[a-f0-9]{64}$/);
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const redeemedBySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/);
const handleSchema = z.string().regex(/^ce_[A-Za-z0-9_-]{32,64}$/);
const canonicalTimestampSchema = z.string().refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
});
const nonEmptyStringSchema = z
  .string()
  .min(1)
  .refine((value) => value.trim().length > 0);
const accessTokenSchema = z.string().regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);

const bindingFields = {
  tenantId: uuidSchema,
  projectId: uuidSchema,
  packageId: uuidSchema,
} as const;

const bindingSchema = z.object(bindingFields).strict();
const createCommandSchema = z
  .object({
    ...bindingFields,
    idempotencyKey: idempotencyKeySchema,
    ttlSeconds: z
      .number()
      .int()
      .min(CANVAS_ENTRY_MIN_TTL_SECONDS)
      .max(CANVAS_ENTRY_MAX_TTL_SECONDS),
  })
  .strict();
const publicDtoSchema = z
  .object({
    objectType: z.literal('CanvasEntry'),
    contractVersion: z.literal(CANVAS_ENTRY_CONTRACT_VERSION),
    handle: handleSchema,
    ...bindingFields,
    state: z.literal('active'),
    issuedAt: canonicalTimestampSchema,
    expiresAt: canonicalTimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const lifetimeMilliseconds =
      new Date(value.expiresAt).getTime() - new Date(value.issuedAt).getTime();
    if (
      lifetimeMilliseconds < CANVAS_ENTRY_MIN_TTL_SECONDS * 1000 ||
      lifetimeMilliseconds > CANVAS_ENTRY_MAX_TTL_SECONDS * 1000 ||
      lifetimeMilliseconds % 1000 !== 0
    ) {
      context.addIssue({
        code: 'custom',
        path: ['expiresAt'],
        message: 'Canvas Entry lifetime is outside the frozen boundary.',
      });
    }
  });

const forbiddenKey = (key: string): boolean => {
  const normalized = key.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  return (
    normalized === 'grant' ||
    normalized === 'rawgrant' ||
    normalized === 'projectgrant' ||
    normalized === 'productiongrant' ||
    normalized === 'authorization' ||
    normalized === 'proxyauthorization' ||
    normalized === 'cookie' ||
    normalized === 'setcookie' ||
    normalized === 'tokendigest' ||
    normalized === 'signedurl' ||
    normalized === 'presignedurl' ||
    normalized === 'credential' ||
    normalized === 'credentials' ||
    normalized === 'apikey' ||
    normalized === 'signingkey' ||
    normalized === 'privatekey' ||
    normalized === 'providerpayload' ||
    normalized === 'providerrequest' ||
    normalized === 'providerresponse' ||
    normalized === 'providerbody' ||
    normalized === 'token' ||
    normalized.endsWith('token') ||
    normalized.includes('secret') ||
    normalized.includes('password') ||
    normalized.includes('passphrase')
  );
};

const forbiddenString = (value: string): boolean =>
  /^Bearer\s+\S+/i.test(value) ||
  /^[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}\.[A-Za-z0-9_-]{3,}$/.test(value) ||
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(value) ||
  /(?:[?&](?:x-[a-z0-9-]*signature|x-[a-z0-9-]*credential|x-[a-z0-9-]*security-token|signature|credential|security-token)=)/i.test(
    value,
  ) ||
  /\b(?:sk|rk|pk)_(?:live|test)_[A-Za-z0-9_-]{8,}\b/.test(value);

function schemaInvalid(fieldPaths: string[] = []): never {
  throw canvasEntryError(
    'CANVAS_ENTRY_SCHEMA_INVALID',
    'Canvas Entry payload violated the strict contract.',
    fieldPaths.length > 0 ? { fieldPaths } : {},
  );
}

function pointerSegment(value: string): string {
  return value.replace(/~/g, '~0').replace(/\//g, '~1');
}

export function assertNonSecretBrowserPayload(input: unknown): void {
  const ancestors = new WeakSet<object>();

  const visit = (value: unknown, path: string): void => {
    if (typeof value === 'string') {
      if (forbiddenString(value)) schemaInvalid([path || '/']);
      return;
    }
    if (
      value === null ||
      typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))
    ) {
      return;
    }
    if (Array.isArray(value)) {
      if (ancestors.has(value)) schemaInvalid([path || '/']);
      ancestors.add(value);
      value.forEach((item, index) => visit(item, `${path}/${index}`));
      ancestors.delete(value);
      return;
    }
    if (typeof value === 'object') {
      if (ancestors.has(value)) schemaInvalid([path || '/']);
      ancestors.add(value);
      for (const [key, nested] of Object.entries(value)) {
        const nestedPath = `${path}/${pointerSegment(key)}`;
        if (forbiddenKey(key)) schemaInvalid([nestedPath]);
        visit(nested, nestedPath);
      }
      ancestors.delete(value);
      return;
    }
    schemaInvalid([path || '/']);
  };

  visit(input, '');
}

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fieldPaths = parsed.error.issues
      .map((issue) => `/${issue.path.map((part) => pointerSegment(String(part))).join('/')}`)
      .filter((path, index, paths) => paths.indexOf(path) === index)
      .slice(0, 20);
    schemaInvalid(fieldPaths);
  }
  return parsed.data;
}

function addBindingIssue(
  context: z.core.$RefinementCtx<unknown>,
  path: PropertyKey[],
  message: string,
): void {
  context.addIssue({ code: 'custom', path, message });
}

const capabilitySchema = z.enum(productionCapabilities);
const scopeSchema = z.enum(productionScopes);
const capabilityArraySchema = z
  .array(capabilitySchema)
  .min(1)
  .max(productionCapabilities.length)
  .refine((value) => new Set(value).size === value.length, 'Capabilities must be unique.');
const scopeArraySchema = z
  .array(scopeSchema)
  .min(1)
  .max(productionScopes.length)
  .refine((value) => new Set(value).size === value.length, 'Scopes must be unique.');
const nonEmptyStringArraySchema = z.array(nonEmptyStringSchema);

const brandPolicySchema = z
  .object({
    facts: z.array(
      z
        .object({
          factId: nonEmptyStringSchema,
          text: nonEmptyStringSchema,
          sourceReference: nonEmptyStringSchema,
          approved: z.literal(true),
        })
        .strict(),
    ),
    prohibitedTerms: nonEmptyStringArraySchema,
    requiredDisclosures: nonEmptyStringArraySchema,
    sourceDigest: digestSchema,
  })
  .strict();

const storyboardShotSchema = z
  .object({
    shotId: nonEmptyStringSchema,
    sequence: z.number().int().positive(),
    description: nonEmptyStringSchema,
    durationSeconds: z.number().positive(),
    sourceMode: z.enum(['uploaded', 'generated', 'mixed']),
  })
  .strict();

const productionPackageV03Schema = z
  .object({
    objectType: z.literal('ProjectProductionPackage'),
    contractVersion: z.literal('0.3'),
    status: z.literal('ready'),
    ...bindingFields,
    idempotencyKey: idempotencyKeySchema,
    occurredAt: canonicalTimestampSchema,
    payloadDigest: digestSchema,
    packageVersion: z.number().int().positive(),
    organizationId: uuidSchema,
    scriptVersionId: uuidSchema,
    storyboardVersionId: uuidSchema,
    approvedScriptDigest: digestSchema,
    approvedStoryboardDigest: digestSchema,
    briefSnapshot: z
      .object({
        briefVersionId: uuidSchema,
        objective: nonEmptyStringSchema,
        audience: nonEmptyStringArraySchema.min(1),
        platforms: nonEmptyStringArraySchema.min(1),
      })
      .strict(),
    brandPolicySnapshot: brandPolicySchema,
    approvedScript: z
      .object({
        scriptVersionId: uuidSchema,
        payloadDigest: digestSchema,
        content: nonEmptyStringSchema,
        approvedAt: canonicalTimestampSchema,
        approvedBy: uuidSchema,
      })
      .strict(),
    approvedStoryboard: z
      .object({
        storyboardVersionId: uuidSchema,
        scriptVersionId: uuidSchema,
        scriptPayloadDigest: digestSchema,
        payloadDigest: digestSchema,
        approvedAt: canonicalTimestampSchema,
        approvedBy: uuidSchema,
      })
      .strict(),
    storyboard: z.array(storyboardShotSchema).min(1),
    target: z
      .object({
        aspectRatio: nonEmptyStringSchema,
        durationSeconds: z.number().positive(),
        container: z.literal('mp4'),
        videoCodec: z.literal('h264'),
      })
      .strict(),
    capabilityRequirements: capabilityArraySchema,
    createdAt: canonicalTimestampSchema,
    expiresAt: canonicalTimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.payloadDigest !== contractPayloadDigest(value)) {
      addBindingIssue(context, ['payloadDigest'], 'Production Package payload digest mismatch.');
    }
    if (
      value.approvedScript.scriptVersionId !== value.scriptVersionId ||
      value.approvedScript.payloadDigest !== value.approvedScriptDigest
    ) {
      addBindingIssue(context, ['approvedScript'], 'Approved Script binding mismatch.');
    }
    if (
      value.approvedStoryboard.storyboardVersionId !== value.storyboardVersionId ||
      value.approvedStoryboard.scriptVersionId !== value.scriptVersionId ||
      value.approvedStoryboard.scriptPayloadDigest !== value.approvedScriptDigest ||
      value.approvedStoryboard.payloadDigest !== value.approvedStoryboardDigest
    ) {
      addBindingIssue(context, ['approvedStoryboard'], 'Approved Storyboard binding mismatch.');
    }
    if (new Date(value.expiresAt).getTime() <= new Date(value.createdAt).getTime()) {
      addBindingIssue(context, ['expiresAt'], 'Production Package expiry is invalid.');
    }
    const shotIds = new Set<string>();
    value.storyboard.forEach((shot, index) => {
      if (shot.sequence !== index + 1 || shotIds.has(shot.shotId)) {
        addBindingIssue(
          context,
          ['storyboard', index],
          'Storyboard sequence or shot binding is invalid.',
        );
      }
      shotIds.add(shot.shotId);
    });
  });

const projectGrantSchema = z
  .object({
    objectType: z.literal('ProjectGrant'),
    contractVersion: z.literal('0.2'),
    ...bindingFields,
    idempotencyKey: idempotencyKeySchema,
    occurredAt: canonicalTimestampSchema,
    payloadDigest: digestSchema,
    grantId: uuidSchema,
    capabilities: capabilityArraySchema,
    scopes: scopeArraySchema,
    tokenDigest: digestSchema,
    keyId: redeemedBySchema,
    issuedAt: canonicalTimestampSchema,
    expiresAt: canonicalTimestampSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (value.payloadDigest !== contractPayloadDigest(value)) {
      addBindingIssue(context, ['payloadDigest'], 'Project Grant payload digest mismatch.');
    }
    if (new Date(value.expiresAt).getTime() <= new Date(value.issuedAt).getTime()) {
      addBindingIssue(context, ['expiresAt'], 'Project Grant expiry is invalid.');
    }
  });

const redemptionInputSchema = z
  .object({
    handle: handleSchema,
    ...bindingFields,
    idempotencyKey: idempotencyKeySchema,
    redeemedBy: redeemedBySchema,
  })
  .strict();

const redemptionResultSchema = z
  .object({
    objectType: z.literal('CanvasEntryRedemption'),
    contractVersion: z.literal(CANVAS_ENTRY_REDEMPTION_CONTRACT_VERSION),
    handle: handleSchema,
    ...bindingFields,
    consumedAt: canonicalTimestampSchema,
    productionPackage: productionPackageV03Schema,
    grant: projectGrantSchema,
    tokenType: z.literal('Bearer'),
    accessToken: accessTokenSchema,
  })
  .strict()
  .superRefine((value, context) => {
    const binding = [value.tenantId, value.projectId, value.packageId] as const;
    const packageBinding = [
      value.productionPackage.tenantId,
      value.productionPackage.projectId,
      value.productionPackage.packageId,
    ] as const;
    const grantBinding = [
      value.grant.tenantId,
      value.grant.projectId,
      value.grant.packageId,
    ] as const;
    if (binding.some((part, index) => part !== packageBinding[index])) {
      addBindingIssue(context, ['productionPackage'], 'Production Package scope mismatch.');
    }
    if (binding.some((part, index) => part !== grantBinding[index])) {
      addBindingIssue(context, ['grant'], 'Project Grant scope mismatch.');
    }
    if (value.productionPackage.organizationId !== value.tenantId) {
      addBindingIssue(
        context,
        ['productionPackage', 'organizationId'],
        'Organization binding mismatch.',
      );
    }
    if (
      value.grant.capabilities.some(
        (capability) => !value.productionPackage.capabilityRequirements.includes(capability),
      )
    ) {
      addBindingIssue(context, ['grant', 'capabilities'], 'Project Grant capability mismatch.');
    }
    if (tokenDigest(value.accessToken) !== value.grant.tokenDigest) {
      addBindingIssue(context, ['accessToken'], 'Project Grant token digest mismatch.');
    }
    const consumedAt = new Date(value.consumedAt).getTime();
    if (
      consumedAt < new Date(value.grant.issuedAt).getTime() ||
      consumedAt >= new Date(value.grant.expiresAt).getTime() ||
      consumedAt < new Date(value.productionPackage.createdAt).getTime() ||
      consumedAt >= new Date(value.productionPackage.expiresAt).getTime()
    ) {
      addBindingIssue(context, ['consumedAt'], 'Redemption authority time binding mismatch.');
    }
  });

export function parseCanvasEntryHandle(input: unknown): string {
  return parseOrThrow(handleSchema, input);
}

export function parseCanvasEntryBinding(input: unknown): CanvasEntryBinding {
  return parseOrThrow(bindingSchema, input);
}

export function parseCreateCanvasEntryCommand(input: unknown): CreateCanvasEntryCommand {
  assertNonSecretBrowserPayload(input);
  return parseOrThrow(createCommandSchema, input);
}

export function parseCanvasEntryPublicDto(input: unknown): CanvasEntryPublicDto {
  assertNonSecretBrowserPayload(input);
  return parseOrThrow(publicDtoSchema, input);
}

const createServiceInputSchema = z
  .object({
    packageId: uuidSchema,
    idempotencyKey: idempotencyKeySchema,
    ttlSeconds: z
      .number()
      .int()
      .min(CANVAS_ENTRY_MIN_TTL_SECONDS)
      .max(CANVAS_ENTRY_MAX_TTL_SECONDS),
  })
  .strict();

export function parseCanvasEntryUuid(input: unknown): string {
  return parseOrThrow(uuidSchema, input);
}

export function parseCreateCanvasEntryInput(
  input: unknown,
): import('./types.js').CreateCanvasEntryInput {
  assertNonSecretBrowserPayload(input);
  return parseOrThrow(createServiceInputSchema, input);
}

export function parseRedeemCanvasEntryInput(input: unknown): RedeemCanvasEntryInput {
  assertNonSecretBrowserPayload(input);
  return parseOrThrow(redemptionInputSchema, input);
}

const redeemResultSchema = z
  .object({
    value: redemptionResultSchema,
    replayed: z.boolean(),
  })
  .strict();

export function parseCanvasEntryRedemptionValue(input: unknown): CanvasEntryRedemptionValue {
  return parseOrThrow(redemptionResultSchema, input) as CanvasEntryRedemptionValue;
}

export function parseRedeemCanvasEntryResult(input: unknown): RedeemCanvasEntryResult {
  return parseOrThrow(redeemResultSchema, input) as RedeemCanvasEntryResult;
}
