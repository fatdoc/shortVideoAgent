import { describe, expect, it } from 'vitest';
import type { ScriptBlock, StoryboardShot } from '../../domain/types';
import {
  BLOCK_TYPES_ORDER,
  mapShotsToBlocks,
  matchStatusToShotStatus,
  reorderByDrag,
} from './storyboardUtils';

describe('storyboardUtils', () => {
  const shots: StoryboardShot[] = [
    {
      id: 'shot-a',
      order: 1,
      duration: 3,
      description: '镜头A',
      shotType: 'wide',
      cameraPosition: 'A',
      narration: 'narration',
      screenText: 'text',
      sourceType: 'upload',
      riskLevel: 'none',
      status: 'done',
      assignee: '拍摄组 A',
      assetId: 'asset-a',
      matchStatus: 'matched',
    },
    {
      id: 'shot-b',
      order: 2,
      duration: 4,
      description: '镜头B',
      shotType: 'wide',
      cameraPosition: 'B',
      narration: 'narration',
      screenText: 'text',
      sourceType: 'upload',
      riskLevel: 'none',
      status: 'done',
      matchStatus: 'reshoot',
    },
    {
      id: 'shot-c',
      order: 3,
      duration: 5,
      description: '镜头C',
      shotType: 'wide',
      cameraPosition: 'C',
      narration: 'narration',
      screenText: 'text',
      sourceType: 'upload',
      riskLevel: 'none',
      status: 'done',
      matchStatus: 'missing',
    },
  ];

  const scriptBlocks: ScriptBlock[] = [
    {
      id: 'hook',
      type: 'hook',
      content: '开场',
      duration: 3,
      claimIds: [],
      comments: [],
      riskLevel: 'low',
    },
    {
      id: 'body',
      type: 'body',
      content: '正文',
      duration: 5,
      claimIds: [],
      comments: [],
      riskLevel: 'low',
    },
    {
      id: 'proof',
      type: 'proof',
      content: '证明',
      duration: 3,
      claimIds: [],
      comments: [],
      riskLevel: 'low',
    },
    {
      id: 'cta',
      type: 'cta',
      content: 'CTA',
      duration: 2,
      claimIds: [],
      comments: [],
      riskLevel: 'low',
    },
    {
      id: 'disclaimer',
      type: 'disclaimer',
      content: '免责声明',
      duration: 1,
      claimIds: [],
      comments: [],
      riskLevel: 'low',
    },
  ];

  it('maps shots to script blocks in configured order', () => {
    expect(BLOCK_TYPES_ORDER).toEqual(['hook', 'body', 'proof', 'cta', 'disclaimer']);
    const mapped = mapShotsToBlocks(shots, scriptBlocks);

    expect(mapped).toHaveLength(3);
    expect(mapped[0].scriptBlock?.type).toBe('hook');
    expect(mapped[1].scriptBlock?.type).toBe('body');
    expect(mapped[2].scriptBlock?.type).toBe('proof');
  });

  it('returns unchanged when dragging same position', () => {
    const next = reorderByDrag(shots, 'shot-b', 'shot-b');
    expect(next).toBe(shots);
  });

  it('reorders by drag id pair', () => {
    const next = reorderByDrag(shots, 'shot-a', 'shot-c');
    expect(next.map((item) => item.id)).toEqual(['shot-b', 'shot-c', 'shot-a']);
    expect(next.map((item) => item.order)).toEqual([1, 2, 3]);
  });

  it('maps match status to shot status', () => {
    expect(matchStatusToShotStatus('matched')).toBe('done');
    expect(matchStatusToShotStatus('reshoot')).toBe('shooting');
    expect(matchStatusToShotStatus('missing')).toBe('missing');
    expect(matchStatusToShotStatus('ai_placeholder')).toBe('ready');
  });
});
