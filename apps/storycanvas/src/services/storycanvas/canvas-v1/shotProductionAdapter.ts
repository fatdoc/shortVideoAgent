import crypto from 'node:crypto';
import type { Knex } from 'knex';

import type { PilotCanvasRedemption } from '../pilotCanvasCapability';
import type { CanvasProductionScope } from '../assets-v1';
import { downloadBytePlusVideo, generateBytePlusVideo } from '../byteplusVideo';
import {
  registerRemoteOutputAsset,
  uploadRemoteOutput,
  type RemoteOutputUpload,
} from '../remoteOutputStorage';
import type { StartShotProductionInput } from './canvasCommandService';
import { CanvasCommandServiceError } from './errors';

const TASK_TYPE = 'canvas_v1_video_generation';
const SAFE_PROVIDER_TASK_ID = /^[A-Za-z0-9._:-]{1,300}$/;

export type CanvasV1ApprovedPackage = PilotCanvasRedemption['productionPackage'];

export interface CanvasV1ShotProvider {
  start(
    input: {
      prompt: string;
      referenceAssetUris: string[];
      ratio: '16:9' | '9:16';
      duration: number;
      resolution: '720p';
    },
    hooks: { onTaskCreated(taskId: string): Promise<void> },
  ): Promise<{ externalTaskId: string; videoUrl: string }>;
}

export type CanvasV1ShotProductionAdapterOptions = {
  database: Knex;
  readiness: () => boolean | Promise<boolean>;
  resolveApprovedPackage(
    scope: CanvasProductionScope,
  ): CanvasV1ApprovedPackage | null | Promise<CanvasV1ApprovedPackage | null>;
  provider?: CanvasV1ShotProvider;
  persistOutput?: (input: {
    database: Knex;
    scope: CanvasProductionScope;
    taskId: string;
    externalTaskId: string;
    videoUrl: string;
  }) => Promise<{ outputAssetId: string }>;
  newId?: () => string;
  now?: () => Date;
};

export function isCanvasV1ShotProductionConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    env.ARK_API_KEY?.trim() &&
      env.ARK_ASSET_ACCESS_KEY?.trim() &&
      env.ARK_ASSET_SECRET_KEY?.trim() &&
      env.ARK_ASSET_GROUP_ID?.trim() &&
      env.ARK_ASSET_TOS_BUCKET?.trim() &&
      env.ARK_ASSET_TOS_ENDPOINT?.trim(),
  );
}

function safeDate(now: () => Date): string {
  const value = now();
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new CanvasCommandServiceError('CANVAS_CAPABILITY_UNAVAILABLE');
  }
  return value.toISOString();
}

function exactPackageScope(
  value: CanvasV1ApprovedPackage,
  scope: CanvasProductionScope,
): boolean {
  return (
    value.contractVersion === '0.3' &&
    value.status === 'ready' &&
    value.tenantId === scope.tenantId &&
    value.projectId === scope.projectId &&
    value.packageId === scope.packageId &&
    Date.parse(value.expiresAt) > Date.now() &&
    value.capabilityRequirements.includes('video.generate')
  );
}

function taskSemanticInput(input: StartShotProductionInput, ratio: '16:9' | '9:16', duration: number) {
  return {
    tenantId: input.scope.tenantId,
    projectId: input.scope.projectId,
    packageId: input.scope.packageId,
    canvasSessionId: input.scope.canvasSessionId,
    actorId: input.scope.actorId,
    commandId: input.commandId,
    shotId: input.shotId,
    promptDigest: crypto.createHash('sha256').update(input.prompt).digest('hex'),
    referenceAssetIdsDigest: crypto
      .createHash('sha256')
      .update(JSON.stringify(input.referenceAssetIds))
      .digest('hex'),
    referenceAssetCount: input.referenceAssetIds.length,
    ratio,
    durationSeconds: duration,
  };
}

function exactTaskReplay(
  row: Record<string, unknown>,
  expected: ReturnType<typeof taskSemanticInput>,
  localProjectId: number,
): boolean {
  if (Number(row.projectId) !== localProjectId || row.taskType !== TASK_TYPE) return false;
  try {
    return JSON.stringify(JSON.parse(String(row.inputJson))) === JSON.stringify(expected);
  } catch {
    return false;
  }
}

async function realProviderStart(
  input: Parameters<CanvasV1ShotProvider['start']>[0],
  hooks: Parameters<CanvasV1ShotProvider['start']>[1],
) {
  const result = await generateBytePlusVideo(
    {
      prompt: input.prompt,
      referenceAssetUris: input.referenceAssetUris,
      ratio: input.ratio,
      duration: input.duration,
      resolution: input.resolution,
    },
    { onTaskCreated: hooks.onTaskCreated },
  );
  return { externalTaskId: result.taskId, videoUrl: result.videoUrl };
}

async function realPersistOutput(input: {
  database: Knex;
  scope: CanvasProductionScope;
  taskId: string;
  externalTaskId: string;
  videoUrl: string;
}): Promise<{ outputAssetId: string }> {
  const outputAssetId = crypto.randomUUID();
  const content = await downloadBytePlusVideo(input.videoUrl);
  const upload: RemoteOutputUpload = await uploadRemoteOutput(
    { projectId: input.scope.localProjectId, taskId: input.taskId, assetId: outputAssetId },
    content,
    'video/mp4',
  );
  await registerRemoteOutputAsset(input.database, {
    scope: { projectId: input.scope.localProjectId, taskId: input.taskId, assetId: outputAssetId },
    upload,
    type: 'video',
    source: 'generated',
    originalName: `${input.taskId}.mp4`,
    provider: 'byteplus',
    externalTaskId: input.externalTaskId,
  });
  return { outputAssetId };
}

export class CanvasV1ShotProductionAdapter {
  private readonly provider: CanvasV1ShotProvider;
  private readonly persistOutput: NonNullable<CanvasV1ShotProductionAdapterOptions['persistOutput']>;
  private readonly newId: () => string;
  private readonly now: () => Date;

  constructor(private readonly options: CanvasV1ShotProductionAdapterOptions) {
    this.provider = options.provider ?? { start: realProviderStart };
    this.persistOutput = options.persistOutput ?? realPersistOutput;
    this.newId = options.newId ?? crypto.randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async start(input: StartShotProductionInput): Promise<{ taskId: string }> {
    if (!(await this.options.readiness())) {
      throw new CanvasCommandServiceError('CANVAS_CAPABILITY_UNAVAILABLE');
    }
    const approvedPackage = await this.options.resolveApprovedPackage(input.scope);
    if (!approvedPackage || !exactPackageScope(approvedPackage, input.scope)) {
      throw new CanvasCommandServiceError('CANVAS_SCOPE_MISMATCH');
    }
    const shot = approvedPackage.storyboard.find((item) => item.shotId === input.shotId);
    if (!shot) throw new CanvasCommandServiceError('CANVAS_SHOT_NOT_READY');
    const ratio = approvedPackage.target.aspectRatio;
    if (ratio !== '16:9' && ratio !== '9:16') {
      throw new CanvasCommandServiceError('CANVAS_CAPABILITY_UNAVAILABLE');
    }
    if (
      input.referenceAssetUris.length !== input.referenceAssetIds.length ||
      input.referenceAssetUris.length > 9 ||
      input.referenceAssetUris.some((uri) => !uri.startsWith('asset://'))
    ) {
      throw new CanvasCommandServiceError('CANVAS_PROVIDER_NOT_ACTIVE');
    }

    const semanticInput = taskSemanticInput(input, ratio, shot.durationSeconds);
    const idempotencyKey = `canvas-v1:${input.commandId}`;
    const existing = await this.options.database('sc_tasks').where({ idempotencyKey }).first();
    if (existing) {
      if (
        exactTaskReplay(existing, semanticInput, input.scope.localProjectId) &&
        existing.externalTaskId &&
        SAFE_PROVIDER_TASK_ID.test(String(existing.externalTaskId))
      ) {
        return { taskId: String(existing.id) };
      }
      throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
    }

    const taskId = this.newId();
    const createdAt = safeDate(this.now);
    try {
      await this.options.database('sc_tasks').insert({
        id: taskId,
        projectId: input.scope.localProjectId,
        taskType: TASK_TYPE,
        provider: 'byteplus',
        status: 'queued',
        progress: 0,
        inputJson: JSON.stringify(semanticInput),
        outputJson: null,
        errorJson: null,
        idempotencyKey,
        externalTaskId: null,
        createdAt,
        updatedAt: createdAt,
      });
    } catch (error) {
      const replay = await this.options.database('sc_tasks').where({ idempotencyKey }).first();
      if (
        replay &&
        exactTaskReplay(replay, semanticInput, input.scope.localProjectId) &&
        replay.externalTaskId &&
        SAFE_PROVIDER_TASK_ID.test(String(replay.externalTaskId))
      ) {
        return { taskId: String(replay.id) };
      }
      throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
    }

    let resolveSubmitted!: () => void;
    let rejectSubmitted!: () => void;
    const submitted = new Promise<void>((resolve, reject) => {
      resolveSubmitted = resolve;
      rejectSubmitted = reject;
    });
    const run = async () => {
      let submittedExternalTaskId: string | null = null;
      try {
        const generated = await this.provider.start(
          {
            prompt: input.prompt,
            referenceAssetUris: input.referenceAssetUris,
            ratio,
            duration: shot.durationSeconds,
            resolution: '720p',
          },
          {
            onTaskCreated: async (externalTaskId) => {
              if (!SAFE_PROVIDER_TASK_ID.test(externalTaskId)) {
                throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
              }
              if (submittedExternalTaskId) {
                if (submittedExternalTaskId !== externalTaskId) {
                  throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
                }
                return;
              }
              const changed = await this.options.database('sc_tasks')
                .where({ id: taskId })
                .whereNull('externalTaskId')
                .update({
                  status: 'running',
                  progress: 20,
                  externalTaskId,
                  updatedAt: safeDate(this.now),
                });
              if (changed !== 1) {
                throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
              }
              submittedExternalTaskId = externalTaskId;
              resolveSubmitted();
            },
          },
        );
        if (
          !submittedExternalTaskId ||
          generated.externalTaskId !== submittedExternalTaskId
        ) {
          throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
        }
        const output = await this.persistOutput({
          database: this.options.database,
          scope: input.scope,
          taskId,
          externalTaskId: generated.externalTaskId,
          videoUrl: generated.videoUrl,
        });
        await this.options.database('sc_tasks').where({ id: taskId }).update({
          status: 'succeeded',
          progress: 100,
          outputJson: JSON.stringify({ outputAssetId: output.outputAssetId }),
          errorJson: null,
          updatedAt: safeDate(this.now),
        });
      } catch {
        await this.options.database('sc_tasks').where({ id: taskId }).update({
          status: 'failed',
          progress: 100,
          errorJson: JSON.stringify({ code: 'CANVAS_PROVIDER_FAILED' }),
          updatedAt: safeDate(this.now),
        }).catch(() => undefined);
        rejectSubmitted();
      }
    };
    void run();
    try {
      await submitted;
      return { taskId };
    } catch {
      throw new CanvasCommandServiceError('CANVAS_PROVIDER_FAILED');
    }
  }
}
