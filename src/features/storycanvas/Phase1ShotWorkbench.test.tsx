import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Phase1ShotWorkbench, isPlayablePhase1Attempt, normalizePhase1Shots } from './Phase1ShotWorkbench';

const validAsset = { id: 'asset-video-1', assetType: 'video', playableUrl: '/media/shot-01.mp4', validationStatus: 'valid', mimeType: 'video/mp4' };

function createWorkbench(approved = false) {
  return {
    projectId: 'demo-local-001', packageId: 'package-demo-local-001-v1', mode: 'DEMO', assets: [validAsset],
    referenceAssets: [{ id: 'ref-store', assetType: 'image', validationStatus: 'valid', name: '门店参考图', referenceRole: 'location_reference' }],
    modelOptions: { image: [{ id: 'mock-image', label: 'Mock Image', available: true }], video: [{ id: 'mock-video', label: 'Mock Video', available: true }] },
    shots: [
      { id: 'production-shot-02', externalStoryboardShotId: 'shot-02', productionPackageId: 'package-demo-local-001-v1', projectId: 'demo-local-001', sequence: 2, title: '锅底特写', duration: 4, approvedScriptSegment: '锅底翻滚', claimIds: ['C2'], brandFactIds: ['C2'], lockedBusinessFields: { price: '不可修改' }, editableCreativeFields: {}, shotContract: { prohibitedTerms: ['全网最低'] }, status: 'planned', attempts: [], tasks: [] },
      { id: 'production-shot-01', externalStoryboardShotId: 'shot-01', productionPackageId: 'package-demo-local-001-v1', projectId: 'demo-local-001', sequence: 1, title: '门店开场', duration: 4, approvedScriptSegment: '三里屯门店开场', claimIds: ['C1'], brandFactIds: ['C1'], lockedBusinessFields: { address: '北京市朝阳区三里屯' }, editableCreativeFields: {}, shotContract: { requiredCTA: '到店体验', prohibitedTerms: ['第一'] }, status: 'generating', selectedAttemptId: 'attempt-1', generationPlan: { shotId: 'production-shot-01', planVersion: 1, imagePrompt: '门店外景', videoPrompt: '镜头推进', referenceAssetIds: [], generatedBy: 'demo-planner', approvedByOperator: approved }, attempts: [{ id: 'attempt-1', shotId: 'production-shot-01', generationTaskId: 'task-1', attemptNumber: 1, assetId: 'asset-video-1', asset: validAsset, operatorDecision: 'selected', isSelected: true, createdAt: '2026-08-02T00:00:00Z' }], tasks: [{ id: 'task-1', shotId: 'production-shot-01', taskType: 'video.generate', status: 'succeeded', progress: 100, reservedCredit: 120, consumedCredit: 100, releasedCredit: 20, createdAt: '2026-08-02T00:00:00Z' }] },
    ],
  };
}

function renderWorkbench(approved = false) {
  const handlers = { onReload: vi.fn(), onGeneratePlans: vi.fn(), onConfirmPlan: vi.fn(), onSaveCreative: vi.fn(), onCreateTask: vi.fn(), onRetryTask: vi.fn(), onCancelTask: vi.fn(), onDecideAttempt: vi.fn() };
  render(<Phase1ShotWorkbench workbench={createWorkbench(approved)} loading={false} error="" action="" {...handlers} />);
  return handlers;
}

describe('Phase1ShotWorkbench', () => {
  it('orders stable shots by sequence and keeps approved business fields read-only', () => {
    expect(normalizePhase1Shots(createWorkbench()).map((shot) => shot.id)).toEqual(['production-shot-01', 'production-shot-02']);
    renderWorkbench();
    expect(screen.getByText('北京市朝阳区三里屯')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('北京市朝阳区三里屯')).not.toBeInTheDocument();
  });

  it('requires operator confirmation before creating generation tasks', () => {
    const handlers = renderWorkbench(false);
    expect(screen.getByRole('button', { name: '生成视频版本' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '确认方案' }));
    expect(handlers.onConfirmPlan).toHaveBeenCalledWith('production-shot-01', 1);
  });

  it('persists prompt, reference and model edits through the runtime callback', () => {
    const handlers = renderWorkbench(true);
    fireEvent.change(screen.getByLabelText('视频提示词'), { target: { value: '新的推进镜头' } });
    fireEvent.change(screen.getByLabelText('视频模型'), { target: { value: 'mock-video' } });
    fireEvent.click(screen.getByText('门店参考图'));
    fireEvent.click(screen.getByRole('button', { name: '保存创意参数' }));
    expect(handlers.onSaveCreative).toHaveBeenCalledWith('production-shot-01', expect.objectContaining({ videoPrompt: '新的推进镜头', videoModel: 'mock-video', referenceAssetIds: ['ref-store'] }));
  });

  it('shows a real playable asset and never treats a missing url as playable', () => {
    expect(isPlayablePhase1Attempt(createWorkbench().shots[1].attempts[0], [validAsset])).toBe(true);
    expect(isPlayablePhase1Attempt({ ...createWorkbench().shots[1].attempts[0], asset: { ...validAsset, playableUrl: '' } }, [])).toBe(false);
    renderWorkbench(true);
    expect(screen.getAllByLabelText('Attempt 1 视频')).toHaveLength(2);
    expect(screen.getAllByLabelText('Attempt 1 视频')[0]).toHaveAttribute('src', '/media/shot-01.mp4');
  });

  it('submits selected, alternative and rejected decisions without mutating local truth', () => {
    const handlers = renderWorkbench(true);
    fireEvent.click(screen.getByRole('button', { name: '备选' }));
    fireEvent.click(screen.getByRole('button', { name: '淘汰' }));
    expect(handlers.onDecideAttempt).toHaveBeenNthCalledWith(1, 'production-shot-01', 'attempt-1', 'alternative');
    expect(handlers.onDecideAttempt).toHaveBeenNthCalledWith(2, 'production-shot-01', 'attempt-1', 'rejected');
  });
});
