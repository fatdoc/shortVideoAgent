import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  IconAlertTriangle,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowsMove,
  IconBolt,
  IconBox,
  IconBrain,
  IconBuildingStore,
  IconCheck,
  IconClock,
  IconDeviceFloppy,
  IconDownload,
  IconFileText,
  IconFolder,
  IconFocusCentered,
  IconLayoutKanban,
  IconLoader2,
  IconLock,
  IconLockOpen,
  IconMaximize,
  IconMinus,
  IconMovie,
  IconPhoto,
  IconPlus,
  IconRefresh,
  IconRoute,
  IconSettings,
  IconSparkles,
  IconTimelineEvent,
  IconUser,
  IconX,
  IconTrash,
} from "@tabler/icons-react";
import { createMvpClient } from "./mvpApi";
import { validateEmbeddedStoryCanvasGrant } from "./StoryCanvasApp.types";
import "./storycanvas.css";

const mvpApi = createMvpClient();

const initialShots = [
  {
    id: 0,
    internalId: 0,
    externalId: "loading",
    order: 0,
    section: "正在读取",
    range: "00:00–00:00",
    title: "加载 canonical production package",
    shortTitle: "加载 canonical production package",
    duration: 0,
    status: "waiting",
    imagePrompt: "等待服务端返回不可变生产包快照。",
    videoPrompt: "等待服务端返回不可变生产包快照。",
    description: "StoryCanvas 正在接收唯一 D1 项目。",
  },
];

const navItems = [
  { id: "projects", label: "项目", icon: IconFolder },
  { id: "scripts", label: "脚本", icon: IconFileText },
  { id: "canvas", label: "画布", icon: IconLayoutKanban },
  { id: "memory", label: "记忆", icon: IconBrain },
  { id: "assets", label: "素材", icon: IconPhoto },
];

const entityTypeMeta = {
  character: { label: "人物", icon: IconUser },
  object: { label: "物品", icon: IconBox },
  location: { label: "场景", icon: IconBuildingStore },
  brand: { label: "品牌", icon: IconSparkles },
};

const relationOptions = [
  { value: "continuous-action", label: "连续动作", help: "动作跨镜头不中断，可选择继承上一尾帧。" },
  { value: "same-scene-cut", label: "同场切镜", help: "共享空间和世界状态，但允许重新构图。" },
  { value: "cross-scene-cut", label: "跨场切镜", help: "只继承指定人物、物品、品牌与叙事状态。" },
  { value: "time-jump", label: "时间跳切", help: "保留实体身份，允许时间和局部状态变化。" },
  { value: "montage", label: "蒙太奇", help: "共享风格与核心实体，不要求动作逐帧连续。" },
];

const referenceRoleLabel = {
  character_identity: "人物身份",
  outfit: "服装",
  scene_layout: "场景布局",
  prop_identity: "物品身份",
  brand: "品牌",
  style: "视觉风格",
  first_frame: "首帧",
  previous_end_frame: "上一尾帧",
};

const statusLabel = {
  completed: "MOCK 已登记",
  failed: "合同失败已登记",
  generating: "合同处理中",
  queued: "合同排队中",
  sample: "受控参考",
  waiting: "待处理",
};

const nodeOffsets = [-10, 26, -76, 26, -10];
const defaultShotDuration = 4;
const defaultOutputSettings = {
  resolution: "720p",
  defaultDuration: 4,
};

function productionShotsToCanvas(production) {
  return recalculateShotRanges((production?.shots || []).map((shot) => ({
    id: shot.order,
    internalId: shot.internalId,
    externalId: shot.id,
    order: shot.order,
    section: `镜头 ${String(shot.order).padStart(2, "0")}`,
    title: shot.description,
    shortTitle: shot.screenText || shot.description,
    duration: shot.duration,
    status: shot.matchStatus === "matched" ? "sample" : "waiting",
    imagePrompt: shot.imagePrompt,
    videoPrompt: shot.videoPrompt,
    description: shot.narration,
    screenText: shot.screenText,
    sourceType: shot.sourceType,
    riskLevel: shot.riskLevel,
    contractStatus: shot.status,
    matchStatus: shot.matchStatus,
    assignee: shot.assignee,
    assetId: shot.assetId,
  })));
}

function demoScenarioForShot(shot, kind) {
  if (shot?.externalId === "shot-07" && kind === "image") return "success";
  if (shot?.externalId === "shot-05" && kind === "video") return "failure";
  return null;
}

const emptyCharacterProfile = {
  name: "",
  age: "",
  height: "",
  bodyType: "",
  style: "电影级风格化写实",
  personality: "",
  appearance: "",
  wardrobe: "",
  setting: "",
};

function loadOutputSettings() {
  try {
    const stored = JSON.parse(window.localStorage.getItem("storycanvas:output-settings") || "null");
    return stored ? { ...defaultOutputSettings, ...stored } : defaultOutputSettings;
  } catch {
    return defaultOutputSettings;
  }
}

function formatTimestamp(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function recalculateShotRanges(shots) {
  let cursor = 0;
  return shots.map((shot) => {
    const range = `${formatTimestamp(cursor)}–${formatTimestamp(cursor + shot.duration)}`;
    cursor += shot.duration;
    return { ...shot, range };
  });
}

function createNewShot(shots, id, duration = defaultShotDuration) {
  const start = shots.reduce((total, shot) => total + shot.duration, 0);
  const number = String(id).padStart(2, "0");

  return {
    id,
    section: `章节 ${number}`,
    range: `${formatTimestamp(start)}–${formatTimestamp(start + duration)}`,
    title: `新镜头 ${number}`,
    shortTitle: `新镜头 ${number}`,
    duration,
    status: "waiting",
    imagePrompt: "竖屏电影感画面，延续上一镜头的场景与光线，主体清晰，构图简洁，细节真实。",
    videoPrompt: "承接上一镜头，镜头平稳推进，主体做自然细微动作，光线与场景保持连贯，节奏舒缓。",
    description: "补充这一章节的画面、动作与旁白内容。",
  };
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("参考图读取失败"));
    reader.readAsDataURL(blob);
  });
}

async function mediaUrlToDataUrl(url) {
  if (url.startsWith("data:image/")) return url;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`参考图读取失败（HTTP ${response.status}）`);
  return readBlobAsDataUrl(await response.blob());
}

function applyTaskToShots(items, task) {
  return items.map((shot) => {
    if ((shot.internalId || shot.id) !== task.shotId) return shot;
    if (task.status === "succeeded") {
      return {
        ...shot,
        status: "completed",
        progress: 100,
        mediaType: task.mediaType,
        mediaUrl: task.mediaUrl,
        truthMode: task.truthMode || "MOCK-CONTRACT",
        ...(task.kind === "image" && task.mediaUrl ? {
          generatedImageTaskId: task.id,
          generatedImageUrl: task.mediaUrl,
        } : {}),
        error: undefined,
      };
    }
    if (task.status === "failed") {
      return { ...shot, status: "failed", progress: 100, error: task.error };
    }
    return {
      ...shot,
      status: task.status === "queued" ? "queued" : "generating",
      progress: task.progress,
    };
  });
}

function StatusDot({ status }) {
  if (status === "completed") return <IconCheck size={13} stroke={2.6} />;
  if (status === "failed") return <IconAlertTriangle size={13} stroke={2.4} />;
  if (status === "generating") return <IconLoader2 className="spin" size={13} stroke={2.4} />;
  if (status === "sample") return <IconPhoto size={13} stroke={2.2} />;
  return <span className="waiting-dot" />;
}

function AppHeader({
  activeView,
  zoom,
  onZoom,
  onOpenCanvas,
  onGenerate,
  onBatch,
  onExport,
  serviceState,
  keyConfigured,
  generationDisabled,
  batchDisabled,
  batchState,
  videosReady,
  exporting,
  shotCount,
  generationLabel,
  production,
}) {
  const serviceLabel = serviceState === "loading"
    ? "正在连接本地服务"
    : serviceState === "error"
      ? "服务连接失败"
      : production
        ? "D1 生产包已接受"
      : keyConfigured
        ? "模型密钥已配置"
        : "等待配置模型密钥";
  const activeLabel = navItems.find((item) => item.id === activeView)?.label || "画布";
  const projectName = production?.project?.name || "正在接收生产包";
  const packageInfo = production?.package;
  const goldenTruth = production?.truthManifest?.entries?.find(
    (entry) => entry.capabilityId === "demo.local-life-golden-path",
  );
  const controlPlaneBase = import.meta.env.VITE_CONTROL_PLANE_URL || "http://localhost:5173";
  const returnUrl = `${controlPlaneBase}${production?.links?.returnPath || "/enterprise/projects/demo-local-001"}`;
  return (
    <header className="app-header">
      <div className="brand-lockup">
        <img src="/media/storycanvas-logo.png" alt="StoryCanvas" />
        <strong>StoryCanvas <span>故事画布</span></strong>
      </div>
      <div className="breadcrumb">
        <span>{projectName}</span><b>/</b><strong>{activeLabel}</strong>
        {packageInfo && (
          <span title={`${packageInfo.packageId} · ${packageInfo.digest} · source ${packageInfo.sourceSuiteDigest}`}>
            {packageInfo.packageId} v{packageInfo.packageVersion} · {packageInfo.digest.slice(7, 15)}…
          </span>
        )}
        {goldenTruth && <strong>{goldenTruth.mode}</strong>}
        <a href={returnUrl} style={{ color: "#075fe8", textDecoration: "none", fontWeight: 650 }}>返回企业项目</a>
      </div>
      <div className={`save-state ${serviceState}`}>
        {serviceState === "loading" ? <IconLoader2 className="spin" size={16} /> : <IconDeviceFloppy size={16} />}
        {serviceLabel}
      </div>
      <div className="header-actions">
        {activeView === "canvas" ? (
          <>
            <div className="zoom-control" aria-label="画布缩放">
              <button onClick={() => onZoom(-8)} aria-label="缩小"><IconMinus size={16} /></button>
              <span>{zoom}%</span>
              <button onClick={() => onZoom(8)} aria-label="放大"><IconPlus size={16} /></button>
              <button onClick={() => onZoom(100 - zoom)} aria-label="适合画布"><IconMaximize size={16} /></button>
            </div>
            {!production && (
              <button
                className="secondary-action batch-action"
                onClick={videosReady ? onExport : onBatch}
                disabled={videosReady ? exporting : batchDisabled}
              >
                {batchState?.running || exporting
                  ? <IconLoader2 className="spin" size={17} />
                  : videosReady
                    ? <IconDownload size={17} />
                    : <IconBolt size={17} />}
                {exporting
                  ? "正在合并"
                  : batchState?.running
                    ? `生成全部 ${batchState.current}/${batchState.total}`
                    : videosReady
                      ? "合并导出"
                      : `生成全部 ${shotCount} 镜头`}
              </button>
            )}
            <button className="primary-action" onClick={onGenerate} disabled={generationDisabled}><IconSparkles size={17} /> {generationLabel}</button>
          </>
        ) : (
          <button className="primary-action module-return" onClick={onOpenCanvas}>
            <IconLayoutKanban size={17} /> 返回画布
          </button>
        )}
      </div>
    </header>
  );
}

function AppNav({ active, onChange }) {
  return (
    <nav className="app-nav" aria-label="主导航">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={active === id ? "active" : ""}
          onClick={() => onChange(id)}
          aria-current={active === id ? "page" : undefined}
        >
          <Icon size={24} stroke={1.8} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

function ScriptOutline({ shots, selectedId, onSelect, onAdd }) {
  return (
    <aside className="script-outline">
      <h2>脚本大纲</h2>
      <div className="outline-list">
        {shots.map((shot) => (
          <button
            key={shot.id}
            className={selectedId === shot.id ? "active" : ""}
            onClick={() => onSelect(shot.id)}
          >
            <i />
            <span className="outline-copy">
              <strong>{shot.section}</strong>
              <small>{shot.range}</small>
              <em>{shot.description.slice(0, 13)}</em>
            </span>
          </button>
        ))}
      </div>
      <button className="add-section" onClick={onAdd}><IconPlus size={15} /> 新增章节</button>
    </aside>
  );
}

function ShotNode({ shot, index, selected, onSelect }) {
  const nodeOffset = nodeOffsets[index] ?? (index % 2 === 0 ? -10 : 26);

  return (
    <motion.button
      className={`shot-node ${selected ? "selected" : ""}`}
      style={{ y: nodeOffset }}
      onClick={() => onSelect(shot.id)}
      drag
      dragMomentum={false}
      dragElastic={0.08}
      whileDrag={{ scale: 1.03, zIndex: 20, cursor: "grabbing" }}
      whileHover={{ y: nodeOffset - 6 }}
      animate={{ scale: selected ? 1.04 : 1 }}
      transition={{ type: "spring", stiffness: 360, damping: 28 }}
      aria-pressed={selected}
    >
      <div className="shot-image">
        {shot.mediaType === "video" && shot.mediaUrl
          ? <video src={shot.mediaUrl} muted loop autoPlay playsInline aria-label={shot.title} />
          : shot.mediaUrl || shot.image
            ? <img src={shot.mediaUrl || shot.image} alt={shot.title} />
            : (
              <div className="shot-placeholder" role="img" aria-label={`${shot.title}受控素材状态`}>
                <IconPhoto size={24} />
                <span>
                  {shot.status === "completed"
                    ? "Demo 资产已登记"
                    : shot.matchStatus === "matched"
                      ? "受控素材引用"
                      : shot.matchStatus === "reshoot"
                        ? "等待补拍"
                        : "等待生成"}
                </span>
              </div>
            )}
        <span className="shot-number">{String(shot.id).padStart(2, "0")}</span>
      </div>
      <div className="shot-title-row">
        <strong>{shot.shortTitle}</strong><span>{shot.duration}s</span>
      </div>
      <div className={`shot-status ${shot.status}`}>
        <StatusDot status={shot.status} /> {statusLabel[shot.status]} {["generating", "queued"].includes(shot.status) && `${shot.progress || 0}%`}
      </div>
      <p>{shot.description}</p>
    </motion.button>
  );
}

function ReferenceNode({ title, image, alt }) {
  return (
    <motion.div className="reference-node" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <strong>{title}</strong>
      <img src={image} alt={alt} />
    </motion.div>
  );
}

function CanvasWorkspace({ shots, selectedId, zoom, onSelect, continuityShot, entities }) {
  const visibleReferences = (continuityShot?.references || [])
    .filter((reference) => reference.sourceUri && !reference.sourceUri.startsWith("demo://"))
    .slice(0, 3);

  return (
    <section className="canvas-workspace">
      <div className="canvas-tools">
        <span><IconFocusCentered size={15} /> 镜头关系</span>
        <span><IconArrowsMove size={15} /> 拖动调整顺序</span>
      </div>
      <motion.div
        className="canvas-stage"
        animate={{ scale: zoom / 84 }}
        transition={{ type: "spring", stiffness: 240, damping: 30 }}
        style={{ transformOrigin: "center center" }}
      >
        <div className="story-line" />
        <div className="shot-sequence">
          {shots.map((shot, index) => (
            <ShotNode
              key={shot.id}
              shot={shot}
              index={index}
              selected={selectedId === shot.id}
              onSelect={onSelect}
            />
          ))}
        </div>
        <AnimatePresence>
          {visibleReferences.length > 0 && (
            <motion.div
              className="reference-cluster"
              style={{ "--reference-count": visibleReferences.length }}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <div className="reference-branches" />
              {visibleReferences.map((reference) => {
                const entity = entities?.find((candidate) => candidate.id === reference.entityId);
                const title = entity?.name || referenceRoleLabel[reference.role] || "镜头参考";
                return (
                  <ReferenceNode
                    key={reference.id}
                    title={title}
                    image={reference.sourceUri}
                    alt={`${title}参考`}
                  />
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </section>
  );
}

function stateValue(value) {
  if (value === null) return "无";
  if (typeof value === "boolean") return value ? "是" : "否";
  return String(value);
}

function statePathLabel(path, entities) {
  const [slug, ...rest] = path.split(".");
  const entity = entities.find((candidate) => candidate.slug === slug);
  return `${entity?.name || slug} · ${rest.join(".")}`;
}

function ContinuitySummary({ continuityShot, entities, onOpen }) {
  const inheritedEntities = continuityShot?.entities || [];
  const relation = continuityShot?.relation;
  const relationLabel = relationOptions.find((option) => option.value === relation?.relationType)?.label
    || (continuityShot?.contract?.shotId === 1 ? "开场" : "未设置");

  return (
    <section className="continuity-summary" aria-label="有效记忆">
      <div className="continuity-summary-title">
        <span><IconBrain size={15} /> 有效记忆</span>
        <button onClick={onOpen}>管理</button>
      </div>
      <div className="continuity-summary-line">
        <strong>{inheritedEntities.length}</strong>
        <span>个实体</span>
        <i />
        <strong>{continuityShot?.references?.length || 0}</strong>
        <span>张参考</span>
        <i />
        <span>{relationLabel}</span>
      </div>
      {inheritedEntities.length > 0
        ? <p>{inheritedEntities.map((entity) => entity.name).join("、")}</p>
        : <p>当前镜头尚未绑定人物、物品或场景记忆。</p>}
      {continuityShot?.errors?.length > 0 && (
        <div className="continuity-conflict"><IconAlertTriangle size={14} /> {continuityShot.errors[0]}</div>
      )}
    </section>
  );
}

function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      className={`toggle ${checked ? "checked" : ""}`}
      onClick={() => onChange(!checked)}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
    >
      <span />
    </button>
  );
}

function Inspector({
  shot,
  locked,
  onLocked,
  onChange,
  onRegenerate,
  onDelete,
  generationKind,
  onGenerationKind,
  capabilities,
  taskError,
  generating,
  continuityShot,
  continuityEntities,
  onOpenMemory,
}) {
  const capability = capabilities?.[generationKind];
  const demoScenario = demoScenarioForShot(shot, generationKind);
  const available = Boolean(capability?.available || demoScenario);
  const protectsExistingImage = generationKind === "image" && Boolean(shot.generatedImageTaskId);
  return (
    <motion.aside
      key={shot.id}
      className="inspector"
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="inspector-heading">
        <h2>镜头 {String(shot.id).padStart(2, "0")} · {shot.title}</h2>
        <div className="lock-control">
          {locked ? <IconLock size={15} /> : <IconLockOpen size={15} />}
          <span>锁定</span>
          <Toggle checked={locked} onChange={onLocked} label="镜头锁定" />
        </div>
      </div>

      <ContinuitySummary
        continuityShot={continuityShot}
        entities={continuityEntities}
        onOpen={onOpenMemory}
      />

      <label className="field-label">画面提示词</label>
      <textarea
        value={shot.imagePrompt}
        onChange={(event) => onChange("imagePrompt", event.target.value)}
        rows={6}
      />
      <div className="char-count">{shot.imagePrompt.length}/500</div>

      <label className="field-label">视频提示词</label>
      <textarea
        value={shot.videoPrompt}
        onChange={(event) => onChange("videoPrompt", event.target.value)}
        rows={5}
      />
      <div className="char-count">{shot.videoPrompt.length}/500</div>

      <label className="field-label" htmlFor="generationKind">生成内容</label>
      <div className="generation-kind" id="generationKind">
        <button className={generationKind === "image" ? "active" : ""} onClick={() => onGenerationKind("image")}>
          <IconPhoto size={16} /> 图片
        </button>
        <button className={generationKind === "video" ? "active" : ""} onClick={() => onGenerationKind("video")}>
          <IconMovie size={16} /> 视频
        </button>
      </div>

      <label className="field-label" htmlFor="model">{demoScenario ? "确定性 Demo Provider" : "D1 canonical 隔离"}</label>
      <select id="model" value={demoScenario ? "deterministic-demo-v1" : capability?.model || ""} disabled>
        <option value={demoScenario ? "deterministic-demo-v1" : capability?.model || ""}>
          {demoScenario ? "DemoGenerator · deterministic-demo-v1 · MOCK-CONTRACT" : "旧 Provider 仅限非 D1 legacy mode"}
        </option>
      </select>

      {protectsExistingImage && (
        <div className="image-protection-note">
          <IconLock size={15} />
          <span><strong>当前图片已保护</strong><small>重新生成前必须二次确认，原图仍会保留在历史记录中。</small></span>
        </div>
      )}

      {generationKind === "video" && (
        <>
          <label className="field-label" htmlFor="duration">视频时长</label>
          <select id="duration" value={shot.duration} onChange={(event) => onChange("duration", Number(event.target.value))}>
            <option value={4}>4 秒</option>
            <option value={5}>5 秒</option>
            <option value={6}>6 秒</option>
            <option value={8}>8 秒</option>
            <option value={10}>10 秒</option>
            <option value={12}>12 秒</option>
          </select>
        </>
      )}

      {shot.mediaType === "video" && shot.mediaUrl && (
        <video className="generated-preview" src={shot.mediaUrl} controls playsInline />
      )}

      {taskError && <div className="generation-error"><IconAlertTriangle size={16} /><span>{taskError}</span></div>}

      <div className="lock-row">
        <div><strong>镜头锁定</strong><small>锁定后将不会被自动编排或批量替换</small></div>
        <Toggle checked={locked} onChange={onLocked} label="镜头锁定" />
      </div>

      <button className="regenerate" onClick={onRegenerate} disabled={locked || generating || !available}>
        {generating ? <IconLoader2 className="spin" size={18} /> : <IconRefresh size={18} />}
        {locked
          ? "先解锁再生成"
          : generating
            ? "正在登记 MOCK-CONTRACT"
            : !available
              ? "D1 canonical 禁止旧生成入口"
              : demoScenario
                ? demoScenario === "success" ? "生成合规权益图卡 · MOCK-CONTRACT" : "打开预置失败任务 · MOCK-CONTRACT"
              : protectsExistingImage
                ? "重新生成图片（需确认）"
                : `生成${generationKind === "image" ? "图片" : "视频"}`}
      </button>
      <div className="inspector-hints"><span><IconArrowsMove size={14} /> 拖拽节点可调整顺序</span><span><IconFocusCentered size={14} /> 滚轮缩放，按住空格拖动画布</span></div>
      <button className="delete-shot" onClick={onDelete}><IconTrash size={16} /> 删除此镜</button>
    </motion.aside>
  );
}

function ModuleHeading({ eyebrow, title, description, action }) {
  return (
    <header className="module-heading">
      <div>
        <span>{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </header>
  );
}

function ProjectWorkspace({ shots, onOpenShot, production, onFallbackExport, exporting }) {
  const completed = shots.filter((shot) => shot.status === "completed").length;
  const mockCompleted = shots.filter((shot) => shot.status === "completed" && shot.truthMode === "MOCK-CONTRACT").length;
  const realCompleted = shots.filter((shot) => shot.status === "completed" && shot.truthMode === "REAL-CAP").length;
  const totalDuration = shots.reduce((total, shot) => total + shot.duration, 0);
  const progress = shots.length ? Math.round((completed / shots.length) * 100) : 0;
  const cover = shots.find((shot) => shot.mediaUrl) || shots[0];
  const project = production?.project;
  const packageInfo = production?.package;
  const truthModes = [...new Set((production?.truthManifest?.entries || []).map((entry) => entry.mode))];

  return (
    <section className="module-page project-page">
      <ModuleHeading
        eyebrow="PROJECT 01"
        title="项目总览"
        description={`查看 ${project?.projectId || "demo-local-001"} 的不可变生产包、8 镜结构与当前可交付内容。`}
        action={<button className="module-primary" onClick={() => onOpenShot(cover.id)}><IconLayoutKanban size={17} /> 继续编辑画布</button>}
      />

      <div className="project-lead">
        <div className="project-cover">
          {cover.mediaType === "video" && cover.mediaUrl
            ? <video src={cover.mediaUrl} muted loop autoPlay playsInline aria-label="项目封面视频" />
            : cover.mediaUrl || cover.image
              ? <img src={cover.mediaUrl || cover.image} alt={`${project?.name || "项目"}封面`} />
              : <div className="shot-placeholder"><IconPhoto size={28} /><span>受控素材引用</span></div>}
          <span>9:16 · 本地生活</span>
        </div>
        <div className="project-summary">
          <div className="project-kicker">{project?.projectId} · {project?.platform} · {project?.aspectRatio}</div>
          <h2>{project?.name || "正在读取 canonical 项目"}</h2>
          <p>
            批准脚本 {production?.script?.id || "—"} 与 {(production?.claims || []).map((claim) => claim.id).join("—") || "Claims"}
            通过 {packageInfo?.contractVersion || "—"} 合同接入；当前登记 {mockCompleted} 个 MOCK-CONTRACT 结果，真实 Provider 结果 {realCompleted} 个。
          </p>
          <p style={{ fontSize: 12, color: "#59606b" }}>
            {truthModes.map((mode) => <span key={mode} style={{ marginRight: 8, fontWeight: 700 }}>{mode}</span>)}
          </p>
          <p style={{ fontSize: 11, color: "#777b83" }}>
            {packageInfo?.packageId} v{packageInfo?.packageVersion} · digest {packageInfo?.digest}
          </p>
          <div className="project-metrics">
            <div><strong>{shots.length}</strong><span>镜头</span></div>
            <div><strong>{totalDuration}s</strong><span>总时长</span></div>
            <div><strong>{progress}%</strong><span>合同登记进度</span></div>
          </div>
          <div className="project-progress"><motion.span animate={{ width: `${progress}%` }} /></div>
        </div>
      </div>

      <div className="module-section-heading">
        <div><span>CONTRACT SNAPSHOT</span><h2>批准事实与规则</h2></div>
        <small>{packageInfo?.status} · contract {packageInfo?.contractVersion}</small>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 16, marginBottom: 28 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {(production?.claims || []).map((claim) => (
            <div key={claim.id} style={{ padding: "10px 12px", border: "1px solid #e4e5e2", borderRadius: 7, background: "#fff", fontSize: 12 }}>
              <strong style={{ color: "#075fe8", marginRight: 7 }}>{claim.id}</strong>{claim.text}
            </div>
          ))}
        </div>
        <div style={{ padding: 14, border: "1px solid #e4e5e2", borderRadius: 7, background: "#fff", fontSize: 12 }}>
          <strong>风险规则</strong>
          <p>{(production?.riskRules?.restrictions || []).join(" · ")}</p>
          <small>禁用词：{(production?.riskRules?.prohibitedWords || []).join("、")}</small>
          {production?.artifact && (
            <div style={{ marginTop: 14, padding: 12, border: "2px solid #e87918", borderRadius: 8, background: "#fff8ed" }}>
              <strong style={{ color: "#a74300" }}>
                本地合成演示片，仅验证流程，不代表 AI 生成质量或正式交付
              </strong>
              <p style={{ margin: "7px 0" }}>
                FALLBACK · DEMO_ONLY · 非 REAL · {production.artifact.status}<br />
                technical playback QA: {production.artifact.technicalQa} · editorial QA: {production.artifact.editorialQa} · brand QA: {production.artifact.brandQa}
              </p>
              {production.artifact.playable && production.artifact.mediaUrl && (
                <video
                  src={production.artifact.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                  style={{ width: "100%", maxHeight: 420, background: "#111", borderRadius: 6 }}
                  aria-label="本地纯合成 FALLBACK 演示片"
                />
              )}
              <small>
                SELF_GENERATED_SYNTHETIC / NO_THIRD_PARTY_ASSET · {production.artifact.dimensions?.width}×{production.artifact.dimensions?.height}
                {" · "}{production.artifact.durationSeconds}s · {production.artifact.codecs?.video}/{production.artifact.codecs?.audio}
                <br />不宣称 FireRed、真实 Provider、正式海底捞营销素材或品牌审核通过。
              </small>
            </div>
          )}
          <button
            className="module-secondary"
            onClick={onFallbackExport}
            disabled={exporting}
            style={{ marginTop: 12 }}
          >
            {exporting ? <IconLoader2 className="spin" size={15} /> : <IconTimelineEvent size={15} />}
            {production?.artifact?.playable ? "刷新本地合成 Demo · FALLBACK" : "登记本地合成 Demo · FALLBACK"}
          </button>
        </div>
      </div>

      <div className="module-section-heading">
        <div><span>STRUCTURE</span><h2>镜头结构</h2></div>
        <small>点击任一镜头回到画布定位</small>
      </div>
      <div className="project-shot-list">
        {shots.map((shot) => (
          <button key={shot.id} onClick={() => onOpenShot(shot.id)}>
            <span className="project-shot-number">{String(shot.id).padStart(2, "0")}</span>
            <span className="project-shot-copy"><strong>{shot.section}</strong><small>{shot.title}</small></span>
            <span>{shot.range}</span>
            <span className={`project-shot-state ${shot.status}`}><StatusDot status={shot.status} /> {statusLabel[shot.status]}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ScriptWorkspace({ shots, selectedId, onSelect, onChange, onAdd }) {
  const shot = shots.find((item) => item.id === selectedId) || shots[0];
  return (
    <section className="module-page script-page">
      <ModuleHeading
        eyebrow="SCRIPT"
        title="脚本编辑"
        description="在同一条时间线上调整段落、旁白和每个镜头的生成提示词。"
        action={<button className="module-secondary" onClick={onAdd}><IconPlus size={16} /> 新增章节</button>}
      />
      <div className="script-editor-layout">
        <aside className="script-chapter-list">
          <div className="script-list-label"><span>{shots.length} 个章节</span><small>{shots.reduce((sum, item) => sum + item.duration, 0)} 秒</small></div>
          {shots.map((item) => (
            <button key={item.id} className={item.id === selectedId ? "active" : ""} onClick={() => onSelect(item.id)}>
              <span>{String(item.id).padStart(2, "0")}</span>
              <div><strong>{item.section}</strong><small>{item.description}</small></div>
              <em>{item.duration}s</em>
            </button>
          ))}
        </aside>
        <motion.div className="script-form" key={shot.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <div className="script-form-title">
            <span>镜头 {String(shot.id).padStart(2, "0")} · {shot.range}</span>
            <strong>{shot.title}</strong>
          </div>
          <div className="script-form-row">
            <label>章节名称<input value={shot.section} onChange={(event) => onChange("section", event.target.value)} /></label>
            <label>镜头标题<input value={shot.title} onChange={(event) => onChange("title", event.target.value)} /></label>
          </div>
          <label>旁白与内容<textarea rows={3} value={shot.description} onChange={(event) => onChange("description", event.target.value)} /></label>
          <label>画面提示词<textarea rows={4} value={shot.imagePrompt} onChange={(event) => onChange("imagePrompt", event.target.value)} /></label>
          <label>视频提示词<textarea rows={4} value={shot.videoPrompt} onChange={(event) => onChange("videoPrompt", event.target.value)} /></label>
          <div className="script-form-footer">
            <span><IconCheck size={15} /> 修改已同步到当前画布</span>
            <label>时长
              <select value={shot.duration} onChange={(event) => onChange("duration", Number(event.target.value))}>
                {[4, 5, 6, 8, 10, 12].map((duration) => <option key={duration} value={duration}>{duration} 秒</option>)}
              </select>
            </label>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function MemoryWorkspace({
  shots,
  selectedId,
  onSelect,
  continuity,
  saving,
  onPatch,
  readOnly = false,
}) {
  const shot = shots.find((item) => item.id === selectedId) || shots[0];
  const internalShotId = shot?.internalId || selectedId;
  const continuityShot = continuity?.shots?.[String(internalShotId)];
  const contract = continuityShot?.contract || {
    shotId: selectedId,
    entitySlugs: [],
    mustPreserve: ["项目视觉风格"],
    requiredState: {},
    statePatch: {},
  };
  const selectedSlugs = new Set(contract.entitySlugs);
  const relation = continuityShot?.relation;
  const relationType = relation?.relationType
    || contract.transition?.relationType
    || (selectedId === 1 ? "opening" : "same-scene-cut");
  const relationMeta = relationOptions.find((option) => option.value === relationType);
  const relevantEvents = (continuity?.events || []).filter((event) => (
    event.afterShotId === internalShotId
  ));
  const stateEntries = Object.entries(continuityShot?.stateAtStart || {})
    .filter(([path]) => selectedSlugs.has(path.split(".")[0]));
  const mutationEntries = Object.entries(contract.statePatch || {});

  function toggleEntity(slug) {
    const next = selectedSlugs.has(slug)
      ? contract.entitySlugs.filter((candidate) => candidate !== slug)
      : [...contract.entitySlugs, slug];
    onPatch({ entitySlugs: next });
  }

  function changeRelation(nextRelationType) {
    onPatch({
      relationType: nextRelationType,
      ...(nextRelationType !== "continuous-action" ? { usePreviousEndFrame: false } : {}),
    });
  }

  return (
    <section className="module-page memory-page">
      <ModuleHeading
        eyebrow={`WORLD MEMORY · v${continuity?.profile?.revision || "—"}`}
        title="世界记忆"
        description="让人物、物品与场景持续存在；镜头只读取所需记忆，并通过事件推进世界状态。"
        action={(
          <div className={`memory-save-state ${saving ? "saving" : ""}`}>
            {saving ? <IconLoader2 className="spin" size={15} /> : <IconCheck size={15} />}
            {saving ? "正在更新镜头上下文" : readOnly ? "D1 canonical 只读" : "上下文已编译"}
          </div>
        )}
      />

      <div className="memory-layout">
        <aside className="memory-shot-rail" aria-label="镜头契约">
          <div className="memory-column-heading">
            <span>SHOT CONTRACT</span>
            <strong>镜头契约</strong>
          </div>
          {shots.map((item) => {
            const itemMemory = continuity?.shots?.[String(item.internalId || item.id)];
            return (
              <button
                key={item.id}
                className={item.id === selectedId ? "active" : ""}
                onClick={() => onSelect(item.id)}
              >
                <span>{String(item.id).padStart(2, "0")}</span>
                <div>
                  <strong>{item.section}</strong>
                  <small>{itemMemory?.contract?.entitySlugs?.length || 0} 个实体 · {item.range}</small>
                </div>
                {itemMemory?.errors?.length
                  ? <IconAlertTriangle size={14} />
                  : <IconCheck size={14} />}
              </button>
            );
          })}
        </aside>

        <div className="memory-entities">
          <div className="memory-column-heading">
            <span>CANONICAL MEMORY</span>
            <strong>镜头 {String(selectedId).padStart(2, "0")} 读取的实体</strong>
            <small>点击实体决定生成时继承哪些身份、外观与参考。</small>
          </div>
          <div className="entity-memory-list">
            {(continuity?.entities || []).map((entity) => {
              const active = selectedSlugs.has(entity.slug);
              const meta = entityTypeMeta[entity.entityType] || entityTypeMeta.object;
              const EntityIcon = meta.icon;
              const reference = entity.references?.find(
                (candidate) => candidate.sourceUri && !candidate.sourceUri.startsWith("demo://"),
              );
              return (
                <button
                  key={entity.id}
                  className={active ? "active" : ""}
                  onClick={() => toggleEntity(entity.slug)}
                  disabled={saving || readOnly}
                  aria-pressed={active}
                  aria-label={`${active ? "取消绑定" : "绑定"}${entity.name}`}
                >
                  <div className="entity-reference">
                    {reference?.sourceUri
                      ? <img src={reference.sourceUri} alt="" />
                      : <EntityIcon size={20} />}
                  </div>
                  <div className="entity-memory-copy">
                    <span><EntityIcon size={13} /> {meta.label}</span>
                    <strong>{entity.name}</strong>
                    <p>{entity.canonical?.description || "已建立稳定实体标准"}</p>
                    <small>{entity.canonical?.invariants?.join(" · ") || "身份与外观保持一致"}</small>
                  </div>
                  <span className="entity-bind-state">{active ? "已继承" : "未使用"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <aside className="memory-contract-panel">
          <div className="memory-contract-header">
            <span>镜头 {String(selectedId).padStart(2, "0")} · {shot.title}</span>
            <strong>状态与切镜</strong>
          </div>

          {selectedId > 1 && (
            <section className="memory-control-section">
              <label htmlFor="memoryRelation">与上一镜头的关系</label>
              <select
                id="memoryRelation"
                value={relationType}
                onChange={(event) => changeRelation(event.target.value)}
                disabled={saving || readOnly}
              >
                {relationOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <p>{relationMeta?.help}</p>
              <div className="memory-tail-frame">
                <div>
                  <strong>使用上一镜头尾帧</strong>
                  <small>{relationType === "continuous-action" ? "仅在动作必须无缝延续时开启" : "当前切镜依靠记忆与状态衔接"}</small>
                </div>
                <Toggle
                  checked={Boolean(relation?.usePreviousEndFrame)}
                  onChange={(value) => onPatch({ usePreviousEndFrame: value })}
                  label="使用上一镜头尾帧"
                  disabled={saving || readOnly || relationType !== "continuous-action"}
                />
              </div>
            </section>
          )}

          <section className="memory-state-section">
            <div className="memory-section-title"><IconRoute size={15} /><strong>镜头开始状态</strong><span>{stateEntries.length}</span></div>
            <div className="memory-state-list">
              {stateEntries.length > 0 ? stateEntries.map(([path, value]) => (
                <div key={path}>
                  <span>{statePathLabel(path, continuity?.entities || [])}</span>
                  <strong>{stateValue(value)}</strong>
                </div>
              )) : <p>尚无需要继承的世界状态。</p>}
            </div>
          </section>

          <section className="memory-state-section mutations">
            <div className="memory-section-title"><IconTimelineEvent size={15} /><strong>本镜头状态变化</strong><span>{mutationEntries.length}</span></div>
            <div className="memory-state-list">
              {mutationEntries.length > 0 ? mutationEntries.map(([path, value]) => (
                <div key={path}>
                  <span>{statePathLabel(path, continuity?.entities || [])}</span>
                  <strong>→ {stateValue(value)}</strong>
                </div>
              )) : <p>本镜头不改写世界状态。</p>}
            </div>
          </section>

          <section className="memory-event-section">
            <div className="memory-section-title"><IconTimelineEvent size={15} /><strong>相邻世界事件</strong></div>
            {relevantEvents.length > 0 ? relevantEvents.map((event) => (
              <div className="memory-event" key={event.id}>
                <i />
                <span>镜头 {String(event.afterShotId).padStart(2, "0")} 后</span>
                <strong>{event.title}</strong>
              </div>
            )) : <p>开场状态来自实体记忆。</p>}
          </section>

          {(continuityShot?.errors?.length > 0 || continuityShot?.warnings?.length > 0) && (
            <section className="memory-validation">
              {(continuityShot.errors || []).map((message) => (
                <p className="error" key={message}><IconAlertTriangle size={14} /> {message}</p>
              ))}
              {(continuityShot.warnings || []).map((message) => (
                <p key={message}><IconAlertTriangle size={14} /> {message}</p>
              ))}
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}

function AssetsWorkspace({ shots, onOpenShot }) {
  const [filter, setFilter] = useState("all");
  const visibleShots = shots.filter((shot) => {
    if (filter === "generated") return shot.status === "completed";
    if (filter === "samples") return shot.status !== "completed";
    return true;
  });
  const generatedCount = shots.filter((shot) => shot.status === "completed").length;

  return (
    <section className="module-page assets-page">
      <ModuleHeading
        eyebrow="MEDIA"
        title="素材库"
        description="统一查看受控参考、MOCK-CONTRACT 登记与 FALLBACK 状态；真实 Provider 结果只按 REAL-CAP 统计。"
        action={(
          <div className="asset-filters" aria-label="素材筛选">
            {[["all", "全部"], ["generated", `已生成 ${generatedCount}`], ["samples", "参考素材"]].map(([id, label]) => (
              <button key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>{label}</button>
            ))}
          </div>
        )}
      />
      <div className="asset-grid">
        {visibleShots.map((shot) => (
          <article className="asset-item" key={shot.id}>
            <div className="asset-media">
              {shot.mediaType === "video" && shot.mediaUrl
                ? <video src={shot.mediaUrl} controls playsInline preload="metadata" aria-label={`${shot.title}视频`} />
                : shot.mediaUrl || shot.image
                  ? <img src={shot.mediaUrl || shot.image} alt={shot.title} />
                  : <div className="asset-empty"><IconPhoto size={28} /><span>等待生成素材</span></div>}
              <span>{shot.truthMode || (shot.status === "completed" ? "MOCK-CONTRACT" : "REFERENCE")}</span>
            </div>
            <footer>
              <div><strong>{String(shot.id).padStart(2, "0")} · {shot.title}</strong><small>{shot.section} · {shot.duration} 秒 · {statusLabel[shot.status]}</small></div>
              <button onClick={() => onOpenShot(shot.id)}>在画布中定位</button>
            </footer>
          </article>
        ))}
      </div>
      {!visibleShots.length && <div className="asset-no-result"><IconPhoto size={26} /><strong>当前筛选下还没有素材</strong></div>}
    </section>
  );
}

function characterStatusLabel(status) {
  if (status === "Active") return "海外审核通过";
  if (status === "Local") return "仅本机";
  if (status === "Failed") return "审核失败";
  return "海外审核中";
}

function CharacterAssetsWorkspace({ continuity, onContinuityChange, onNotice }) {
  const [workspace, setWorkspace] = useState({
    configured: false,
    group: null,
    assets: [],
    imageModels: [],
    remoteError: null,
  });
  const [selectedAssetId, setSelectedAssetId] = useState("");
  const [imageModel, setImageModel] = useState("seedream");
  const [profile, setProfile] = useState(emptyCharacterProfile);
  const [additionalPrompt, setAdditionalPrompt] = useState("");
  const [referenceImage, setReferenceImage] = useState("");
  const [referenceName, setReferenceName] = useState("");
  const [selectedEntityId, setSelectedEntityId] = useState("");
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState("");
  const [task, setTask] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");
  const characterEntities = (continuity?.entities || []).filter((entity) => entity.entityType === "character");
  const selectedAsset = workspace.assets.find((asset) => asset.id === selectedAssetId) || null;

  async function refreshCharacters(preferredAssetId) {
    const next = await mvpApi.getCharacters();
    setWorkspace(next);
    setImageModel((current) => (
      next.imageModels?.some((model) => model.id === current && model.available)
        ? current
        : next.imageModels?.find((model) => model.available)?.id || current
    ));
    const nextSelection = preferredAssetId
      || (next.assets.some((asset) => asset.id === selectedAssetId) ? selectedAssetId : next.assets[0]?.id)
      || "";
    setSelectedAssetId(nextSelection);
    const asset = next.assets.find((candidate) => candidate.id === nextSelection);
    if (asset?.profile) setProfile({ ...emptyCharacterProfile, ...asset.profile });
    return next;
  }

  useEffect(() => {
    let cancelled = false;
    mvpApi.getCharacters()
      .then((data) => {
        if (cancelled) return;
        setWorkspace(data);
        setImageModel((current) => (
          data.imageModels?.some((model) => model.id === current && model.available)
            ? current
            : data.imageModels?.find((model) => model.available)?.id || current
        ));
        const first = data.assets[0];
        if (first) {
          setSelectedAssetId(first.id);
          setProfile({ ...emptyCharacterProfile, ...first.profile });
        }
        setSelectedEntityId((continuity?.entities || []).find((entity) => entity.entityType === "character")?.id || "");
      })
      .catch((error) => {
        if (!cancelled) setErrorMessage(error.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!task?.id || !["queued", "running"].includes(task.status)) return undefined;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const next = await mvpApi.getCharacterTask(task.id);
        if (cancelled) return;
        setTask(next);
        if (next.status === "succeeded") {
          await refreshCharacters(next.characterAssetId);
          onNotice("角色设定板已生成并通过海外资产库审核");
        } else if (next.status === "failed") {
          setErrorMessage(next.error || "角色设定板生成失败");
        }
      } catch (error) {
        if (!cancelled) setErrorMessage(error.message);
      }
    }, 1600);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [task?.id, task?.status]);

  function selectAsset(asset) {
    setSelectedAssetId(asset.id);
    setProfile({ ...emptyCharacterProfile, ...asset.profile });
    setReferenceImage("");
    setReferenceName("");
    setErrorMessage("");
  }

  function startNewCharacter() {
    setSelectedAssetId("");
    setProfile(emptyCharacterProfile);
    setAdditionalPrompt("");
    setReferenceImage("");
    setReferenceName("");
    setTask(null);
    setErrorMessage("");
  }

  function updateProfile(field, value) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function chooseReference(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setErrorMessage("请选择 PNG、JPEG 或 WebP 人物图片。");
      return;
    }
    if (file.size > 30_000_000) {
      setErrorMessage("人物图片不能超过 30 MB。");
      return;
    }
    try {
      setReferenceImage(await readBlobAsDataUrl(file));
      setReferenceName(file.name);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(error.message);
    }
  }

  async function saveUpload() {
    if (!profile.name.trim()) {
      setErrorMessage("请先填写角色名称。");
      return;
    }
    if (!referenceImage) {
      setErrorMessage("请先选择要保存的人物图片。");
      return;
    }
    setAction("upload");
    setErrorMessage("");
    try {
      const asset = await mvpApi.uploadCharacter({
        profile,
        image: referenceImage,
        idempotencyKey: window.crypto.randomUUID(),
      });
      setWorkspace((current) => ({
        ...current,
        assets: [asset, ...current.assets.filter((candidate) => candidate.id !== asset.id)],
      }));
      setSelectedAssetId(asset.id);
      onNotice("人物图片已保存到本机角色库");
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAction("");
    }
  }

  async function generateCharacter() {
    if (!profile.name.trim()) {
      setErrorMessage("请先填写角色名称。");
      return;
    }
    if (!workspace.configured) {
      setErrorMessage("海外 BytePlus 资产库尚未配置，无法生成可信角色资产。");
      return;
    }
    const modelOption = workspace.imageModels?.find((model) => model.id === imageModel);
    if (!modelOption?.available) {
      const reason = !modelOption?.keyConfigured
        ? "模型密钥尚未配置。"
        : "海外 TOS 中转尚未就绪，无法注册可信人物资产。";
      setErrorMessage(`${modelOption?.label || "所选图片模型"}当前不可用：${reason}`);
      return;
    }
    setAction("generate");
    setTask(null);
    setErrorMessage("");
    try {
      const next = await mvpApi.generateCharacter({
        profile,
        imageModel,
        additionalPrompt,
        ...(referenceImage ? { referenceImage } : {}),
        idempotencyKey: window.crypto.randomUUID(),
      });
      setTask(next);
      const modelLabel = workspace.imageModels?.find((model) => model.id === imageModel)?.label || imageModel;
      onNotice(`已提交 ${modelLabel} 角色设定板任务`);
      if (next.status === "succeeded") {
        await refreshCharacters(next.characterAssetId);
        onNotice("角色设定板已生成并通过海外资产库审核");
      }
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAction("");
    }
  }

  async function bindToMemory() {
    if (!selectedAsset || !selectedEntityId) return;
    setAction("bind");
    setErrorMessage("");
    try {
      const nextContinuity = await mvpApi.bindCharacter(selectedAsset.id, selectedEntityId);
      onContinuityChange(nextContinuity);
      const entityName = characterEntities.find((entity) => entity.id === selectedEntityId)?.name;
      onNotice(`${selectedAsset.name} 已绑定为${entityName || "人物"}的全局人物身份`);
    } catch (error) {
      setErrorMessage(error.message);
    } finally {
      setAction("");
    }
  }

  const previewUrl = referenceImage || selectedAsset?.previewUrl || selectedAsset?.remoteUrl;
  const selectedImageModel = workspace.imageModels?.find((model) => model.id === imageModel);
  const isTrusted = selectedAsset?.status === "Active" && Boolean(selectedAsset?.assetUri);
  const selectedEntity = characterEntities.find((entity) => entity.id === selectedEntityId);
  const alreadyBound = Boolean(selectedAsset && selectedEntity && (
    selectedEntity.canonical?.characterAssetId === selectedAsset.id
    || selectedEntity.canonical?.remoteAssetId === selectedAsset.remoteAssetId
  ));

  return (
    <section className="module-page character-page">
      <ModuleHeading
        eyebrow="CHARACTER MEMORY · BYTEPLUS GLOBAL"
        title="虚拟人物资产库"
        description="使用 Seedream 或 Image 2 生成人物设定，审核通过后绑定世界记忆，供海外 Seedance 跨镜头复用。"
        action={<button className="module-secondary" onClick={startNewCharacter}><IconPlus size={16} /> 新建角色</button>}
      />

      <div className="character-layout">
        <aside className="character-library" aria-label="人物资产">
          <div className="character-group">
            <span>海外资产组</span>
            <strong>{workspace.group?.name || (loading ? "正在连接" : "未连接")}</strong>
            <small>{workspace.group?.id || "BytePlus ap-southeast-1"}</small>
            <em className={workspace.configured ? "online" : ""}><i /> {workspace.configured ? "新加坡节点" : "等待配置"}</em>
          </div>
          <div className="character-library-heading">
            <strong>人物资产</strong>
            <span>{workspace.assets.length}</span>
          </div>
          <div className="character-asset-list">
            {loading && <div className="character-loading"><IconLoader2 className="spin" size={17} /> 正在读取海外资产</div>}
            {!loading && workspace.assets.map((asset) => (
              <button
                key={asset.id}
                className={asset.id === selectedAssetId ? "active" : ""}
                onClick={() => selectAsset(asset)}
                aria-pressed={asset.id === selectedAssetId}
              >
                <div className="character-list-image">
                  {asset.previewUrl || asset.remoteUrl
                    ? <img src={asset.previewUrl || asset.remoteUrl} alt="" />
                    : <IconUser size={20} />}
                </div>
                <div>
                  <strong>{asset.name}</strong>
                  <small>{characterStatusLabel(asset.status)}</small>
                </div>
                {asset.status === "Active" ? <IconCheck size={14} /> : <span />}
              </button>
            ))}
            {!loading && !workspace.assets.length && (
              <div className="character-empty-list"><IconUser size={22} /><span>还没有人物资产</span></div>
            )}
          </div>
          {workspace.remoteError && <p className="character-remote-error"><IconAlertTriangle size={13} /> {workspace.remoteError}</p>}
        </aside>

        <div className="character-preview">
          <div className="character-preview-toolbar">
            <div>
              <span>{referenceImage ? "REFERENCE INPUT" : selectedAsset ? "CHARACTER BOARD" : "NEW CHARACTER"}</span>
              <strong>{referenceImage ? referenceName : selectedAsset?.name || "等待人物设定"}</strong>
            </div>
            {(referenceImage || selectedAsset) && (
              <span className={`character-status ${isTrusted ? "trusted" : ""}`}>
                {referenceImage ? "待生成参考" : characterStatusLabel(selectedAsset.status)}
              </span>
            )}
          </div>
          <AnimatePresence mode="wait">
            <motion.div
              className="character-stage"
              key={previewUrl || "empty"}
              initial={{ opacity: 0, scale: 0.985 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              {previewUrl
                ? <img src={previewUrl} alt={`${profile.name || "虚拟人物"}设定板`} />
                : <div className="character-stage-empty"><IconUser size={42} /><strong>上传参考图或直接填写人物设定</strong><span>{selectedImageModel?.label || "图片模型"}将生成横版电影级角色提案板</span></div>}
            </motion.div>
          </AnimatePresence>
          <div className="character-trust-note">
            <IconCheck size={16} />
            <div>
              <strong>{isTrusted ? "可用于海外 Seedance 的可信人物引用" : "生成并审核后成为可信人物引用"}</strong>
              <p>{isTrusted ? selectedAsset.assetUri : "本机上传可直接绑定记忆；经海外资产库审核后，视频生成会自动使用 asset:// 引用，降低真人隐私风控。"}</p>
            </div>
          </div>
          {task && (
            <div className={`character-task ${task.status}`}>
              <div><span>{task.status === "failed" ? "生成失败" : task.status === "succeeded" ? "生成完成" : "生成与海外审核中"}</span><strong>{task.progress}%</strong></div>
              <div className="character-task-track"><motion.span animate={{ width: `${task.progress}%` }} /></div>
              {task.error && <p>{task.error}</p>}
            </div>
          )}
        </div>

        <aside className="character-editor">
          <div className="character-editor-heading">
            <span>CHARACTER PROFILE</span>
            <strong>人物设定</strong>
            <small>设定会写入角色提案板，并随资产绑定到人物记忆。</small>
          </div>
          <div className="character-model-field">
            <span>生成模型</span>
            <div className="character-model-switch" role="radiogroup" aria-label="角色图片模型">
              {(workspace.imageModels || []).map((model) => (
                <button
                  key={model.id}
                  type="button"
                  role="radio"
                  aria-checked={imageModel === model.id}
                  aria-label={`使用 ${model.label}`}
                  className={imageModel === model.id ? "active" : ""}
                  onClick={() => setImageModel(model.id)}
                  disabled={!model.available}
                >
                  <strong>{model.label}</strong>
                  <small>{model.available ? model.model : !model.keyConfigured ? "未配置密钥" : "等待海外 TOS"}</small>
                </button>
              ))}
            </div>
            <p>{selectedImageModel?.description || "正在读取服务端图片模型配置。"}</p>
          </div>
          <div className="character-form-row">
            <label>角色名称<input aria-label="角色名称" value={profile.name} onChange={(event) => updateProfile("name", event.target.value)} placeholder="例如：林夏" /></label>
            <label>年龄<input aria-label="年龄" value={profile.age} onChange={(event) => updateProfile("age", event.target.value)} placeholder="26 岁" /></label>
          </div>
          <div className="character-form-row">
            <label>身高<input aria-label="身高" value={profile.height} onChange={(event) => updateProfile("height", event.target.value)} placeholder="168 cm" /></label>
            <label>体型<input aria-label="体型" value={profile.bodyType} onChange={(event) => updateProfile("bodyType", event.target.value)} placeholder="修长、自然" /></label>
          </div>
          <label>风格方向<input aria-label="风格方向" value={profile.style} onChange={(event) => updateProfile("style", event.target.value)} /></label>
          <label>性格关键词<input aria-label="性格关键词" value={profile.personality} onChange={(event) => updateProfile("personality", event.target.value)} placeholder="克制、敏锐、温柔" /></label>
          <label>外貌特征<textarea aria-label="外貌特征" rows={3} value={profile.appearance} onChange={(event) => updateProfile("appearance", event.target.value)} placeholder="脸型、眼睛、发型、肤色与独特记忆点" /></label>
          <label>服装与道具<textarea aria-label="服装与道具" rows={3} value={profile.wardrobe} onChange={(event) => updateProfile("wardrobe", event.target.value)} placeholder="上装、下装、鞋子、配件与角色道具" /></label>
          <label>身份与场景<input aria-label="身份与场景" value={profile.setting} onChange={(event) => updateProfile("setting", event.target.value)} placeholder="职业、环境与社会身份" /></label>
          <label>附加提示词<textarea aria-label="附加提示词" rows={2} value={additionalPrompt} onChange={(event) => setAdditionalPrompt(event.target.value)} placeholder="可补充镜头气质或必须保留的细节" /></label>

          <div className="character-reference-input">
            <input id="characterReference" type="file" accept="image/png,image/jpeg,image/webp" onChange={chooseReference} />
            <label htmlFor="characterReference"><IconPhoto size={16} /> {referenceImage ? "更换参考图" : "上传人物参考图"}</label>
            {referenceImage && <button onClick={() => { setReferenceImage(""); setReferenceName(""); }} aria-label="移除参考图"><IconX size={15} /></button>}
          </div>
          <div className="character-actions">
            <button className="character-save" onClick={saveUpload} disabled={!referenceImage || Boolean(action)}>
              {action === "upload" ? <IconLoader2 className="spin" size={16} /> : <IconDeviceFloppy size={16} />}
              仅保存上传
            </button>
            <button className="character-generate" onClick={generateCharacter} disabled={!profile.name.trim() || !selectedImageModel?.available || Boolean(action) || ["queued", "running"].includes(task?.status)}>
              {action === "generate" || ["queued", "running"].includes(task?.status)
                ? <IconLoader2 className="spin" size={16} />
                : <IconSparkles size={16} />}
              使用 {selectedImageModel?.label || "图片模型"} 生成并入库
            </button>
          </div>

          <div className="character-memory-binding">
            <div>
              <IconBrain size={15} />
              <span><strong>全局人物身份</strong><small>资产库建立身份，画布按镜头选择调用。</small></span>
            </div>
            <select aria-label="选择人物记忆" value={selectedEntityId} onChange={(event) => setSelectedEntityId(event.target.value)}>
              <option value="">选择人物记忆</option>
              {characterEntities.map((entity) => <option key={entity.id} value={entity.id}>{entity.name}</option>)}
            </select>
            <button onClick={bindToMemory} disabled={!selectedAsset || !selectedEntityId || action === "bind" || alreadyBound}>
              {action === "bind" ? <IconLoader2 className="spin" size={15} /> : <IconCheck size={15} />}
              {alreadyBound ? "已绑定当前人物" : "绑定为人物身份"}
            </button>
          </div>
          {errorMessage && <div className="character-error"><IconAlertTriangle size={15} /> {errorMessage}</div>}
        </aside>
      </div>
    </section>
  );
}

function SettingsWorkspace({ capabilities, settings, onChange, onApplyDuration }) {
  return (
    <section className="module-page settings-page">
      <ModuleHeading
        eyebrow="CONFIGURATION"
        title="生成设置"
        description="检查服务端模型连接，并设置后续镜头生成使用的统一输出规格。"
      />
      <div className="settings-layout">
        <section className="settings-block">
          <div className="settings-title"><span>MODEL ROUTING</span><h2>模型连接</h2></div>
          {["image", "video"].map((kind) => {
            const capability = capabilities?.[kind];
            return (
              <div className="model-route" key={kind}>
                <div className={`model-state ${capability?.available ? "online" : ""}`}><span /></div>
                <div><strong>{kind === "image" ? "图片生成" : "视频生成"}</strong><small>{capability?.vendor || "等待服务端"} · {capability?.model || "尚未读取"}</small></div>
                <em>{capability?.available ? "可用" : "未配置"}</em>
              </div>
            );
          })}
          <p className="settings-note">密钥只从服务端环境变量读取，不会在前端页面显示或保存。</p>
        </section>
        <section className="settings-block">
          <div className="settings-title"><span>OUTPUT</span><h2>默认输出</h2></div>
          <label>画面比例<select value="9:16" disabled><option>9:16 竖屏</option></select></label>
          <label>视频清晰度
            <select value={settings.resolution} onChange={(event) => onChange({ ...settings, resolution: event.target.value })}>
              <option value="480p">480p · 快速预览</option>
              <option value="720p">720p · 推荐</option>
            </select>
          </label>
          <label>默认镜头时长
            <select value={settings.defaultDuration} onChange={(event) => onChange({ ...settings, defaultDuration: Number(event.target.value) })}>
              {[4, 6, 8, 10, 12].map((duration) => <option key={duration} value={duration}>{duration} 秒</option>)}
            </select>
          </label>
          <button className="apply-settings" onClick={onApplyDuration}><IconCheck size={16} /> 将默认时长应用到全部镜头</button>
        </section>
      </div>
    </section>
  );
}

function ExportPanel({ result, onClose }) {
  return (
    <motion.div
      className="export-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="成片导出完成"
    >
      <motion.section
        className="export-panel"
        initial={{ opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
      >
        <div className="export-heading">
          <div>
            <span>LEGACY EXPORT · NON-D1</span>
            <h2>{result.shotIds.length} 个旧模式镜头已合并</h2>
          </div>
          <button onClick={onClose} aria-label="关闭成片预览"><IconX size={19} /></button>
        </div>
        <video src={result.mediaUrl} controls playsInline />
        <div className="export-footer">
          <p>此面板仅服务非 D1 legacy mode；不属于 canonical Truth 或 FALLBACK 证据。</p>
          <a href={result.mediaUrl} download={`storycanvas-${result.id}.mp4`}>
            <IconDownload size={16} /> 下载成片
          </a>
        </div>
      </motion.section>
    </motion.div>
  );
}

function ImageReplacementDialog({ replacement, onCancel, onConfirm }) {
  return (
    <motion.div
      className="image-replace-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-label="确认重新生成图片"
    >
      <motion.section
        className="image-replace-panel"
        initial={{ opacity: 0, y: 14, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 8, scale: 0.98 }}
      >
        <div className="image-replace-preview">
          {replacement.imageUrl
            ? <img src={replacement.imageUrl} alt={`镜头 ${String(replacement.shotId).padStart(2, "0")} 当前受保护图片`} />
            : <IconPhoto size={30} />}
        </div>
        <div className="image-replace-copy">
          <span>PROTECTED IMAGE</span>
          <h2>镜头 {String(replacement.shotId).padStart(2, "0")} 已有图片</h2>
          <p>再次生成会把新图设为当前画面，但不会删除这张原图。只有明确确认后才会提交模型任务。</p>
          <div>
            <button className="image-replace-cancel" onClick={onCancel}>保留当前图片</button>
            <button className="image-replace-confirm" onClick={onConfirm}>确认覆盖并重新生成</button>
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}

function StatusBar({ shots, activeTask, batchState, exporting }) {
  const mockCompleted = shots.filter((shot) => shot.status === "completed" && shot.truthMode === "MOCK-CONTRACT").length;
  const realCompleted = shots.filter((shot) => shot.status === "completed" && shot.truthMode === "REAL-CAP").length;
  const duration = shots.reduce((sum, shot) => sum + shot.duration, 0);
  const active = activeTask ? shots.find((shot) => shot.id === activeTask.shotId) : null;
  const pending = shots.filter((shot) => ["waiting", "sample", "queued", "generating", "failed"].includes(shot.status)).length;
  const batchProgress = batchState?.running
    ? Math.round(((batchState.current - 1 + (activeTask?.progress || 0) / 100) / batchState.total) * 100)
    : 0;
  return (
    <footer className="status-bar">
      <div className="status-summary"><span>视频时长：{duration}s</span><i /><span>镜头数量：{shots.length}</span><i /><span>MOCK 登记：{mockCompleted}</span><i /><span>真实生成：{realCompleted}</span><i /><span>待处理：{pending}</span></div>
      <div className="generation-progress">
        {exporting
          ? <><IconLoader2 className="spin" size={16} /><strong>正在统一规格并合并 {shots.length} 个镜头</strong></>
          : batchState?.running && active
            ? <><IconLoader2 className="spin" size={16} /><strong>非 D1 legacy 批量任务 {batchState.current}/{batchState.total} · 镜头 {String(active.id).padStart(2, "0")}</strong><span>{batchProgress}%</span></>
            : active
          ? <><IconLoader2 className="spin" size={16} /><strong>{activeTask.truthMode || "LEGACY"} 任务 · 镜头 {String(active.id).padStart(2, "0")} · {active.section}</strong><span>{activeTask.progress}%</span></>
          : <><IconCheck size={16} /><strong>D1 canonical 当前没有执行中的合同任务</strong></>}
        <div className="progress-track"><motion.span animate={{ width: `${batchState?.running ? batchProgress : activeTask?.progress || 0}%` }} /></div>
      </div>
      <div className="history-actions"><button><IconArrowBackUp size={16} /> 撤销 <kbd>⌘ Z</kbd></button><button><IconArrowForwardUp size={16} /> 重做 <kbd>⇧ ⌘ Z</kbd></button></div>
    </footer>
  );
}

/**
 * @param {import("./StoryCanvasApp.types").StoryCanvasAppProps} props
 */
export function StoryCanvasApp({ grant: embeddedGrant = null }) {
  const [shots, setShots] = useState(initialShots);
  const [selectedId, setSelectedId] = useState(0);
  const nextShotId = useRef(Math.max(...initialShots.map((shot) => shot.id)) + 1);
  const [zoom, setZoom] = useState(84);
  const [lockedIds, setLockedIds] = useState(new Set());
  const [activeNav, setActiveNav] = useState("canvas");
  const [generationKind, setGenerationKind] = useState("image");
  const [generationSubmitting, setGenerationSubmitting] = useState(false);
  const [imageReplacement, setImageReplacement] = useState(null);
  const [activeTask, setActiveTask] = useState(null);
  const [capabilities, setCapabilities] = useState(null);
  const [continuity, setContinuity] = useState(null);
  const [continuitySaving, setContinuitySaving] = useState(false);
  const [serviceState, setServiceState] = useState("loading");
  const [taskError, setTaskError] = useState("");
  const [notice, setNotice] = useState("");
  const [batchState, setBatchState] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [fallbackRegistering, setFallbackRegistering] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [outputSettings, setOutputSettings] = useState(loadOutputSettings);
  const [production, setProduction] = useState(null);

  const selectedShot = useMemo(() => shots.find((shot) => shot.id === selectedId) ?? shots[0], [shots, selectedId]);
  const selectedContinuityShot = continuity?.shots?.[String(selectedShot?.internalId || selectedId)] || null;
  const videosReady = useMemo(
    () => shots.length > 0 && shots.every((shot) => shot.status === "completed" && shot.mediaType === "video"),
    [shots],
  );

  useEffect(() => {
    let cancelled = false;
    let bootstrapping = false;
    let grantRequestTimer;
    const controlPlaneUrl = import.meta.env.VITE_CONTROL_PLANE_URL || "http://localhost:5173";
    const controlPlaneOrigin = new URL(controlPlaneUrl).origin;
    const messageTarget = window.opener || (window.parent !== window ? window.parent : null);
    const targetOrigin = window.location.protocol === "file:" ? "*" : controlPlaneOrigin;

    async function bootstrapWithGrant(grant, readyTarget = null) {
      if (bootstrapping || cancelled) return;
      const validation = validateEmbeddedStoryCanvasGrant(grant);
      if (!validation.ok) {
        mvpApi.clearProductionGrant();
        setServiceState("error");
        setTaskError(validation.error.message);
        return;
      }
      const validatedGrant = validation.grant;

      bootstrapping = true;
      if (grantRequestTimer) window.clearInterval(grantRequestTimer);
      setServiceState("loading");
      setTaskError("");
      mvpApi.setProductionGrant(validatedGrant);
      try {
        const data = await mvpApi.bootstrap();
        if (cancelled) return;
        const canonicalShots = productionShotsToCanvas(data.production);
        const shotByExternalId = new Map(canonicalShots.map((shot) => [shot.externalId, shot]));
        const normalizedTasks = (data.productionTasks || []).map((task) => ({
          id: task.generationTaskId,
          shotId: shotByExternalId.get(task.shotId)?.internalId,
          kind: task.taskType === "image.generate" ? "image" : "video",
          status: task.status,
          progress: task.progress,
          mediaType: task.output?.mediaType,
          error: task.error?.message,
          errorCode: task.error?.code,
          truthMode: task.truthMode,
        }));
        setProduction(data.production);
        setCapabilities(data.capabilities);
        setContinuity(data.continuity);
        setServiceState("ready");
        setSelectedId(canonicalShots[0]?.id || 0);
        nextShotId.current = Math.max(0, ...canonicalShots.map((shot) => shot.id)) + 1;

        const tasksByShot = new Map();
        for (const task of normalizedTasks) {
          if (!task.shotId) continue;
          const tasks = tasksByShot.get(task.shotId) || [];
          tasks.push(task);
          tasksByShot.set(task.shotId, tasks);
        }
        setShots(canonicalShots.map((shot) => {
          const tasks = tasksByShot.get(shot.internalId) || [];
          const visibleTask = tasks.find((task) => ["queued", "running"].includes(task.status))
            || tasks.find((task) => task.status === "succeeded")
            || tasks[0];
          return visibleTask ? applyTaskToShots([shot], visibleTask)[0] : shot;
        }));
        readyTarget?.source?.postMessage(
          {
            type: "storycanvas:d1-ready",
            projectId: "demo-local-001",
            packageId: "package-demo-local-001-v1",
          },
          readyTarget.origin,
        );
      } catch (error) {
        if (cancelled) return;
        mvpApi.clearProductionGrant();
        setServiceState("error");
        setTaskError(error.message);
        bootstrapping = false;
      }
    }

    async function handleGrantMessage(event) {
      if (bootstrapping || cancelled || event.data?.type !== "storycanvas:d1-grant") return;
      if (event.source !== messageTarget || (window.location.protocol !== "file:" && event.origin !== controlPlaneOrigin)) {
        setServiceState("error");
        setTaskError(`GRANT_BRIDGE_ORIGIN_REJECTED：拒绝 ${event.origin || "unknown"} 的授权消息`);
        return;
      }
      const { grant, projectId, packageId } = event.data;
      if (grant?.projectId !== projectId || grant?.packageId !== packageId) {
        setServiceState("error");
        setTaskError("GRANT_BRIDGE_SCOPE_MISMATCH：消息身份与 grant 不一致");
        return;
      }
      await bootstrapWithGrant(grant, {
        source: event.source,
        origin: window.location.protocol === "file:" ? "*" : event.origin,
      });
    }

    if (embeddedGrant) {
      void bootstrapWithGrant(embeddedGrant);
      return () => {
        cancelled = true;
        mvpApi.clearProductionGrant();
      };
    }

    window.addEventListener("message", handleGrantMessage);
    const requestGrant = () => messageTarget?.postMessage({
        type: "storycanvas:d1-grant-request",
        projectId: "demo-local-001",
        packageId: "package-demo-local-001-v1",
      }, targetOrigin);
    requestGrant();
    if (messageTarget) grantRequestTimer = window.setInterval(requestGrant, 500);
    if (!messageTarget) {
      setTaskError("EXPLICIT_GRANT_REQUIRED：请从控制平面深链打开，并通过 postMessage 提交当前 grant");
    }
    return () => {
      cancelled = true;
      if (grantRequestTimer) window.clearInterval(grantRequestTimer);
      mvpApi.clearProductionGrant();
      window.removeEventListener("message", handleGrantMessage);
    };
  }, [embeddedGrant]);

  useEffect(() => {
    if (batchState?.running || !activeTask?.id || !["queued", "running"].includes(activeTask.status)) return undefined;
    let cancelled = false;
    let timer;

    const poll = async () => {
      try {
        const task = await mvpApi.getTask(activeTask.id);
        if (cancelled) return;
        setActiveTask(task);
        setShots((items) => applyTaskToShots(items, task));
        if (task.status === "succeeded") {
          setTaskError("");
          setNotice(`镜头 ${String(task.shotId).padStart(2, "0")} 已完成真实${task.kind === "image" ? "图片" : "视频"}生成`);
          setActiveTask(null);
          return;
        }
        if (task.status === "failed") {
          setTaskError(task.error || "模型生成失败");
          setNotice(`镜头 ${String(task.shotId).padStart(2, "0")} 生成失败`);
          setActiveTask(null);
          return;
        }
        timer = window.setTimeout(poll, 2500);
      } catch (error) {
        if (cancelled) return;
        setTaskError(error.message);
        timer = window.setTimeout(poll, 4000);
      }
    };

    timer = window.setTimeout(poll, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeTask?.id, activeTask?.status, batchState?.running]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    window.localStorage.setItem("storycanvas:output-settings", JSON.stringify(outputSettings));
  }, [outputSettings]);

  function changeZoom(delta) {
    setZoom((value) => Math.max(60, Math.min(116, delta === 100 - value ? 100 : value + delta)));
  }

  function changeShot(field, value) {
    setShots((items) => recalculateShotRanges(items.map((shot) => {
      if (shot.id !== selectedId) return shot;
      return {
        ...shot,
        [field]: value,
        ...(field === "title" ? { shortTitle: value } : {}),
      };
    })));
  }

  function openShotInCanvas(shotId) {
    setSelectedId(shotId);
    setActiveNav("canvas");
    setTaskError("");
  }

  function toggleLocked(value) {
    setLockedIds((current) => {
      const next = new Set(current);
      if (value) next.add(selectedId); else next.delete(selectedId);
      return next;
    });
  }

  async function referenceImageForShot(shot) {
    const source = shot.generatedImageUrl
      || (shot.mediaType === "image" && shot.mediaUrl ? shot.mediaUrl : shot.image);
    if (!source) throw new Error(`镜头 ${String(shot.id).padStart(2, "0")} 没有可用参考图。`);
    return mediaUrlToDataUrl(source);
  }

  async function memoryReferenceImagesForShot(shotId) {
    const references = continuity?.shots?.[String(shotId)]?.references || [];
    const sources = [...new Set(references.map((reference) => reference.sourceUri).filter(Boolean))].slice(0, 6);
    return Promise.all(sources.map(mediaUrlToDataUrl));
  }

  async function createTaskForShot(shot, kind, replaceImageTaskId) {
    const referenceImage = kind === "video" ? await referenceImageForShot(shot) : undefined;
    const referenceImages = kind === "image" ? await memoryReferenceImagesForShot(shot.internalId || shot.id) : [];
    return mvpApi.createTask({
      kind,
      shotId: shot.internalId || shot.id,
      prompt: kind === "image" ? shot.imagePrompt : shot.videoPrompt,
      aspectRatio: "9:16",
      duration: Math.min(12, Math.max(4, shot.duration)),
      resolution: outputSettings.resolution,
      ...(referenceImage ? { referenceImage } : {}),
      ...(referenceImages.length ? { referenceImages } : {}),
      ...(continuity?.profile?.revision ? { contextRevision: continuity.profile.revision } : {}),
      ...(replaceImageTaskId ? { replaceImageTaskId } : {}),
      idempotencyKey: window.crypto.randomUUID(),
    });
  }

  async function updateShotContinuity(shotId, patch) {
    if (continuitySaving) return;
    setContinuitySaving(true);
    setTaskError("");
    try {
      const shot = shots.find((item) => item.id === shotId);
      const next = await mvpApi.updateShotContinuity(shot?.internalId || shotId, patch);
      setContinuity(next);
      setNotice(`镜头 ${String(shotId).padStart(2, "0")} 的世界记忆已更新`);
    } catch (error) {
      setTaskError(error.message);
      setNotice("世界记忆更新失败");
    } finally {
      setContinuitySaving(false);
    }
  }

  async function waitForTask(task) {
    let current = task;
    while (["queued", "running"].includes(current.status)) {
      await new Promise((resolve) => window.setTimeout(resolve, 2500));
      current = await mvpApi.getTask(current.id);
      setActiveTask(current);
      setShots((items) => applyTaskToShots(items, current));
    }
    return current;
  }

  async function exportAllVideos(shotIds = shots.map((shot) => shot.id)) {
    setExporting(true);
    setTaskError("");
    try {
      const result = await mvpApi.exportVideo(shotIds);
      setExportResult(result);
      setNotice(`${shotIds.length} 个镜头已合并完成`);
      return result;
    } catch (error) {
      setTaskError(error.message);
      setNotice("视频合并失败");
      throw error;
    } finally {
      setExporting(false);
    }
  }

  async function registerFallbackArtifact() {
    setFallbackRegistering(true);
    setTaskError("");
    try {
      const artifact = await mvpApi.createFallbackExport();
      setProduction((current) => current ? { ...current, artifact } : current);
      setNotice("本地纯合成 FALLBACK 已登记：可播放，技术 QA passed，编辑/品牌 QA 未评估");
    } catch (error) {
      setTaskError(error.message);
      setNotice("FALLBACK Demo 尚不可登记，请先完成 07 成功与 05 失败合同证据");
    } finally {
      setFallbackRegistering(false);
    }
  }

  async function generateAllVideos() {
    if (activeTask || batchState?.running) return;
    const lockedShots = shots.filter((shot) => lockedIds.has(shot.id));
    if (lockedShots.length) {
      setNotice(`请先解锁镜头 ${lockedShots.map((shot) => String(shot.id).padStart(2, "0")).join("、")}`);
      return;
    }

    setGenerationKind("video");
    setTaskError("");
    setExportResult(null);
    setBatchState({ running: true, current: 1, total: shots.length });

    try {
      for (const [index, shot] of shots.entries()) {
        setSelectedId(shot.id);
        setBatchState({ running: true, current: index + 1, total: shots.length });
        setShots((items) => items.map((item) => item.id === shot.id
          ? { ...item, status: "queued", progress: 0, error: undefined }
          : item));

        const task = await createTaskForShot(shot, "video");
        setActiveTask(task);
        setShots((items) => applyTaskToShots(items, task));
        const completedTask = await waitForTask(task);
        if (completedTask.status !== "succeeded") {
          throw new Error(completedTask.error || `镜头 ${String(shot.id).padStart(2, "0")} 生成失败`);
        }
      }

      setActiveTask(null);
      setBatchState({ running: false, current: shots.length, total: shots.length });
      setNotice(`${shots.length} 个镜头生成完成，正在自动合并`);
      await exportAllVideos(shots.map((shot) => shot.id));
    } catch (error) {
      setActiveTask(null);
      setBatchState((current) => current ? { ...current, running: false } : null);
      setTaskError(error.message);
      setNotice("批量生成已停止，可修正失败镜头后重试");
    }
  }

  async function submitSelectedGeneration(currentShot, kind, replaceImageTaskId) {
    if (generationSubmitting || activeTask || batchState?.running) return;
    setGenerationSubmitting(true);
    setTaskError("");
    setShots((items) => items.map((shot) => shot.id === currentShot.id ? { ...shot, status: "queued", progress: 0, error: undefined } : shot));
    try {
      const demoScenario = demoScenarioForShot(currentShot, kind);
      if (demoScenario) {
        const result = await mvpApi.runDemoScenario(demoScenario);
        const receipt = result.task;
        const task = {
          id: receipt.generationTaskId,
          shotId: currentShot.internalId,
          kind: receipt.taskType === "image.generate" ? "image" : "video",
          status: receipt.status,
          progress: receipt.progress,
          mediaType: receipt.status === "succeeded" ? "image" : undefined,
          error: receipt.error?.message,
          errorCode: receipt.error?.code,
          truthMode: receipt.truthMode || "MOCK-CONTRACT",
        };
        setShots((items) => applyTaskToShots(items, task));
        setTaskError(task.error || "");
        setNotice(
          demoScenario === "success"
            ? `镜头 ${String(currentShot.id).padStart(2, "0")} 的 MOCK-CONTRACT 任务、资产与回执已登记`
            : `镜头 ${String(currentShot.id).padStart(2, "0")} 的 MOCK-CONTRACT 失败已登记：没有伪造输出资产`,
        );
        return;
      }
      throw new Error("LEGACY_MODE_DISABLED：D1 canonical 仅开放 shot-07 图片成功与 shot-05 视频失败的确定性 MOCK-CONTRACT 场景");
    } catch (error) {
      setShots((items) => items.map((shot) => shot.id === currentShot.id ? { ...shot, status: "failed", progress: 100, error: error.message } : shot));
      setTaskError(error.message);
      setNotice(`镜头 ${String(currentShot.id).padStart(2, "0")} 提交失败`);
    } finally {
      setGenerationSubmitting(false);
    }
  }

  async function generateSelected() {
    if (lockedIds.has(selectedId)) {
      setNotice("该镜头已锁定，请先解锁");
      return;
    }
    const currentShot = shots.find((shot) => shot.id === selectedId);
    if (!currentShot) return;
    if (generationKind === "image" && currentShot.generatedImageTaskId) {
      setImageReplacement({
        shotId: currentShot.id,
        taskId: currentShot.generatedImageTaskId,
        imageUrl: currentShot.generatedImageUrl || currentShot.mediaUrl || currentShot.image,
      });
      return;
    }
    await submitSelectedGeneration(currentShot, generationKind);
  }

  async function confirmImageReplacement() {
    const replacement = imageReplacement;
    setImageReplacement(null);
    if (!replacement) return;
    if (lockedIds.has(replacement.shotId)) {
      setNotice("该镜头已锁定，请先解锁");
      return;
    }
    const currentShot = shots.find((shot) => shot.id === replacement.shotId);
    if (!currentShot) return;
    await submitSelectedGeneration(currentShot, "image", replacement.taskId);
  }

  function addShot() {
    const id = nextShotId.current;
    nextShotId.current += 1;
    setShots((items) => [...items, createNewShot(items, id, outputSettings.defaultDuration)]);
    setSelectedId(id);
    setTaskError("");
    setNotice(`已新增章节 ${String(id).padStart(2, "0")}`);
  }

  function deleteSelected() {
    if (shots.length <= 1) return;
    const remaining = shots.filter((shot) => shot.id !== selectedId);
    setShots(remaining);
    setSelectedId(remaining[0].id);
    setNotice("已删除选中镜头");
  }

  function applyDefaultDuration() {
    setShots((items) => recalculateShotRanges(items.map((shot) => ({
      ...shot,
      duration: outputSettings.defaultDuration,
    }))));
    setNotice(`已将全部镜头调整为 ${outputSettings.defaultDuration} 秒`);
  }

  return (
    <div className="storycanvas-app">
      <AppHeader
        activeView={activeNav}
        zoom={zoom}
        onZoom={changeZoom}
        onOpenCanvas={() => setActiveNav("canvas")}
        onGenerate={generateSelected}
        onBatch={generateAllVideos}
        onExport={() => exportAllVideos()}
        serviceState={serviceState}
        keyConfigured={capabilities?.keyConfigured}
        generationDisabled={
          generationSubmitting
          || Boolean(activeTask)
          || Boolean(batchState?.running)
          || exporting
          || (!capabilities?.[generationKind]?.available && !demoScenarioForShot(selectedShot, generationKind))
        }
        batchDisabled={Boolean(activeTask) || Boolean(batchState?.running) || exporting || !capabilities?.video?.available}
        batchState={batchState}
        videosReady={videosReady}
        exporting={exporting}
        shotCount={shots.length}
        generationLabel={demoScenarioForShot(selectedShot, generationKind)
            ? demoScenarioForShot(selectedShot, generationKind) === "success"
              ? "登记权益图卡 · MOCK-CONTRACT"
              : "登记失败任务 · MOCK-CONTRACT"
            : generationKind === "image" && selectedShot.generatedImageTaskId
              ? "重新生成图片（需确认）"
            : "D1 canonical 不可用"}
        production={production}
      />
      <main className="workspace-grid">
        <AppNav active={activeNav} onChange={(id) => { setActiveNav(id); setTaskError(""); }} />
        <AnimatePresence mode="wait" initial={false}>
          {activeNav === "canvas" ? (
            <motion.div className="canvas-view" key="canvas" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
              <ScriptOutline shots={shots} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setTaskError(""); }} onAdd={addShot} />
              <CanvasWorkspace
                shots={shots}
                selectedId={selectedId}
                zoom={zoom}
                onSelect={(id) => { setSelectedId(id); setTaskError(""); }}
                continuityShot={selectedContinuityShot}
                entities={continuity?.entities}
              />
              <Inspector
                shot={selectedShot}
                locked={lockedIds.has(selectedId)}
                onLocked={toggleLocked}
                onChange={changeShot}
                onRegenerate={generateSelected}
                onDelete={deleteSelected}
                generationKind={generationKind}
                onGenerationKind={setGenerationKind}
                capabilities={capabilities}
                taskError={taskError || selectedShot.error}
                generating={Boolean(activeTask) || generationSubmitting}
                continuityShot={selectedContinuityShot}
                continuityEntities={continuity?.entities || []}
                onOpenMemory={() => setActiveNav("memory")}
              />
            </motion.div>
          ) : (
            <motion.div
              className="module-view"
              key={activeNav}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18 }}
            >
              {activeNav === "projects" && (
                <ProjectWorkspace
                  shots={shots}
                  onOpenShot={openShotInCanvas}
                  production={production}
                  onFallbackExport={registerFallbackArtifact}
                  exporting={fallbackRegistering}
                />
              )}
              {activeNav === "scripts" && (
                <ScriptWorkspace
                  shots={shots}
                  selectedId={selectedId}
                  onSelect={(id) => { setSelectedId(id); setTaskError(""); }}
                  onChange={changeShot}
                  onAdd={addShot}
                />
              )}
              {activeNav === "memory" && (
                <MemoryWorkspace
                  shots={shots}
                  selectedId={selectedId}
                  onSelect={(id) => { setSelectedId(id); setTaskError(""); }}
                  continuity={continuity}
                  saving={continuitySaving}
                  onPatch={(patch) => updateShotContinuity(selectedId, patch)}
                  readOnly
                />
              )}
              {activeNav === "characters" && (
                <CharacterAssetsWorkspace
                  continuity={continuity}
                  onContinuityChange={setContinuity}
                  onNotice={setNotice}
                />
              )}
              {activeNav === "assets" && <AssetsWorkspace shots={shots} onOpenShot={openShotInCanvas} />}
              {activeNav === "settings" && (
                <SettingsWorkspace
                  capabilities={capabilities}
                  settings={outputSettings}
                  onChange={setOutputSettings}
                  onApplyDuration={applyDefaultDuration}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      <StatusBar shots={shots} activeTask={activeTask} batchState={batchState} exporting={exporting} />
      <AnimatePresence>{notice && <motion.div className="toast" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}><IconCheck size={16} />{notice}</motion.div>}</AnimatePresence>
      <AnimatePresence>{exportResult && <ExportPanel result={exportResult} onClose={() => setExportResult(null)} />}</AnimatePresence>
      <AnimatePresence>{imageReplacement && (
        <ImageReplacementDialog
          replacement={imageReplacement}
          onCancel={() => setImageReplacement(null)}
          onConfirm={confirmImageReplacement}
        />
      )}</AnimatePresence>
    </div>
  );
}
