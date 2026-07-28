import { lazy, Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { BUILD_MENU_PACKS } from './data/build-menu-packs.js';
import { getFactionOfUnit, getTechTierFromValue } from './utils/categories.js';
import { useOnlinePresence } from './hooks/useOnlinePresence.js';
import { useTemporaryChat } from './hooks/useTemporaryChat.js';
import { useProjectPersistence } from './hooks/useProjectPersistence.js';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout.js';
import { useCoreGameData } from './hooks/useCoreGameData.js';
import { useCompiledProjectOutputs } from './hooks/useCompiledProjectOutputs.js';
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
import UnitArtwork from './components/UnitArtwork.jsx';
import { getBuildPicturePreviewUrl, getUnitIconUrl } from './utils/unitArtwork.js';
import { useFactoryRosterController } from './controllers/useFactoryRosterController.js';
import {
  getValidationWarning,
  useProjectValidation,
} from './controllers/useProjectValidation.js';
import { useCloneController } from './controllers/useCloneController.js';
import { useTweakPackageController } from './controllers/useTweakPackageController.js';
import { useProjectFileController } from './controllers/useProjectFileController.js';
import { Button, Switch } from './components/ui.jsx';
import EditUnitsWorkspace from './components/editor/EditUnitsWorkspace.jsx';
import { getRelationshipLabel } from './config/parameterGuidance.js';
import { collectKnownTargetableMask } from './config/behaviorInterceptor.js';
import {
  createUnitCollection,
  deleteCollectionAndPromoteChildren,
  getCollectionUnitIds,
} from './project/unitCollections.js';

const LazyDesignerPage = lazy(() => import('./components/DesignerPage.jsx'));
const LazyCollectionsPage = lazy(() => import('./components/CollectionsPage.jsx'));
const LazyPresetGalleryPage = lazy(() => import('./components/PresetGalleryPage.jsx'));
const LazyReviewPage = lazy(() => import('./components/ReviewPage.jsx'));
const LazyBatchAdjustDialog = lazy(() => import('./components/BatchAdjustDialog.jsx'));
const LazySummaryExplorerDialog = lazy(() => import('./components/SummaryExplorerDialog.jsx'));
const LazyTweakPackageLabPage = lazy(() => import('./components/TweakPackageLabPage.jsx'));
const LazyBarReferenceLibraryPage = lazy(() => import('./components/BarReferenceLibraryPage.jsx'));
const LazyFormulaMutatorDialog = lazy(() => import('./components/FormulaMutatorDialog.jsx'));
const LazyCarrierDroneWorkbenchDialog = lazy(() => import('./components/CarrierDroneWorkbenchDialog.jsx'));
const LazyMutationLabDialog = lazy(() => import('./components/MutationLabDialog.jsx'));

// Keep the laboratory code available while this experimental workspace is temporarily unpublished.
const WEAPON_LAB_ENABLED = false;
// Keep these implementations available for repair, but prevent broken bulk
// mutation tools from changing project data through any public entry point.
const MUTATOR_TOOLS_ENABLED = false;
const BULK_PARAMETER_GROUPS = [
  {
    label: 'Common unit stats',
    options: [
      { value: 'health', label: 'Unit Health (HP)', description: 'Adjust the maximum durability of every eligible unit.' },
      { value: 'metalcost', label: 'Metal Cost', description: 'Adjust the metal investment required to build each unit.' },
      { value: 'energycost', label: 'Energy Cost', description: 'Adjust the energy investment required to build each unit.' },
      { value: 'buildtime', label: 'Build Time', description: 'Adjust the build work required to complete each unit.' },
      { value: 'maxvelocity', label: 'Max Velocity (Speed)', description: 'Adjust the maximum movement speed of eligible units.' },
    ],
  },
  {
    label: 'Weapon slots',
    options: [
      { value: 'all_weapons_damage', label: 'All Weapons Damage', description: 'Adjust every weapon slot’s base damage for each eligible unit.' },
      { value: 'all_weapons_range', label: 'All Weapons Range', description: 'Adjust every weapon slot’s maximum range for each eligible unit.' },
    ],
  },
  {
    label: 'Additional numeric stats',
    options: STAT_KEYS
      .filter(stat => stat.type === 'number' && !['health', 'metalcost', 'energycost', 'buildtime', 'maxvelocity'].includes(stat.key))
      .map(stat => ({
        value: stat.key,
        label: stat.label,
        description: `Adjust ${stat.label.toLowerCase()} across every eligible unit.`,
      })),
  },
];

function hexToRgbUnit(hex) {
  const clean = String(hex || '#ffffff').replace('#', '').padEnd(6, 'f').slice(0, 6);
  return [0, 2, 4].map(index => parseInt(clean.slice(index, index + 2), 16) / 255);
}

function generateWeaponVfxPackLua(blueprints) {
  const entries = [];
  const inRange = (value, min, max, fallback) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  };
  blueprints.filter(item => item.appearance?.vfxEnabled).forEach(blueprint => {
    const safeId = blueprint.id.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const appearance = blueprint.appearance || {};
    const primary = hexToRgbUnit(appearance.color);
    const secondary = hexToRgbUnit(appearance.secondaryColor || appearance.color);
    const brightness = inRange(appearance.brightness, 0.1, 2, 1);
    const particleSize = inRange(appearance.particleSize, 1, 40, 5);
    const particleCount = Math.round(inRange(appearance.particleCount, 1, 32, 4));
    const particleLife = Math.round(inRange(appearance.particleLife, 1, 90, 12));
    const spread = inRange(appearance.spread, 0, 90, 3);
    const trailSize = inRange(appearance.trailSize, 1, 80, particleSize * 1.35);
    const trailLength = inRange(appearance.trailLength, 1, 160, particleSize * 4);
    const trailGrowth = inRange(appearance.trailGrowth, -1, 5, 0.15);
    const trailLife = Math.round(inRange(appearance.trailLife, 1, 60, 5));
    const trailOffset = inRange(appearance.trailOffset, 0, 1, 0.2);
    const heatSize = inRange(appearance.heatSize, 1, 120, particleSize * 2.4);
    const heatGrowth = inRange(appearance.heatGrowth, 0, 20, Math.max(0.2, particleSize * 0.08));
    const heatFalloff = inRange(appearance.heatFalloff, 0.1, 12, 1.1);
    const flashSize = inRange(appearance.flashSize, 1, 250, particleSize * 5);
    const flashAlpha = inRange(appearance.flashAlpha, 0, 1, 0.55);
    const flashGrowth = inRange(appearance.flashGrowth, 0, 40, particleSize * 0.55);
    const flashLife = Math.round(inRange(appearance.flashLife, 1, 60, 8));
    const texture = String(appearance.texture || 'flare').replace(/[^a-z0-9_-]/gi, '') || 'flare';
    const colorMap = `${primary.map(v => Math.min(1, v * brightness).toFixed(3)).join(' ')} 0.85  ${secondary.map(v => Math.min(1, v * brightness).toFixed(3)).join(' ')} 0.35  0 0 0 0.01`;

    entries.push(`  ["bmf_${safeId}_trail"] = {\n    usedefaultexplosions = false,\n    muzzleflare = {\n      air = true, ground = true, water = true, underwater = true,\n      class = "CBitmapMuzzleFlame", count = 1,\n      properties = {\n        colormap = [[${colorMap}]], dir = [[dir]], frontoffset = ${trailOffset.toFixed(2)},\n        fronttexture = [[${texture}]], sidetexture = [[${texture}]],\n        length = ${trailLength.toFixed(2)}, size = ${trailSize.toFixed(2)}, sizegrowth = ${trailGrowth.toFixed(2)}, ttl = ${trailLife},\n      },\n    },\n  }`);
    const impactSpawners = [];
    if (appearance.heatEnabled !== false) impactSpawners.push(`    core = {\n      air = true, ground = true, water = true, underwater = true,\n      class = "CHeatCloudProjectile", count = 1,\n      properties = {\n        heat = ${Math.round(12 * brightness)}, maxheat = ${Math.round(16 * brightness)}, heatfalloff = ${heatFalloff.toFixed(2)},\n        pos = [[0, 3, 0]], size = ${heatSize.toFixed(2)}, sizegrowth = ${heatGrowth.toFixed(2)}, texture = [[${texture}]],\n      },\n    }`);
    if (appearance.particlesEnabled !== false) impactSpawners.push(`    sparks = {\n      air = true, ground = true, water = true, underwater = true,\n      class = "CSimpleParticleSystem", count = 1,\n      properties = {\n        airdrag = 0.88, colormap = [[${colorMap}]], directional = true,\n        emitrot = 35, emitrotspread = ${spread.toFixed(2)}, emitvector = [[0, 1, 0]],\n        gravity = [[0, -0.08, 0]], numparticles = ${particleCount * 2},\n        particlelife = ${particleLife}, particlelifespread = 4, particlesize = ${(particleSize * 0.8).toFixed(2)},\n        particlespeed = ${Math.max(1, particleSize * 0.45).toFixed(2)}, particlespeedspread = 1.5,\n        sizegrowth = -0.04, texture = [[${texture}]],\n      },\n    }`);
    if (appearance.groundFlashEnabled !== false) impactSpawners.push(`    groundflash = {\n      color = [[${primary.map(v => v.toFixed(3)).join(' ')}]], circlealpha = ${(flashAlpha * 0.55).toFixed(2)}, circlegrowth = ${flashGrowth.toFixed(2)},\n      flashalpha = ${flashAlpha.toFixed(2)}, flashsize = ${flashSize.toFixed(2)}, ttl = ${flashLife},\n    }`);
    entries.push(`  ["bmf_${safeId}_impact"] = {\n    usedefaultexplosions = false,\n${impactSpawners.join(',\n')}\n  }`);
  });
  return `-- Generated by BAR Editor Weapon Laboratory\n-- Place this file inside your mod's effects/ directory.\nreturn {\n${entries.join(',\n')}\n}\n`;
}

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

  const [showMainMenu, setShowMainMenu] = useState(true);
  const [activeWorkspace, setActiveWorkspace] = useState('edit');
  const [themeMode, setThemeMode] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('bmf_theme');
      return savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : 'dark';
    } catch {
      return 'dark';
    }
  });
  const [selectedFaction, setSelectedFaction] = useState('all');
  const [selectedCats, setSelectedCats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showModifiedOnly, setShowModifiedOnly] = useState(false);
  const [activeCollectionId, setActiveCollectionId] = useState(null);
  const [selectedUnitId, setSelectedUnitId] = useState('armdfly');
  const [unitListScrollTop, setUnitListScrollTop] = useState(0);
  const [unitListViewportHeight, setUnitListViewportHeight] = useState(0);
  const unitListContainerRef = useRef(null);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    try {
      localStorage.setItem('bmf_theme', themeMode);
    } catch {
      // Preferences are optional when storage is unavailable.
    }
  }, [themeMode]);

  const {
    state: projectStore,
    setTweaks, setClones, setDisabledUnitIds, setUnitDescriptions,
    setBuildMenuSteps, setBuildMenuPacks, setPresets, setWeaponLibrary, setSupportingWeaponDefs, setUnitCollections, setTweakModules, setLobbySetup,
    setProjectName, setProjectAuthor, setProjectDesc,
    setIncludeTweaks, setIncludeClones, setIncludeRosters, setIncludeHeader,
    transactProject, applyProjectSnapshot, hydrateProjectStore,
    undoProject, redoProject, historyPastCount, historyFutureCount,
  } = useProjectStore();
  const {
    tweaks, clones, disabledUnitIds, unitDescriptions, buildMenuSteps, buildMenuPacks,
    presets, weaponLibrary, supportingWeaponDefs, unitCollections, tweakModules, lobbySetup, projectName, projectAuthor, projectDesc,
    includeTweaks, includeClones, includeRosters, includeHeader,
  } = projectStore;

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

  const getProjectUnitIconUrl = (unitId) => {
    const editedBuildPicture = tweaks[unitId]?.buildpic;
    const editedPreview = getBuildPicturePreviewUrl(editedBuildPicture);
    if (editedPreview) return editedPreview;
    return getUnitIconUrl(resolveCloneRootId(unitId));
  };

  const [base64Options, setBase64Options] = useState({ padding: false });
  const tweakDefsLua = '';
  const [toast, setToast] = useState({ show: false, message: '' });

  // Bulk Edit states
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [showFormulaMutator, setShowFormulaMutator] = useState(false);
  const [showCarrierWorkbench, setShowCarrierWorkbench] = useState(false);
  const [showRandomPanel, setShowRandomPanel] = useState(false);
  const [wipRandomPanelAcknowledged, setWipRandomPanelAcknowledged] = useState(false);
  const [randomScope, setRandomScope] = useState('selected');
  const [randomIntensity, setRandomIntensity] = useState('balanced');
  const [randomDomains, setRandomDomains] = useState({ economy: true, durability: true, mobility: true, weapons: true });
  const [bulkStatKey, setBulkStatKey] = useState('health');
  const [bulkPercent, setBulkPercent] = useState('10');
  const [bulkMode, setBulkMode] = useState('percent');

  // Build Menu Designer Modal states
  const [showDesignerPanel, setShowDesignerPanel] = useState(false);

  // Weapon Swap states
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapSearchQuery, setSwapSearchQuery] = useState('');
  const workspaceLayout = useWorkspaceLayout();
  const [selectedSwapUnitId, setSelectedSwapUnitId] = useState(null);
  const [activeSwapSlotNum, setActiveSwapSlotNum] = useState(1);
  const [activeWeaponSlotTab, setActiveWeaponSlotTab] = useState(1);
  const [swapWeaponTypeFilter, setSwapWeaponTypeFilter] = useState('all');
  const [swapUnitFactionFilter, setSwapUnitFactionFilter] = useState('all');
  const [activeParamTab, setActiveParamTab] = useState('structure');
  const [comparisonMode, setComparisonMode] = useState(false);
  const [showAllUnitParams, setShowAllUnitParams] = useState(() => {
    try {
      return localStorage.getItem('editp_unit_parameter_view_v1') === 'all';
    } catch {
      return false;
    }
  });
  const [showAllWeaponParams, setShowAllWeaponParams] = useState(() => {
    try {
      const savedPreference = localStorage.getItem('editp_weapon_parameter_view_v2');
      return savedPreference === 'all';
    } catch {
      return false;
    }
  });
  const [activeRelationshipKey, setActiveRelationshipKey] = useState(null);

  useEffect(() => {
    setActiveRelationshipKey(null);
  }, [selectedUnitId, activeParamTab, activeWeaponSlotTab]);

  useEffect(() => {
    try {
      localStorage.setItem('editp_unit_parameter_view_v1', showAllUnitParams ? 'all' : 'relevant');
    } catch {
      // The preference remains available for this session when storage is blocked.
    }
  }, [showAllUnitParams]);

  useEffect(() => {
    try {
      localStorage.setItem('editp_weapon_parameter_view_v2', showAllWeaponParams ? 'all' : 'relevant');
    } catch {
      // The preference remains available for this session when storage is blocked.
    }
  }, [showAllWeaponParams]);

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

  // Summary Explorer states
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [activeSummaryTab, setActiveSummaryTab] = useState('tweaks');
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showProjectCheckpoints, setShowProjectCheckpoints] = useState(false);
  const temporaryChat = useTemporaryChat(showChatModal);
  const [chatReadAt, setChatReadAt] = useState(() => Date.now());
  const [showPresetGallery, setShowPresetGallery] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [presetDescription, setPresetDescription] = useState('');
  const [showWeaponLab, setShowWeaponLab] = useState(false);
  const [weaponBlueprintDraft, setWeaponBlueprintDraft] = useState(null);
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
      || activeWorkspace === 'reference-library'
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
  // Active Output tab
  const [activeOutputTab, setActiveOutputTab] = useState('tweakdefs_lua'); // 'tweakunits_lua' | 'tweakdefs_lua' | 'tweakunits_b64' | 'tweakdefs_b64'

  const unreadChatCount = useMemo(() => {
    if (showChatModal) return 0;
    return temporaryChat.messages.filter(message => (
      message.sender_id !== temporaryChat.identity.id
      && Date.parse(message.created_at) > chatReadAt
    )).length;
  }, [chatReadAt, showChatModal, temporaryChat.identity.id, temporaryChat.messages]);

  const closeTemporaryChat = useCallback(() => {
    setShowChatModal(false);
    setChatReadAt(Date.now());
  }, []);

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

  const createPresetSnapshot = () => ({
    tweaks,
    clones,
    disabledUnitIds,
    unitDescriptions,
    buildMenuSteps,
    buildMenuPacks,
    weaponLibrary,
    supportingWeaponDefs,
    unitCollections,
    tweakModules,
    lobbySetup,
    projectName,
    projectAuthor,
    projectDesc,
    includeTweaks,
    includeClones,
    includeRosters,
    includeHeader
  });

  const handleSavePreset = () => {
    const name = presetName.trim() || `${projectName} preset`;
    const snapshot = createPresetSnapshot();
    const preset = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name,
      description: presetDescription.trim(),
      createdAt: new Date().toISOString(),
      snapshot
    };
    setPresets(prev => [preset, ...prev].slice(0, 30));
    setPresetName('');
    setPresetDescription('');
    showToast(`Saved preset: ${name}`);
  };

  const handleApplyPreset = (preset) => {
    const snapshot = preset.snapshot || {};
    applyProjectSnapshot(snapshot);
    setShowPresetGallery(false);
    showToast(`Applied preset: ${preset.name}`);
  };

  // Compile list of units (vanilla + clones)
  const allUnitsList = useMemo(() => {
    const list = Object.entries(unitsDb.names).filter(([id]) => Boolean(defaultsDb[id])).map(([id, name]) => {
      const faction = getFactionOfUnit(id);
      const techTier = getEffectiveTechTier(id);
      const tags = [...getTagsOfUnit(id).filter(tag => !/^t[1-4]$/.test(tag)), techTier];
      return {
        id,
        name,
        desc: unitsDb.descriptions[id] || '',
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
      list.push({
        id: c.newId,
        name: c.displayName || c.newId,
        desc: `Cloned from ${cloneNames.get(parentId) || unitsDb.names[parentId] || c.baseId}`,
        faction: getFactionOfUnit(rootBaseId),
        tags: [...getTagsOfUnit(rootBaseId).filter(tag => !/^t[1-4]$/.test(tag)), techTier],
        techTier,
        isClone: true,
        baseId: c.baseId,
        rootBaseId
      });
    });

    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [clones, defaultsDb, getEffectiveTechTier, getInheritedCloneTweaks, getTagsOfUnit, resolveCloneRootId, unitsDb.descriptions, unitsDb.names]);
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
      unit.desc.toLowerCase().includes(lowerQuery);
  }, [searchQuery, defaultsDb, resolveCloneRootId]);

  // Filter list
  const filteredUnits = useMemo(() => {
    return allUnitsList.filter(unit => {
      if (activeCollectionUnitIds && !activeCollectionUnitIds.has(unit.id)) return false;
      if (selectedFaction !== 'all' && unit.faction !== selectedFaction) {
        return false;
      }
      if (selectedCats.length > 0) {
        const hasAllCats = selectedCats.every(cat => unit.tags.includes(cat));
        if (!hasAllCats) return false;
      }
      if (showModifiedOnly) {
        const hasTweaks = Boolean(tweaks[unit.id] && Object.keys(tweaks[unit.id]).length > 0);
        const isDisabled = disabledUnitIds.includes(unit.id);
        if (!hasTweaks && !isDisabled && !unit.isClone) return false;
      }
      return queryFilterFn(unit);
    });
  }, [activeCollectionUnitIds, allUnitsList, selectedFaction, selectedCats, queryFilterFn, showModifiedOnly, tweaks, disabledUnitIds]);

  const bulkTargetUnits = useMemo(() => filteredUnits.filter(unit => {
    const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
    return defaultsDb[baseId] !== undefined;
  }), [filteredUnits, defaultsDb, resolveCloneRootId]);

  const clearUnitFilters = () => {
    setSearchQuery('');
    setSelectedFaction('all');
    setSelectedCats([]);
    setShowModifiedOnly(false);
    setActiveCollectionId(null);
  };

  const hasActiveUnitFilters = Boolean(activeCollection || searchQuery.trim() || selectedFaction !== 'all' || selectedCats.length > 0 || showModifiedOnly);

  const unitRowHeight = 58;
  const unitListOverscan = 8;
  const virtualUnitRange = useMemo(() => {
    const estimatedViewportRows = 18;
    const start = Math.max(0, Math.floor(unitListScrollTop / unitRowHeight) - unitListOverscan);
    const end = Math.min(filteredUnits.length, start + estimatedViewportRows + unitListOverscan * 2);
    return {
      start,
      end,
      units: filteredUnits.slice(start, end)
    };
  }, [filteredUnits, unitListScrollTop]);

  const unitScrollHint = useMemo(() => {
    const viewportHeight = unitListViewportHeight || unitRowHeight * 18;
    const visibleEnd = Math.min(filteredUnits.length, Math.ceil((unitListScrollTop + viewportHeight) / unitRowHeight));
    const remaining = Math.max(0, filteredUnits.length - visibleEnd);
    return { remaining, hasMore: remaining > 0 };
  }, [filteredUnits.length, unitListScrollTop, unitListViewportHeight]);

  useEffect(() => {
    setUnitListScrollTop(0);
    unitListContainerRef.current?.scrollTo({ top: 0 });
  }, [activeCollectionId, searchQuery, selectedFaction, selectedCats, showModifiedOnly]);

  useEffect(() => {
    const container = unitListContainerRef.current;
    if (!container) return undefined;
    const updateViewport = () => setUnitListViewportHeight(container.clientHeight);
    updateViewport();
    const observer = new ResizeObserver(updateViewport);
    observer.observe(container);
    return () => observer.disconnect();
  }, [activeWorkspace, showMainMenu]);

  // Selection defaults
  useEffect(() => {
    if (filteredUnits.length > 0 && !selectedUnitId) {
      setSelectedUnitId(filteredUnits[0].id);
    }
  }, [filteredUnits, selectedUnitId]);

  const selectedUnit = useMemo(() => {
    return allUnitsList.find(u => u.id === selectedUnitId) || null;
  }, [allUnitsList, selectedUnitId]);

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
              const overrides = blueprint?.overrides || {};
              return {
                ...srcSlot,
                damage: Number.isFinite(Number(overrides.damage)) ? Number(overrides.damage) : srcSlot.damage,
                range: Number.isFinite(Number(overrides.range)) ? Number(overrides.range) : srcSlot.range,
                reload: Number.isFinite(Number(overrides.reload)) ? Number(overrides.reload) : srcSlot.reload,
                velocity: Number.isFinite(Number(overrides.velocity)) ? Number(overrides.velocity) : srcSlot.velocity,
                aoe: Number.isFinite(Number(overrides.aoe)) ? Number(overrides.aoe) : srcSlot.aoe,
                projectiles: Number.isFinite(Number(overrides.projectiles)) ? Number(overrides.projectiles) : srcSlot.projectiles,
                burst: Number.isFinite(Number(overrides.burst)) ? Number(overrides.burst) : srcSlot.burst,
                burstrate: Number.isFinite(Number(overrides.burstrate)) ? Number(overrides.burstrate) : srcSlot.burstrate,
                cegTag: overrides.cegtag || srcSlot.cegTag,
                explosiongenerator: overrides.explosiongenerator || srcSlot.explosiongenerator,
                model: overrides.model || srcSlot.model,
                slot: wSlot.slot // Retain destination slot number
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

  const openWeaponLab = () => {
    if (!WEAPON_LAB_ENABLED) {
      showToast('Weapon Laboratory is temporarily unavailable.');
      return;
    }
    const activeSlot = selectedUnitDefaults?.weaponSlots?.find(slot => slot.slot === activeWeaponSlotTab)
      || selectedUnitDefaults?.weaponSlots?.[0];
    if (!selectedUnit || !activeSlot) {
      showToast('Select a unit with an active weapon slot first.');
      return;
    }
    const sourceUnitId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
    setWeaponBlueprintDraft({
      id: '',
      name: `${activeSlot.defKey.toUpperCase()} Variant`,
      sourceUnitId,
      sourceWeaponDefKey: activeSlot.defKey,
      description: '',
      appearance: {
        vfxEnabled: true,
        color: '#c69a68',
        secondaryColor: '#f0d5a8',
        brightness: 1,
        particleSize: 5,
        particleCount: 4,
        particleLife: 12,
        spread: 3,
        texture: 'flare',
        trailSize: 7,
        trailLength: 20,
        trailGrowth: 0.15,
        trailLife: 5,
        trailOffset: 0.2,
        particlesEnabled: true,
        heatEnabled: true,
        heatSize: 12,
        heatGrowth: 0.4,
        heatFalloff: 1.1,
        groundFlashEnabled: true,
        flashSize: 25,
        flashAlpha: 0.55,
        flashGrowth: 3,
        flashLife: 8
      },
      overrides: {
        damage: activeSlot.damage ?? '',
        range: activeSlot.range ?? '',
        reload: activeSlot.reload ?? '',
        velocity: activeSlot.velocity ?? '',
        aoe: activeSlot.aoe ?? '',
        projectiles: activeSlot.projectiles ?? '',
        burst: activeSlot.burst ?? '',
        burstrate: activeSlot.burstrate ?? '',
        accuracy: activeSlot.accuracy ?? '',
        sprayangle: activeSlot.sprayangle ?? '',
        flighttime: activeSlot.flighttime ?? '',
        cegtag: activeSlot.cegTag || '',
        explosiongenerator: activeSlot.explosiongenerator || '',
        model: activeSlot.model || ''
      }
    });
    setShowWeaponLab(true);
    setActiveWorkspace('weapon-lab');
  };

  const persistWeaponBlueprint = (draft = weaponBlueprintDraft) => {
    if (!draft?.sourceUnitId || !draft?.sourceWeaponDefKey) return null;
    const id = draft.id || `weapon_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const safeId = id.replace(/[^a-z0-9_]/gi, '_').toLowerCase();
    const appearance = {
      vfxEnabled: false,
      secondaryColor: draft.appearance?.color || '#ffffff',
      particleSize: 5,
      particleCount: 4,
      particleLife: 12,
      spread: 3,
      texture: 'flare',
      trailSize: 7,
      trailLength: 20,
      trailGrowth: 0.15,
      trailLife: 5,
      trailOffset: 0.2,
      particlesEnabled: true,
      heatEnabled: true,
      heatSize: 12,
      heatGrowth: 0.4,
      heatFalloff: 1.1,
      groundFlashEnabled: true,
      flashSize: 25,
      flashAlpha: 0.55,
      flashGrowth: 3,
      flashLife: 8,
      ...draft.appearance
    };
    const blueprint = {
      ...draft,
      id,
      appearance,
      overrides: {
        ...draft.overrides,
        ...(appearance.vfxEnabled ? {
          cegtag: `bmf_${safeId}_trail`,
          explosiongenerator: `custom:bmf_${safeId}_impact`
        } : {})
      },
      name: draft.name.trim() || `${draft.sourceWeaponDefKey.toUpperCase()} Variant`,
      updatedAt: new Date().toISOString()
    };
    setWeaponLibrary(prev => {
      const exists = prev.some(item => item.id === blueprint.id);
      return exists ? prev.map(item => item.id === blueprint.id ? blueprint : item) : [blueprint, ...prev];
    });
    setWeaponBlueprintDraft(blueprint);
    return blueprint;
  };

  const equipWeaponBlueprint = (blueprint) => {
    if (!selectedUnit?.isClone) {
      showToast('Weapon blueprints can be equipped on custom clone units only.');
      return;
    }
    const slotNum = activeWeaponSlotTab || selectedUnitDefaults?.weaponSlots?.[0]?.slot;
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

  const handleDownloadWeaponVfxPack = () => {
    const enabled = weaponLibrary.filter(item => item.appearance?.vfxEnabled);
    if (enabled.length === 0) {
      showToast('Enable custom VFX on at least one saved weapon blueprint first.');
      return;
    }
    const lua = generateWeaponVfxPackLua(enabled);
    const blob = new Blob([lua], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'bmf_weapon_effects.lua';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    showToast(`Exported ${enabled.length} custom weapon VFX definitions.`);
  };

  // Update tweaked stat value
  const handleStatChange = (unitId, statKey, value) => {
    transactProject(current => {
      const isClone = current.clones.some(
        clone => clone.newId.toLowerCase() === unitId.toLowerCase()
      );
      const unitTweaks = { ...current.tweaks[unitId] };
      if (value === '' || value === undefined) {
        delete unitTweaks[statKey];
      } else {
        unitTweaks[statKey] = value;
      }

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
  };

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
    weaponLibrary,
    supportingWeaponDefs,
    tweakModules,
    base64Options,
  });
  const limitRisk = compiledLobbyModules.overflow
    ? 'error'
    : compiledLobbyModules.slots.some(slot => slot.compatibility === 'advisory') ? 'warning' : 'ok';

  // Toggle Category selection
  const handleCatClick = (cat) => {
    setSelectedCats(prev => {
      if (prev.includes(cat)) {
        return prev.filter(c => c !== cat);
      } else {
        return [...prev, cat];
      }
    });
  };

  // Reset tweaks
  const handleResetUnit = (unitId) => {
    transactProject(current => {
      const next = { ...current.tweaks };
      delete next[unitId];
      return {
        tweaks: next,
        disabledUnitIds: current.disabledUnitIds.filter(id => id !== unitId),
      };
    });
    showToast(`Reset stats for ${unitId}`);
  };

  const handleResetSummaryUnitEdits = (unitId) => {
    transactProject(current => ({
      tweaks: Object.fromEntries(Object.entries(current.tweaks).filter(([id]) => id.toLowerCase() !== unitId.toLowerCase())),
      unitDescriptions: Object.fromEntries(Object.entries(current.unitDescriptions).filter(([id]) => id.toLowerCase() !== unitId.toLowerCase())),
    }));
    showToast(`Reset all edits for ${unitId}`);
  };

  const handleResetAllSummaryUnitEdits = () => {
    transactProject({ tweaks: {}, unitDescriptions: {} });
    setActiveRelationshipKey(null);
    showToast('Reset all unit edits');
  };

  const handleRevertSummaryRoster = (builderId) => {
    setBuildMenuSteps(prev => prev.filter(step => step.builderId.toLowerCase() !== builderId.toLowerCase()));
    showToast(`Reverted build menu for ${builderId}`);
  };

  const handleResetAllSummaryRosters = () => {
    transactProject({
      buildMenuSteps: [],
      buildMenuPacks: { extraUnits: false, scavengerUnits: false },
      supportingWeaponDefs: [],
    });
    showToast('Reverted all build-menu changes');
  };

  const handleDisableSummaryBuildMenuPack = (packId) => {
    setBuildMenuPacks(prev => ({ ...prev, [packId]: false }));
    showToast(`Disabled ${packId === 'extraUnits' ? 'Extra Units Pack' : 'Scavenger Units Pack'}`);
  };

  const handleRestoreSummaryUnit = (unitId) => {
    setDisabledUnitIds(prev => prev.filter(id => id.toLowerCase() !== unitId.toLowerCase()));
    showToast(`Restored ${unitId}`);
  };

  const handleRestoreAllSummaryUnits = () => {
    setDisabledUnitIds([]);
    showToast('Restored all disabled units');
  };

  const handleResetAllProjectChanges = () => {
    const selectedClone = clones.find(clone => clone.newId.toLowerCase() === selectedUnitId?.toLowerCase());
    transactProject({
      tweaks: {},
      unitDescriptions: {},
      clones: [],
      disabledUnitIds: [],
      buildMenuSteps: [],
      buildMenuPacks: { extraUnits: false, scavengerUnits: false },
    });
    setActiveRelationshipKey(null);
    if (selectedClone) setSelectedUnitId(selectedClone.baseId);
    showToast('Reset all active project changes');
  };

  // Apply Bulk edit
  const handleApplyBulk = () => {
    const changeVal = parseFloat(bulkPercent);
    if (Number.isNaN(changeVal)) {
      showToast('Error: Invalid bulk adjustment value');
      return;
    }

    let count = 0;
    const updates = [];
    bulkTargetUnits.forEach(unit => {
      const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
      const defaults = defaultsDb[baseId];

      if (bulkStatKey === 'all_weapons_damage' || bulkStatKey === 'all_weapons_range') {
        const slots = defaults.weaponSlots || [];
        slots.forEach(slot => {
          const subKey = bulkStatKey === 'all_weapons_damage' ? 'damage' : 'range';
          const tweakKey = `weapon_slot_${slot.slot}_${subKey}`;
          const currentTweak = tweaks[unit.id]?.[tweakKey];
          const defaultVal = slot[subKey] || 0;
          const baseVal = currentTweak !== undefined ? parseFloat(currentTweak) : defaultVal;

          let newVal = baseVal;
          if (bulkMode === 'percent') {
            newVal = baseVal * (1 + changeVal / 100);
          } else {
            newVal = baseVal + changeVal;
          }
          if (newVal < 0) newVal = 0;
          updates.push({ unitId: unit.id, key: tweakKey, value: newVal.toFixed(2) });
        });
        count++;
      } else {
        const defaultVal = parseFloat(defaults[bulkStatKey] || 0);
        const currentTweak = tweaks[unit.id]?.[bulkStatKey];
        const baseVal = currentTweak !== undefined ? parseFloat(currentTweak) : defaultVal;

        let newVal = baseVal;
        if (bulkMode === 'percent') {
          newVal = baseVal * (1 + changeVal / 100);
        } else {
          newVal = baseVal + changeVal;
        }

        if (newVal < 0 && (bulkStatKey.includes('cost') || bulkStatKey.includes('health') || bulkStatKey.includes('velocity'))) {
          newVal = 0;
        }
        updates.push({ unitId: unit.id, key: bulkStatKey, value: newVal.toFixed(2) });
        count++;
      }
    });

    transactProject(current => {
      const nextTweaks = { ...current.tweaks };
      updates.forEach(({ unitId, key, value }) => {
        nextTweaks[unitId] = {
          ...(nextTweaks[unitId] || {}),
          [key]: value,
        };
      });
      const touchesClone = bulkTargetUnits.some(unit => unit.isClone);
      return {
        tweaks: nextTweaks,
        includeClones: touchesClone ? true : current.includeClones,
        includeTweaks: touchesClone ? true : current.includeTweaks,
      };
    });
    setShowBulkPanel(false);
    showToast(`Adjusted ${bulkStatKey} for ${count} units by ${bulkMode === 'percent' ? (changeVal > 0 ? '+' : '') + changeVal + '%' : (changeVal > 0 ? '+' : '') + changeVal}`);
  };

  // Mutation Lab — controlled random adjustments with explicit scope and domains.
  const handleRandomAdjustments = () => {
    const intensityRanges = {
      cautious: [0.90, 1.10],
      balanced: [0.75, 1.25],
      chaos: [0.50, 1.50]
    };
    const [minRatio, maxRatio] = intensityRanges[randomIntensity];
    const targets = randomScope === 'selected' ? (selectedUnit ? [selectedUnit] : []) : filteredUnits;
    const enabledDomains = Object.entries(randomDomains).filter(([, enabled]) => enabled).map(([domain]) => domain);

    if (targets.length === 0) {
      showToast(randomScope === 'selected' ? 'Select a unit before starting a mutation.' : 'No units match the current filters.');
      return;
    }
    if (enabledDomains.length === 0) {
      showToast('Choose at least one mutation domain.');
      return;
    }

    setTweaks(prev => {
      const next = { ...prev };
      const applyValue = (unitId, key, value) => {
        const unitPatch = { ...(next[unitId] || {}) };
        unitPatch[key] = value;
        next[unitId] = unitPatch;
      };
      const mutateValue = (value, decimals = 0) => {
        const ratio = minRatio + Math.random() * (maxRatio - minRatio);
        return (value * ratio).toFixed(decimals);
      };

      targets.forEach(unit => {
        const baseId = unit.isClone ? resolveCloneRootId(unit.id) : unit.id;
        const defaults = defaultsDb[baseId];
        if (!defaults) return;

        if (randomDomains.durability && Number.isFinite(Number(defaults.health))) {
          applyValue(unit.id, 'health', mutateValue(Number(defaults.health)));
        }
        if (randomDomains.economy) {
          ['metalcost', 'energycost', 'buildtime'].forEach(key => {
            if (Number.isFinite(Number(defaults[key]))) applyValue(unit.id, key, mutateValue(Number(defaults[key])));
          });
        }
        if (randomDomains.mobility && Number.isFinite(Number(defaults.maxvelocity)) && Number(defaults.maxvelocity) > 0) {
          applyValue(unit.id, 'maxvelocity', mutateValue(Number(defaults.maxvelocity), 1));
        }
        if (randomDomains.weapons && defaults.weaponSlots) {
          defaults.weaponSlots.forEach(slot => {
            ['damage', 'range', 'reload'].forEach(key => {
              const value = Number(slot[key]);
              if (Number.isFinite(value) && value > 0) {
                applyValue(unit.id, `weapon_slot_${slot.slot}_${key}`, mutateValue(value, key === 'reload' ? 2 : 1));
              }
            });
          });
        }
      });
      return next;
    });

    setShowRandomPanel(false);
    showToast(`Mutation generated across ${targets.length} ${targets.length === 1 ? 'unit' : 'units'} in ${randomIntensity} mode.`);
  };

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
      { id: 'tool-bar-reference-library', kind: 'Tool', label: 'BAR Reference Library', description: 'Search verified units, WeaponDefs, models, scripts, artwork, effects, sounds, and explosion profiles.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('reference-library'); } },
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
  }, [allUnitsList, unitCollections]);

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
  }, [handleUndo, handleRedo, setShowClonePanel]);

  const { validationIssues, scopedValidationIssues } = useProjectValidation({
    tweaks,
    clones,
    unitNames: unitsDb.names,
    compiledLobbyModules,
    allUnitsList,
    defaultsDb,
    resolveCloneRootId,
    supportingWeaponDefs,
    activeCollectionUnitIds,
  });

  const handleApplyFormula = useCallback((updates) => {
    if (!updates || updates.length === 0) return;
    setTweaks(prevTweaks => {
      const next = { ...prevTweaks };
      updates.forEach(({ unitId, property, value }) => {
        const existing = { ...(next[unitId] || {}) };
        existing[property] = value;
        next[unitId] = existing;
      });
      return next;
    });
    showToast(`Applied formula override to ${updates.length.toLocaleString()} ${updates.length === 1 ? 'unit' : 'units'}.`);
  }, [setTweaks, showToast]);

  const handleApplyCarrierLinkage = useCallback((parentUnitId, compiledTweaks) => {
    if (!parentUnitId || !compiledTweaks) return;
    const linkedDrone = Object.entries(compiledTweaks).find(([key, value]) => (
      /^weapon_slot_\d+_carried_unit$/.test(key) && value
    ))?.[1];
    setTweaks(prevTweaks => {
      const next = { ...prevTweaks };
      const existing = { ...(next[parentUnitId] || {}) };
      Object.entries(compiledTweaks).forEach(([key, value]) => {
        if (value === undefined) {
          delete existing[key];
        } else {
          existing[key] = value;
        }
      });
      next[parentUnitId] = existing;
      return next;
    });
    showToast(`Linked carrier "${parentUnitId}" to deployed drone "${linkedDrone || 'selected unit'}".`);
  }, [setTweaks, showToast]);

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

  const modifiedUnitIds = [...new Set([
    ...Object.keys(tweaks).filter(id => Object.keys(tweaks[id] || {}).length > 0),
    ...Object.keys(unitDescriptions)
  ])];
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
  const selectedUnitOverrideEntries = Object.entries(tweaks[selectedUnit?.id] || {});
  const inspectorTabs = [
    { id: 'details', label: 'Details' },
    { id: 'compare', label: 'Compare', count: selectedUnitOverrideEntries.length },
    { id: 'changes', label: 'Changes', count: projectChangeCount },
    ...(selectedUnit?.isClone ? [{ id: 'identity', label: 'Identity' }] : []),
  ];
  const activeInspectorTab = workspaceLayout.layout.inspectorTab;
  const setInspectorTab = workspaceLayout.setInspectorTab;

  useEffect(() => {
    if (!selectedUnit?.isClone && activeInspectorTab === 'identity') {
      setInspectorTab('details');
    }
  }, [activeInspectorTab, selectedUnit?.isClone, setInspectorTab]);

  const selectInspectorParameter = useCallback(key => {
    setActiveRelationshipKey(key);
    requestAnimationFrame(() => {
      const panel = document.getElementById(`workspace-panel-${activeParamTab}`);
      const target = panel?.querySelector(`[data-param-key="${key}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      target?.querySelector('input, select, button')?.focus({ preventScroll: true });
    });
  }, [activeParamTab]);

  const updateSelectedUnitDescription = useCallback(value => {
    if (!selectedUnit) return;
    setUnitDescriptions(current => {
      const next = { ...current };
      if (value === '') delete next[selectedUnit.id];
      else next[selectedUnit.id] = value;
      return next;
    });
  }, [selectedUnit, setUnitDescriptions]);
  const activeCompiledOutput = activeOutputTab === 'tweakdefs_lua'
    ? generatedTweakDefsLua
    : activeOutputTab === 'tweakunits_lua'
      ? generatedTweakUnitsLua
      : activeOutputTab === 'tweakdefs_b64'
        ? tweakDefsB64
        : tweakUnitsB64;
  const activeCompiledOutputFallback = activeOutputTab.includes('lua') ? '{\n}' : 'No encoded output generated yet.';

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
          onReferenceLibrary={() => {
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('reference-library');
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
        unreadChatCount={unreadChatCount}
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
          setChatReadAt(Date.now());
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
        onReferenceLibrary={() => {
          setShowMainMenu(false);
          setShowDesignerPanel(false);
          setShowPresetGallery(false);
          setActiveWorkspace('reference-library');
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
        <EditUnitsWorkspace
          context={{
            activeBuildMenuPackCount,
            activeCollection,
            activeCollectionId,
            activeCollectionModifiedCount,
            activeCollectionUnits,
            activeOutputTab,
            activeParamTab,
            activeRelationshipKey,
            activeWeaponSlotTab,
            allUnitsList,
            base64Options,
            buildMenuSteps,
            clearUnitFilters,
            clones,
            comparisonMode,
            defaultsDb,
            disabledUnitIds,
            filteredUnits,
            generatedTweakDefsLua,
            generatedTweakUnitsLua,
            getEffectiveTechTier,
            getInheritedCloneWeaponSwaps,
            getProjectUnitIconUrl,
            getTagsOfUnit,
            getValidationWarning,
            handleCatClick,
            handleCloneBuildersChange,
            handleResetUnit,
            handleStatChange,
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
            searchQuery,
            selectedCats,
            selectedFaction,
            selectedUnit,
            selectedUnitDefaults,
            selectedUnitId,
            selectedUnitOverrideEntries,
            selectInspectorParameter,
            setActiveCollectionId,
            setActiveOutputTab,
            setActiveParamTab,
            setActiveRelationshipKey,
            setActiveSummaryTab,
            setActiveSwapSlotNum,
            setActiveWeaponSlotTab,
            setActiveWorkspace,
            setBase64Options,
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
            setUnitListScrollTop,
            showAllUnitParams,
            showAllWeaponParams,
            showModifiedOnly,
            showToast,
            totalBytesUsed,
            tweakDefsB64,
            tweaks,
            tweakUnitsB64,
            unitCollections,
            unitDescriptions,
            unitListContainerRef,
            unitRowHeight,
            unitScrollHint,
            unitsDb,
            updateSelectedUnitDescription,
            virtualUnitRange,
            workspaceLayout,
          }}
        />
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
            onUpdateSupportingWeaponDef={handleUpdateSupportingWeaponDef}
            onRemoveSupportingWeaponDef={handleRemoveSupportingWeaponDef}
            onApplyConversions={handleApplyTweakConversions}
            knownUnitIds={knownTweakPackageUnitIds}
            onBack={() => setActiveWorkspace('edit')}
            onToast={showToast}
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
      ) : activeWorkspace === 'review' ? (
        <Suspense fallback={<main className="review-workspace workspace-loading"><span>Preparing project review…</span></main>}>
          <LazyReviewPage
            modifiedUnitIds={modifiedUnitIds}
            tweaks={tweaks}
            clones={clones}
            buildMenuSteps={buildMenuSteps}
            disabledUnitIds={disabledUnitIds}
            validationIssues={validationIssues}
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
            setIncludeTweaks={setIncludeTweaks}
            setIncludeClones={setIncludeClones}
            setIncludeRosters={setIncludeRosters}
            setIncludeHeader={setIncludeHeader}
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
            knownUnitIds={knownTweakPackageUnitIds}
            collectionScope={collectionReviewScope}
            onBack={() => setActiveWorkspace('edit')}
            onExport={handleExportConfig}
            onOpenSummary={tab => { setActiveSummaryTab(tab); setShowSummaryModal(true); }}
            onEditUnit={id => { setSelectedUnitId(id); setActiveWorkspace('edit'); }}
            onOpenTweakLab={() => setActiveWorkspace('tweak-lab')}
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
        <div className="weapon-swap-overlay">
        <div
          className="weapon-swap-modal weapon-borrow-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weapon-borrow-title"
          style={swapPosition ? { top: swapPosition.y, left: swapPosition.x, transform: 'none' } : undefined}
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            setShowSwapModal(false);
            setSwapPosition(null);
          }}
        >
          {/* Header (Drag Handle) */}
          <div
            className="weapon-swap-header"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              if (e.target.closest('button')) return;
              const modalBounds = e.currentTarget.closest('.weapon-swap-modal').getBoundingClientRect();
              setSwapPosition({ x: modalBounds.left, y: modalBounds.top });
              setIsDraggingSwap(true);
              setDragOffset({
                x: e.clientX - modalBounds.left,
                y: e.clientY - modalBounds.top
              });
            }}
          >
            <div className="weapon-swap-title-group">
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <div className="weapon-swap-title-copy">
                <span>Loadout editor</span>
                <h3 id="weapon-borrow-title">Borrow a weapon</h3>
              </div>
              <span className="weapon-swap-slot">Target slot {activeSwapSlotNum}</span>
            </div>
            <button
              type="button"
              className="weapon-swap-close"
              aria-label="Close borrow weapon dialog"
              onClick={() => {
                setShowSwapModal(false);
                setSwapPosition(null);
              }}
            >
              <span>Close</span>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          </div>

          <div className="weapon-swap-body">
            {/* Left Column: Search, Faction Filters & Unit list */}
            <aside className="weapon-swap-library" aria-label="Weapon donor library">
              <div className="weapon-swap-library-heading">
                <span>Source library</span>
                <strong>Select a donor unit</strong>
              </div>
              {/* Faction Filter Chips */}
              <div className="weapon-swap-factions" role="group" aria-label="Filter donor units by faction">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'arm', label: 'Arm' },
                  { id: 'cor', label: 'Cor' },
                  { id: 'leg', label: 'Leg' },
                  { id: 'scav', label: 'Scav' }
                ].map(f => (
                  <button
                    type="button"
                    key={f.id}
                    className={swapUnitFactionFilter === f.id ? 'active' : ''}
                    aria-pressed={swapUnitFactionFilter === f.id}
                    onClick={() => setSwapUnitFactionFilter(f.id)}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <label className="weapon-swap-search-field">
                <span>Search donor units</span>
                <input
                  type="search"
                  className="weapon-swap-search"
                  placeholder="Unit name or ID"
                  autoFocus
                  value={swapSearchQuery}
                  onChange={e => setSwapSearchQuery(e.target.value)}
                />
              </label>

              <div className="weapon-swap-unit-list" role="listbox" aria-label="Donor units">
                {allUnitsList
                  .filter(u => {
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
                  })
                  .map(u => {
                    const faction = getFactionOfUnit(u.id);
                    let factionColor = 'var(--color-text-muted)';
                    if (faction === 'arm') factionColor = 'var(--color-faction-arm)';
                    else if (faction === 'cor') factionColor = 'var(--color-faction-cor)';
                    else if (faction === 'leg') factionColor = 'var(--color-faction-leg)';
                    else if (faction === 'scav') factionColor = 'var(--color-faction-scav)';

                    const isSelected = selectedSwapUnitId === u.id;

                    return (
                      <button
                        type="button"
                        role="option"
                        key={u.id}
                        className={`weapon-swap-unit ${isSelected ? 'active' : ''}`}
                        aria-selected={isSelected}
                        onClick={() => setSelectedSwapUnitId(u.id)}
                      >
                        <div className="weapon-swap-unit-icon">
                          <UnitArtwork unitId={u.id} alt="" />
                        </div>
                        <div className="weapon-swap-unit-copy">
                          <strong>{u.name}</strong>
                          <code>{u.id}</code>
                        </div>

                        <span className="weapon-swap-faction-dot" style={{ background: factionColor }} title={faction.toUpperCase()} />
                      </button>
                    );
                  })}
              </div>
            </aside>

            {/* Right Column: Weapon selection list */}
            <div className="weapon-swap-stage">
              {selectedSwapUnitId ? (() => {
                const srcDefaults = defaultsDb[selectedSwapUnitId.toLowerCase()];
                const srcName = unitsDb.names[selectedSwapUnitId] || selectedSwapUnitId;

                // Extract available weapons from dynamic weaponSlots array
                const weapons = srcDefaults?.weaponSlots || [];

                // Classification helper
                const getWeaponClass = (w) => {
                  const name = w.defKey.toLowerCase();
                  if (name.includes('laser') || name.includes('beam') || name.includes('lightning') || name.includes('heat_ray')) return 'laser';
                  if (name.includes('missile') || name.includes('rocket') || name.includes('torpedo') || name.includes('flak')) return 'missile';
                  if (name.includes('cannon') || name.includes('plasma') || name.includes('gauss') || name.includes('artillery')) return 'plasma';
                  if (name.includes('shield') || name.includes('repulsor') || name.includes('jammer') || name.includes('stealth')) return 'utility';
                  return 'other';
                };

                const getWeaponRoleLabel = (w) => {
                  if (w.reload <= 0.15 || w.burst > 5) return 'RAPID FIRE';
                  if (w.range >= 750) return 'LONG RANGE';
                  if (w.aoe >= 64) return 'AREA OF EFFECT';
                  if (w.projectiles > 3) return 'SHOTGUN VOLLEY';
                  return 'DIRECT FIRE';
                };

                // Filter weapons
                const filteredWeapons = weapons.filter(w => {
                  if (swapWeaponTypeFilter === 'all') return true;
                  return getWeaponClass(w) === swapWeaponTypeFilter;
                });

                // Current weapon equipped on destination slot for live comparison
                const destDefaults = selectedUnitDefaults;
                const currentWep = destDefaults?.weaponSlots?.find(s => s.slot === activeSwapSlotNum);

                return (
                  <div className="weapon-swap-stage-content">
                    {/* Source Unit Information */}
                    <div className="weapon-swap-source">
                      <div className="weapon-swap-source-unit">
                        <div className="weapon-swap-source-icon">
                          <UnitArtwork unitId={selectedSwapUnitId} alt="" eager />
                        </div>
                        <div className="weapon-swap-source-copy">
                          <span>Selected donor</span>
                          <h4>{srcName}</h4>
                          <code>{selectedSwapUnitId}</code>
                        </div>
                      </div>

                      {/* Category filter tabs */}
                      <div className="weapon-swap-type-filters" role="group" aria-label="Filter donor weapons by type">
                        {[
                          { id: 'all', label: 'All weapons' },
                          { id: 'laser', label: 'Lasers' },
                          { id: 'missile', label: 'Missiles' },
                          { id: 'plasma', label: 'Plasma' },
                          { id: 'utility', label: 'Shields/Util' }
                        ].map(t => (
                          <button
                            type="button"
                            key={t.id}
                            className={swapWeaponTypeFilter === t.id ? 'active' : ''}
                            aria-pressed={swapWeaponTypeFilter === t.id}
                            onClick={() => setSwapWeaponTypeFilter(t.id)}
                          >
                            {t.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Weapons List Container */}
                    <div className="weapon-swap-weapons">
                      {filteredWeapons.length > 0 ? filteredWeapons.map(w => {
                        const wRole = getWeaponRoleLabel(w);

                        // Delta calculations against current weapon
                        const dmgDiff = currentWep ? (w.damage - currentWep.damage) : null;
                        const rldDiff = currentWep ? (w.reload - currentWep.reload) : null;
                        const rngDiff = currentWep ? (w.range - currentWep.range) : null;
                        const metricRows = [
                          {
                            label: 'Damage',
                            value: w.damage,
                            deltaText: dmgDiff !== null && dmgDiff !== 0 ? `${dmgDiff > 0 ? '+' : ''}${dmgDiff}` : null,
                            positive: dmgDiff > 0,
                          },
                          {
                            label: 'Range',
                            value: w.range,
                            deltaText: rngDiff !== null && rngDiff !== 0 ? `${rngDiff > 0 ? '+' : ''}${rngDiff}` : null,
                            positive: rngDiff > 0,
                          },
                          {
                            label: 'Reload',
                            value: `${w.reload}s`,
                            deltaText: rldDiff !== null && rldDiff !== 0 ? `${rldDiff < 0 ? '' : '+'}${rldDiff.toFixed(2)}s` : null,
                            positive: rldDiff < 0,
                          },
                        ];

                        return (
                          <article key={w.slot} className="weapon-swap-weapon">
                            <div className="weapon-swap-weapon-main">
                              <div className="weapon-swap-weapon-heading">
                                <strong>{w.defKey.toUpperCase()}</strong>
                                <span className="weapon-swap-weapon-role">{wRole}</span>
                              </div>

                              {/* Live Comparison Layout */}
                              <div className="weapon-swap-metrics">
                                {metricRows.map(metric => (
                                  <div className="weapon-swap-metric" key={metric.label}>
                                    <span className="weapon-swap-metric-label">{metric.label}</span>
                                    <strong className="weapon-swap-metric-value">{metric.value}</strong>
                                    {metric.deltaText && (
                                      <span className={`weapon-swap-metric-delta ${metric.positive ? 'is-positive' : 'is-negative'}`}>
                                        {metric.deltaText}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="btn-action weapon-swap-borrow"
                              onClick={() => {
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
                              }}
                            >
                              Borrow to slot {activeSwapSlotNum}
                              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" /></svg>
                            </button>
                          </article>
                        );
                      }) : (
                        <div className="weapon-swap-empty">
                          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 4l16 16M9.5 5.2A7.2 7.2 0 0 1 12 4.75c4.6 0 8 4.25 8 7.25a7.6 7.6 0 0 1-1.55 3.85M14.1 19.05a7.3 7.3 0 0 1-2.1.2c-4.6 0-8-4.25-8-7.25 0-1.3.65-2.8 1.75-4.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                          <span>Filtered library</span>
                          <h4>No matching weapons</h4>
                          <p>Choose another weapon type to see this donor unit&rsquo;s available systems.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : (
                <div className="weapon-swap-welcome">
                  <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 12a4 4 0 100-8 4 4 0 000 8zM8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>Donor selection</span>
                  <h4>Choose a source unit</h4>
                  <p>Select a unit from the library to compare its weapon systems with the current slot.</p>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Weapon Laboratory */}
      {showWeaponLab && activeWorkspace === 'weapon-lab' && weaponBlueprintDraft && (
        <main className="weapon-lab-page" aria-labelledby="weapon-lab-title">
          <div className="weapon-lab-modal">
            <div className="weapon-lab-header">
              <div className="weapon-lab-header-copy">
                <span className="weapon-lab-header-kicker">Armament forge <i /> Phase 02</span>
                <h3 id="weapon-lab-title">Weapon Laboratory</h3>
                <p>Clone, tune, and export a reusable weapon definition with engine-native CEG bindings.</p>
              </div>
              <div className="weapon-lab-page-actions"><div className="weapon-lab-header-stat"><strong>{weaponLibrary.length}</strong><span>saved designs</span></div><div className="weapon-lab-header-stat"><strong>{weaponBlueprintDraft.sourceWeaponDefKey.toUpperCase()}</strong><span>source weapon</span></div><button type="button" className="weapon-lab-close" onClick={() => { setShowWeaponLab(false); setActiveWorkspace('edit'); }}>Back to editor</button></div>
            </div>

            <div className="weapon-lab-layout">
              <div className="weapon-lab-editor">
                <div className="weapon-lab-source">
                  <span>Source weapon</span>
                  <strong>{weaponBlueprintDraft.sourceWeaponDefKey.toUpperCase()}</strong>
                  <small>{weaponBlueprintDraft.sourceUnitId}</small>
                </div>

                <div className="weapon-lab-identity">
                  <label>Name<input className="form-input" value={weaponBlueprintDraft.name} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, name: e.target.value }))} /></label>
                  <label>Library note<input className="form-input" placeholder="Optional role or design note" value={weaponBlueprintDraft.description} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, description: e.target.value }))} /></label>
                </div>

                <section className="weapon-lab-section">
                  <div className="weapon-lab-section-heading"><span>Core profile</span><small>Exported gameplay values</small></div>
                  <div className="weapon-lab-core-grid">
                    {[
                      ['damage', 'Damage'], ['range', 'Range'], ['reload', 'Reload'], ['velocity', 'Velocity'],
                      ['aoe', 'Splash AoE'], ['projectiles', 'Projectiles'], ['burst', 'Burst'], ['burstrate', 'Burst Rate'],
                      ['accuracy', 'Accuracy'], ['sprayangle', 'Spray angle'], ['flighttime', 'Flight time']
                    ].map(([key, label]) => (
                      <label key={key}>{label}
                        <input type="number" className="form-input" value={weaponBlueprintDraft.overrides[key]} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, overrides: { ...prev.overrides, [key]: e.target.value } }))} />
                      </label>
                    ))}
                  </div>
                  <div className="weapon-lab-performance-strip">
                    <div><span>Damage / second</span><strong>{(() => { const damage = Number(weaponBlueprintDraft.overrides.damage) || 0; const reload = Number(weaponBlueprintDraft.overrides.reload) || 1; const burst = Number(weaponBlueprintDraft.overrides.burst) || 1; const projectiles = Number(weaponBlueprintDraft.overrides.projectiles) || 1; return ((damage * burst * projectiles) / reload).toFixed(1); })()}</strong></div>
                    <div><span>Engagement range</span><strong>{Number(weaponBlueprintDraft.overrides.range || 0).toLocaleString()}</strong></div>
                    <div><span>Impact radius</span><strong>{Number(weaponBlueprintDraft.overrides.aoe || 0).toLocaleString()}</strong></div>
                    <div><span>Delivery</span><strong>{Number(weaponBlueprintDraft.overrides.burst) > 1 ? 'Burst' : Number(weaponBlueprintDraft.overrides.projectiles) > 1 ? 'Volley' : 'Direct'}</strong></div>
                  </div>
                </section>

                <section className="weapon-lab-section">
                  <div className="weapon-lab-section-heading"><span>Effect studio</span><small>Live study + exportable Spring CEG</small></div>
                  <div className="weapon-lab-vfx-toggle">
                    <Switch className="weapon-lab-switch" label="Generate custom trail and impact" checked={weaponBlueprintDraft.appearance.vfxEnabled} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, vfxEnabled: e.target.checked } }))} />
                    <span><strong>Generate custom trail + impact</strong><small>Saving assigns unique CEG names to this blueprint.</small></span>
                  </div>
                  <div className="weapon-lab-visual-grid">
                    <label>Trail / CEG<input className="form-input" placeholder="e.g. bluebeam" value={weaponBlueprintDraft.overrides.cegtag} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, overrides: { ...prev.overrides, cegtag: e.target.value } }))} /></label>
                    <label>Explosion<input className="form-input" placeholder="e.g. custom:plasma_big" value={weaponBlueprintDraft.overrides.explosiongenerator} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, overrides: { ...prev.overrides, explosiongenerator: e.target.value } }))} /></label>
                    <label>Projectile model<input className="form-input" placeholder="e.g. missile.3do" value={weaponBlueprintDraft.overrides.model} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, overrides: { ...prev.overrides, model: e.target.value } }))} /></label>
                    <label>Core colour<input type="color" value={weaponBlueprintDraft.appearance.color} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, color: e.target.value } }))} /></label>
                    <label>Falloff colour<input type="color" value={weaponBlueprintDraft.appearance.secondaryColor} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, secondaryColor: e.target.value } }))} /></label>
                    <label>Texture<select className="form-input" value={weaponBlueprintDraft.appearance.texture} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, texture: e.target.value } }))}><option value="flare">Flare</option><option value="plasma">Plasma</option><option value="smoke">Smoke</option><option value="heatcloud">Heat cloud</option></select></label>
                    <label>Brightness <em>{weaponBlueprintDraft.appearance.brightness.toFixed(1)}×</em><input type="number" min="0.4" max="2" step="0.1" className="form-input" value={weaponBlueprintDraft.appearance.brightness} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, brightness: Number(e.target.value) } }))} /></label>
                    <label>Particle size<input type="number" min="1" max="40" className="form-input" value={weaponBlueprintDraft.appearance.particleSize} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, particleSize: Number(e.target.value) } }))} /></label>
                    <label>Particle count<input type="number" min="1" max="32" className="form-input" value={weaponBlueprintDraft.appearance.particleCount} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, particleCount: Number(e.target.value) } }))} /></label>
                    <label>Particle life<input type="number" min="1" max="90" className="form-input" value={weaponBlueprintDraft.appearance.particleLife} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, particleLife: Number(e.target.value) } }))} /></label>
                    <label>Spread<input type="number" min="0" max="30" className="form-input" value={weaponBlueprintDraft.appearance.spread} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, spread: Number(e.target.value) } }))} /></label>
                  </div>
                  <div className="weapon-ceg-builder">
                    <section>
                      <div className="weapon-ceg-builder-heading"><div><span>Trail emitter</span><small>CBitmapMuzzleFlame · directional flare, beam, or rail trace</small></div><strong>CEG trail</strong></div>
                      <div className="weapon-ceg-controls">
                        <label>Width<input type="number" min="1" max="80" className="form-input" value={weaponBlueprintDraft.appearance.trailSize ?? 7} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, trailSize: Number(e.target.value) } }))} /></label>
                        <label>Length<input type="number" min="1" max="160" className="form-input" value={weaponBlueprintDraft.appearance.trailLength ?? 20} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, trailLength: Number(e.target.value) } }))} /></label>
                        <label>Growth<input type="number" min="-1" max="5" step="0.05" className="form-input" value={weaponBlueprintDraft.appearance.trailGrowth ?? 0.15} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, trailGrowth: Number(e.target.value) } }))} /></label>
                        <label>Lifetime<input type="number" min="1" max="60" className="form-input" value={weaponBlueprintDraft.appearance.trailLife ?? 5} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, trailLife: Number(e.target.value) } }))} /></label>
                        <label>Front offset<input type="number" min="0" max="1" step="0.05" className="form-input" value={weaponBlueprintDraft.appearance.trailOffset ?? 0.2} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, trailOffset: Number(e.target.value) } }))} /></label>
                      </div>
                    </section>
                    <section>
                      <div className="weapon-ceg-builder-heading"><div><span>Impact particles</span><small>CSimpleParticleSystem · moving debris, sparks, and energy</small></div><div className="weapon-ceg-switch"><Switch label="Enable impact particles" checked={weaponBlueprintDraft.appearance.particlesEnabled !== false} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, particlesEnabled: e.target.checked } }))} /><span>Enabled</span></div></div>
                      <div className="weapon-ceg-note">Uses the particle size, count, lifetime, and spread controls above. The emitter applies gravity, drag, directional motion, and lifetime spread automatically.</div>
                    </section>
                    <section>
                      <div className="weapon-ceg-builder-heading"><div><span>Heat core</span><small>CHeatCloudProjectile · expanding background burst</small></div><div className="weapon-ceg-switch"><Switch label="Enable heat core" checked={weaponBlueprintDraft.appearance.heatEnabled !== false} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, heatEnabled: e.target.checked } }))} /><span>Enabled</span></div></div>
                      <div className="weapon-ceg-controls">
                        <label>Initial size<input type="number" min="1" max="120" className="form-input" value={weaponBlueprintDraft.appearance.heatSize ?? 12} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, heatSize: Number(e.target.value) } }))} /></label>
                        <label>Size growth<input type="number" min="0" max="20" step="0.1" className="form-input" value={weaponBlueprintDraft.appearance.heatGrowth ?? 0.4} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, heatGrowth: Number(e.target.value) } }))} /></label>
                        <label>Heat falloff<input type="number" min="0.1" max="12" step="0.1" className="form-input" value={weaponBlueprintDraft.appearance.heatFalloff ?? 1.1} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, heatFalloff: Number(e.target.value) } }))} /></label>
                      </div>
                    </section>
                    <section>
                      <div className="weapon-ceg-builder-heading"><div><span>Ground flash</span><small>CStandardGroundFlash · impact light and expanding ring</small></div><div className="weapon-ceg-switch"><Switch label="Enable ground flash" checked={weaponBlueprintDraft.appearance.groundFlashEnabled !== false} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, groundFlashEnabled: e.target.checked } }))} /><span>Enabled</span></div></div>
                      <div className="weapon-ceg-controls">
                        <label>Flash size<input type="number" min="1" max="250" className="form-input" value={weaponBlueprintDraft.appearance.flashSize ?? 25} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, flashSize: Number(e.target.value) } }))} /></label>
                        <label>Flash alpha<input type="number" min="0" max="1" step="0.05" className="form-input" value={weaponBlueprintDraft.appearance.flashAlpha ?? 0.55} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, flashAlpha: Number(e.target.value) } }))} /></label>
                        <label>Ring growth<input type="number" min="0" max="40" step="0.1" className="form-input" value={weaponBlueprintDraft.appearance.flashGrowth ?? 3} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, flashGrowth: Number(e.target.value) } }))} /></label>
                        <label>Lifetime<input type="number" min="1" max="60" className="form-input" value={weaponBlueprintDraft.appearance.flashLife ?? 8} onChange={e => setWeaponBlueprintDraft(prev => ({ ...prev, appearance: { ...prev.appearance, flashLife: Number(e.target.value) } }))} /></label>
                      </div>
                    </section>
                  </div>
                  <div className="weapon-ceg-manifest">
                    <div><span>Export manifest</span><small>Rendering is validated in Recoil, not simulated in the browser.</small></div>
                    <code>bmf_{weaponBlueprintDraft.id || 'new_weapon'}_trail</code>
                    <span>CBitmapMuzzleFlame</span>
                    {weaponBlueprintDraft.appearance.particlesEnabled !== false && <span>CSimpleParticleSystem</span>}
                    {weaponBlueprintDraft.appearance.heatEnabled !== false && <span>CHeatCloudProjectile</span>}
                    {weaponBlueprintDraft.appearance.groundFlashEnabled !== false && <span>CStandardGroundFlash</span>}
                  </div>
                  <p className="weapon-lab-export-note">The downloaded Lua belongs in your full mod's <code>effects/</code> folder. Lobby tweakdefs can reference CEGs, but cannot register new effect definitions by themselves.</p>
                </section>

                <div className="weapon-lab-actions">
                  <button type="button" className="weapon-lab-export-vfx" onClick={handleDownloadWeaponVfxPack}>Download VFX Lua</button>
                  <button type="button" className="weapon-lab-save" onClick={() => { persistWeaponBlueprint(); showToast('Weapon blueprint saved to library.'); }}>Save blueprint</button>
                  <button type="button" className="weapon-lab-equip" onClick={() => { const blueprint = persistWeaponBlueprint(); if (blueprint) equipWeaponBlueprint(blueprint); }}>Save & equip on slot {activeWeaponSlotTab}</button>
                </div>
              </div>

              <aside className="weapon-library-panel">
                <div className="weapon-library-heading"><span>Weapon library</span><strong>{weaponLibrary.length} blueprints</strong></div>
                <div className="weapon-library-list">
                  {weaponLibrary.length > 0 ? weaponLibrary.map(blueprint => (
                    <article className="weapon-library-card" key={blueprint.id}>
                      <div className="weapon-library-card-main">
                        <span className="weapon-library-swatch" style={{ background: blueprint.appearance?.color || '#c69a68' }} />
                        <div><strong>{blueprint.name}</strong><small>{blueprint.sourceWeaponDefKey} · {blueprint.sourceUnitId}</small></div>
                      </div>
                      <p>{blueprint.description || 'Reusable weapon blueprint'}</p>
                      <div>
                        <button type="button" onClick={() => { setWeaponBlueprintDraft(blueprint); }}>Edit</button>
                        <button type="button" onClick={() => equipWeaponBlueprint(blueprint)}>Equip</button>
                        <button type="button" className="weapon-library-delete" onClick={() => setWeaponLibrary(prev => prev.filter(item => item.id !== blueprint.id))}>Delete</button>
                      </div>
                    </article>
                  )) : <div className="weapon-library-empty"><strong>Library is empty</strong><span>Save the active weapon as a blueprint to build a reusable collection.</span></div>}
                </div>
              </aside>
            </div>
          </div>
        </main>
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
        <Suspense fallback={<main className="preset-gallery-page preset-gallery-loading"><span>Loading experiment library…</span></main>}>
          <LazyPresetGalleryPage
            presets={presets}
            projectName={projectName}
            presetName={presetName}
            presetDescription={presetDescription}
            onPresetNameChange={setPresetName}
            onPresetDescriptionChange={setPresetDescription}
            onSave={handleSavePreset}
            onApply={handleApplyPreset}
            onDelete={presetId => setPresets(prev => prev.filter(item => item.id !== presetId))}
            onClose={() => { setShowPresetGallery(false); setActiveWorkspace('edit'); }}
          />
        </Suspense>
      )}

      <CloneCreatorDialog
        open={showClonePanel}
        baseId={cloneBaseId}
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
