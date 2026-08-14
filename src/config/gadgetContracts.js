import gameDataManifest from '../data/game-data-manifest.json' with { type: 'json' };

export const GADGET_CONTRACT_REGISTRY_VERSION = 3;

export const GADGET_CONTRACT_STATUS = Object.freeze({
  ready: Object.freeze({ label: 'Ready', tone: 'success' }),
  incomplete: Object.freeze({ label: 'Incomplete', tone: 'warning' }),
  conflicting: Object.freeze({ label: 'Conflicting', tone: 'danger' }),
  experimental: Object.freeze({ label: 'Experimental', tone: 'warning' }),
  unknown: Object.freeze({ label: 'Unknown', tone: 'neutral' }),
});

const source = (path, owner = 'BAR gadget') => Object.freeze({
  kind: 'bar',
  owner,
  repository: 'beyond-all-reason/Beyond-All-Reason',
  commit: gameDataManifest.sourceCommit,
  path,
});

const projectSource = path => Object.freeze({
  kind: 'project',
  owner: 'BAR EditP runtime gadget',
  repository: 'PixelAlien0/EditP',
  commit: null,
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
    id: 'special-projectile-behavior',
    label: 'Special projectile behavior',
    scope: 'weapon',
    maturity: 'stable',
    description: 'Applies one BAR projectile lifecycle mode together with the fields required by that mode.',
    triggerKeys: Object.freeze([
      'speceffect', 'cruise_min_height', 'cruise_max_height', 'lockon_dist',
      'guidance_lost_radius', 'speceffect_def', 'speceffect_number',
      'splitexplosionceg', 'waterpenceg', 'speceffect_cegtag',
      'speceffect_model', 'tracking_turn_radius',
    ]),
    activationKeys: Object.freeze(['speceffect']),
    requiredKeys: Object.freeze(['speceffect']),
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
  Object.freeze({
    id: 'scavenger-squad',
    label: 'Scavenger squad registry',
    scope: 'unit',
    maturity: 'stable',
    description: 'Registers a UnitDef as an eligible Scavenger squad member with spawn weighting, anger bounds, rarity, and behavior data.',
    triggerKeys: Object.freeze([
      'customparams.scavcustomsquad', 'customparams.scavsquadunitsamount', 'customparams.scavsquadminanger', 'customparams.scavsquadmaxanger',
      'customparams.scavsquadweight', 'customparams.scavsquadrarity', 'customparams.scavsquadbehavior', 'customparams.scavsquadbehaviordistance',
      'customparams.scavsquadbehaviorchance',
    ]),
    activationKeys: Object.freeze(['customparams.scavcustomsquad']),
    requiredKeys: Object.freeze([
      'customparams.scavcustomsquad', 'customparams.scavsquadunitsamount', 'customparams.scavsquadminanger', 'customparams.scavsquadmaxanger',
      'customparams.scavsquadweight', 'customparams.scavsquadrarity', 'customparams.scavsquadbehavior', 'customparams.scavsquadbehaviordistance',
      'customparams.scavsquadbehaviorchance',
    ]),
    source: source('luarules/configs/scav_spawn_defs.lua', 'BAR Scavenger system'),
  }),
  Object.freeze({
    id: 'unit-prerequisites',
    label: 'Technology prerequisite',
    scope: 'unit',
    maturity: 'experimental',
    description: 'Allows construction only after the builder team owns the required finished UnitDefs. Requires the BAR EditP runtime gadget in the loaded game or mod package.',
    triggerKeys: Object.freeze([
      'customparams.editp_prerequisite_units',
      'customparams.editp_prerequisite_mode',
      'customparams.editp_prerequisite_persistent',
    ]),
    activationKeys: Object.freeze(['customparams.editp_prerequisite_units']),
    requiredKeys: Object.freeze(['customparams.editp_prerequisite_units']),
    source: projectSource('runtime/prerequisites/LuaRules/Gadgets/unit_build_prerequisites.lua'),
  }),
]);

export const GADGET_CONTRACT_BY_ID = new Map(
  GADGET_CONTRACT_REGISTRY.map(contract => [contract.id, contract]),
);

export function getGadgetContract(contractId) {
  return GADGET_CONTRACT_BY_ID.get(contractId) || null;
}
