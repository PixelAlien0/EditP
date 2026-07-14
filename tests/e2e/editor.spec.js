import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function waitForMainMenu(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bar EditP/i })).toBeVisible({ timeout: 30_000 });
}

test('main workflow remains keyboard accessible', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.getByRole('navigation', { name: 'Editor workflow' })).toBeVisible();
  await page.getByRole('button', { name: /Build Menus/i }).click();
  await expect(page.getByText('Factory Roster Designer', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('button', { name: /Review & Export/i }).click();
  await expect(page.getByRole('heading', { name: 'Review & Export' })).toBeVisible();

  await page.keyboard.press('Control+K');
  await expect(page.getByRole('heading', { name: 'Command palette' })).toBeVisible();
  await page.getByRole('combobox').fill('health');
  await expect(page.getByRole('option', { name: /Health/ }).first()).toBeVisible();
  await page.keyboard.press('Escape');
});

test('main menu and editor have no serious accessibility violations', async ({ page }) => {
  await waitForMainMenu(page);
  let results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([]);

  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.getByRole('navigation', { name: 'Editor workflow' })).toBeVisible();
  results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([]);
});

test('project edits recover after reload', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  const metalCard = page.locator('.stat-card').filter({ hasText: 'METAL COST' }).first();
  const metalInput = metalCard.locator('input').first();
  await expect(metalInput).toBeVisible();
  await metalInput.fill('4321');
  await page.waitForTimeout(1200);

  await page.reload();
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('.stat-card').filter({ hasText: 'METAL COST' }).first().locator('input').first()).toHaveValue('4321');
});

test('clone creator stays centered above the workspace', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.getByRole('navigation', { name: 'Editor workflow' })).toBeVisible();
  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();

  const dialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  const overlay = page.locator('.clone-creator-overlay');
  await expect(dialog).toBeVisible();
  await expect(overlay).toHaveCSS('position', 'fixed');
  await expect(overlay).toHaveCSS('inset', '0px');

  const geometry = await dialog.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return {
      parentIsBody: element.parentElement?.parentElement === document.body,
      centerX: rect.left + (rect.width / 2),
      centerY: rect.top + (rect.height / 2),
      top: rect.top,
      bottom: rect.bottom,
    };
  });

  expect(geometry.parentIsBody).toBe(true);
  expect(Math.abs(geometry.centerX - 720)).toBeLessThan(2);
  expect(Math.abs(geometry.centerY - 450)).toBeLessThan(2);
  expect(geometry.top).toBeGreaterThanOrEqual(0);
  expect(geometry.bottom).toBeLessThanOrEqual(900);
});

for (const width of [1024, 1180, 1440, 1920, 2560]) {
  for (const theme of ['dark', 'light']) {
    test(`visual baseline ${theme} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1080 });
      await page.addInitScript(selectedTheme => localStorage.setItem('bmf_theme', selectedTheme), theme);
      await waitForMainMenu(page);
      await expect(page).toHaveScreenshot(`main-menu-${theme}-${width}.png`, { fullPage: true });
    });
  }
}
