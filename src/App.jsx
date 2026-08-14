import { lazy, Suspense, useState, useMemo, useEffect, useCallback } from 'react';
import { BUILD_MENU_PACKS } from './data/build-menu-packs.js';
import { useOnlinePresence } from './hooks/useOnlinePresence.js';
import { useTemporaryChat } from './hooks/useTemporaryChat.js';
import { useProjectPersistence } from './hooks/useProjectPersistence.js';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout.js';
import { useEditorPreferences } from './hooks/useEditorPreferences.js';
import { useCoreGameData } from './hooks/useCoreGameData.js';
import { useCompiledProjectOutputs } from './hooks/useCompiledProjectOutputs.js';
import { useProjectDerivedData } from './hooks/useProjectDerivedData.js';
import { useProjectStore } from './state/useProjectStore.js';
import { PRESENCE_ACTIVITY } from './config/presenceActivities.js';
import {
  MOBILITY_STAT_KEYS,
  STAT_KEYS,
} from './config/editorParameters.js';
import { WEAPON_EDITABLE_PARAMETER_CATALOG } from './config/weaponParameters.js';
import AppHeader from './components/AppHeader.jsx';
import MainMenu from './components/MainMenu.jsx';
import AppDialogs from './components/AppDialogs.jsx';
import CloneCreatorDialog from './components/CloneCreatorDialog.jsx';
import WeaponSwapModal from './components/WeaponSwapModal.jsx';
import { getUnitIconUrl } from './utils/unitArtwork.js';
import { useFactoryRosterController } from './controllers/useFactoryRosterController.js';
import {
  getValidationWarning,
  useProjectValidation,
} from './controllers/useProjectValidation.js';
import { useCloneController } from './controllers/useCloneController.js';
import { useTweakPackageController } from './controllers/useTweakPackageController.js';
import { useProjectFileController } from './controllers/useProjectFileController.js';
import { useUnitCollectionsController } from './controllers/useUnitCollectionsController.js';
import { useWeaponSwapController } from './controllers/useWeaponSwapController.js';
import { useWeaponLabController } from './controllers/useWeaponLabController.js';
import { useCarrierWorkbenchController } from './controllers/useCarrierWorkbenchController.js';
import { useUnitEditActionsController } from './controllers/useUnitEditActionsController.js';
import { usePresetController } from './controllers/usePresetController.js';
import {
  BULK_PARAMETER_GROUPS,
  useMutatorToolsController,
} from './controllers/useMutatorToolsController.js';
import { Button } from './components/ui.jsx';
import EditUnitsWorkspace from './components/editor/EditUnitsWorkspace.jsx';
import { getRelationshipLabel } from './config/parameterGuidance.js';
import { collectKnownTargetableMask } from './config/behaviorInterceptor.js';
import {
  getCollectionUnitIds,
} from './project/unitCollections.js';
import { applyWeaponBlueprintToSlot } from './utils/weaponBlueprint.js';
import { applyWeaponClusterRecipe, WEAPON_CLUSTER_RECIPES } from './utils/weaponClusterRecipes.js';
import { normalizeProjectDocumentWithReport } from './project/projectDocument.js';

// Publish the experimental Weapon Laboratory workspace and its Tools entry.
const WEAPON_LAB_ENABLED = true;
// Keep these implementations in source control for repair, but do not emit
// their JavaScript or CSS while every public entry point remains locked.
const MUTATOR_TOOLS_ENABLED = false;

const LazyDesignerPage = lazy(() => import('./components/DesignerPage.jsx'));
const LazyCollectionsPage = lazy(() => import('./components/CollectionsPage.jsx'));
const LazyPresetGalleryPage = lazy(() => import('./components/PresetGalleryPage.jsx'));
const LazyReviewPage = lazy(() => import('./components/ReviewPage.jsx'));
const LazyBatchAdjustDialog = MUTATOR_TOOLS_ENABLED
  ? lazy(() => import('./components/BatchAdjustDialog.jsx'))
  : null;
const LazySummaryExplorerDialog = lazy(() => import('./components/SummaryExplorerDialog.jsx'));
const LazyTweakPackageLabPage = lazy(() => import('./components/TweakPackageLabPage.jsx'));
const LazyWeaponDefLibraryPage = lazy(() => import('./components/WeaponDefLibraryPage.jsx'));
const LazyBarReferenceLibraryPage = lazy(() => import('./components/BarReferenceLibraryPage.jsx'));
const LazyCommunityGalleryPage = lazy(() => import('./components/CommunityGalleryPage.jsx'));
const LazyFormulaMutatorDialog = MUTATOR_TOOLS_ENABLED
  ? lazy(() => import('./components/FormulaMutatorDialog.jsx'))
  : null;
const LazyCarrierDroneWorkbenchDialog = lazy(() => import('./components/CarrierDroneWorkbenchDialog.jsx'));
const LazyMutationLabDialog = MUTATOR_TOOLS_ENABLED
  ? lazy(() => import('./components/MutationLabDialog.jsx'))
  : null;
const LazyWeaponLaboratoryPage = lazy(() => import('./components/WeaponLaboratoryPage.jsx'));

export default function App() {
  const {
    unitsDb,
    factoryRosters,
    defaultsDb,
    explosionProfiles,
    snapshot: gameDataSnapshot,
    error: coreDataError,
    status: coreDataStatus,
    getTechTierOfUnit,
    getTagsOfUnit,
  } = useCoreGameData();

  const knownTargetableMask = useMemo(() => collectKnownTargetableMask(defaultsDb), [defaultsDb]);

  const {
    themeMode,
    setThemeMode,
    showAllUnitParams,
    setShowAllUnitParams,
    showAllWeaponParams,
    setShowAllWeaponParams,
  } = useEditorPreferences();

  const [showMainMenu, setShowMainMenu] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState('edit');
  const [selectedFaction, setSelectedFaction] = useState('all');
  const [selectedCats, setSelectedCats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState('armdfly');

  const {
    state: projectStore,
    setTweaks, setClones, setDisabledUnitIds,
    setBuildMenuSteps, setBuildMenuPacks, setPresets, setWeaponLibrary, setSupportingWeaponDefs, setUnitCollections, setTweakModules, setLobbySetup,
    setProjectName, setProjectAuthor, setProjectDesc,
    setIncludeTweaks, setIncludeClones, setIncludeRosters, setIncludeHeader, setExportOptimizationProfile,
    transactProject, applyProjectSnapshot, hydrateProjectStore,
    undoProject, redoProject, historyPastCount, historyFutureCount,
  } = useProjectStore();
  const {
    tweaks, clones, disabledUnitIds, unitDescriptions, buildMenuSteps, buildMenuPacks,
    presets, weaponLibrary, supportingWeaponDefs, unitCollections, tweakModules, lobbySetup, projectName, projectAuthor, projectDesc,
    includeTweaks, includeClones, includeRosters, includeHeader, exportOptimizationProfile,
  } = projectStore;

  const {
    getEffectiveTechTier,
    getCloneLineage,
    resolveCloneRootId,
    getInheritedCloneWeaponSwaps,
    getProjectUnitIconUrl,
    allUnitsList,
  } = useProjectDerivedData({
    tweaks,
    clones,
    unitDescriptions,
    defaultsDb,
    unitsDb,
    getTechTierOfUnit,
    getTagsOfUnit,
  });

  const tweakDefsLua = '';
  const [toast, setToast] = useState({ show: false, message: '' });

  // Build Menu Designer Modal states
  const [showDesignerPanel, setShowDesignerPanel] = useState(false);

  // Weapon Swap states
  const [showSwapModal, setShowSwapModal] = useState(false);
  const workspaceLayout = useWorkspaceLayout();
  const [activeSwapSlotNum, setActiveSwapSlotNum] = useState(1);
  const [activeWeaponSlotTab, setActiveWeaponSlotTab] = useState(1);
  const [activeParamTab, setActiveParamTab] = useState('structure');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [activeRelationshipKey, setActiveRelationshipKey] = useState(null);

  useEffect(() => {
    setActiveRelationshipKey(null);
  }, [selectedUnitId, activeParamTab, activeWeaponSlotTab]);

  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showProjectCheckpoints, setShowProjectCheckpoints] = useState(false);
  const temporaryChat = useTemporaryChat(true);
  const [chatReadAt, setChatReadAt] = useState(() => {
    const stored = Number(window.localStorage.getItem('editp_chat_read_at_v1'));
    return Number.isFinite(stored) && stored > 0 ? stored : Date.now();
  });
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const [showWeaponLab, setShowWeaponLab] = useState(false);
  // Active Output tab
  const [activeOutputTab, setActiveOutputTab] = useState('tweakdefs_lua'); // 'tweakunits_lua' | 'tweakdefs_lua' | 'tweakunits_b64' | 'tweakdefs_b64'

  const unreadChatCount = useMemo(() => {
    if (showChatModal) return 0;
    return temporaryChat.messages.filter(message => (
      message.sender_id !== temporaryChat.identity.id
      && Date.parse(message.created_at) > chatReadAt
    )).length;
  }, [chatReadAt, showChatModal, temporaryChat.identity.id, temporaryChat.messages]);

  const markTemporaryChatRead = useCallback(() => {
    const readAt = Date.now();
    setChatReadAt(readAt);
    window.localStorage.setItem('editp_chat_read_at_v1', String(readAt));
  }, []);

  const closeTemporaryChat = useCallback(() => {
    setShowChatModal(false);
    markTemporaryChatRead();
  }, [markTemporaryChatRead]);

  const handleUndo = undoProject;
  const handleRedo = redoProject;

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  const {
    document: normalizedProjectDocument,
    createCheckpoint,
  } = useProjectPersistence({ state: projectStore, hydrate: hydrateProjectStore, onNotice: showToast });
  const onProjectImported = useCallback(prepared => {
    setShowDesignerPanel(false);
    setShowPresetGallery(false);
    setActiveWorkspace('edit');
    setShowMainMenu(false);
    const migrationNotice = prepared.migrated
      ? `Migrated project v${prepared.fromVersion} → v${prepared.toVersion}.`
      : 'Configuration imported successfully!';
    const repairNotice = prepared.warnings.length
      ? ` ${prepared.warnings.length} repair warning${prepared.warnings.length === 1 ? '' : 's'} recorded.`
      : '';
    showToast(`${migrationNotice}${repairNotice}`);
  }, [showToast]);
  const onProjectRejected = useCallback(error => {
    showToast(error?.message || 'Error: Invalid config file');
    setShowProjectCheckpoints(true);
  }, [showToast]);
  const { handleExportConfig, handleImportConfig } = useProjectFileController({
    projectDocument: normalizedProjectDocument,
    projectName,
    createCheckpoint,
    hydrateProjectStore,
    showToast,
    onImported: onProjectImported,
    onRejected: onProjectRejected,
  });

  const onPresetApplied = useCallback(() => {
    setShowPresetGallery(false);
    setActiveWorkspace('edit');
  }, []);
  const {
    presetName,
    setPresetName,
    presetDescription,
    setPresetDescription,
    handleSavePreset,
    handleApplyPreset,
    handleDeletePreset,
  } = usePresetController({
    projectStore,
    setPresets,
    applyProjectSnapshot,
    showToast,
    onApplied: onPresetApplied,
  });

  const {
    activeFactoryRosters,
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
  } = useFactoryRosterController({
    factoryRosters,
    buildMenuPacks,
    unitsDbNames: unitsDb.names,
    defaultsDb,
    buildMenuSteps,
    clones,
    allUnitsList,
    transactProject,
    setBuildMenuSteps,
  });
  const {
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
  } = useTweakPackageController({
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
  });
  const {
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
  } = useUnitCollectionsController({
    unitCollections,
    setUnitCollections,
    allUnitsList,
    showToast,
  });
  const {
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
  } = useCloneController({
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
  });

  // Parse advanced search query (e.g. hp > 1000)
  const queryFilterFn = useMemo(() => {
    if (!searchQuery.trim()) return () => true;

    const advancedRegex = /^(hp|health|metal|energy|cost|speed|velocity|range)\s*(>=|<=|>|<|==|=)\s*(\d+(\.\d+)?)$/i;
    const match = searchQuery.trim().match(advancedRegex);

    if (match) {
      const field = match[1].toLowerCase();
      const op = match[2];
      const val = parseFloat(match[3]);

      let dbField = 'health';
      if (field === 'metal' || field === 'cost') dbField = 'metalcost';
      if (field === 'energy') dbField = 'energycost';
      if (field === 'speed' || field === 'velocity') dbField = 'maxvelocity';
      if (field === 'range') {
        return (unit) => {
          const stats = defaultsDb[unit.isClone ? resolveCloneRootId(unit.id) : unit.id];
          if (!stats || !stats.weaponSlots) return false;
          return stats.weaponSlots.some(slot => {
            const r = parseFloat(slot.range);
            if (isNaN(r)) return false;
            switch (op) {
              case '>': return r > val;
              case '<': return r < val;
              case '>=': return r >= val;
              case '<=': return r <= val;
              case '=':
              case '==': return r === val;
              default: return false;
            }
          });
        };
      }

      return (unit) => {
        const stats = defaultsDb[unit.isClone ? resolveCloneRootId(unit.id) : unit.id];
        if (!stats) return false;

        let statVal = stats[dbField];
        if (statVal === undefined) return false;
        statVal = parseFloat(statVal);

        switch (op) {
          case '>': return statVal > val;
          case '<': return statVal < val;
          case '>=': return statVal >= val;
          case '<=': return statVal <= val;
          case '=':
          case '==': return statVal === val;
          default: return false;
        }
      };
    }

    const lowerQuery = searchQuery.toLowerCase();
    return (unit) =>
      unit.id.toLowerCase().includes(lowerQuery) ||
      unit.name.toLowerCase().includes(lowerQuery) ||
      unit.desc.toLowerCase().includes(lowerQuery) ||
      (Array.isArray(unit.tags) && unit.tags.some(tag => tag.toLowerCase().includes(lowerQuery)));
  }, [searchQuery, defaultsDb, resolveCloneRootId]);

  // Category domains for classification filtering
  const TYPE_CATEGORIES = useMemo(() => new Set(['bots', 'vehicles', 'aircraft', 'ships', 'hovercraft', 'factories', 'defenses', 'buildings']), []);
  const TIER_CATEGORIES = useMemo(() => new Set(['t1', 't2', 't3', 't4']), []);

  // Filter list
  const filteredUnits = useMemo(() => {
    return allUnitsList.filter(unit => {
      if (activeCollectionUnitIds && !activeCollectionUnitIds.has(unit.id)) return false;
      if (selectedFaction !== 'all' && unit.faction !== selectedFaction) {
        return false;
      }
      if (selectedCats.length > 0) {
        const selectedTypes = selectedCats.filter(c => TYPE_CATEGORIES.has(c));
        const selectedTiers = selectedCats.filter(c => TIER_CATEGORIES.has(c));
        const selectedOther = selectedCats.filter(c => !TYPE_CATEGORIES.has(c) && !TIER_CATEGORIES.has(c));

        if (selectedTypes.length > 0 && !selectedTypes.some(cat => unit.tags.includes(cat))) {
          return false;
        }
        if (selectedTiers.length > 0 && !selectedTiers.some(cat => unit.tags.includes(cat))) {
          return false;
        }
        if (selectedOther.length > 0 && !selectedOther.every(cat => unit.tags.includes(cat))) {
          return false;
        }
      }
      if (showModifiedOnly) {
        const hasTweaks = Boolean(tweaks[unit.id] && Object.keys(tweaks[unit.id]).length > 0);
        const hasDescription = Object.hasOwn(unitDescriptions, unit.id);
        const isDisabled = disabledUnitIds.includes(unit.id);
        if (!hasTweaks && !hasDescription && !isDisabled && !unit.isClone) return false;
      }
      return queryFilterFn(unit);
    });
  }, [activeCollectionUnitIds, allUnitsList, selectedFaction, selectedCats, TYPE_CATEGORIES, TIER_CATEGORIES, queryFilterFn, showModifiedOnly, tweaks, unitDescriptions, disabledUnitIds]);

  const bulkTargetUnits = useMemo(() => filteredUnits.filter(unit => {
    const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
    return defaultsDb[baseId] !== undefined;
  }), [filteredUnits, defaultsDb, resolveCloneRootId]);

  const clearUnitFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedFaction('all');
    setSelectedCats([]);
    setShowModifiedOnly(false);
    setActiveCollectionId(null);
  }, [setActiveCollectionId]);

  const hasActiveUnitFilters = Boolean(activeCollection || searchQuery.trim() || selectedFaction !== 'all' || selectedCats.length > 0 || showModifiedOnly);

  // Selection defaults
  useEffect(() => {
    if (filteredUnits.length > 0) {
      if (!selectedUnitId || !filteredUnits.some(u => u.id === selectedUnitId)) {
        setSelectedUnitId(filteredUnits[0].id);
      }
    }
  }, [filteredUnits, selectedUnitId]);

  const selectedUnit = useMemo(() => {
    return allUnitsList.find(u => u.id === selectedUnitId) || null;
  }, [allUnitsList, selectedUnitId]);

  const {
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
  } = useWeaponSwapController({
    activeSwapSlotNum,
    selectedUnit,
    setClones,
    setShowSwapModal,
    showToast,
  });

  const {
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
  } = useUnitEditActionsController({
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
  });

  const {
    showBulkPanel,
    setShowBulkPanel,
    showFormulaMutator,
    setShowFormulaMutator,
    showRandomPanel,
    setShowRandomPanel,
    wipRandomPanelAcknowledged,
    setWipRandomPanelAcknowledged,
    randomScope,
    setRandomScope,
    randomIntensity,
    setRandomIntensity,
    randomDomains,
    setRandomDomains,
    bulkStatKey,
    setBulkStatKey,
    bulkPercent,
    setBulkPercent,
    bulkMode,
    setBulkMode,
    handleApplyBulk,
    handleRandomAdjustments,
    handleApplyFormula,
  } = useMutatorToolsController({
    defaultsDb,
    tweaks,
    bulkTargetUnits,
    filteredUnits,
    selectedUnit,
    resolveCloneRootId,
    transactProject,
    setTweaks,
    showToast,
  });

  const presenceActivity = useMemo(() => {
    if (showMainMenu) return PRESENCE_ACTIVITY.MAIN_MENU;
    if (
      showBulkPanel
      || showRandomPanel
      || showPresetGallery
      || (WEAPON_LAB_ENABLED && showWeaponLab)
      || activeWorkspace === 'preset-gallery'
      || activeWorkspace === 'collections'
      || activeWorkspace === 'weapon-lab'
      || activeWorkspace === 'tweak-lab'
      || activeWorkspace === 'weapondef-library'
      || activeWorkspace === 'reference-library'
      || activeWorkspace === 'community'
    ) {
      return PRESENCE_ACTIVITY.TOOLS;
    }
    if (activeWorkspace === 'designer') return PRESENCE_ACTIVITY.BUILD_MENUS;
    if (activeWorkspace === 'review') return PRESENCE_ACTIVITY.REVIEW_EXPORT;
    return PRESENCE_ACTIVITY.EDIT_UNITS;
  }, [activeWorkspace, showBulkPanel, showMainMenu, showPresetGallery, showRandomPanel, showWeaponLab]);
  const {
    count: onlineCount,
    status: presenceStatus,
    activityCounts: presenceActivityCounts
  } = useOnlinePresence(presenceActivity);

  const selectedUnitDefaults = useMemo(() => {
    if (!selectedUnit) return null;
    const baseId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
    const defaults = { ...(defaultsDb[baseId] || {}) };

    const cloneInfo = selectedUnit.isClone ? clones.find(c => c.newId.toLowerCase() === selectedUnit.id.toLowerCase()) : null;
    const effectiveWeaponSwaps = cloneInfo ? getInheritedCloneWeaponSwaps(selectedUnit.id) : null;
    if (effectiveWeaponSwaps && defaults.weaponSlots) {
      defaults.weaponSlots = defaults.weaponSlots.map(wSlot => {
        const slotKey = String(wSlot.slot);
        const swap = effectiveWeaponSwaps[slotKey];
        if (swap) {
          const swapSourceId = resolveCloneRootId(swap.sourceUnitId);
          const swapDefaults = defaultsDb[swapSourceId];
          if (swapDefaults && swapDefaults.weaponSlots) {
            const srcSlot = swapDefaults.weaponSlots.find(s => s.defKey === swap.sourceWeaponDefKey.toLowerCase());
            if (srcSlot) {
              const blueprint = swap.libraryWeaponId
                ? weaponLibrary.find(item => item.id === swap.libraryWeaponId)
                : null;
              return {
                ...(blueprint ? applyWeaponBlueprintToSlot(srcSlot, blueprint) : srcSlot),
                slot: wSlot.slot, // Retain destination slot number
              };
            }
          }
        }
        return wSlot;
      });

      // Update legacy properties of slot 1 if it exists and was swapped
      const slot1 = defaults.weaponSlots.find(s => s.slot === 1);
      if (slot1) {
        defaults.weapon1def = slot1.defKey;
        defaults.weapon1Damage = slot1.damage;
        defaults.weapon1Reload = slot1.reload;
        defaults.weapon1Range = slot1.range;
        defaults.weapon1Velocity = slot1.velocity;
        defaults.weapon1Flighttime = slot1.flighttime;
        defaults.weapon1Aoe = slot1.aoe;
        defaults.weapon1Accuracy = slot1.accuracy;
        defaults.weapon1Sprayangle = slot1.sprayangle;
        defaults.weapon1Projectiles = slot1.projectiles;
        defaults.weapon1Burst = slot1.burst;
        defaults.weapon1Burstrate = slot1.burstrate;
      }
    }

    return defaults;
  }, [selectedUnit, clones, weaponLibrary, defaultsDb, getInheritedCloneWeaponSwaps, resolveCloneRootId]);

  const {
    weaponBlueprintDraft,
    setWeaponBlueprintDraft,
    weaponSourceCatalog,
    openWeaponLab,
    persistWeaponBlueprint,
    cloneWeaponSourceToDraft,
    equipWeaponBlueprint,
    deleteWeaponBlueprint,
    handleDownloadWeaponVfxPack,
  } = useWeaponLabController({
    weaponLabEnabled: WEAPON_LAB_ENABLED,
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
  });

  const {
    showCarrierWorkbench,
    setShowCarrierWorkbench,
    handleApplyCarrierLinkage,
  } = useCarrierWorkbenchController({
    setTweaks,
    setActiveWeaponSlotTab,
    showToast,
  });

  const {
    generatedTweakUnitsLua,
    generatedTweakDefsLua,
    tweakUnitsB64,
    tweakDefsB64,
    compiledLobbyModules,
    lobbyCommands,
    totalBytesUsed,
    lobbyByteLimit,
  } = useCompiledProjectOutputs({
    tweaks,
    allUnitsList,
    clones,
    defaultsDb,
    explosionProfiles,
    resolveCloneRootId,
    getInheritedCloneWeaponSwaps,
    includeTweaks,
    includeClones,
    includeRosters,
    includeHeader,
    tweakDefsLua,
    buildMenuSteps,
    disabledUnitIds,
    activeFactoryRosters,
    projectName,
    projectAuthor,
    projectDesc,
    unitDescriptions,
    weaponLibrary,
    supportingWeaponDefs,
    tweakModules,
    exportOptimizationProfile,
  });
  const limitRisk = compiledLobbyModules.overflow
    ? 'error'
    : compiledLobbyModules.slots.some(slot => slot.compatibility === 'near-limit') ? 'warning' : 'ok';

  // Toggle Category selection
  const handleCatClick = useCallback((cat) => {
    setSelectedCats(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  }, []);

  const commandPaletteCommands = useMemo(() => {
    const openEditor = () => {
      setShowMainMenu(false);
      setShowDesignerPanel(false);
      setShowPresetGallery(false);
      setActiveWorkspace('edit');
    };
    const commands = [
      { id: 'workspace-edit', kind: 'Workspace', label: 'Edit units', description: 'Open the unit parameter editor.', priority: 30, onSelect: openEditor },
      { id: 'workspace-collections', kind: 'Workspace', label: 'Collections', description: 'Organize reusable nested unit scopes.', priority: 29, onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('collections'); } },
      { id: 'workspace-build', kind: 'Workspace', label: 'Build menus', description: 'Open Factory Roster Designer.', priority: 28, onSelect: () => { setShowMainMenu(false); setShowPresetGallery(false); setShowDesignerPanel(true); setActiveWorkspace('designer'); } },
      { id: 'workspace-review', kind: 'Workspace', label: 'Review & export', description: 'Validate and compile the current project.', priority: 27, onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('review'); } },
      { id: 'tool-presets', kind: 'Tool', label: 'Preset gallery', description: 'Save or apply reusable project snapshots.', onSelect: () => { setShowMainMenu(false); setShowPresetGallery(true); setActiveWorkspace('preset-gallery'); } },
      { id: 'tool-tweak-package', kind: 'Tool', label: 'Tweak Package Lab', description: 'Inspect and package modular tweakdefs and tweakunits safely.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('tweak-lab'); } },
      { id: 'tool-weapondef-library', kind: 'Tool', label: 'WeaponDef Library', description: 'Create, validate, and maintain supporting WeaponDefs.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('weapondef-library'); } },
      { id: 'tool-bar-reference-library', kind: 'Tool', label: 'BAR Reference Library', description: 'Search verified units, WeaponDefs, models, scripts, artwork, effects, sounds, and explosion profiles.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('reference-library'); } },
      { id: 'community-gallery', kind: 'Community', label: 'Community projects', description: 'Browse public projects shared by BAR Editor creators.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('community'); } },
    ];

    if (MUTATOR_TOOLS_ENABLED) {
      commands.push(
        { id: 'tool-batch', kind: 'Tool', label: 'Batch adjust stats', description: 'Apply one adjustment across matching units.', onSelect: () => { openEditor(); setShowBulkPanel(true); } },
        { id: 'tool-mutation', kind: 'Tool', label: 'Mutation lab', description: 'Generate controlled random adjustments.', onSelect: () => { openEditor(); setShowRandomPanel(true); } },
      );
    }

    STAT_KEYS.forEach(parameter => commands.push({
      id: `parameter-${parameter.key}`,
      kind: 'Parameter',
      label: parameter.label,
      description: `Open ${MOBILITY_STAT_KEYS.has(parameter.key) ? 'Movement & Sensors' : 'Economy & Durability'} and focus this field.`,
      keywords: `${parameter.key} ${parameter.icon}`,
      onSelect: () => {
        openEditor();
        setActiveParamTab(MOBILITY_STAT_KEYS.has(parameter.key) ? 'mobility' : 'structure');
        setActiveRelationshipKey(parameter.key);
      },
    }));

    WEAPON_EDITABLE_PARAMETER_CATALOG.forEach(parameter => commands.push({
      id: `weapon-parameter-${parameter.key}`,
      kind: 'Weapon field',
      label: parameter.label || getRelationshipLabel(parameter.key),
      description: 'Open the active weapon slot and focus this field.',
      keywords: parameter.key,
      onSelect: () => { openEditor(); setActiveParamTab('weapons'); setActiveRelationshipKey(parameter.key); },
    }));

    allUnitsList.forEach(unit => commands.push({
      id: `unit-${unit.id}`,
      kind: unit.isClone ? 'Clone' : 'Unit',
      label: unit.name,
      description: unit.id,
      keywords: `${unit.id} ${unit.faction} ${unit.tags.join(' ')}`,
      onSelect: () => { openEditor(); setSelectedUnitId(unit.id); },
    }));
    unitCollections.forEach(collection => commands.push({
      id: `collection-${collection.id}`,
      kind: 'Collection',
      label: collection.name,
      description: `${getCollectionUnitIds(unitCollections, collection.id).size} units including nested folders`,
      keywords: `folder scope ${collection.name}`,
      onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveCollectionId(collection.id); setActiveWorkspace('collections'); },
    }));
    return commands;
  }, [allUnitsList, unitCollections, setActiveCollectionId, setShowBulkPanel, setShowRandomPanel]);

  // Keyboard Shortcuts Hook
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandPalette(open => !open);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
        return;
      }
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'SELECT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        const searchInput = document.querySelector('.search-input');
        if (searchInput) searchInput.focus();
      }
      if (e.key === 'Escape') {
        setShowSwapModal(false);
        setShowClonePanel(false);
        setShowBulkPanel(false);
        setShowDesignerPanel(false);
        setShowSummaryModal(false);
        setShowCreditsModal(false);
        setShowChatModal(false);
        setShowCommandPalette(false);
        setShowProjectCheckpoints(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, setShowBulkPanel, setShowClonePanel, setShowSummaryModal]);

  const {
    validationIssues,
    scopedValidationIssues,
    gadgetContractResults,
    selectedGadgetContracts,
  } = useProjectValidation({
    tweaks,
    clones,
    unitNames: unitsDb.names,
    compiledLobbyModules,
    allUnitsList,
    defaultsDb,
    resolveCloneRootId,
    supportingWeaponDefs,
    buildMenuSteps,
    activeFactoryRosters,
    weaponLibrary,
    disabledUnitIds,
    includeTweaks,
    includeClones,
    includeRosters,
    activeCollectionUnitIds,
    selectedUnitId,
  });

  const activeFaction = useMemo(() => {
    if (selectedUnit) {
      return selectedUnit.faction || 'all';
    }
    return selectedFaction;
  }, [selectedUnit, selectedFaction]);

  const factionAccentColor = useMemo(() => {
    switch (activeFaction) {
      case 'arm': return '#668895'; // weathered indigo
      case 'cor': return '#a96862'; // persimmon clay
      case 'leg': return '#8b7899'; // muted wisteria
      case 'rap': return '#a47b48'; // roasted tea
      case 'scav': return '#7d8768'; // moss
      default: return '#b56f7b'; // sakura ink
    }
  }, [activeFaction]);

  const modifiedUnitIds = useMemo(() => [...new Set([
    ...Object.keys(tweaks).filter(id => Object.keys(tweaks[id] || {}).length > 0),
    ...Object.keys(unitDescriptions),
  ])], [tweaks, unitDescriptions]);
  const activeCollectionModifiedCount = activeCollectionUnitIds
    ? modifiedUnitIds.filter(unitId => activeCollectionUnitIds.has(unitId)).length
    : modifiedUnitIds.length;
  const collectionReviewScope = activeCollection ? {
    id: activeCollection.id,
    name: activeCollection.name,
    unitCount: activeCollectionUnits.length,
    modifiedCount: activeCollectionModifiedCount,
    validationCount: scopedValidationIssues.length,
  } : null;
  const activeBuildMenuPackCount = Object.values(buildMenuPacks).filter(Boolean).length;
  const projectChangeCount = modifiedUnitIds.length + clones.length + disabledUnitIds.length + buildMenuSteps.length + activeBuildMenuPackCount + tweakModules.length + supportingWeaponDefs.length + (lobbySetup.commands?.length || 0);
  const workflowProgress = useMemo(() => {
    const editedUnitCount = new Set([
      ...modifiedUnitIds,
      ...clones.map(clone => clone.newId),
      ...disabledUnitIds,
    ]).size;
    const rosterChangeCount = buildMenuSteps.length + activeBuildMenuPackCount;
    return {
      edit: editedUnitCount > 0 ? {
        value: editedUnitCount,
        label: `${editedUnitCount} edited unit${editedUnitCount === 1 ? '' : 's'}`,
        tone: 'has-work',
      } : null,
      collections: unitCollections.length > 0 ? {
        value: unitCollections.length,
        label: `${unitCollections.length} saved collection${unitCollections.length === 1 ? '' : 's'}`,
        tone: 'has-work',
      } : null,
      designer: rosterChangeCount > 0 ? {
        value: rosterChangeCount,
        label: `${rosterChangeCount} build-menu change${rosterChangeCount === 1 ? '' : 's'}`,
        tone: 'has-work',
      } : null,
      review: validationIssues.length > 0 ? {
        value: validationIssues.length,
        label: `${validationIssues.length} validation ${validationIssues.length === 1 ? 'issue' : 'issues'}`,
        tone: 'needs-review',
      } : projectChangeCount > 0 ? {
        value: 'Ready',
        label: 'Project ready for review',
        tone: 'is-clear',
      } : null,
    };
  }, [activeBuildMenuPackCount, buildMenuSteps.length, clones, disabledUnitIds, modifiedUnitIds, projectChangeCount, unitCollections.length, validationIssues.length]);
  const selectedUnitOverrideEntries = useMemo(
    () => Object.entries(tweaks[selectedUnit?.id] || {}),
    [tweaks, selectedUnit]
  );
  const inspectorTabs = useMemo(() => [
    { id: 'details', label: 'Details' },
    { id: 'compare', label: 'Compare', count: selectedUnitOverrideEntries.length },
    { id: 'changes', label: 'Changes', count: projectChangeCount },
  ], [selectedUnitOverrideEntries, projectChangeCount]);
  const activeInspectorTab = workspaceLayout.layout.inspectorTab;
  const setInspectorTab = workspaceLayout.setInspectorTab;

  const handleApplyWeaponClusterRecipe = useCallback(({
    recipeId,
    unitId,
    slotNumber,
    sourceSlot,
  }) => {
    try {
      transactProject(current => applyWeaponClusterRecipe(current, {
        recipeId,
        ownerUnitId: unitId,
        slotNumber,
        sourceSlot,
      }));
      const recipeLabel = WEAPON_CLUSTER_RECIPES[recipeId]?.label || 'Cluster recipe';
      showToast(`${recipeLabel} linked to the active weapon slot.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not apply the cluster recipe.');
    }
  }, [showToast, transactProject]);

  useEffect(() => {
    if (activeInspectorTab === 'identity') {
      setInspectorTab('details');
    }
  }, [activeInspectorTab, setInspectorTab]);

  const selectInspectorParameter = useCallback(key => {
    setActiveRelationshipKey(key);
    requestAnimationFrame(() => {
      const panel = document.getElementById(`workspace-panel-${activeParamTab}`);
      const target = panel?.querySelector(`[data-param-key="${key}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      target?.querySelector('input, select, button')?.focus({ preventScroll: true });
    });
  }, [activeParamTab]);

  const activeCompiledOutput = activeOutputTab === 'tweakdefs_lua'
    ? generatedTweakDefsLua
    : activeOutputTab === 'tweakunits_lua'
      ? generatedTweakUnitsLua
      : activeOutputTab === 'tweakdefs_b64'
        ? tweakDefsB64
        : tweakUnitsB64;
  const activeCompiledOutputFallback = activeOutputTab.includes('lua') ? '{\n}' : 'No encoded output generated yet.';

  const editWorkspaceContext = useMemo(() => ({
    activeBuildMenuPackCount,
    activeCollection,
    activeCollectionId,
    activeCollectionModifiedCount,
    activeCollectionUnits,
    activeParamTab,
    activeRelationshipKey,
    activeWeaponSlotTab,
    allUnitsList,
    buildMenuSteps,
    clearUnitFilters,
    clones,
    compiledLobbyModules,
    comparisonMode,
    defaultsDb,
    disabledUnitIds,
    filteredUnits,
    getEffectiveTechTier,
    getInheritedCloneWeaponSwaps,
    getProjectUnitIconUrl,
    getTagsOfUnit,
    getValidationWarning,
    handleCatClick,
    handleApplyWeaponClusterRecipe,
    handleCloneBuildersChange,
    handleResetUnit,
    handleStatChange,
    handleStatPatch,
    hasActiveUnitFilters,
    includeClones,
    includeHeader,
    includeRosters,
    includeTweaks,
    inspectorTabs,
    knownTargetableMask,
    limitRisk,
    lobbyByteLimit,
    modifiedUnitIds,
    projectAuthor,
    projectChangeCount,
    projectDesc,
    projectName,
    resolveCloneRootId,
    scopedValidationIssues,
    selectedGadgetContracts,
    searchQuery,
    selectedCats,
    selectedFaction,
    selectedUnit,
    selectedUnitDefaults,
    selectedUnitId,
    selectedUnitOverrideEntries,
    selectInspectorParameter,
    setActiveCollectionId,
    setActiveParamTab,
    setActiveRelationshipKey,
    setActiveSummaryTab,
    setActiveSwapSlotNum,
    setActiveWeaponSlotTab,
    setActiveWorkspace,
    setClones,
    setComparisonMode,
    setDisabledUnitIds,
    setIncludeClones,
    setIncludeHeader,
    setIncludeRosters,
    setIncludeTweaks,
    setProjectAuthor,
    setProjectDesc,
    setProjectName,
    setSearchQuery,
    setSelectedFaction,
    setSelectedSwapUnitId,
    setSelectedUnitId,
    setShowAllUnitParams,
    setShowAllWeaponParams,
    setShowModifiedOnly,
    setShowSummaryModal,
    setShowSwapModal,
    setSwapPosition,
    setSwapSearchQuery,
    showAllUnitParams,
    showAllWeaponParams,
    showModifiedOnly,
    showToast,
    totalBytesUsed,
    tweaks,
    unitCollections,
    unitDescriptions,
    unitsDb,
    updateSelectedUnitDescription,
    workspaceLayout,
  }), [
    activeBuildMenuPackCount,
    activeCollection,
    activeCollectionId,
    activeCollectionModifiedCount,
    activeCollectionUnits,
    activeParamTab,
    activeRelationshipKey,
    activeWeaponSlotTab,
    allUnitsList,
    buildMenuSteps,
    clearUnitFilters,
    clones,
    compiledLobbyModules,
    comparisonMode,
    defaultsDb,
    disabledUnitIds,
    filteredUnits,
    getEffectiveTechTier,
    getInheritedCloneWeaponSwaps,
    getProjectUnitIconUrl,
    getTagsOfUnit,
    handleCatClick,
    handleApplyWeaponClusterRecipe,
    handleCloneBuildersChange,
    handleResetUnit,
    handleStatChange,
    handleStatPatch,
    hasActiveUnitFilters,
    includeClones,
    includeHeader,
    includeRosters,
    includeTweaks,
    inspectorTabs,
    knownTargetableMask,
    limitRisk,
    lobbyByteLimit,
    modifiedUnitIds,
    projectAuthor,
    projectChangeCount,
    projectDesc,
    projectName,
    resolveCloneRootId,
    scopedValidationIssues,
    selectedGadgetContracts,
    searchQuery,
    selectedCats,
    selectedFaction,
    selectedUnit,
    selectedUnitDefaults,
    selectedUnitId,
    selectedUnitOverrideEntries,
    selectInspectorParameter,
    setActiveCollectionId,
    setActiveParamTab,
    setActiveRelationshipKey,
    setActiveSummaryTab,
    setActiveSwapSlotNum,
    setActiveWeaponSlotTab,
    setActiveWorkspace,
    setClones,
    setComparisonMode,
    setDisabledUnitIds,
    setIncludeClones,
    setIncludeHeader,
    setIncludeRosters,
    setIncludeTweaks,
    setProjectAuthor,
    setProjectDesc,
    setProjectName,
    setSearchQuery,
    setSelectedFaction,
    setSelectedSwapUnitId,
    setSelectedUnitId,
    setShowAllUnitParams,
    setShowAllWeaponParams,
    setShowModifiedOnly,
    setShowSummaryModal,
    setShowSwapModal,
    setSwapPosition,
    setSwapSearchQuery,
    showAllUnitParams,
    showAllWeaponParams,
    showModifiedOnly,
    showToast,
    totalBytesUsed,
    tweaks,
    unitCollections,
    unitDescriptions,
    unitsDb,
    updateSelectedUnitDescription,
    workspaceLayout,
  ]);

  if (!showMainMenu && coreDataStatus !== 'ready') {
    return (
      <main className="core-data-gate" role={coreDataStatus === 'error' ? 'alert' : 'status'}>
        <img src="/logo.svg" alt="" />
        <span className="brand-kicker">BAR Editor</span>
        <h1>{coreDataStatus === 'error' ? 'Game definitions unavailable' : 'Preparing the unit library'}</h1>
        <p>{coreDataStatus === 'error' ? (coreDataError || 'Reload the editor to try loading the bundled BAR data again.') : 'Loading unit statistics and weapon definitions…'}</p>
        {coreDataStatus === 'error' && <Button variant="primary" onClick={() => window.location.reload()}>Reload editor</Button>}
      </main>
    );
  }

  if (showMainMenu) {
    return (
      <>
        {toast.show && <div className="toast">{toast.message}</div>}
        <MainMenu
          themeMode={themeMode}
          unitCount={allUnitsList.length || 1731}
          projectName={projectName}
          projectChangeCount={projectChangeCount}
          cloneCount={clones.length}
          rosterCount={buildMenuSteps.length + activeBuildMenuPackCount}
          presenceCount={onlineCount}
          presenceStatus={presenceStatus}
          presenceActivityCounts={presenceActivityCounts}
          currentPresenceActivity={presenceActivity}
          gameDataStatus={coreDataStatus}
          gameDataError={coreDataError}
          gameDataSnapshot={gameDataSnapshot}
          onToggleTheme={() => setThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
          onOpenCredits={() => setShowCreditsModal(true)}
          onEditUnits={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('edit');
            setShowMainMenu(false);
          }}
          onBuildMenus={() => {
            setShowPresetGallery(false);
            setShowDesignerPanel(true);
            setActiveWorkspace('designer');
            setShowMainMenu(false);
          }}
          onReviewExport={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('review');
            setShowMainMenu(false);
          }}
          onCollections={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('collections');
            setShowMainMenu(false);
          }}
          onPresetGallery={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(true);
            setActiveWorkspace('preset-gallery');
            setShowMainMenu(false);
          }}
          onTweakLab={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('tweak-lab');
            setShowMainMenu(false);
          }}
          onWeaponDefLibrary={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('weapondef-library');
            setShowMainMenu(false);
          }}
          onReferenceLibrary={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('reference-library');
            setShowMainMenu(false);
          }}
          onCommunity={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('community');
            setShowMainMenu(false);
          }}
          onLoadProject={handleImportConfig}
          onSaveProject={handleExportConfig}
        />
        <AppDialogs
          creditsOpen={showCreditsModal}
          chatOpen={false}
          commandPaletteOpen={showCommandPalette}
          checkpointsOpen={showProjectCheckpoints}
          chat={temporaryChat}
          commands={commandPaletteCommands}
          projectDocument={normalizedProjectDocument}
          onCloseCredits={() => setShowCreditsModal(false)}
          onCloseChat={closeTemporaryChat}
          onCloseCommandPalette={() => setShowCommandPalette(false)}
          onCloseCheckpoints={() => setShowProjectCheckpoints(false)}
          onRestoreCheckpoint={hydrateProjectStore}
          onNotice={showToast}
        />
      </>
    );
  }

  return (
    <div className="app-container" style={{ '--border-accent': factionAccentColor }}>
      {/* Toast */}
      {toast.show && <div className="toast">{toast.message}</div>}

      <AppHeader
        activeWorkspace={activeWorkspace}
        themeMode={themeMode}
        historyPastCount={historyPastCount}
        historyFutureCount={historyFutureCount}
        presence={{
          count: onlineCount,
          status: presenceStatus,
          activityCounts: presenceActivityCounts,
          currentActivity: presenceActivity,
        }}
        workflowProgress={workflowProgress}
        unreadChatCount={unreadChatCount}
        validationIssueCount={validationIssues.length}
        weaponLabEnabled={WEAPON_LAB_ENABLED}
        mutatorToolsEnabled={MUTATOR_TOOLS_ENABLED}
        onWorkspaceChange={workspaceId => {
          setShowDesignerPanel(workspaceId === 'designer');
          setActiveWorkspace(workspaceId);
        }}
        onMainMenu={() => setShowMainMenu(true)}
        onToggleTheme={() => setThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onCredits={() => setShowCreditsModal(true)}
        onChat={() => {
          markTemporaryChatRead();
          setShowChatModal(true);
        }}
        onClone={() => {
          if (!selectedUnit) {
            showToast('Please select a unit to clone first');
            return;
          }
          setCloneBaseId(selectedUnit.id);
          setCloneName(`${selectedUnit.name} (Clone)`);
          setCloneAutoAssignBuilders(false);
          setCloneBuilders([]);
          setShowClonePanel(true);
        }}
        onCommandPalette={() => setShowCommandPalette(true)}
        onCheckpoints={() => setShowProjectCheckpoints(true)}
        onCollections={() => {
          setShowDesignerPanel(false);
          setActiveWorkspace('collections');
        }}
        onCarrierWorkbench={() => setShowCarrierWorkbench(true)}
        onPresetGallery={() => {
          setShowPresetGallery(true);
          setActiveWorkspace('preset-gallery');
        }}
        onWeaponLab={openWeaponLab}
        onTweakLab={() => {
          setShowMainMenu(false);
          setShowDesignerPanel(false);
          setShowPresetGallery(false);
          setActiveWorkspace('tweak-lab');
        }}
        onWeaponDefLibrary={() => {
          setShowMainMenu(false);
          setShowDesignerPanel(false);
          setShowPresetGallery(false);
          setActiveWorkspace('weapondef-library');
        }}
        onReferenceLibrary={() => {
          setShowMainMenu(false);
          setShowDesignerPanel(false);
          setShowPresetGallery(false);
          setActiveWorkspace('reference-library');
        }}
        onCommunity={() => {
          setShowMainMenu(false);
          setShowDesignerPanel(false);
          setShowPresetGallery(false);
          setActiveWorkspace('community');
        }}
        onExport={handleExportConfig}
        onImport={handleImportConfig}
      />

      <AppDialogs
        creditsOpen={showCreditsModal}
        chatOpen={showChatModal}
        commandPaletteOpen={showCommandPalette}
        checkpointsOpen={showProjectCheckpoints}
        chat={temporaryChat}
        commands={commandPaletteCommands}
        projectDocument={normalizedProjectDocument}
        onCloseCredits={() => setShowCreditsModal(false)}
        onCloseChat={closeTemporaryChat}
        onCloseCommandPalette={() => setShowCommandPalette(false)}
        onCloseCheckpoints={() => setShowProjectCheckpoints(false)}
        onRestoreCheckpoint={hydrateProjectStore}
        onNotice={showToast}
      />

      {/* Main Workspace */}
      {activeWorkspace === 'edit' ? (
        <EditUnitsWorkspace context={editWorkspaceContext} />
      ) : activeWorkspace === 'collections' ? (
        <Suspense fallback={<main className="collections-page workspace-loading"><span>Preparing collections…</span></main>}>
          <LazyCollectionsPage
            collections={unitCollections}
            activeCollectionId={activeCollectionId}
            units={allUnitsList}
            selectedUnit={selectedUnit}
            tweaks={tweaks}
            validationIssues={validationIssues}
            onSelectCollection={setActiveCollectionId}
            onCreateCollection={handleCreateCollection}
            onRenameCollection={handleRenameCollection}
            onDeleteCollection={handleDeleteCollection}
            onToggleMembership={handleToggleCollectionMembership}
            onCleanupCollection={handleCleanupCollection}
            onEditUnit={id => { setSelectedUnitId(id); setActiveWorkspace('edit'); }}
            onBack={() => setActiveWorkspace('edit')}
          />
        </Suspense>
      ) : activeWorkspace === 'tweak-lab' ? (
        <Suspense fallback={<main className="tweak-package-lab workspace-loading"><span>Preparing Tweak Package Lab…</span></main>}>
          <LazyTweakPackageLabPage
            modules={tweakModules}
            lobbySetup={lobbySetup}
            supportingWeaponDefs={supportingWeaponDefs}
            compiledModules={compiledLobbyModules}
            onAddModules={handleAddTweakModules}
            onImportLobbyBundle={handleImportLobbyBundle}
            onClearLobbySetup={handleClearLobbySetup}
            onUpdateModule={handleUpdateTweakModule}
            onRemoveModule={handleRemoveTweakModule}
            onMoveModule={handleMoveTweakModule}
            onReorderModules={handleReorderTweakModules}
            onAddSupportingWeaponDefs={handleAddSupportingWeaponDefs}
            onOpenSupportingWeaponDefs={() => setActiveWorkspace('weapondef-library')}
            onApplyConversions={handleApplyTweakConversions}
            knownUnitIds={knownTweakPackageUnitIds}
            onBack={() => setActiveWorkspace('edit')}
            onToast={showToast}
          />
        </Suspense>
      ) : activeWorkspace === 'weapondef-library' ? (
        <Suspense fallback={<main className="weapondef-library-page workspace-loading"><span>Preparing WeaponDef Libraryâ€¦</span></main>}>
          <LazyWeaponDefLibraryPage
            definitions={supportingWeaponDefs}
            knownUnits={allUnitsList}
            tweaks={tweaks}
            clones={clones}
            weaponLibrary={weaponLibrary}
            sourceCatalog={weaponSourceCatalog}
            onAdd={handleAddSupportingWeaponDefs}
            onUpdate={handleUpdateSupportingWeaponDef}
            onRemove={handleRemoveSupportingWeaponDef}
            onOpenUnit={id => { setSelectedUnitId(id); setActiveWorkspace('edit'); }}
            onOpenTweakLab={() => setActiveWorkspace('tweak-lab')}
            onBack={() => setActiveWorkspace('edit')}
            onNotice={showToast}
          />
        </Suspense>
      ) : activeWorkspace === 'reference-library' ? (
        <Suspense fallback={<main className="bar-reference-library workspace-loading"><span>Preparing BAR Reference Library…</span></main>}>
          <LazyBarReferenceLibraryPage
            units={allUnitsList}
            defaultsDb={defaultsDb}
            explosionProfiles={explosionProfiles}
            onOpenUnit={id => { setSelectedUnitId(id); setActiveWorkspace('edit'); }}
            onBack={() => setActiveWorkspace('edit')}
            onToast={showToast}
          />
        </Suspense>
      ) : activeWorkspace === 'community' ? (
        <Suspense fallback={<main className="community-gallery-page workspace-loading"><span>Preparing Community Gallery…</span></main>}>
          <LazyCommunityGalleryPage
            currentProject={normalizedProjectDocument}
            currentSnapshot={gameDataSnapshot}
            currentLobbyCommands={lobbyCommands}
            currentCompiledLobbyModules={compiledLobbyModules}
            currentOptimizationProfile={exportOptimizationProfile}
            onOpenCopy={(communityDocument, communityTitle) => {
              const prepared = normalizeProjectDocumentWithReport(communityDocument);
              hydrateProjectStore({
                ...prepared.document,
                projectName: `${communityTitle || prepared.document.projectName} (Community Copy)`,
              });
              setActiveWorkspace('edit');
              showToast('Opened an independent community project copy.');
            }}
            onNotice={showToast}
            onBack={() => setActiveWorkspace('edit')}
          />
        </Suspense>
      ) : activeWorkspace === 'review' ? (
        <Suspense fallback={<main className="review-workspace workspace-loading"><span>Preparing project review…</span></main>}>
          <LazyReviewPage
            modifiedUnitIds={modifiedUnitIds}
            tweaks={tweaks}
            clones={clones}
            buildMenuSteps={buildMenuSteps}
            disabledUnitIds={disabledUnitIds}
            validationIssues={validationIssues}
            gadgetContractResults={gadgetContractResults}
            projectChangeCount={projectChangeCount}
            unitNames={unitsDb.names}
            projectName={projectName}
            projectAuthor={projectAuthor}
            projectDesc={projectDesc}
            setProjectName={setProjectName}
            setProjectAuthor={setProjectAuthor}
            setProjectDesc={setProjectDesc}
            includeTweaks={includeTweaks}
            includeClones={includeClones}
            includeRosters={includeRosters}
            includeHeader={includeHeader}
            exportOptimizationProfile={exportOptimizationProfile}
            setIncludeTweaks={setIncludeTweaks}
            setIncludeClones={setIncludeClones}
            setIncludeRosters={setIncludeRosters}
            setIncludeHeader={setIncludeHeader}
            setExportOptimizationProfile={setExportOptimizationProfile}
            activeOutputTab={activeOutputTab}
            setActiveOutputTab={setActiveOutputTab}
            activeCompiledOutput={activeCompiledOutput}
            activeCompiledOutputFallback={activeCompiledOutputFallback}
            tweakDefsB64={tweakDefsB64}
            tweakUnitsB64={tweakUnitsB64}
            totalBytesUsed={totalBytesUsed}
            lobbyByteLimit={lobbyByteLimit}
            compiledLobbyModules={compiledLobbyModules}
            lobbyCommands={lobbyCommands}
            tweakModules={tweakModules}
            lobbySetup={lobbySetup}
            supportingWeaponDefs={supportingWeaponDefs}
            weaponLibrary={weaponLibrary}
            knownUnitIds={knownTweakPackageUnitIds}
            collectionScope={collectionReviewScope}
            integrityReport={integrityReport}
            onRepairIntegrity={handleIntegrityRepair}
            onBack={() => setActiveWorkspace('edit')}
            onExport={handleExportConfig}
            onOpenSummary={tab => { setActiveSummaryTab(tab); setShowSummaryModal(true); }}
            onEditUnit={id => { setSelectedUnitId(id); setActiveWorkspace('edit'); }}
            onOpenTweakLab={() => setActiveWorkspace('tweak-lab')}
            onOpenBuildMenus={builderId => {
              if (builderId) setSelectedFactoryId(builderId);
              setShowDesignerPanel(true);
              setActiveWorkspace('designer');
            }}
            onOpenWeaponLab={openWeaponLab}
            onToast={showToast}
          />
        </Suspense>
      ) : null}


      {showDesignerPanel && activeWorkspace === 'designer' && (
        <Suspense fallback={<main className="designer-page designer-page-loading"><span>Loading build menu designer…</span></main>}>
          <LazyDesignerPage
            factoryId={selectedFactoryId}
            factoryName={selectedProducer?.name || unitsDb.names[selectedFactoryId] || selectedFactoryId}
            factoryIconUrl={getUnitIconUrl(selectedFactoryId)}
            activeSlotCount={activeRosterItems.filter(item => item.status !== 'removed').length}
            changeCount={buildMenuSteps.filter(step => step.builderId === selectedFactoryId).length}
            rosterPacks={buildMenuPacks}
            packDefinitions={BUILD_MENU_PACKS}
            producerCatalog={filteredProducers}
            producerCounts={producerCounts}
            producerSearch={factorySearchQuery}
            producerFaction={designerFaction}
            producerKind={producerKindFilter}
            rosterItems={activeRosterItems}
            availableUnits={availableUnitsForFactory}
            availableSearch={availableSearchQuery}
            availableFaction={availableFactionFilter}
            getUnitIconUrl={getProjectUnitIconUrl}
            isFactoryModified={factoryIsModified}
            onToggleRosterPack={packId => setBuildMenuPacks(current => ({ ...current, [packId]: !current[packId] }))}
            onProducerSearchChange={setFactorySearchQuery}
            onProducerFactionChange={setDesignerFaction}
            onProducerKindChange={setProducerKindFilter}
            onSelectProducer={setSelectedFactoryId}
            onResetProducer={() => {
              setBuildMenuSteps(previous => previous.filter(step => step.builderId !== selectedFactoryId));
              showToast(`Reset build options for ${selectedProducer?.name || selectedFactoryId} to the selected game setup`);
            }}
            onReorderRoster={unitIds => handleReorderFactoryRoster(selectedFactoryId, unitIds)}
            onRemoveRosterUnit={unitId => handleRemoveUnitFromFactory(selectedFactoryId, unitId)}
            onRestoreRosterUnit={unitId => handleRevertUnitInFactory(selectedFactoryId, unitId)}
            onAvailableSearchChange={setAvailableSearchQuery}
            onAvailableFactionChange={setAvailableFactionFilter}
            onAddRosterUnit={unitId => handleAddUnitToFactory(selectedFactoryId, unitId)}
            onClose={() => {
              setShowDesignerPanel(false);
              setActiveWorkspace('edit');
            }}
          />
        </Suspense>
      )}

      {/* Weapon Swap Modal */}
      {showSwapModal && (
        <WeaponSwapModal
          activeSwapSlotNum={activeSwapSlotNum}
          allUnitsList={allUnitsList}
          defaultsDb={defaultsDb}
          equipWeaponBlueprint={equipWeaponBlueprint}
          onBorrowWeapon={handleBorrowWeapon}
          onClose={closeSwapModal}
          onHeaderMouseDown={handleSwapHeaderMouseDown}
          openWeaponLab={openWeaponLab}
          selectedSwapBlueprintId={selectedSwapBlueprintId}
          selectedSwapUnitId={selectedSwapUnitId}
          selectedUnitDefaults={selectedUnitDefaults}
          setSelectedSwapBlueprintId={setSelectedSwapBlueprintId}
          setSelectedSwapUnitId={setSelectedSwapUnitId}
          setSwapLibraryMode={setSwapLibraryMode}
          setSwapSearchQuery={setSwapSearchQuery}
          setSwapUnitFactionFilter={setSwapUnitFactionFilter}
          setSwapWeaponTypeFilter={setSwapWeaponTypeFilter}
          swapLibraryMode={swapLibraryMode}
          swapPosition={swapPosition}
          swapSearchQuery={swapSearchQuery}
          swapUnitFactionFilter={swapUnitFactionFilter}
          swapWeaponTypeFilter={swapWeaponTypeFilter}
          unitNames={unitsDb.names}
          weaponLibrary={weaponLibrary}
        />
      )}

      {/* Weapon Laboratory */}
      {showWeaponLab && activeWorkspace === 'weapon-lab' && weaponBlueprintDraft && (
        <Suspense fallback={<main className="weapon-laboratory workspace-loading"><span>Preparing Weapon Laboratory…</span></main>}>
          <LazyWeaponLaboratoryPage
            draft={weaponBlueprintDraft}
            library={weaponLibrary}
            sourceCatalog={weaponSourceCatalog}
            onDraftChange={setWeaponBlueprintDraft}
            onCloneSource={cloneWeaponSourceToDraft}
            onSave={draft => {
              const blueprint = persistWeaponBlueprint(draft);
              if (blueprint) showToast('Custom weapon saved to project storage.');
              return blueprint;
            }}
            onDelete={blueprintId => {
              deleteWeaponBlueprint(blueprintId);
            }}
            onExportVfx={handleDownloadWeaponVfxPack}
            onClose={() => {
              setShowWeaponLab(false);
              setActiveWorkspace('edit');
            }}
          />
        </Suspense>
      )}

      {MUTATOR_TOOLS_ENABLED && showRandomPanel && (
        <Suspense fallback={null}>
          <LazyMutationLabDialog
            acknowledged={wipRandomPanelAcknowledged}
            scope={randomScope}
            intensity={randomIntensity}
            domains={randomDomains}
            selectedUnitName={selectedUnit?.name}
            filteredUnitCount={filteredUnits.length}
            onAcknowledge={() => setWipRandomPanelAcknowledged(true)}
            onScopeChange={setRandomScope}
            onIntensityChange={setRandomIntensity}
            onDomainsChange={setRandomDomains}
            onApply={handleRandomAdjustments}
            onClose={() => setShowRandomPanel(false)}
          />
        </Suspense>
      )}

      {/* Preset Gallery Page — lazy loaded on entry */}
      {showPresetGallery && activeWorkspace === 'preset-gallery' && (
        <Suspense fallback={<main className="workspace-loading"><span>Loading experiment library…</span></main>}>
          <LazyPresetGalleryPage
            presets={presets}
            projectName={projectName}
            presetName={presetName}
            presetDescription={presetDescription}
            onPresetNameChange={setPresetName}
            onPresetDescriptionChange={setPresetDescription}
            onSave={handleSavePreset}
            onApply={handleApplyPreset}
            onDelete={handleDeletePreset}
            onClose={() => { setShowPresetGallery(false); setActiveWorkspace('edit'); }}
          />
        </Suspense>
      )}

      <CloneCreatorDialog
        open={showClonePanel}
        baseId={cloneBaseId}
        baseName={selectedUnit?.name}
        baseIconUrl={getProjectUnitIconUrl(cloneBaseId)}
        baseFaction={selectedUnit?.faction}
        baseTier={selectedUnit?.tags?.find(tag => /^t[1-4]$/.test(tag))}
        newId={cloneNewId}
        name={cloneName}
        description={cloneDesc}
        builders={cloneBuilders}
        autoAssignBuilders={cloneAutoAssignBuilders}
        onNewIdChange={setCloneNewId}
        onNameChange={setCloneName}
        onDescriptionChange={setCloneDesc}
        onBuildersChange={setCloneBuilders}
        onAutoAssignChange={enabled => {
          setCloneAutoAssignBuilders(enabled);
          setCloneBuilders(enabled ? getAutomaticCloneBuilders(cloneBaseId) : []);
        }}
        onSubmit={handleCreateClone}
        onClose={() => setShowClonePanel(false)}
      />

      {MUTATOR_TOOLS_ENABLED && showBulkPanel && <Suspense fallback={null}><LazyBatchAdjustDialog
        open={showBulkPanel}
        onClose={() => setShowBulkPanel(false)}
        parameterGroups={BULK_PARAMETER_GROUPS}
        statKey={bulkStatKey}
        onStatKeyChange={setBulkStatKey}
        mode={bulkMode}
        onModeChange={setBulkMode}
        value={bulkPercent}
        onValueChange={setBulkPercent}
        targetUnits={bulkTargetUnits}
        scopeLabel={activeCollection ? `Collection · ${activeCollection.name}` : 'Current filters'}
        onApply={handleApplyBulk}
      /></Suspense>}
      {MUTATOR_TOOLS_ENABLED && showFormulaMutator && <Suspense fallback={null}><LazyFormulaMutatorDialog
        open={showFormulaMutator}
        onClose={() => setShowFormulaMutator(false)}
        units={allUnitsList}
        selectedUnit={selectedUnit}
        activeCollection={activeCollection}
        filteredUnits={filteredUnits}
        defaultsDb={defaultsDb}
        tweaks={tweaks}
        onApplyFormula={handleApplyFormula}
      /></Suspense>}
      {showCarrierWorkbench && <Suspense fallback={null}><LazyCarrierDroneWorkbenchDialog
        open={showCarrierWorkbench}
        onClose={() => setShowCarrierWorkbench(false)}
        units={allUnitsList}
        clones={clones}
        selectedUnit={selectedUnit}
        initialWeaponSlot={activeWeaponSlotTab}
        defaultsDb={defaultsDb}
        tweaks={tweaks}
        onApplyLinkage={handleApplyCarrierLinkage}
        onCreateClone={handleQuickCreateCloneFromWorkbench}
      /></Suspense>}
      {showSummaryModal && <Suspense fallback={null}><LazySummaryExplorerDialog
        open={showSummaryModal}
        activeTab={activeSummaryTab}
        onTabChange={setActiveSummaryTab}
        onClose={() => setShowSummaryModal(false)}
        tweaks={tweaks}
        clones={clones}
        disabledUnitIds={disabledUnitIds}
        unitDescriptions={unitDescriptions}
        buildMenuSteps={buildMenuSteps}
        buildMenuPacks={buildMenuPacks}
        unitNames={unitsDb.names}
        onResetUnitEdits={handleResetSummaryUnitEdits}
        onResetAllUnitEdits={handleResetAllSummaryUnitEdits}
        onDeleteClone={handleDeleteSummaryClone}
        onDeleteAllClones={handleDeleteAllSummaryClones}
        onRevertRoster={handleRevertSummaryRoster}
        onResetAllRosters={handleResetAllSummaryRosters}
        onDisableBuildMenuPack={handleDisableSummaryBuildMenuPack}
        onRestoreUnit={handleRestoreSummaryUnit}
        onRestoreAllUnits={handleRestoreAllSummaryUnits}
        onResetAllChanges={handleResetAllProjectChanges}
      /></Suspense>}
    </div>
  );
}
