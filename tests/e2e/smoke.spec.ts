import { expect, test } from '@playwright/test';

test('dashboard route is reachable', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('工作台 / 项目列表')).toBeVisible();
  await expect(page.getByText('短视频 Agent')).toBeVisible();
});
