import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  filterDonorUnits,
  getWeaponClass,
  getWeaponRoleLabel,
  useWeaponSwapController,
} from './useWeaponSwapController.js';

describe('weapon swap controller helpers', () => {
  describe('getWeaponClass', () => {
    it('classifies beam-style weapons as lasers', () => {
      expect(getWeaponClass({ defKey: 'armlaser' })).toBe('laser');
      expect(getWeaponClass({ defKey: 'corbeam' })).toBe('laser');
      expect(getWeaponClass({ defKey: 'lightninggun' })).toBe('laser');
      expect(getWeaponClass({ defKey: 'heat_ray' })).toBe('laser');
    });

    it('classifies projectile salvo weapons as missiles', () => {
      expect(getWeaponClass({ defKey: 'missilelauncher' })).toBe('missile');
      expect(getWeaponClass({ defKey: 'rocketpod' })).toBe('missile');
      expect(getWeaponClass({ defKey: 'torpedolauncher' })).toBe('missile');
      expect(getWeaponClass({ defKey: 'corflak' })).toBe('missile');
    });

    it('classifies heavy kinetic weapons as plasma', () => {
      expect(getWeaponClass({ defKey: 'armcannon' })).toBe('plasma');
      expect(getWeaponClass({ defKey: 'plasmabattery' })).toBe('plasma');
      expect(getWeaponClass({ defKey: 'gaussgun' })).toBe('plasma');
      expect(getWeaponClass({ defKey: 'artillery emplacement'.replace(' ', '') })).toBe('plasma');
    });

    it('classifies defensive systems as utility', () => {
      expect(getWeaponClass({ defKey: 'shieldgenerator' })).toBe('utility');
      expect(getWeaponClass({ defKey: 'repulsorfield' })).toBe('utility');
      expect(getWeaponClass({ defKey: 'radarjammer' })).toBe('utility');
      expect(getWeaponClass({ defKey: 'stealthfield' })).toBe('utility');
    });

    it('falls back to other for unrecognized def keys', () => {
      expect(getWeaponClass({ defKey: 'armdeva' })).toBe('other');
      expect(getWeaponClass({ defKey: '' })).toBe('other');
    });

    it('matches earlier branches before later ones', () => {
      expect(getWeaponClass({ defKey: 'cannonshield' })).toBe('plasma');
      expect(getWeaponClass({ defKey: 'lasercannon' })).toBe('laser');
    });
  });

  describe('getWeaponRoleLabel', () => {
    const baseWeapon = { reload: 1, burst: 1, range: 300, aoe: 16, projectiles: 1 };

    it('labels fast reload or burst weapons as RAPID FIRE', () => {
      expect(getWeaponRoleLabel({ ...baseWeapon, reload: 0.15 })).toBe('RAPID FIRE');
      expect(getWeaponRoleLabel({ ...baseWeapon, reload: 0.1 })).toBe('RAPID FIRE');
      expect(getWeaponRoleLabel({ ...baseWeapon, burst: 6 })).toBe('RAPID FIRE');
    });

    it('labels long range weapons after the rapid fire check', () => {
      expect(getWeaponRoleLabel({ ...baseWeapon, range: 750 })).toBe('LONG RANGE');
      expect(getWeaponRoleLabel({ ...baseWeapon, range: 900 })).toBe('LONG RANGE');
    });

    it('labels large splash damage weapons as AREA OF EFFECT', () => {
      expect(getWeaponRoleLabel({ ...baseWeapon, aoe: 64 })).toBe('AREA OF EFFECT');
    });

    it('labels multi-projectile weapons as SHOTGUN VOLLEY', () => {
      expect(getWeaponRoleLabel({ ...baseWeapon, projectiles: 4 })).toBe('SHOTGUN VOLLEY');
    });

    it('defaults to DIRECT FIRE', () => {
      expect(getWeaponRoleLabel(baseWeapon)).toBe('DIRECT FIRE');
    });
  });

  describe('filterDonorUnits', () => {
    const units = [
      { id: 'armlab', name: 'Arm Bot Lab', isClone: false },
      { id: 'armfast', name: 'Farkle', isClone: false },
      { id: 'corvp', name: 'Cor Vehicle Plant', isClone: false },
      { id: 'my_clone', name: 'Cloned Unit', isClone: true },
      { id: 'leglab', name: 'Legion Lab', isClone: false },
    ];
    const defaultsDb = {
      armlab: { weaponSlots: [{ slot: 1 }] },
      armfast: { weaponSlots: [{ slot: 1 }, { slot: 2 }] },
      corvp: { weaponSlots: [{ slot: 1 }] },
      my_clone: { weaponSlots: [{ slot: 1 }] },
      // leglab intentionally has no defaults entry
    };

    it('excludes clones and units without usable weapon slots', () => {
      const result = filterDonorUnits(units, '', 'all', defaultsDb);
      expect(result.map(u => u.id)).toEqual(['armlab', 'armfast', 'corvp']);
    });

    it('excludes units whose defaults declare no weapon slots', () => {
      const withEmptySlots = [
        ...units,
        { id: 'armrad', name: 'Arm Radar', isClone: false },
      ];
      const result = filterDonorUnits(
        withEmptySlots, '', 'all', { ...defaultsDb, armrad: { weaponSlots: [] } }
      );
      expect(result.some(u => u.id === 'armrad')).toBe(false);
    });

    it('matches the search query against id and name case-insensitively', () => {
      expect(filterDonorUnits(units, 'FAST', 'all', defaultsDb).map(u => u.id)).toEqual(['armfast']);
      expect(filterDonorUnits(units, 'bot lab', 'all', defaultsDb).map(u => u.id)).toEqual(['armlab']);
      expect(filterDonorUnits(units, 'zzz', 'all', defaultsDb)).toEqual([]);
    });

    it('filters donor units by faction', () => {
      expect(filterDonorUnits(units, '', 'arm', defaultsDb).map(u => u.id)).toEqual(['armlab', 'armfast']);
      expect(filterDonorUnits(units, '', 'cor', defaultsDb).map(u => u.id)).toEqual(['corvp']);
    });

    it('combines search and faction filters', () => {
      const result = filterDonorUnits(units, 'arm', 'arm', defaultsDb);
      expect(result.map(u => u.id)).toEqual(['armlab', 'armfast']);
      expect(filterDonorUnits(units, 'arm', 'cor', defaultsDb)).toEqual([]);
    });
  });
});

describe('useWeaponSwapController', () => {
  it('commits a donor weapon to the selected clone and closes the dialog', () => {
    const showToast = vi.fn();
    const setShowSwapModal = vi.fn();
    const useHarness = () => {
      const [clones, setClones] = useState([{ newId: 'test_clone', weaponSwaps: {} }]);
      const controller = useWeaponSwapController({
        activeSwapSlotNum: 2,
        selectedUnit: { id: 'test_clone', isClone: true },
        setClones,
        setShowSwapModal,
        showToast,
      });
      return { clones, ...controller };
    };
    const view = renderHook(() => useHarness());

    act(() => view.result.current.setSelectedSwapUnitId('armrock'));
    act(() => view.result.current.handleBorrowWeapon({ defKey: 'arm_rocket' }));

    expect(view.result.current.clones[0].weaponSwaps['2']).toEqual({
      sourceUnitId: 'armrock',
      sourceWeaponDefKey: 'arm_rocket',
    });
    expect(setShowSwapModal).toHaveBeenCalledWith(false);
    expect(showToast).toHaveBeenCalledWith('Equipped ARM_ROCKET on Slot 2!');
  });

  it('resets the dragged position whenever the dialog closes', () => {
    const view = renderHook(() => useWeaponSwapController({
      activeSwapSlotNum: 1,
      selectedUnit: { id: 'test_clone', isClone: true },
      setClones: vi.fn(),
      setShowSwapModal: vi.fn(),
      showToast: vi.fn(),
    }));

    act(() => view.result.current.setSwapPosition({ x: 120, y: 80 }));
    expect(view.result.current.swapPosition).toEqual({ x: 120, y: 80 });
    act(() => view.result.current.closeSwapModal());
    expect(view.result.current.swapPosition).toBeNull();
  });
});
