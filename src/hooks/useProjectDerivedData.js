import { useCallback, useMemo } from 'react';
import { getFactionOfUnit, getTechTierFromValue } from '../utils/categories.js';
import { getBuildPicturePreviewUrl, getUnitIconUrl } from '../utils/unitArtwork.js';

// Pure core of getCloneLineage: walks the clone chain from a unit back to its
// vanilla root, guarding against cycles. Returns the root id plus the ordered
// clone lineage (root-most clone first).
export function resolveLineage(clones, unitId) {
  const lineage = [];
  const visited = new Set();
  let currentId = String(unitId || '').trim().toLowerCase();

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const clone = clones.find(item => item.newId?.trim().toLowerCase() === currentId);
    if (!clone) break;
    lineage.unshift(clone);
    currentId = String(clone.baseId || '').trim().toLowerCase();
  }

  return { rootId: currentId, lineage };
}

export function useProjectDerivedData({
  tweaks,
  clones,
  unitDescriptions,
  defaultsDb,
  unitsDb,
  getTechTierOfUnit,
  getTagsOfUnit,
}) {
  const techTierOverrideSignature = useMemo(() => JSON.stringify(
    Object.entries(tweaks)
      .flatMap(([unitId, unitTweaks]) => (
        unitTweaks?.['customparams.techlevel'] === undefined
          ? []
          : [[unitId, unitTweaks['customparams.techlevel']]]
      ))
      .sort(([leftId], [rightId]) => leftId.localeCompare(rightId))
  ), [tweaks]);
  const techTierOverrides = useMemo(
    () => new Map(JSON.parse(techTierOverrideSignature)),
    [techTierOverrideSignature]
  );
  const getEffectiveTechTier = useCallback((unitId, baseId = unitId) => {
    const override = techTierOverrides.get(unitId);
    return override === undefined ? getTechTierOfUnit(baseId) : getTechTierFromValue(override);
  }, [getTechTierOfUnit, techTierOverrides]);

  const getCloneLineage = useCallback((unitId) => {
    return resolveLineage(clones, unitId);
  }, [clones]);

  const resolveCloneRootId = useCallback((unitId) => {
    return getCloneLineage(unitId).rootId || String(unitId || '').trim().toLowerCase();
  }, [getCloneLineage]);

  const getInheritedCloneTweaks = useCallback((unitId) => {
    const { lineage } = getCloneLineage(unitId);
    return lineage.reduce((merged, clone) => {
      const cloneId = clone.newId?.trim().toLowerCase();
      return cloneId ? { ...merged, ...(tweaks[cloneId] || {}) } : merged;
    }, {});
  }, [getCloneLineage, tweaks]);

  const getInheritedCloneWeaponSwaps = useCallback((unitId) => {
    const { lineage } = getCloneLineage(unitId);
    return lineage.reduce((merged, clone) => ({ ...merged, ...(clone.weaponSwaps || {}) }), {});
  }, [getCloneLineage]);

  const getProjectUnitIconUrl = useCallback((unitId) => {
    const editedBuildPicture = tweaks[unitId]?.buildpic;
    const editedPreview = getBuildPicturePreviewUrl(editedBuildPicture);
    if (editedPreview) return editedPreview;
    return getUnitIconUrl(resolveCloneRootId(unitId));
  }, [resolveCloneRootId, tweaks]);

  // Compile list of units (vanilla + clones)
  const allUnitsList = useMemo(() => {
    const list = Object.entries(unitsDb.names).filter(([id]) => Boolean(defaultsDb[id])).map(([id, name]) => {
      const faction = getFactionOfUnit(id);
      const techTier = getEffectiveTechTier(id);
      const tags = [...getTagsOfUnit(id).filter(tag => !/^t[1-4]$/.test(tag)), techTier];
      return {
        id,
        name,
        desc: unitDescriptions[id] ?? unitsDb.descriptions[id] ?? '',
        baseDesc: unitsDb.descriptions[id] ?? '',
        faction,
        tags,
        techTier,
        isClone: false
      };
    });

    const cloneNames = new Map(clones.map(clone => [clone.newId.trim().toLowerCase(), clone.displayName || clone.newId]));
    clones.forEach(c => {
      const rootBaseId = resolveCloneRootId(c.newId);
      const inheritedTier = getInheritedCloneTweaks(c.newId)['customparams.techlevel'];
      const techTier = inheritedTier === undefined
        ? getEffectiveTechTier(c.newId, rootBaseId)
        : getTechTierFromValue(inheritedTier);
      const parentId = c.baseId.trim().toLowerCase();
      const inheritedDescription = c.description
        ?? `Cloned from ${cloneNames.get(parentId) || unitsDb.names[parentId] || c.baseId}`;
      list.push({
        id: c.newId,
        name: c.displayName || c.newId,
        desc: unitDescriptions[c.newId] ?? inheritedDescription,
        baseDesc: inheritedDescription,
        faction: getFactionOfUnit(rootBaseId),
        tags: [...getTagsOfUnit(rootBaseId).filter(tag => !/^t[1-4]$/.test(tag)), techTier],
        techTier,
        isClone: true,
        baseId: c.baseId,
        rootBaseId
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [clones, defaultsDb, getEffectiveTechTier, getInheritedCloneTweaks, getTagsOfUnit, resolveCloneRootId, unitDescriptions, unitsDb.descriptions, unitsDb.names]);

  return {
    techTierOverrideSignature,
    techTierOverrides,
    getEffectiveTechTier,
    getCloneLineage,
    resolveCloneRootId,
    getInheritedCloneTweaks,
    getInheritedCloneWeaponSwaps,
    getProjectUnitIconUrl,
    allUnitsList,
  };
}
