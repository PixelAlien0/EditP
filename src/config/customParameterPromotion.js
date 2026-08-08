export const CUSTOM_PARAMETER_PROMOTION_VERSION = 1;

export const CUSTOM_PARAMETER_PROMOTION_STAGES = Object.freeze({
  observed: Object.freeze({
    id: 'observed', rank: 0, label: 'Observed', shortLabel: 'Observed', tone: 'neutral',
    description: 'The key occurs in the pinned BAR definition snapshot. Its runtime meaning is not yet confirmed.',
  }),
  reviewed: Object.freeze({
    id: 'reviewed', rank: 1, label: 'Reviewed', shortLabel: 'Reviewed', tone: 'info',
    description: 'A maintainer has identified the key, its scope, and the likely contract that consumes it.',
  }),
  documented: Object.freeze({
    id: 'documented', rank: 2, label: 'Documented', shortLabel: 'Documented', tone: 'info',
    description: 'The registry defines its type, meaning, ownership, and safe editing guidance.',
  }),
  'editor-supported': Object.freeze({
    id: 'editor-supported', rank: 3, label: 'Editor-supported', shortLabel: 'Supported', tone: 'accent',
    description: 'The editor has a typed editing and compilation path for this contract.',
  }),
  'runtime-tested': Object.freeze({
    id: 'runtime-tested', rank: 4, label: 'Runtime-tested', shortLabel: 'Tested', tone: 'success',
    description: 'A BAR runtime-harness fixture verifies the generated raw custom-parameter value.',
  }),
});

export const CUSTOM_PARAMETER_PROMOTION_ORDER = Object.freeze([
  'observed', 'reviewed', 'documented', 'editor-supported', 'runtime-tested',
]);

// These entries are intentionally explicit. A key must not become runtime-tested merely
// because it appears in BAR data or can be written by the generic parameter editor.
export const CUSTOM_PARAMETER_RUNTIME_EVIDENCE = Object.freeze({
  carried_unit: Object.freeze(['multi-type-carrier-safety']),
  carrierdeaththroe: Object.freeze(['multi-type-carrier-safety']),
  controlradius: Object.freeze(['multi-type-carrier-safety']),
  dockingpieces: Object.freeze(['multi-type-carrier-safety']),
  droneairtime: Object.freeze(['multi-type-carrier-safety']),
  droneammo: Object.freeze(['multi-type-carrier-safety']),
  dronetype: Object.freeze(['multi-type-carrier-safety']),
  enabledocking: Object.freeze(['multi-type-carrier-safety']),
  energycost: Object.freeze(['multi-type-carrier-safety']),
  engagementrange: Object.freeze(['multi-type-carrier-safety']),
  manualdrones: Object.freeze(['multi-type-carrier-safety']),
  maxunits: Object.freeze(['multi-type-carrier-safety']),
  metalcost: Object.freeze(['multi-type-carrier-safety']),
  spawnrate: Object.freeze(['multi-type-carrier-safety']),
  startingdronecount: Object.freeze(['multi-type-carrier-safety']),
  cluster_def: Object.freeze(['spawner-cluster-interceptor']),
  cluster_number: Object.freeze(['spawner-cluster-interceptor']),
  spawn_blocked_by_shield: Object.freeze(['spawner-cluster-interceptor']),
  spawns_ceg: Object.freeze(['spawner-cluster-interceptor']),
  spawns_expire: Object.freeze(['spawner-cluster-interceptor']),
  spawns_mode: Object.freeze(['spawner-cluster-interceptor']),
  spawns_name: Object.freeze(['spawner-cluster-interceptor']),
  spawns_stun: Object.freeze(['spawner-cluster-interceptor']),
  spawns_surface: Object.freeze(['spawner-cluster-interceptor']),
  max_range_reduction: Object.freeze(['sector-fire-horizontal-spread']),
  speceffect: Object.freeze(['sector-fire-horizontal-spread', 'special-projectile-behavior-contracts']),
  spread_angle: Object.freeze(['sector-fire-horizontal-spread']),
  cegtag: Object.freeze(['special-projectile-behavior-contracts']),
  cruise_max_height: Object.freeze(['special-projectile-behavior-contracts']),
  cruise_min_height: Object.freeze(['special-projectile-behavior-contracts']),
  guidance_lost_radius: Object.freeze(['special-projectile-behavior-contracts']),
  lockon_dist: Object.freeze(['special-projectile-behavior-contracts']),
  model: Object.freeze(['special-projectile-behavior-contracts']),
  number: Object.freeze(['special-projectile-behavior-contracts']),
  speceffect_def: Object.freeze(['special-projectile-behavior-contracts']),
  splitexplosionceg: Object.freeze(['special-projectile-behavior-contracts']),
  tracking_turn_radius: Object.freeze(['special-projectile-behavior-contracts']),
  waterpenceg: Object.freeze(['special-projectile-behavior-contracts']),
});

const nextRequirement = Object.freeze({
  observed: 'Review its BAR consumer, scope, and value semantics.',
  reviewed: 'Document its type, meaning, constraints, and ownership.',
  documented: 'Add a dedicated typed editor and compiler path.',
  'editor-supported': 'Add a BAR runtime-harness fixture for its generated raw value.',
  'runtime-tested': 'Keep its fixture green when the pinned BAR snapshot changes.',
});

export function buildCustomParameterPromotion({
  observed = false,
  reviewed = false,
  documented = false,
  editorSupported = false,
  runtimeFixtureIds = [],
  evidence = [],
} = {}) {
  let stageId = 'observed';
  if (reviewed) stageId = 'reviewed';
  if (reviewed && documented) stageId = 'documented';
  if (reviewed && documented && editorSupported) stageId = 'editor-supported';
  if (reviewed && documented && editorSupported && runtimeFixtureIds.length > 0) stageId = 'runtime-tested';
  const stage = CUSTOM_PARAMETER_PROMOTION_STAGES[stageId];
  const evidenceItems = [
    ...(observed ? [{ kind: 'source', label: 'Pinned BAR source observation' }] : []),
    ...(reviewed ? [{ kind: 'review', label: 'Scope and ownership reviewed' }] : []),
    ...(documented ? [{ kind: 'documentation', label: 'Semantic contract documented' }] : []),
    ...(editorSupported ? [{ kind: 'editor', label: 'Typed editor and compiler support' }] : []),
    ...runtimeFixtureIds.map(fixtureId => ({
      kind: 'runtime', label: `Runtime fixture: ${fixtureId}`, fixtureId,
    })),
    ...evidence,
  ];

  return Object.freeze({
    ...stage,
    evidence: Object.freeze(evidenceItems.map(item => Object.freeze(item))),
    runtimeFixtureIds: Object.freeze([...runtimeFixtureIds]),
    nextRequirement: nextRequirement[stageId],
  });
}

export function getCustomParameterPromotionStage(stageId) {
  return CUSTOM_PARAMETER_PROMOTION_STAGES[stageId] || null;
}
