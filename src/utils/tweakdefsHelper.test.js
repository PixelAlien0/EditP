import { describe, expect, it } from 'vitest';
import {
  compileTweakDefsLua,
  generateDeathProfilesBlockLua,
  generateSupportingWeaponDefsBlockLua,
  generateCarrierLinkagesBlockLua,
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

  it('targets one carrier controller WeaponDef without rewriting every weapon or child UnitDef', () => {
    const lua = generateCarrierLinkagesBlockLua({
      armdronecarry: {
        editp_carrier_weapondef: 'plasma',
        'customparams.carried_unit': 'armdrone',
        'customparams.spawns_name': 'armdrone corvamp',
        'customparams.maxunits': '8',
        'customparams.startingdronecount': '2',
        'customparams.droneammo': '6',
        'customparams.spawnrate': '4',
        'customparams.metalcost': '25',
        'customparams.energycost': '600',
        'customparams.enabledocking': true,
        'customparams.manualdrones': true,
        'customparams.docktohealthreshold': 65,
        'customparams.carrierdeaththroe': 'release',
        'customparams.spawns_surface': 'SEA',
      },
    });

    expect(lua).toContain('editp_find_carrier_weapondef(u, entry.targetWeaponDef)');
    expect(lua).toContain('wDef.customparams.carried_unit = table.concat(entry.allChildren, " ")');
    expect(lua).toContain('wDef.customparams.docktohealthreshold = entry.dockToHealThreshold');
    expect(lua).toContain('wDef.customparams.manualdrones = entry.manualDrones and "1" or nil');
    expect(lua).toContain('wDef.customparams.droneairtime = entry.droneAirTime and tostring(entry.droneAirTime) or nil');
    expect(lua).not.toContain('wDef.stockpile = true');
    expect(lua).not.toContain('for _, wDef in pairs(u.weapondefs)');
    expect(lua).not.toContain('wDef.coverage');
    expect(lua).not.toContain('childDef.canselect');
    expect(lua).not.toContain('customparams.is_controllable');
    expect(lua).not.toContain('customparams.spawns_name =');
  });

  it('does not duplicate canonical weapon-slot carrier edits in Definitions Lua', () => {
    const lua = generateCarrierLinkagesBlockLua({
      armdronecarry: {
        editp_carrier_slot: '1',
        editp_carrier_weapondef: 'plasma',
        weapon_slot_1_carried_unit: 'armdrone',
        weapon_slot_1_maxunits: '12',
        weapon_slot_1_spawnrate: '3',
      },
    });

    expect(lua).toBe('');
  });

  it('compiles equivalent project state to byte-identical Definitions Lua', () => {
    const cloneA = {
      baseId: 'armflash',
      newId: 'zeta_clone',
      displayName: 'Zeta',
      builderIds: ['armlab'],
      weaponSwaps: {
        2: { sourceUnitId: 'corak', sourceWeaponDefKey: 'laser' },
        1: { sourceUnitId: 'armflash', sourceWeaponDefKey: 'laser' },
      },
    };
    const cloneB = {
      baseId: 'corak',
      newId: 'alpha_clone',
      displayName: 'Alpha',
      builderIds: ['corlab'],
    };
    const deathA = {
      unitId: 'zeta_clone',
      explodeAs: 'mediumexplosiongeneric',
      death: { damage: 300, aoe: 120 },
    };
    const deathB = {
      unitId: 'alpha_clone',
      explodeAs: 'smallexplosiongeneric',
      death: { damage: 100, aoe: 48 },
    };
    const supportA = {
      ownerUnitId: 'zeta_clone',
      key: 'child_weapon',
      definition: { range: 300 },
      mountedSlots: [2, 1],
    };
    const supportB = {
      ownerUnitId: 'alpha_clone',
      key: 'child_weapon',
      definition: { range: 200 },
      mountedSlots: [1],
    };
    const shared = {
      disabledUnitIds: [],
      unitBuildOptions: {},
      projectMeta: { name: 'Stable Project', author: 'Tester', desc: 'Repeatable output' },
      compileFlags: { includeClones: true, includeRosters: true },
      weaponLibrary: [],
    };
    const first = compileTweakDefsLua({
      ...shared,
      currentTweakDefsLua: '\uFEFFlocal retained = true\r\n',
      customUnitClones: [cloneA, cloneB],
      buildMenuWizardSteps: [
        { builderId: 'corlab', add: ['alpha_clone'], remove: [] },
        { builderId: 'armlab', add: ['zeta_clone'], remove: [] },
      ],
      deathExplosionTweaks: [deathA, deathB],
      supportingWeaponDefs: [supportA, supportB],
      tweaks: {
        zeta_clone: { weapon_slot_2_range: 500, weapon_slot_1_damage: 70 },
        alpha_clone: { weapon_slot_1_range: 250 },
      },
    });
    const second = compileTweakDefsLua({
      ...shared,
      currentTweakDefsLua: 'local retained = true\n',
      customUnitClones: [cloneB, cloneA],
      buildMenuWizardSteps: [
        { builderId: 'armlab', add: ['zeta_clone'], remove: [] },
        { builderId: 'corlab', add: ['alpha_clone'], remove: [] },
      ],
      deathExplosionTweaks: [deathB, deathA],
      supportingWeaponDefs: [supportB, supportA],
      tweaks: {
        alpha_clone: { weapon_slot_1_range: 250 },
        zeta_clone: { weapon_slot_1_damage: 70, weapon_slot_2_range: 500 },
      },
    });

    expect(first).toBe(second);
    expect(first).toContain('-- Generated with BAR Editor');
    expect(first).not.toMatch(/Generated with BAR Editor on \d{4}-\d{2}-\d{2}/);
  });
});
