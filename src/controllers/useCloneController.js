import { useState } from 'react';

export function applyCloneBuilderAssignments(steps, cloneId, builderIds) {
  const normalizedCloneId = cloneId.trim().toLowerCase();
  const desiredBuilders = new Set(
    builderIds.map(id => id.trim().toLowerCase()).filter(Boolean)
  );
  const next = steps.map(step => ({
    ...step,
    add: step.add.filter(id => id.toLowerCase() !== normalizedCloneId),
    ...(Array.isArray(step.order)
      ? {
          order: step.order.filter(
            id => id.toLowerCase() !== normalizedCloneId
          ),
        }
      : {}),
  }));

  desiredBuilders.forEach(builderId => {
    const index = next.findIndex(
      step => step.builderId.toLowerCase() === builderId
    );
    if (index === -1) {
      next.push({ builderId, add: [normalizedCloneId], remove: [] });
      return;
    }
    next[index] = {
      ...next[index],
      remove: next[index].remove.filter(
        id => id.toLowerCase() !== normalizedCloneId
      ),
      add: [...new Set([...next[index].add, normalizedCloneId])],
      ...(Array.isArray(next[index].order)
        ? { order: [...next[index].order, normalizedCloneId] }
        : {}),
    };
  });

  return next.filter(
    step => step.add.length > 0 || step.remove.length > 0 || step.order?.length > 0
  );
}

export function useCloneController({
  clones,
  tweaks,
  allUnitsList,
  activeFactoryRosters,
  buildMenuSteps,
  activeCollection,
  selectedUnitId,
  getCloneLineage,
  getInheritedCloneWeaponSwaps,
  transactProject,
  setSelectedUnitId,
  showToast,
}) {
  const [cloneBaseId, setCloneBaseId] = useState('');
  const [cloneNewId, setCloneNewId] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneDesc, setCloneDesc] = useState('');
  const [cloneBuilders, setCloneBuilders] = useState([]);
  const [cloneAutoAssignBuilders, setCloneAutoAssignBuilders] = useState(false);
  const [showClonePanel, setShowClonePanel] = useState(false);

  const resetCloneDraft = () => {
    setCloneBaseId('');
    setCloneNewId('');
    setCloneName('');
    setCloneDesc('');
    setCloneBuilders([]);
    setCloneAutoAssignBuilders(false);
  };

  const handleCloneBuildersChange = (cloneId, builderIds) => {
    const normalized = [...new Set(
      builderIds.map(id => id.trim().toLowerCase()).filter(Boolean)
    )];
    transactProject(current => ({
      includeClones: true,
      includeRosters: normalized.length > 0 ? true : current.includeRosters,
      clones: current.clones.map(clone => (
        clone.newId.toLowerCase() === cloneId.toLowerCase()
          ? { ...clone, builderIds: normalized }
          : clone
      )),
      buildMenuSteps: applyCloneBuilderAssignments(
        current.buildMenuSteps,
        cloneId,
        normalized
      ),
    }));
  };

  const getAutomaticCloneBuilders = unitId => {
    const targetId = unitId.trim().toLowerCase();
    const builders = new Set(
      Object.entries(activeFactoryRosters)
        .filter(([, roster]) => (
          Array.isArray(roster)
          && roster.some(id => id.toLowerCase() === targetId)
        ))
        .map(([factoryId]) => factoryId.toLowerCase())
    );

    buildMenuSteps.forEach(step => {
      const builderId = step.builderId.trim().toLowerCase();
      if ((step.remove || []).some(id => id.toLowerCase() === targetId)) {
        builders.delete(builderId);
      }
      if ((step.add || []).some(id => id.toLowerCase() === targetId)) {
        builders.add(builderId);
      }
    });

    return [...builders];
  };

  const handleCreateClone = event => {
    event.preventDefault();
    const cleanBase = cloneBaseId.trim().toLowerCase();
    const cleanNew = cloneNewId.trim().toLowerCase();
    const cleanName = cloneName.trim();

    if (!cleanBase || !cleanNew) {
      showToast('Error: Base and New ID are required');
      return;
    }
    if (allUnitsList.some(unit => unit.id === cleanNew)) {
      showToast('Error: Unit ID already exists');
      return;
    }

    const cleanBuilders = cloneBuilders
      .map(builder => builder.trim().toLowerCase())
      .filter(Boolean);
    const parentClone = clones.find(
      clone => clone.newId.trim().toLowerCase() === cleanBase
    );
    const { rootId, lineage } = getCloneLineage(cleanBase);
    const inheritedTweaks = lineage.reduce((merged, clone) => {
      const cloneId = clone.newId?.trim().toLowerCase();
      return cloneId ? { ...merged, ...(tweaks[cloneId] || {}) } : merged;
    }, { ...(tweaks[rootId] || {}) });
    const inheritedWeaponSwaps = parentClone
      ? getInheritedCloneWeaponSwaps(cleanBase)
      : {};

    const newClone = {
      baseId: rootId || cleanBase,
      newId: cleanNew,
      displayName: cleanName || cleanNew,
      description: cloneDesc.trim() || undefined,
      builderIds: cleanBuilders,
      addToOriginalBuilders: true,
      ...(Object.keys(inheritedWeaponSwaps).length > 0
        ? {
            weaponSwaps: Object.fromEntries(
              Object.entries(inheritedWeaponSwaps).map(
                ([slot, swap]) => [slot, { ...swap }]
              )
            ),
          }
        : {}),
    };

    transactProject(current => ({
      includeClones: true,
      includeTweaks: Object.keys(inheritedTweaks).length > 0
        ? true
        : current.includeTweaks,
      includeRosters: newClone.builderIds.length > 0
        ? true
        : current.includeRosters,
      clones: [...current.clones, newClone],
      unitCollections: activeCollection
        ? current.unitCollections.map(collection => (
            collection.id === activeCollection.id
              && !collection.unitIds.includes(cleanNew)
              ? { ...collection, unitIds: [...collection.unitIds, cleanNew] }
              : collection
          ))
        : current.unitCollections,
      tweaks: Object.keys(inheritedTweaks).length > 0
        ? { ...current.tweaks, [cleanNew]: { ...inheritedTweaks } }
        : current.tweaks,
      buildMenuSteps: applyCloneBuilderAssignments(
        current.buildMenuSteps,
        cleanNew,
        newClone.builderIds
      ),
    }));
    setSelectedUnitId(cleanNew);
    setShowClonePanel(false);
    showToast(
      `Created clone: ${cleanNew}${activeCollection ? ` in ${activeCollection.name}` : ''}`
    );
    resetCloneDraft();
  };

  const handleQuickCreateCloneFromWorkbench = ({ baseId, newId, name }) => {
    const cleanBase = baseId.trim().toLowerCase();
    const cleanNew = newId.trim().toLowerCase();
    const cleanName = name.trim();
    if (!cleanBase || !cleanNew || allUnitsList.some(unit => unit.id === cleanNew)) {
      return;
    }

    const baseUnit = allUnitsList.find(unit => unit.id === cleanBase);
    transactProject(current => ({
      includeClones: true,
      clones: [
        ...current.clones,
        {
          baseId: cleanBase,
          newId: cleanNew,
          displayName: cleanName || cleanNew,
          faction: baseUnit?.faction || 'all',
          builderIds: [],
        },
      ],
    }));
    setSelectedUnitId(cleanNew);
    showToast(`Created custom drone clone "${cleanName || cleanNew}".`);
  };

  const handleDeleteSummaryClone = clone => {
    const cloneId = clone.newId.toLowerCase();
    const promotedDescendants = clones
      .filter(candidate => candidate.newId.toLowerCase() !== cloneId)
      .map(candidate => {
        const { rootId, lineage } = getCloneLineage(candidate.newId);
        const dependsOnDeletedClone = lineage.some(
          item => item.newId?.toLowerCase() === cloneId
        );
        if (!dependsOnDeletedClone) return null;
        const inheritedTweaks = lineage.reduce((merged, ancestor) => {
          const ancestorId = ancestor.newId?.toLowerCase();
          return ancestorId
            ? { ...merged, ...(tweaks[ancestorId] || {}) }
            : merged;
        }, { ...(tweaks[rootId] || {}) });
        return {
          id: candidate.newId.toLowerCase(),
          rootId: rootId || clone.baseId,
          tweaks: inheritedTweaks,
          weaponSwaps: getInheritedCloneWeaponSwaps(candidate.newId),
        };
      })
      .filter(Boolean);
    const promotedById = new Map(
      promotedDescendants.map(item => [item.id, item])
    );

    transactProject(current => {
      const nextClones = current.clones
        .filter(item => item.newId.toLowerCase() !== cloneId)
        .map(item => {
          const promoted = promotedById.get(item.newId.toLowerCase());
          if (!promoted) return item;
          const rebased = { ...item, baseId: promoted.rootId };
          if (Object.keys(promoted.weaponSwaps).length > 0) {
            rebased.weaponSwaps = promoted.weaponSwaps;
          } else {
            delete rebased.weaponSwaps;
          }
          return rebased;
        });
      const nextTweaks = Object.fromEntries(
        Object.entries(current.tweaks).filter(
          ([id]) => id.toLowerCase() !== cloneId
        )
      );
      promotedDescendants.forEach(promoted => {
        nextTweaks[promoted.id] = { ...promoted.tweaks };
      });
      return {
        clones: nextClones,
        tweaks: nextTweaks,
        unitDescriptions: Object.fromEntries(
          Object.entries(current.unitDescriptions).filter(
            ([id]) => id.toLowerCase() !== cloneId
          )
        ),
        buildMenuSteps: applyCloneBuilderAssignments(
          current.buildMenuSteps,
          clone.newId,
          []
        ),
      };
    });
    if (selectedUnitId?.toLowerCase() === cloneId) {
      setSelectedUnitId(clone.baseId);
    }
    showToast(
      `Deleted clone ${clone.newId}${promotedDescendants.length
        ? `; preserved ${promotedDescendants.length} descendant${promotedDescendants.length === 1 ? '' : 's'}`
        : ''}`
    );
  };

  const handleDeleteAllSummaryClones = () => {
    const cloneIds = new Set(clones.map(clone => clone.newId.toLowerCase()));
    const selectedClone = clones.find(
      clone => clone.newId.toLowerCase() === selectedUnitId?.toLowerCase()
    );
    transactProject(current => ({
      clones: [],
      tweaks: Object.fromEntries(
        Object.entries(current.tweaks).filter(
          ([id]) => !cloneIds.has(id.toLowerCase())
        )
      ),
      unitDescriptions: Object.fromEntries(
        Object.entries(current.unitDescriptions).filter(
          ([id]) => !cloneIds.has(id.toLowerCase())
        )
      ),
      buildMenuSteps: clones.reduce(
        (steps, clone) => applyCloneBuilderAssignments(steps, clone.newId, []),
        current.buildMenuSteps
      ),
    }));
    if (selectedClone) setSelectedUnitId(selectedClone.baseId);
    showToast('Deleted all custom clones');
  };

  return {
    cloneBaseId,
    setCloneBaseId,
    cloneNewId,
    setCloneNewId,
    cloneName,
    setCloneName,
    cloneDesc,
    setCloneDesc,
    cloneBuilders,
    setCloneBuilders,
    cloneAutoAssignBuilders,
    setCloneAutoAssignBuilders,
    showClonePanel,
    setShowClonePanel,
    handleCloneBuildersChange,
    getAutomaticCloneBuilders,
    handleCreateClone,
    handleQuickCreateCloneFromWorkbench,
    handleDeleteSummaryClone,
    handleDeleteAllSummaryClones,
  };
}
