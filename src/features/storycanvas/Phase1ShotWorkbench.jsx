import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  IconAlertTriangle,
  IconBrain,
  IconCheck,
  IconClock,
  IconCoins,
  IconDeviceFloppy,
  IconExternalLink,
  IconFileText,
  IconHistory,
  IconLoader2,
  IconLock,
  IconMovie,
  IconPhoto,
  IconPlayerPause,
  IconRefresh,
  IconRoute,
  IconSparkles,
  IconX,
} from "@tabler/icons-react";

const taskStatusLabel = {
  draft: "草稿",
  awaiting_confirmation: "待确认",
  queued: "排队中",
  running: "生成中",
  validating: "校验资产",
  succeeded: "已成功",
  failed: "失败",
  cancelled: "已取消",
};

const decisionLabel = {
  undecided: "待决策",
  selected: "已采用",
  alternative: "备选",
  rejected: "已淘汰",
};

function shotIdOf(shot) {
  return shot?.id || shot?.externalStoryboardShotId;
}

function displayValue(value) {
  if (Array.isArray(value)) return value.map((item) => (
    item && typeof item === "object" ? JSON.stringify(item) : String(item)
  )).join("、") || "无";
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value === null || value === undefined || value === "") return "未提供";
  return String(value);
}

function assetForAttempt(attempt, assets) {
  return attempt?.asset || assets.find((asset) => asset.id === attempt?.assetId) || null;
}

export function isPlayablePhase1Attempt(attempt, assets = []) {
  const asset = assetForAttempt(attempt, assets);
  return Boolean(
    asset
    && asset.assetType === "video"
    && asset.validationStatus === "valid"
    && asset.playableUrl,
  );
}

export function normalizePhase1Shots(workbench) {
  return [...(workbench?.shots || [])].sort((left, right) => left.sequence - right.sequence);
}

function ShotRail({ shots, selectedId, onSelect, assets }) {
  return (
    <aside className="phase1-shot-rail" aria-label="镜头生产列表">
      <header><span>PRODUCTION SHOTS</span><strong>{shots.length} 镜生产单</strong></header>
      <div>
        {shots.map((shot) => {
          const id = shotIdOf(shot);
          const selectedAttempt = shot.attempts?.find((attempt) => attempt.id === shot.selectedAttemptId);
          const playable = isPlayablePhase1Attempt(selectedAttempt, assets);
          const hasFailure = shot.tasks?.some((task) => task.status === "failed");
          return (
            <button key={id} className={id === selectedId ? "active" : ""} onClick={() => onSelect(id)}>
              <span className="phase1-shot-sequence">{String(shot.sequence).padStart(2, "0")}</span>
              <span className="phase1-shot-copy"><strong>{shot.title}</strong><small>{id} · {shot.duration}s</small></span>
              <span className={`phase1-shot-signal ${playable ? "ready" : hasFailure ? "failed" : "pending"}`} title={playable ? "已选择可播放版本" : hasFailure ? "存在失败任务" : "尚未选择可播放版本"} />
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function AttemptMedia({ attempt, asset }) {
  if (!asset?.playableUrl || asset.validationStatus !== "valid") {
    return <div className="phase1-media-empty"><IconMovie size={26} /><span>{asset ? `资产${asset.validationStatus}` : "没有可播放资产"}</span></div>;
  }
  if (asset.assetType === "video") {
    return <video src={asset.playableUrl} controls playsInline preload="metadata" aria-label={`Attempt ${attempt.attemptNumber} 视频`} />;
  }
  return <img src={asset.playableUrl} alt={`Attempt ${attempt.attemptNumber} 图片`} />;
}

function AttemptCard({ attempt, asset, selected, busy, onDecision, onLocateTask, onLocateAsset }) {
  const playable = isPlayablePhase1Attempt(attempt, asset ? [asset] : []);
  return (
    <article className={`phase1-attempt-card ${selected ? "selected" : ""}`}>
      <div className="phase1-attempt-media"><AttemptMedia attempt={attempt} asset={asset} /></div>
      <div className="phase1-attempt-meta">
        <div><strong>版本 {attempt.attemptNumber}</strong><span className={attempt.operatorDecision}>{decisionLabel[attempt.operatorDecision] || attempt.operatorDecision}</span></div>
        <small>{attempt.generationTaskId} · {asset?.validationStatus || "missing"}</small>
        <div className="phase1-attempt-actions">
          <button disabled={busy || !playable} onClick={() => onDecision(attempt.id, "selected")}>采用</button>
          <button disabled={busy} onClick={() => onDecision(attempt.id, "alternative")}>备选</button>
          <button disabled={busy} onClick={() => onDecision(attempt.id, "rejected")}>淘汰</button>
        </div>
        <div className="phase1-locate-actions">
          <button onClick={() => onLocateTask(attempt.generationTaskId)}><IconExternalLink size={12} />任务</button>
          <button disabled={!asset} onClick={() => onLocateAsset(asset?.id)}><IconExternalLink size={12} />资产</button>
        </div>
      </div>
    </article>
  );
}

function LockedBusinessPanel({ shot }) {
  const contract = shot.shotContract || {};
  const entries = [
    ["批准脚本片段", shot.approvedScriptSegment],
    ["事实与 Claim", [...(shot.claimIds || []), ...(shot.brandFactIds || [])]],
    ["必须 CTA", contract.requiredCTA],
    ["免责声明", contract.requiredDisclaimer],
    ["禁用词", contract.prohibitedTerms],
    ...Object.entries(shot.lockedBusinessFields || {}).map(([key, value]) => [key, value]),
  ].filter(([, value]) => value !== undefined);
  return (
    <section className="phase1-locked-panel">
      <header><IconLock size={15} /><div><strong>已锁定商业信息</strong><small>来自审批生产包，制作人员不可修改</small></div></header>
      <dl>{entries.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{displayValue(value)}</dd></div>)}</dl>
    </section>
  );
}

function CreativeInspector({ shot, workbench, busy, onSave, onConfirmPlan, onCreateTask }) {
  const plan = shot.generationPlan;
  const creative = shot.editableCreativeFields || {};
  const [draft, setDraft] = useState({ referenceAssetIds: [] });
  useEffect(() => {
    const cameraMovement = creative.cameraMovement ?? plan?.cameraPlan?.movementType ?? "";
    setDraft({
      imagePrompt: creative.imagePrompt ?? plan?.imagePrompt ?? "",
      videoPrompt: creative.videoPrompt ?? plan?.videoPrompt ?? "",
      negativePrompt: creative.negativePrompt ?? plan?.negativePrompt ?? "",
      imageModel: creative.imageModel ?? plan?.recommendedImageModel ?? "",
      videoModel: creative.videoModel ?? plan?.recommendedVideoModel ?? "",
      cameraMovement: typeof cameraMovement === "string" ? cameraMovement : displayValue(cameraMovement),
      referenceAssetIds: creative.referenceAssetIds ?? plan?.referenceAssetIds ?? [],
    });
  }, [shotIdOf(shot), plan?.planVersion]);

  const update = (field, value) => setDraft((current) => ({ ...current, [field]: value }));
  const toggleReference = (assetId) => update(
    "referenceAssetIds",
    (draft.referenceAssetIds || []).includes(assetId)
      ? (draft.referenceAssetIds || []).filter((id) => id !== assetId)
      : [...(draft.referenceAssetIds || []), assetId],
  );
  const approved = Boolean(plan?.approvedByOperator || plan?.status === "confirmed");
  return (
    <aside className="phase1-inspector">
      <LockedBusinessPanel shot={shot} />
      <section className="phase1-creative-panel">
        <header><IconSparkles size={15} /><div><strong>可编辑创意参数</strong><small>保存到 Runtime，不改审批事实</small></div></header>
        {!plan && <div className="phase1-inline-warning"><IconAlertTriangle size={14} />先生成该镜头的 DEMO 生产方案</div>}
        {plan && (
          <div className={`phase1-plan-state ${approved ? "confirmed" : "awaiting"}`}>
            <span>Plan v{plan.planVersion} · {approved ? "制作人员已确认" : "等待制作人员确认"}</span>
            {!approved && <button disabled={busy} onClick={() => onConfirmPlan(plan.planVersion)}><IconCheck size={13} />确认方案</button>}
          </div>
        )}
        <label>图片提示词<textarea aria-label="图片提示词" rows={4} value={draft.imagePrompt || ""} onChange={(event) => update("imagePrompt", event.target.value)} /></label>
        <label>视频提示词<textarea aria-label="视频提示词" rows={4} value={draft.videoPrompt || ""} onChange={(event) => update("videoPrompt", event.target.value)} /></label>
        <label>负向提示词<textarea aria-label="负向提示词" rows={2} value={draft.negativePrompt || ""} onChange={(event) => update("negativePrompt", event.target.value)} /></label>
        <div className="phase1-form-row">
          <label>图片模型<select aria-label="图片模型" value={draft.imageModel || ""} onChange={(event) => update("imageModel", event.target.value)}><option value="">服务端推荐</option>{(workbench.modelOptions?.image || []).map((model) => <option key={model.id} value={model.id} disabled={!model.available}>{model.label}</option>)}</select></label>
          <label>视频模型<select aria-label="视频模型" value={draft.videoModel || ""} onChange={(event) => update("videoModel", event.target.value)}><option value="">服务端推荐</option>{(workbench.modelOptions?.video || []).map((model) => <option key={model.id} value={model.id} disabled={!model.available}>{model.label}</option>)}</select></label>
        </div>
        <label>运镜参数<input aria-label="运镜参数" value={draft.cameraMovement || ""} onChange={(event) => update("cameraMovement", event.target.value)} /></label>
        <fieldset className="phase1-reference-picker"><legend>参考素材</legend>{(workbench.referenceAssets || []).length ? workbench.referenceAssets.map((asset) => <label key={asset.id}><input type="checkbox" checked={(draft.referenceAssetIds || []).includes(asset.id)} onChange={() => toggleReference(asset.id)} /><span>{asset.name || asset.id}</span><small>{asset.referenceRole || asset.validationStatus}</small></label>) : <p>服务端未提供可选参考素材</p>}</fieldset>
        <button className="phase1-save" disabled={busy} onClick={() => onSave(draft)}><IconDeviceFloppy size={15} />保存创意参数</button>
        <div className="phase1-generation-actions">
          <button disabled={busy || !approved} onClick={() => onCreateTask("image.generate", draft)}><IconPhoto size={15} />生成图片版本</button>
          <button disabled={busy || !approved} onClick={() => onCreateTask("video.generate", draft)}><IconMovie size={15} />生成视频版本</button>
        </div>
        {!approved && <p className="phase1-gate-copy">Gate：制作人员确认 GenerationPlan 后才允许创建生成任务。</p>}
      </section>
    </aside>
  );
}

function RuntimeLedger({ shot, workbench, error, busy, onRetry, onCancel }) {
  const tasksRef = useRef(null);
  const assetsRef = useRef(null);
  const [focusId, setFocusId] = useState("");
  const locate = (kind, id) => {
    setFocusId(id || "");
    (kind === "task" ? tasksRef : assetsRef).current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };
  const latestRoughCut = [...(workbench?.roughCuts || [])].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const latestExport = [...(workbench?.exports || [])].sort((left, right) => String(right.createdAt).localeCompare(String(left.createdAt)))[0];
  const credits = workbench?.credits || [];
  const creditSummary = credits.reduce((summary, entry) => ({
    ...summary,
    [entry.operation]: (summary[entry.operation] || 0) + Number(entry.amount || 0),
  }), { reserve: 0, consume: 0, release: 0 });
  return {
    locate,
    panel: (
      <section className="phase1-runtime-ledger">
        <div ref={tasksRef} className="phase1-runtime-block"><header><IconHistory size={14} />生成任务</header>{(shot.tasks || []).length ? shot.tasks.map((task) => <article key={task.id} className={focusId === task.id ? "focused" : ""}><div><strong>{task.taskType}</strong><span className={task.status}>{taskStatusLabel[task.status] || task.status} · {task.progress}%</span></div><small>{task.id} · {task.provider || "provider pending"} / {task.model || "model pending"}</small>{task.errorMessage && <p>{task.errorCode ? `${task.errorCode}：` : ""}{task.errorMessage}</p>}<footer><span><IconCoins size={12} />冻结 {task.reservedCredit || 0} / 消费 {task.consumedCredit || 0} / 释放 {task.releasedCredit || 0}</span>{["failed", "cancelled"].includes(task.status) && <button disabled={busy} onClick={() => onRetry(task.id)}><IconRefresh size={12} />重试</button>}{["queued", "running", "validating"].includes(task.status) && <button disabled={busy} onClick={() => onCancel(task.id)}><IconPlayerPause size={12} />取消</button>}</footer></article>) : <p>当前镜头还没有生成任务。</p>}</div>
        <div ref={assetsRef} className="phase1-runtime-block"><header><IconMovie size={14} />资产校验</header>{(shot.attempts || []).length ? shot.attempts.map((attempt) => { const asset = attempt.asset; return <article key={attempt.id} className={focusId === asset?.id ? "focused" : ""}><div><strong>Attempt {attempt.attemptNumber}</strong><span className={asset?.validationStatus}>{asset?.validationStatus || "missing"}</span></div><small>{asset?.id || "没有资产"} · {asset?.mimeType || "未检测媒体格式"}</small></article>; }) : <p>没有 Attempt 或媒体资产。</p>}</div>
        <div className="phase1-runtime-block"><header><IconRoute size={14} />来源链</header><p>Shot {shotIdOf(shot)} → Attempt → Task → Asset → Selection</p><small>Package {shot.productionPackageId} · Storyboard {shot.externalStoryboardShotId}</small></div>
        <div className="phase1-runtime-block"><header><IconMovie size={14} />粗剪与企业确认</header>{latestRoughCut ? <article><div><strong>{latestRoughCut.id}</strong><span className={latestRoughCut.approvalStatus}>{latestRoughCut.approvalStatus}</span></div><small>{latestRoughCut.orderedShotSelections?.length || 0} 镜 · {latestRoughCut.totalDuration || 0}s · {latestRoughCut.aspectRatio}</small><p>批准主体：{latestRoughCut.approvedBy || "等待 tenant.owner"}</p></article> : <p>八镜全部采用后才能创建 RoughCut。</p>}</div>
        <div className="phase1-runtime-block"><header><IconFileText size={14} />导出与 Provenance</header>{latestExport ? <article><div><strong>{latestExport.exportType} · {latestExport.platformVariant}</strong><span className={latestExport.status}>{latestExport.status}</span></div><small>{latestExport.id} · Asset {latestExport.assetId}</small><p>来源字段：{Object.keys(latestExport.provenance || {}).join(" → ")}</p></article> : <p>企业确认 RoughCut 后才能生成 ExportArtifact。</p>}</div>
        <div className="phase1-runtime-block"><header><IconCoins size={14} />项目额度流水</header><p>冻结 {creditSummary.reserve} · 消费 {creditSummary.consume} · 释放 {creditSummary.release}</p><small>{credits.length} 条 append-only Runtime Ledger Entry</small></div>
        {(error || busy) && <div className={`phase1-runtime-message ${error ? "error" : "busy"}`}>{busy ? <IconLoader2 className="spin" size={14} /> : <IconAlertTriangle size={14} />}{error || "正在同步 Runtime 事实"}</div>}
      </section>
    ),
  };
}

/**
 * @param {import("./StoryCanvasApp.types").Phase1ShotWorkbenchProps} props
 */
export function Phase1ShotWorkbench({ workbench, loading, error, action, onReload, onGeneratePlans, onConfirmPlan, onSaveCreative, onCreateTask, onRetryTask, onCancelTask, onDecideAttempt, onShotSelect }) {
  const shots = useMemo(() => normalizePhase1Shots(workbench), [workbench]);
  const assets = workbench?.assets || [];
  const [selectedId, setSelectedId] = useState(() => shotIdOf(shots[0]));
  useEffect(() => {
    if (!shots.some((shot) => shotIdOf(shot) === selectedId)) setSelectedId(shotIdOf(shots[0]));
  }, [shots, selectedId]);
  const shot = shots.find((candidate) => shotIdOf(candidate) === selectedId) || shots[0];
  const busy = Boolean(action);
  const ledger = RuntimeLedger({ shot: shot || { tasks: [], attempts: [] }, workbench, error, busy, onRetry: onRetryTask, onCancel: onCancelTask });
  const chooseShot = (id) => { setSelectedId(id); onShotSelect?.(id); };

  if (loading && !workbench) return <section className="phase1-runtime-state"><IconLoader2 className="spin" size={22} /><strong>正在读取 Phase1 Runtime</strong></section>;
  if (!shot) return <section className="phase1-runtime-state error"><IconAlertTriangle size={22} /><strong>{error || "Runtime 没有返回 ProductionShot"}</strong><button onClick={onReload}>重新读取</button></section>;

  const attempts = [...(shot.attempts || [])].sort((left, right) => right.attemptNumber - left.attemptNumber);
  const selectedAttempt = attempts.find((attempt) => attempt.id === shot.selectedAttemptId || attempt.isSelected);
  const selectedAsset = assetForAttempt(selectedAttempt, assets);
  return (
    <motion.section className="phase1-shot-workbench" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <ShotRail shots={shots} selectedId={shotIdOf(shot)} onSelect={chooseShot} assets={assets} />
      <main className="phase1-shot-stage">
        <header className="phase1-stage-header"><div><span>SHOT {String(shot.sequence).padStart(2, "0")} · {shotIdOf(shot)}</span><h2>{shot.title}</h2></div><div><span className={`phase1-mode ${workbench.mode?.toLowerCase()}`}>{workbench.mode || "UNKNOWN"}</span><button disabled={busy} onClick={onGeneratePlans}><IconBrain size={14} />生成全部镜头生产方案</button><button disabled={busy} onClick={onReload}><IconRefresh size={14} />刷新</button></div></header>
        <div className="phase1-primary-preview"><div className="phase1-preview-media">{selectedAttempt ? <AttemptMedia attempt={selectedAttempt} asset={selectedAsset} /> : <div className="phase1-media-empty"><IconMovie size={34} /><strong>尚未选择视频版本</strong><span>只有 valid 且具有 playableUrl 的视频资产可被采用</span></div>}</div><aside><span>CURRENT SELECTION</span><strong>{selectedAttempt ? `Attempt ${selectedAttempt.attemptNumber}` : "未选择"}</strong><small>{selectedAsset ? `${selectedAsset.validationStatus} · ${selectedAsset.mimeType || "unknown mime"}` : "等待可播放资产"}</small></aside></div>
        <section className="phase1-attempts"><header><div><strong>生成版本</strong><small>{attempts.length} 个 Attempt，历史不会因新生成而覆盖</small></div></header>{attempts.length ? <div>{attempts.map((attempt) => <AttemptCard key={attempt.id} attempt={attempt} asset={assetForAttempt(attempt, assets)} selected={attempt.id === selectedAttempt?.id} busy={busy} onDecision={(attemptId, decision) => onDecideAttempt(shotIdOf(shot), attemptId, decision)} onLocateTask={(id) => ledger.locate("task", id)} onLocateAsset={(id) => ledger.locate("asset", id)} />)}</div> : <div className="phase1-no-attempt"><IconClock size={20} />确认生产方案后创建第一个图片或视频版本。</div>}</section>
        {ledger.panel}
      </main>
      <CreativeInspector shot={shot} workbench={workbench} busy={busy} onSave={(draft) => onSaveCreative(shotIdOf(shot), draft)} onConfirmPlan={(version) => onConfirmPlan(shotIdOf(shot), version)} onCreateTask={(taskType, draft) => onCreateTask(shotIdOf(shot), taskType, draft, shot.generationPlan)} />
    </motion.section>
  );
}
