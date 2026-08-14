import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import type { CanvasCommandV01, CanvasEventV01 } from '../model/contracts';
import type { CanvasWorkspaceV01 } from '../model/workspaceContract';
import { CanvasV1Page, type CanvasAssetView, type CanvasShotView } from '../pages/CanvasV1Page';
import {
  createPilotStoryCanvasBridge,
  type PilotCanvasActivationState,
  type PilotStoryCanvasBridge,
} from '../../../services/pilotStoryCanvasBridge';
import {
  createCanvasActivationAttemptId,
  parseCanonicalCanvasRouteSelection,
  type CanvasRouteSelection,
} from './activation';

const productionBridge = createPilotStoryCanvasBridge();

export interface CanvasV1RouteContainerProps {
  bridge?: PilotStoryCanvasBridge;
  pollIntervalMs?: number;
}

const RUNNING_EVENT_STATUSES = new Set(['accepted', 'provider_submitted', 'task_created']);

function runningEventKey(workspace: CanvasWorkspaceV01): string {
  return workspace.shots
    .flatMap(({ event }) => event && RUNNING_EVENT_STATUSES.has(event.status)
      ? [`${event.commandId}:${event.status}`]
      : [])
    .sort()
    .join('|');
}

function pollDelay(value: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, value));
}

function BoundaryBlocked({ projectId }: { projectId: string | undefined }) {
  return (
    <main className="cv1-state-page cv1-state-page--error" data-testid="pilot-storycanvas-boundary-blocked" role="alert">
      <strong>StoryCanvas Pilot 服务暂不可用</strong>
      <span>{projectId ? `Project ${projectId} · ` : ''}入口未能建立完整生产权限边界。</span>
      <span>系统不会回退 Demo，也不会使用默认项目或默认内容。</span>
    </main>
  );
}

function shotViews(workspace: CanvasWorkspaceV01): CanvasShotView[] {
  return workspace.shots.map((shot) => ({
    shotId: shot.shotId,
    sequence: shot.sequence,
    title: shot.title,
    durationSeconds: shot.durationSeconds,
    scriptText: shot.scriptText,
    storyboardText: shot.storyboardText,
    ...(shot.thumbnailUrl === null ? {} : { thumbnailUrl: shot.thumbnailUrl }),
    readiness: shot.readiness,
    requiredAssetLabels: shot.requiredAssetLabels,
    outputs: shot.outputs.map((output) => ({ ...output })),
  }));
}

function assetViews(workspace: CanvasWorkspaceV01): CanvasAssetView[] {
  return workspace.assets.map((asset) => ({
    assetId: asset.assetId,
    category: asset.category,
    displayName: asset.displayName,
    rightsStatus: asset.rightsStatus,
    approvalStatus: asset.approvalStatus,
    providerStatus: asset.providerStatus,
    entityBindingStatus: asset.entityBindingStatus,
    controlledPreviewUrl: asset.controlledPreviewUrl,
    ...(asset.targetEntityId === null ? {} : { targetEntityId: asset.targetEntityId }),
  }));
}

function taskEvents(workspace: CanvasWorkspaceV01): Record<string, CanvasEventV01 | undefined> {
  return Object.fromEntries(workspace.shots.map((shot) => [shot.shotId, shot.event ?? undefined]));
}

function selectionFor(projectId: string | undefined, search: string): CanvasRouteSelection | null {
  try {
    return parseCanonicalCanvasRouteSelection({ projectId, search });
  } catch {
    return null;
  }
}

export function CanvasV1RouteContainer({
  bridge = productionBridge,
  pollIntervalMs = 5_000,
}: CanvasV1RouteContainerProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const selection = useMemo(
    () => selectionFor(projectId, location.search),
    [location.search, projectId],
  );
  const [activationAttemptId] = useState(createCanvasActivationAttemptId);
  const [activationState, setActivationState] = useState<PilotCanvasActivationState | null>(null);
  const [failed, setFailed] = useState(false);
  const activationStateRef = useRef<PilotCanvasActivationState | null>(null);
  const safePollIntervalMs = Number.isFinite(pollIntervalMs)
    && pollIntervalMs >= 1
    && pollIntervalMs <= 60_000
    ? pollIntervalMs
    : 5_000;

  useEffect(() => {
    activationStateRef.current = activationState;
  }, [activationState]);

  useEffect(() => {
    let active = true;
    setActivationState(null);
    setFailed(false);
    if (!selection) return () => { active = false; };
    void bridge.activate({ ...selection, activationAttemptId }).then(
      (value) => {
        if (active) setActivationState(value);
      },
      () => {
        if (active) setFailed(true);
      },
    );
    return () => { active = false; };
  }, [activationAttemptId, bridge, selection]);

  const activeProductionKey = activationState ? runningEventKey(activationState.workspace) : '';
  useEffect(() => {
    if (!activeProductionKey) return undefined;
    let active = true;
    const poll = async () => {
      let attempts = 0;
      let failures = 0;
      while (active && attempts < 240) {
        attempts += 1;
        await pollDelay(safePollIntervalMs);
        if (!active) return;
        const current = activationStateRef.current;
        if (!current || !runningEventKey(current.workspace)) return;
        try {
          const refreshed = await bridge.refreshWorkspace(current);
          if (!active) return;
          activationStateRef.current = refreshed;
          setActivationState(refreshed);
          failures = 0;
          if (!runningEventKey(refreshed.workspace)) return;
        } catch {
          failures += 1;
          if (failures >= 3) return;
        }
      }
    };
    void poll();
    return () => { active = false; };
  }, [activeProductionKey, bridge, safePollIntervalMs]);

  if (!selection || failed) return <BoundaryBlocked projectId={projectId} />;
  if (!activationState) {
    return (
      <main className="cv1-state-page" role="status">
        <strong>正在建立 StoryCanvas Pilot 生产会话</strong>
        <span>校验当前 Project、Package 与真实工作区。</span>
      </main>
    );
  }

  const workspace = activationState.workspace;
  const prepareHighCostApproval = async (
    request: Parameters<PilotStoryCanvasBridge['prepareApproval']>[1],
  ) => bridge.prepareApproval(activationState, request);
  const onCommand = async (command: CanvasCommandV01): Promise<void> => {
    await bridge.dispatch(activationState, command);
    const refreshed = await bridge.refreshWorkspace(activationState);
    activationStateRef.current = refreshed;
    setActivationState(refreshed);
  };

  return (
    <CanvasV1Page
      projectName={workspace.project.projectName}
      loadState="loaded"
      bootstrap={workspace.bootstrap}
      document={workspace.document}
      shots={shotViews(workspace)}
      assets={assetViews(workspace)}
      taskEvents={taskEvents(workspace)}
      saveState={workspace.saveState}
      commandContext={{ requestedByActorId: workspace.project.requestedByActorId }}
      prepareHighCostApproval={prepareHighCostApproval}
      onCommand={onCommand}
    />
  );
}
