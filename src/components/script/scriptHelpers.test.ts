import { describe, expect, it } from 'vitest';
import { cloneDemoWorkspace } from '../../mocks/demoWorkspace';
import {
  buildRiskItems,
  collectCitations,
  computeSayability,
  detectProhibitedHits,
  mockGenerateScript,
  sumBlockDuration,
  toggleClaimOnBlock,
  updateBlockContent,
  withRecomputedRisks,
} from './scriptHelpers';

describe('scriptHelpers', () => {
  const workspace = cloneDemoWorkspace();
  const scriptA = workspace.scripts[0]!;
  const facts = workspace.brand.facts;
  const prohibited = workspace.brand.prohibitedWords;

  it('collects citations and duration from blocks', () => {
    expect(collectCitations(scriptA.blocks)).toEqual(
      expect.arrayContaining(['C1', 'C3', 'C5', 'C8']),
    );
    expect(sumBlockDuration(scriptA.blocks)).toBe(30);
  });

  it('detects prohibited words and raises risk', () => {
    expect(detectProhibitedHits('全网最低价格', prohibited)).toContain('全网最低');
    const dirty = updateBlockContent(scriptA, 'blk-a-hook', '全网最低火锅', prohibited);
    const hook = dirty.blocks.find((b) => b.id === 'blk-a-hook');
    expect(hook?.riskLevel).toBe('medium');
    const risks = buildRiskItems(dirty, prohibited, facts);
    expect(risks.some((r) => r.title.includes('禁用词'))).toBe(true);
  });

  it('toggles claim binding on block', () => {
    const withC2 = toggleClaimOnBlock(scriptA, 'blk-a-hook', 'C2', prohibited);
    expect(withC2.blocks.find((b) => b.id === 'blk-a-hook')?.claimIds).toContain('C2');
    const withoutC2 = toggleClaimOnBlock(withC2, 'blk-a-hook', 'C2', prohibited);
    expect(withoutC2.blocks.find((b) => b.id === 'blk-a-hook')?.claimIds).not.toContain('C2');
  });

  it('computes sayability score in range', () => {
    const score = computeSayability(scriptA, facts, prohibited, 30);
    expect(score.overall).toBeGreaterThanOrEqual(60);
    expect(score.overall).toBeLessThanOrEqual(100);
    expect(score.disclaimer).toBe(100);
  });

  it('mock generates script with five block types and C8 disclaimer', () => {
    const generated = mockGenerateScript(scriptA, facts, workspace.brief.cta, prohibited, 'b');
    expect(generated.blocks).toHaveLength(5);
    expect(generated.blocks.map((b) => b.type)).toEqual([
      'hook',
      'body',
      'proof',
      'cta',
      'disclaimer',
    ]);
    const disc = generated.blocks.find((b) => b.type === 'disclaimer');
    expect(disc?.claimIds).toContain('C8');
    const recomputed = withRecomputedRisks(generated, prohibited);
    expect(recomputed.citations.length).toBeGreaterThan(0);
  });
});
