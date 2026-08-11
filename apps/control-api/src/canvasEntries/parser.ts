import { z } from 'zod';
import { canvasEntryError } from './errors.js';
import {
  CANVAS_ENTRY_CONTRACT_VERSION,
  CANVAS_ENTRY_MAX_TTL_SECONDS,
  CANVAS_ENTRY_MIN_TTL_SECONDS,
  type CanvasEntryBinding,
  type CanvasEntryPublicDto,
  type CreateCanvasEntryCommand,
} from './types.js';

const uuidSchema = z.string().uuid();
const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/);
const handleSchema = z.string().regex(/^ce_[A-Za-z0-9_-]{32,64}$/);
const canonicalTimestampSchema = z.string().refine((value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
});

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
    'Canvas Entry payload violated the strict non-secret contract.',
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

const consumeServiceInputSchema = z
  .object({
    packageId: uuidSchema,
    handle: handleSchema,
  })
  .strict();

const consumedAuthorizationSchema = z
  .object({
    handle: handleSchema,
    ...bindingFields,
    grantId: uuidSchema,
    consumedAt: canonicalTimestampSchema,
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

export function parseConsumeCanvasEntryInput(
  input: unknown,
): import('./types.js').ConsumeCanvasEntryInput {
  assertNonSecretBrowserPayload(input);
  return parseOrThrow(consumeServiceInputSchema, input);
}

export function parseConsumedCanvasEntryAuthorization(
  input: unknown,
): import('./types.js').ConsumedCanvasEntryAuthorization {
  assertNonSecretBrowserPayload(input);
  return parseOrThrow(consumedAuthorizationSchema, input);
}
