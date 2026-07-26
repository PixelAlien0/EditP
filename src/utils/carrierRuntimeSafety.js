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

function isEnabled(value) {
  if (value === undefined || value === null || value === '') return false;
  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
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
  const droneAmmo = customParams.droneammo ?? inheritedSlot.droneammo;
  const safeCustomParams = { ...customParams };
  let changed = false;

  // BAR only supplies one default ammo entry. Its carrier gadget indexes this
  // list by carried-unit type, so every type must receive an explicit value.
  const ammoValues = splitValues(droneAmmo)
    .map(value => Number(value))
    .filter(value => Number.isFinite(value) && value >= 0)
    .map(value => String(Math.round(value)));
  const nextDroneAmmo = alignValues(
    ammoValues,
    carriedUnits.length,
    '0'
  ).join(' ');
  if (nextDroneAmmo !== String(customParams.droneammo ?? '')) {
    safeCustomParams.droneammo = carriedUnits.length === 1
      ? Number(nextDroneAmmo)
      : nextDroneAmmo;
    changed = true;
  }

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
    changed = safeCustomParams.dockingpieces !== customParams.dockingpieces || changed;

    const manualDrones = customParams.manualdrones ?? inheritedSlot.manualdrones;
    const dockingEnabled = customParams.enabledocking ?? inheritedSlot.enabledocking;
    if (isEnabled(manualDrones) && isEnabled(dockingEnabled)) {
      // Direct-control multi-type rosters cannot issue automatic undock/idle
      // orders reliably in BAR. Free deployment avoids one attached reserve
      // being left behind for each carried-unit type.
      safeCustomParams.enabledocking = false;
      changed = true;
    }
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
