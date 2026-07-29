const behaviorDefinitions = [
  {
    id: 'sector_fire',
    label: 'Sector fire',
    summary: 'Horizontal ground-sector scatter',
    description: 'Rotates projectile velocity across a horizontal sector and varies shot depth. Best used with ordinary accuracy and spray set to zero.',
    parameterKeys: ['spread_angle', 'max_range_reduction'],
    requiredParameterKeys: ['spread_angle', 'max_range_reduction'],
  },
  {
    id: 'cruise',
    label: 'Cruise guidance',
    summary: 'Terrain-following flight',
    description: 'Maintains minimum and maximum terrain clearance until the projectile reaches its final lock-on distance. Intended for non-homing projectiles.',
    parameterKeys: ['cruise_min_height', 'cruise_max_height', 'lockon_dist'],
    requiredParameterKeys: ['cruise_min_height', 'cruise_max_height', 'lockon_dist'],
  },
  {
    id: 'retarget',
    label: 'Retarget on loss',
    summary: 'Recover from a destroyed target',
    description: 'Redirects the projectile to the firing unit primary weapon target when its original unit target is destroyed.',
    parameterKeys: [],
    requiredParameterKeys: [],
  },
  {
    id: 'guidance',
    label: 'Primary-weapon guidance',
    summary: 'Follow the primary weapon target',
    description: 'Continuously follows the target selected by weapon slot 1. BAR expects the primary weapon to be continuously or burst firing.',
    parameterKeys: ['guidance_lost_radius'],
    requiredParameterKeys: ['guidance_lost_radius'],
  },
  {
    id: 'split',
    label: 'Apex split',
    summary: 'Divide into submunitions',
    description: 'Replaces a falling parent projectile with a randomized group of projectiles from another WeaponDef.',
    parameterKeys: [
      'speceffect_def',
      'speceffect_number',
      'splitexplosionceg',
      'speceffect_cegtag',
      'speceffect_model',
    ],
    requiredParameterKeys: ['speceffect_def', 'speceffect_number'],
  },
  {
    id: 'cannonwaterpen',
    label: 'Cannon water penetration',
    summary: 'Transition into an underwater shell',
    description: 'Replaces a cannon at the water surface with a slower underwater projectile from another WeaponDef.',
    parameterKeys: ['speceffect_def', 'waterpenceg', 'speceffect_cegtag', 'speceffect_model'],
    requiredParameterKeys: ['speceffect_def'],
  },
  {
    id: 'torpwaterpen',
    label: 'Torpedo water correction',
    summary: 'Controlled underwater dive',
    description: 'Corrects a tracking torpedo vertical velocity after entering water so it approaches shallow or close targets more reliably.',
    parameterKeys: ['tracking_turn_radius'],
    requiredParameterKeys: ['tracking_turn_radius'],
  },
];

export const SPECIAL_PROJECTILE_BEHAVIORS = Object.freeze(
  behaviorDefinitions.map(behavior => Object.freeze({
    ...behavior,
    parameterKeys: Object.freeze(behavior.parameterKeys),
    requiredParameterKeys: Object.freeze(behavior.requiredParameterKeys),
  })),
);

export const SPECIAL_PROJECTILE_BEHAVIOR_IDS = Object.freeze(
  SPECIAL_PROJECTILE_BEHAVIORS.map(behavior => behavior.id),
);

export const SPECIAL_PROJECTILE_PARAMETERS = Object.freeze([
  {
    key: 'speceffect',
    label: 'Behavior mode',
    type: 'string',
    valueType: 'string',
    options: ['', ...SPECIAL_PROJECTILE_BEHAVIOR_IDS],
    optionLabels: Object.freeze(Object.fromEntries([
      ['', 'Inherited / standard'],
      ...SPECIAL_PROJECTILE_BEHAVIORS.map(behavior => [behavior.id, behavior.label]),
    ])),
    alwaysRelevant: true,
  },
  {
    key: 'spread_angle',
    label: 'Horizontal sector angle (deg)',
    type: 'number',
    valueType: 'number',
    min: 0.1,
    max: 360,
    step: 0.5,
    behaviors: ['sector_fire'],
    alwaysRelevant: true,
  },
  {
    key: 'max_range_reduction',
    label: 'Sector depth (0-1)',
    type: 'number',
    valueType: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    behaviors: ['sector_fire'],
    alwaysRelevant: true,
  },
  {
    key: 'cruise_min_height',
    label: 'Minimum ground clearance',
    type: 'number',
    valueType: 'number',
    min: 0,
    step: 1,
    path: 'customparams.cruise_min_height',
    behaviors: ['cruise'],
    alwaysRelevant: true,
  },
  {
    key: 'cruise_max_height',
    label: 'Maximum ground clearance',
    type: 'number',
    valueType: 'number',
    min: 0,
    step: 1,
    path: 'customparams.cruise_max_height',
    behaviors: ['cruise'],
    alwaysRelevant: true,
  },
  {
    key: 'lockon_dist',
    label: 'Final lock-on distance',
    type: 'number',
    valueType: 'number',
    min: 0,
    step: 1,
    path: 'customparams.lockon_dist',
    behaviors: ['cruise'],
    alwaysRelevant: true,
  },
  {
    key: 'guidance_lost_radius',
    label: 'Lost-target scatter radius',
    type: 'number',
    valueType: 'number',
    min: 0,
    step: 1,
    path: 'customparams.guidance_lost_radius',
    behaviors: ['guidance'],
    alwaysRelevant: true,
  },
  {
    key: 'speceffect_def',
    label: 'Child WeaponDef',
    type: 'string',
    valueType: 'string',
    path: 'customparams.speceffect_def',
    behaviors: ['split', 'cannonwaterpen'],
    capabilities: ['bar-gadget', 'supporting-definition'],
    alwaysRelevant: true,
  },
  {
    key: 'speceffect_number',
    label: 'Submunition count',
    type: 'number',
    valueType: 'number',
    min: 1,
    step: 1,
    path: 'customparams.number',
    behaviors: ['split'],
    alwaysRelevant: true,
  },
  {
    key: 'splitexplosionceg',
    label: 'Split transition CEG',
    type: 'string',
    valueType: 'string',
    path: 'customparams.splitexplosionceg',
    assetType: 'ceg',
    behaviors: ['split'],
    alwaysRelevant: true,
  },
  {
    key: 'waterpenceg',
    label: 'Water-entry CEG',
    type: 'string',
    valueType: 'string',
    path: 'customparams.waterpenceg',
    assetType: 'ceg',
    behaviors: ['cannonwaterpen'],
    alwaysRelevant: true,
  },
  {
    key: 'speceffect_cegtag',
    label: 'Child projectile trail',
    type: 'string',
    valueType: 'string',
    path: 'customparams.cegtag',
    assetType: 'ceg',
    behaviors: ['split', 'cannonwaterpen'],
    alwaysRelevant: true,
  },
  {
    key: 'speceffect_model',
    label: 'Child projectile model',
    type: 'string',
    valueType: 'string',
    path: 'customparams.model',
    assetType: 'projectileModel',
    behaviors: ['split', 'cannonwaterpen'],
    alwaysRelevant: true,
  },
  {
    key: 'tracking_turn_radius',
    label: 'Tracking turn radius',
    type: 'number',
    valueType: 'number',
    min: 0.1,
    step: 1,
    path: 'customparams.tracking_turn_radius',
    behaviors: ['torpwaterpen'],
    alwaysRelevant: true,
  },
].map(parameter => Object.freeze({
  ...parameter,
  behaviors: parameter.behaviors ? Object.freeze(parameter.behaviors) : undefined,
})));

export const SPECIAL_PROJECTILE_PARAMETER_KEYS = Object.freeze(
  SPECIAL_PROJECTILE_PARAMETERS
    .map(parameter => parameter.key)
    .filter(key => key !== 'speceffect'),
);

const behaviorById = new Map(
  SPECIAL_PROJECTILE_BEHAVIORS.map(behavior => [behavior.id, behavior]),
);

export function getSpecialProjectileBehavior(id) {
  return behaviorById.get(String(id || '').trim().toLowerCase()) || null;
}

export function isSupportedSpecialProjectileBehavior(id) {
  return behaviorById.has(String(id || '').trim().toLowerCase());
}

export function getSpecialProjectileParameters(id) {
  const normalizedId = String(id || '').trim().toLowerCase();
  return SPECIAL_PROJECTILE_PARAMETERS.filter(parameter => (
    parameter.key === 'speceffect'
    || parameter.behaviors?.includes(normalizedId)
  ));
}
