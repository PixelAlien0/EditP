/**
 * Carrier & Deployed Drone Linkage Utility
 * Maps parent-child unit relationships into Recoil/BAR gadget customparams.
 */
import { SAFE_ORPHAN_DRONE_AIRTIME_SECONDS } from './carrierRuntimeSafety.js';

function readCarrierBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return !['false', '0', 'off', 'no', 'disabled'].includes(String(value).trim().toLowerCase());
}

const LEGACY_CARRIER_TWEAK_KEYS = Object.freeze([
  'editp_carrier_roster',
  'customparams.carried_unit',
  'customparams.spawns_surface',
  'customparams.droneammo',
  'customparams.maxunits',
  'customparams.stockpilelimit',
  'customparams.startingdronecount',
  'customparams.spawn_metal_cost',
  'customparams.spawn_energy_cost',
  'customparams.metalcost',
  'customparams.energycost',
  'customparams.spawn_interval',
  'customparams.spawnrate',
  'customparams.carrierdeaththroe',
  'customparams.manualdrones',
  'customparams.enabledocking',
  'customparams.droneminimumidleradius',
  'customparams.droneairtime',
  'customparams.docktohealthreshold',
]);

function getSlotTweakKey(slot, key) {
  return `weapon_slot_${slot}_${key}`;
}

function findConfiguredCarrierSlot(unitTweaks = {}) {
  const configuredKey = Object.keys(unitTweaks).find(key => (
    /^weapon_slot_\d+_carried_unit$/.test(key)
    && String(unitTweaks[key] || '').trim() !== ''
  ));
  const match = configuredKey?.match(/^weapon_slot_(\d+)_/);
  return match ? Number(match[1]) : null;
}

function getCarrierWeaponSlot(defaults, unitTweaks = {}, requestedSlot = null, requestedDefKey = '') {
  const slots = Array.isArray(defaults?.weaponSlots) ? defaults.weaponSlots : [];
  const normalizedSlot = Number(requestedSlot);
  const normalizedRequest = String(requestedDefKey || '').trim().toLowerCase();
  const configuredSlot = findConfiguredCarrierSlot(unitTweaks);
  return slots.find(slot => Number(slot.slot) === normalizedSlot)
    || slots.find(slot => Number(slot.slot) === Number(unitTweaks.editp_carrier_slot))
    || slots.find(slot => Number(slot.slot) === configuredSlot)
    || slots.find(slot => String(slot.defKey || '').toLowerCase() === normalizedRequest)
    || slots.find(slot => slot.carried_unit)
    || slots[0]
    || null;
}

function getCarrierValue(unitTweaks, defaults, weaponSlot, key, ...aliases) {
  const keys = [key, ...aliases];
  const slotNumber = Number(weaponSlot?.slot);
  if (Number.isInteger(slotNumber) && slotNumber > 0) {
    for (const candidate of keys) {
      const tweakKey = getSlotTweakKey(slotNumber, candidate);
      if (unitTweaks[tweakKey] !== undefined) return unitTweaks[tweakKey];
    }
  }
  // Compatibility for projects saved by the original workbench, which put
  // WeaponDef customparams at UnitDef level.
  for (const candidate of keys) {
    const tweakKey = `customparams.${candidate}`;
    if (unitTweaks[tweakKey] !== undefined) return unitTweaks[tweakKey];
  }
  for (const candidate of keys) {
    if (weaponSlot?.[candidate] !== undefined) return weaponSlot[candidate];
    const defaultKey = `customparams.${candidate}`;
    if (defaults[defaultKey] !== undefined) return defaults[defaultKey];
  }
  return undefined;
}

function splitSpaceList(value) {
  return String(value ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(item => item.trim())
    .filter(Boolean);
}

function splitDockingSections(value) {
  return String(value ?? '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function alignList(values, count, fallback) {
  const source = values.filter(value => value !== undefined && value !== null && String(value).trim() !== '');
  return Array.from({ length: count }, (_, index) => (
    source[index] ?? source[source.length - 1] ?? fallback
  ));
}

function alignNumberList(value, count, fallback, { min = 0, max = Infinity, integer = false } = {}) {
  return alignList(splitSpaceList(value), count, fallback).map(item => {
    const parsed = Number(item);
    const safeValue = Number.isFinite(parsed) ? parsed : fallback;
    const clamped = Math.max(min, Math.min(max, safeValue));
    return String(integer ? Math.round(clamped) : clamped);
  });
}

// BAR's string.split keeps whitespace-only comma sections in the outer
// docking-section list, while the inner whitespace split produces no pieces.
// This gives every drone type a valid section without teleporting its first
// spawned unit onto piece 1 inside the carrier model.
function buildFreeDeploymentSections(count) {
  return Array.from({ length: count }, () => ' ').join(',');
}

/**
 * Extracts current carrier-drone linkage configuration from unit tweaks or defaults
 */
export function getCarrierLinkageConfig(unitId, tweaks = {}, defaultsDb = {}, requestedSlot = null) {
  const unitTweaks = tweaks[unitId] || {};
  const defaults = defaultsDb[unitId] || {};
  const requestedWeaponDef = unitTweaks.editp_carrier_weapondef || '';
  const carrierWeaponSlot = getCarrierWeaponSlot(
    defaults,
    unitTweaks,
    requestedSlot,
    requestedWeaponDef
  );

  const targetChild = getCarrierValue(
    unitTweaks,
    defaults,
    carrierWeaponSlot,
    'carried_unit'
  ) ?? '';

  const unitsList = splitSpaceList(targetChild);

  const primaryUnit = unitsList[0] || '';
  const secondaryUnits = unitsList.slice(1);

  const surface = String(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawns_surface') || '').toUpperCase();
  const isGroundSpawner = surface === 'LAND'
    || unitTweaks['customparams.spawntype'] === 'ground'
    || unitId.includes('hive')
    || unitId.includes('spawner');

  const maxUnitsValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'maxunits') ?? 4;
  const startingDroneCountValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'startingdronecount') ?? 0;
  const spawnMetalValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawn_metal_cost', 'metalcost') ?? 100;
  const spawnEnergyValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawn_energy_cost', 'energycost') ?? 1000;
  const droneTypeValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'dronetype') ?? 'default';
  const dockingPiecesValue = unitTweaks.editp_carrier_dockingpieces
    ?? getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'dockingpieces')
    ?? '1';
  const droneDockTimeValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'dronedocktime') ?? '';
  const droneAmmoValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'droneammo') ?? '0';
  const minimumIdleRadiusValue = getCarrierValue(
    unitTweaks,
    defaults,
    carrierWeaponSlot,
    'droneminimumidleradius'
  );
  const controlRadiusValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'controlradius');
  const engagementRangeValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'engagementrange');
  const maxUnits = Number(splitSpaceList(maxUnitsValue)[0] ?? 4);
  const spawnMetal = Number(splitSpaceList(spawnMetalValue)[0] ?? 100);
  const spawnEnergy = Number(splitSpaceList(spawnEnergyValue)[0] ?? 1000);
  const spawnInterval = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawn_interval', 'spawnrate') ?? 5);
  const returnHp = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'drone_return_hp', 'docktohealthreshold') ?? 25);
  const startingDroneCount = Number(splitSpaceList(startingDroneCountValue)[0] ?? 0);
  const droneAirTimeValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'droneairtime');
  const droneAirTime = Number(droneAirTimeValue);
  const manualControlValue = getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'manualdrones');
  const manualControl = manualControlValue === undefined
    ? null
    : readCarrierBoolean(manualControlValue, false);
  const dockingEnabled = readCarrierBoolean(
    getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'enabledocking'),
    false
  );
  const carrierDeathBehavior = String(
    getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'carrierdeaththroe') || 'death'
  ).toLowerCase();

  const isControllable = ['control', 'capture'].includes(carrierDeathBehavior);

  return {
    parentUnitId: unitId,
    carriedUnit: primaryUnit,
    spawnsName: primaryUnit,
    secondaryUnits,
    carriedUnitsText: unitsList.join(' '),
    deployMode: isGroundSpawner ? 'ground' : 'air',
    spawnSurface: surface,
    isControllable,
    targetWeaponSlot: carrierWeaponSlot?.slot || Number(requestedSlot) || null,
    targetWeaponDef: carrierWeaponSlot?.defKey || requestedWeaponDef,
    weaponOptions: (defaults.weaponSlots || []).map(slot => ({
      slot: slot.slot,
      defKey: slot.defKey,
      label: `Slot ${slot.slot} · ${String(slot.defKey || '').toUpperCase()}`,
      isCarrierController: Boolean(
        getCarrierValue(unitTweaks, defaults, slot, 'carried_unit')
      ),
    })),
    maxUnits: Number.isFinite(maxUnits) && maxUnits > 0 ? maxUnits : 4,
    maxUnitsText: String(maxUnitsValue),
    droneAmmo: Number.isFinite(Number(splitSpaceList(droneAmmoValue)[0]))
      ? Number(splitSpaceList(droneAmmoValue)[0])
      : 0,
    startingDroneCount: Number.isFinite(startingDroneCount) && startingDroneCount >= 0
      ? startingDroneCount
      : 0,
    startingDroneCountText: String(startingDroneCountValue),
    droneAirTime: Number.isFinite(droneAirTime) && droneAirTime > 0 ? droneAirTime : null,
    droneAirTimeText: droneAirTimeValue === undefined ? '' : String(droneAirTimeValue),
    droneDockTimeText: String(droneDockTimeValue),
    droneAmmoText: String(droneAmmoValue),
    droneTypesText: String(droneTypeValue),
    dockingPiecesText: String(dockingPiecesValue),
    manualControl,
    dockingEnabled,
    minimumIdleRadius: Number.isFinite(Number(minimumIdleRadiusValue))
      ? Math.max(0, Number(minimumIdleRadiusValue))
      : 160,
    controlRadius: Number.isFinite(Number(splitSpaceList(controlRadiusValue)[0]))
      ? Math.max(0, Number(splitSpaceList(controlRadiusValue)[0]))
      : null,
    engagementRange: Number.isFinite(Number(splitSpaceList(engagementRangeValue)[0]))
      ? Math.max(0, Number(splitSpaceList(engagementRangeValue)[0]))
      : null,
    carrierDeathBehavior,
    spawnMetal: Number.isFinite(spawnMetal) ? spawnMetal : 100,
    spawnMetalText: String(spawnMetalValue),
    spawnEnergy: Number.isFinite(spawnEnergy) ? spawnEnergy : 1000,
    spawnEnergyText: String(spawnEnergyValue),
    spawnInterval: Number.isFinite(spawnInterval) && spawnInterval > 0 ? spawnInterval : 5,
    returnHp: Number.isFinite(returnHp) ? returnHp : 25,
  };
}

function getCarrierRoster(config) {
  const primaryId = String(config.carriedUnit || config.spawnsName || '').trim().toLowerCase();
  const secondaryList = Array.isArray(config.secondaryUnits)
    ? config.secondaryUnits.map(u => String(u).trim().toLowerCase()).filter(Boolean)
    : [];

  return [primaryId, ...secondaryList]
    .filter(Boolean)
    .filter((v, idx, arr) => arr.indexOf(v) === idx)
    .join(' ');
}

/**
 * Formats carrier linkage state into unit tweaks key-value pairs
 */
export function buildCarrierLinkageTweaks(config) {
  if (!config || !config.parentUnitId
    || (!config.carriedUnitsText && !config.carriedUnit && !config.spawnsName)) {
    return {};
  }

  const requestedRoster = config.carriedUnitsText || getCarrierRoster(config);
  const carriedUnits = [...new Set(splitSpaceList(requestedRoster).map(unitId => unitId.toLowerCase()))];
  if (carriedUnits.length === 0) return {};
  const primaryId = carriedUnits[0];
  const carrierRoster = carriedUnits.join(' ');
  const payloadCount = carriedUnits.length;
  const requestedDeathBehavior = String(
    config.carrierDeathBehavior
      || ((config.isControllable ?? true) ? 'control' : 'death')
  ).trim().toLowerCase();
  const carrierDeathBehavior = ['death', 'control', 'capture', 'release', 'parasite'].includes(requestedDeathBehavior)
    ? requestedDeathBehavior
    : 'death';
  const manualControl = config.manualControl ?? true;
  const dockingEnabled = config.dockingEnabled ?? false;
  const maxUnitsSource = config.maxUnitsText ?? config.maxUnits ?? config.droneAmmo ?? 4;
  const maxUnitsList = alignNumberList(maxUnitsSource, payloadCount, 1, {
    min: 1,
    max: 100,
    integer: true,
  });
  const startingCountList = alignNumberList(
    config.startingDroneCountText ?? config.startingDroneCount ?? 0,
    payloadCount,
    0,
    { min: 0, max: 100, integer: true }
  ).map((value, index) => String(Math.min(Number(value), Number(maxUnitsList[index]))));
  const intervalStr = String(Math.max(1, Math.round(config.spawnInterval || 5)));
  const metalList = alignNumberList(
    config.spawnMetalText ?? config.spawnMetal ?? 0,
    payloadCount,
    0,
    { min: 0, integer: true }
  );
  const energyList = alignNumberList(
    config.spawnEnergyText ?? config.spawnEnergy ?? 0,
    payloadCount,
    0,
    { min: 0, integer: true }
  );
  const droneTypes = alignList(splitSpaceList(config.droneTypesText), payloadCount, 'default');
  const dockingSections = alignList(
    splitDockingSections(config.dockingPiecesText),
    payloadCount,
    '1'
  );
  const requestedAirTimes = splitSpaceList(config.droneAirTimeText ?? config.droneAirTime);
  const droneAirTimes = carrierDeathBehavior === 'death' && requestedAirTimes.length === 0
    ? null
    : alignNumberList(
      requestedAirTimes,
      payloadCount,
      SAFE_ORPHAN_DRONE_AIRTIME_SECONDS,
      { min: 1 }
    );
  const requestedDockTimes = splitSpaceList(config.droneDockTimeText);
  const droneDockTimes = requestedDockTimes.length > 0
    ? alignNumberList(requestedDockTimes, payloadCount, 0, { min: 0 })
    : null;
  // BAR defaults droneammo to a single "0" token. With multiple carried unit
  // types, later entries otherwise receive nil and crash at maxAmmo > 0.
  const droneAmmo = alignNumberList(
    config.droneAmmoText,
    payloadCount,
    0,
    { min: 0, integer: true }
  );
  const minimumIdleRadius = Math.max(
    0,
    Number.isFinite(Number(config.minimumIdleRadius))
      ? Number(config.minimumIdleRadius)
      : 160
  );
  const targetSlot = Math.max(1, Math.round(Number(config.targetWeaponSlot) || 1));
  const slotKey = key => getSlotTweakKey(targetSlot, key);

  const result = {
    editp_carrier_slot: String(targetSlot),
    editp_carrier_weapondef: String(config.targetWeaponDef || '').trim().toLowerCase(),
    // Preserve the user's real docking layout for later switching even while
    // free deployment compiles empty physical docking sections.
    editp_carrier_dockingpieces: String(config.dockingPiecesText || '1'),
    [slotKey('carried_unit')]: carrierRoster || primaryId,
    [slotKey('spawns_surface')]: String(
      config.spawnSurface ?? (config.deployMode === 'ground' ? 'LAND' : '')
    ).trim().toUpperCase(),
    [slotKey('dronetype')]: droneTypes.join(' '),
    [slotKey('maxunits')]: maxUnitsList.join(' '),
    [slotKey('startingdronecount')]: startingCountList.join(' '),
    [slotKey('spawn_metal_cost')]: metalList.join(' '),
    [slotKey('spawn_energy_cost')]: energyList.join(' '),
    // BAR indexes availableSections by drone type even when docking is off.
    // Always emit one comma-delimited section per carried unit to prevent the
    // upstream line-573 nil access when a multi-type roster spawns.
    [slotKey('dockingpieces')]: dockingEnabled
      ? dockingSections.join(',')
      : buildFreeDeploymentSections(payloadCount),
    [slotKey('spawnrate')]: intervalStr,
    [slotKey('carrierdeaththroe')]: carrierDeathBehavior,
    // The BAR gadget reads these with tonumber(), so Lua booleans are invalid.
    [slotKey('manualdrones')]: manualControl ? '1' : '0',
    [slotKey('enabledocking')]: dockingEnabled ? '1' : '0',
    [slotKey('droneminimumidleradius')]: String(minimumIdleRadius),
    [slotKey('controlradius')]: config.controlRadius === null || config.controlRadius === undefined || config.controlRadius === ''
      ? undefined
      : String(Math.max(0, Number(config.controlRadius) || 0)),
    [slotKey('engagementrange')]: config.engagementRange === null || config.engagementRange === undefined || config.engagementRange === ''
      ? undefined
      : String(Math.max(0, Number(config.engagementRange) || 0)),
    [slotKey('droneairtime')]: droneAirTimes?.join(' '),
    [slotKey('dronedocktime')]: droneDockTimes?.join(' '),
    [slotKey('droneammo')]: droneAmmo.join(' '),
    [slotKey('docktohealthreshold')]: String(
      Math.max(0, Math.min(100, Number(config.returnHp) || 0))
    ),
  };

  // Applying the workbench also migrates its old UnitDef-level representation.
  // This prevents Definitions Lua and Units Lua from applying two competing
  // carrier configurations to the same unit.
  LEGACY_CARRIER_TWEAK_KEYS.forEach(key => {
    result[key] = undefined;
  });

  return result;
}
