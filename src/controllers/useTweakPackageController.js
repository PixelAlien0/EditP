import { useCallback, useMemo } from 'react';
import { PROJECT_STORE_DEFAULTS } from '../state/useProjectStore.js';

export function mergeSupportingWeaponDefinitions(current, incomingDefinitions) {
  const incoming = Array.isArray(incomingDefinitions)
    ? incomingDefinitions
    : [incomingDefinitions];
  const next = [...current];
  incoming.filter(Boolean).forEach(definition => {
    const destination = `${definition.ownerUnitId}:${definition.key}`.toLowerCase();
    const index = next.findIndex(
      item => `${item.ownerUnitId}:${item.key}`.toLowerCase() === destination
    );
    if (index >= 0) next[index] = { ...next[index], ...definition, enabled: true };
    else next.push({ ...definition, enabled: true });
  });
  return next;
}

export function useTweakPackageController({
  allUnitsList,
  activeFactoryRosters,
  defaultsDb,
  resolveCloneRootId,
  supportingWeaponDefs,
  setTweakModules,
  setLobbySetup,
  setSupportingWeaponDefs,
  transactProject,
  showToast,
}) {
  const knownTweakPackageUnitIds = useMemo(
    () => allUnitsList.map(unit => unit.id),
    [allUnitsList]
  );

  const handleAddTweakModules = useCallback(incomingModules => {
    setTweakModules(current => {
      const hashes = new Set(current.map(module => module.contentHash));
      const additions = incomingModules.filter(
        module => !hashes.has(module.contentHash)
      );
      return [...current, ...additions].map(
        (module, index) => ({ ...module, order: index })
      );
    });
  }, [setTweakModules]);

  const handleImportLobbyBundle = useCallback(({
    modules: incomingModules = [],
    lobbySetup: importedSetup,
  }) => {
    transactProject(current => {
      const hashes = new Set(
        current.tweakModules.map(module => module.contentHash)
      );
      const additions = incomingModules.filter(
        module => !hashes.has(module.contentHash)
      );
      return {
        tweakModules: additions.length
          ? [...current.tweakModules, ...additions].map(
              (module, index) => ({ ...module, order: index })
            )
          : current.tweakModules,
        lobbySetup: importedSetup || current.lobbySetup,
      };
    });
  }, [transactProject]);

  const handleClearLobbySetup = useCallback(() => {
    setLobbySetup(PROJECT_STORE_DEFAULTS.lobbySetup);
  }, [setLobbySetup]);

  const handleUpdateTweakModule = useCallback((moduleId, patch) => {
    setTweakModules(current => current.map(module => {
      if (module.id !== moduleId || (module.converted && patch.enabled)) {
        return module;
      }
      return { ...module, ...patch };
    }));
  }, [setTweakModules]);

  const handleRemoveTweakModule = useCallback(moduleId => {
    setTweakModules(current => current.filter(module => module.id !== moduleId));
  }, [setTweakModules]);

  const handleMoveTweakModule = useCallback((moduleId, direction) => {
    setTweakModules(current => {
      const target = current.find(module => module.id === moduleId);
      if (!target) return current;
      const lane = current
        .filter(
          module => module.kind === target.kind && module.stage === target.stage
        )
        .sort((left, right) => left.order - right.order);
      const index = lane.findIndex(module => module.id === moduleId);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= lane.length) return current;
      const leftId = lane[index].id;
      const rightId = lane[swapIndex].id;
      const leftOrder = lane[index].order;
      const rightOrder = lane[swapIndex].order;
      return current
        .map(module => {
          if (module.id === leftId) return { ...module, order: rightOrder };
          if (module.id === rightId) return { ...module, order: leftOrder };
          return module;
        })
        .sort((left, right) => left.order - right.order);
    });
  }, [setTweakModules]);

  const handleReorderTweakModules = useCallback(orderedIds => {
    setTweakModules(current => {
      const orderById = new Map(
        (orderedIds || []).map((moduleId, index) => [moduleId, index])
      );
      return current
        .map(module => orderById.has(module.id)
          ? { ...module, order: orderById.get(module.id) }
          : module)
        .sort((left, right) => left.order - right.order);
    });
  }, [setTweakModules]);

  const handleAddSupportingWeaponDefs = useCallback(incomingDefinitions => {
    setSupportingWeaponDefs(current => mergeSupportingWeaponDefinitions(
      current,
      incomingDefinitions
    ));
  }, [setSupportingWeaponDefs]);

  const handleUpdateSupportingWeaponDef = useCallback((definitionId, patch) => {
    const target = supportingWeaponDefs.find(
      definition => definition.id === definitionId
    );
    if (!target) return;
    const nextKey = typeof patch.key === 'string' ? patch.key : target.key;
    const renaming = nextKey && nextKey !== target.key;

    transactProject(current => {
      const updated = current.supportingWeaponDefs.map(definition => {
        if (definition.id === definitionId) {
          return {
            ...definition,
            ...patch,
            ...(renaming && definition.label === target.key.toUpperCase()
              ? { label: nextKey.toUpperCase() }
              : {}),
          };
        }
        if (!renaming || definition.ownerUnitId !== target.ownerUnitId) {
          return definition;
        }
        const referencesTarget = definition.definition?.customparams
          ?.cluster_def?.toLowerCase() === target.key.toLowerCase();
        return {
          ...definition,
          ...(referencesTarget
            ? {
                definition: {
                  ...definition.definition,
                  customparams: {
                    ...definition.definition.customparams,
                    cluster_def: nextKey,
                  },
                },
                dependencies: (definition.dependencies || []).map(
                  key => key.toLowerCase() === target.key.toLowerCase()
                    ? nextKey
                    : key
                ),
              }
            : {}),
          referencedBy: (definition.referencedBy || []).map(
            key => key.toLowerCase() === target.key.toLowerCase()
              ? nextKey
              : key
          ),
        };
      });
      const normalizedDefinitions = updated.map(definition => {
        const dependency = typeof definition.definition?.customparams?.cluster_def === 'string'
          ? definition.definition.customparams.cluster_def.trim().toLowerCase()
          : '';
        return {
          ...definition,
          dependencies: dependency ? [dependency] : [],
          referencedBy: updated
            .filter(candidate => (
              candidate.ownerUnitId === definition.ownerUnitId
              && candidate.definition?.customparams?.cluster_def
                ?.trim().toLowerCase() === definition.key.toLowerCase()
            ))
            .map(candidate => candidate.key),
        };
      });

      let nextTweaks = current.tweaks;
      if (renaming) {
        const ownerPatch = current.tweaks[target.ownerUnitId];
        if (!ownerPatch) {
          return { supportingWeaponDefs: normalizedDefinitions };
        }
        let changed = false;
        const updatedOwnerPatch = Object.fromEntries(
          Object.entries(ownerPatch).map(([key, value]) => {
            if (/^weapon_slot_\d+_cluster_def$/.test(key)
              && String(value).toLowerCase() === target.key.toLowerCase()) {
              changed = true;
              return [key, nextKey];
            }
            return [key, value];
          })
        );
        if (changed) {
          nextTweaks = {
            ...current.tweaks,
            [target.ownerUnitId]: updatedOwnerPatch,
          };
        }
      }
      return {
        supportingWeaponDefs: normalizedDefinitions,
        tweaks: nextTweaks,
      };
    });
  }, [supportingWeaponDefs, transactProject]);

  const handleRemoveSupportingWeaponDef = useCallback(definitionId => {
    setSupportingWeaponDefs(
      current => current.filter(definition => definition.id !== definitionId)
    );
  }, [setSupportingWeaponDefs]);

  const handleApplyTweakConversions = useCallback((module, conversions) => {
    if (!module || module.enabled || module.converted) return;
    const existingIds = new Set(
      allUnitsList.map(unit => unit.id.toLowerCase())
    );
    const safeClones = [];
    conversions.filter(item => item.type === 'clone').forEach(item => {
      if (!existingIds.has(item.baseId) || existingIds.has(item.newId)) return;
      existingIds.add(item.newId);
      safeClones.push({
        baseId: item.baseId,
        newId: item.newId,
        displayName: item.displayName || item.newId,
        customTooltip: item.description || item.displayName || item.newId,
        builderIds: [],
        addToOriginalBuilders: false,
      });
    });
    const menuConversions = conversions.filter(item => (
      item.type === 'build-add'
      || item.type === 'build-remove'
      || item.type === 'build-roster'
    ));
    const parameterConversions = conversions.filter(
      item => item.type === 'unit-parameter' && existingIds.has(item.unitId)
    );
    const importedCloneBases = new Map(
      safeClones.map(clone => [clone.newId, clone.baseId])
    );
    const weaponConversions = conversions.flatMap(item => {
      if (item.type !== 'weapon-parameter' || !existingIds.has(item.unitId)) {
        return [];
      }
      const unitInfo = allUnitsList.find(
        unit => unit.id.toLowerCase() === item.unitId
      );
      const baseId = importedCloneBases.get(item.unitId)
        || (unitInfo?.isClone ? resolveCloneRootId(item.unitId) : item.unitId);
      const resolvedSlot = Number.isInteger(Number(item.slot))
        && Number(item.slot) > 0
        ? Number(item.slot)
        : defaultsDb[baseId]?.weaponSlots?.find(
            entry => entry.defKey?.toLowerCase() === item.weaponDefKey
          )?.slot;
      return resolvedSlot
        ? [{ ...item, tweakKey: `weapon_slot_${resolvedSlot}_${item.key}` }]
        : [];
    });
    const supportingConversions = conversions
      .filter(item => (
        item.type === 'supporting-weapondef'
        && existingIds.has(item.weaponDef?.ownerUnitId)
      ))
      .map(item => item.weaponDef);
    const appliedCount = safeClones.length
      + menuConversions.length
      + parameterConversions.length
      + weaponConversions.length
      + supportingConversions.length;

    if (appliedCount === 0) {
      showToast(
        'No recognized changes could be applied. Resolve ID conflicts or inspect the module warnings.'
      );
      return;
    }

    transactProject(current => {
      const nextSteps = current.buildMenuSteps.map(step => ({
        ...step,
        add: [...(step.add || [])],
        remove: [...(step.remove || [])],
        order: [...(step.order || [])],
      }));
      menuConversions.forEach(item => {
        let step = nextSteps.find(
          entry => entry.builderId.toLowerCase() === item.builderId
        );
        if (!step) {
          step = { builderId: item.builderId, add: [], remove: [], order: [] };
          nextSteps.push(step);
        }
        if (item.type === 'build-roster') {
          const desired = [...new Set(
            (item.unitIds || []).map(id => id.toLowerCase())
          )];
          const rootBuilderId = resolveCloneRootId(item.builderId);
          const defaults = activeFactoryRosters[item.builderId]
            || activeFactoryRosters[rootBuilderId]
            || [];
          const defaultIds = defaults.map(id => id.toLowerCase());
          const desiredSet = new Set(desired);
          const defaultSet = new Set(defaultIds);
          step.add = desired.filter(id => !defaultSet.has(id));
          step.remove = defaultIds.filter(id => !desiredSet.has(id));
          step.order = desired;
        } else if (item.type === 'build-add') {
          step.remove = step.remove.filter(
            id => id.toLowerCase() !== item.unitId
          );
          if (!step.add.some(id => id.toLowerCase() === item.unitId)) {
            step.add.push(item.unitId);
          }
        } else {
          step.add = step.add.filter(id => id.toLowerCase() !== item.unitId);
          if (!step.remove.some(id => id.toLowerCase() === item.unitId)) {
            step.remove.push(item.unitId);
          }
        }
      });

      const nextTweaks = { ...current.tweaks };
      parameterConversions.forEach(item => {
        nextTweaks[item.unitId] = {
          ...(nextTweaks[item.unitId] || {}),
          [item.key]: item.value,
        };
      });
      weaponConversions.forEach(item => {
        nextTweaks[item.unitId] = {
          ...(nextTweaks[item.unitId] || {}),
          [item.tweakKey]: item.value,
        };
      });

      return {
        includeClones: safeClones.length ? true : current.includeClones,
        includeRosters: menuConversions.length ? true : current.includeRosters,
        includeTweaks: parameterConversions.length || weaponConversions.length
          ? true
          : current.includeTweaks,
        clones: safeClones.length
          ? [...current.clones, ...safeClones]
          : current.clones,
        buildMenuSteps: menuConversions.length
          ? nextSteps.filter(
              step => step.add.length || step.remove.length || step.order.length
            )
          : current.buildMenuSteps,
        tweaks: parameterConversions.length || weaponConversions.length
          ? nextTweaks
          : current.tweaks,
        supportingWeaponDefs: supportingConversions.length
          ? mergeSupportingWeaponDefinitions(
              current.supportingWeaponDefs,
              supportingConversions
            )
          : current.supportingWeaponDefs,
        tweakModules: current.tweakModules.map(
          item => item.id === module.id
            ? { ...item, converted: true, enabled: false }
            : item
        ),
      };
    });
    showToast(
      `${appliedCount} recognized change${appliedCount === 1 ? '' : 's'} applied. Source module archived.`
    );
  }, [
    activeFactoryRosters,
    allUnitsList,
    defaultsDb,
    resolveCloneRootId,
    showToast,
    transactProject,
  ]);

  return {
    knownTweakPackageUnitIds,
    handleAddTweakModules,
    handleImportLobbyBundle,
    handleClearLobbySetup,
    handleUpdateTweakModule,
    handleRemoveTweakModule,
    handleMoveTweakModule,
    handleReorderTweakModules,
    handleAddSupportingWeaponDefs,
    handleUpdateSupportingWeaponDef,
    handleRemoveSupportingWeaponDef,
    handleApplyTweakConversions,
  };
}
