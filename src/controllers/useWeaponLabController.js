import { useMemo, useState } from 'react';
import {
  createWeaponBlueprintDraft,
  createWeaponSourceCatalog,
  generateWeaponVfxPackLua,
  normalizeWeaponBlueprint,
} from '../utils/weaponBlueprint.js';

// Count how many clone weapon-swap slots currently equip a library blueprint.
export function countBlueprintUsage(clones, blueprintId) {
  return clones.reduce((count, clone) => (
    count + Object.values(clone.weaponSwaps || {})
      .filter(swap => swap.libraryWeaponId === blueprintId).length
  ), 0);
}

// Deterministically pick the draft source when opening the lab without a
// specific blueprint id. Returns { sourceUnitId, slot } or null when no
// BAR weapon sources exist in the current data snapshot.
export function resolveFallbackWeaponLabSource({
  selectedUnit,
  selectedUnitDefaults,
  activeWeaponSlotTab,
  weaponSourceCatalog,
  resolveCloneRootId,
}) {
  const activeSlot = selectedUnitDefaults?.weaponSlots?.find(slot => slot.slot === activeWeaponSlotTab)
    || selectedUnitDefaults?.weaponSlots?.[0];
  const fallbackSource = weaponSourceCatalog[0];
  if (!activeSlot && !fallbackSource) return null;
  const sourceUnitId = activeSlot && selectedUnit
    ? selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id
    : fallbackSource.sourceUnitId;
  return {
    sourceUnitId,
    slot: activeSlot || fallbackSource.slot,
  };
}

export function useWeaponLabController({
  weaponLabEnabled,
  weaponLibrary,
  setWeaponLibrary,
  clones,
  transactProject,
  showToast,
  selectedUnit,
  selectedUnitDefaults,
  resolveCloneRootId,
  activeWeaponSlotTab,
  allUnitsList,
  defaultsDb,
  setShowWeaponLab,
  setActiveWorkspace,
}) {
  const [weaponBlueprintDraft, setWeaponBlueprintDraft] = useState(null);

  const weaponSourceCatalog = useMemo(
    () => createWeaponSourceCatalog(allUnitsList, defaultsDb),
    [allUnitsList, defaultsDb]
  );

  const openWeaponLab = (blueprintId = null) => {
    if (!weaponLabEnabled) {
      showToast('Weapon Laboratory is temporarily unavailable.');
      return;
    }
    if (typeof blueprintId === 'string') {
      const blueprint = weaponLibrary.find(item => item.id === blueprintId);
      if (blueprint) {
        setWeaponBlueprintDraft(normalizeWeaponBlueprint(blueprint, { createId: false }));
        setShowWeaponLab(true);
        setActiveWorkspace('weapon-lab');
        return;
      }
    }
    const draftInput = resolveFallbackWeaponLabSource({
      selectedUnit,
      selectedUnitDefaults,
      activeWeaponSlotTab,
      weaponSourceCatalog,
      resolveCloneRootId,
    });
    if (!draftInput) {
      showToast('No BAR weapon sources are available in the current data snapshot.');
      return;
    }
    setWeaponBlueprintDraft(createWeaponBlueprintDraft(draftInput));
    setShowWeaponLab(true);
    setActiveWorkspace('weapon-lab');
  };

  const persistWeaponBlueprint = (draft = weaponBlueprintDraft) => {
    if (!draft?.sourceUnitId || !draft?.sourceWeaponDefKey) return null;
    const blueprint = normalizeWeaponBlueprint(draft);
    setWeaponLibrary(prev => {
      const exists = prev.some(item => item.id === blueprint.id);
      return exists ? prev.map(item => item.id === blueprint.id ? blueprint : item) : [blueprint, ...prev];
    });
    setWeaponBlueprintDraft(blueprint);
    return blueprint;
  };

  const cloneWeaponSourceToDraft = source => {
    const draft = createWeaponBlueprintDraft({
      sourceUnitId: source.sourceUnitId,
      slot: source.slot,
    });
    setWeaponBlueprintDraft(draft);
    return draft;
  };

  const equipWeaponBlueprint = (blueprint, targetSlot = activeWeaponSlotTab) => {
    if (!selectedUnit?.isClone) {
      showToast('Weapon blueprints can be equipped on custom clone units only.');
      return;
    }
    const slotNum = targetSlot || selectedUnitDefaults?.weaponSlots?.[0]?.slot;
    if (!slotNum) return;
    transactProject(current => ({
      includeClones: true,
      clones: current.clones.map(clone => {
        if (clone.newId.toLowerCase() !== selectedUnit.id.toLowerCase()) return clone;
        const weaponSwaps = { ...(clone.weaponSwaps || {}) };
        weaponSwaps[String(slotNum)] = {
          sourceUnitId: blueprint.sourceUnitId,
          sourceWeaponDefKey: blueprint.sourceWeaponDefKey,
          libraryWeaponId: blueprint.id
        };
        return { ...clone, weaponSwaps };
      }),
    }));
    showToast(`Equipped ${blueprint.name} on slot ${slotNum}.`);
  };

  const deleteWeaponBlueprint = blueprintId => {
    const usageCount = countBlueprintUsage(clones, blueprintId);
    if (usageCount > 0) {
      showToast(`This custom weapon is equipped in ${usageCount} clone slot${usageCount === 1 ? '' : 's'}. Replace or restore those slots before deleting it.`);
      return false;
    }
    setWeaponLibrary(previous => previous.filter(item => item.id !== blueprintId));
    if (weaponBlueprintDraft?.id === blueprintId) openWeaponLab();
    return true;
  };

  const handleDownloadWeaponVfxPack = (draft = null) => {
    const savedBlueprint = draft ? persistWeaponBlueprint(draft) : null;
    const exportLibrary = savedBlueprint
      ? [savedBlueprint, ...weaponLibrary.filter(item => item.id !== savedBlueprint.id)]
      : weaponLibrary;
    const enabled = exportLibrary.filter(item => item.appearance?.vfxEnabled);
    if (enabled.length === 0) {
      showToast('Enable custom VFX on at least one saved weapon blueprint first.');
      return;
    }
    const lua = generateWeaponVfxPackLua(enabled);
    const blob = new Blob([lua], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'editp_weapon_effects.lua';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast(`Exported ${enabled.length} custom weapon VFX definitions.`);
  };

  return {
    weaponBlueprintDraft,
    setWeaponBlueprintDraft,
    weaponSourceCatalog,
    openWeaponLab,
    persistWeaponBlueprint,
    cloneWeaponSourceToDraft,
    equipWeaponBlueprint,
    deleteWeaponBlueprint,
    handleDownloadWeaponVfxPack,
  };
}
