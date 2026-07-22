import { describe, expect, it } from 'vitest';
import {
  compileTweakDefsLua,
  generateDeathProfilesBlockLua,
  generateSupportingWeaponDefsBlockLua,
  generateBuildMenuBlockLua,
  generateClonesBlockLua,
  sortClonesDependency,
  traceAncestor
} from './tweakdefsHelper.js';

const nestedClones = [
  { baseId: 'armflash_clone', newId: 'armflash_clone_2', displayName: 'Child', builderIds: [] },
  { baseId: 'armflash', newId: 'armflash_clone', displayName: 'Parent', builderIds: [] }
];

describe('nested clone generation', () => {
  it('resolves ancestors case-insensitively', () => {
    expect(traceAncestor('ARMFLASH_CLONE_2', nestedClones)).toBe('armflash');
  });

  it('emits parents before dependent children', () => {
    expect(sortClonesDependency(nestedClones).map(clone => clone.newId)).toEqual([
      'armflash_clone',
      'armflash_clone_2'
    ]);
    const lua = generateClonesBlockLua(nestedClones);
    expect(lua.indexOf('local n = "armflash_clone"')).toBeLessThan(lua.indexOf('local n = "armflash_clone_2"'));
    expect(lua).toContain('UnitDefs[n] = clone_copy(UnitDefs[s])');
    expect(lua).not.toContain('UnitDefs[n] = table.copy(UnitDefs[s])');
  });

  it('compiles clone and build-menu blocks into generated Lua', () => {
    const lua = compileTweakDefsLua({
      currentTweakDefsLua: 'return {}',
      customUnitClones: nestedClones,
      buildMenuWizardSteps: [{ builderId: 'armlab', add: ['armflash_clone_2'], remove: [] }],
      disabledUnitIds: [],
      unitBuildOptions: {},
      compileFlags: { includeClones: true, includeRosters: true },
    });
    expect(lua).toContain('armflash_clone_2');
    expect(lua).toContain('armlab');
    expect(lua).not.toContain('BMF');
    expect(lua).not.toContain('CLONE_UNITS_BEGIN');
    expect(generateBuildMenuBlockLua([{ builderId: 'armlab', add: ['armflash'], remove: [] }]))
      .toContain('armflash');
  });

  it('does not emit orphaned build-menu references when clone definitions are excluded', () => {
    const lua = compileTweakDefsLua({
      currentTweakDefsLua: '',
      customUnitClones: [{ baseId: 'armfig', newId: 'ggggg', displayName: 'Test clone', builderIds: ['armap'] }],
      buildMenuWizardSteps: [{ builderId: 'armap', add: ['ggggg'], remove: [] }],
      disabledUnitIds: [],
      unitBuildOptions: {},
      compileFlags: { includeClones: false, includeRosters: true },
    });

    expect(lua).not.toContain('local n = "ggggg"');
    expect(lua).not.toContain('"ggggg"');
  });

  it('creates isolated death explosion profiles without mutating the shared BAR definition', () => {
    const profile = generateDeathProfilesBlockLua([{
      unitId: 'armfus',
      explodeAs: 'fusionExplosion',
      selfDestructAs: 'fusionExplosionSelfd',
      sources: {
        death: {
          definition: {
            areaofeffect: 480,
            camerashake: 480,
            impulsefactor: 0.123,
            explosiongenerator: 'custom:fusexpl',
            damage: { commanders: 1560, default: 2650 },
          },
        },
        selfd: {
          definition: {
            areaofeffect: 768,
            camerashake: 768,
            impulsefactor: 0.123,
            explosiongenerator: 'custom:fusexpl',
            damage: { commanders: 2450, default: 8300 },
          },
        },
      },
      death: { damage: 4000, aoe: 600 },
      selfd: { damage: 9000, camerashake: 900 },
    }]);
    expect(profile).toContain('unit.weapondefs[profile_name] = profile');
    expect(profile).not.toContain('WeaponDefs');
    expect(profile).toContain('explosiongenerator = "custom:fusexpl"');
    expect(profile).toContain('profile_name = "editp_" .. kind');
    expect(profile).toContain('editp_death_profile("armfus", "death", editp_profiles["fusionexplosion"]');
    expect(profile).toContain('damage =4000');
    expect(profile).toContain('aoe =600');
    expect(profile).toContain('fusionexplosionselfd');
  });

  it('compiles supporting WeaponDefs into their owner after clone creation', () => {
    const supportingWeaponDefs = [{
      id: 'support_cluster', ownerUnitId: 'armflash_clone', key: 'cluster_child', enabled: true,
      mode: 'replace', definition: { range: 360, damage: { default: 44 }, customparams: { cluster_number: 3 } },
    }];
    const block = generateSupportingWeaponDefsBlockLua(supportingWeaponDefs);
    expect(block).toContain('owner = "armflash_clone"');
    expect(block).toContain('key = "cluster_child"');
    expect(block).toContain('damage = {');
    expect(block).toContain('unit.weapondefs[entry.key] = table.copy(entry.definition)');

    const lua = compileTweakDefsLua({
      currentTweakDefsLua: '',
      customUnitClones: [{ baseId: 'armflash', newId: 'armflash_clone', displayName: 'Parent', builderIds: [] }],
      buildMenuWizardSteps: [], disabledUnitIds: [], unitBuildOptions: {},
      compileFlags: { includeClones: true, includeRosters: true }, supportingWeaponDefs,
    });
    expect(lua.indexOf('local n = "armflash_clone"')).toBeLessThan(lua.indexOf('editp_supporting_weapondefs'));
  });
});
