import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  mergeCarrierTweaks,
  parseCarrierLinkage,
  useCarrierWorkbenchController,
} from './useCarrierWorkbenchController.js';

describe('carrier workbench controller helpers', () => {
  it('parses the carrier slot and linked drone from compiled tweaks', () => {
    const result = parseCarrierLinkage({
      editp_carrier_slot: '3',
      weapon_slot_2_carried_unit: 'armdrone',
      weapon_slot_1_damage: '50',
    });

    expect(result).toEqual({ targetSlot: 3, linkedDrone: 'armdrone' });
  });

  it('ignores missing, empty, or non-positive carrier slots', () => {
    expect(parseCarrierLinkage({})).toEqual({ targetSlot: null, linkedDrone: null });
    expect(parseCarrierLinkage({ editp_carrier_slot: '0' }))
      .toEqual({ targetSlot: null, linkedDrone: null });
    expect(parseCarrierLinkage({ editp_carrier_slot: 'not-a-number' }))
      .toEqual({ targetSlot: null, linkedDrone: null });
    expect(parseCarrierLinkage(null)).toEqual({ targetSlot: null, linkedDrone: null });
  });

  it('merges compiled tweaks onto the carrier unit without mutating input', () => {
    const prevTweaks = {
      armcarry: { weapon_slot_1_damage: '40', 'customparams.maxunits': '2' },
      otherunit: { weapon_slot_1_damage: '10' },
    };

    const next = mergeCarrierTweaks(prevTweaks, 'armcarry', {
      weapon_slot_1_damage: '55',
      editp_carrier_slot: '2',
      'customparams.maxunits': undefined,
    });

    expect(next.armcarry).toEqual({
      weapon_slot_1_damage: '55',
      editp_carrier_slot: '2',
    });
    expect(next.otherunit).toEqual({ weapon_slot_1_damage: '10' });
    expect(prevTweaks.armcarry).toEqual({
      weapon_slot_1_damage: '40',
      'customparams.maxunits': '2',
    });
  });

  it('creates the carrier tweak entry when it does not exist yet', () => {
    const next = mergeCarrierTweaks({}, 'armcarry', { editp_carrier_slot: '1' });
    expect(next).toEqual({ armcarry: { editp_carrier_slot: '1' } });
  });
});

describe('useCarrierWorkbenchController', () => {
  it('applies compiled linkage, focuses its slot, and reports the linked drone', () => {
    const showToast = vi.fn();
    const useHarness = () => {
      const [tweaks, setTweaks] = useState({ carrier: { health: '1000' } });
      const [activeSlot, setActiveSlot] = useState(1);
      const controller = useCarrierWorkbenchController({
        setTweaks,
        setActiveWeaponSlotTab: setActiveSlot,
        showToast,
      });
      return { tweaks, activeSlot, ...controller };
    };
    const view = renderHook(() => useHarness());

    act(() => view.result.current.handleApplyCarrierLinkage('carrier', {
      editp_carrier_slot: '3',
      weapon_slot_3_carried_unit: 'armdrone',
    }));

    expect(view.result.current.tweaks.carrier).toEqual({
      health: '1000',
      editp_carrier_slot: '3',
      weapon_slot_3_carried_unit: 'armdrone',
    });
    expect(view.result.current.activeSlot).toBe(3);
    expect(showToast).toHaveBeenCalledWith('Linked carrier "carrier" to deployed drone "armdrone".');
  });
});
