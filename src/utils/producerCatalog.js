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

/**
 * Build the user-facing producer catalog from BAR build-option owners.
 *
 * BAR also ships unnamed helper/variant unit definitions. They are useful to
 * game-side scripts, but exposing their raw IDs as normal factories makes the
 * editor catalog misleading. A human-facing name is therefore the admission
 * rule for this UI catalog.
 */
export function createProducerCatalog(rosters = {}, names = {}, defaults = {}) {
  return Object.keys(rosters)
    .flatMap(id => {
      const name = typeof names[id] === 'string' ? names[id].trim() : '';
      if (!name) return [];

      const kind = getProducerKind(defaults[id]);
      return [{
        id,
        name,
        kind,
        kindLabel: kind === PRODUCER_KIND.FACTORY ? 'Factory' : 'Builder',
        faction: getFactionOfUnit(id),
        tier: getProducerTier(defaults[id]),
        rosterSize: Array.isArray(rosters[id]) ? rosters[id].length : 0,
      }];
    })
    .sort((left, right) => (
      PRODUCER_KIND_ORDER[left.kind] - PRODUCER_KIND_ORDER[right.kind]
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id)
    ));
}

