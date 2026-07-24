/**
 * Carrier & Deployed Drone Linkage Utility
 * Maps parent-child unit relationships into Recoil/BAR gadget customparams:
 * - carried_unit (child drone unit ID)
 * - droneammo (max active payload capacity)
 * - spawns_name (spawn unit ID)
 * - spawn_metal_cost / spawn_energy_cost
 * - spawn_interval (seconds)
 * - drone_return_hp (% health threshold)
 */

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
];

/**
 * Extracts current carrier-drone linkage configuration from unit tweaks or defaults
 */
export function getCarrierLinkageConfig(unitId, tweaks = {}, defaultsDb = {}) {
  const unitTweaks = tweaks[unitId] || {};
  const defaults = defaultsDb[unitId] || {};

  const targetChild = unitTweaks['customparams.spawns_name']
    ?? unitTweaks['customparams.spawns']
    ?? unitTweaks['customparams.carried_unit']
    ?? unitTweaks['customparams.spawn_name']
    ?? unitTweaks['customparams.spawn_unit']
    ?? unitTweaks['customparams.spawn']
    ?? defaults.customparams?.spawns_name
    ?? defaults.customparams?.carried_unit
    ?? '';

  const unitsList = String(targetChild)
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  const primaryUnit = unitsList[0] || '';
  const secondaryUnits = unitsList.slice(1);

  const hasCarriedUnit = Boolean(unitTweaks['customparams.carried_unit'] && unitTweaks['customparams.carried_unit'] !== '');
  const isGroundSpawner = Boolean(
    unitTweaks['customparams.spawns_name'] ||
    unitTweaks['customparams.spawns'] ||
    unitId.includes('hive') ||
    unitId.includes('spawner') ||
    !hasCarriedUnit
  );

  const droneAmmo = Number(unitTweaks['customparams.droneammo'] ?? unitTweaks['customparams.spawn_count'] ?? defaults.customparams?.droneammo ?? 4);
  const spawnMetal = Number(unitTweaks['customparams.spawn_metal_cost'] ?? defaults.customparams?.spawn_metal_cost ?? 100);
  const spawnEnergy = Number(unitTweaks['customparams.spawn_energy_cost'] ?? defaults.customparams?.spawn_energy_cost ?? 1000);
  const spawnInterval = Number(unitTweaks['customparams.spawn_interval'] ?? unitTweaks['customparams.spawn_rate'] ?? defaults.customparams?.spawn_interval ?? 5);
  const returnHp = Number(unitTweaks['customparams.drone_return_hp'] ?? defaults.customparams?.drone_return_hp ?? 25);

  return {
    parentUnitId: unitId,
    carriedUnit: primaryUnit,
    spawnsName: primaryUnit,
    secondaryUnits,
    deployMode: isGroundSpawner ? 'ground' : 'air',
    droneAmmo: Number.isFinite(droneAmmo) && droneAmmo > 0 ? droneAmmo : 4,
    spawnMetal: Number.isFinite(spawnMetal) ? spawnMetal : 100,
    spawnEnergy: Number.isFinite(spawnEnergy) ? spawnEnergy : 1000,
    spawnInterval: Number.isFinite(spawnInterval) && spawnInterval > 0 ? spawnInterval : 5,
    returnHp: Number.isFinite(returnHp) ? returnHp : 25,
  };
}

/**
 * Formats carrier linkage state into unit tweaks key-value pairs
 */
export function buildCarrierLinkageTweaks(config) {
  if (!config || !config.parentUnitId || (!config.carriedUnit && !config.spawnsName)) {
    return {};
  }

  const primaryId = String(config.carriedUnit || config.spawnsName).trim().toLowerCase();
  const secondaryList = Array.isArray(config.secondaryUnits)
    ? config.secondaryUnits.map(u => String(u).trim().toLowerCase()).filter(Boolean)
    : [];

  const uniqueRoster = [primaryId, ...secondaryList].filter((v, idx, arr) => arr.indexOf(v) === idx);
  const commaRoster = uniqueRoster.join(',');

  const isGroundMode = config.deployMode === 'ground';

  const countStr = String(Math.max(1, Math.min(100, Math.round(config.droneAmmo || 4))));

  return {
    'customparams.carried_unit': primaryId,
    'customparams.spawns_name': commaRoster,
    'customparams.spawn_name': commaRoster,
    'customparams.spawn_unit': commaRoster,
    'customparams.spawns': commaRoster,
    'customparams.spawn': commaRoster,
    'customparams.spawntype': isGroundMode ? 'ground' : 'air',
    'customparams.spawns_units': commaRoster,
    'customparams.spawns_types': isGroundMode ? 'ground' : 'air',
    'customparams.droneammo': countStr,
    'customparams.spawn_count': countStr,
    'customparams.maxunits': countStr,
    'customparams.maxdrones': countStr,
    'customparams.max_units': countStr,
    'customparams.max_drones': countStr,
    'customparams.spawns_count': countStr,
    'customparams.spawns_max': countStr,
    'customparams.spawn_metal_cost': String(Math.max(0, Math.round(config.spawnMetal || 0))),
    'customparams.spawn_energy_cost': String(Math.max(0, Math.round(config.spawnEnergy || 0))),
    'customparams.spawn_interval': String(Math.max(1, Math.round(config.spawnInterval || 5))),
    'customparams.spawn_rate': String(Math.max(1, Math.round(config.spawnInterval || 5))),
    'customparams.drone_return_hp': String(Math.max(0, Math.min(100, Math.round(config.returnHp || 25)))),
  };
}
