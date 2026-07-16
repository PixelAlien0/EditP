import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function waitForMainMenu(page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Bar EditP/i })).toBeVisible({ timeout: 30_000 });
}

async function readPrimaryActionPalette(locator) {
  return locator.evaluate(element => {
    const resolveColor = token => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    return {
      background: getComputedStyle(element).backgroundColor,
      accent: resolveColor('--color-accent-strong'),
      subtle: resolveColor('--color-surface-accent-subtle'),
    };
  });
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

test('main menu, editor, and collections have no serious accessibility violations', async ({ page }) => {
  await waitForMainMenu(page);
  let results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([]);

  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.getByRole('navigation', { name: 'Editor workflow' })).toBeVisible();
  results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([]);

  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Collections/ }).click();
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze();
  expect(results.violations.filter(violation => ['serious', 'critical'].includes(violation.impact))).toEqual([]);
});

test('unit parameter relevance preserves edits and distinguishes inherited booleans', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('#workspace-panel-structure')).toBeVisible();

  const view = page.getByRole('group', { name: 'Choose visible unit parameters' });
  const relevant = view.getByRole('button', { name: 'Relevant' });
  const all = view.getByRole('button', { name: 'All' });
  await expect(relevant).toHaveAttribute('aria-pressed', 'true');

  const cards = page.locator('#workspace-panel-structure .stat-card');
  const relevantCount = await cards.count();
  await all.click();
  await expect(all).toHaveAttribute('aria-pressed', 'true');
  expect(await cards.count()).toBeGreaterThan(relevantCount);

  const blocking = page.getByRole('combobox', { name: 'Blocks movement override' });
  await expect(blocking).toHaveValue('');
  await expect(blocking.locator('option:checked')).toHaveText('Inherited · Disabled');

  const cloak = page.getByRole('combobox', { name: 'Can cloak override' });
  await cloak.selectOption('true');
  await relevant.click();
  await expect(page.getByRole('combobox', { name: 'Can cloak override' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('editp_unit_parameter_view_v1'))).toBe('relevant');
});

test('wide parameter groups flow independently without paired-row gaps', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('#workspace-panel-structure')).toBeVisible();

  const positions = await page.locator('#workspace-panel-structure .parameter-compact-group').evaluateAll(nodes => (
    nodes.map(node => {
      const bounds = node.getBoundingClientRect();
      return { x: Math.round(bounds.x), y: Math.round(bounds.y), bottom: Math.round(bounds.bottom) };
    })
  ));
  const columns = Map.groupBy(positions, position => position.x);
  expect(columns.size).toBe(2);
  for (const column of columns.values()) {
    for (let index = 1; index < column.length; index += 1) {
      expect(column[index].y - column[index - 1].bottom).toBeLessThanOrEqual(16);
    }
  }
});

test('primary actions use restrained accent surfaces instead of solid pink fills', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => localStorage.setItem('bmf_theme', 'dark'));
  await waitForMainMenu(page);

  const enterAction = page.getByRole('button', { name: /Enter workshop|Continue workshop/i });
  let palette = await readPrimaryActionPalette(enterAction);
  expect(palette.background).toBe(palette.subtle);
  expect(palette.background).not.toBe(palette.accent);
  await enterAction.click();

  const createAction = page.getByRole('button', { name: /Create a clone of the selected unit/i });
  palette = await readPrimaryActionPalette(createAction);
  expect(palette.background).toBe(palette.subtle);
  await createAction.click();

  const submitAction = page.getByRole('dialog', { name: 'Clone Unit Creator' }).getByRole('button', { name: 'Create Clone' });
  palette = await readPrimaryActionPalette(submitAction);
  expect(palette.background).toBe(palette.subtle);
  expect(palette.background).not.toBe(palette.accent);
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

test('legacy projects migrate once without duplicate local-storage writes', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('bmf_tweaks', JSON.stringify({ armdfly: { metalcost: '2468' } }));
    localStorage.setItem('bmf_project_name', 'Migrated project');
  });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const metalInput = page.locator('.stat-card').filter({ hasText: 'METAL COST' }).first().locator('input').first();
  await expect(metalInput).toHaveValue('2468');
  await expect.poll(() => page.evaluate(() => localStorage.getItem('bmf_tweaks'))).toBeNull();

  await metalInput.fill('3579');
  await page.waitForTimeout(1000);
  expect(await page.evaluate(() => localStorage.getItem('bmf_tweaks'))).toBeNull();

  await page.reload();
  await expect(page.getByRole('heading', { name: /Bar EditP/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('.stat-card').filter({ hasText: 'METAL COST' }).first().locator('input').first()).toHaveValue('3579');
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
  await page.setViewportSize({ width: 1920, height: 900 });
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

  const separatorBounds = await librarySeparator.boundingBox();
  await page.mouse.move(separatorBounds.x + (separatorBounds.width / 2), separatorBounds.y + 120);
  await page.mouse.down();
  await page.mouse.move(separatorBounds.x - 160, separatorBounds.y + 120, { steps: 4 });
  await page.mouse.up();
  await expect(librarySeparator).toHaveAttribute('aria-valuenow', '216');
  await expect(library).toHaveCSS('width', '216px');
  await expect(library.locator('.sidebar-total')).toBeHidden();
  const collapseControlFits = await library.evaluate(element => {
    const pane = element.getBoundingClientRect();
    const control = element.querySelector('.workspace-pane-collapse-action').getBoundingClientRect();
    return control.left >= pane.left && control.right <= pane.right;
  });
  expect(collapseControlFits).toBe(true);

  await page.getByRole('button', { name: 'Collapse unit library' }).click();
  await expect(library).toHaveClass(/is-collapsed/);
  await expect(page.getByRole('button', { name: 'Open unit library' })).toBeVisible();

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('editp_workspace_layout_v1')));
  expect(saved.leftWidth).toBe(216);
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

test('operational overview uses telemetry modules without the legacy trajectory diagram', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 900 });
  await page.addInitScript(() => localStorage.setItem('bmf_theme', 'dark'));
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const overview = page.getByRole('region', { name: 'Operational overview' });
  await expect(overview).toBeVisible();
  await expect(overview.getByRole('heading', { name: 'Operational overview' })).toBeVisible();
  await expect(overview.locator('.unit-context-card')).toHaveCount(3);
  await expect(overview.locator('.unit-trajectory-diagram')).toHaveCount(0);

  const layout = await overview.evaluate(element => ({
    width: element.getBoundingClientRect().width,
    scrollWidth: element.scrollWidth,
  }));
  expect(layout.scrollWidth).toBeLessThanOrEqual(Math.ceil(layout.width));

  const surfaces = await overview.evaluate(element => {
    const resolveColor = token => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      return color;
    };
    const card = element.querySelector('.unit-efficiency-card');
    const metric = card.querySelector('.unit-efficiency-metric');
    return {
      overview: getComputedStyle(element).backgroundColor,
      card: getComputedStyle(card).backgroundColor,
      metric: getComputedStyle(metric).backgroundColor,
      surfaceToken: resolveColor('--color-surface'),
      cardToken: resolveColor('--color-surface-subtle'),
    };
  });
  expect(surfaces.overview).toBe(surfaces.surfaceToken);
  expect(surfaces.card).toBe(surfaces.cardToken);
  expect(surfaces.metric).toBe('rgba(0, 0, 0, 0)');
});

test('nested unit collections persist and scope expert workflows', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  const workflow = page.getByRole('navigation', { name: 'Editor workflow' });
  await workflow.getByRole('button', { name: /Collections/ }).click();

  const collections = page.getByRole('region', { name: 'Collections' });
  await collections.getByRole('button', { name: 'New' }).click();
  await collections.getByLabel('New collection').fill('Air Ops');
  await collections.getByRole('button', { name: 'Save' }).click();

  let rootRow = collections.locator('.unit-collection-row').filter({ hasText: 'Air Ops' });
  const rootMember = page.locator('.collection-member-row').filter({ hasText: 'armdfly' });
  await rootMember.getByRole('checkbox').check();
  await expect(rootMember).toHaveClass(/is-direct/);

  await rootRow.getByRole('button', { name: 'Manage Air Ops' }).click();
  await collections.getByRole('button', { name: 'New child' }).click();
  await collections.getByLabel('New child folder').fill('T2 Strike');
  await collections.getByRole('button', { name: 'Save' }).click();

  const childMember = page.locator('.collection-member-row').filter({ hasText: 'armdfly' });
  await childMember.getByRole('checkbox').check();
  await expect(childMember).toHaveClass(/is-direct/);
  rootRow = collections.locator('.unit-collection-row').filter({ hasText: 'Air Ops' });
  await rootRow.locator('.unit-collection-select').click();

  await workflow.getByRole('button', { name: /Edit Units/ }).click();
  await expect(page.locator('.collection-scope-picker')).toContainText('Air Ops');
  await expect(page.locator('.results-summary').getByText('1 units')).toBeVisible();
  await page.getByRole('button', { name: /Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Batch Adjust' }).click();
  const batchDialog = page.getByRole('dialog', { name: 'Batch Adjust Stats' });
  await expect(batchDialog.getByText('Collection · Air Ops', { exact: true })).toBeVisible();
  await batchDialog.getByRole('button', { name: 'Close batch adjustment' }).click();

  await page.getByRole('tab', { name: /Compare/ }).click();
  await expect(page.getByText('Collection scope', { exact: true })).toBeVisible();
  await expect(page.getByText('1 available members')).toBeVisible();

  await workflow.getByRole('button', { name: /Review & Export/ }).click();
  const collectionSummary = page.locator('.review-collection-summary');
  await expect(collectionSummary.getByRole('heading', { name: 'Air Ops' })).toBeVisible();
  await expect(collectionSummary.getByText('Includes nested folders')).toBeVisible();

  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.getByRole('heading', { name: /Bar EditP/i })).toBeVisible();
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Collections/ }).click();
  const restoredCollections = page.getByRole('region', { name: 'Collections' });
  await expect(restoredCollections.getByText('Air Ops', { exact: true })).toBeVisible();
  await restoredCollections.getByRole('button', { name: 'Expand Air Ops' }).click();
  await expect(restoredCollections.getByText('T2 Strike', { exact: true })).toBeVisible();
});

test('custom units inherit their base artwork in collections', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  const cloneDialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await cloneDialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_collection_icon_test');
  await cloneDialog.getByRole('button', { name: 'Create Clone' }).click();

  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Collections/ }).click();
  const collections = page.getByRole('region', { name: 'Collections' });
  await collections.getByRole('button', { name: 'New' }).click();
  await collections.getByLabel('New collection').fill('Custom artwork');
  await collections.getByRole('button', { name: 'Save' }).click();
  const baseRow = page.locator('.collection-member-row').filter({ has: page.getByText('armdfly', { exact: true }) });
  const baseArtwork = await baseRow.locator('.collection-member-row__art').getAttribute('src');
  expect(baseArtwork).toBeTruthy();
  await page.getByLabel('Source').selectOption('custom');

  const customRow = page.locator('.collection-member-row').filter({ hasText: 'armdfly_collection_icon_test' });
  await expect(customRow).toBeVisible();
  await expect(customRow.locator('.collection-member-row__art')).toHaveAttribute('src', baseArtwork);
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
  const chooseWeaponAction = page.getByRole('button', { name: 'Choose weapon' });
  const chooseWeaponPalette = await readPrimaryActionPalette(chooseWeaponAction);
  expect(chooseWeaponPalette.background).toBe(chooseWeaponPalette.subtle);
  expect(chooseWeaponPalette.background).not.toBe(chooseWeaponPalette.accent);
  await chooseWeaponAction.click();

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

test('unit and death-explosion parameters compile to their correct lobby outputs', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByPlaceholder(/Search unit name/i).fill('armfus');
  await page.locator('.unit-item').filter({ hasText: 'armfus' }).first().click();
  await page.getByRole('group', { name: 'Choose visible unit parameters' }).getByRole('button', { name: 'All' }).click();

  const deathGroup = page.getByRole('button', { name: /Death explosion profile/i });
  if (await deathGroup.getAttribute('aria-expanded') === 'false') await deathGroup.click();
  await page.locator('[data-param-key="death_explosion_damage"] input').fill('4000');

  const definitionGroup = page.getByRole('button', { name: /Death & self-destruct/i });
  if (await definitionGroup.getAttribute('aria-expanded') === 'false') await definitionGroup.click();
  await page.locator('[data-param-key="selfdestructcountdown"] input').fill('8');

  await page.getByRole('tab', { name: /Changes/i }).click();
  await page.getByRole('button', { name: 'Defs Lua' }).click();
  await expect(page.locator('.code-box').first()).toContainText('editp_death_profile("armfus"');
  await expect(page.locator('.code-box').first()).toContainText('damage =4000');

  await page.getByRole('button', { name: 'Units Lua' }).click();
  await expect(page.locator('.code-box').first()).toContainText('selfDestructCountdown');
  await expect(page.locator('.code-box').first()).toContainText('8');
});

test('all-parameter view exposes effective Recoil defaults without creating overrides', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByPlaceholder(/Search unit name/i).fill('armfus');
  await page.locator('.unit-item').filter({ hasText: 'armfus' }).first().click();
  await page.getByRole('group', { name: 'Choose visible unit parameters' }).getByRole('button', { name: 'All' }).click();

  await expect(page.getByRole('combobox', { name: /Can Self-Destruct override/i }).locator('option:checked'))
    .toHaveText('Inherited · Enabled');
  await expect(page.getByRole('combobox', { name: /Blocks Movement override/i }).locator('option:checked'))
    .toHaveText('Inherited · Enabled');
  await expect(page.locator('[data-param-key="idleautoheal"] input')).toHaveValue('10');
  await expect(page.locator('[data-param-key="damagemodifier"] input')).toHaveValue('1');
  await expect(page.locator('[data-param-key="canrepair"] select').locator('option:checked'))
    .toHaveText('Inherited · Builder capability');
  await expect(page.locator('[data-param-key="idleautoheal"] .stat-card-engine-default')).toHaveText('Engine');
  await expect(page.locator('[data-param-key="idleautoheal"]')).not.toHaveClass(/modified/);
});

async function openEditorVisualState(page, { theme, width, unitId, tab = 'structure', showAll = false }) {
  await page.setViewportSize({ width, height: 1080 });
  await page.addInitScript(selectedTheme => localStorage.setItem('bmf_theme', selectedTheme), theme);
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  if (unitId && unitId !== 'armdfly') {
    await page.getByPlaceholder(/Search unit name/i).fill(unitId);
    await page.locator('.unit-item').filter({ hasText: unitId }).first().click();
  }
  const tabNames = { mobility: /Movement & Sensors/i, weapons: /Weapons/i };
  if (tab !== 'structure') await page.getByRole('tab', { name: tabNames[tab] }).click();
  if (showAll) {
    await page.getByRole('group', { name: 'Choose visible unit parameters' }).getByRole('button', { name: 'All' }).click();
  }
  await expect(page.locator(`#workspace-panel-${tab}`)).toBeVisible();
}

test('editor visual baseline: engine defaults on wide dark workspace', async ({ page }) => {
  await openEditorVisualState(page, { theme: 'dark', width: 1920, unitId: 'armfus', showAll: true });
  await expect(page).toHaveScreenshot('editor-engine-defaults-dark-1920.png');
});

test('editor visual baseline: aircraft mobility in light workspace', async ({ page }) => {
  await openEditorVisualState(page, { theme: 'light', width: 1440, unitId: 'armfig', tab: 'mobility' });
  await expect(page).toHaveScreenshot('editor-aircraft-mobility-light-1440.png');
});

test('editor visual baseline: factory at constrained desktop width', async ({ page }) => {
  await openEditorVisualState(page, { theme: 'dark', width: 1180, unitId: 'armlab' });
  await expect(page).toHaveScreenshot('editor-factory-dark-1180.png');
});

test('editor visual baseline: active weapon workspace', async ({ page }) => {
  await openEditorVisualState(page, { theme: 'dark', width: 1920, unitId: 'armdfly', tab: 'weapons' });
  await expect(page).toHaveScreenshot('editor-weapon-dark-1920.png');
});

test('editor visual baseline: cloned unit identity', async ({ page }) => {
  await openEditorVisualState(page, { theme: 'light', width: 1440, unitId: 'armdfly' });
  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  const cloneDialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await cloneDialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_visual_clone');
  await cloneDialog.getByRole('button', { name: 'Create Clone' }).click();
  await page.getByRole('button', { name: 'Edit identity' }).click();
  await expect(page.getByRole('tab', { name: /Identity/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.toast')).toHaveCount(0, { timeout: 5000 });
  await expect(page).toHaveScreenshot('editor-clone-identity-light-1440.png');
});

test('editor visual baseline: narrow desktop rails', async ({ page }) => {
  await openEditorVisualState(page, { theme: 'dark', width: 1024, unitId: 'armdfly' });
  await expect(page).toHaveScreenshot('editor-narrow-dark-1024.png');
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
