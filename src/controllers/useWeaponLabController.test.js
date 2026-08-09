import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  countBlueprintUsage,
  resolveFallbackWeaponLabSource,
  useWeaponLabController,
} from './useWeaponLabController.js';

describe('weapon lab controller helpers', () => {
  it('counts how many clone slots equip a given blueprint', () => {
    const clones = [
      {
        newId: 'clone_a',
        weaponSwaps: {
          1: { libraryWeaponId: 'bp-1' },
          2: { libraryWeaponId: 'bp-2' },
        },
      },
      { newId: 'clone_b', weaponSwaps: { 3: { libraryWeaponId: 'bp-1' } } },
      { newId: 'clone_c' },
    ];

    expect(countBlueprintUsage(clones, 'bp-1')).toBe(2);
    expect(countBlueprintUsage(clones, 'bp-2')).toBe(1);
    expect(countBlueprintUsage(clones, 'bp-missing')).toBe(0);
  });

  it('returns null when no weapon sources are available', () => {
    expect(resolveFallbackWeaponLabSource({
      selectedUnit: null,
      selectedUnitDefaults: null,
      activeWeaponSlotTab: 1,
      weaponSourceCatalog: [],
      resolveCloneRootId: id => id,
    })).toBeNull();
  });

  it('prefers the active weapon slot of the selected unit', () => {
    const slotTwo = { slot: 2, name: 'Beam' };
    const result = resolveFallbackWeaponLabSource({
      selectedUnit: { id: 'armsam', isClone: false },
      selectedUnitDefaults: { weaponSlots: [{ slot: 1, name: 'Cannon' }, slotTwo] },
      activeWeaponSlotTab: 2,
      weaponSourceCatalog: [{ sourceUnitId: 'corfast', slot: { slot: 1 } }],
      resolveCloneRootId: id => id,
    });

    expect(result).toEqual({ sourceUnitId: 'armsam', slot: slotTwo });
  });

  it('resolves clone units to their lineage root before drafting', () => {
    const result = resolveFallbackWeaponLabSource({
      selectedUnit: { id: 'my_clone', isClone: true },
      selectedUnitDefaults: { weaponSlots: [{ slot: 1 }] },
      activeWeaponSlotTab: 1,
      weaponSourceCatalog: [],
      resolveCloneRootId: () => 'armck',
    });

    expect(result).toEqual({ sourceUnitId: 'armck', slot: { slot: 1 } });
  });

  it('falls back to the first catalog source without a selected unit', () => {
    const fallbackSource = { sourceUnitId: 'corfast', slot: { slot: 3 } };
    const result = resolveFallbackWeaponLabSource({
      selectedUnit: null,
      selectedUnitDefaults: null,
      activeWeaponSlotTab: 1,
      weaponSourceCatalog: [fallbackSource],
      resolveCloneRootId: id => id,
    });

    expect(result).toEqual({
      sourceUnitId: 'corfast',
      slot: fallbackSource.slot,
    });
  });
});

describe('useWeaponLabController', () => {
  const blueprint = {
    id: 'bp-1',
    name: 'Interceptor copy',
    sourceUnitId: 'armsam',
    sourceWeaponDefKey: 'sam_missile',
  };

  function setup({ equipped = false } = {}) {
    const showToast = vi.fn();
    const useHarness = () => {
      const [weaponLibrary, setWeaponLibrary] = useState([blueprint]);
      const [clones, setClones] = useState([{
        newId: 'test_clone',
        weaponSwaps: equipped ? { 1: { libraryWeaponId: blueprint.id } } : {},
      }]);
      const transactProject = updater => {
        setClones(previous => {
          const patch = updater({ clones: previous, includeClones: false });
          return patch.clones ?? previous;
        });
      };
      const controller = useWeaponLabController({
        weaponLabEnabled: true,
        weaponLibrary,
        setWeaponLibrary,
        clones,
        transactProject,
        showToast,
        selectedUnit: { id: 'test_clone', isClone: true },
        selectedUnitDefaults: { weaponSlots: [{ slot: 1 }] },
        resolveCloneRootId: id => id,
        activeWeaponSlotTab: 1,
        allUnitsList: [],
        defaultsDb: {},
        setShowWeaponLab: vi.fn(),
        setActiveWorkspace: vi.fn(),
      });
      return { weaponLibrary, clones, ...controller };
    };
    return { view: renderHook(() => useHarness()), showToast };
  }

  it('equips a stored blueprint into the selected clone slot', () => {
    const { view, showToast } = setup();
    act(() => view.result.current.equipWeaponBlueprint(blueprint, 1));

    expect(view.result.current.clones[0].weaponSwaps['1']).toEqual({
      sourceUnitId: 'armsam',
      sourceWeaponDefKey: 'sam_missile',
      libraryWeaponId: 'bp-1',
    });
    expect(showToast).toHaveBeenCalledWith('Equipped Interceptor copy on slot 1.');
  });

  it('prevents deletion while a blueprint is equipped', () => {
    const { view, showToast } = setup({ equipped: true });
    let deleted;
    act(() => { deleted = view.result.current.deleteWeaponBlueprint('bp-1'); });

    expect(deleted).toBe(false);
    expect(view.result.current.weaponLibrary).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith(expect.stringContaining('equipped in 1 clone slot'));
  });

  it('deletes an unused blueprint from project storage', () => {
    const { view } = setup();
    let deleted;
    act(() => { deleted = view.result.current.deleteWeaponBlueprint('bp-1'); });

    expect(deleted).toBe(true);
    expect(view.result.current.weaponLibrary).toEqual([]);
  });
});
