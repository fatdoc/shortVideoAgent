import type {
  Claim,
  RiskLevel,
  ScriptBlock,
  ScriptBlockType,
  ScriptComment,
  ScriptVersion,
} from '../../domain/types';

export const BLOCK_TYPE_ORDER: ScriptBlockType[] = [
  'hook',
  'body',
  'proof',
  'cta',
  'disclaimer',
];

export const BLOCK_TYPE_LABEL: Record<ScriptBlockType, string> = {
  hook: 'Hook 开场',
  body: 'Body 主体',
  proof: 'Proof 证据',
  cta: 'CTA 行动',
  disclaimer: 'Disclaimer 声明',
};

export const BLOCK_TYPE_HINT: Record<ScriptBlockType, string> = {
  hook: '3—5 秒抓住注意力，可引用地址/服务事实',
  body: '展开卖点、价格与体验，注意禁用词',
  proof: '用环境/服务/权益增强可信度',
  cta: '引导领取团购券 / 到店核销',
  disclaimer: '价格与权益以门店实际规则为准',
};

export const VERSION_ACCENT: Record<string, string> = {
  'script-a': '#1677FF',
  'script-b': '#13C2C2',
  'script-c': '#722ED1',
};

/** 可说性评分维度（前端派生，不改 domain） */
export interface SayabilityBreakdown {
  overall: number;
  structure: number;
  citation: number;
  risk: number;
  durationFit: number;
  disclaimer: number;
}

export interface ScriptRiskItem {
  id: string;
  level: RiskLevel;
  title: string;
  detail: string;
  blockId?: string;
}

const PROHIBITED_FALLBACK = ['全网最低', '第一', '保证赚钱', '永久有效', '国家级'];

export function cloneScript(script: ScriptVersion): ScriptVersion {
  return structuredClone(script);
}

export function collectCitations(blocks: ScriptBlock[]): string[] {
  const ids = new Set<string>();
  for (const block of blocks) {
    for (const id of block.claimIds) ids.add(id);
  }
  return Array.from(ids).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function sumBlockDuration(blocks: ScriptBlock[]): number {
  return blocks.reduce((sum, block) => sum + (Number(block.duration) || 0), 0);
}

export function sortBlocks(blocks: ScriptBlock[]): ScriptBlock[] {
  const rank = new Map(BLOCK_TYPE_ORDER.map((type, index) => [type, index]));
  return [...blocks].sort(
    (a, b) => (rank.get(a.type) ?? 99) - (rank.get(b.type) ?? 99) || a.id.localeCompare(b.id),
  );
}

export function detectProhibitedHits(text: string, prohibitedWords: string[]): string[] {
  const words = prohibitedWords.length > 0 ? prohibitedWords : PROHIBITED_FALLBACK;
  return words.filter((word) => word && text.includes(word));
}

export function recomputeBlockRisk(block: ScriptBlock, prohibitedWords: string[]): RiskLevel {
  const hits = detectProhibitedHits(block.content, prohibitedWords);
  if (hits.length >= 2) return 'high';
  if (hits.length === 1) return 'medium';
  if (block.type === 'hook' && block.claimIds.length === 0) return 'low';
  if (
    (block.type === 'body' || block.type === 'proof') &&
    block.claimIds.length === 0 &&
    block.content.trim().length > 0
  ) {
    return 'low';
  }
  if (block.type === 'disclaimer' && !block.claimIds.includes('C8')) return 'medium';
  return 'none';
}

export function withRecomputedRisks(
  script: ScriptVersion,
  prohibitedWords: string[],
): ScriptVersion {
  const blocks = script.blocks.map((block) => ({
    ...block,
    riskLevel: recomputeBlockRisk(block, prohibitedWords),
  }));
  return {
    ...script,
    blocks,
    citations: collectCitations(blocks),
    estimatedDuration: sumBlockDuration(blocks),
  };
}

export function computeSayability(
  script: ScriptVersion,
  facts: Claim[],
  prohibitedWords: string[],
  targetDuration = 30,
): SayabilityBreakdown {
  const types = new Set(script.blocks.map((b) => b.type));
  const required = BLOCK_TYPE_ORDER.filter((t) => t !== 'disclaimer');
  const structure =
    40 +
    required.reduce((score, type) => score + (types.has(type) ? 12 : 0), 0) +
    (types.has('disclaimer') ? 12 : 0);
  const structureClamped = Math.min(100, structure);

  const approvedIds = new Set(facts.filter((f) => f.status === 'approved').map((f) => f.id));
  const citations = collectCitations(script.blocks);
  const validCitations = citations.filter((id) => approvedIds.has(id));
  const citation =
    citations.length === 0
      ? 45
      : Math.min(100, 55 + validCitations.length * 8 + (validCitations.includes('C8') ? 5 : 0));

  const hits = script.blocks.flatMap((b) => detectProhibitedHits(b.content, prohibitedWords));
  const highRisk = script.blocks.filter((b) => b.riskLevel === 'high').length;
  const mediumRisk = script.blocks.filter((b) => b.riskLevel === 'medium').length;
  let risk = 100 - hits.length * 18 - highRisk * 20 - mediumRisk * 10;
  risk = Math.max(20, Math.min(100, risk));

  const duration = sumBlockDuration(script.blocks);
  const drift = Math.abs(duration - targetDuration);
  const durationFit = Math.max(30, 100 - drift * 8);

  const hasDisclaimer = script.blocks.some(
    (b) =>
      b.type === 'disclaimer' &&
      (b.claimIds.includes('C8') || /门店实际|以.*为准/.test(b.content)),
  );
  const disclaimer = hasDisclaimer ? 100 : 40;

  const overall = Math.round(
    structureClamped * 0.2 +
      citation * 0.25 +
      risk * 0.25 +
      durationFit * 0.15 +
      disclaimer * 0.15,
  );

  return {
    overall: Math.max(0, Math.min(100, overall)),
    structure: Math.round(structureClamped),
    citation: Math.round(citation),
    risk: Math.round(risk),
    durationFit: Math.round(durationFit),
    disclaimer: Math.round(disclaimer),
  };
}

export function buildRiskItems(
  script: ScriptVersion,
  prohibitedWords: string[],
  facts: Claim[],
): ScriptRiskItem[] {
  const items: ScriptRiskItem[] = [];
  const factMap = new Map(facts.map((f) => [f.id, f]));

  for (const block of script.blocks) {
    const hits = detectProhibitedHits(block.content, prohibitedWords);
    if (hits.length > 0) {
      items.push({
        id: `risk-prohibited-${block.id}`,
        level: hits.length >= 2 ? 'high' : 'medium',
        title: `${BLOCK_TYPE_LABEL[block.type]} 命中禁用词`,
        detail: `检测到：${hits.join('、')}`,
        blockId: block.id,
      });
    }
    for (const claimId of block.claimIds) {
      const fact = factMap.get(claimId);
      if (!fact) {
        items.push({
          id: `risk-missing-claim-${block.id}-${claimId}`,
          level: 'medium',
          title: `引用了不存在的事实 ${claimId}`,
          detail: `${BLOCK_TYPE_LABEL[block.type]} 引用了品牌库中不存在的编号`,
          blockId: block.id,
        });
      } else if (fact.status !== 'approved') {
        items.push({
          id: `risk-claim-status-${block.id}-${claimId}`,
          level: 'medium',
          title: `${claimId} 未处于已通过状态`,
          detail: `当前状态：${fact.status}`,
          blockId: block.id,
        });
      }
    }
    if (!block.content.trim()) {
      items.push({
        id: `risk-empty-${block.id}`,
        level: 'low',
        title: `${BLOCK_TYPE_LABEL[block.type]} 内容为空`,
        detail: '请补充口播文案后再进入分镜',
        blockId: block.id,
      });
    }
  }

  const hasDisclaimer = script.blocks.some((b) => b.type === 'disclaimer');
  if (!hasDisclaimer) {
    items.push({
      id: 'risk-no-disclaimer',
      level: 'high',
      title: '缺少 Disclaimer',
      detail: '价格/权益类脚本必须包含门店实际规则声明',
    });
  } else {
    const disc = script.blocks.find((b) => b.type === 'disclaimer');
    if (disc && !disc.claimIds.includes('C8')) {
      items.push({
        id: 'risk-disclaimer-c8',
        level: 'medium',
        title: 'Disclaimer 未引用 C8',
        detail: '建议绑定法务口径事实 C8',
        blockId: disc.id,
      });
    }
  }

  const duration = sumBlockDuration(script.blocks);
  if (Math.abs(duration - 30) > 6) {
    items.push({
      id: 'risk-duration',
      level: 'low',
      title: '预估时长偏离目标',
      detail: `当前 ${duration}s，目标约 30s`,
    });
  }

  if (items.length === 0) {
    items.push({
      id: 'risk-clean',
      level: 'none',
      title: '暂无高优先级风险',
      detail: '结构完整，未命中禁用词，可进入分镜',
    });
  }

  return items;
}

export function toggleClaimOnBlock(
  script: ScriptVersion,
  blockId: string,
  claimId: string,
  prohibitedWords: string[],
): ScriptVersion {
  const next = cloneScript(script);
  const block = next.blocks.find((b) => b.id === blockId);
  if (!block) return script;
  if (block.claimIds.includes(claimId)) {
    block.claimIds = block.claimIds.filter((id) => id !== claimId);
  } else {
    block.claimIds = [...block.claimIds, claimId].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true }),
    );
  }
  return withRecomputedRisks(next, prohibitedWords);
}

export function updateBlockContent(
  script: ScriptVersion,
  blockId: string,
  content: string,
  prohibitedWords: string[],
): ScriptVersion {
  const next = cloneScript(script);
  const block = next.blocks.find((b) => b.id === blockId);
  if (!block) return script;
  block.content = content;
  return withRecomputedRisks(next, prohibitedWords);
}

export function updateBlockDuration(
  script: ScriptVersion,
  blockId: string,
  duration: number,
  prohibitedWords: string[],
): ScriptVersion {
  const next = cloneScript(script);
  const block = next.blocks.find((b) => b.id === blockId);
  if (!block) return script;
  block.duration = Math.max(1, Math.min(30, Math.round(duration) || 1));
  return withRecomputedRisks(next, prohibitedWords);
}

export function addBlockComment(
  script: ScriptVersion,
  blockId: string,
  content: string,
  author = '张晓明',
): ScriptVersion {
  const next = cloneScript(script);
  const block = next.blocks.find((b) => b.id === blockId);
  if (!block || !content.trim()) return script;
  const comment: ScriptComment = {
    id: `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    author,
    content: content.trim(),
    createdAt: new Date().toISOString(),
  };
  block.comments = [...block.comments, comment];
  return next;
}

/** Mock 生成：围绕品牌事实重写当前版本文案，保留版本 id/name */
export function mockGenerateScript(
  base: ScriptVersion,
  facts: Claim[],
  briefCta: string,
  prohibitedWords: string[],
  variant: 'refresh' | 'a' | 'b' | 'c' = 'refresh',
): ScriptVersion {
  const fact = (id: string) => facts.find((f) => f.id === id)?.text ?? '';
  const cta = briefCta || '领取团购券 / 到店核销';

  type Tpl = { content: string; claimIds: string[]; duration: number };
  const templates: Record<string, Record<ScriptBlockType, Tpl>> = {
    a: {
      hook: {
        content: `三里屯深夜还能吃到热气腾腾的火锅？${fact('C5') || '等位还有零食饮料'}。`,
        claimIds: ['C1', 'C5'],
        duration: 4,
      },
      body: {
        content: `进店先看${fact('C3') || '四宫格锅底 68 元'}，招牌毛肚和虾滑是必点。`,
        claimIds: ['C3'],
        duration: 12,
      },
      proof: {
        content: '环境适合聚餐打卡，服务节奏清楚，适合本地和游客真实探店。',
        claimIds: [],
        duration: 8,
      },
      cta: {
        content: `现在就${cta}，晚高峰也少踩坑。`,
        claimIds: [],
        duration: 4,
      },
      disclaimer: {
        content: fact('C8') || '具体套餐、价格和权益以门店实际规则为准。',
        claimIds: ['C8'],
        duration: 2,
      },
    },
    b: {
      hook: {
        content: `不只是吃火锅，${fact('C6') || '会员积分可兑换权益'}，${fact('C7') || '生日还有礼遇'}。`,
        claimIds: ['C6', 'C7'],
        duration: 4,
      },
      body: {
        content: `${fact('C4') || '甄选双人餐 258 元'}，适合约会和朋友聚餐一次讲清。`,
        claimIds: ['C4'],
        duration: 12,
      },
      proof: {
        content: '从锅底到菜品再到会员权益，一条视频把能说的都说清楚。',
        claimIds: ['C6'],
        duration: 8,
      },
      cta: {
        content: `先${cta.split('/')[0]?.trim() || '领券'}，再到店核销更省心。`,
        claimIds: [],
        duration: 4,
      },
      disclaimer: {
        content: fact('C8') || '具体套餐、价格和权益以门店实际规则为准。',
        claimIds: ['C8'],
        duration: 2,
      },
    },
    c: {
      hook: {
        content: `夜色里的三里屯，${fact('C1') || '商圈火锅香'}最容易让人停下脚步。`,
        claimIds: ['C1'],
        duration: 4,
      },
      body: {
        content: `${fact('C2') || '营业到次日早上'}，适合饭后聚会和深夜补能量。`,
        claimIds: ['C2'],
        duration: 12,
      },
      proof: {
        content: '从外景到餐桌，真实探店视角记录环境与服务体验。',
        claimIds: [],
        duration: 8,
      },
      cta: {
        content: `${cta}，开启今晚的火锅局。`,
        claimIds: [],
        duration: 4,
      },
      disclaimer: {
        content: fact('C8') || '具体套餐、价格和权益以门店实际规则为准。',
        claimIds: ['C8'],
        duration: 2,
      },
    },
  };

  const key =
    variant === 'refresh'
      ? base.id === 'script-b'
        ? 'b'
        : base.id === 'script-c'
          ? 'c'
          : 'a'
      : variant;

  const pack = templates[key] ?? templates.a;
  const stamp = Date.now();

  const blocks: ScriptBlock[] = BLOCK_TYPE_ORDER.map((type) => {
    const prev = base.blocks.find((b) => b.type === type);
    const tpl = pack[type];
    return {
      id: prev?.id ?? `blk-${key}-${type}-${stamp}`,
      type,
      content: tpl.content,
      duration: tpl.duration,
      claimIds: [...tpl.claimIds],
      comments: prev?.comments ?? [],
      riskLevel: 'none' as const,
    };
  });

  const generated: ScriptVersion = {
    ...cloneScript(base),
    blocks,
    score: key === 'a' ? 88 : key === 'b' ? 84 : 81,
    createdAt: new Date().toISOString(),
  };

  return withRecomputedRisks(generated, prohibitedWords);
}

export function applyScoreToScript(
  script: ScriptVersion,
  sayability: SayabilityBreakdown,
): ScriptVersion {
  return {
    ...script,
    score: sayability.overall,
    citations: collectCitations(script.blocks),
    estimatedDuration: sumBlockDuration(script.blocks),
  };
}

export function formatShortTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'high':
      return '#FF4D4F';
    case 'medium':
      return '#FA8C16';
    case 'low':
      return '#1677FF';
    default:
      return '#8C8C8C';
  }
}

export function claimTypeLabel(type: string): string {
  const map: Record<string, string> = {
    fact: '事实',
    price: '价格',
    service: '服务',
    policy: '权益',
    disclaimer: '声明',
  };
  return map[type] ?? type;
}
