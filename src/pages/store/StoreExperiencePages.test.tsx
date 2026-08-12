import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { GrowthLeadsPage, PublishDistributionPage, StoreAssetsPage, StoreEditingPage, StoreStoryboardPage } from './StoreExperiencePages';

function renderAt(path: string, element: React.ReactNode) {
  return render(<MemoryRouter initialEntries={[path]}><Routes><Route path="*" element={element} /></Routes></MemoryRouter>);
}

describe('Store simple V3 production pages', () => {
  it('distinguishes real assets from AI supplementation', () => {
    renderAt('/production/assets/demo', <StoreAssetsPage />);
    expect(screen.getByTestId('store-assets-page')).toBeInTheDocument();
    expect(screen.getByText('实拍素材')).toBeInTheDocument();
    expect(screen.getByText('AI 补镜')).toBeInTheDocument();
  });

  it('keeps storyboard and editing status explicit', () => {
    const { unmount } = renderAt('/projects/demo/storyboard', <StoreStoryboardPage />);
    expect(screen.getByText('缺失镜头提醒')).toBeInTheDocument();
    unmount();
    renderAt('/projects/demo/rough-cut', <StoreEditingPage />);
    expect(screen.getByText('尚未导出成片')).toBeInTheDocument();
  });

  it('does not imply provider publication or lead success', () => {
    const { unmount } = renderAt('/projects/demo/delivery', <PublishDistributionPage />);
    expect(screen.getByText('待配置 / 待发布')).toBeInTheDocument();
    expect(screen.getByText('暂无真实平台连接')).toBeInTheDocument();
    unmount();
    renderAt('/projects/demo/usage', <GrowthLeadsPage />);
    expect(screen.getByText('暂无真实投放归因数据')).toBeInTheDocument();
    expect(screen.getByText('暂无真实线索明细')).toBeInTheDocument();
  });
});
