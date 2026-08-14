import { Alert, Button, Empty, Spin, Tag, Typography } from 'antd';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
  pilotControlApi,
  type PilotCreateProjectInput,
  type PilotProject,
} from '../../services/pilotControlApi';
import {
  pilotContentProductionApi,
  type PilotBriefPayload,
  type PilotBriefVersion,
  type PilotContentProductionApi,
  type PilotProductionEligibility,
  type PilotProductionPackage,
  type PilotScriptVersion,
  type PilotStoryboardVersion,
} from '../../services/pilotContentProductionApi';
import '../pilot/v3-ops.css';

export type PilotProjectContentRouteKey =
  | 'project-create'
  | 'brand'
  | 'script'
  | 'storyboard'
  | 'rough-cut'
  | 'production-overview'
  | 'production-inbox'
  | 'production-tasks'
  | 'production-assets'
  | 'production-export';

type ControlApi = Pick<typeof pilotControlApi, 'createProject'>;

interface PilotProjectContentPageProps {
  routeKey: PilotProjectContentRouteKey;
  projectId: string | null;
  project: PilotProject | null;
  controlApi?: ControlApi;
  contentApi?: PilotContentProductionApi;
  createIdempotencyKey?: () => string;
  onProjectCreated?: (project: PilotProject) => Promise<void>;
  onOpenCanvas?: (packageId: string) => void;
}

interface ProjectFacts {
  briefs: PilotBriefVersion[];
  scripts: PilotScriptVersion[];
  storyboards: PilotStoryboardVersion[];
  eligibility: PilotProductionEligibility;
  packages: PilotProductionPackage[];
}

type ProjectFactsState =
  { phase: 'loading' } | { phase: 'ready'; facts: ProjectFacts } | { phase: 'error' };

interface ScriptFacts {
  title: string;
  content: string;
}

const ROUTE_TITLES: Record<PilotProjectContentRouteKey, string> = {
  'project-create': '新建项目与 Brief',
  brand: '品牌大脑',
  script: '脚本编辑',
  storyboard: '分镜生产单',
  'rough-cut': '任务 / 交付',
  'production-overview': '生产概览',
  'production-inbox': '生产包',
  'production-tasks': '生成任务',
  'production-assets': '媒体资产',
  'production-export': '导出 / 来源链',
};

const PRODUCTION_EMPTY_COPY: Record<
  Extract<
    PilotProjectContentRouteKey,
    | 'rough-cut'
    | 'production-inbox'
    | 'production-tasks'
    | 'production-assets'
    | 'production-export'
  >,
  string
> = {
  'rough-cut': '当前 Control 投影没有可验证的真实粗剪或交付结果。',
  'production-inbox': '当前安全读接口没有返回可验证的真实生产包。',
  'production-tasks': '当前安全读接口没有可验证的真实任务。',
  'production-assets': '当前安全读接口没有可验证的真实媒体资产。',
  'production-export': '当前安全读接口没有可验证的真实导出或来源链。',
};

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function safeText(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (normalized.length === 0 || normalized.length > maxLength) return null;
  return normalized;
}

function projectTextList(
  value: unknown,
  maxItems: number,
  maxLength: number,
  allowEmpty: boolean,
): string[] | null {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.length > maxItems) {
    return null;
  }
  const items = value.map((item) => safeText(item, maxLength));
  if (items.some((item) => item === null)) return null;
  const safeItems = items as string[];
  return new Set(safeItems).size === safeItems.length ? safeItems : null;
}

function projectBrandFacts(payload: unknown): PilotBriefPayload | null {
  if (
    !payload ||
    typeof payload !== 'object' ||
    Array.isArray(payload) ||
    !exactKeys(payload as Record<string, unknown>, [
      'objective',
      'audience',
      'platforms',
      'brandFacts',
      'prohibitedTerms',
      'requiredDisclosures',
      'factsConfirmed',
    ])
  ) {
    return null;
  }
  const record = payload as Record<string, unknown>;
  const objective = safeText(record.objective, 2_000);
  const audience = projectTextList(record.audience, 20, 200, false);
  const platforms = projectTextList(record.platforms, 10, 100, false);
  const prohibitedTerms = projectTextList(record.prohibitedTerms, 50, 200, true);
  const requiredDisclosures = projectTextList(record.requiredDisclosures, 50, 500, true);
  if (
    !objective ||
    !audience ||
    !platforms ||
    !prohibitedTerms ||
    !requiredDisclosures ||
    record.factsConfirmed !== true ||
    !Array.isArray(record.brandFacts) ||
    record.brandFacts.length === 0 ||
    record.brandFacts.length > 20
  ) {
    return null;
  }
  const brandFacts = record.brandFacts.map((fact) => {
    if (
      !fact ||
      typeof fact !== 'object' ||
      Array.isArray(fact) ||
      !exactKeys(fact as Record<string, unknown>, ['text', 'sourceReference'])
    ) {
      return null;
    }
    const factRecord = fact as Record<string, unknown>;
    const text = safeText(factRecord.text, 500);
    const sourceReference = safeText(factRecord.sourceReference, 500);
    return text && sourceReference ? { text, sourceReference } : null;
  });
  if (brandFacts.some((fact) => fact === null)) return null;
  return {
    objective,
    audience,
    platforms,
    brandFacts: brandFacts as PilotBriefPayload['brandFacts'],
    prohibitedTerms,
    requiredDisclosures,
    factsConfirmed: true,
  };
}

function projectScriptFacts(payload: Record<string, unknown>): ScriptFacts | null {
  if (!exactKeys(payload, ['title', 'content', 'fullText'])) return null;
  const title = safeText(payload.title, 200);
  const contentValue = payload.content === undefined ? payload.fullText : payload.content;
  const content = safeText(contentValue, 20_000);
  if (!title || !content) return null;
  return { title, content };
}

function latestExact<T extends { projectId: string; version: number }>(
  versions: T[],
  projectId: string,
): T | null {
  if (
    versions.some(
      (version) =>
        version.projectId !== projectId ||
        !Number.isInteger(version.version) ||
        version.version < 1,
    )
  ) {
    return null;
  }
  const ordered = [...versions].sort((left, right) => right.version - left.version);
  if (ordered.length > 1 && ordered[0].version === ordered[1].version) return null;
  return ordered[0] ?? null;
}

function ProjectHeader({
  routeKey,
  project,
}: {
  routeKey: PilotProjectContentRouteKey;
  project: PilotProject;
}) {
  return (
    <header className="d1-page-header">
      <div>
        <Tag color="orange">REAL CONTROL FACTS</Tag>
        <Typography.Title level={2}>{ROUTE_TITLES[routeKey]}</Typography.Title>
        <Typography.Paragraph type="secondary">
          {project.name} · {project.platform} · {project.aspectRatio} ·{' '}
          {project.targetDurationSeconds} 秒
        </Typography.Paragraph>
      </div>
    </header>
  );
}

function EligibilityPanel({ eligibility }: { eligibility: PilotProductionEligibility }) {
  return (
    <section className="d1-surface" data-testid="pilot-production-eligibility">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={3}>生产资格</Typography.Title>
          <Typography.Paragraph type="secondary">
            仅展示 Control API 的资格判定，不推断任务、资产、生产包或导出结果。
          </Typography.Paragraph>
        </div>
        <Tag color={eligibility.eligible ? 'success' : 'warning'}>
          {eligibility.eligible ? 'ELIGIBLE' : eligibility.reasonCode}
        </Tag>
      </div>
      <p>脚本版本：{eligibility.scriptVersion ?? '无'}</p>
      <p>分镜版本：{eligibility.storyboardVersion ?? '无'}</p>
    </section>
  );
}

function BrandPanel({ facts, projectId }: { facts: ProjectFacts; projectId: string }) {
  const latest = latestExact(facts.briefs, projectId);
  if (!latest) {
    return <Empty data-testid="pilot-brand-empty" description="当前项目没有真实 Brief 版本" />;
  }
  const brand = projectBrandFacts(latest.payload);
  if (!brand) {
    return (
      <Alert
        data-testid="pilot-brand-invalid-brief"
        type="error"
        showIcon
        message="Brief 无法安全投影"
        description="最新 Brief 不符合严格品牌事实格式，页面已 fail closed，未显示原始 payload。"
      />
    );
  }
  return (
    <section className="d1-surface" data-testid="pilot-brand-facts">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={3}>已核验品牌事实</Typography.Title>
          <Typography.Paragraph type="secondary">
            Brief v{latest.version} · {latest.status}
          </Typography.Paragraph>
        </div>
      </div>
      <p>获客目标：{brand.objective}</p>
      <p>目标人群：{brand.audience.join(' · ')}</p>
      <p>目标平台：{brand.platforms.join(' · ')}</p>
      <div className="v3-ops-table">
        {brand.brandFacts.map((fact, index) => (
          <div className="v3-ops-row" key={`${index}-${fact.text}-${fact.sourceReference}`}>
            <strong>事实 {index + 1}</strong>
            <span>{fact.text}</span>
            <span>来源：{fact.sourceReference}</span>
          </div>
        ))}
      </div>
      {brand.prohibitedTerms.length > 0 ? (
        <p>禁用表达：{brand.prohibitedTerms.join(' · ')}</p>
      ) : null}
      {brand.requiredDisclosures.length > 0 ? (
        <p>必要披露：{brand.requiredDisclosures.join(' · ')}</p>
      ) : null}
    </section>
  );
}

function ScriptPanel({ facts, projectId }: { facts: ProjectFacts; projectId: string }) {
  const latestScript = latestExact(facts.scripts, projectId);
  if (!latestScript) {
    return <Empty data-testid="pilot-script-empty" description="当前项目没有真实脚本版本" />;
  }
  const latestBrief = latestExact(facts.briefs, projectId);
  const script = projectScriptFacts(latestScript.payload);
  const brief = latestBrief ? projectBrandFacts(latestBrief.payload) : null;
  if (!script || !latestBrief || !brief) {
    return (
      <Alert
        data-testid="pilot-script-invalid"
        type="error"
        message="脚本无法安全投影"
        description="最新脚本或其 Brief 上下文不符合安全字段格式，未显示原始内容。"
      />
    );
  }
  return (
    <section className="d1-surface" data-testid="pilot-script-facts">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={3}>{script.title}</Typography.Title>
          <Typography.Paragraph type="secondary">
            Script v{latestScript.version} · {latestScript.status}
          </Typography.Paragraph>
        </div>
      </div>
      <p>Brief 目标：{brief.objective}</p>
      <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>
        {script.content}
      </Typography.Paragraph>
    </section>
  );
}

function StoryboardPanel({ facts, projectId }: { facts: ProjectFacts; projectId: string }) {
  const latest = latestExact(facts.storyboards, projectId);
  if (!latest) {
    return <Empty data-testid="pilot-storyboard-empty" description="当前项目没有真实分镜版本" />;
  }
  return (
    <section className="d1-surface" data-testid="pilot-storyboard-facts">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={3}>Storyboard v{latest.version}</Typography.Title>
          <Typography.Paragraph type="secondary">
            绑定 Script {latest.scriptVersionId} · {latest.status}
          </Typography.Paragraph>
        </div>
      </div>
      <div className="v3-ops-table">
        {latest.shots.length > 0 ? (
          [...latest.shots]
            .sort((left, right) => left.sequence - right.sequence)
            .map((shot) => (
              <div className="v3-ops-row" key={shot.shotId}>
                <strong>镜头 {shot.sequence}</strong>
                <span>{shot.description}</span>
                <span>{shot.durationSeconds} 秒</span>
                <Tag>{shot.sourceMode}</Tag>
              </div>
            ))
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="该真实分镜版本没有镜头" />
        )}
      </div>
    </section>
  );
}

function ProductionEmptyPanel({
  routeKey,
  eligibility,
}: {
  routeKey: keyof typeof PRODUCTION_EMPTY_COPY;
  eligibility: PilotProductionEligibility;
}) {
  return (
    <section className="d1-surface" data-testid="pilot-production-empty">
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`${PRODUCTION_EMPTY_COPY[routeKey]} 当前资格：${eligibility.reasonCode}`}
      />
    </section>
  );
}

function ProductionPackagesPanel({
  packages,
  projectId,
  scripts,
  onOpenCanvas,
}: {
  packages: PilotProductionPackage[];
  projectId: string;
  scripts: PilotScriptVersion[];
  onOpenCanvas?: (packageId: string) => void;
}) {
  if (packages.length === 0) return null;
  if (
    packages.some((candidate) => candidate.projectId !== projectId) ||
    scripts.some((script) => script.projectId !== projectId) ||
    new Set(scripts.map((script) => script.id)).size !== scripts.length
  ) {
    return (
      <Alert
        type="error"
        message="生产包候选无法安全确认"
        description="候选包含跨项目绑定，页面已 fail closed。"
      />
    );
  }
  return (
    <section className="d1-surface" data-testid="pilot-production-packages">
      <div className="d1-section-heading">
        <div>
          <Typography.Title level={3}>可进入画布的真实生产包</Typography.Title>
          <Typography.Paragraph type="secondary">
            必须由操作人员明确选择；页面不会自动采用 latest、first 或缓存候选。
          </Typography.Paragraph>
        </div>
      </div>
      <div className="v3-ops-table">
        {packages.map((candidate) => {
          const bound = scripts.find((script) => script.id === candidate.scriptVersionId);
          const script = bound ? projectScriptFacts(bound.payload) : null;
          return (
            <div className="v3-ops-row" key={candidate.packageId}>
              <strong>Package v{candidate.packageVersion}</strong>
              {script ? (
                <>
                  <span>{script.title}</span>
                  <span style={{ whiteSpace: 'pre-wrap' }}>{script.content}</span>
                </>
              ) : (
                <Alert type="error" message="绑定脚本无法安全确认" />
              )}
              <span>{candidate.capabilityRequirements.join(' · ')}</span>
              <span>{candidate.status}</span>
              <Button
                type="primary"
                disabled={!onOpenCanvas || !script}
                onClick={() => onOpenCanvas?.(candidate.packageId)}
              >
                选择 Package v{candidate.packageVersion} 进入画布
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RealProjectPage({
  routeKey,
  projectId,
  project,
  contentApi,
  onOpenCanvas,
}: {
  routeKey: Exclude<PilotProjectContentRouteKey, 'project-create'>;
  projectId: string | null;
  project: PilotProject | null;
  contentApi: PilotContentProductionApi;
  onOpenCanvas?: (packageId: string) => void;
}) {
  const [state, setState] = useState<ProjectFactsState>({ phase: 'loading' });

  useEffect(() => {
    if (!projectId || !project || project.id !== projectId) return;
    const controller = new AbortController();
    let active = true;
    setState({ phase: 'loading' });
    Promise.all([
      contentApi.listBriefVersions(projectId, { signal: controller.signal }),
      contentApi.listScriptVersions(projectId, { signal: controller.signal }),
      contentApi.listStoryboardVersions(projectId, { signal: controller.signal }),
      contentApi.readProductionEligibility(projectId, { signal: controller.signal }),
      contentApi.listProductionPackages(projectId, { signal: controller.signal }),
    ]).then(
      ([briefs, scripts, storyboards, productionEligibility, packages]) => {
        if (!active) return;
        if (productionEligibility.projectId !== projectId) {
          setState({ phase: 'error' });
          return;
        }
        setState({
          phase: 'ready',
          facts: { briefs, scripts, storyboards, eligibility: productionEligibility, packages },
        });
      },
      () => {
        if (active) setState({ phase: 'error' });
      },
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [contentApi, project, projectId, routeKey]);

  if (!projectId || !project || project.id !== projectId) {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-project-content-no-scope">
        <Alert
          type="warning"
          message="未选择真实项目"
          description="页面不会使用默认项目、Demo 项目或本地缓存补齐 Project Scope。"
        />
      </main>
    );
  }

  if (state.phase === 'loading') {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-project-content-loading">
        <ProjectHeader routeKey={routeKey} project={project} />
        <div role="status">
          <Spin size="small" /> 正在读取真实 Control facts…
        </div>
      </main>
    );
  }
  if (state.phase === 'error') {
    return (
      <main className="v3-ops-page d1-page-stack" data-testid="pilot-project-content-error">
        <ProjectHeader routeKey={routeKey} project={project} />
        <Alert
          type="error"
          showIcon
          message="真实项目内容读取失败"
          description="响应无法安全确认，页面已 fail closed，不回退 Demo 或本地缓存。"
        />
      </main>
    );
  }

  return (
    <main
      className="v3-ops-page d1-page-stack"
      data-testid={`pilot-project-content-${routeKey}`}
      data-project-id={projectId}
    >
      <ProjectHeader routeKey={routeKey} project={project} />
      {routeKey === 'brand' ? <BrandPanel facts={state.facts} projectId={projectId} /> : null}
      {routeKey === 'script' ? <ScriptPanel facts={state.facts} projectId={projectId} /> : null}
      {routeKey === 'storyboard' ? (
        <StoryboardPanel facts={state.facts} projectId={projectId} />
      ) : null}
      {routeKey === 'production-overview' ? (
        <>
          <section className="d1-surface">
            <Typography.Title level={3}>真实项目状态</Typography.Title>
            <p>状态：{project.status}</p>
            <p>最近更新：{project.updatedAt}</p>
            <p>Brief 版本：{state.facts.briefs.length}</p>
            <p>脚本版本：{state.facts.scripts.length}</p>
            <p>分镜版本：{state.facts.storyboards.length}</p>
          </section>
          <EligibilityPanel eligibility={state.facts.eligibility} />
          <ProductionPackagesPanel
            packages={state.facts.packages}
            projectId={projectId}
            scripts={state.facts.scripts}
            onOpenCanvas={onOpenCanvas}
          />
        </>
      ) : null}
      {routeKey in PRODUCTION_EMPTY_COPY ? (
        <>
          <EligibilityPanel eligibility={state.facts.eligibility} />
          {routeKey === 'production-inbox' && state.facts.packages.length > 0 ? (
            <ProductionPackagesPanel
              packages={state.facts.packages}
              projectId={projectId}
              scripts={state.facts.scripts}
              onOpenCanvas={onOpenCanvas}
            />
          ) : (
            <ProductionEmptyPanel
              routeKey={routeKey as keyof typeof PRODUCTION_EMPTY_COPY}
              eligibility={state.facts.eligibility}
            />
          )}
        </>
      ) : null}
    </main>
  );
}

interface CreateFormState {
  projectName: string;
  objective: string;
  audience: string;
  brandFacts: string;
  factsConfirmed: boolean;
}

const EMPTY_CREATE_FORM: CreateFormState = {
  projectName: '',
  objective: '',
  audience: '',
  brandFacts: '',
  factsConfirmed: false,
};

function parseBrandFactLines(value: string): PilotBriefPayload['brandFacts'] | null {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0 || lines.length > 20) return null;
  const facts = lines.map((line) => {
    const parts = line.split(/[｜|]/u).map((part) => part.trim());
    if (parts.length !== 2) return null;
    const [text, sourceReference] = parts;
    if (!text || text.length > 500 || !sourceReference || sourceReference.length > 500) {
      return null;
    }
    return { text, sourceReference };
  });
  return facts.some((fact) => fact === null) ? null : (facts as PilotBriefPayload['brandFacts']);
}

function ProjectCreatePage({
  controlApi,
  contentApi,
  createIdempotencyKey,
  onProjectCreated,
}: {
  controlApi: ControlApi;
  contentApi: PilotContentProductionApi;
  createIdempotencyKey: () => string;
  onProjectCreated?: (project: PilotProject) => Promise<void>;
}) {
  const [form, setForm] = useState(EMPTY_CREATE_FORM);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'error'>('idle');
  const mutationRef = useRef<{ fingerprint: string; baseKey: string } | null>(null);

  const audience = useMemo(
    () =>
      projectTextList(
        form.audience
          .split('\n')
          .map((item) => item.trim())
          .filter(Boolean),
        20,
        200,
        false,
      ),
    [form.audience],
  );
  const brandFacts = useMemo(() => parseBrandFactLines(form.brandFacts), [form.brandFacts]);

  const update = (key: keyof CreateFormState, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
    setStatus('idle');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!audience || !brandFacts || !form.factsConfirmed) {
      setStatus('error');
      return;
    }
    const payload: PilotBriefPayload = {
      objective: form.objective.trim(),
      audience,
      platforms: ['douyin'],
      brandFacts,
      prohibitedTerms: [],
      requiredDisclosures: [],
      factsConfirmed: true,
    };
    if (!form.projectName.trim() || !projectBrandFacts(payload) || !onProjectCreated) {
      setStatus('error');
      return;
    }
    const fingerprint = JSON.stringify({ projectName: form.projectName.trim(), payload });
    if (!mutationRef.current || mutationRef.current.fingerprint !== fingerprint) {
      mutationRef.current = { fingerprint, baseKey: createIdempotencyKey() };
    }
    const baseKey = mutationRef.current.baseKey;
    const projectInput: PilotCreateProjectInput = {
      name: form.projectName.trim(),
      status: 'draft',
      platform: 'douyin',
      aspectRatio: '9:16',
      targetDurationSeconds: 30,
    };
    setStatus('submitting');
    try {
      const created = await controlApi.createProject(projectInput, `${baseKey}:project`);
      const briefResult = await contentApi.createBriefVersion(
        created.project.id,
        { payload },
        `${baseKey}:brief`,
      );
      if (briefResult.value.projectId !== created.project.id) throw new Error('scope mismatch');
      await onProjectCreated(created.project);
    } catch {
      setStatus('error');
    }
  };

  return (
    <main className="v3-ops-page d1-page-stack" data-testid="pilot-project-create-page">
      <header className="d1-page-header">
        <div>
          <Tag color="orange">REAL CREATE</Tag>
          <Typography.Title level={2}>新建项目与第一版 Brief</Typography.Title>
          <Typography.Paragraph type="secondary">
            先创建真实 Control Project，再写入严格品牌事实 Brief；任一步失败都不会生成本地项目。
          </Typography.Paragraph>
        </div>
      </header>
      {status === 'error' ? (
        <Alert
          type="error"
          showIcon
          message="创建未完成"
          description="请检查必填字段或重试真实服务；页面不会保存 Demo 或本地草稿。"
        />
      ) : null}
      <form className="d1-surface v3-ops-filterbar" onSubmit={submit}>
        <label>
          项目名称
          <input
            value={form.projectName}
            maxLength={200}
            required
            onChange={(event) => update('projectName', event.target.value)}
          />
        </label>
        <label>
          获客目标
          <input
            value={form.objective}
            maxLength={2000}
            required
            onChange={(event) => update('objective', event.target.value)}
          />
        </label>
        <label>
          目标人群（每行一条）
          <textarea
            value={form.audience}
            rows={3}
            required
            onChange={(event) => update('audience', event.target.value)}
          />
        </label>
        <label>
          品牌事实与来源（事实｜来源）
          <textarea
            value={form.brandFacts}
            rows={4}
            required
            onChange={(event) => update('brandFacts', event.target.value)}
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.factsConfirmed}
            onChange={(event) => {
              setForm((current) => ({ ...current, factsConfirmed: event.target.checked }));
              setStatus('idle');
            }}
          />
          我已核验以上品牌事实和来源
        </label>
        <Button type="primary" htmlType="submit" loading={status === 'submitting'}>
          创建真实项目与 Brief
        </Button>
      </form>
    </main>
  );
}

export function PilotProjectContentPage({
  routeKey,
  projectId,
  project,
  controlApi = pilotControlApi,
  contentApi = pilotContentProductionApi,
  createIdempotencyKey = () => crypto.randomUUID(),
  onProjectCreated,
  onOpenCanvas,
}: PilotProjectContentPageProps) {
  if (routeKey === 'project-create') {
    return (
      <ProjectCreatePage
        controlApi={controlApi}
        contentApi={contentApi}
        createIdempotencyKey={createIdempotencyKey}
        onProjectCreated={onProjectCreated}
      />
    );
  }
  return (
    <RealProjectPage
      routeKey={routeKey}
      projectId={projectId}
      project={project}
      contentApi={contentApi}
      onOpenCanvas={onOpenCanvas}
    />
  );
}
