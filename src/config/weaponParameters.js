import {
  SPAWNER_CARRIER_WEAPON_GROUPS,
  WEAPON_SLOT_BOOLEAN_PARAMS as LEGACY_BOOLEAN_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS as LEGACY_MOUNT_PARAMS,
  WEAPON_SLOT_PATHS as LEGACY_PATHS,
  WEAPON_SLOT_STRING_PARAMS as LEGACY_STRING_PARAMS,
} from './editorParameters.js';

export { SPAWNER_CARRIER_WEAPON_GROUPS };

const FEATURED_KEYS = new Set(['damage', 'reload', 'range', 'velocity', 'aoe']);
const SCALAR_LIST_KEYS = new Set([
  'maxunits',
  'startingdronecount',
  'spawn_metal_cost',
  'spawn_energy_cost',
  'droneairtime',
  'dronedocktime',
  'droneammo',
]);
const CORE_GROUPS = Object.freeze({
  damage: 'Damage & cadence',
  damage_vs_light: 'Damage & cadence',
  damage_vs_medium: 'Damage & cadence',
  damage_vs_heavy: 'Damage & cadence',
  damage_vs_commander: 'Damage & cadence',
  reload: 'Damage & cadence',
  projectiles: 'Damage & cadence',
  burst: 'Damage & cadence',
  burstrate: 'Damage & cadence',
  range: 'Range & accuracy',
  velocity: 'Range & accuracy',
  flighttime: 'Range & accuracy',
  aoe: 'Range & accuracy',
  accuracy: 'Range & accuracy',
  sprayangle: 'Range & accuracy',
  heightmod: 'Range & accuracy',
  hightrajectory: 'Range & accuracy',
  canattackground: 'Targeting & safety',
  toairweapon: 'Targeting & safety',
  avoidfriendly: 'Targeting & safety',
  collidefriendly: 'Targeting & safety',
  interceptedbyshieldtype: 'Targeting & safety',
  stockpile: 'Ammunition',
  stockpiletime: 'Ammunition',
  stockpilelimit: 'Ammunition',
  weapontype: 'Presentation',
  cegTag: 'Presentation',
  model: 'Presentation',
  explosiongenerator: 'Presentation',
});
const CORE_UNITS = Object.freeze({
  damage: 'damage',
  reload: 'seconds',
  range: 'elmos',
  velocity: 'elmos/s',
  flighttime: 'seconds',
  aoe: 'elmos',
  accuracy: 'angle',
  sprayangle: 'angle',
  burstrate: 'seconds',
  stockpiletime: 'seconds',
});

const coreParameters = [
  { key: 'damage', label: 'Damage', sub: 'damage.default', type: 'number' },
  { key: 'damage_vs_commander', label: 'Damage vs Commanders', sub: 'damage.commanders', type: 'number' },
  { key: 'damage_vs_vtol', label: 'Damage vs VTOL', sub: 'damage.vtol', type: 'number' },
  { key: 'damage_vs_subs', label: 'Damage vs Submarines', sub: 'damage.subs', type: 'number' },
  { key: 'damage_vs_shields', label: 'Damage vs Shields', sub: 'damage.shields', type: 'number' },
  { key: 'damage_vs_scavboss', label: 'Damage vs Scav Bosses', sub: 'damage.scavboss', type: 'number' },
  { key: 'damage_vs_raptorqueen', label: 'Damage vs Raptor Queen', sub: 'damage.raptorqueen', type: 'number' },
  { key: 'damage_vs_raptor', label: 'Damage vs Raptors', sub: 'damage.raptor', type: 'number' },
  { key: 'damage_vs_mines', label: 'Damage vs Mines', sub: 'damage.mines', type: 'number' },
  { key: 'reload', label: 'Reload (s)', sub: 'reloadtime', type: 'number' },
  { key: 'range', label: 'Range', sub: 'range', type: 'number' },
  { key: 'velocity', label: 'Velocity', sub: 'weaponvelocity', type: 'number' },
  { key: 'flighttime', label: 'Lifetime', sub: 'flighttime', type: 'number' },
  { key: 'aoe', label: 'Splash AoE', sub: 'areaofeffect', type: 'number' },
  { key: 'accuracy', label: 'Inaccuracy', sub: 'accuracy', type: 'number' },
  { key: 'sprayangle', label: 'Spray Angle', sub: 'sprayangle', type: 'number' },
  { key: 'heightmod', label: 'Height Modifier', sub: 'heightmod', type: 'number' },
  { key: 'hightrajectory', label: 'High Trajectory', sub: 'hightrajectory', type: 'text', valueType: 'number', options: ['0', '1', '2'] },
  { key: 'projectiles', label: 'Projectiles', sub: 'projectiles', type: 'number' },
  { key: 'burst', label: 'Burst Count', sub: 'burst', type: 'number' },
  { key: 'burstrate', label: 'Burst Rate', sub: 'burstrate', type: 'number' },
  { key: 'canattackground', label: 'Can Target Ground', sub: 'canattackground', type: 'boolean' },
  { key: 'stockpile', label: 'Stockpile Required', sub: 'stockpile', type: 'boolean' },
  { key: 'avoidfriendly', label: 'Avoid Friendly', sub: 'avoidfriendly', type: 'boolean' },
  { key: 'collidefriendly', label: 'Collide Friendly', sub: 'collidefriendly', type: 'boolean' },
  { key: 'interceptedbyshieldtype', label: 'Shield Intercept Mask', sub: 'interceptedbyshieldtype', type: 'number' },
  { key: 'stockpiletime', label: 'Stockpile Time (s)', sub: 'stockpiletime', type: 'number' },
  { key: 'stockpilelimit', label: 'Stockpile Limit', sub: 'customparams.stockpilelimit', type: 'number' },
  { key: 'weapontype', label: 'Projectile Class', sub: 'weapontype', type: 'text', valueType: 'string', options: ['LaserCannon', 'Cannon', 'MissileLauncher', 'EmgCannon', 'AircraftBomb', 'Flame', 'BeamLaser'] },
  { key: 'cegTag', label: 'Visual Effect / Trail', sub: 'cegTag', type: 'text', valueType: 'string', assetType: 'ceg' },
  { key: 'model', label: '3D Projectile Model', sub: 'model', type: 'text', valueType: 'string', assetType: 'projectileModel' },
  { key: 'explosiongenerator', label: 'Explosion Generator', sub: 'explosiongenerator', type: 'text', valueType: 'string', assetType: 'ceg' },
];

export const WEAPON_CORE_PARAMETERS = Object.freeze(coreParameters.map((parameter, order) => Object.freeze({
  ...parameter,
  surface: 'core',
  featured: FEATURED_KEYS.has(parameter.key),
  group: CORE_GROUPS[parameter.key] || 'Additional',
  order,
  unit: CORE_UNITS[parameter.key] || '',
})));

const editorAdvancedGroups = [
  ...SPAWNER_CARRIER_WEAPON_GROUPS,
  {
    title: 'Cluster / MIRV behavior',
    capabilities: ['bar-gadget', 'supporting-definition'],
    description: 'Release a supporting WeaponDef as submunitions. The referenced definition must exist when BAR loads.',
    params: [
      { key: 'cluster_def', label: 'Cluster Weapon Def', type: 'string' },
      { key: 'cluster_number', label: 'Cluster Projectile Count', type: 'number' },
    ],
  },
  {
    title: 'Impact & resource behavior',
    description: 'Damage falloff, projectile persistence, impulse, and per-shot costs.',
    params: [
      { key: 'edgeeffectiveness', label: 'AoE Edge Damage', type: 'number' },
      { key: 'explosionspeed', label: 'Explosion Propagation', type: 'number' },
      { key: 'camerashake', label: 'Camera Shake', type: 'number' },
      { key: 'impactonly', label: 'Direct Hit Only', type: 'tri-state' },
      { key: 'noexplode', label: 'Continue Through Impact', type: 'tri-state', danger: true },
      { key: 'burnblow', label: 'Explode at Max Range', type: 'tri-state' },
      { key: 'noselfdamage', label: 'No Self Damage', type: 'tri-state' },
      { key: 'impulsefactor', label: 'Impulse Multiplier', type: 'number' },
      { key: 'impulseboost', label: 'Impulse Boost', type: 'number' },
      { key: 'cratermult', label: 'Crater Strength', type: 'number' },
      { key: 'craterboost', label: 'Crater Boost', type: 'number' },
      { key: 'crateraoe', label: 'Crater Diameter', type: 'number' },
      { key: 'scarttl', label: 'Scar Lifetime', type: 'number' },
      { key: 'firestarter', label: 'Fire-Start Chance', type: 'number' },
      { key: 'energypershot', label: 'Energy per Shot', type: 'number' },
      { key: 'metalpershot', label: 'Metal per Shot', type: 'number' },
      { key: 'paralyzer', label: 'Paralyzer', type: 'tri-state' },
      { key: 'paralyzetime', label: 'Paralyze Time', type: 'number' },
      { key: 'mygravity', label: 'Custom Gravity', type: 'number' },
      { key: 'heightboostfactor', label: 'Terrain Range Boost', type: 'number' },
    ],
  },
  {
    title: 'Guidance & trajectory',
    description: 'Missile acceleration, tracking, arc, and flight motion.',
    params: [
      { key: 'startvelocity', label: 'Start Velocity', type: 'number' },
      { key: 'weaponacceleration', label: 'Weapon Acceleration', type: 'number' },
      { key: 'tracks', label: 'Tracks Target', type: 'tri-state' },
      { key: 'turnrate', label: 'Guidance Turn Rate', type: 'number' },
      { key: 'trajectoryheight', label: 'Missile Arc Height', type: 'number' },
      { key: 'wobble', label: 'Wobble', type: 'number' },
      { key: 'dance', label: 'Dance', type: 'number' },
      { key: 'fixedlauncher', label: 'Fixed Launcher', type: 'tri-state' },
      { key: 'weaponTimer', label: 'Vertical Ascent Time', type: 'number' },
      { key: 'windup', label: 'Salvo Windup', type: 'number' },
      { key: 'gravityaffected', label: 'Gravity Affected', type: 'tri-state' },
      { key: 'smoketrail', label: 'Smoke Trail', type: 'tri-state' },
      { key: 'waterweapon', label: 'Water Weapon', type: 'tri-state' },
      { key: 'firesubmersed', label: 'Fire Submerged', type: 'tri-state' },
      { key: 'submissile', label: 'Torpedo Can Exit Water', type: 'tri-state' },
    ],
  },
  {
    title: 'Aim, collision & bounce',
    description: 'Practical hit chance, collision rules, and ricochet behavior.',
    params: [
      { key: 'movingaccuracy', label: 'Moving Inaccuracy', type: 'number' },
      { key: 'targetmoveerror', label: 'Target Move Error', type: 'number' },
      { key: 'predictboost', label: 'Prediction Boost', type: 'number' },
      { key: 'leadlimit', label: 'Lead Limit', type: 'number' },
      { key: 'leadbonus', label: 'Experience Lead Bonus', type: 'number' },
      { key: 'targetborder', label: 'Target Border', type: 'number' },
      { key: 'cylindertargeting', label: 'Cylinder Targeting', type: 'number' },
      { key: 'tolerance', label: 'Aim Tolerance', type: 'number' },
      { key: 'firetolerance', label: 'Fire Tolerance', type: 'number' },
      { key: 'proximitypriority', label: 'Proximity Priority', type: 'number' },
      { key: 'avoidfeature', label: 'Avoid Features', type: 'tri-state' },
      { key: 'avoidground', label: 'Avoid Ground', type: 'tri-state' },
      { key: 'avoidneutral', label: 'Avoid Neutral Units', type: 'tri-state' },
      { key: 'collidefeature', label: 'Collide Features', type: 'tri-state' },
      { key: 'collideenemy', label: 'Collide Enemy Units', type: 'tri-state' },
      { key: 'collidenontarget', label: 'Collide Non-Targets', type: 'tri-state' },
      { key: 'collidecloaked', label: 'Collide Cloaked Units', type: 'tri-state' },
      { key: 'collideneutral', label: 'Collide Neutral Units', type: 'tri-state' },
      { key: 'collideground', label: 'Collide Ground', type: 'tri-state' },
      { key: 'collisionSize', label: 'Collision Size', type: 'number' },
      { key: 'groundbounce', label: 'Ground Bounce', type: 'tri-state' },
      { key: 'waterbounce', label: 'Water Bounce', type: 'tri-state' },
      { key: 'numbounce', label: 'Bounce Count', type: 'number' },
      { key: 'bounceslip', label: 'Bounce Slip', type: 'number' },
      { key: 'bouncerebound', label: 'Bounce Rebound', type: 'number' },
    ],
  },
  {
    title: 'Beam, visuals & audio',
    description: 'Weapon-type-specific beam behavior and presentation overrides.',
    params: [
      { key: 'beamtime', label: 'Beam Time', type: 'number' },
      { key: 'beamttl', label: 'Beam Linger Frames', type: 'number' },
      { key: 'beamdecay', label: 'Beam Decay', type: 'number' },
      { key: 'beamburst', label: 'Beam Burst', type: 'tri-state' },
      { key: 'largebeamlaser', label: 'Large Beam Texturing', type: 'tri-state' },
      { key: 'sweepfire', label: 'Sweep Fire', type: 'tri-state' },
      { key: 'minintensity', label: 'Minimum Damage Intensity', type: 'number' },
      { key: 'duration', label: 'Laser Duration', type: 'number' },
      { key: 'hardstop', label: 'Laser Hard Stop', type: 'tri-state' },
      { key: 'falloffrate', label: 'Laser Falloff Rate', type: 'number' },
      { key: 'thickness', label: 'Beam Thickness', type: 'number' },
      { key: 'corethickness', label: 'Core Thickness', type: 'number' },
      { key: 'laserflaresize', label: 'Laser Flare Size', type: 'number' },
      { key: 'intensity', label: 'Visual Intensity', type: 'number' },
      { key: 'rgbcolor', label: 'Primary RGB Color', type: 'string' },
      { key: 'rgbcolor2', label: 'Core RGB Color', type: 'string' },
      { key: 'explosionscar', label: 'Explosion Scar', type: 'tri-state' },
      { key: 'alwaysvisible', label: 'Always Visible', type: 'tri-state' },
      { key: 'soundstart', label: 'Fire Sound', type: 'string', assetType: 'sound' },
      { key: 'soundhit', label: 'Hit Sound', type: 'string', assetType: 'sound' },
      { key: 'soundhitwet', label: 'Water Hit Sound', type: 'string', assetType: 'sound' },
      { key: 'soundhitdry', label: 'Dry Hit Sound', type: 'string', assetType: 'sound' },
      { key: 'soundstartvolume', label: 'Fire Sound Volume', type: 'number' },
      { key: 'soundhitvolume', label: 'Hit Sound Volume', type: 'number' },
      { key: 'soundhitwetvolume', label: 'Water Hit Volume', type: 'number' },
      { key: 'soundhitdryvolume', label: 'Dry Hit Volume', type: 'number' },
      { key: 'texture1', label: 'Primary Texture', type: 'string', assetType: 'texture' },
      { key: 'texture2', label: 'Secondary Texture', type: 'string', assetType: 'texture' },
      { key: 'texture3', label: 'Tertiary Texture', type: 'string', assetType: 'texture' },
      { key: 'colormap', label: 'Projectile Color Map', type: 'string' },
      { key: 'smokecolor', label: 'Smoke Color', type: 'number' },
      { key: 'smokeperiod', label: 'Smoke Period', type: 'number' },
      { key: 'smokesize', label: 'Smoke Size', type: 'number' },
      { key: 'smoketime', label: 'Smoke Lifetime', type: 'number' },
      { key: 'castshadow', label: 'Projectile Shadow', type: 'tri-state' },
      { key: 'smoketrailcastshadow', label: 'Smoke Trail Shadow', type: 'tri-state' },
      { key: 'size', label: 'Projectile Size', type: 'number' },
      { key: 'sizedecay', label: 'Size Decay', type: 'number' },
      { key: 'sizegrowth', label: 'Size Growth', type: 'number' },
      { key: 'alphadecay', label: 'Alpha Decay', type: 'number' },
      { key: 'stages', label: 'Visual Stages', type: 'number' },
      { key: 'tilelength', label: 'Beam Tile Length', type: 'number' },
      { key: 'scrollspeed', label: 'Texture Scroll Speed', type: 'number' },
    ],
  },
  {
    title: 'Weapon mount behavior',
    description: 'Per-slot firing arc, slaving, retargeting, and leading behavior.',
    params: [
      { key: 'turret', label: 'Turreted Weapon', type: 'tri-state' },
      { key: 'slaveto', label: 'Slave to Weapon Slot', type: 'number' },
      { key: 'maindir', label: 'Primary Aim Direction', type: 'string' },
      { key: 'maxangledif', label: 'Firing Arc Width', type: 'number' },
      { key: 'weaponaimadjustpriority', label: 'Aim Adjustment Priority', type: 'number' },
      { key: 'fastautoretargeting', label: 'Fast Auto Retargeting', type: 'tri-state' },
      { key: 'fastquerypointupdate', label: 'Fast Query-Piece Update', type: 'tri-state' },
      { key: 'burstcontrolwhenoutofarc', label: 'Out-of-Arc Burst Control', type: 'number' },
      { key: 'accurateleading', label: 'Accurate Leading Iterations', type: 'number' },
    ],
  },
  {
    title: 'Dynamic damage',
    description: 'Optional range-dependent weapon damage curve.',
    params: [
      { key: 'dyndamageinverted', label: 'Invert Damage Curve', type: 'tri-state' },
      { key: 'dyndamageexp', label: 'Damage Curve Exponent', type: 'number' },
      { key: 'dyndamagemin', label: 'Minimum Dynamic Damage', type: 'number' },
      { key: 'dyndamagerange', label: 'Dynamic Damage Range', type: 'number' },
    ],
  },
  {
    title: 'Shield profile',
    description: 'Shield capacity, regeneration, interception, and repulsor behavior.',
    params: [
      { key: 'shieldrepulser', label: 'Repulsor Shield', type: 'tri-state' },
      { key: 'shieldsmart', label: 'Smart Allied Pass-Through', type: 'tri-state' },
      { key: 'shieldexterior', label: 'Exterior Shield', type: 'tri-state' },
      { key: 'shieldvisible', label: 'Shield Visible', type: 'tri-state' },
      { key: 'shieldmaxspeed', label: 'Maximum Repulse Speed', type: 'number' },
      { key: 'shieldforce', label: 'Repulse Force', type: 'number' },
      { key: 'shieldradius', label: 'Shield Radius', type: 'number' },
      { key: 'shieldpower', label: 'Shield Capacity', type: 'number' },
      { key: 'shieldstartingpower', label: 'Starting Capacity', type: 'number' },
      { key: 'shieldpowerregen', label: 'Regeneration per Second', type: 'number' },
      { key: 'shieldpowerregenenergy', label: 'Regen Energy per HP', type: 'number' },
      { key: 'shieldenergyuse', label: 'Interception Energy Use', type: 'number' },
      { key: 'shieldrechargedelay', label: 'Recharge Delay', type: 'number' },
      { key: 'shieldintercepttype', label: 'Shield Intercept Mask', type: 'number' },
    ],
  },
];

export const WEAPON_ADVANCED_GROUPS = Object.freeze(editorAdvancedGroups.map((group, groupOrder) => Object.freeze({
  ...group,
  groupOrder,
  capabilities: Object.freeze(group.capabilities || ['engine-native']),
  params: Object.freeze(group.params.map((parameter, order) => Object.freeze({
    ...parameter,
    surface: 'advanced',
    group: group.title,
    capabilities: Object.freeze(parameter.capabilities || group.capabilities || ['engine-native']),
    order,
    featured: false,
    unit: '',
  }))),
})));

export const WEAPON_SECONDARY_PARAMETERS = Object.freeze([
  {
    key: 'onlytargetcategory', label: 'Allow Targets', type: 'string', surface: 'target-mask', compileTarget: 'mount',
    description: 'The weapon can only acquire matching unit categories.',
  },
  {
    key: 'badtargetcategory', label: 'De-prioritise Targets', type: 'string', surface: 'target-mask', compileTarget: 'mount',
    description: 'Matching categories are targeted last, not blocked.',
  },
  {
    key: 'commandfire', label: 'Manual Fire Only', type: 'tri-state', surface: 'behavior',
    description: 'Responds to manual-fire orders instead of automatic attack.',
  },
  {
    key: 'interceptsolo', label: 'Exclusive Interception', type: 'tri-state', surface: 'behavior',
    description: 'Prevents other interceptors from committing to the same projectile.',
  },
  {
    key: 'coverage', label: 'Acquisition Coverage', type: 'number', surface: 'behavior',
    description: 'Radius used to search for matching projectiles.',
  },
  {
    key: 'targetable', label: 'Projectile Targetable Mask', type: 'number', surface: 'behavior',
    description: 'Which interceptor channels can acquire this projectile.',
  },
  {
    key: 'interceptor', label: 'Interceptor Weapon Mask', type: 'number', surface: 'behavior',
    description: 'Which projectile channels this weapon searches for.',
  },
].map(Object.freeze));
export const WEAPON_TARGET_MASK_PARAMETERS = Object.freeze(
  WEAPON_SECONDARY_PARAMETERS.filter(parameter => parameter.surface === 'target-mask'),
);

const compatibilityParameters = [
  { key: 'damage_vs_light', label: 'Damage vs Light', type: 'number', surface: 'compatibility' },
  { key: 'damage_vs_medium', label: 'Damage vs Medium', type: 'number', surface: 'compatibility' },
  { key: 'damage_vs_heavy', label: 'Damage vs Heavy', type: 'number', surface: 'compatibility' },
  { key: 'toairweapon', label: 'Anti-Air Only', type: 'tri-state', surface: 'compatibility' },
  {
    key: 'interceptedbyshields',
    label: 'Intercepted by Shields',
    type: 'tri-state',
    surface: 'compatibility',
    path: 'interceptedbyshieldtype',
    valueTransform: 'shield-mask',
  },
];

function getValueType(parameter) {
  if (parameter.valueType) return parameter.valueType;
  if (parameter.type === 'boolean' || parameter.type === 'tri-state') return 'boolean';
  if (parameter.type === 'string' || parameter.type === 'text') return 'string';
  return 'number';
}

function normalizeParameter(parameter) {
  const compileTarget = parameter.compileTarget
    || (LEGACY_MOUNT_PARAMS.has(parameter.key) ? 'mount' : 'weapondef');
  const valueType = parameter.valueType
    || (LEGACY_BOOLEAN_PARAMS.has(parameter.key) ? 'boolean' : null)
    || (LEGACY_STRING_PARAMS.has(parameter.key) ? 'string' : null)
    || getValueType(parameter);
  return Object.freeze({
    ...parameter,
    path: parameter.path || LEGACY_PATHS[parameter.key] || parameter.key,
    compileTarget,
    valueType,
    acceptedTypes: parameter.acceptedTypes
      || (SCALAR_LIST_KEYS.has(parameter.key) ? ['string', 'number'] : [valueType]),
  });
}

const editableParameters = [
  ...WEAPON_CORE_PARAMETERS,
  ...WEAPON_ADVANCED_GROUPS.flatMap(group => group.params),
  ...WEAPON_SECONDARY_PARAMETERS,
];

export const WEAPON_EDITABLE_PARAMETER_CATALOG = Object.freeze(editableParameters.map(normalizeParameter));
export const WEAPON_PARAMETER_CATALOG = Object.freeze([
  ...WEAPON_EDITABLE_PARAMETER_CATALOG,
  ...compatibilityParameters.map(normalizeParameter),
]);
export const WEAPON_PARAMETER_BY_KEY = new Map(
  WEAPON_PARAMETER_CATALOG.map(parameter => [parameter.key, parameter]),
);

export const WEAPON_ESSENTIAL_KEYS = new Set([
  'damage', 'reload', 'range', 'velocity', 'aoe', 'projectiles', 'burst', 'burstrate',
  'canattackground', 'toairweapon',
]);

export const WEAPON_ASSET_TYPES = Object.freeze(Object.fromEntries(
  WEAPON_EDITABLE_PARAMETER_CATALOG
    .filter(parameter => parameter.assetType)
    .map(parameter => [parameter.key, parameter.assetType]),
));

export const WEAPON_SLOT_BOOLEAN_PARAMS = new Set(
  WEAPON_PARAMETER_CATALOG
    .filter(parameter => parameter.compileTarget === 'weapondef' && parameter.valueType === 'boolean')
    .map(parameter => parameter.key),
);
export const WEAPON_SLOT_STRING_PARAMS = new Set(
  WEAPON_PARAMETER_CATALOG
    .filter(parameter => parameter.compileTarget === 'weapondef' && parameter.valueType === 'string')
    .map(parameter => parameter.key),
);
export const WEAPON_SLOT_MOUNT_PARAMS = new Set(
  WEAPON_PARAMETER_CATALOG
    .filter(parameter => parameter.compileTarget === 'mount')
    .map(parameter => parameter.key),
);
export const WEAPON_SLOT_PATHS = Object.freeze(Object.fromEntries(
  WEAPON_PARAMETER_CATALOG.map(parameter => [parameter.key, parameter.path]),
));

export function getWeaponParameterDefinition(key) {
  return WEAPON_PARAMETER_BY_KEY.get(key) || null;
}

export function getApplicableWeaponParameters(parameters, {
  showAll = false,
  hasParameter = () => false,
  includeEssential = false,
} = {}) {
  if (showAll) return parameters;
  return parameters.filter(parameter => (
    hasParameter(parameter.key)
    || (includeEssential && WEAPON_ESSENTIAL_KEYS.has(parameter.key))
  ));
}
