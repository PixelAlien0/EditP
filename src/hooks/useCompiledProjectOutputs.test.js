import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useCompiledProjectOutputs } from './useCompiledProjectOutputs.js';

function createInput(overrides = {}) {
  return {
    tweaks: { armflash: { health: '900' } },
    allUnitsList: [{ id: 'armflash', name: 'Flash', isClone: false }],
    clones: [],
    defaultsDb: { armflash: { health: 620, weaponSlots: [] } },
    explosionProfiles: {},
    resolveCloneRootId: unitId => unitId,
    getInheritedCloneWeaponSwaps: () => ({}),
    includeTweaks: true,
    includeClones: true,
    includeRosters: true,
    includeHeader: false,
    tweakDefsLua: '',
    buildMenuSteps: [],
    disabledUnitIds: [],
    activeFactoryRosters: {},
    projectName: 'Test',
    projectAuthor: '',
    projectDesc: '',
    unitDescriptions: {},
    weaponLibrary: [],
    supportingWeaponDefs: [],
    tweakModules: [],
    base64Options: { padding: false },
    ...overrides,
  };
}

describe('useCompiledProjectOutputs', () => {
  it('derives Units Lua, Base64, and lobby slots from project state', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput()));

    expect(result.current.generatedTweakUnitsLua).toContain('armflash');
    expect(result.current.generatedTweakUnitsLua).toContain('health = 900');
    expect(result.current.tweakUnitsB64).not.toBe('');
    expect(result.current.compiledLobbyModules.units.slots).toHaveLength(1);
    expect(result.current.lobbyCommands).toContain('tweakunits1');
  });

  it('keeps Units output empty when parameter tweaks are disabled', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({ includeTweaks: false })));

    expect(result.current.generatedTweakUnitsLua).toBe('{\n}');
    expect(result.current.tweakUnitsB64).toBe('');
  });

  it('exports edited unit descriptions and localized BAR tooltips', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({
      tweaks: {},
      unitDescriptions: { armflash: 'Fast raider with a custom role.' },
    })));

    expect(result.current.generatedTweakUnitsLua).toContain('description = "Fast raider with a custom role."');
    expect(result.current.generatedTweakUnitsLua).toContain('i18n_en_tooltip = "Fast raider with a custom role."');
    expect(result.current.generatedTweakUnitsLua).toContain('i18n_de_tooltip = "Fast raider with a custom role."');
    expect(result.current.tweakUnitsB64).not.toBe('');
  });

  it('supports English-only compact export mode by omitting non-English tooltip duplicates', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({
      tweaks: {},
      unitDescriptions: { armflash: 'Fast raider with a custom role.' },
      exportEnglishOnly: true,
    })));

    expect(result.current.generatedTweakUnitsLua).toContain('description = "Fast raider with a custom role."');
    expect(result.current.generatedTweakUnitsLua).toContain('i18n_en_tooltip = "Fast raider with a custom role."');
    expect(result.current.generatedTweakUnitsLua).not.toContain('i18n_de_tooltip');
    expect(result.current.generatedTweakUnitsLua).not.toContain('i18n_zh_tooltip');
  });

  it('compiles legacy weapon fields through their canonical BAR targets', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({
      tweaks: {
        armflash: {
          weapon_slot_1_damage_vs_light: '75',
          weapon_slot_1_toairweapon: true,
          weapon_slot_1_interceptedbyshields: true,
        },
      },
      defaultsDb: {
        armflash: {
          health: 620,
          weaponSlots: [{ slot: 1, defKey: 'armflash_laser' }],
        },
      },
    })));

    expect(result.current.generatedTweakUnitsLua).toContain('light = 75');
    expect(result.current.generatedTweakUnitsLua).toContain('onlytargetcategory = "VTOL"');
    expect(result.current.generatedTweakUnitsLua).toContain('interceptedbyshieldtype = 1');
    expect(result.current.generatedTweakUnitsLua).not.toContain('toairweapon');
    expect(result.current.generatedTweakUnitsLua).not.toContain('interceptedbyshields');
  });

  it('prefers canonical weapon edits over legacy compatibility aliases', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({
      tweaks: {
        armflash: {
          weapon_slot_1_toairweapon: true,
          weapon_slot_1_onlytargetcategory: 'SURFACE',
          weapon_slot_1_interceptedbyshields: true,
          weapon_slot_1_interceptedbyshieldtype: '4',
        },
      },
      defaultsDb: {
        armflash: {
          health: 620,
          weaponSlots: [{ slot: 1, defKey: 'armflash_laser' }],
        },
      },
    })));

    expect(result.current.generatedTweakUnitsLua).toContain('onlytargetcategory = "SURFACE"');
    expect(result.current.generatedTweakUnitsLua).toContain('interceptedbyshieldtype = 4');
    expect(result.current.generatedTweakUnitsLua).not.toContain('onlytargetcategory = "VTOL"');
  });

  it('keeps Recoil shield geometry and BAR shield gadget metadata synchronized', () => {
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({
      tweaks: {
        armgate: {
          weapon_slot_1_shieldradius: '900',
          weapon_slot_1_shieldpower: '8000',
        },
      },
      allUnitsList: [{ id: 'armgate', name: 'Keeper', isClone: false }],
      defaultsDb: {
        armgate: {
          weaponSlots: [{ slot: 1, defKey: 'repulsor', shieldradius: 550, shieldpower: 6175 }],
        },
      },
    })));

    expect(result.current.generatedTweakUnitsLua).toContain('shield = {');
    expect(result.current.generatedTweakUnitsLua).toContain('radius = 900');
    expect(result.current.generatedTweakUnitsLua).toContain('power = 8000');
    expect(result.current.generatedTweakUnitsLua).toContain('shield_radius = 900');
    expect(result.current.generatedTweakUnitsLua).toContain('shield_power = 8000');
  });

  it('targets the generated WeaponDef when a saved Weapon Lab blueprint is equipped', () => {
    const blueprint = {
      id: 'weapon_madsam_copy',
      name: 'MADSAM copy',
      sourceUnitId: 'cormadsam',
      sourceWeaponDefKey: 'madsam_missile',
      sourceValues: {},
      overrides: {},
    };
    const { result } = renderHook(() => useCompiledProjectOutputs(createInput({
      tweaks: {
        allmdt2: {
          weapon_slot_1_interceptor: 2,
          weapon_slot_1_targetable: 0,
          weapon_slot_1_coverage: 500,
          weapon_slot_1_range: 500,
        },
      },
      allUnitsList: [
        { id: 'allmdt2', name: 'Missile Defense', isClone: true },
        { id: 'cormadsam', name: 'MADSAM', isClone: false },
      ],
      clones: [{
        baseId: 'legapopupdef',
        newId: 'allmdt2',
        displayName: 'Missile Defense',
        builderIds: [],
        weaponSwaps: {
          1: {
            sourceUnitId: 'cormadsam',
            sourceWeaponDefKey: 'madsam_missile',
            libraryWeaponId: blueprint.id,
          },
        },
      }],
      defaultsDb: {
        legapopupdef: { weaponSlots: [{ slot: 1, defKey: 'advanced_riot_cannon' }] },
        cormadsam: { weaponSlots: [{ slot: 1, defKey: 'madsam_missile', range: 840 }] },
      },
      resolveCloneRootId: unitId => unitId === 'allmdt2' ? 'legapopupdef' : unitId,
      getInheritedCloneWeaponSwaps: unitId => unitId === 'allmdt2'
        ? {
            1: {
              sourceUnitId: 'cormadsam',
              sourceWeaponDefKey: 'madsam_missile',
              libraryWeaponId: blueprint.id,
            },
          }
        : {},
      weaponLibrary: [blueprint],
    })));

    expect(result.current.generatedTweakDefsLua).toContain('editp_weapon_madsam_copy');
    expect(result.current.generatedTweakUnitsLua).toContain('editp_weapon_madsam_copy');
    expect(result.current.generatedTweakUnitsLua).not.toContain('madsam_missile');
    expect(result.current.generatedTweakUnitsLua).toContain('interceptor = 2');
    expect(result.current.generatedTweakUnitsLua).toContain('coverage = 500');
  });
});
