/**
 * Carrier & Deployed Drone Linkage Utility
 * Maps parent-child unit relationships into Recoil/BAR gadget customparams.
 */
import { SAFE_ORPHAN_DRONE_AIRTIME_SECONDS } from './carrierRuntimeSafety.js';

export const CARRIER_ARCHETYPES = [
  {
    id: 'armada_carrier',
    name: 'Armada Tactical Carrier',
    faction: 'arm',
    parentUnitId: 'armcarrier',
    childUnitId: 'armantiodrone',
    capacity: 6,
    spawnInterval: 5,
    metalCost: 120,
    energyCost: 1500,
    returnHpPercent: 25,
    description: 'Armada naval warship equipped with rapid-response interceptor drones.',
  },
  {
    id: 'cortex_swarm',
    name: 'Cortex Swarm Warship',
    faction: 'cor',
    parentUnitId: 'corcarrier',
    childUnitId: 'corantiodrone',
    capacity: 8,
    spawnInterval: 4,
    metalCost: 100,
    energyCost: 1200,
    returnHpPercent: 20,
    description: 'Cortex assault carrier deploying heavy drone swarm strikes.',
  },
  {
    id: 'legion_kaiser',
    name: 'Legion Kaiser Battleship',
    faction: 'leg',
    parentUnitId: 'legvcarry',
    childUnitId: 'legdrone',
    capacity: 10,
    spawnInterval: 3,
    metalCost: 180,
    energyCost: 2000,
    returnHpPercent: 30,
    description: 'Flagship dreadnought deploying long-range fighter drones.',
  },
  {
    id: 'orbital_carrier',
    name: 'Orbital Drone Platform',
    faction: 'arm',
    parentUnitId: 'armosat',
    childUnitId: 'armodrone',
    capacity: 4,
    spawnInterval: 6,
    metalCost: 250,
    energyCost: 3000,
    returnHpPercent: 40,
    description: 'High-altitude satellite platform launching space-combat drones.',
  },
  {
    id: 'rampart_geothermal',
    name: 'Rampart Geothermal Platform',
    faction: 'leg',
    parentUnitId: 'legrampart',
    childUnitId: 'legbasicassistdrone',
    capacity: 20,
    spawnInterval: 4,
    metalCost: 90,
    energyCost: 1000,
    returnHpPercent: 0,
    description: 'Geothermal defence structure launching independent controllable combat drones.',
  },
];

function readCarrierBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return !['false', '0', 'off', 'no'].includes(String(value).trim().toLowerCase());
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

  const unitsList = String(targetChild)
    .split(/[\s,]+/)
    .map(s => s.trim())
    .filter(Boolean);

  const primaryUnit = unitsList[0] || '';
  const secondaryUnits = unitsList.slice(1);

  const surface = String(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawns_surface') || '').toUpperCase();
  const isGroundSpawner = surface === 'LAND'
    || unitTweaks['customparams.spawntype'] === 'ground'
    || unitId.includes('hive')
    || unitId.includes('spawner');

  const maxUnits = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'maxunits', 'droneammo') ?? 4);
  const spawnMetal = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawn_metal_cost', 'metalcost') ?? 100);
  const spawnEnergy = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawn_energy_cost', 'energycost') ?? 1000);
  const spawnInterval = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'spawn_interval', 'spawnrate') ?? 5);
  const returnHp = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'drone_return_hp', 'docktohealthreshold') ?? 25);
  const startingDroneCount = Number(getCarrierValue(unitTweaks, defaults, carrierWeaponSlot, 'startingdronecount') ?? 0);
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
    // Retained for callers saved against the earlier, incorrectly named API.
    droneAmmo: Number.isFinite(maxUnits) && maxUnits > 0 ? maxUnits : 4,
    startingDroneCount: Number.isFinite(startingDroneCount) && startingDroneCount >= 0
      ? startingDroneCount
      : 0,
    droneAirTime: Number.isFinite(droneAirTime) && droneAirTime > 0 ? droneAirTime : null,
    manualControl,
    dockingEnabled,
    carrierDeathBehavior,
    spawnMetal: Number.isFinite(spawnMetal) ? spawnMetal : 100,
    spawnEnergy: Number.isFinite(spawnEnergy) ? spawnEnergy : 1000,
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
  if (!config || !config.parentUnitId || (!config.carriedUnit && !config.spawnsName)) {
    return {};
  }

  const primaryId = String(config.carriedUnit || config.spawnsName).trim().toLowerCase();
  const carrierRoster = getCarrierRoster(config);
  const requestedDeathBehavior = String(
    config.carrierDeathBehavior
      || ((config.isControllable ?? true) ? 'control' : 'death')
  ).trim().toLowerCase();
  const carrierDeathBehavior = ['death', 'control', 'capture', 'release', 'parasite'].includes(requestedDeathBehavior)
    ? requestedDeathBehavior
    : 'death';
  const manualControl = config.manualControl ?? true;
  const dockingEnabled = config.dockingEnabled ?? false;
  const maxUnits = config.maxUnits ?? config.droneAmmo ?? 4;
  const countStr = String(Math.max(1, Math.min(100, Math.round(maxUnits))));
  const startingCountStr = String(Math.max(
    0,
    Math.min(Number(countStr), Math.round(Number(config.startingDroneCount) || 0))
  ));
  const intervalStr = String(Math.max(1, Math.round(config.spawnInterval || 5)));
  const metalStr = String(Math.max(0, Math.round(config.spawnMetal || 0)));
  const energyStr = String(Math.max(0, Math.round(config.spawnEnergy || 0)));
  const requestedAirTime = Number(config.droneAirTime);
  const safeAirTime = Number.isFinite(requestedAirTime) && requestedAirTime > 0
    ? requestedAirTime
    : SAFE_ORPHAN_DRONE_AIRTIME_SECONDS;
  const targetSlot = Math.max(1, Math.round(Number(config.targetWeaponSlot) || 1));
  const slotKey = key => getSlotTweakKey(targetSlot, key);

  const result = {
    editp_carrier_slot: String(targetSlot),
    editp_carrier_weapondef: String(config.targetWeaponDef || '').trim().toLowerCase(),
    [slotKey('carried_unit')]: carrierRoster || primaryId,
    [slotKey('spawns_surface')]: String(
      config.spawnSurface ?? (config.deployMode === 'ground' ? 'LAND' : '')
    ).trim().toUpperCase(),
    [slotKey('maxunits')]: countStr,
    [slotKey('startingdronecount')]: startingCountStr,
    [slotKey('spawn_metal_cost')]: metalStr,
    [slotKey('spawn_energy_cost')]: energyStr,
    [slotKey('spawnrate')]: intervalStr,
    [slotKey('carrierdeaththroe')]: carrierDeathBehavior,
    [slotKey('manualdrones')]: manualControl ? 'true' : 'false',
    [slotKey('enabledocking')]: dockingEnabled ? 'true' : 'false',
    [slotKey('droneairtime')]: carrierDeathBehavior === 'death'
      ? (Number.isFinite(requestedAirTime) && requestedAirTime > 0 ? String(requestedAirTime) : undefined)
      : String(safeAirTime),
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
