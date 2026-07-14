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

test('editor workbench panes resize, collapse, and persist', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('.editor-shell')).toBeVisible();

  const library = page.getByRole('complementary', { name: 'Unit library' });
  const inspector = page.getByRole('complementary', { name: 'Editor inspector' });
  const librarySeparator = page.getByRole('separator', { name: 'Resize unit library' });
  await expect(library).not.toHaveClass(/is-collapsed/);
  await expect(inspector).not.toHaveClass(/is-collapsed/);
  await librarySeparator.focus();
  await page.keyboard.press('ArrowRight');
  await expect(librarySeparator).toHaveAttribute('aria-valuenow', '312');

  await page.getByRole('button', { name: 'Collapse unit library' }).click();
  await expect(library).toHaveClass(/is-collapsed/);
  await expect(page.getByRole('button', { name: 'Open unit library' })).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('editp_workspace_layout_v1')));
  expect(saved.leftWidth).toBe(312);
  expect(saved.leftCollapsed).toBe(true);
});

test('narrow workbench uses temporary overlay panes without overwriting desktop preferences', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.addInitScript(() => localStorage.setItem('editp_workspace_layout_v1', JSON.stringify({
    leftWidth: 330,
    rightWidth: 410,
    leftCollapsed: false,
    rightCollapsed: false,
    density: 'balanced',
    inspectorTab: 'details',
    collapsedGroups: {},
  })));
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const library = page.getByRole('complementary', { name: 'Unit library' });
  await expect(library).toHaveClass(/is-collapsed/);
  await page.getByRole('button', { name: 'Open unit library' }).click();
  await expect(library).not.toHaveClass(/is-collapsed/);
  await expect(library).toHaveCSS('position', 'fixed');
  await page.getByRole('button', { name: 'Close open workspace panel' }).click({ position: { x: 900, y: 400 } });
  await expect(library).toHaveClass(/is-collapsed/);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('editp_workspace_layout_v1')));
  expect(saved.leftWidth).toBe(330);
  expect(saved.leftCollapsed).toBe(false);
  expect(saved.rightCollapsed).toBe(false);
});

test('selected unit header reflows within a narrow editor canvas', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const header = page.locator('.editor-unit-header');
  const identity = header.locator('.editor-unit-identity');
  const metrics = header.locator('.unit-dossier-metrics');
  const actions = header.locator('.editor-unit-actions');
  await expect(header).toBeVisible();

  const layout = await header.evaluate(element => {
    const bounds = element.getBoundingClientRect();
    const childBounds = [...element.children].map(child => child.getBoundingClientRect());
    return {
      width: bounds.width,
      scrollWidth: element.scrollWidth,
      childrenFit: childBounds.every(child => (
        child.left >= bounds.left && child.right <= bounds.right
      )),
    };
  });

  expect(layout.childrenFit).toBe(true);
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width));
  await expect(metrics).toHaveCSS('grid-row-start', '2');
  await expect(actions).toHaveCSS('grid-column-start', '2');
  await expect(identity).toBeVisible();

  await page.setViewportSize({ width: 700, height: 900 });
  await expect(actions).toHaveCSS('grid-column-start', '1');
  await expect(actions).toHaveCSS('grid-row-start', '3');
  const compactLayout = await header.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    scrollWidth: element.scrollWidth,
  }));
  expect(compactLayout.scrollWidth).toBeLessThanOrEqual(Math.ceil(compactLayout.width));
});

test('selected unit actions keep an even vertical inset in the desktop header', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const inset = await page.locator('.editor-unit-header').evaluate(header => {
    const headerBounds = header.getBoundingClientRect();
    const actionBounds = header.querySelector('.editor-unit-actions').getBoundingClientRect();
    return {
      top: actionBounds.top - headerBounds.top,
      bottom: headerBounds.bottom - actionBounds.bottom,
    };
  });

  expect(inset.top).toBeGreaterThan(0);
  expect(Math.abs(inset.top - inset.bottom)).toBeLessThanOrEqual(1);
});

test('parameter tabs keep the selected state inset from the editor section edge', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const tabList = page.getByRole('tablist', { name: 'Editor parameter sections' });
  const activeTab = tabList.getByRole('tab', { selected: true });
  await expect(activeTab.locator('small')).toBeVisible();

  const inset = await tabList.evaluate(list => {
    const listBounds = list.getBoundingClientRect();
    const activeBounds = list.querySelector('[aria-selected="true"]').getBoundingClientRect();
    return {
      top: activeBounds.top - listBounds.top,
      bottom: listBounds.bottom - activeBounds.bottom,
      radius: getComputedStyle(list.querySelector('[aria-selected="true"]')).borderRadius,
    };
  });

  expect(inset.top).toBeGreaterThan(0);
  expect(inset.bottom).toBeGreaterThan(0);
  expect(inset.radius).not.toBe('0px');
});

test('borrow weapon dialog exposes the themed donor and comparison workflow', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  const cloneDialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await cloneDialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_borrow_ui_test');
  await cloneDialog.getByRole('button', { name: 'Create Clone' }).click();

  await page.getByRole('tab', { name: /Weapons/ }).click();
  await page.getByRole('button', { name: 'Choose weapon' }).click();

  const borrowDialog = page.getByRole('dialog', { name: 'Borrow a weapon' });
  await expect(borrowDialog).toBeVisible();
  await expect(borrowDialog.getByLabel('Search donor units')).toBeFocused();
  await expect(borrowDialog.getByRole('listbox', { name: 'Donor units' })).toBeVisible();

  await borrowDialog.getByRole('option').first().click();
  await expect(borrowDialog.getByText('Selected donor')).toBeVisible();
  await expect(borrowDialog.getByRole('button', { name: /Borrow to slot/ }).first()).toBeVisible();

  const bounds = await borrowDialog.evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom };
  });
  expect(bounds.top).toBeGreaterThanOrEqual(0);
  expect(bounds.left).toBeGreaterThanOrEqual(0);
  expect(bounds.right).toBeLessThanOrEqual(1440);
  expect(bounds.bottom).toBeLessThanOrEqual(900);

  await page.keyboard.press('Escape');
  await expect(borrowDialog).toBeHidden();
});

test('clone identity remains editable and nested clones keep the selected clone as parent', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  let dialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await dialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_editorial_test');
  await dialog.getByRole('button', { name: 'Create Clone' }).click();

  await page.getByRole('button', { name: 'Edit identity' }).click();
  await expect(page.getByRole('tab', { name: /Identity/ })).toHaveAttribute('aria-selected', 'true');
  const inspector = page.getByRole('complementary', { name: 'Editor inspector' });
  await inspector.getByLabel('Display name', { exact: true }).fill('Editorial Test Clone');

  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  dialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await expect(dialog.getByLabel('Parent Unit', { exact: true })).toHaveValue('armdfly_editorial_test');
  await dialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_editorial_nested_test');
  await dialog.getByRole('button', { name: 'Create Clone' }).click();

  await expect(page.getByRole('button', { name: 'Edit identity' })).toBeVisible();
  await expect(page.getByText('armdfly_editorial_nested_test', { exact: true }).first()).toBeVisible();
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
