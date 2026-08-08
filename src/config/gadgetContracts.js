import gameDataManifest from '../data/game-data-manifest.json' with { type: 'json' };

export const GADGET_CONTRACT_REGISTRY_VERSION = 1;

export const GADGET_CONTRACT_STATUS = Object.freeze({
  ready: Object.freeze({ label: 'Ready', tone: 'success' }),
  incomplete: Object.freeze({ label: 'Incomplete', tone: 'warning' }),
  conflicting: Object.freeze({ label: 'Conflicting', tone: 'danger' }),
  experimental: Object.freeze({ label: 'Experimental', tone: 'warning' }),
  unknown: Object.freeze({ label: 'Unknown', tone: 'neutral' }),
});

const source = (path, owner = 'BAR gadget') => Object.freeze({
  owner,
  repository: 'beyond-all-reason/Beyond-All-Reason',
  commit: gameDataManifest.sourceCommit,
  path,
});

export const GADGET_CONTRACT_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'explosion-spawner',
    label: 'Explosion unit spawner',
    scope: 'weapon',
    maturity: 'stable',
    description: 'Creates one of the declared UnitDefs when the projectile explodes.',
    triggerKeys: Object.freeze([
      'spawns_name', 'spawns_surface', 'spawns_mode', 'spawns_expire',
      'spawns_ceg', 'spawns_stun', 'spawn_blocked_by_shield',
    ]),
    activationKeys: Object.freeze(['spawns_name']),
    requiredKeys: Object.freeze(['spawns_name']),
    source: source('luarules/gadgets/unit_explosion_spawner.lua'),
  }),
  Object.freeze({
    id: 'carrier-spawner',
    label: 'Carrier and deployed units',
    scope: 'weapon',
    maturity: 'experimental',
    description: 'Spawns, recalls, docks, and transfers control of carried UnitDefs.',
    triggerKeys: Object.freeze([
      'carried_unit', 'spawnrate', 'maxunits', 'startingdronecount', 'controlradius',
      'engagementrange', 'manualdrones', 'carrierdeaththroe', 'enabledocking',
      'dockingpieces', 'dockingradius', 'dockinghelperspeed', 'dockingarmor',
      'dockinghealrate', 'docktohealthreshold', 'attackformationspread',
      'attackformationoffset', 'decayrate', 'deathdecayrate', 'holdfireradius',
      'droneminimumidleradius', 'droneairtime', 'dronedocktime', 'droneammo',
      'spawn_metal_cost', 'spawn_energy_cost',
    ]),
    activationKeys: Object.freeze(['carried_unit']),
    requiredKeys: Object.freeze(['carried_unit']),
    recommendedKeys: Object.freeze(['spawnrate', 'maxunits', 'controlradius']),
    source: source('luarules/gadgets/unit_carrier_spawner.lua'),
  }),
  Object.freeze({
    id: 'cluster-projectile',
    label: 'Cluster projectile',
    scope: 'weapon',
    maturity: 'stable',
    description: 'Replaces an impact with multiple projectiles from a supporting WeaponDef.',
    triggerKeys: Object.freeze(['cluster_def', 'cluster_number']),
    requiredKeys: Object.freeze(['cluster_def', 'cluster_number']),
    source: source('luarules/gadgets/unit_custom_weapons_cluster.lua'),
  }),
  Object.freeze({
    id: 'sector-fire',
    label: 'Sector fire',
    scope: 'weapon',
    maturity: 'stable',
    description: 'Rotates projectile velocity across a horizontal sector and varies shot depth.',
    triggerKeys: Object.freeze(['speceffect', 'spread_angle', 'max_range_reduction']),
    requiredKeys: Object.freeze(['speceffect', 'spread_angle', 'max_range_reduction']),
    source: source('luarules/gadgets/unit_custom_weapons_behaviours.lua'),
  }),
  Object.freeze({
    id: 'projectile-interception',
    label: 'Projectile interception',
    scope: 'weapon',
    maturity: 'stable',
    description: 'Matches interceptor and targetable bitmasks inside an acquisition radius.',
    triggerKeys: Object.freeze(['interceptor', 'targetable', 'coverage', 'interceptsolo']),
    requiredKeys: Object.freeze([]),
    source: source('luarules/gadgets/unit_interceptors.lua'),
  }),
  Object.freeze({
    id: 'energy-converter',
    label: 'Energy converter',
    scope: 'unit',
    maturity: 'stable',
    description: 'Converts excess energy using the declared capacity and efficiency.',
    triggerKeys: Object.freeze([
      'customparams.energyconv_capacity',
      'customparams.energyconv_efficiency',
    ]),
    requiredKeys: Object.freeze([
      'customparams.energyconv_capacity',
      'customparams.energyconv_efficiency',
    ]),
    source: source('luarules/gadgets/game_energy_conversion.lua'),
  }),
]);

export const GADGET_CONTRACT_BY_ID = new Map(
  GADGET_CONTRACT_REGISTRY.map(contract => [contract.id, contract]),
);

export function getGadgetContract(contractId) {
  return GADGET_CONTRACT_BY_ID.get(contractId) || null;
}
