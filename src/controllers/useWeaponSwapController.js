import { useCallback, useEffect, useState } from 'react';
import { getFactionOfUnit } from '../utils/categories.js';

export function getWeaponClass(w) {
  const name = w.defKey.toLowerCase();
  if (name.includes('laser') || name.includes('beam') || name.includes('lightning') || name.includes('heat_ray')) return 'laser';
  if (name.includes('missile') || name.includes('rocket') || name.includes('torpedo') || name.includes('flak')) return 'missile';
  if (name.includes('cannon') || name.includes('plasma') || name.includes('gauss') || name.includes('artillery')) return 'plasma';
  if (name.includes('shield') || name.includes('repulsor') || name.includes('jammer') || name.includes('stealth')) return 'utility';
  return 'other';
}

export function getWeaponRoleLabel(w) {
  if (w.reload <= 0.15 || w.burst > 5) return 'RAPID FIRE';
  if (w.range >= 750) return 'LONG RANGE';
  if (w.aoe >= 64) return 'AREA OF EFFECT';
  if (w.projectiles > 3) return 'SHOTGUN VOLLEY';
  return 'DIRECT FIRE';
}

export function filterDonorUnits(units, swapSearchQuery, swapUnitFactionFilter, defaultsDb) {
  return units.filter(u => {
    if (u.isClone) return false;

    // Search Query Filter
    if (swapSearchQuery.trim()) {
      const q = swapSearchQuery.toLowerCase();
      if (!u.id.toLowerCase().includes(q) && !u.name.toLowerCase().includes(q)) return false;
    }

    // Faction Filter
    if (swapUnitFactionFilter !== 'all') {
      const faction = getFactionOfUnit(u.id);
      if (faction !== swapUnitFactionFilter) return false;
    }

    // Only show units that actually have weaponSlots configurations
    const defaults = defaultsDb[u.id];
    return defaults && defaults.weaponSlots && defaults.weaponSlots.length > 0;
  });
}

export function useWeaponSwapController({
  activeSwapSlotNum,
  selectedUnit,
  setClones,
  setShowSwapModal,
  showToast,
}) {
  const [swapSearchQuery, setSwapSearchQuery] = useState('');
  const [selectedSwapUnitId, setSelectedSwapUnitId] = useState(null);
  const [selectedSwapBlueprintId, setSelectedSwapBlueprintId] = useState(null);
  const [swapLibraryMode, setSwapLibraryMode] = useState('bar');
  const [swapWeaponTypeFilter, setSwapWeaponTypeFilter] = useState('all');
  const [swapUnitFactionFilter, setSwapUnitFactionFilter] = useState('all');

  // Dragging logic for Weapon Swap window
  const [swapPosition, setSwapPosition] = useState(null);
  const [isDraggingSwap, setIsDraggingSwap] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!isDraggingSwap) return;

    const handleMouseMove = (e) => {
      setSwapPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDraggingSwap(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSwap, dragOffset]);

  const closeSwapModal = useCallback(() => {
    setShowSwapModal(false);
    setSwapPosition(null);
  }, [setShowSwapModal]);

  const handleSwapHeaderMouseDown = useCallback((e) => {
    if (e.button !== 0) return;
    if (e.target.closest('button')) return;
    const modalBounds = e.currentTarget.closest('.weapon-swap-modal').getBoundingClientRect();
    setSwapPosition({ x: modalBounds.left, y: modalBounds.top });
    setIsDraggingSwap(true);
    setDragOffset({
      x: e.clientX - modalBounds.left,
      y: e.clientY - modalBounds.top
    });
  }, []);

  const handleBorrowWeapon = useCallback((w) => {
    setClones(prev => prev.map(c => {
      if (c.newId.toLowerCase() === selectedUnit.id.toLowerCase()) {
        const swaps = { ...(c.weaponSwaps || {}) };
        swaps[String(activeSwapSlotNum)] = {
          sourceUnitId: selectedSwapUnitId,
          sourceWeaponDefKey: w.defKey
        };
        return {
          ...c,
          weaponSwaps: swaps
        };
      }
      return c;
    }));
    showToast(`Equipped ${w.defKey.toUpperCase()} on Slot ${activeSwapSlotNum}!`);
    setShowSwapModal(false);
    setSwapPosition(null);
  }, [activeSwapSlotNum, selectedSwapUnitId, selectedUnit, setClones, setShowSwapModal, showToast]);

  return {
    swapSearchQuery, setSwapSearchQuery,
    selectedSwapUnitId, setSelectedSwapUnitId,
    selectedSwapBlueprintId, setSelectedSwapBlueprintId,
    swapLibraryMode, setSwapLibraryMode,
    swapWeaponTypeFilter, setSwapWeaponTypeFilter,
    swapUnitFactionFilter, setSwapUnitFactionFilter,
    swapPosition, setSwapPosition,
    closeSwapModal,
    handleSwapHeaderMouseDown,
    handleBorrowWeapon,
  };
}
