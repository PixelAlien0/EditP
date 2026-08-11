import { describe, expect, it } from 'vitest';
import {
  createWeaponBlueprintDraft,
  createWeaponSourceCatalog,
  generateWeaponVfxPackLua,
  getWeaponBlueprintEffectiveValues,
  getWeaponBlueprintMetrics,
  normalizeWeaponBlueprint,
  validateWeaponBlueprint,
} from './weaponBlueprint.js';
import { generateWeaponBlueprintOverridesLua } from './tweakdefsHelper.js';

describe('weapon blueprints', () => {
  it('creates a reusable draft from the active weapon slot', () => {
    const draft = createWeaponBlueprintDraft({
      sourceUnitId: 'armflash',
      slot: { defKey: 'plasma', damage: 100, reload: 2, range: 500, cegTag: 'laser' },
    });
    expect(draft.sourceWeaponDefKey).toBe('plasma');
    expect(draft.sourceValues).toMatchObject({ damage: 100, reload: 2, range: 500, cegTag: 'laser' });
    expect(draft.overrides).toEqual({});
  });

  it('captures the canonical advanced weapon fields without marking the source as edited', () => {
    const draft = createWeaponBlueprintDraft({
      sourceUnitId: 'armmercury',
      slot: {
        defKey: 'aamissile',
        damage: 800,
        interceptor: 2,
        coverage: 1200,
        tracks: true,
        turnrate: 48000,
        soundstart: 'rockhvy1',
        onlytargetcategory: 'VTOL',
        speceffect: 'cruise',
        cruise_min_height: 80,
      },
    });
    expect(draft.sourceValues).toMatchObject({
      interceptor: 2,
      coverage: 1200,
      tracks: true,
      turnrate: 48000,
      soundstart: 'rockhvy1',
      onlytargetcategory: 'VTOL',
      speceffect: 'cruise',
      cruise_min_height: 80,
    });
    expect(getWeaponBlueprintEffectiveValues(draft).damage).toBe(800);
  });

  it('builds a deterministic source catalog without duplicate mounts', () => {
    const catalog = createWeaponSourceCatalog([
      { id: 'armflash', name: 'Flash' },
      { id: 'armflash_clone', name: 'Flash Clone', isClone: true },
      { id: 'corak', name: 'Grunt' },
    ], {
      armflash: {
        weaponSlots: [
          { slot: 1, defKey: 'plasma', damage: 100 },
          { slot: 2, defKey: 'plasma', damage: 100 },
        ],
      },
      corak: { weaponSlots: [{ slot: 1, defKey: 'laser', damage: 40 }] },
    });
    expect(catalog.map(item => item.id)).toEqual(['corak:laser', 'armflash:plasma']);
    expect(catalog[1].slot.damage).toBe(100);
  });

  it('uses BAR EditP names for generated CEG bindings', () => {
    const blueprint = normalizeWeaponBlueprint({
      id: 'rose-cannon',
      name: 'Rose Cannon',
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'plasma',
      appearance: { vfxEnabled: true },
      overrides: {},
    });
    expect(blueprint.overrides.cegTag).toBe('editp_rose_cannon_trail');
    expect(blueprint.overrides.explosiongenerator).toBe('custom:editp_rose_cannon_impact');
    expect(generateWeaponVfxPackLua([blueprint])).toContain('["editp_rose_cannon_trail"]');
    expect(generateWeaponVfxPackLua([blueprint])).not.toContain('bmf_');
  });

  it('calculates practical weapon output and rejects invalid counts', () => {
    expect(getWeaponBlueprintMetrics({ overrides: { damage: 100, reload: 2, burst: 3, projectiles: 2 } }).dps).toBe(300);
    expect(validateWeaponBlueprint({
      name: 'Broken',
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'plasma',
      overrides: { projectiles: 0, burst: 1 },
    })).toContainEqual(expect.objectContaining({ field: 'projectiles' }));
  });

  it('preserves and compiles tweak-defined armor damage profiles', () => {
    const blueprint = normalizeWeaponBlueprint({
      id: 'space_laser',
      name: 'Space Laser',
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'laser',
      overrides: { damage_profile__space: 1500 },
    });
    expect(blueprint.overrides.damage_profile__space).toBe(1500);
    expect(generateWeaponBlueprintOverridesLua(blueprint, 'editp_space_laser', 1).join('\n'))
      .toContain('w.damage.space = 1500');
  });
});
