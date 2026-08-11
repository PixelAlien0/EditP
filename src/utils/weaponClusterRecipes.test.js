import { describe, expect, it } from 'vitest';
import {
  applyWeaponClusterRecipe,
  buildWeaponClusterRecipeApplication,
} from './weaponClusterRecipes.js';

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
