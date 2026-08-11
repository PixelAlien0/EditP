import { WEAPON_EDITABLE_PARAMETER_CATALOG } from '../config/weaponParameters.js';
import {
  getSupportingWeaponDefDependencies,
  resolveSupportingWeaponDefReachability,
} from './supportingWeaponDefReachability.js';

const cleanId = value => String(value || '').trim().toLowerCase();

const SOURCE_SLOT_OMIT_KEYS = new Set(['slot', 'defkey']);
const WEAPONDEF_SOURCE_PARAMETERS = new Map(
  WEAPON_EDITABLE_PARAMETER_CATALOG
    .filter(parameter => parameter.compileTarget === 'weapondef')
    .map(parameter => [cleanId(parameter.key), parameter]),
);

function setNestedValue(target, path, value) {
  const segments = String(path || '').split('.').filter(Boolean);
  if (!segments.length) return;
  let cursor = target;
  segments.slice(0, -1).forEach(segment => {
    cursor[segment] ||= {};
    cursor = cursor[segment];
  });
  cursor[segments.at(-1)] = structuredClone(value);
}

/**
 * Convert one of the validated, mounted BAR weapon snapshots into a literal
 * WeaponDef. The snapshot is deliberately copied rather than referenced: the
 * new definition can safely live under a different UnitDef and be edited
 * without changing BAR's original WeaponDef.
 */
export function createSupportingWeaponDefFromSource({ ownerUnitId, key, source }) {
  const cleanOwner = cleanId(ownerUnitId);
  const cleanKey = cleanId(key);
  const sourceSlot = source?.slot && typeof source.slot === 'object' ? source.slot : {};
  const definition = {};

  Object.entries(sourceSlot).forEach(([rawKey, value]) => {
    const normalizedKey = cleanId(rawKey);
    if (!normalizedKey || SOURCE_SLOT_OMIT_KEYS.has(normalizedKey) || value === undefined) return;
    const parameter = WEAPONDEF_SOURCE_PARAMETERS.get(normalizedKey);
    if (parameter) {
      setNestedValue(definition, parameter.path, value);
      return;
    }
    // Target categories belong to a unit's weapon mount, rather than the
    // reusable WeaponDef. They are intentionally not copied here.
    if (WEAPON_EDITABLE_PARAMETER_CATALOG.some(candidate => (
      cleanId(candidate.key) === normalizedKey && candidate.compileTarget === 'mount'
    ))) return;
    // The snapshot keeps these three compact aliases for editor presentation;
    // WeaponDefs themselves use their engine-native field names.
    const targetKey = normalizedKey === 'reload'
      ? 'reloadtime'
      : normalizedKey === 'velocity'
        ? 'weaponvelocity'
        : normalizedKey === 'aoe'
          ? 'areaofeffect'
          : rawKey;
    definition[targetKey] = structuredClone(value);
  });

  return {
    id: `support_source_${cleanOwner}_${cleanKey}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerUnitId: cleanOwner,
    key: cleanKey,
    label: `${String(source?.sourceWeaponDefKey || cleanKey).toUpperCase()} copy`,
    definition,
    enabled: true,
    alwaysExport: false,
    mode: 'create-only',
    role: 'auxiliary',
    mountedSlots: [],
    dependencies: [],
    referencedBy: [],
    sourceName: `BAR snapshot: ${source?.sourceUnitName || source?.sourceUnitId || 'unknown'} / ${String(source?.sourceWeaponDefKey || '').toUpperCase()}`,
  };
}

export function getSupportingWeaponDefDestination(definition) {
  return `${cleanId(definition?.ownerUnitId)}:${cleanId(definition?.key)}`;
}

export function analyzeSupportingWeaponDefLibrary({
  definitions = [],
  knownUnitIds = [],
  tweaks = {},
  clones = [],
  weaponLibrary = [],
} = {}) {
  const reachability = resolveSupportingWeaponDefReachability({ definitions, tweaks, clones, weaponLibrary });
  const knownUnits = new Set(knownUnitIds.map(unit => cleanId(unit?.id || unit)));
  const destinations = definitions.map(getSupportingWeaponDefDestination);
  const destinationCounts = destinations.reduce((counts, destination) => {
    counts.set(destination, (counts.get(destination) || 0) + 1);
    return counts;
  }, new Map());
  const destinationSet = new Set(destinations);

  const entries = definitions.map((definition, index) => {
    const ownerUnitId = cleanId(definition.ownerUnitId);
    const key = cleanId(definition.key);
    const destination = destinations[index];
    const errors = [];
    const warnings = [];
    const consumers = new Set((definition.referencedBy || []).map(value => cleanId(value)).filter(Boolean));
    const dependencies = getSupportingWeaponDefDependencies(definition);
    const alwaysExport = Boolean(definition.alwaysExport);

    if (!ownerUnitId) errors.push('Owner UnitDef is required.');
    else if (!knownUnits.has(ownerUnitId)) errors.push(`Owner UnitDef ${ownerUnitId} is not present in this project.`);
    if (!key) errors.push('WeaponDef key is required.');
    if (!definition.definition || typeof definition.definition !== 'object' || Array.isArray(definition.definition)) {
      errors.push('Literal definition must be a JSON object.');
    }
    if (destinationCounts.get(destination) > 1) errors.push('Another supporting WeaponDef uses this owner and key.');

    const missingDependencies = dependencies.filter(dependency => !destinationSet.has(`${ownerUnitId}:${dependency}`));
    if (missingDependencies.length) warnings.push(`Missing dependencies: ${missingDependencies.join(', ')}.`);

    definitions.forEach(candidate => {
      if (cleanId(candidate.ownerUnitId) !== ownerUnitId) return;
      const candidateDependencies = (candidate.dependencies || []).map(value => cleanId(value));
      if (candidateDependencies.includes(key)) consumers.add(cleanId(candidate.key));
    });
    (definition.mountedSlots || []).forEach(slot => consumers.add(`weapon slot ${slot}`));
    Object.entries(tweaks[ownerUnitId] || {}).forEach(([parameter, value]) => {
      if (cleanId(value) === key && /weapon_slot_\d+_/.test(parameter)) consumers.add(parameter.replaceAll('_', ' '));
    });
    (reachability.reasons[destination] || []).forEach(reason => consumers.add(reason));

    const enabled = definition.enabled !== false;
    const status = errors.length ? 'error' : !enabled ? 'disabled' : warnings.length ? 'review' : 'ready';
    const definitionJson = JSON.stringify(definition.definition || {});

    return {
      ...definition,
      ownerUnitId,
      key,
      destination,
      enabled,
      alwaysExport,
      exportState: !enabled
        ? 'disabled'
        : reachability.includedDestinations.has(destination)
          ? 'included'
          : 'local-only',
      status,
      errors,
      warnings,
      dependencies,
      missingDependencies,
      consumers: [...consumers],
      rootFieldCount: Object.keys(definition.definition || {}).length,
      encodedBytes: new TextEncoder().encode(definitionJson).byteLength,
    };
  });

  return {
    entries,
    totals: {
      all: entries.length,
      active: entries.filter(entry => entry.enabled).length,
      ready: entries.filter(entry => entry.status === 'ready').length,
      issues: entries.filter(entry => entry.status === 'error' || entry.status === 'review').length,
      unused: entries.filter(entry => entry.exportState === 'local-only').length,
      bytes: entries.reduce((total, entry) => total + entry.encodedBytes, 0),
      omittedBytes: reachability.totals.omittedBytes,
    },
    reachability,
  };
}
