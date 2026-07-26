// BAR's carrier gadget currently halves droneAirTime when a carrier using a
// surviving-drone policy dies, but does not guard an omitted value. A large,
// finite value preserves the intended "effectively unlimited" lifetime while
// avoiding the upstream nil arithmetic error.
export const SAFE_ORPHAN_DRONE_AIRTIME_SECONDS = 31_536_000;

export function ensureSafeCarrierWeaponPatch(weaponPatch = {}, inheritedSlot = {}) {
  const customParams = weaponPatch.customparams || {};
  const carriedUnit = customParams.carried_unit ?? inheritedSlot.carried_unit;
  const deathBehavior = String(
    customParams.carrierdeaththroe ?? inheritedSlot.carrierdeaththroe ?? 'death'
  ).toLowerCase();
  const droneAirTime = customParams.droneairtime ?? inheritedSlot.droneairtime;

  if (!carriedUnit
    || !['control', 'capture', 'release'].includes(deathBehavior)
    || Number(droneAirTime) > 0) {
    return weaponPatch;
  }

  return {
    ...weaponPatch,
    customparams: {
      ...customParams,
      droneairtime: SAFE_ORPHAN_DRONE_AIRTIME_SECONDS,
    },
  };
}
