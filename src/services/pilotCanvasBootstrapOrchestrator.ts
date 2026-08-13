import type {
  PilotContentProductionApi,
  PilotProductionCapability,
  PilotProductionEligibility,
  PilotProductionPackage,
} from './pilotContentProductionApi';
import { PilotApiError } from './pilotApiTransport';
import {
  PilotStoryCanvasBridgeError,
  type PilotStoryCanvasBootstrap,
  type PilotStoryCanvasBridge,
} from './pilotStoryCanvasBridge';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CYCLE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const POLICY_VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,63}$/;
const ERROR_CODE_PATTERN = /^[A-Z][A-Z0-9_]{0,63}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SAFE_STATUSES = new Set([401, 403, 404, 409, 410, 422, 500, 503]);
const PACKAGE_MAX_ATTEMPTS = 2;

export interface PilotCanvasPackagePolicy {
  version: string;
  capabilityRequirements: readonly PilotProductionCapability[];
  expiresInSeconds: number;
}

export interface OpenPilotCanvasBootstrapInput {
  tenantId: string;
  projectId: string;
  bootstrapCycleId: string;
}

export interface OpenPilotCanvasBootstrapOptions {
  signal?: AbortSignal;
}

export interface PilotCanvasBootstrapOrchestrator {
  open(
    input: OpenPilotCanvasBootstrapInput,
    options?: OpenPilotCanvasBootstrapOptions,
  ): Promise<PilotStoryCanvasBootstrap>;
}

export interface PilotCanvasBootstrapOrchestratorDependencies {
  contentApi: Pick<
    PilotContentProductionApi,
    'readProductionEligibility' | 'createProductionPackage'
  >;
  storyCanvasBridge: Pick<PilotStoryCanvasBridge, 'open'>;
  packagePolicy: PilotCanvasPackagePolicy;
  now?: () => Date;
}

export class PilotCanvasBootstrapOrchestratorError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryable: boolean;
  readonly requestId: string | null;

  constructor(status: number, code: string, retryable: boolean, requestId: string | null) {
    super('Pilot Canvas package could not be prepared.');
    this.name = 'PilotCanvasBootstrapOrchestratorError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
    this.requestId = requestId;
  }
}

function safeCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && ERROR_CODE_PATTERN.test(value) ? value : fallback;
}

function safeRequestId(value: unknown): string | null {
  return typeof value === 'string' && REQUEST_ID_PATTERN.test(value) ? value : null;
}

function assertInput(input: OpenPilotCanvasBootstrapInput): void {
  if (
    !input ||
    typeof input !== 'object' ||
    !UUID_PATTERN.test(input.tenantId) ||
    !UUID_PATTERN.test(input.projectId) ||
    !CYCLE_PATTERN.test(input.bootstrapCycleId)
  ) {
    throw new PilotCanvasBootstrapOrchestratorError(
      422,
      'PILOT_CANVAS_PACKAGE_INPUT_INVALID',
      false,
      null,
    );
  }
}

function exactPolicy(policy: PilotCanvasPackagePolicy): PilotCanvasPackagePolicy {
  if (
    !policy ||
    typeof policy !== 'object' ||
    !POLICY_VERSION_PATTERN.test(policy.version) ||
    !Array.isArray(policy.capabilityRequirements) ||
    policy.capabilityRequirements.length === 0 ||
    new Set(policy.capabilityRequirements).size !== policy.capabilityRequirements.length ||
    !Number.isInteger(policy.expiresInSeconds) ||
    policy.expiresInSeconds < 300 ||
    policy.expiresInSeconds > 86_400
  ) {
    throw new PilotCanvasBootstrapOrchestratorError(
      422,
      'PILOT_CANVAS_PACKAGE_POLICY_INVALID',
      false,
      null,
    );
  }
  return {
    version: policy.version,
    capabilityRequirements: [...policy.capabilityRequirements],
    expiresInSeconds: policy.expiresInSeconds,
  };
}

function exactEligibleAuthority(
  eligibility: PilotProductionEligibility,
  projectId: string,
): { scriptVersionId: string; storyboardVersionId: string } {
  if (!eligibility || eligibility.projectId !== projectId) {
    throw new PilotCanvasBootstrapOrchestratorError(
      500,
      'PILOT_CANVAS_ELIGIBILITY_SCOPE_INVALID',
      false,
      null,
    );
  }
  if (
    !eligibility.eligible ||
    eligibility.reasonCode !== 'ELIGIBLE' ||
    !eligibility.scriptVersionId ||
    !eligibility.storyboardVersionId
  ) {
    throw new PilotCanvasBootstrapOrchestratorError(
      409,
      'PILOT_CANVAS_PACKAGE_NOT_PREPARED',
      false,
      null,
    );
  }
  return {
    scriptVersionId: eligibility.scriptVersionId,
    storyboardVersionId: eligibility.storyboardVersionId,
  };
}

function sameCapabilities(
  actual: readonly PilotProductionCapability[],
  expected: readonly PilotProductionCapability[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((capability, index) => capability === expected[index])
  );
}

function exactPackage(
  value: PilotProductionPackage,
  input: OpenPilotCanvasBootstrapInput,
  authority: { scriptVersionId: string; storyboardVersionId: string },
  policy: PilotCanvasPackagePolicy,
  now: Date,
): PilotProductionPackage {
  if (
    !value ||
    value.tenantId !== input.tenantId ||
    value.projectId !== input.projectId ||
    value.scriptVersionId !== authority.scriptVersionId ||
    value.storyboardVersionId !== authority.storyboardVersionId ||
    value.status !== 'ready' ||
    !sameCapabilities(value.capabilityRequirements, policy.capabilityRequirements) ||
    !Number.isFinite(now.getTime()) ||
    !Number.isFinite(Date.parse(value.createdAt)) ||
    !Number.isFinite(Date.parse(value.expiresAt)) ||
    Date.parse(value.expiresAt) <= now.getTime()
  ) {
    throw new PilotCanvasBootstrapOrchestratorError(
      500,
      'PILOT_CANVAS_PACKAGE_SCOPE_INVALID',
      false,
      null,
    );
  }
  return value;
}

function packageIdempotencyKey(
  input: OpenPilotCanvasBootstrapInput,
  authority: { scriptVersionId: string; storyboardVersionId: string },
  policy: PilotCanvasPackagePolicy,
): string {
  return `pilot-production-package-v1:${input.projectId}:${authority.scriptVersionId}:${authority.storyboardVersionId}:${policy.version}:${input.bootstrapCycleId}`;
}

function normalizeError(error: unknown): PilotCanvasBootstrapOrchestratorError {
  if (error instanceof PilotCanvasBootstrapOrchestratorError) return error;
  if (error instanceof PilotStoryCanvasBridgeError) {
    return new PilotCanvasBootstrapOrchestratorError(
      error.status,
      error.code,
      error.retryable,
      error.requestId,
    );
  }
  if (error instanceof PilotApiError && error.status !== null && SAFE_STATUSES.has(error.status)) {
    return new PilotCanvasBootstrapOrchestratorError(
      error.status,
      safeCode(error.code, 'PILOT_CANVAS_PACKAGE_FAILED'),
      error.retryable,
      safeRequestId(error.requestId),
    );
  }
  return new PilotCanvasBootstrapOrchestratorError(
    503,
    'PILOT_CANVAS_PACKAGE_DEPENDENCY_UNAVAILABLE',
    true,
    null,
  );
}

function cycleKey(input: OpenPilotCanvasBootstrapInput): string {
  return `${input.tenantId}:${input.projectId}:${input.bootstrapCycleId}`;
}

export function createPilotCanvasBootstrapOrchestrator(
  dependencies: PilotCanvasBootstrapOrchestratorDependencies,
): PilotCanvasBootstrapOrchestrator {
  const policy = exactPolicy(dependencies.packagePolicy);
  const now = dependencies.now ?? (() => new Date());
  const cycles = new Map<string, Promise<PilotStoryCanvasBootstrap>>();

  return {
    open(input, options = {}) {
      try {
        assertInput(input);
      } catch (error) {
        return Promise.reject(error);
      }

      const key = cycleKey(input);
      const existing = cycles.get(key);
      if (existing) return existing;

      const pending = (async () => {
        try {
          const eligibility = await dependencies.contentApi.readProductionEligibility(
            input.projectId,
            { signal: options.signal, maxAttempts: PACKAGE_MAX_ATTEMPTS },
          );
          const authority = exactEligibleAuthority(eligibility, input.projectId);
          const result = await dependencies.contentApi.createProductionPackage(
            input.projectId,
            {
              scriptVersionId: authority.scriptVersionId,
              storyboardVersionId: authority.storyboardVersionId,
              capabilityRequirements: [...policy.capabilityRequirements],
              expiresInSeconds: policy.expiresInSeconds,
            },
            packageIdempotencyKey(input, authority, policy),
            { signal: options.signal, maxAttempts: PACKAGE_MAX_ATTEMPTS },
          );
          const productionPackage = exactPackage(result.value, input, authority, policy, now());
          return await dependencies.storyCanvasBridge.open(
            {
              tenantId: input.tenantId,
              projectId: input.projectId,
              packageId: productionPackage.packageId,
              bootstrapCycleId: input.bootstrapCycleId,
            },
            { signal: options.signal },
          );
        } catch (error) {
          throw normalizeError(error);
        }
      })();

      cycles.set(key, pending);
      void pending.catch(() => {
        if (cycles.get(key) === pending) cycles.delete(key);
      });
      return pending;
    },
  };
}
