import { useEffect, useMemo, useState } from 'react';
import {
  buildEffectiveFactoryRosters,
  getBuildMenuPackSource,
} from '../data/build-menu-packs.js';
import { getFactionOfUnit } from '../utils/categories.js';
import { createProducerCatalog, PRODUCER_KIND } from '../utils/producerCatalog.js';

export function useFactoryRosterController({
  factoryRosters,
  buildMenuPacks,
  unitsDbNames,
  defaultsDb,
  buildMenuSteps,
  clones,
  allUnitsList,
  transactProject,
  setBuildMenuSteps,
}) {
  const [selectedFactoryId, setSelectedFactoryId] = useState('armlab');
  const [designerFaction, setDesignerFaction] = useState('all');
  const [producerKindFilter, setProducerKindFilter] = useState('all');
  const [availableFactionFilter, setAvailableFactionFilter] = useState('factory');
  const [availableSearchQuery, setAvailableSearchQuery] = useState('');
  const [factorySearchQuery, setFactorySearchQuery] = useState('');

  const activeFactoryRosters = useMemo(
    () => buildEffectiveFactoryRosters(factoryRosters, buildMenuPacks),
    [buildMenuPacks, factoryRosters]
  );
  const producerCatalog = useMemo(
    () => createProducerCatalog(activeFactoryRosters, unitsDbNames, defaultsDb),
    [activeFactoryRosters, defaultsDb, unitsDbNames]
  );
  const selectedProducer = useMemo(
    () => producerCatalog.find(producer => producer.id === selectedFactoryId) || null,
    [producerCatalog, selectedFactoryId]
  );
  const producerCounts = useMemo(() => ({
    all: producerCatalog.length,
    [PRODUCER_KIND.FACTORY]: producerCatalog.filter(
      producer => producer.kind === PRODUCER_KIND.FACTORY
    ).length,
    [PRODUCER_KIND.BUILDER]: producerCatalog.filter(
      producer => producer.kind === PRODUCER_KIND.BUILDER
    ).length,
  }), [producerCatalog]);
  const filteredProducers = useMemo(
    () => producerCatalog.filter(producer => {
      if (designerFaction !== 'all' && producer.faction !== designerFaction) return false;
      if (producerKindFilter !== 'all' && producer.kind !== producerKindFilter) return false;
      if (!factorySearchQuery.trim()) return true;
      const query = factorySearchQuery.toLowerCase();
      return producer.id.toLowerCase().includes(query)
        || producer.name.toLowerCase().includes(query);
    }),
    [designerFaction, factorySearchQuery, producerCatalog, producerKindFilter]
  );

  useEffect(() => {
    if (producerCatalog.length > 0 && !selectedProducer) {
      setSelectedFactoryId(producerCatalog[0].id);
    }
  }, [producerCatalog, selectedProducer]);

  const activeRosterItems = useMemo(() => {
    const defaults = activeFactoryRosters[selectedFactoryId] || [];
    const step = buildMenuSteps.find(item => item.builderId === selectedFactoryId);
    const removedSet = new Set(step ? step.remove.map(id => id.toLowerCase()) : []);
    const addedList = step ? step.add : [];
    const defaultIds = new Set(defaults.map(id => id.toLowerCase()));

    const items = defaults.map(id => ({
      id,
      name: unitsDbNames[id] || id,
      status: removedSet.has(id.toLowerCase()) ? 'removed' : 'default',
      sourcePack: getBuildMenuPackSource(selectedFactoryId, id, buildMenuPacks),
    }));

    addedList.forEach(id => {
      if (defaultIds.has(id.toLowerCase())) return;
      const cloneInfo = clones.find(clone => clone.newId.toLowerCase() === id.toLowerCase());
      items.push({
        id,
        name: cloneInfo
          ? cloneInfo.displayName || cloneInfo.newId
          : unitsDbNames[id] || id,
        status: 'added',
      });
    });

    if (step?.order?.length) {
      const orderMap = new Map(
        step.order.map((id, index) => [id.toLowerCase(), index])
      );
      items.sort((left, right) => {
        const leftIndex = orderMap.get(left.id.toLowerCase());
        const rightIndex = orderMap.get(right.id.toLowerCase());
        if (leftIndex !== undefined && rightIndex !== undefined) return leftIndex - rightIndex;
        if (leftIndex !== undefined) return -1;
        if (rightIndex !== undefined) return 1;
        return 0;
      });
    }
    return items;
  }, [
    activeFactoryRosters,
    buildMenuPacks,
    buildMenuSteps,
    clones,
    selectedFactoryId,
    unitsDbNames,
  ]);

  const availableUnitsForFactory = useMemo(() => {
    const rosterStatuses = new Map(
      activeRosterItems.map(item => [item.id.toLowerCase(), item.status])
    );
    const factoryFaction = getFactionOfUnit(selectedFactoryId);
    const query = availableSearchQuery.trim().toLowerCase();

    return allUnitsList
      .filter(unit => {
        if (availableFactionFilter === 'clone' && !unit.isClone) return false;
        if (availableFactionFilter === 'factory' && unit.faction !== factoryFaction) return false;
        if (!['all', 'factory', 'clone'].includes(availableFactionFilter)
          && unit.faction !== availableFactionFilter) return false;
        return !query
          || unit.id.toLowerCase().includes(query)
          || unit.name.toLowerCase().includes(query);
      })
      .map(unit => ({
        ...unit,
        rosterStatus: rosterStatuses.get(unit.id.toLowerCase()) || null,
      }))
      .sort((left, right) => {
        const leftRank = left.rosterStatus === 'removed' ? 1 : left.rosterStatus ? 2 : 0;
        const rightRank = right.rosterStatus === 'removed' ? 1 : right.rosterStatus ? 2 : 0;
        return leftRank - rightRank || left.name.localeCompare(right.name);
      });
  }, [
    activeRosterItems,
    allUnitsList,
    availableFactionFilter,
    availableSearchQuery,
    selectedFactoryId,
  ]);

  const factoryIsModified = factoryId => {
    const step = buildMenuSteps.find(item => item.builderId === factoryId);
    return Boolean(step && (step.add.length > 0 || step.remove.length > 0));
  };

  const handleAddUnitToFactory = (factoryId, unitId) => {
    transactProject(current => {
      const next = [...current.buildMenuSteps];
      const index = next.findIndex(step => step.builderId === factoryId);
      if (index === -1) {
        next.push({ builderId: factoryId, add: [unitId], remove: [] });
      } else {
        const step = { ...next[index] };
        step.remove = step.remove.filter(id => id.toLowerCase() !== unitId.toLowerCase());
        const defaults = activeFactoryRosters[factoryId] || [];
        const isDefault = defaults.some(id => id.toLowerCase() === unitId.toLowerCase());
        if (!isDefault && !step.add.some(id => id.toLowerCase() === unitId.toLowerCase())) {
          step.add = [...step.add, unitId];
        }
        if (step.order?.length && !step.order.some(id => id.toLowerCase() === unitId.toLowerCase())) {
          step.order = [...step.order, unitId];
        }
        next[index] = step;
      }
      const nextSteps = next.filter(
        step => step.add.length > 0 || step.remove.length > 0 || step.order?.length > 0
      );
      const nextClones = current.clones.some(
        clone => clone.newId.toLowerCase() === unitId.toLowerCase()
      )
        ? current.clones.map(clone => (
            clone.newId.toLowerCase() === unitId.toLowerCase()
              ? {
                  ...clone,
                  builderIds: [...new Set([
                    ...(clone.builderIds || []),
                    factoryId.toLowerCase(),
                  ])],
                }
              : clone
          ))
        : current.clones;
      return { buildMenuSteps: nextSteps, clones: nextClones };
    });
  };

  const handleRemoveUnitFromFactory = (factoryId, unitId) => {
    transactProject(current => {
      const next = [...current.buildMenuSteps];
      const index = next.findIndex(step => step.builderId === factoryId);
      if (index === -1) {
        next.push({ builderId: factoryId, add: [], remove: [unitId] });
      } else {
        const step = { ...next[index] };
        step.add = step.add.filter(id => id.toLowerCase() !== unitId.toLowerCase());
        const defaults = activeFactoryRosters[factoryId] || [];
        const isDefault = defaults.some(id => id.toLowerCase() === unitId.toLowerCase());
        if (isDefault && !step.remove.some(id => id.toLowerCase() === unitId.toLowerCase())) {
          step.remove = [...step.remove, unitId];
        }
        if (step.order?.length) {
          step.order = step.order.filter(id => id.toLowerCase() !== unitId.toLowerCase());
        }
        next[index] = step;
      }
      const nextSteps = next.filter(
        step => step.add.length > 0 || step.remove.length > 0 || step.order?.length > 0
      );
      const nextClones = current.clones.some(
        clone => clone.newId.toLowerCase() === unitId.toLowerCase()
      )
        ? current.clones.map(clone => (
            clone.newId.toLowerCase() === unitId.toLowerCase()
              ? {
                  ...clone,
                  builderIds: (clone.builderIds || []).filter(
                    id => id.toLowerCase() !== factoryId.toLowerCase()
                  ),
                }
              : clone
          ))
        : current.clones;
      return { buildMenuSteps: nextSteps, clones: nextClones };
    });
  };

  const handleRevertUnitInFactory = (factoryId, unitId) => {
    setBuildMenuSteps(previous => {
      const next = [...previous];
      const index = next.findIndex(step => step.builderId === factoryId);
      if (index !== -1) {
        const step = { ...next[index] };
        step.remove = step.remove.filter(id => id.toLowerCase() !== unitId.toLowerCase());
        step.add = step.add.filter(id => id.toLowerCase() !== unitId.toLowerCase());
        if (step.order?.length) {
          const defaults = activeFactoryRosters[factoryId] || [];
          const isDefault = defaults.some(id => id.toLowerCase() === unitId.toLowerCase());
          if (isDefault && !step.order.some(id => id.toLowerCase() === unitId.toLowerCase())) {
            const defaultIndex = defaults.findIndex(
              id => id.toLowerCase() === unitId.toLowerCase()
            );
            const order = [...step.order];
            order.splice(defaultIndex >= 0 ? defaultIndex : order.length, 0, unitId);
            step.order = order;
          }
        }
        next[index] = step;
      }
      return next.filter(
        step => step.add.length > 0 || step.remove.length > 0 || step.order?.length > 0
      );
    });
  };

  const handleReorderFactoryRoster = (factoryId, reorderedIds) => {
    setBuildMenuSteps(previous => {
      const next = [...previous];
      const index = next.findIndex(step => step.builderId === factoryId);
      if (index === -1) {
        next.push({ builderId: factoryId, add: [], remove: [], order: reorderedIds });
      } else {
        next[index] = { ...next[index], order: reorderedIds };
      }
      return next;
    });
  };

  return {
    activeFactoryRosters,
    producerCatalog,
    selectedProducer,
    producerCounts,
    filteredProducers,
    activeRosterItems,
    availableUnitsForFactory,
    selectedFactoryId,
    setSelectedFactoryId,
    designerFaction,
    setDesignerFaction,
    producerKindFilter,
    setProducerKindFilter,
    availableFactionFilter,
    setAvailableFactionFilter,
    availableSearchQuery,
    setAvailableSearchQuery,
    factorySearchQuery,
    setFactorySearchQuery,
    factoryIsModified,
    handleAddUnitToFactory,
    handleRemoveUnitFromFactory,
    handleRevertUnitInFactory,
    handleReorderFactoryRoster,
  };
}
