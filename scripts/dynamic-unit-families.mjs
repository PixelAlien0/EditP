import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const SCAVENGER_BOSS_BASE_ID = 'armscavengerbossv2';
const SCAVENGER_BOSS_ARTWORK_KEY = 'scav_legcom';

export const SCAVENGER_BOSS_DIFFICULTIES = Object.freeze({
  veryeasy: Object.freeze({
    label: 'Very Easy', health: 400000, autoheal: 0, stockpiletime: 60, reload: 6, machinegun: 100, heatray: 3300,
  }),
  easy: Object.freeze({
    label: 'Easy', health: 600000, autoheal: 5, stockpiletime: 50, reload: 5, machinegun: 150, heatray: 4400,
  }),
  normal: Object.freeze({
    label: 'Normal', health: 800000, autoheal: 10, stockpiletime: 40, reload: 4, machinegun: 200, heatray: 5500,
  }),
  hard: Object.freeze({
    label: 'Hard', health: 1000000, autoheal: 15, stockpiletime: 30, reload: 3, machinegun: 250, heatray: 6600,
  }),
  veryhard: Object.freeze({
    label: 'Very Hard', health: 1500000, autoheal: 20, stockpiletime: 20, reload: 2, machinegun: 350, heatray: 8000,
  }),
  epic: Object.freeze({
    label: 'Epic', health: 2000000, autoheal: 25, stockpiletime: 10, reload: 1, machinegun: 500, heatray: 10000,
  }),
});

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function setWeaponDifficultyValues(unit, difficulty) {
  const slots = Array.isArray(unit.weaponSlots) ? unit.weaponSlots : [];
  const machinegun = slots.find(slot => String(slot.defKey).toLowerCase() === 'machinegun');
  const disintegrator = slots.find(slot => String(slot.defKey).toLowerCase() === 'disintegratorxl');
  const heatray = slots.find(slot => String(slot.defKey).toLowerCase() === 'corkorg_laser');

  if (machinegun) {
    delete machinegun.damage_vs_aircraft;
    machinegun.damage = difficulty.machinegun;
    machinegun.damage_vs_vtol = difficulty.machinegun * 3;
  }
  if (disintegrator) {
    disintegrator.reload = difficulty.reload;
    disintegrator.stockpile = true;
    disintegrator.stockpiletime = difficulty.stockpiletime;
  }
  if (heatray) heatray.damage = difficulty.heatray;

  unit.weapon1Damage = difficulty.machinegun;
}

/**
 * BAR defines armscavengerbossv2 through a Lua loop, so literal-table parsers
 * cannot discover the six emitted UnitDef IDs. Reconcile that known dynamic
 * family from the preserved Epic template and the values in the official
 * difficulty table.
 */
export function reconcileDynamicUnitFamilies({
  defaults = {},
  categories = {},
  names = {},
  descriptions = {},
  artwork = null,
} = {}) {
  const template = defaults[`${SCAVENGER_BOSS_BASE_ID}_epic`] || defaults[SCAVENGER_BOSS_BASE_ID];
  if (!template) {
    return { repaired: 0, removed: 0, warning: 'Scavenger boss template is unavailable.' };
  }

  const legacyName = names[SCAVENGER_BOSS_BASE_ID] || 'Epic Commander - Final Boss';
  const baseName = legacyName.replace(/\s*\((?:Very Easy|Easy|Normal|Hard|Very Hard|Epic)\)\s*$/i, '');
  const baseDescription = 'Scavenger Mode Final Boss Mech';
  const artworkUrl = artwork?.units?.[SCAVENGER_BOSS_ARTWORK_KEY]
    || artwork?.pictures?.['scavengers/legcom.dds']
    || artwork?.pictures?.['LEGCOM.dds']
    || null;

  const removed = Number(Boolean(
    defaults[SCAVENGER_BOSS_BASE_ID]
    || categories[SCAVENGER_BOSS_BASE_ID]
    || names[SCAVENGER_BOSS_BASE_ID]
    || descriptions[SCAVENGER_BOSS_BASE_ID]
    || artwork?.units?.[SCAVENGER_BOSS_BASE_ID]
  ));

  delete defaults[SCAVENGER_BOSS_BASE_ID];
  delete categories[SCAVENGER_BOSS_BASE_ID];
  delete names[SCAVENGER_BOSS_BASE_ID];
  delete descriptions[SCAVENGER_BOSS_BASE_ID];
  if (artwork?.units) delete artwork.units[SCAVENGER_BOSS_BASE_ID];

  for (const [difficultyKey, difficulty] of Object.entries(SCAVENGER_BOSS_DIFFICULTIES)) {
    const unitId = `${SCAVENGER_BOSS_BASE_ID}_${difficultyKey}`;
    const unit = clone(template);
    unit.health = difficulty.health;
    unit.buildtime = difficulty.health;
    unit.autoheal = difficulty.autoheal;
    setWeaponDifficultyValues(unit, difficulty);
    defaults[unitId] = unit;
    categories[unitId] = ['bots', 't4', 'scavenger'];
    names[unitId] = `${baseName} (${difficulty.label})`;
    descriptions[unitId] = `${baseDescription} (${difficulty.label})`;
    if (artwork?.units && artworkUrl) artwork.units[unitId] = artworkUrl;
  }

  return { repaired: Object.keys(SCAVENGER_BOSS_DIFFICULTIES).length, removed };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function repairSnapshotFiles(root = process.cwd()) {
  const paths = {
    defaults: `${root}/src/data/unit-defaults.json`,
    categories: `${root}/src/data/unit-categories.json`,
    units: `${root}/src/data/units.json`,
    artwork: `${root}/src/data/unitpic-manifest.json`,
  };
  const defaults = readJson(paths.defaults);
  const categories = readJson(paths.categories);
  const units = readJson(paths.units);
  const artwork = readJson(paths.artwork);
  const result = reconcileDynamicUnitFamilies({
    defaults,
    categories,
    names: units.names,
    descriptions: units.descriptions,
    artwork,
  });
  if (result.warning) throw new Error(result.warning);
  writeJson(paths.defaults, defaults);
  writeJson(paths.categories, categories);
  writeJson(paths.units, units);
  writeJson(paths.artwork, artwork);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = repairSnapshotFiles();
  console.log(`Reconciled ${result.repaired} dynamic BAR units; removed ${result.removed} invalid base record.`);
}
