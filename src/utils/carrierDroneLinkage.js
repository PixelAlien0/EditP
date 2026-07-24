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
    ?? unitTweaks['customparams.carried_unit']
    ?? unitTweaks['customparams.spawn_name']
    ?? unitTweaks['customparams.spawn_unit']
    ?? defaults.customparams?.spawns_name
    ?? defaults.customparams?.carried_unit
    ?? '';

  const droneAmmo = Number(unitTweaks['customparams.droneammo'] ?? defaults.customparams?.droneammo ?? 4);
  const spawnMetal = Number(unitTweaks['customparams.spawn_metal_cost'] ?? defaults.customparams?.spawn_metal_cost ?? 100);
  const spawnEnergy = Number(unitTweaks['customparams.spawn_energy_cost'] ?? defaults.customparams?.spawn_energy_cost ?? 1000);
  const spawnInterval = Number(unitTweaks['customparams.spawn_interval'] ?? defaults.customparams?.spawn_interval ?? 5);
  const returnHp = Number(unitTweaks['customparams.drone_return_hp'] ?? defaults.customparams?.drone_return_hp ?? 25);

  return {
    parentUnitId: unitId,
    carriedUnit: String(targetChild).trim(),
    spawnsName: String(targetChild).trim(),
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

  const childId = String(config.carriedUnit || config.spawnsName).trim().toLowerCase();

  return {
    'customparams.carried_unit': childId,
    'customparams.spawns_name': childId,
    'customparams.spawn_name': childId,
    'customparams.spawn_unit': childId,
    'customparams.droneammo': String(Math.max(1, Math.min(30, Math.round(config.droneAmmo || 4)))),
    'customparams.spawn_metal_cost': String(Math.max(0, Math.round(config.spawnMetal || 0))),
    'customparams.spawn_energy_cost': String(Math.max(0, Math.round(config.spawnEnergy || 0))),
    'customparams.spawn_interval': String(Math.max(1, Math.round(config.spawnInterval || 5))),
    'customparams.drone_return_hp': String(Math.max(0, Math.min(100, Math.round(config.returnHp || 25)))),
  };
}
