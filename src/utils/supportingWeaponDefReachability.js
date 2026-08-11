import { getWeaponBlueprintEffectiveValues } from './weaponBlueprint.js';

const REFERENCE_KEYS = Object.freeze(['cluster_def', 'speceffect_def']);

const cleanId = value => String(value || '').trim().toLowerCase();

export function getSupportingWeaponDefDestination(definition) {
  return `${cleanId(definition?.ownerUnitId)}:${cleanId(definition?.key)}`;
}

export function getSupportingWeaponDefDependencies(definition) {
  const dependencies = new Set(
    (definition?.dependencies || []).map(cleanId).filter(Boolean),
  );
  const customParams = definition?.definition?.customparams;
  REFERENCE_KEYS.forEach(key => {
    const dependency = cleanId(customParams?.[key]);
    if (dependency) dependencies.add(dependency);
  });
  return [...dependencies].sort();
}

function addReference(references, ownerUnitId, weaponDefKey, reason) {
  const owner = cleanId(ownerUnitId);
  const key = cleanId(weaponDefKey);
  if (!owner || !key) return;
  const destination = `${owner}:${key}`;
  if (!references.has(destination)) references.set(destination, new Set());
  references.get(destination).add(reason);
}

function collectProjectReferences({ tweaks, clones, weaponLibrary }) {
  const references = new Map();

  Object.entries(tweaks || {}).forEach(([ownerUnitId, patch]) => {
    Object.entries(patch || {}).forEach(([parameterKey, value]) => {
      if (/^weapon_slot_\d+_(?:cluster_def|speceffect_def)$/.test(parameterKey)) {
        addReference(references, ownerUnitId, value, parameterKey);
      }
    });
  });

  const blueprints = new Map((weaponLibrary || []).map(entry => [cleanId(entry?.id), entry]));
  (clones || []).forEach(clone => {
    Object.values(clone?.weaponSwaps || {}).forEach(swap => {
      // A borrowed definition can itself be stored in the supporting library.
      addReference(references, swap?.sourceUnitId, swap?.sourceWeaponDefKey, 'borrowed weapon');

      const blueprint = blueprints.get(cleanId(swap?.libraryWeaponId));
      if (!blueprint) return;
      const values = getWeaponBlueprintEffectiveValues(blueprint);
      REFERENCE_KEYS.forEach(key => {
        addReference(references, clone?.newId, values[key], `custom weapon ${key}`);
      });
    });
  });

  return references;
}

/**
 * Select the enabled Supporting WeaponDefs that can affect generated output.
 * Library entries remain persisted even when excluded from this result.
 */
export function resolveSupportingWeaponDefReachability({
  definitions = [],
  tweaks = {},
  clones = [],
  weaponLibrary = [],
} = {}) {
  const enabled = definitions.filter(definition => definition?.enabled !== false);
  const byDestination = new Map();
  enabled.forEach(definition => {
    const destination = getSupportingWeaponDefDestination(definition);
    if (!destination || destination === ':') return;
    if (!byDestination.has(destination)) byDestination.set(destination, []);
    byDestination.get(destination).push(definition);
  });

  const reasons = collectProjectReferences({ tweaks, clones, weaponLibrary });
  enabled.forEach(definition => {
    const destination = getSupportingWeaponDefDestination(definition);
    if (!destination || destination === ':') return;
    if (definition.alwaysExport) addReference(reasons, definition.ownerUnitId, definition.key, 'always export');
    if ((definition.mountedSlots || []).length > 0) addReference(reasons, definition.ownerUnitId, definition.key, 'mounted weapon slot');
  });

  const queue = [...reasons.keys()].sort();
  const visited = new Set();
  while (queue.length) {
    const destination = queue.shift();
    if (visited.has(destination)) continue;
    visited.add(destination);
    const candidates = byDestination.get(destination) || [];
    candidates.forEach(definition => {
      getSupportingWeaponDefDependencies(definition).forEach(dependency => {
        const dependencyDestination = `${cleanId(definition.ownerUnitId)}:${dependency}`;
        if (!reasons.has(dependencyDestination)) reasons.set(dependencyDestination, new Set());
        reasons.get(dependencyDestination).add(`dependency of ${cleanId(definition.key)}`);
        if (!visited.has(dependencyDestination)) queue.push(dependencyDestination);
      });
    });
    queue.sort();
  }

  const included = enabled.filter(definition => visited.has(getSupportingWeaponDefDestination(definition)));
  const includedEntries = new Set(included);
  const excluded = definitions.filter(definition => !includedEntries.has(definition));
  const reasonEntries = Object.fromEntries(
    [...reasons.entries()].map(([destination, values]) => [destination, [...values].sort()]),
  );

  return {
    included,
    excluded,
    includedDestinations: visited,
    reasons: reasonEntries,
    totals: {
      all: definitions.length,
      included: included.length,
      localOnly: excluded.filter(definition => definition?.enabled !== false).length,
      disabled: excluded.filter(definition => definition?.enabled === false).length,
      omittedBytes: excluded.reduce((total, definition) => (
        total + new TextEncoder().encode(JSON.stringify(definition?.definition || {})).byteLength
      ), 0),
    },
  };
}
