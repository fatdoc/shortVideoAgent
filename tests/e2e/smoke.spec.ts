import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/dashboard');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('dashboard route renders the unified Demo project', async ({ page }) => {
  await expect(page.getByRole('heading', { level: 3, name: '工作台' })).toBeVisible();
  await expect(page.getByText('短视频 Agent')).toBeVisible();
  await expect(
    page.getByTestId('dashboard-project-row').getByText('demo-local-001', { exact: true }),
  ).toBeVisible();
  await expect(
    page
      .getByTestId('dashboard-project-row')
      .getByText('海底捞火锅·北京三里屯店探店视频', { exact: true }),
  ).toBeVisible();
});

test('Gate 2 keeps Brief data consistent through Brand and Script', async ({ page }) => {
  const browserErrors: string[] = [];
  const nextCta = '领取团购券并到店核销';
  page.on('console', (message) => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', (error) => browserErrors.push(error.message));

  await page.goto('/projects/new');
  await expect(page.getByRole('heading', { level: 3, name: '新建项目 / Brief' })).toBeVisible();
  await page.getByTestId('brief-cta').fill(nextCta);
  await page.getByTestId('brief-save').click();
  await expect(page.getByText('已保存', { exact: true })).toBeVisible();

  await page.getByTestId('brief-to-brand').click();
  await expect(page.getByRole('heading', { level: 3, name: '品牌 / 商家大脑' })).toBeVisible();
  await expect(page.getByText(nextCta, { exact: true })).toBeVisible();
  await expect(page.getByTestId('brand-facts-panel')).toContainText('C1');
  await expect(page.getByTestId('brand-facts-panel')).toContainText('C8');

  await page.getByTestId('brand-to-script').click();
  await expect(page.getByRole('heading', { level: 3, name: '脚本生成与编辑' })).toBeVisible();
  await expect(page.getByText(`CTA：${nextCta}`, { exact: true })).toBeVisible();
  await page.getByTestId('script-version-script-b').click();
  await expect(page.getByTestId('script-block-content-hook')).toHaveValue(/不只是吃火锅/);

  const persistedHook = 'Gate 2 刷新持久化脚本文案';
  await page.getByTestId('script-block-content-hook').fill(persistedHook);
  await page.getByTestId('script-save-btn').click();
  await expect(page.getByText('已同步', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId('script-block-content-hook')).toHaveValue(persistedHook);

  expect(browserErrors).toEqual([]);
});
