// BAR's carrier gadget currently halves droneAirTime when a carrier using a
// surviving-drone policy dies, but does not guard an omitted value. A large,
// finite value preserves the intended "effectively unlimited" lifetime while
// avoiding the upstream nil arithmetic error.
export const SAFE_ORPHAN_DRONE_AIRTIME_SECONDS = 31_536_000;

function splitValues(value) {
  return String(value ?? '').trim().split(/\s+/).filter(Boolean);
}

function alignValues(values, count, fallback) {
  return Array.from({ length: count }, (_, index) => (
    values[index] ?? values[values.length - 1] ?? fallback
  ));
}

export function ensureSafeCarrierWeaponPatch(weaponPatch = {}, inheritedSlot = {}) {
  const customParams = weaponPatch.customparams || {};
  const carriedUnit = customParams.carried_unit ?? inheritedSlot.carried_unit;
  const carriedUnits = splitValues(carriedUnit);
  if (carriedUnits.length === 0) return weaponPatch;

  const deathBehavior = String(
    customParams.carrierdeaththroe ?? inheritedSlot.carrierdeaththroe ?? 'death'
  ).toLowerCase();
  const droneAirTime = customParams.droneairtime ?? inheritedSlot.droneairtime;
  const safeCustomParams = { ...customParams };
  let changed = false;

  if (carriedUnits.length > 1) {
    const dockingSource = customParams.dockingpieces ?? inheritedSlot.dockingpieces;
    const dockingSections = String(dockingSource ?? '')
      .split(',')
      .map(section => section.trim())
      .filter(Boolean);
    safeCustomParams.dockingpieces = alignValues(
      dockingSections,
      carriedUnits.length,
      '1'
    ).join(',');
    changed = safeCustomParams.dockingpieces !== customParams.dockingpieces;
  }

  if (['control', 'capture', 'release'].includes(deathBehavior)) {
    const airTimes = splitValues(droneAirTime).filter(value => Number(value) > 0);
    const safeAirTimes = alignValues(
      airTimes,
      carriedUnits.length,
      String(SAFE_ORPHAN_DRONE_AIRTIME_SECONDS)
    );
    const nextAirTime = safeAirTimes.join(' ');
    if (nextAirTime !== String(customParams.droneairtime ?? '')) {
      safeCustomParams.droneairtime = carriedUnits.length === 1
        ? Number(nextAirTime)
        : nextAirTime;
      changed = true;
    }
  }

  return changed
    ? { ...weaponPatch, customparams: safeCustomParams }
    : weaponPatch;
}
