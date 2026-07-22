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

test('main menu separates the active project, core workspaces, and specialist workbenches', async ({ page }) => {
  await waitForMainMenu(page);

  await expect(page.locator('.main-menu__active-project')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Core workspaces' }).getByRole('button')).toHaveCount(3);
  const tools = page.getByRole('region', { name: 'Research & package tools' });
  await expect(tools.getByRole('button')).toHaveCount(4);
  await expect(page.getByRole('button', { name: 'Save project' })).toBeVisible();

  await tools.getByRole('button', { name: /Collections/ }).click();
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible();
  await page.locator('.app-header .header-brand').click();

  await page.getByRole('region', { name: 'Research & package tools' }).getByRole('button', { name: /Preset Gallery/ }).click();
  await expect(page.getByRole('heading', { name: 'Preset Gallery' })).toBeVisible();
  await page.locator('.app-header .header-brand').click();

  await page.getByRole('region', { name: 'Research & package tools' }).getByRole('button', { name: /Tweak Package Lab/ }).click();
  await expect(page.getByRole('heading', { name: 'Tweak Package Lab' })).toBeVisible();
  await page.locator('.app-header .header-brand').click();

  await page.getByRole('region', { name: 'Research & package tools' }).getByRole('button', { name: /BAR Reference Library/ }).click();
  await expect(page.getByRole('heading', { name: 'Unified BAR Reference Library' })).toBeVisible();
});

test('build-picture browser distinguishes normal and Scavenger artwork namespaces', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('.unit-item').first()).toBeVisible();
  await page.getByPlaceholder(/Search unit name/i).fill('Arquebus');
  await page.locator('.unit-item').filter({ has: page.getByText('Arquebus', { exact: true }) }).click();

  const buildPictureInput = page.getByRole('textbox', { name: 'Build Picture' });
  await buildPictureInput.scrollIntoViewIfNeeded();
  await buildPictureInput.locator('xpath=..').getByRole('button', { name: 'Browse' }).click();
  await page.getByPlaceholder(/Search build pictures/i).fill('legsrail.dds');

  const options = page.getByRole('listbox', { name: 'Build pictures' }).getByRole('option');
  await expect(options).toHaveCount(2);
  const normalOption = options.filter({ hasText: /^legsrail\.dds/i });
  const scavengerOption = options.filter({ hasText: /scavengers\/legsrail\.dds/i });
  const normalPreview = await normalOption.locator('img').getAttribute('src');
  const scavengerPreview = await scavengerOption.locator('img').getAttribute('src');
  expect(scavengerPreview).not.toBe(normalPreview);

  await scavengerOption.click();
  await expect(buildPictureInput).toHaveValue('scavengers/legsrail.dds');
  await expect(page.locator('.editor-unit-header .unit-dossier-mark img')).toHaveAttribute('src', scavengerPreview);
});

test('tactical icon browser previews and applies official BAR icon types', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await expect(page.locator('.unit-item').first()).toBeVisible();
  await page.getByPlaceholder(/Search unit name/i).fill('Abductor');
  await page.locator('.unit-item').filter({ has: page.getByText('Abductor', { exact: true }) }).click();

  const iconTypeInput = page.getByRole('textbox', { name: 'Tactical Icon' });
  await iconTypeInput.scrollIntoViewIfNeeded();
  await iconTypeInput.locator('xpath=..').getByRole('button', { name: 'Browse' }).click();
  await page.getByPlaceholder(/Search tactical icons/i).fill('armap');

  const option = page.getByRole('listbox', { name: 'Tactical icons' }).getByRole('option', { name: /armap/i }).first();
  await expect(option.locator('img')).toBeVisible();
  await expect(option).toContainText('factory_air.png');
  await option.click();
  await expect(iconTypeInput).toHaveValue('armap');
  await expect(iconTypeInput.locator('xpath=../..').getByText('BAR asset')).toBeVisible();

  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Review & Export/ }).click();
  await page.getByText('Legacy combined compiler', { exact: true }).click();
  await page.getByRole('tab', { name: 'Units Lua' }).click();
  await expect(page.locator('.export-code-preview')).toContainText('icontype = "armap"');
});

test('build menu producer catalog separates factories and builders', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /Build Menus/i }).click();

  const catalog = page.locator('.designer-factory-browser');
  await expect(catalog.getByText('Groundhog', { exact: true })).toBeVisible();
  await expect(catalog.getByText('Bot Lab', { exact: true }).first()).toBeVisible();
  await expect(catalog.getByText('armsaap', { exact: true })).toHaveCount(0);

  await catalog.getByRole('button', { name: /Builders/ }).click();
  await expect(catalog.getByText('Groundhog', { exact: true })).toBeVisible();
  await expect(catalog.getByText('Bot Lab', { exact: true })).toHaveCount(0);

  await catalog.getByRole('button', { name: /Factories/ }).click();
  await expect(catalog.getByText('Bot Lab', { exact: true }).first()).toBeVisible();
  await expect(catalog.getByText('Groundhog', { exact: true })).toHaveCount(0);

  const producerSearch = catalog.getByRole('textbox', { name: 'Search producers' });
  await producerSearch.fill('legaap');
  await expect(catalog.getByText('Legion Advanced Aircraft Plant', { exact: true })).toBeVisible();
  await producerSearch.fill('legvp');
  await expect(catalog.getByText('Legion Vehicle Plant', { exact: true })).toBeVisible();
  await producerSearch.fill('legavp');
  await expect(catalog.getByText('Advanced Vehicle Plant', { exact: true })).toBeVisible();
});

test('behavior and interceptor editor links unit policy, projectile masks, and coverage', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('tab', { name: /Weapons/ }).click();

  const editor = page.getByRole('region', { name: 'Behaviour & Interception' });
  await expect(editor).toBeVisible();
  await expect(editor).toContainText('INTERCEPTOR & TARGETABLE ≠ 0');

  await editor.getByRole('button', { name: /Interceptor Weapon searches/i }).click();
  await expect(editor.getByText('Interceptor', { exact: true }).first()).toBeVisible();
  await expect(editor.getByLabel('Interceptor weapon mask decimal mask')).toHaveValue('1');
  await expect(editor.getByLabel('Interceptor acquisition coverage')).not.toHaveValue('');

  await editor.getByLabel('Can attack').selectOption('false');
  await expect(editor.getByLabel('Can attack')).toHaveValue('false');

  const interceptorChannels = editor.getByLabel('Interceptor weapon mask channels');
  await interceptorChannels.getByRole('button', { name: /01 1/ }).click();
  await interceptorChannels.getByRole('button', { name: /02 2/ }).click();
  await expect(editor.getByLabel('Interceptor weapon mask decimal mask')).toHaveValue('2');
  await expect(editor).toContainText('does not match a targetable projectile channel');

  await page.getByRole('tab', { name: /Economy & Durability/ }).click();
  await page.getByRole('tab', { name: /Weapons/ }).click();
  await expect(editor.getByLabel('Can attack')).toHaveValue('false');
  await expect(editor.getByLabel('Interceptor weapon mask decimal mask')).toHaveValue('2');

  await page.getByRole('button', { name: /Review & Export/i }).click();
  await expect(page.getByRole('heading', { name: 'Export Console' })).toBeVisible();
  await page.getByRole('navigation', { name: 'Generated lobby slots' }).getByRole('button', { name: /tweakunits1/i }).click();
  await page.getByRole('button', { name: 'Lua', exact: true }).click();
  const generatedLua = page.locator('.lobby-slot-code');
  await expect(generatedLua).toContainText('canAttack = false');
  await expect(generatedLua).toContainText('interceptor = 2');
});

test('BAR Reference Library unifies definitions, assets, reverse usage, and editor navigation', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'BAR Reference Library' }).click();

  await expect(page.getByRole('heading', { name: 'Unified BAR Reference Library' })).toBeVisible();
  const library = page.locator('.bar-reference-library');
  await expect(library.getByText('references', { exact: true }).first()).toBeVisible();

  const search = library.getByRole('searchbox', { name: 'Search the library' });
  await search.fill('armdfly_paralyzer');
  const weapon = library.getByRole('option', { name: /^Abductor · Slot 1/ });
  await expect(weapon).toBeVisible();
  await weapon.click();
  const inspector = library.getByRole('complementary', { name: 'Reference details' });
  await expect(inspector).toContainText('Owner unit');
  await expect(inspector).toContainText('armdfly');

  await library.getByRole('button', { name: /Models/ }).click();
  await search.fill('Units/ARMDFLY.s3o');
  await library.getByRole('option').filter({ hasText: 'Units/ARMDFLY.s3o' }).click();
  await expect(inspector.getByRole('region', { name: 'Used by definitions' })).toContainText('Abductor');

  await library.getByRole('button', { name: /Pictures/ }).click();
  await search.fill('legsrail.dds');
  await expect(library.getByRole('option').first()).toBeVisible();
  expect(await library.getByRole('option').count()).toBeGreaterThanOrEqual(2);

  await library.getByRole('button', { name: /Weapons/ }).click();
  await search.fill('armdfly_paralyzer');
  await library.getByRole('option', { name: /^Abductor · Slot 1/ }).click();
  await inspector.getByRole('button', { name: 'Open unit editor' }).click();
  await expect(page.locator('.editor-unit-header')).toContainText('Abductor');
});

test('editor header stays grouped and usable across supported desktop widths', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  for (const width of [1920, 1440, 1180, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    const geometry = await page.locator('.app-header').evaluate(header => {
      const bounds = selector => header.querySelector(selector).getBoundingClientRect();
      const brand = bounds('.header-brand-group');
      const workflow = bounds('.workflow-nav');
      const actions = bounds('.header-utility-actions');
      return {
        headerRight: header.getBoundingClientRect().right,
        brandRight: brand.right,
        workflowLeft: workflow.left,
        workflowRight: workflow.right,
        actionsLeft: actions.left,
        actionsRight: actions.right,
      };
    });

    expect(geometry.brandRight).toBeLessThanOrEqual(geometry.workflowLeft + 1);
    expect(geometry.workflowRight).toBeLessThanOrEqual(geometry.actionsLeft + 1);
    expect(geometry.actionsRight).toBeLessThanOrEqual(geometry.headerRight + 1);
    await expect(page.getByRole('button', { name: /^Tools/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Build Menus/i })).toBeVisible();
  }

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole('button', { name: /^Tools/ }).click();
  const menu = page.getByRole('menu', { name: 'Editor tools' });
  await expect(menu).toBeVisible();
  await expect(menu.getByText('Quick access', { exact: true })).toBeVisible();
  await expect(menu.getByText('Editing tools', { exact: true })).toBeVisible();
  await expect(menu.getByText('Packages & references', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
});

test('Tweak Package Lab imports inert modules and exposes numbered slots', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();
  await expect(page.getByRole('heading', { name: 'Tweak Package Lab' })).toBeVisible();

  const source = 'UnitDefs["editp_lab_test"] = table.copy(UnitDefs["armflea"], true)';
  await page.getByRole('textbox', { name: 'Tweak package input' }).fill(source);
  await page.getByRole('button', { name: 'Inspect pasted input' }).click();
  await expect(page.getByText('Definitions module', { exact: true }).first()).toBeVisible();
  const inspector = page.getByRole('complementary', { name: 'Module inspection' });
  const analyzer = inspector.getByRole('region', { name: 'Analyzer V2 findings' });
  await expect(analyzer).toContainText('Literal clone operation');
  await expect(analyzer).toContainText('Exact');
  await inspector.getByRole('button', { name: 'Full screen' }).click();
  await expect(inspector).toHaveClass(/is-fullscreen/);
  await expect(inspector.getByRole('button', { name: 'Restore view' })).toBeVisible();
  await inspector.getByRole('button', { name: /Source/ }).click();
  await expect(inspector.locator('.tweak-source-preview')).toHaveAttribute('open', '');
  await expect(inspector.locator('.tweak-source-preview pre')).toContainText('editp_lab_test');
  await inspector.getByRole('button', { name: /Diagnostics/ }).click();
  await expect(inspector.locator('.tweak-module-relationships')).toBeVisible();
  await inspector.getByRole('button', { name: /Summary/ }).click();
  await page.keyboard.press('Escape');
  await expect(inspector).not.toHaveClass(/is-fullscreen/);
  const include = page.getByRole('switch', { name: /Include Definitions module in lobby output/i });
  await expect(include).not.toBeChecked();
  await include.check({ force: true });

  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('button', { name: /Review & Export/i }).click();
  await expect(page.getByRole('heading', { name: 'Export Console' })).toBeVisible();
  await expect(page.locator('.lobby-slot-capacity > div').filter({ hasText: 'Definitions' })).toContainText('/ 9');
  await expect(page.getByRole('button', { name: 'Copy all !bset commands' })).toBeEnabled();
  await expect(page.getByRole('navigation', { name: 'Generated lobby slots' }).getByRole('button', { name: /tweakdefs1/i })).toBeVisible();
  await page.getByRole('button', { name: 'Lua', exact: true }).click();
  await expect(page.locator('.lobby-slot-code')).toContainText('editp_lab_test');
});

test('Tweak Package Lab previews and imports a full lobby setup bundle', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();

  await page.getByRole('textbox', { name: 'Tweak package input' }).fill(`
    ALL TWEAKS
    !bset forceallunits 1
    !preset coop
    !unit_restrictions_nonukes 0
    !bSet unit_restrictions_nonukes 1
    !map Full Metal Plate
    !addbox 82 82 117 117 2
    $rename PvE Reference Lobby
    !bset tweakdefs LS0gRmlyc3QgbGVnYWN5IG1vZHVsZQpsb2NhbCBhID0gdHJ1ZQ
    SPACE PACK
    !bset tweakdefs LS0gU2Vjb25kIGxlZ2FjeSBtb2R1bGUKbG9jYWwgYiA9IHRydWU
    !bset tweakunits4 0
  `);
  await page.getByRole('button', { name: 'Inspect pasted input' }).click();

  const preview = page.locator('.lobby-bundle-preview');
  await expect(preview.getByRole('heading', { name: 'Review before importing' })).toBeVisible();
  await expect(preview).toContainText('Game settings');
  await expect(preview).toContainText('Map & start boxes');
  await expect(preview).toContainText('Lobby identity');
  await expect(preview).toContainText('last-command-wins');
  await preview.getByRole('button', { name: 'Import selected' }).click();

  await expect(page.getByRole('button', { name: /DEFS Second legacy module/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /DEFS First legacy module/ })).toHaveCount(0);
  const setup = page.getByRole('region', { name: 'Imported lobby setup' });
  await expect(setup).toContainText('6 effective commands');
  await expect(setup).toContainText('Game settings');
  await expect(setup).toContainText('Map & start boxes');
  await expect(setup).toContainText('Lobby identity');
});

test('Tweak Package Lab preflights value types and safely reorders dependencies', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();

  const consumer = Buffer.from('-- Consumer\nUnitDefs["editp_dependency"].canattack = "true"').toString('base64url');
  const provider = Buffer.from('-- Provider\nUnitDefs["editp_dependency"] = table.copy(UnitDefs["armflea"])').toString('base64url');
  await page.getByRole('textbox', { name: 'Tweak package input' }).fill(`!bset tweakdefs1 ${consumer}\n!bset tweakdefs2 ${provider}`);
  await page.getByRole('button', { name: 'Inspect pasted input' }).click();

  await expect(page.locator('.tweak-package-audit__metrics').getByText('Type mismatches').locator('..')).toContainText('1');
  await expect(page.getByRole('button', { name: 'Apply safe order' })).toBeEnabled();
  await page.getByRole('button', { name: 'Apply safe order' }).click();
  const cards = page.locator('.tweak-module-card__main');
  await expect(cards.nth(0)).toContainText('Provider');
  await expect(cards.nth(1)).toContainText('Consumer');
  await expect(page.locator('.tweak-preflight-list').getByText(/canattack expects boolean/i)).toBeVisible();
});

test('Tweak Package Lab preserves auxiliary WeaponDefs in the project library and export', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();

  await page.getByLabel('Raw input type').selectOption('units');
  await page.getByRole('textbox', { name: 'Tweak package input' }).fill(`{
    armflea = {
      weapondefs = {
        main = { range = 300, customparams = { cluster_def = 'cluster_child' } },
        cluster_child = { range = 180, areaofeffect = 22, damage = { default = 17 } },
      },
      weapons = { [1] = { def = 'MAIN' } },
    },
  }`);
  await page.getByRole('button', { name: 'Inspect pasted input' }).click();
  const candidates = page.locator('.tweak-support-candidates');
  await expect(candidates).toContainText('CLUSTER_CHILD');
  await candidates.getByRole('button', { name: 'Add all 2' }).click();
  const library = page.locator('.tweak-support-library');
  await expect(library).toContainText('cluster_child');
  const createRow = library.locator('.tweak-support-create');
  await createRow.getByLabel('Owner UnitDef').fill('armflea');
  await createRow.getByLabel('WeaponDef key').fill('manual_aux');
  await createRow.getByRole('button', { name: 'Create' }).click();
  const manualCard = library.locator('.tweak-support-card').filter({ hasText: 'MANUAL_AUX' });
  await manualCard.getByText('Edit literal fields').click();
  await manualCard.getByRole('textbox', { name: 'Literal fields for manual_aux' }).fill(JSON.stringify({
    areaofeffect: 48,
    damage: { default: 29 },
  }, null, 2));
  await manualCard.getByRole('button', { name: 'Save fields' }).click();

  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Review & Export/ }).click();
  await page.getByText('Legacy combined compiler', { exact: true }).click();
  await page.getByRole('tab', { name: 'Definitions Lua' }).click();
  await expect(page.locator('.export-code-preview')).toContainText('editp_supporting_weapondefs');
  await expect(page.locator('.export-code-preview')).toContainText('cluster_child');
  await expect(page.locator('.export-code-preview')).toContainText('manual_aux');
  await expect(page.locator('.export-code-preview')).toContainText('default = 29');
});

test('Tweak Package Lab converts literal unit tables into editable project state', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();
  await page.getByRole('textbox', { name: 'Tweak package input' }).fill(`
    !bset tweakdefs1 U0VUKCdhcm1mbGVhJykgTkFNRSgnSW1wb3J0ZWQgRmxlYScpIEFERCgnZWRpdHBfaW1wb3J0X2ZsZWEnKQ
    !bset tweakunits1 eyBlZGl0cF9pbXBvcnRfZmxlYSA9IHsgaGVhbHRoID0gMzIxLCBidWlsZG9wdGlvbnMgPSB7ICdjb3JhaycsICdhcm1jaycgfSB9IH0
  `);
  await page.getByRole('button', { name: 'Inspect pasted input' }).click();
  await expect(page.locator('.tweak-package-audit__metrics').locator('div').filter({ hasText: 'Module links' })).toContainText('1');
  await page.getByRole('button', { name: 'Apply recognized changes' }).click();
  await page.getByRole('button', { name: /UNITS tweakunits1/ }).click();
  await expect(page.getByText(/Literal table recognized:/)).toContainText('1 unit patches');
  await expect(page.locator('.tweak-module-relationships')).toContainText('Needs');
  await page.getByRole('button', { name: 'Apply recognized changes' }).click();
  await expect(page.getByRole('button', { name: 'Converted' })).toBeDisabled();

  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();
  await expect(page.getByRole('button', { name: 'Converted' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Review & Export/ }).click();
  await page.getByText('Legacy combined compiler', { exact: true }).click();
  await page.getByRole('tab', { name: 'Units Lua' }).click();
  await expect(page.locator('.export-code-preview')).toContainText('health = 321');
  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Edit Units/ }).click();
  await page.getByPlaceholder(/Search unit name/i).fill('editp_import_flea');
  const importedFlea = page.locator('.unit-item').filter({
    has: page.locator('.unit-item-id').filter({ hasText: /^editp_import_flea$/ }),
  });
  await importedFlea.click();
  await expect(page.locator('[data-param-key="health"] input')).toHaveValue('321');
});

test('compatibility preflight blocks definite Lua failures while preserving repair navigation', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /^Tools/ }).click();
  await page.getByRole('menuitem', { name: 'Tweak Package Lab' }).click();

  await page.getByRole('textbox', { name: 'Tweak package input' }).fill('UnitDefs["editp_broken"] = table.copy(');
  await page.getByRole('button', { name: 'Inspect pasted input' }).click();
  const include = page.getByRole('switch', { name: /Include Definitions module in lobby output/i });
  await include.check({ force: true });

  await page.getByRole('button', { name: 'Back to editor' }).click();
  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Review & Export/ }).click();

  const preflight = page.getByRole('region', { name: 'Compatibility issues must be repaired' });
  await expect(preflight).toBeVisible();
  await expect(preflight).toContainText('Lua syntax cannot be parsed');
  await expect(preflight.getByRole('button', { name: 'Blockers' })).toContainText('1');
  await expect(page.getByRole('button', { name: 'Copy all !bset commands' })).toBeDisabled();

  await preflight.getByRole('button', { name: 'Open Tweak Lab' }).click();
  await expect(page.getByRole('heading', { name: 'Tweak Package Lab' })).toBeVisible();
});

test('main menu, editor, collections, and export have no serious accessibility violations', async ({ page }) => {
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

  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Review & Export/ }).click();
  await expect(page.getByRole('heading', { name: 'Export Console' })).toBeVisible();
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

test('advanced unit fields and custom parameters compile into tweakunits', async ({ page }) => {
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const view = page.getByRole('group', { name: 'Choose visible unit parameters' });
  await view.getByRole('button', { name: 'All' }).click();
  await page.locator('[data-param-key="footprintx"] input').fill('7');
  await page.locator('[data-param-key="objectname"]').getByRole('button', { name: 'Browse' }).click();
  const assetDialog = page.getByRole('dialog', { name: 'Unit models' });
  await assetDialog.getByRole('searchbox').fill('Units/ARMDFLY.s3o');
  await assetDialog.getByRole('option', { name: /Units\/ARMDFLY\.s3o/ }).click();

  const customPanel = page.locator('.advanced-custom-parameters');
  await customPanel.getByLabel('Parameter').selectOption('fall_damage_multiplier');
  await customPanel.getByLabel('Initial value').fill('0.5');
  await customPanel.getByRole('button', { name: 'Add parameter' }).click();
  await expect(customPanel).toContainText('Fall Damage Multiplier');
  await expect(customPanel).toContainText('BAR gadget');

  await page.getByRole('navigation', { name: 'Editor workflow' }).getByRole('button', { name: /Review & Export/ }).click();
  await page.getByText('Legacy combined compiler', { exact: true }).click();
  await page.getByRole('tab', { name: 'Units Lua' }).click();
  const output = page.locator('.export-code-preview');
  await expect(output).toContainText('footprintx = 7');
  await expect(output).toContainText('objectname = "Units/ARMDFLY.s3o"');
  await expect(output).toContainText('fall_damage_multiplier = 0.5');
});

test('parameter card hover keeps the entire section geometry stable', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const panel = page.locator('#workspace-panel-structure');
  const cards = panel.locator('.stat-card');
  await expect(cards.first()).toBeVisible();

  const readGeometry = async () => ({
    panelHeight: await panel.evaluate(element => element.getBoundingClientRect().height),
    firstCardStyle: await cards.first().evaluate(element => {
      const style = getComputedStyle(element);
      return {
        borderTopWidth: style.borderTopWidth,
        borderBottomWidth: style.borderBottomWidth,
        paddingTop: style.paddingTop,
        paddingBottom: style.paddingBottom,
        minHeight: style.minHeight,
        boxSizing: style.boxSizing,
        transform: style.transform,
      };
    }),
    cards: await cards.evaluateAll(elements => elements.map(element => {
      const bounds = element.getBoundingClientRect();
      return {
        x: Math.round(bounds.x * 100) / 100,
        y: Math.round(bounds.y * 100) / 100,
        width: Math.round(bounds.width * 100) / 100,
        height: Math.round(bounds.height * 100) / 100,
      };
    })),
  });

  const before = await readGeometry();
  await cards.first().hover();
  await page.waitForTimeout(250);
  expect(await cards.first().evaluate(element => getComputedStyle(element).transform)).toBe('none');
  expect(await readGeometry()).toEqual(before);

  const compactCard = panel.locator('.parameter-card--compact').first();
  await compactCard.hover();
  await page.waitForTimeout(250);
  expect(await compactCard.evaluate(element => getComputedStyle(element).transform)).toBe('none');
  expect(await readGeometry()).toEqual(before);
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

test('Edit Units keeps one stable viewport-height parameter scroller', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 720 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('group', { name: 'Choose visible unit parameters' }).getByRole('button', { name: 'All' }).click();

  const shell = page.locator('.editor-shell');
  const workspace = page.locator('.editor-workspace');
  const canvas = page.locator('.parameter-canvas');
  const commandBar = page.locator('.editor-unit-header');
  await expect(canvas).toBeVisible();

  const before = await page.evaluate(() => {
    const read = selector => document.querySelector(selector).getBoundingClientRect();
    const shellRect = read('.editor-shell');
    const workspaceRect = read('.editor-workspace');
    const canvasElement = document.querySelector('.parameter-canvas');
    return {
      documentHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      shellBottom: shellRect.bottom,
      shellHeight: shellRect.height,
      workspaceHeight: workspaceRect.height,
      canvasClientHeight: canvasElement.clientHeight,
      canvasScrollHeight: canvasElement.scrollHeight,
      canvasOverflowY: getComputedStyle(canvasElement).overflowY,
      commandTop: read('.editor-unit-header').top,
      sectionTop: read('.section-heading').top,
    };
  });

  expect(before.documentHeight).toBeLessThanOrEqual(before.viewportHeight);
  expect(before.shellBottom).toBeLessThanOrEqual(before.viewportHeight + 1);
  expect(Math.abs(before.shellHeight - before.workspaceHeight)).toBeLessThan(2);
  expect(before.canvasClientHeight).toBeGreaterThan(180);
  expect(before.canvasScrollHeight).toBeGreaterThan(before.canvasClientHeight);
  expect(before.canvasOverflowY).toBe('auto');

  await canvas.evaluate(element => { element.scrollTop = 500; });
  await expect.poll(() => canvas.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  const after = await page.evaluate(() => ({
    commandTop: document.querySelector('.editor-unit-header').getBoundingClientRect().top,
    sectionTop: document.querySelector('.section-heading').getBoundingClientRect().top,
  }));
  expect(after.commandTop).toBeCloseTo(before.commandTop, 0);
  expect(after.sectionTop).toBeLessThan(before.sectionTop - 100);

  await expect(shell).toBeVisible();
  await expect(workspace).toBeVisible();
  await expect(commandBar).toBeVisible();
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
  const workflow = page.getByRole('navigation', { name: 'Editor workflow' });
  await workflow.getByRole('button', { name: /Collections/ }).click();
  const collections = page.getByRole('region', { name: 'Collections' });
  await collections.getByRole('button', { name: 'New' }).click();
  await collections.getByLabel('New collection').fill('Custom artwork');
  await collections.getByRole('button', { name: 'Save' }).click();
  const baseRow = page.locator('.collection-member-row').filter({ has: page.getByText('armdfly', { exact: true }) });
  const baseArtwork = await baseRow.locator('.collection-member-row__art').getAttribute('src');
  expect(baseArtwork).toBeTruthy();

  await workflow.getByRole('button', { name: /Edit Units/ }).click();
  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  const cloneDialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await cloneDialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_collection_icon_test');
  await cloneDialog.getByRole('button', { name: 'Create Clone' }).click();

  await workflow.getByRole('button', { name: /Collections/ }).click();
  await page.getByLabel('Source').selectOption('custom');

  const customRow = page.locator('.collection-member-row').filter({ hasText: 'armdfly_collection_icon_test' });
  await expect(customRow).toBeVisible();
  await expect(customRow).toHaveClass(/is-direct/);
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

test('cloning preserves economy, durability, and explosion edits in their required lobby outputs', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();

  const parameterView = page.getByRole('group', { name: 'Choose visible unit parameters' });
  await parameterView.getByRole('button', { name: 'All' }).click();
  await page.locator('[data-param-key="metalcost"] input').fill('777');
  await page.locator('[data-param-key="health"] input').fill('3333');
  const deathDamage = page.locator('[data-param-key="death_explosion_damage"] input');
  await deathDamage.fill('1100');
  await page.locator('[data-param-key="selfd_explosion_damage"] input').fill('2200');

  await page.getByRole('button', { name: /Review & Export/i }).click();
  const customUnitsFlag = page.getByRole('switch', { name: 'Custom units' });
  await expect(customUnitsFlag).toBeChecked();
  await page.locator('.export-console-flags .ui-switch-field').filter({ hasText: 'Custom units' }).click();
  await expect(customUnitsFlag).not.toBeChecked();
  await page.getByRole('button', { name: 'Back to editor' }).click();

  await page.getByRole('button', { name: /Create a clone of the selected unit/i }).click();
  const dialog = page.getByRole('dialog', { name: 'Clone Unit Creator' });
  await dialog.getByLabel('New Unit ID', { exact: true }).fill('armdfly_explosion_clone');
  await dialog.getByRole('button', { name: 'Create Clone' }).click();

  await expect(page.locator('[data-param-key="metalcost"] input')).toHaveValue('777');
  await expect(page.locator('[data-param-key="health"] input')).toHaveValue('3333');
  await expect(page.locator('[data-param-key="death_explosion_damage"] input')).toHaveValue('1100');
  await expect(page.locator('[data-param-key="selfd_explosion_damage"] input')).toHaveValue('2200');
  await page.getByRole('button', { name: /Review & Export/i }).click();
  await expect(page.getByRole('switch', { name: 'Custom units' })).toBeChecked();
  await expect(page.getByRole('switch', { name: 'Parameter tweaks' })).toBeChecked();
  await page.getByText('Legacy combined compiler', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Copy Defs Base64' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Copy Units Base64' })).toBeEnabled();
  await page.getByRole('tab', { name: 'Definitions Lua' }).click();
  await expect(page.locator('.export-code-preview')).toContainText('local n = "armdfly_explosion_clone"');
  await expect(page.locator('.export-code-preview')).toContainText('editp_death_profile("armdfly_explosion_clone"');
  await expect(page.locator('.export-code-preview')).toContainText('"selfd"');
  await page.getByRole('tab', { name: 'Units Lua' }).click();
  await expect(page.locator('.export-code-preview')).toContainText('armdfly_explosion_clone');
  await expect(page.locator('.export-code-preview')).toContainText('metalcost = 777');
  await expect(page.locator('.export-code-preview')).toContainText('health = 3333');
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

async function openBuildMenuVisualState(page, { theme, width }) {
  await page.setViewportSize({ width, height: 1080 });
  await page.addInitScript(selectedTheme => localStorage.setItem('bmf_theme', selectedTheme), theme);
  await waitForMainMenu(page);
  await page.getByRole('button', { name: /Enter workshop|Continue workshop/i }).click();
  await page.getByRole('button', { name: /Build Menus/i }).click();
  await expect(page.getByText('Factory Roster Designer', { exact: true }).first()).toBeVisible();
  await expect(page.locator('.designer-roster-canvas')).toBeVisible();
}

test('build menu visual baseline: wide dark production board', async ({ page }) => {
  await openBuildMenuVisualState(page, { theme: 'dark', width: 1920 });
  await expect(page).toHaveScreenshot('build-menu-dark-1920.png');
});

test('build menu visual baseline: constrained light production board', async ({ page }) => {
  await openBuildMenuVisualState(page, { theme: 'light', width: 1180 });
  await expect(page).toHaveScreenshot('build-menu-light-1180.png');
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
