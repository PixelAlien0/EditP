import { useCallback, useState } from 'react';

// Extract the carrier linkage targets from a drone's compiled tweaks:
// the carrier slot to focus and the carried (drone) unit key, if any.
export function parseCarrierLinkage(compiledTweaks) {
  if (!compiledTweaks) return { targetSlot: null, linkedDrone: null };
  const slotNumber = Number(compiledTweaks.editp_carrier_slot);
  const targetSlot = Number.isFinite(slotNumber) && slotNumber > 0 ? slotNumber : null;
  const linkedDrone = Object.entries(compiledTweaks).find(([key, value]) => (
    /^weapon_slot_\d+_carried_unit$/.test(key) && value
  ))?.[1] || null;
  return { targetSlot, linkedDrone };
}

// Merge a drone's compiled tweaks onto the parent carrier unit's override
// entry; undefined values remove the corresponding key.
export function mergeCarrierTweaks(prevTweaks, parentUnitId, compiledTweaks) {
  const next = { ...prevTweaks };
  const existing = { ...(next[parentUnitId] || {}) };
  Object.entries(compiledTweaks).forEach(([key, value]) => {
    if (value === undefined) {
      delete existing[key];
    } else {
      existing[key] = value;
    }
  });
  next[parentUnitId] = existing;
  return next;
}

export function useCarrierWorkbenchController({
  setTweaks,
  setActiveWeaponSlotTab,
  showToast,
}) {
  const [showCarrierWorkbench, setShowCarrierWorkbench] = useState(false);

  const handleApplyCarrierLinkage = useCallback((parentUnitId, compiledTweaks) => {
    if (!parentUnitId || !compiledTweaks) return;
    const { targetSlot, linkedDrone } = parseCarrierLinkage(compiledTweaks);
    setTweaks(prevTweaks => mergeCarrierTweaks(prevTweaks, parentUnitId, compiledTweaks));
    if (targetSlot) {
      setActiveWeaponSlotTab(targetSlot);
    }
    showToast(`Linked carrier "${parentUnitId}" to deployed drone "${linkedDrone || 'selected unit'}".`);
  }, [setActiveWeaponSlotTab, setTweaks, showToast]);

  return {
    showCarrierWorkbench,
    setShowCarrierWorkbench,
    handleApplyCarrierLinkage,
  };
}
