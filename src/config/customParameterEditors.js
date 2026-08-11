const ASSET_EDITORS = Object.freeze({
  buildpic: 'buildPicture',
  icontype: 'iconType',
  model: 'unitModel',
  objectname: 'unitModel',
  script: 'unitScript',
  scriptname: 'unitScript',
  sound: 'sound',
  soundstart: 'sound',
  soundhit: 'sound',
  cegtag: 'ceg',
  explosiongenerator: 'ceg',
  normaltex: 'texture',
  texture: 'texture',
});

const UNIT_REFERENCE_KEYS = new Set([
  'decoyfor',
  'i18nfromunit',
  'parent_unit',
  'child_unit',
  'spawns_name',
]);

const UNIT_LIST_KEYS = new Set([
  'carried_unit',
  'spawn_units',
  'unit_list',
]);

const WEAPON_REFERENCE_KEYS = new Set([
  'cluster_def',
  'speceffect_def',
  'weapon',
  'weapon_def',
  'weapondef',
]);

export function getCustomParameterEditor(definition = {}) {
  const key = String(definition.key || '').trim().toLowerCase();
  if (definition.editor?.kind) return definition.editor;
  if (ASSET_EDITORS[key]) return { kind: 'asset', assetType: ASSET_EDITORS[key] };
  if (UNIT_LIST_KEYS.has(key)) return { kind: 'reference-list', referenceType: 'unit' };
  if (UNIT_REFERENCE_KEYS.has(key)) return { kind: 'reference', referenceType: 'unit' };
  if (WEAPON_REFERENCE_KEYS.has(key)) return { kind: 'reference', referenceType: 'weapon' };
  if (definition.type === 'boolean') return { kind: 'boolean' };
  if (definition.acceptedValues?.length) return { kind: 'enum', options: definition.acceptedValues };
  if (definition.type === 'number') {
    return {
      kind: 'number',
      min: definition.min,
      max: definition.max,
      step: definition.step,
      unit: definition.unit,
    };
  }
  if (definition.sampleValues?.length && definition.sampleValues.length <= 40) {
    return { kind: 'suggested-text', options: definition.sampleValues };
  }
  return { kind: 'text' };
}

export function buildCustomParameterReferenceCatalogs(allUnitsList = [], defaultsDb = {}) {
  const units = allUnitsList
    .filter(unit => unit?.id)
    .map(unit => ({
      id: String(unit.id).toLowerCase(),
      label: String(unit.name || unit.id),
      detail: [unit.faction, unit.techTier].filter(Boolean).join(' / '),
    }))
    .sort((left, right) => left.label.localeCompare(right.label, 'en') || left.id.localeCompare(right.id, 'en'));

  const weaponsById = new Map();
  Object.entries(defaultsDb || {}).forEach(([unitId, defaults]) => {
    (defaults?.weaponSlots || []).forEach(slot => {
      const id = String(slot?.defKey || '').trim().toLowerCase();
      if (!id) return;
      const current = weaponsById.get(id) || { id, label: String(slot.defKey), owners: [] };
      if (!current.owners.includes(unitId)) current.owners.push(unitId);
      weaponsById.set(id, current);
    });
  });
  const weapons = [...weaponsById.values()]
    .map(item => ({ ...item, detail: `${item.owners.length} mounted ${item.owners.length === 1 ? 'unit' : 'units'}` }))
    .sort((left, right) => left.id.localeCompare(right.id, 'en'));

  return { units, weapons };
}
