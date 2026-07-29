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
    expect(result.current.tweakUnitsB64).not.toBe('');
  });
});
