import { useCallback, useMemo, useState } from 'react';
import {
  analyzeProjectIntegrity,
  repairProjectIntegrity,
} from '../utils/projectIntegrityDoctor.js';

// Pure patch builders for the unit reset workflows. They capture the exact
// deterministic patch shapes applied through the project store so undo-critical
// resets can be unit tested without rendering the application.
export function buildUnitResetPatch(project, unitId) {
  const next = { ...project.tweaks };
  delete next[unitId];
  return {
    tweaks: next,
    disabledUnitIds: project.disabledUnitIds.filter(id => id !== unitId),
  };
}

export function buildSummaryUnitResetPatch(project, unitId) {
  return {
    tweaks: Object.fromEntries(Object.entries(project.tweaks).filter(([id]) => id.toLowerCase() !== unitId.toLowerCase())),
    unitDescriptions: Object.fromEntries(Object.entries(project.unitDescriptions).filter(([id]) => id.toLowerCase() !== unitId.toLowerCase())),
  };
}

export function buildUnitEditsResetPatch() {
  return { tweaks: {}, unitDescriptions: {} };
}

export function buildRosterRevertPatch() {
  return {
    buildMenuSteps: [],
    buildMenuPacks: { extraUnits: false, scavengerUnits: false },
    supportingWeaponDefs: [],
  };
}

export function buildFullProjectResetPatch() {
  return {
    tweaks: {},
    unitDescriptions: {},
    clones: [],
    disabledUnitIds: [],
    buildMenuSteps: [],
    buildMenuPacks: { extraUnits: false, scavengerUnits: false },
  };
}

export function useUnitEditActionsController({
  transactProject,
  setBuildMenuSteps,
  setBuildMenuPacks,
  setDisabledUnitIds,
  clones,
  selectedUnit,
  selectedUnitId,
  setSelectedUnitId,
  setActiveRelationshipKey,
  showToast,
  projectStore,
  allUnitsList,
  activeFactoryRosters,
  defaultsDb,
  resolveCloneRootId,
}) {
  // Summary Explorer states
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeSummaryTab, setActiveSummaryTab] = useState('tweaks');

  // Apply related edits as one project transaction so compound controls do not
  // create a history entry for every individual field.
  const handleStatPatch = useCallback((unitId, patch) => {
    transactProject(current => {
      const isClone = current.clones.some(
        clone => clone.newId.toLowerCase() === unitId.toLowerCase()
      );
      const unitTweaks = { ...current.tweaks[unitId] };
      Object.entries(patch).forEach(([statKey, value]) => {
        if (value === '' || value === undefined) delete unitTweaks[statKey];
        else unitTweaks[statKey] = value;
      });

      const next = { ...current.tweaks };
      if (Object.keys(unitTweaks).length === 0) {
        delete next[unitId];
      } else {
        next[unitId] = unitTweaks;
      }
      return {
        tweaks: next,
        includeClones: isClone ? true : current.includeClones,
        includeTweaks: isClone ? true : current.includeTweaks,
      };
    });
  }, [transactProject]);

  // Update one tweaked stat value.
  const handleStatChange = useCallback((unitId, statKey, value) => {
    handleStatPatch(unitId, { [statKey]: value });
  }, [handleStatPatch]);

  // Reset tweaks
  const handleResetUnit = useCallback((unitId) => {
    transactProject(current => buildUnitResetPatch(current, unitId));
    showToast(`Reset stats for ${unitId}`);
  }, [showToast, transactProject]);

  const handleResetSummaryUnitEdits = useCallback((unitId) => {
    transactProject(current => buildSummaryUnitResetPatch(current, unitId));
    showToast(`Reset all edits for ${unitId}`);
  }, [showToast, transactProject]);

  const handleResetAllSummaryUnitEdits = useCallback(() => {
    transactProject(buildUnitEditsResetPatch());
    setActiveRelationshipKey(null);
    showToast('Reset all unit edits');
  }, [setActiveRelationshipKey, showToast, transactProject]);

  const handleRevertSummaryRoster = useCallback((builderId) => {
    setBuildMenuSteps(prev => prev.filter(step => step.builderId.toLowerCase() !== builderId.toLowerCase()));
    showToast(`Reverted build menu for ${builderId}`);
  }, [setBuildMenuSteps, showToast]);

  const handleResetAllSummaryRosters = useCallback(() => {
    transactProject(buildRosterRevertPatch());
    showToast('Reverted all build-menu changes');
  }, [showToast, transactProject]);

  const handleDisableSummaryBuildMenuPack = useCallback((packId) => {
    setBuildMenuPacks(prev => ({ ...prev, [packId]: false }));
    showToast(`Disabled ${packId === 'extraUnits' ? 'Extra Units Pack' : 'Scavenger Units Pack'}`);
  }, [setBuildMenuPacks, showToast]);

  const handleRestoreSummaryUnit = useCallback((unitId) => {
    setDisabledUnitIds(prev => prev.filter(id => id.toLowerCase() !== unitId.toLowerCase()));
    showToast(`Restored ${unitId}`);
  }, [setDisabledUnitIds, showToast]);

  const handleRestoreAllSummaryUnits = useCallback(() => {
    setDisabledUnitIds([]);
    showToast('Restored all disabled units');
  }, [setDisabledUnitIds, showToast]);

  const handleResetAllProjectChanges = useCallback(() => {
    const selectedClone = clones.find(clone => clone.newId.toLowerCase() === selectedUnitId?.toLowerCase());
    transactProject(buildFullProjectResetPatch());
    setActiveRelationshipKey(null);
    if (selectedClone) setSelectedUnitId(selectedClone.baseId);
    showToast('Reset all active project changes');
  }, [clones, selectedUnitId, setActiveRelationshipKey, setSelectedUnitId, showToast, transactProject]);

  const updateSelectedUnitDescription = useCallback(value => {
    if (!selectedUnit) return;
    const normalizedValue = value.slice(0, 1000);
    transactProject(current => {
      const nextDescriptions = { ...current.unitDescriptions };
      if (normalizedValue.trim() === '') delete nextDescriptions[selectedUnit.id];
      else nextDescriptions[selectedUnit.id] = normalizedValue;
      return {
        unitDescriptions: nextDescriptions,
        includeTweaks: normalizedValue.trim() === '' ? current.includeTweaks : true,
      };
    });
  }, [selectedUnit, transactProject]);

  const integrityContext = useMemo(() => ({
    allUnitsList,
    activeFactoryRosters,
    defaultsDb,
    resolveCloneRootId,
  }), [activeFactoryRosters, allUnitsList, defaultsDb, resolveCloneRootId]);
  const integrityReport = useMemo(
    () => analyzeProjectIntegrity({ project: projectStore, context: integrityContext }),
    [integrityContext, projectStore]
  );
  const handleIntegrityRepair = useCallback((repairIds = []) => {
    const result = repairProjectIntegrity(projectStore, integrityContext, repairIds);
    if (result.applied.length === 0) {
      showToast('No safe integrity repairs are currently available');
      return;
    }
    transactProject({
      buildMenuSteps: result.project.buildMenuSteps,
      clones: result.project.clones,
      disabledUnitIds: result.project.disabledUnitIds,
      unitDescriptions: result.project.unitDescriptions,
      supportingWeaponDefs: result.project.supportingWeaponDefs,
    });
    const remaining = result.after.findings.length;
    showToast(`Project Doctor applied ${result.applied.length} safe ${result.applied.length === 1 ? 'repair' : 'repairs'}${remaining ? `; ${remaining} findings remain` : ''}`);
  }, [integrityContext, projectStore, showToast, transactProject]);

  return {
    showSummaryModal,
    setShowSummaryModal,
    activeSummaryTab,
    setActiveSummaryTab,
    handleStatChange,
    handleStatPatch,
    handleResetUnit,
    handleResetSummaryUnitEdits,
    handleResetAllSummaryUnitEdits,
    handleRevertSummaryRoster,
    handleResetAllSummaryRosters,
    handleDisableSummaryBuildMenuPack,
    handleRestoreSummaryUnit,
    handleRestoreAllSummaryUnits,
    handleResetAllProjectChanges,
    updateSelectedUnitDescription,
    integrityReport,
    handleIntegrityRepair,
  };
}
