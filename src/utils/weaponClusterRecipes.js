const cleanId = value => String(value || '').trim().toLowerCase();

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const WEAPON_CLUSTER_RECIPES = Object.freeze({
  'napalm-blossom': Object.freeze({
    id: 'napalm-blossom',
    label: 'Napalm Blossom',
    supportingKey: 'editp_napalm_blossom',
    clusterCount: 7,
    description: 'Impact-fired incendiary Cannon fragments with BAR-native flame presentation and area-on-hit behavior.',
  }),
  'meteor-rain': Object.freeze({
    id: 'meteor-rain',
    label: 'Meteor Rain',
    supportingKey: 'editp_meteor_rain',
    clusterCount: 8,
    description: 'Impact-fired meteor fragments that arc outward, lose height quickly, and saturate the surrounding ground.',
  }),
  'emp-starburst': Object.freeze({
    id: 'emp-starburst',
    label: 'EMP Starburst',
    supportingKey: 'editp_emp_starburst',
    clusterCount: 6,
    description: 'A short-lived ring of paralyzing fragments that trades raw damage for a compact EMP lockdown.',
  }),
  'razor-halo': Object.freeze({
    id: 'razor-halo',
    label: 'Razor Halo',
    supportingKey: 'editp_razor_halo',
    clusterCount: 12,
    description: 'Twelve fast, low-area shrapnel rounds form a wide kinetic halo around the impact point.',
  }),
  'seismic-crown': Object.freeze({
    id: 'seismic-crown',
    label: 'Seismic Crown',
    supportingKey: 'editp_seismic_crown',
    clusterCount: 5,
    description: 'Five heavy fragments fall into a tight crown with strong terrain and impulse character.',
  }),
  'pursuit-swarm': Object.freeze({
    id: 'pursuit-swarm',
    label: 'Pursuit Swarm',
    supportingKey: 'editp_pursuit_swarm',
    clusterCount: 9,
    description: 'Guided child missiles accelerate away from the impact and continue tracking the inherited target.',
  }),
});

function buildNapalmBlossomDefinition({ recipe, childDamage, childAoe }) {
  return {
    name: `${recipe.label} fragment`,
    weapontype: 'Cannon',
    range: 360,
    reloadtime: 1,
    weaponvelocity: 360,
    areaofeffect: childAoe,
    edgeeffectiveness: 0.35,
    accuracy: 0,
    sprayangle: 0,
    gravityaffected: true,
    mygravity: 0.1,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 100,
    impulsefactor: 0.123,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:fire-explosion-small',
    cegtag: 'burnflame-xs',
    soundhitdry: 'flamhit1',
    soundhitwet: 'sizzle',
    damage: { default: childDamage },
    customparams: { area_onhit: 1 },
  };
}

function buildMeteorRainDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} fragment`,
    weapontype: 'Cannon',
    range: 520,
    reloadtime: 1,
    weaponvelocity: 245,
    areaofeffect: Math.round(clamp(parentAoe * 0.55, 64, 150)),
    edgeeffectiveness: 0.4,
    accuracy: 850,
    sprayangle: 650,
    gravityaffected: true,
    mygravity: 0.32,
    model: 'meteor.s3o',
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 70,
    impulsefactor: 0.2,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:genericshellexplosion-meteor',
    cegtag: 'meteortrail',
    soundhitdry: 'xplonuk4',
    soundhitwet: 'sizzle',
    damage: {
      default: Math.round(clamp(parentDamage * 0.12, 18, 220)),
      commanders: Math.round(clamp(parentDamage * 0.025, 5, 40)),
    },
  };
}

function buildEmpStarburstDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} pulse`,
    weapontype: 'Cannon',
    range: 400,
    reloadtime: 1,
    weaponvelocity: 520,
    areaofeffect: Math.round(clamp(parentAoe * 0.7, 56, 144)),
    edgeeffectiveness: 0.55,
    accuracy: 420,
    sprayangle: 720,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    craterboost: 0,
    cratermult: 0,
    paralyzer: true,
    paralyzetime: 6,
    explosiongenerator: 'custom:laserhit-emp',
    soundstart: 'hackshotxl3',
    soundhitwet: 'sizzle',
    damage: {
      default: Math.round(clamp(parentDamage * 0.055, 12, 100)),
    },
  };
}

function buildRazorHaloDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} shard`,
    weapontype: 'Cannon',
    range: 460,
    reloadtime: 1,
    weaponvelocity: 760,
    areaofeffect: Math.round(clamp(parentAoe * 0.25, 16, 56)),
    edgeeffectiveness: 0.15,
    accuracy: 160,
    sprayangle: 1450,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0.35,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:genericshellexplosion-tiny-aa',
    damage: {
      default: Math.round(clamp(parentDamage * 0.07, 10, 130)),
    },
  };
}

function buildSeismicCrownDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} fragment`,
    weapontype: 'Cannon',
    range: 340,
    reloadtime: 1,
    weaponvelocity: 215,
    areaofeffect: Math.round(clamp(parentAoe * 0.85, 80, 200)),
    edgeeffectiveness: 0.6,
    accuracy: 520,
    sprayangle: 760,
    gravityaffected: true,
    mygravity: 0.24,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 1.4,
    craterboost: 0.6,
    cratermult: 0.8,
    explosiongenerator: 'custom:genericshellexplosion-small',
    damage: {
      default: Math.round(clamp(parentDamage * 0.09, 20, 180)),
    },
  };
}

function buildPursuitSwarmDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} missile`,
    weapontype: 'MissileLauncher',
    range: 650,
    reloadtime: 1,
    startvelocity: 160,
    weaponacceleration: 140,
    weaponvelocity: 760,
    flighttime: 2.4,
    tracks: true,
    turnrate: 42000,
    tolerance: 10000,
    areaofeffect: Math.round(clamp(parentAoe * 0.3, 24, 64)),
    edgeeffectiveness: 0.25,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    craterboost: 0,
    cratermult: 0,
    smoketrail: true,
    smokeperiod: 4,
    smokesize: 1.4,
    smoketime: 8,
    model: 'cormissilefighter.s3o',
    cegtag: 'missiletrailfighter',
    explosiongenerator: 'custom:genericshellexplosion-tiny-air',
    soundstart: 'Rocklit3',
    soundhitdry: 'xplosml2',
    soundhitwet: 'splshbig',
    damage: {
      default: Math.round(clamp(parentDamage * 0.065, 12, 120)),
    },
  };
}

const RECIPE_BUILDERS = Object.freeze({
  'napalm-blossom': buildNapalmBlossomDefinition,
  'meteor-rain': buildMeteorRainDefinition,
  'emp-starburst': buildEmpStarburstDefinition,
  'razor-halo': buildRazorHaloDefinition,
  'seismic-crown': buildSeismicCrownDefinition,
  'pursuit-swarm': buildPursuitSwarmDefinition,
});

export function buildWeaponClusterRecipeApplication({
  recipeId,
  ownerUnitId,
  slotNumber,
  sourceSlot = {},
  unitTweaks = {},
}) {
  const recipe = WEAPON_CLUSTER_RECIPES[recipeId];
  const owner = cleanId(ownerUnitId);
  const slot = Number(slotNumber);
  if (!recipe) throw new Error(`Unknown cluster recipe: ${recipeId}`);
  if (!owner) throw new Error('A target UnitDef is required.');
  if (!Number.isInteger(slot) || slot < 1) throw new Error('A valid weapon slot is required.');

  const prefix = `weapon_slot_${slot}_`;
  const parentDamage = finiteNumber(unitTweaks[`${prefix}damage`] ?? sourceSlot.damage, 100);
  const parentAoe = finiteNumber(unitTweaks[`${prefix}aoe`] ?? sourceSlot.aoe, 96);
  const childDamage = Math.round(clamp(parentDamage * 0.1, 8, 180));
  const childAoe = Math.round(clamp(parentAoe * 0.65, 48, 120));

  const buildDefinition = RECIPE_BUILDERS[recipe.id];
  if (!buildDefinition) throw new Error(`Cluster recipe has no builder: ${recipe.id}`);
  const definition = buildDefinition({ recipe, parentDamage, parentAoe, childDamage, childAoe });

  const supportingDefinition = {
    id: `support_recipe_${recipe.id.replaceAll('-', '_')}_${owner}`,
    ownerUnitId: owner,
    key: recipe.supportingKey,
    label: recipe.label,
    definition,
    enabled: true,
    mode: 'replace',
    role: 'cluster-child',
    mountedSlots: [],
    dependencies: [],
    referencedBy: [`weapon slot ${slot}`],
    sourceName: `BAR Editor recipe: ${recipe.label}`,
  };

  return {
    recipe,
    supportingDefinition,
    tweakPatch: {
      [`${prefix}cluster_def`]: recipe.supportingKey,
      [`${prefix}cluster_number`]: recipe.clusterCount,
    },
  };
}

export function applyWeaponClusterRecipe(project, options) {
  const application = buildWeaponClusterRecipeApplication({
    ...options,
    unitTweaks: project.tweaks?.[options.ownerUnitId] || {},
  });
  const destination = `${application.supportingDefinition.ownerUnitId}:${application.supportingDefinition.key}`;
  const currentDefinitions = project.supportingWeaponDefs || [];
  const existingIndex = currentDefinitions.findIndex(definition => (
    `${cleanId(definition.ownerUnitId)}:${cleanId(definition.key)}` === destination
  ));
  const supportingWeaponDefs = [...currentDefinitions];
  if (existingIndex >= 0) {
    supportingWeaponDefs[existingIndex] = {
      ...supportingWeaponDefs[existingIndex],
      ...application.supportingDefinition,
      id: supportingWeaponDefs[existingIndex].id || application.supportingDefinition.id,
    };
  } else {
    supportingWeaponDefs.push(application.supportingDefinition);
  }

  const unitId = options.ownerUnitId;
  return {
    supportingWeaponDefs,
    tweaks: {
      ...project.tweaks,
      [unitId]: {
        ...(project.tweaks?.[unitId] || {}),
        ...application.tweakPatch,
      },
    },
    includeTweaks: true,
  };
}
