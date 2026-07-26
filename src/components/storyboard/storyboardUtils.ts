import { arrayMove } from '@dnd-kit/sortable';
import type { AssetMatchStatus, ScriptBlock, StoryboardShot, ShotStatus } from '../../domain/types';

export const BLOCK_TYPES_ORDER: Array<ScriptBlock['type']> = ['hook', 'body', 'proof', 'cta', 'disclaimer'];

export interface ShotWithScriptBinding {
  shot: StoryboardShot;
  scriptBlock: ScriptBlock | null;
}

export function mapShotsToBlocks(
  shots: StoryboardShot[],
  scriptBlocks: ScriptBlock[],
): ShotWithScriptBinding[] {
  return shots.map((shot, index) => {
    const scriptBlock = scriptBlocks.length > 0 ? scriptBlocks[index % scriptBlocks.length] : null;
    return {
      shot,
      scriptBlock,
    };
  });
}

export function matchStatusToShotStatus(matchStatus: AssetMatchStatus): ShotStatus {
  if (matchStatus === 'matched') return 'done';
  if (matchStatus === 'missing') return 'missing';
  if (matchStatus === 'reshoot') return 'shooting';
  return 'ready';
}

export function reorderByDrag(
  shots: StoryboardShot[],
  activeId: string,
  overId: string,
): StoryboardShot[] {
  const from = shots.findIndex((shot) => shot.id === activeId);
  const to = shots.findIndex((shot) => shot.id === overId);

  if (from < 0 || to < 0 || from === to) {
    return shots;
  }

  return arrayMove(shots, from, to).map((shot, index) => ({
    ...shot,
    order: index + 1,
  }));
}
