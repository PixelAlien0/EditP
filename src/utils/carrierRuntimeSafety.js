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
  return !['false', '0', 'off', 'no', 'disabled'].includes(String(value).trim().toLowerCase());
}

function buildFreeDeploymentSections(count) {
  return Array.from({ length: count }, () => ' ').join(',');
}

function normalizeNumericList(value, count, fallback, { min = 0, integer = false } = {}) {
  const values = splitValues(value)
    .map(item => Number(item))
    .filter(Number.isFinite)
    .map(item => Math.max(min, integer ? Math.round(item) : item))
    .map(String);
  return alignValues(values, count, String(fallback)).join(' ');
}

function normalizeScalar(value, fallback, { min = 0 } = {}) {
  const firstValue = splitValues(value)[0];
  const number = Number(firstValue);
  return Number.isFinite(number) ? Math.max(min, number) : fallback;
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

  const spawnRate = normalizeScalar(
    customParams.spawnrate ?? inheritedSlot.spawnrate,
    1,
    { min: Number.EPSILON },
  );
  if (spawnRate !== customParams.spawnrate) {
    safeCustomParams.spawnrate = spawnRate;
    changed = true;
  }

  for (const key of ['controlradius', 'engagementrange']) {
    const source = customParams[key] ?? inheritedSlot[key];
    if (source === undefined || source === null || source === '') continue;
    const normalized = normalizeScalar(source, 0, { min: 0 });
    if (normalized !== customParams[key]) {
      safeCustomParams[key] = normalized;
      changed = true;
    }
  }

  for (const key of ['manualdrones', 'enabledocking']) {
    const source = customParams[key] ?? inheritedSlot[key];
    if (source === undefined || source === null || source === '') continue;
    const normalized = isEnabled(source) ? 1 : 0;
    if (normalized !== customParams[key]) {
      safeCustomParams[key] = normalized;
      changed = true;
    }
  }

  const maxUnits = normalizeNumericList(
    customParams.maxunits ?? inheritedSlot.maxunits,
    carriedUnits.length,
    1,
    { min: 1, integer: true },
  );
  if (maxUnits !== String(customParams.maxunits ?? '')) {
    safeCustomParams.maxunits = carriedUnits.length === 1 ? Number(maxUnits) : maxUnits;
    changed = true;
  }

  const startingCounts = normalizeNumericList(
    customParams.startingdronecount ?? inheritedSlot.startingdronecount,
    carriedUnits.length,
    0,
    { min: 0, integer: true },
  );
  if (startingCounts !== String(customParams.startingdronecount ?? '')) {
    safeCustomParams.startingdronecount = carriedUnits.length === 1
      ? Number(startingCounts)
      : startingCounts;
    changed = true;
  }

  const droneTypes = alignValues(
    splitValues(customParams.dronetype ?? inheritedSlot.dronetype),
    carriedUnits.length,
    'default',
  ).join(' ');
  if (droneTypes !== String(customParams.dronetype ?? '')) {
    safeCustomParams.dronetype = droneTypes;
    changed = true;
  }

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
    const dockingEnabled = customParams.enabledocking ?? inheritedSlot.enabledocking;
    if (isEnabled(dockingEnabled)) {
      const dockingSections = String(dockingSource ?? '')
        .split(',')
        .map(section => section.trim())
        .filter(Boolean);
      safeCustomParams.dockingpieces = alignValues(
        dockingSections,
        carriedUnits.length,
        '1'
      ).join(',');
    } else {
      safeCustomParams.dockingpieces = buildFreeDeploymentSections(carriedUnits.length);
    }
    changed = safeCustomParams.dockingpieces !== customParams.dockingpieces || changed;

  } else {
    const dockingEnabled = customParams.enabledocking ?? inheritedSlot.enabledocking;
    if (!isEnabled(dockingEnabled)) {
      safeCustomParams.dockingpieces = buildFreeDeploymentSections(1);
      changed = safeCustomParams.dockingpieces !== customParams.dockingpieces || changed;
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
