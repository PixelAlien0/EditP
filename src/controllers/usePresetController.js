import { useCallback, useState } from 'react';

/**
 * Builds the persisted preset snapshot from the current project state.
 * The field list must stay byte-identical: presets are persisted project
 * data, so adding, removing, or renaming fields would corrupt saved presets.
 */
export function buildPresetSnapshot(projectState) {
  return {
    tweaks: projectState.tweaks,
    clones: projectState.clones,
    disabledUnitIds: projectState.disabledUnitIds,
    unitDescriptions: projectState.unitDescriptions,
    buildMenuSteps: projectState.buildMenuSteps,
    buildMenuPacks: projectState.buildMenuPacks,
    weaponLibrary: projectState.weaponLibrary,
    supportingWeaponDefs: projectState.supportingWeaponDefs,
    unitCollections: projectState.unitCollections,
    tweakModules: projectState.tweakModules,
    lobbySetup: projectState.lobbySetup,
    projectName: projectState.projectName,
    projectAuthor: projectState.projectAuthor,
    projectDesc: projectState.projectDesc,
    includeTweaks: projectState.includeTweaks,
    includeClones: projectState.includeClones,
    includeRosters: projectState.includeRosters,
    includeHeader: projectState.includeHeader,
    exportOptimizationProfile: projectState.exportOptimizationProfile,
  };
}

export function buildPreset(name, description, snapshot) {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    description,
    createdAt: new Date().toISOString(),
    snapshot,
  };
}

export function usePresetController({
  projectStore,
  setPresets,
  applyProjectSnapshot,
  showToast,
  onApplied,
}) {
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');

  const handleSavePreset = useCallback(() => {
    const name = presetName.trim() || `${projectStore.projectName} preset`;
    const snapshot = buildPresetSnapshot(projectStore);
    const preset = buildPreset(name, presetDescription.trim(), snapshot);
    setPresets(prev => [preset, ...prev].slice(0, 30));
    setPresetName('');
    setPresetDescription('');
    showToast(`Saved preset: ${name}`);
  }, [presetName, presetDescription, projectStore, setPresets, showToast]);

  const handleApplyPreset = useCallback((preset) => {
    const snapshot = preset.snapshot || {};
    applyProjectSnapshot(snapshot);
    onApplied?.();
    showToast(`Applied preset: ${preset.name}`);
  }, [applyProjectSnapshot, onApplied, showToast]);

  const handleDeletePreset = useCallback((presetId) => {
    setPresets(prev => prev.filter(item => item.id !== presetId));
  }, [setPresets]);

  return {
    presetName,
    setPresetName,
    presetDescription,
    setPresetDescription,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
  };
}
