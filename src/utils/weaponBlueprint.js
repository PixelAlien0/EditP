import {
  WEAPON_EDITABLE_PARAMETER_CATALOG,
  WEAPON_ESSENTIAL_KEYS,
  getWeaponParameterDefinition,
} from '../config/weaponParameters.js';

const DEFAULT_APPEARANCE = Object.freeze({
  vfxEnabled: false,
  color: '#c69a68',
  secondaryColor: '#f0d5a8',
  brightness: 1,
  texture: 'flare',
  particleSize: 5,
  particleCount: 4,
  particleLife: 12,
  spread: 3,
  trailSize: 7,
  trailLength: 20,
  trailGrowth: 0.15,
  trailLife: 5,
  trailOffset: 0.2,
  particlesEnabled: true,
  heatEnabled: true,
  heatSize: 12,
  heatGrowth: 0.4,
  heatFalloff: 1.1,
  groundFlashEnabled: true,
  flashSize: 25,
  flashAlpha: 0.55,
  flashGrowth: 3,
  flashLife: 8,
});

export const WEAPON_BLUEPRINT_NUMERIC_KEYS = Object.freeze(
  WEAPON_EDITABLE_PARAMETER_CATALOG
    .filter(parameter => parameter.valueType === 'number')
    .map(parameter => parameter.key),
);

export const WEAPON_BLUEPRINT_REFERENCE_KEYS = Object.freeze(
  WEAPON_EDITABLE_PARAMETER_CATALOG
    .filter(parameter => parameter.assetType)
    .map(parameter => parameter.key),
);

const LEGACY_BLUEPRINT_KEY_ALIASES = Object.freeze({
  cegtag: 'cegTag',
});

function finiteOr(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cleanId(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-z0-9_]/gi, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function readSlotValue(slot, key) {
  if (!slot) return '';
  const aliases = {
    reload: ['reload', 'reloadtime'],
    velocity: ['velocity', 'weaponvelocity'],
    aoe: ['aoe', 'areaofeffect'],
    cegTag: ['cegTag', 'cegtag'],
  };
  for (const candidate of aliases[key] || [key]) {
    if (slot[candidate] !== undefined && slot[candidate] !== null) return slot[candidate];
  }
  return '';
}

function canonicalBlueprintKey(key) {
  return LEGACY_BLUEPRINT_KEY_ALIASES[key] || key;
}

function cleanBlueprintValues(values = {}) {
  const cleaned = {};
  Object.entries(values || {}).forEach(([rawKey, value]) => {
    const key = canonicalBlueprintKey(rawKey);
    if (!getWeaponParameterDefinition(key)) return;
    if (value === undefined || value === null || value === '') return;
    cleaned[key] = value;
  });
  return cleaned;
}

export function getWeaponBlueprintSourceValues(blueprint) {
  return cleanBlueprintValues(blueprint?.sourceValues || {});
}

export function getWeaponBlueprintOverrides(blueprint) {
  return cleanBlueprintValues(blueprint?.overrides || {});
}

export function getWeaponBlueprintEffectiveValues(blueprint) {
  return {
    ...getWeaponBlueprintSourceValues(blueprint),
    ...getWeaponBlueprintOverrides(blueprint),
  };
}

export function getWeaponBlueprintParameterValue(blueprint, key) {
  const canonicalKey = canonicalBlueprintKey(key);
  const overrides = getWeaponBlueprintOverrides(blueprint);
  if (Object.prototype.hasOwnProperty.call(overrides, canonicalKey)) return overrides[canonicalKey];
  return getWeaponBlueprintSourceValues(blueprint)[canonicalKey];
}

export function isWeaponBlueprintParameterModified(blueprint, key) {
  return Object.prototype.hasOwnProperty.call(
    getWeaponBlueprintOverrides(blueprint),
    canonicalBlueprintKey(key),
  );
}

export function applyWeaponBlueprintToSlot(slot = {}, blueprint) {
  const result = { ...slot };
  const values = getWeaponBlueprintEffectiveValues(blueprint);
  WEAPON_EDITABLE_PARAMETER_CATALOG.forEach(parameter => {
    if (!Object.prototype.hasOwnProperty.call(values, parameter.key)) return;
    result[parameter.key] = values[parameter.key];
  });
  return result;
}

export function createWeaponBlueprintDraft({ sourceUnitId, slot, name } = {}) {
  const sourceWeaponDefKey = String(slot?.defKey || '').trim().toLowerCase();
  const sourceValues = {};
  WEAPON_EDITABLE_PARAMETER_CATALOG.forEach(parameter => {
    const value = readSlotValue(slot, parameter.key);
    if (value !== '' && value !== undefined && value !== null) sourceValues[parameter.key] = value;
  });
  WEAPON_ESSENTIAL_KEYS.forEach(key => {
    if (!Object.prototype.hasOwnProperty.call(sourceValues, key)) {
      const value = readSlotValue(slot, key);
      if (value !== '' && value !== undefined && value !== null) sourceValues[key] = value;
    }
  });
  return {
    id: '',
    name: name || `${sourceWeaponDefKey.toUpperCase() || 'Weapon'} Variant`,
    sourceUnitId: String(sourceUnitId || '').trim().toLowerCase(),
    sourceWeaponDefKey,
    description: '',
    appearance: { ...DEFAULT_APPEARANCE },
    sourceValues,
    overrides: {},
  };
}

export function createWeaponSourceCatalog(units = [], defaultsDb = {}) {
  const seen = new Set();
  return units
    .filter(unit => unit?.id && !unit.isClone)
    .flatMap(unit => {
      const weaponSlots = defaultsDb?.[String(unit.id).toLowerCase()]?.weaponSlots;
      if (!Array.isArray(weaponSlots)) return [];
      return weaponSlots.flatMap(slot => {
        const sourceWeaponDefKey = cleanId(slot?.defKey);
        const sourceUnitId = cleanId(unit.id);
        const identity = `${sourceUnitId}:${sourceWeaponDefKey}`;
        if (!sourceWeaponDefKey || seen.has(identity)) return [];
        seen.add(identity);
        return [{
          id: identity,
          sourceUnitId,
          sourceUnitName: String(unit.name || unit.id),
          sourceWeaponDefKey,
          slot: { ...slot },
        }];
      });
    })
    .sort((left, right) => (
      left.sourceWeaponDefKey.localeCompare(right.sourceWeaponDefKey)
      || left.sourceUnitName.localeCompare(right.sourceUnitName)
      || left.sourceUnitId.localeCompare(right.sourceUnitId)
    ));
}

export function normalizeWeaponBlueprint(draft, { createId = true } = {}) {
  if (!draft || typeof draft !== 'object') return null;
  const sourceWeaponDefKey = cleanId(draft.sourceWeaponDefKey);
  const existingId = cleanId(draft.id);
  const id = existingId || (createId
    ? `weapon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    : '');
  const safeId = cleanId(id || 'new_weapon');
  const appearance = { ...DEFAULT_APPEARANCE, ...(draft.appearance || {}) };
  const sourceValues = cleanBlueprintValues(draft.sourceValues);
  const overrides = {
    ...cleanBlueprintValues(draft.overrides),
    ...(appearance.vfxEnabled ? {
      cegTag: `editp_${safeId}_trail`,
      explosiongenerator: `custom:editp_${safeId}_impact`,
    } : {}),
  };

  return {
    ...draft,
    id,
    sourceUnitId: cleanId(draft.sourceUnitId),
    sourceWeaponDefKey,
    name: String(draft.name || '').trim() || `${sourceWeaponDefKey.toUpperCase() || 'Weapon'} Variant`,
    description: String(draft.description || '').trim(),
    appearance,
    sourceValues,
    overrides,
    updatedAt: new Date().toISOString(),
  };
}

export function getWeaponBlueprintMetrics(blueprint) {
  const values = getWeaponBlueprintEffectiveValues(blueprint);
  const damage = finiteOr(values.damage);
  const reload = Math.max(0.001, finiteOr(values.reload, 1));
  const burst = Math.max(1, finiteOr(values.burst, 1));
  const projectiles = Math.max(1, finiteOr(values.projectiles, 1));
  return {
    dps: (damage * burst * projectiles) / reload,
    alpha: damage * burst * projectiles,
    range: finiteOr(values.range),
    aoe: finiteOr(values.aoe),
    delivery: burst > 1 ? 'Burst' : projectiles > 1 ? 'Volley' : 'Direct',
  };
}

export function validateWeaponBlueprint(blueprint) {
  const issues = [];
  if (!String(blueprint?.name || '').trim()) issues.push({ field: 'name', message: 'Add a blueprint name.' });
  if (!cleanId(blueprint?.sourceUnitId)) issues.push({ field: 'sourceUnitId', message: 'The source unit is missing.' });
  if (!cleanId(blueprint?.sourceWeaponDefKey)) issues.push({ field: 'sourceWeaponDefKey', message: 'The source WeaponDef is missing.' });

  const overrides = getWeaponBlueprintOverrides(blueprint);
  WEAPON_BLUEPRINT_NUMERIC_KEYS.forEach(key => {
    if (overrides[key] === '' || overrides[key] === null || overrides[key] === undefined) return;
    if (!Number.isFinite(Number(overrides[key]))) issues.push({ field: key, message: `${key} must be numeric.` });
  });
  if (Number(overrides.reload) < 0) issues.push({ field: 'reload', message: 'Reload time cannot be negative.' });
  if (Number(overrides.range) < 0) issues.push({ field: 'range', message: 'Range cannot be negative.' });
  if (Number(overrides.projectiles) < 1) issues.push({ field: 'projectiles', message: 'Projectiles must be at least 1.' });
  if (Number(overrides.burst) < 1) issues.push({ field: 'burst', message: 'Burst count must be at least 1.' });
  return issues;
}

function hexToRgbUnit(hex) {
  const clean = String(hex || '#ffffff').replace('#', '').padEnd(6, 'f').slice(0, 6);
  return [0, 2, 4].map(index => parseInt(clean.slice(index, index + 2), 16) / 255);
}

function inRange(value, min, max, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
}

export function generateWeaponVfxPackLua(blueprints = []) {
  const entries = [];
  blueprints
    .filter(item => item?.appearance?.vfxEnabled)
    .forEach(rawBlueprint => {
      const blueprint = normalizeWeaponBlueprint(rawBlueprint, { createId: false });
      if (!blueprint?.id) return;
      const safeId = cleanId(blueprint.id);
      const appearance = blueprint.appearance;
      const primary = hexToRgbUnit(appearance.color);
      const secondary = hexToRgbUnit(appearance.secondaryColor || appearance.color);
      const brightness = inRange(appearance.brightness, 0.1, 2, 1);
      const particleSize = inRange(appearance.particleSize, 1, 40, 5);
      const particleCount = Math.round(inRange(appearance.particleCount, 1, 32, 4));
      const particleLife = Math.round(inRange(appearance.particleLife, 1, 90, 12));
      const spread = inRange(appearance.spread, 0, 90, 3);
      const trailSize = inRange(appearance.trailSize, 1, 80, particleSize * 1.35);
      const trailLength = inRange(appearance.trailLength, 1, 160, particleSize * 4);
      const trailGrowth = inRange(appearance.trailGrowth, -1, 5, 0.15);
      const trailLife = Math.round(inRange(appearance.trailLife, 1, 60, 5));
      const trailOffset = inRange(appearance.trailOffset, 0, 1, 0.2);
      const heatSize = inRange(appearance.heatSize, 1, 120, particleSize * 2.4);
      const heatGrowth = inRange(appearance.heatGrowth, 0, 20, Math.max(0.2, particleSize * 0.08));
      const heatFalloff = inRange(appearance.heatFalloff, 0.1, 12, 1.1);
      const flashSize = inRange(appearance.flashSize, 1, 250, particleSize * 5);
      const flashAlpha = inRange(appearance.flashAlpha, 0, 1, 0.55);
      const flashGrowth = inRange(appearance.flashGrowth, 0, 40, particleSize * 0.55);
      const flashLife = Math.round(inRange(appearance.flashLife, 1, 60, 8));
      const texture = String(appearance.texture || 'flare').replace(/[^a-z0-9_-]/gi, '') || 'flare';
      const colorMap = `${primary.map(value => Math.min(1, value * brightness).toFixed(3)).join(' ')} 0.85  ${secondary.map(value => Math.min(1, value * brightness).toFixed(3)).join(' ')} 0.35  0 0 0 0.01`;

      entries.push(`  ["editp_${safeId}_trail"] = {
    usedefaultexplosions = false,
    muzzleflare = {
      air = true, ground = true, water = true, underwater = true,
      class = "CBitmapMuzzleFlame", count = 1,
      properties = {
        colormap = [[${colorMap}]], dir = [[dir]], frontoffset = ${trailOffset.toFixed(2)},
        fronttexture = [[${texture}]], sidetexture = [[${texture}]],
        length = ${trailLength.toFixed(2)}, size = ${trailSize.toFixed(2)}, sizegrowth = ${trailGrowth.toFixed(2)}, ttl = ${trailLife},
      },
    },
  }`);

      const impactSpawners = [];
      if (appearance.heatEnabled !== false) impactSpawners.push(`    core = {
      air = true, ground = true, water = true, underwater = true,
      class = "CHeatCloudProjectile", count = 1,
      properties = {
        heat = ${Math.round(12 * brightness)}, maxheat = ${Math.round(16 * brightness)}, heatfalloff = ${heatFalloff.toFixed(2)},
        pos = [[0, 3, 0]], size = ${heatSize.toFixed(2)}, sizegrowth = ${heatGrowth.toFixed(2)}, texture = [[${texture}]],
      },
    }`);
      if (appearance.particlesEnabled !== false) impactSpawners.push(`    sparks = {
      air = true, ground = true, water = true, underwater = true,
      class = "CSimpleParticleSystem", count = 1,
      properties = {
        airdrag = 0.88, colormap = [[${colorMap}]], directional = true,
        emitrot = 35, emitrotspread = ${spread.toFixed(2)}, emitvector = [[0, 1, 0]],
        gravity = [[0, -0.08, 0]], numparticles = ${particleCount * 2},
        particlelife = ${particleLife}, particlelifespread = 4, particlesize = ${(particleSize * 0.8).toFixed(2)},
        particlespeed = ${Math.max(1, particleSize * 0.45).toFixed(2)}, particlespeedspread = 1.5,
        sizegrowth = -0.04, texture = [[${texture}]],
      },
    }`);
      if (appearance.groundFlashEnabled !== false) impactSpawners.push(`    groundflash = {
      color = [[${primary.map(value => value.toFixed(3)).join(' ')}]], circlealpha = ${(flashAlpha * 0.55).toFixed(2)}, circlegrowth = ${flashGrowth.toFixed(2)},
      flashalpha = ${flashAlpha.toFixed(2)}, flashsize = ${flashSize.toFixed(2)}, ttl = ${flashLife},
    }`);
      entries.push(`  ["editp_${safeId}_impact"] = {
    usedefaultexplosions = false,
${impactSpawners.join(',\n')}
  }`);
    });

  return `-- Generated by BAR EditP Weapon Laboratory
-- Install this file in a full game's or mod's effects/ directory.
return {
${entries.join(',\n')}
}
`;
}

export { DEFAULT_APPEARANCE as WEAPON_BLUEPRINT_DEFAULT_APPEARANCE };
