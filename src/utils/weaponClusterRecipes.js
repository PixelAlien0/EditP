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

  const supportingDefinition = {
    id: `support_recipe_${recipe.id.replaceAll('-', '_')}_${owner}`,
    ownerUnitId: owner,
    key: recipe.supportingKey,
    label: recipe.label,
    definition: {
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
      damage: {
        default: childDamage,
      },
      customparams: {
        area_onhit: 1,
      },
    },
    enabled: true,
    mode: 'replace',
    role: 'cluster-child',
    mountedSlots: [],
    dependencies: [],
    referencedBy: [`weapon slot ${slot}`],
    sourceName: 'BAR Editor recipe: Napalm Blossom',
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
