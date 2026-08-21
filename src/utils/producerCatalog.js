import { getFactionOfUnit } from './categories.js';

export const PRODUCER_KIND = Object.freeze({
  FACTORY: 'factory',
  BUILDER: 'builder',
});

const PRODUCER_KIND_ORDER = {
  [PRODUCER_KIND.FACTORY]: 0,
  [PRODUCER_KIND.BUILDER]: 1,
};

function isConstructionTurretProducer(name, unitDefaults = {}) {
  const unitGroup = String(unitDefaults['customparams.unitgroup'] || '').trim().toLowerCase();
  const workertime = Number(unitDefaults.workertime);
  const builddistance = Number(unitDefaults.builddistance);
  const maxVelocity = Number(unitDefaults.maxvelocity);
  return /construction turret/i.test(String(name || ''))
    && unitGroup === 'builder'
    && Number.isFinite(workertime)
    && workertime > 0
    && Number.isFinite(builddistance)
    && builddistance > 0
    && (!Number.isFinite(maxVelocity) || maxVelocity <= 0);
}

function getProducerKind(unitDefaults = {}, name = '') {
  if (isConstructionTurretProducer(name, unitDefaults)) return PRODUCER_KIND.BUILDER;
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

/**
 * Construction turrets are real BAR builders, but vanilla BAR gives them no
 * buildoptions. Keep an empty editable roster for them so the roster designer
 * can author one without pretending that every static utility unit is a
 * producer.
 */
export function addConstructionTurretProducerRosters(
  rosters = {},
  names = {},
  defaults = {},
  units = []
) {
  const result = Object.fromEntries(
    Object.entries(rosters).map(([producerId, roster]) => [
      cleanId(producerId),
      Array.isArray(roster) ? [...roster] : [],
    ])
  );
  const unitsById = new Map(
    units.map(unit => [cleanId(unit?.id), unit]).filter(([id]) => id)
  );

  Object.entries(defaults).forEach(([rawId, unitDefaults]) => {
    const id = cleanId(rawId);
    if (!id || Object.hasOwn(result, id)) return;
    const unit = unitsById.get(id);
    const name = String(unit?.name || names[id] || '').trim();
    if (isConstructionTurretProducer(name, unitDefaults)) result[id] = [];
  });

  return result;
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
      const sourceName = String(names[sourceId] || '').trim();
      const isConstructionTurret = isConstructionTurretProducer(name, unitDefaults)
        || isConstructionTurretProducer(sourceName, unitDefaults);
      const kind = isConstructionTurret
        ? PRODUCER_KIND.BUILDER
        : getProducerKind(unitDefaults, name);
      return [{
        id,
        name,
        kind,
        kindLabel: kind === PRODUCER_KIND.FACTORY ? 'Factory' : 'Builder',
        faction: unit?.faction || getFactionOfUnit(sourceId),
        tier: unit?.techTier || getProducerTier(unitDefaults),
        rosterSize: Array.isArray(rosters[id]) ? rosters[id].length : 0,
        isClone: Boolean(unit?.isClone),
        producerSubtype: isConstructionTurret ? 'construction-turret' : kind,
        sourceId,
      }];
    })
    .sort((left, right) => (
      PRODUCER_KIND_ORDER[left.kind] - PRODUCER_KIND_ORDER[right.kind]
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id)
    ));
}
