function cleanId(value) {
  return String(value || '').trim().toLowerCase();
}

function fallbackWeaponDefs(defaults = {}) {
  return Object.fromEntries(
    (defaults.weaponSlots || [])
      .map(slot => [cleanId(slot?.defKey), slot])
      .filter(([key]) => key)
  );
}

/**
 * Return every WeaponDef owned by a UnitDef. Snapshot schema v2 stores these
 * independently from weapon mounts so auxiliary and projectile-child
 * definitions remain discoverable. Older fixtures fall back to mounted slots.
 */
export function getCanonicalWeaponDefs(defaults = {}) {
  const nested = defaults?.weaponDefs;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) return nested;
  return fallbackWeaponDefs(defaults);
}

export function getCanonicalWeaponDef(defaults = {}, weaponDefKey = '') {
  return getCanonicalWeaponDefs(defaults)[cleanId(weaponDefKey)];
}

export function getCanonicalWeaponDefKeys(defaults = {}) {
  return Object.keys(getCanonicalWeaponDefs(defaults));
}

export function getKnownWeaponDefKeys(defaultsDb = {}) {
  const keys = new Set();
  Object.entries(defaultsDb).forEach(([unitId, defaults]) => {
    getCanonicalWeaponDefKeys(defaults).forEach(key => {
      keys.add(key);
      keys.add(`${cleanId(unitId)}_${key}`);
    });
  });
  return keys;
}

export function getMountedWeaponDefKeys(defaults = {}) {
  return new Set(
    (defaults.weaponSlots || [])
      .map(slot => cleanId(slot?.defKey))
      .filter(Boolean)
  );
}
