import { describe, expect, it } from 'vitest';
import {
  applyWeaponClusterRecipe,
  buildWeaponClusterRecipeApplication,
  WEAPON_CLUSTER_RECIPES,
} from './weaponClusterRecipes.js';

describe('Cluster recipe library', () => {
  it('offers twelve gameplay and twelve visual-only presets', () => {
    expect(Object.keys(WEAPON_CLUSTER_RECIPES)).toEqual([
      'napalm-blossom',
      'meteor-rain',
      'emp-starburst',
      'razor-halo',
      'seismic-crown',
      'pursuit-swarm',
      'plasma-rosette',
      'thunder-web',
      'gravity-sink',
      'flak-constellation',
      'breach-needles',
      'starfire-choir',
      'blue-nova',
      'spark-veil',
      'scav-mirage',
      'aqua-prism',
      'verdant-echo',
      'crimson-petals',
      'golden-flicker',
      'acid-aurora',
      'raptor-embers',
      'black-ash',
      'dust-halo',
      'void-pulse',
    ]);
    expect(new Set(Object.values(WEAPON_CLUSTER_RECIPES).map(recipe => recipe.supportingKey)).size).toBe(24);
    expect(Object.values(WEAPON_CLUSTER_RECIPES).filter(recipe => recipe.kind === 'combat')).toHaveLength(12);
    expect(Object.values(WEAPON_CLUSTER_RECIPES).filter(recipe => recipe.kind === 'visual')).toHaveLength(12);
  });
});

describe('Napalm Blossom cluster recipe', () => {
  it('builds a BAR cluster-compatible incendiary Cannon child', () => {
    const application = buildWeaponClusterRecipeApplication({
      recipeId: 'napalm-blossom',
      ownerUnitId: 'ARMTEST',
      slotNumber: 2,
      sourceSlot: { damage: 500, aoe: 180 },
    });

    expect(application.tweakPatch).toEqual({
      weapon_slot_2_cluster_def: 'editp_napalm_blossom',
      weapon_slot_2_cluster_number: 7,
    });
    expect(application.supportingDefinition).toMatchObject({
      ownerUnitId: 'armtest',
      key: 'editp_napalm_blossom',
      mode: 'replace',
      definition: {
        weapontype: 'Cannon',
        areaofeffect: 117,
        firestarter: 100,
        damage: { default: 50 },
        customparams: { area_onhit: 1 },
      },
    });
  });

  it('updates the parent and supporting definition atomically without duplicates', () => {
    const project = {
      tweaks: { armtest: { weapon_slot_1_damage: 300 } },
      supportingWeaponDefs: [{
        id: 'keep-this-id', ownerUnitId: 'armtest', key: 'editp_napalm_blossom', definition: {},
      }],
    };
    const patch = applyWeaponClusterRecipe(project, {
      recipeId: 'napalm-blossom',
      ownerUnitId: 'armtest',
      slotNumber: 1,
      sourceSlot: { damage: 100, aoe: 80 },
    });

    expect(patch.supportingWeaponDefs).toHaveLength(1);
    expect(patch.supportingWeaponDefs[0].id).toBe('keep-this-id');
    expect(patch.supportingWeaponDefs[0].definition.damage.default).toBe(30);
    expect(patch.tweaks.armtest.weapon_slot_1_cluster_def).toBe('editp_napalm_blossom');
    expect(patch.tweaks.armtest.weapon_slot_1_cluster_number).toBe(7);
    expect(patch.includeTweaks).toBe(true);
  });
});

describe('Meteor Rain cluster recipe', () => {
  it('builds a BAR-asset-backed ballistic meteor child', () => {
    const application = buildWeaponClusterRecipeApplication({
      recipeId: 'meteor-rain',
      ownerUnitId: 'YUMIRU',
      slotNumber: 1,
      sourceSlot: { damage: 1000, aoe: 200 },
    });

    expect(application.tweakPatch).toEqual({
      weapon_slot_1_cluster_def: 'editp_meteor_rain',
      weapon_slot_1_cluster_number: 8,
    });
    expect(application.supportingDefinition).toMatchObject({
      ownerUnitId: 'yumiru',
      key: 'editp_meteor_rain',
      sourceName: 'BAR Editor recipe: Meteor Rain',
      definition: {
        weapontype: 'Cannon',
        model: 'meteor.s3o',
        mygravity: 0.32,
        areaofeffect: 110,
        explosiongenerator: 'custom:genericshellexplosion-meteor',
        cegtag: 'meteortrail',
        damage: { default: 120, commanders: 25 },
      },
    });
  });
});

describe.each([
  ['emp-starburst', 6, { weapontype: 'Cannon', paralyzer: true, paralyzetime: 6 }],
  ['razor-halo', 12, { weapontype: 'Cannon', weaponvelocity: 760, sprayangle: 1450 }],
  ['seismic-crown', 5, { weapontype: 'Cannon', impulsefactor: 1.4, cratermult: 0.8 }],
  ['pursuit-swarm', 9, { weapontype: 'MissileLauncher', tracks: true, turnrate: 42000 }],
  ['plasma-rosette', 10, { weapontype: 'Cannon', explosiongenerator: 'custom:plasmahit-medium' }],
  ['thunder-web', 7, { weapontype: 'Cannon', paralyzer: true, paralyzetime: 2.5 }],
  ['gravity-sink', 6, { weapontype: 'Cannon', impulsefactor: -1.8, impulseboost: -24 }],
  ['flak-constellation', 11, { weapontype: 'Cannon', explosiongenerator: 'custom:flak' }],
  ['breach-needles', 4, { weapontype: 'Cannon', weaponvelocity: 1800, areaofeffect: 12 }],
  ['starfire-choir', 8, { weapontype: 'MissileLauncher', cegtag: 'starfire-small' }],
])('%s cluster recipe', (recipeId, clusterCount, expectedDefinition) => {
  it('builds its distinctive compiler-safe child definition', () => {
    const application = buildWeaponClusterRecipeApplication({
      recipeId,
      ownerUnitId: 'ARMTEST',
      slotNumber: 3,
      sourceSlot: { damage: 900, aoe: 160 },
    });

    expect(application.tweakPatch[`weapon_slot_3_cluster_number`]).toBe(clusterCount);
    expect(application.tweakPatch[`weapon_slot_3_cluster_def`]).toBe(
      WEAPON_CLUSTER_RECIPES[recipeId].supportingKey
    );
    expect(application.supportingDefinition.definition).toMatchObject(expectedDefinition);
    expect(application.supportingDefinition.definition.damage.default).toBeGreaterThan(0);
  });
});

describe.each([
  ['blue-nova', 9, 'custom:laserhit-large-blue'],
  ['spark-veil', 14, 'custom:plasmahit-sparkonly'],
  ['scav-mirage', 6, 'custom:scav_mist_explosion'],
  ['aqua-prism', 8, 'custom:laserhit-large-aqua'],
  ['verdant-echo', 10, 'custom:laserhit-large-green'],
  ['crimson-petals', 12, 'custom:laserhit-medium-red'],
  ['golden-flicker', 15, 'custom:laserhit-small-yellow'],
  ['acid-aurora', 7, 'custom:acid-explosion-small'],
  ['raptor-embers', 9, 'custom:raptorspike-small-sparks-burn'],
  ['black-ash', 5, 'custom:burnblackbig'],
  ['dust-halo', 14, 'custom:dirtpoof'],
  ['void-pulse', 6, 'custom:scavmist'],
])('%s visual cluster recipe', (recipeId, clusterCount, explosiongenerator) => {
  it('produces presentation without combat or terrain effects', () => {
    const application = buildWeaponClusterRecipeApplication({
      recipeId,
      ownerUnitId: 'ARMTEST',
      slotNumber: 1,
      sourceSlot: { damage: 1200, aoe: 180 },
    });

    expect(application.tweakPatch.weapon_slot_1_cluster_number).toBe(clusterCount);
    expect(application.supportingDefinition.definition).toMatchObject({
      explosiongenerator,
      impulsefactor: 0,
      craterboost: 0,
      cratermult: 0,
      damage: { default: 0 },
    });
  });
});
