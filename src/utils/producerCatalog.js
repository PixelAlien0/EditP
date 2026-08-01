import { getFactionOfUnit } from './categories.js';

export const PRODUCER_KIND = Object.freeze({
  FACTORY: 'factory',
  BUILDER: 'builder',
});

const PRODUCER_KIND_ORDER = {
  [PRODUCER_KIND.FACTORY]: 0,
  [PRODUCER_KIND.BUILDER]: 1,
};

function getProducerKind(unitDefaults = {}) {
  const maxVelocity = Number(unitDefaults.maxvelocity);
  return Number.isFinite(maxVelocity) && maxVelocity > 0
    ? PRODUCER_KIND.BUILDER
    : PRODUCER_KIND.FACTORY;
}

function getProducerTier(unitDefaults = {}) {
  const rawTier = unitDefaults['customparams.techlevel'];
  const numericTier = Number(rawTier);
  if (!Number.isFinite(numericTier) || numericTier <= 0) return 'T1';
  return `T${numericTier}`;
}

function cleanId(value) {
  return String(value || '').trim().toLowerCase();
}

export function addCloneProducerRosters(rosters = {}, clones = []) {
  const result = Object.fromEntries(
    Object.entries(rosters).map(([producerId, roster]) => [
      cleanId(producerId),
      Array.isArray(roster) ? [...roster] : [],
    ])
  );
  const pending = clones
    .map(clone => ({
      baseId: cleanId(clone?.baseId),
      newId: cleanId(clone?.newId),
    }))
    .filter(clone => clone.baseId && clone.newId)
    .sort((left, right) => left.newId.localeCompare(right.newId));

  for (let pass = 0; pass < pending.length; pass += 1) {
    let added = false;
    pending.forEach(clone => {
      if (Object.hasOwn(result, clone.newId)) return;
      const inheritedRoster = result[clone.baseId];
      if (!Array.isArray(inheritedRoster)) return;
      result[clone.newId] = [...inheritedRoster];
      added = true;
    });
    if (!added) break;
  }

  return result;
}

/**
 * Build the user-facing producer catalog from BAR build-option owners.
 *
 * BAR also ships unnamed helper/variant unit definitions. They are useful to
 * game-side scripts, but exposing their raw IDs as normal factories makes the
 * editor catalog misleading. A human-facing name is therefore the admission
 * rule for this UI catalog.
 */
export function createProducerCatalog(rosters = {}, names = {}, defaults = {}, units = []) {
  const unitsById = new Map(
    units.map(unit => [cleanId(unit?.id), unit]).filter(([id]) => id)
  );
  return Object.keys(rosters)
    .flatMap(id => {
      const unit = unitsById.get(cleanId(id));
      const name = String(unit?.name || names[id] || '').trim();
      if (!name || (!unit?.isClone && name.toLowerCase() === id.toLowerCase())) return [];

      const sourceId = cleanId(unit?.rootBaseId || unit?.baseId || id);
      const unitDefaults = defaults[id] || defaults[sourceId] || {};
      const kind = getProducerKind(unitDefaults);
      return [{
        id,
        name,
        kind,
        kindLabel: kind === PRODUCER_KIND.FACTORY ? 'Factory' : 'Builder',
        faction: unit?.faction || getFactionOfUnit(sourceId),
        tier: unit?.techTier || getProducerTier(unitDefaults),
        rosterSize: Array.isArray(rosters[id]) ? rosters[id].length : 0,
        isClone: Boolean(unit?.isClone),
        sourceId,
      }];
    })
    .sort((left, right) => (
      PRODUCER_KIND_ORDER[left.kind] - PRODUCER_KIND_ORDER[right.kind]
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id)
    ));
}
