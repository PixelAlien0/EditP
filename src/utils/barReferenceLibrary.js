import { ASSET_TYPE_LABELS, getAssetManifestMetadata, getAssetOptions, getAssetPreviewUrl } from './barAssets.js';
import { getUnitIconUrl } from './unitArtwork.js';

export const BAR_REFERENCE_CATEGORIES = Object.freeze([
  { id: 'all', label: 'All references', shortLabel: 'All' },
  { id: 'unit', label: 'Units', shortLabel: 'Units' },
  { id: 'weapon', label: 'Mounted WeaponDefs', shortLabel: 'Weapons' },
  { id: 'explosionProfile', label: 'Explosion profiles', shortLabel: 'Explosions' },
  { id: 'buildPicture', label: 'Build pictures', shortLabel: 'Pictures' },
  { id: 'unitModel', label: 'Unit models', shortLabel: 'Models' },
  { id: 'unitScript', label: 'Unit scripts', shortLabel: 'Scripts' },
  { id: 'projectileModel', label: 'Projectile models', shortLabel: 'Projectiles' },
  { id: 'ceg', label: 'CEGs', shortLabel: 'CEGs' },
  { id: 'sound', label: 'Sounds', shortLabel: 'Sounds' },
  { id: 'texture', label: 'Textures', shortLabel: 'Textures' },
  { id: 'iconType', label: 'Icon types', shortLabel: 'Icons' },
  { id: 'collisionVolumeType', label: 'Collision shapes', shortLabel: 'Collision' },
]);

const ASSET_CATEGORIES = BAR_REFERENCE_CATEGORIES
  .map(category => category.id)
  .filter(id => Object.prototype.hasOwnProperty.call(ASSET_TYPE_LABELS, id));

const UNIT_ASSET_FIELDS = Object.freeze({
  objectname: 'unitModel',
  script: 'unitScript',
  buildpic: 'buildPicture',
  icontype: 'iconType',
  collisionvolumetype: 'collisionVolumeType',
});

const WEAPON_ASSET_FIELDS = Object.freeze({
  model: 'projectileModel',
  cegTag: 'ceg',
  cegtag: 'ceg',
  explosiongenerator: 'ceg',
  soundstart: 'sound',
  soundhit: 'sound',
  soundhitwet: 'sound',
  soundhitdry: 'sound',
  texture1: 'texture',
  texture2: 'texture',
  texture3: 'texture',
});

function normalizeReferenceValue(value) {
  return String(value || '').trim().toLowerCase();
}

function detail(label, value, unit = '') {
  if (value === undefined || value === null || value === '') return null;
  return { label, value: String(value), unit };
}

function compactDetails(items) {
  return items.filter(Boolean);
}

function referenceKey(category, value) {
  return `${category}:${normalizeReferenceValue(value)}`;
}

function addUsage(usageMap, category, value, source) {
  const normalized = normalizeReferenceValue(value);
  if (!normalized) return;
  const key = referenceKey(category, normalized);
  const entries = usageMap.get(key) || [];
  if (!entries.some(entry => entry.id === source.id)) entries.push(source);
  usageMap.set(key, entries);
}

function normalizeCegValue(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  return normalized;
}

export function getFactionKey(id = '', explicitFaction = '') {
  const normFaction = String(explicitFaction).trim().toLowerCase();
  if (normFaction.includes('arm')) return 'arm';
  if (normFaction.includes('cor') || normFaction.includes('core')) return 'core';
  if (normFaction.includes('scav')) return 'scavenger';
  if (normFaction.includes('rap')) return 'raptor';

  const normId = String(id).trim().toLowerCase();
  if (normId.startsWith('arm')) return 'arm';
  if (normId.startsWith('cor')) return 'core';
  if (normId.startsWith('scav')) return 'scavenger';
  if (normId.startsWith('rap')) return 'raptor';

  return 'other';
}

function createUnitItems(units, defaultsDb, usageMap) {
  return units.filter(unit => unit && !unit.isClone).map(unit => {
    const id = typeof unit === 'string' ? unit : unit.id || '';
    if (!id) return null;
    const name = typeof unit === 'string' ? unit : unit.name || id;
    const description = typeof unit === 'object' ? unit.description || unit.desc || '' : '';
    const defaults = defaultsDb[id] || {};
    const source = { id: `unit:${id}`, title: name, subtitle: id, category: 'unit' };
    Object.entries(UNIT_ASSET_FIELDS).forEach(([field, category]) => addUsage(usageMap, category, defaults[field], source));
    addUsage(usageMap, 'explosionProfile', defaults.explodeas, source);
    addUsage(usageMap, 'explosionProfile', defaults.selfdestructas, source);

    const faction = getFactionKey(id, typeof unit === 'object' ? unit.faction : '');

    return {
      ...source,
      value: id,
      description,
      previewUrl: getUnitIconUrl(id),
      faction,
      tags: typeof unit === 'object' ? unit.tags || [] : [],
      details: compactDetails([
        detail('Faction', faction.toUpperCase()),
        detail('Technology tier', typeof unit === 'object' ? unit.techTier : undefined),
        detail('Health', defaults.health, 'HP'),
        detail('Metal cost', defaults.metalcost, 'metal'),
        detail('Energy cost', defaults.energycost, 'energy'),
        detail('Weapons', defaults.weaponSlots?.length || 0),
        detail('Model', defaults.objectname),
        detail('Script', defaults.script),
        detail('Build picture', defaults.buildpic),
      ]),
      searchText: `${id} ${name} ${description} ${faction}`.toLowerCase(),
    };
  }).filter(Boolean);
}

function createWeaponItems(units, defaultsDb, usageMap) {
  const items = [];
  units.filter(unit => unit && !unit.isClone).forEach(unit => {
    const id = typeof unit === 'string' ? unit : unit.id || '';
    if (!id) return;
    const name = typeof unit === 'string' ? unit : unit.name || id;
    const slots = defaultsDb[id]?.weaponSlots || [];
    const faction = getFactionKey(id, typeof unit === 'object' ? unit.faction : '');
    slots.forEach(slot => {
      const defKey = slot.defKey || `slot_${slot.slot}`;
      const source = {
        id: `weapon:${id}:${slot.slot}:${defKey}`,
        title: String(defKey).toUpperCase(),
        subtitle: `${name} · Slot ${slot.slot}`,
        category: 'weapon',
      };
      Object.entries(WEAPON_ASSET_FIELDS).forEach(([field, category]) => {
        const value = category === 'ceg' ? normalizeCegValue(slot[field]) : slot[field];
        addUsage(usageMap, category, value, source);
      });
      items.push({
        ...source,
        value: defKey,
        description: `${slot.weapontype || 'WeaponDef'} mounted by ${id}`,
        previewUrl: getUnitIconUrl(id),
        ownerUnitId: id,
        faction,
        details: compactDetails([
          detail('Owner unit', id),
          detail('Faction', faction.toUpperCase()),
          detail('Weapon slot', slot.slot),
          detail('Weapon type', slot.weapontype),
          detail('Damage', slot.damage),
          detail('Reload', slot.reload, 'seconds'),
          detail('Range', slot.range, 'elmos'),
          detail('Velocity', slot.velocity, 'elmos/s'),
          detail('Area of effect', slot.aoe, 'elmos'),
          detail('Targetable mask', slot.targetable),
          detail('Interceptor mask', slot.interceptor),
          detail('Projectile model', slot.model),
          detail('Trail CEG', slot.cegTag || slot.cegtag),
          detail('Explosion CEG', slot.explosiongenerator),
        ]),
        searchText: `${defKey} ${id} ${name} ${slot.weapontype || ''} ${slot.onlytargetcategory || ''} ${slot.badtargetcategory || ''}`.toLowerCase(),
      });
    });
  });
  return items;
}

function createExplosionItems(explosionProfiles, usageMap) {
  return Object.entries(explosionProfiles || {}).map(([id, profile]) => {
    const source = { id: `explosion:${id}`, title: id, subtitle: 'WeaponDef explosion profile', category: 'explosionProfile' };
    addUsage(usageMap, 'ceg', profile.explosiongenerator, source);
    addUsage(usageMap, 'sound', profile.soundhit, source);
    addUsage(usageMap, 'sound', profile.soundstart, source);
    return {
      ...source,
      value: id,
      description: profile.name || profile.explosiongenerator || 'BAR explosion WeaponDef',
      previewUrl: '',
      details: compactDetails([
        detail('Damage', profile.damage?.default),
        detail('Area of effect', profile.areaofeffect, 'elmos'),
        detail('Camera shake', profile.camerashake),
        detail('Impulse factor', profile.impulsefactor),
        detail('Explosion CEG', profile.explosiongenerator),
        detail('Impact sound', profile.soundhit),
        detail('Fire sound', profile.soundstart),
        detail('Paralyzer', profile.paralyzer ? 'Enabled' : undefined),
      ]),
      searchText: `${id} ${profile.name || ''} ${profile.explosiongenerator || ''} ${profile.soundhit || ''} ${profile.soundstart || ''}`.toLowerCase(),
    };
  });
}

function createAssetItems(usageMap) {
  return ASSET_CATEGORIES.flatMap(category => getAssetOptions(category).map(value => {
    const usages = usageMap.get(referenceKey(category, value)) || [];
    return {
      id: `asset:${category}:${normalizeReferenceValue(value)}`,
      title: value,
      subtitle: ASSET_TYPE_LABELS[category],
      category,
      value,
      description: usages.length > 0 ? `Referenced by ${usages.length.toLocaleString()} bundled definition${usages.length === 1 ? '' : 's'}.` : 'Validated BAR asset reference.',
      previewUrl: getAssetPreviewUrl(category, value),
      usedBy: usages,
      details: compactDetails([
        detail('Reference type', ASSET_TYPE_LABELS[category]),
        detail('Used by', usages.length),
        detail('Exact value', value),
      ]),
      searchText: `${value} ${ASSET_TYPE_LABELS[category]} ${usages.map(entry => `${entry.title} ${entry.subtitle}`).join(' ')}`.toLowerCase(),
    };
  }));
}

export function buildBarReferenceCatalog({ units = [], defaultsDb = {}, explosionProfiles = {} } = {}) {
  const usageMap = new Map();
  const unitItems = createUnitItems(units, defaultsDb, usageMap);
  const weaponItems = createWeaponItems(units, defaultsDb, usageMap);
  const explosionItems = createExplosionItems(explosionProfiles, usageMap);
  const assetItems = createAssetItems(usageMap);
  const items = [...unitItems, ...weaponItems, ...explosionItems, ...assetItems];
  const counts = items.reduce((result, item) => {
    result[item.category] = (result[item.category] || 0) + 1;
    return result;
  }, { all: items.length });

  return {
    items,
    counts,
    metadata: getAssetManifestMetadata(),
  };
}

export function filterBarReferences(items, {
  category = 'all',
  query = '',
  usedOnly = false,
  faction = 'all',
  usageStatus = 'all',
  sortBy = 'relevance'
} = {}) {
  const needle = query.trim().toLowerCase();

  const filtered = items.filter(item => {
    if (category !== 'all' && item.category !== category) return false;

    if (usedOnly && item.category !== 'unit' && item.category !== 'weapon' && item.category !== 'explosionProfile' && !(item.usedBy?.length > 0)) {
      return false;
    }

    if (usageStatus === 'used' && item.category !== 'unit' && item.category !== 'weapon' && item.category !== 'explosionProfile' && !(item.usedBy?.length > 0)) {
      return false;
    }
    if (usageStatus === 'unused' && (item.category === 'unit' || item.category === 'weapon' || item.category === 'explosionProfile' || item.usedBy?.length > 0)) {
      return false;
    }

    if (faction !== 'all' && (!item.faction || item.faction !== faction)) {
      return false;
    }

    if (needle && !item.searchText.includes(needle) && !item.title.toLowerCase().includes(needle)) {
      return false;
    }

    return true;
  });

  if (sortBy === 'usage-desc') {
    return [...filtered].sort((a, b) => (b.usedBy?.length || 0) - (a.usedBy?.length || 0) || a.title.localeCompare(b.title));
  }
  if (sortBy === 'name-asc') {
    return [...filtered].sort((a, b) => a.title.localeCompare(b.title));
  }
  if (sortBy === 'name-desc') {
    return [...filtered].sort((a, b) => b.title.localeCompare(a.title));
  }

  return filtered;
}
