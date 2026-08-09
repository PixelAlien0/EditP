import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createUnitCollection,
  deleteCollectionAndPromoteChildren,
  getCollectionUnitIds,
} from '../project/unitCollections.js';

export function useUnitCollectionsController({
  unitCollections,
  setUnitCollections,
  allUnitsList,
  showToast,
}) {
  const [activeCollectionId, setActiveCollectionId] = useState(null);

  const activeCollection = useMemo(
    () => unitCollections.find(collection => collection.id === activeCollectionId) || null,
    [activeCollectionId, unitCollections]
  );
  const activeCollectionUnitIds = useMemo(
    () => activeCollection ? getCollectionUnitIds(unitCollections, activeCollection.id) : null,
    [activeCollection, unitCollections]
  );
  const activeCollectionUnits = useMemo(
    () => activeCollectionUnitIds ? allUnitsList.filter(unit => activeCollectionUnitIds.has(unit.id)) : allUnitsList,
    [activeCollectionUnitIds, allUnitsList]
  );

  useEffect(() => {
    if (activeCollectionId && !unitCollections.some(collection => collection.id === activeCollectionId)) {
      setActiveCollectionId(null);
    }
  }, [activeCollectionId, unitCollections]);

  const handleCreateCollection = useCallback((name, parentId = null) => {
    const siblingCount = unitCollections.filter(collection => collection.parentId === parentId).length;
    const collection = createUnitCollection(name, parentId, siblingCount);
    setUnitCollections(previous => [...previous, collection]);
    setActiveCollectionId(collection.id);
    showToast(`Created collection: ${name}`);
  }, [setUnitCollections, showToast, unitCollections]);

  const handleRenameCollection = useCallback((collectionId, name) => {
    setUnitCollections(previous => previous.map(collection => collection.id === collectionId
      ? { ...collection, name: name.trim().slice(0, 80) || collection.name }
      : collection));
    showToast(`Renamed collection to ${name}`);
  }, [setUnitCollections, showToast]);

  const handleDeleteCollection = useCallback((collectionId) => {
    const collection = unitCollections.find(item => item.id === collectionId);
    setUnitCollections(previous => deleteCollectionAndPromoteChildren(previous, collectionId));
    if (activeCollectionId === collectionId) setActiveCollectionId(collection?.parentId || null);
    showToast(`Deleted collection${collection ? `: ${collection.name}` : ''}; units were not changed`);
  }, [activeCollectionId, setUnitCollections, showToast, unitCollections]);

  const handleToggleCollectionMembership = useCallback((collectionId, unitId) => {
    if (!unitId) return;
    setUnitCollections(previous => previous.map(collection => {
      if (collection.id !== collectionId) return collection;
      const isMember = collection.unitIds.includes(unitId);
      return {
        ...collection,
        unitIds: isMember
          ? collection.unitIds.filter(id => id !== unitId)
          : [...collection.unitIds, unitId],
      };
    }));
  }, [setUnitCollections]);

  const handleCleanupCollection = useCallback((_collectionId, unresolvedIds) => {
    const unresolved = new Set(unresolvedIds);
    setUnitCollections(previous => previous.map(collection => ({
      ...collection,
      unitIds: collection.unitIds.filter(unitId => !unresolved.has(unitId)),
    })));
    showToast(`Removed ${unresolved.size} unresolved collection ${unresolved.size === 1 ? 'reference' : 'references'}`);
  }, [setUnitCollections, showToast]);

  return {
    activeCollectionId,
    setActiveCollectionId,
    activeCollection,
    activeCollectionUnitIds,
    activeCollectionUnits,
    handleCreateCollection,
    handleRenameCollection,
    handleDeleteCollection,
    handleToggleCollectionMembership,
    handleCleanupCollection,
  };
}
