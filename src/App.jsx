import { lazy, Suspense, useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { BUILD_MENU_PACKS, buildEffectiveFactoryRosters, getBuildMenuPackSource } from './data/build-menu-packs.js';
import { getFactionOfUnit, getTechTierFromValue } from './utils/categories.js';
import { serializeLuaTable, encodeLobbyBase64 } from './utils/tweakSerializer.js';
import { compileTweakDefsLua } from './utils/tweakdefsHelper.js';
import { buildLobbyCommands, compileLobbyModules } from './utils/lobbyModules.js';
import { useOnlinePresence } from './hooks/useOnlinePresence.js';
import { useTemporaryChat } from './hooks/useTemporaryChat.js';
import { useProjectPersistence } from './hooks/useProjectPersistence.js';
import { useWorkspaceLayout } from './hooks/useWorkspaceLayout.js';
import { useCoreGameData } from './hooks/useCoreGameData.js';
import { PROJECT_STORE_DEFAULTS, useProjectStore } from './state/useProjectStore.js';
import { assertProjectSize, normalizeProjectDocument } from './project/projectDocument.js';
import { PRESENCE_ACTIVITY } from './config/presenceActivities.js';
import {
  getApplicableUnitParameters, resolveUnitParameterDefault, MOBILITY_STAT_KEYS, STAT_KEYS, TARGET_CATEGORY_GROUPS, UNIT_CATEGORIES as CATEGORIES,
  WEAPON_SLOT_BOOLEAN_PARAMS, WEAPON_SLOT_PATHS, WEAPON_SLOT_STRING_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS,
  WORKSPACE_TAB_DEFINITIONS,
} from './config/editorParameters.js';
import OnlinePresenceBadge from './components/OnlinePresenceBadge.jsx';
import MainMenu from './components/MainMenu.jsx';
import CreditsModal from './components/CreditsModal.jsx';
import UnitArtwork from './components/UnitArtwork.jsx';
import { getBuildPicturePreviewUrl, getUnitIconUrl } from './utils/unitArtwork.js';
import { createProducerCatalog, PRODUCER_KIND } from './utils/producerCatalog.js';
import { Button, ButtonGroup, FileButton, IconButton, SectionHeader, Switch, StatCard } from './components/ui.jsx';
import EditorShell from './components/editor/EditorShell.jsx';
import UnitLibraryPane from './components/editor/UnitLibraryPane.jsx';
import CollectionScopePicker from './components/editor/CollectionScopePicker.jsx';
import UnitCommandBar from './components/editor/UnitCommandBar.jsx';
import ParameterCanvas, { ParameterMatrix } from './components/editor/ParameterCanvas.jsx';
import InheritedBooleanControl from './components/editor/InheritedBooleanControl.jsx';
import UnitParameterViewControl from './components/editor/UnitParameterViewControl.jsx';
import EditorInspector from './components/editor/EditorInspector.jsx';
import {
  ComparisonValue,
  ParameterGuide,
  ParameterHelp,
  ParameterRelationshipPanel,
} from './components/editor/ParameterGuidance.jsx';
import {
  getParameterHelp,
  getParameterRelationship,
  getRelationshipLabel,
} from './config/parameterGuidance.js';
import AssetPicker from './components/editor/AssetPicker.jsx';
import AdvancedCustomParameters from './components/editor/AdvancedCustomParameters.jsx';
import { isValidCustomParameterKey } from './config/customParameters.js';
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
const LazyTemporaryChatDialog = lazy(() => import('./components/TemporaryChatDialog.jsx'));
const LazyBatchAdjustDialog = lazy(() => import('./components/BatchAdjustDialog.jsx'));
const LazySummaryExplorerDialog = lazy(() => import('./components/SummaryExplorerDialog.jsx'));
const LazyCommandPalette = lazy(() => import('./components/CommandPalette.jsx'));
const LazyProjectCheckpointsDialog = lazy(() => import('./components/ProjectCheckpointsDialog.jsx'));
const LazyTweakPackageLabPage = lazy(() => import('./components/TweakPackageLabPage.jsx'));
const LazyBarReferenceLibraryPage = lazy(() => import('./components/BarReferenceLibraryPage.jsx'));
const LazyBehaviorInterceptorEditor = lazy(() => import('./components/editor/BehaviorInterceptorEditor.jsx'));

// Keep the laboratory code available while this experimental workspace is temporarily unpublished.
const WEAPON_LAB_ENABLED = false;
const SHOW_LEGACY_REVIEW_REFERENCE = false;

const WEAPON_ASSET_TYPES = Object.freeze({
  cegTag: 'ceg', explosiongenerator: 'ceg', model: 'projectileModel',
  soundstart: 'sound', soundhit: 'sound', soundhitwet: 'sound', soundhitdry: 'sound',
  texture1: 'texture', texture2: 'texture', texture3: 'texture'
});

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

function getValidationWarning(key, value) {
  if (value === undefined || value === '') return null;
  if ((key === 'collisionvolumescales' || key === 'collisionvolumeoffsets') && !/^\s*-?\d*\.?\d+(?:\s+-?\d*\.?\d+){2}\s*$/.test(String(value))) {
    return { level: 'error', message: 'Enter three numbers: X Y Z' };
  }
  const num = parseFloat(value);
  if (isNaN(num)) return null;

  const isKey = (pattern) => {
    return key.toLowerCase().includes(pattern.toLowerCase());
  };

  if (isKey('reload') || isKey('stockpiletime')) {
    if (num <= 0) return { level: 'error', message: 'Value must be positive' };
    if (num < 0.03) return { level: 'warning', message: 'Below engine limit (0.033s)' };
  }
  if (isKey('burstrate') && num < 0) {
    return { level: 'error', message: 'Burst rate cannot be negative' };
  }
  if (isKey('range') || isKey('sightdistance') || isKey('radardistance') || isKey('sonardistance') || isKey('builddistance')) {
    if (num < 0) return { level: 'error', message: 'Range cannot be negative' };
    if (num > 10000) return { level: 'warning', message: 'Exceeds standard map scale (10000)' };
  }
  if (isKey('metalcost') || isKey('energycost')) {
    if (num < 0) return { level: 'error', message: 'Cost cannot be negative' };
  }
  if (isKey('buildtime')) {
    if (num <= 0) return { level: 'error', message: 'Build time must be positive' };
  }
  if (isKey('health')) {
    if (num <= 0) return { level: 'error', message: 'Health must be positive' };
  }
  if (isKey('maxvelocity')) {
    if (num < 0) return { level: 'error', message: 'Speed cannot be negative' };
    if (num > 400) return { level: 'warning', message: 'High speed may glitch (>400)' };
  }
  if (isKey('stockpilelimit')) {
    if (num < 0) return { level: 'error', message: 'Limit cannot be negative' };
  }
  if (key === 'targetable' || key === 'interceptor' || key === 'interceptedbyshieldtype') {
    if (!Number.isInteger(num) || num < 0) return { level: 'error', message: 'Bitmask must be a non-negative whole number' };
  }
  if (key === 'coverage' && num < 0) return { level: 'error', message: 'Coverage cannot be negative' };
  if (isKey('spawnrate') && num <= 0) return { level: 'error', message: 'Spawn rate must be positive' };
  if (isKey('maxunits') && (!Number.isInteger(num) || num < 1)) return { level: 'error', message: 'Maximum units must be a positive integer' };
  if ((key === 'footprintx' || key === 'footprintz') && (!Number.isInteger(num) || num < 1)) return { level: 'error', message: 'Footprint must be a positive whole number' };
  if (key === 'maxthisunit' && (!Number.isInteger(num) || num < 1)) return { level: 'error', message: 'Team limit must be a positive whole number' };
  if (isKey('cluster_number')) {
    if (!Number.isInteger(num) || num < 1) return { level: 'error', message: 'Cluster count must be a positive integer' };
    if (num > 64) return { level: 'warning', message: 'Large cluster counts can be expensive' };
  }
  if ((isKey('controlradius') || isKey('decayrate')) && num < 0) return { level: 'error', message: 'Value cannot be negative' };
  return null;
}

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
    hydrateProjectStore,
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

  // Build Menu Wizard/Designer state
  const activeFactoryRosters = useMemo(
    () => buildEffectiveFactoryRosters(factoryRosters, buildMenuPacks),
    [buildMenuPacks, factoryRosters]
  );

  const [base64Options, setBase64Options] = useState({ padding: true });
  const tweakDefsLua = '';
  const [toast, setToast] = useState({ show: false, message: '' });

  // Clone Creator modal states
  const [cloneBaseId, setCloneBaseId] = useState('');
  const [cloneNewId, setCloneNewId] = useState('');
  const [cloneName, setCloneName] = useState('');
  const [cloneBuilders, setCloneBuilders] = useState([]);
  const [cloneAutoAssignBuilders, setCloneAutoAssignBuilders] = useState(false);
  const [showClonePanel, setShowClonePanel] = useState(false);

  // Bulk Edit states
  const [showBulkPanel, setShowBulkPanel] = useState(false);
  const [showRandomPanel, setShowRandomPanel] = useState(false);
  const [randomScope, setRandomScope] = useState('selected');
  const [randomIntensity, setRandomIntensity] = useState('balanced');
  const [randomDomains, setRandomDomains] = useState({ economy: true, durability: true, mobility: true, weapons: true });
  const [bulkStatKey, setBulkStatKey] = useState('health');
  const [bulkPercent, setBulkPercent] = useState('10');
  const [bulkMode, setBulkMode] = useState('percent');

  // Build Menu Designer Modal states
  const [showDesignerPanel, setShowDesignerPanel] = useState(false);
  const [selectedFactoryId, setSelectedFactoryId] = useState('armlab');
  const [designerFaction, setDesignerFaction] = useState('all');
  const [producerKindFilter, setProducerKindFilter] = useState('all');
  const [availableFactionFilter, setAvailableFactionFilter] = useState('factory');
  const [availableSearchQuery, setAvailableSearchQuery] = useState('');
  const [factorySearchQuery, setFactorySearchQuery] = useState('');

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
  const [showToolsMenu, setShowToolsMenu] = useState(false);
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

  // Clone description input state
  const [cloneDesc, setCloneDesc] = useState('');

  // Project history tracks the core editable mod state.
  const projectSnapshot = useMemo(() => ({
    tweaks,
    clones,
    disabledUnitIds,
    buildMenuSteps,
    buildMenuPacks,
    weaponLibrary,
    supportingWeaponDefs,
    unitCollections,
    tweakModules,
    lobbySetup
  }), [tweaks, clones, disabledUnitIds, buildMenuSteps, buildMenuPacks, weaponLibrary, supportingWeaponDefs, unitCollections, tweakModules, lobbySetup]);
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const lastSnapshotRef = useRef(projectSnapshot);
  const applyingHistoryRef = useRef(false);
  const toolsMenuRef = useRef(null);

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

  useEffect(() => {
    if (applyingHistoryRef.current) {
      applyingHistoryRef.current = false;
      lastSnapshotRef.current = projectSnapshot;
      return;
    }

    if (JSON.stringify(lastSnapshotRef.current) === JSON.stringify(projectSnapshot)) return;
    const previousSnapshot = lastSnapshotRef.current;
    setHistoryPast(prev => [...prev.slice(-49), previousSnapshot]);
    setHistoryFuture([]);
    lastSnapshotRef.current = projectSnapshot;
  }, [projectSnapshot]);

  const applyProjectSnapshot = useCallback((snapshot) => {
    setTweaks(snapshot.tweaks || {});
    setClones(snapshot.clones || []);
    setDisabledUnitIds(snapshot.disabledUnitIds || []);
    setBuildMenuSteps(snapshot.buildMenuSteps || []);
    setBuildMenuPacks(snapshot.buildMenuPacks || { extraUnits: false, scavengerUnits: false });
    setWeaponLibrary(snapshot.weaponLibrary || []);
    setSupportingWeaponDefs(snapshot.supportingWeaponDefs || []);
    setUnitCollections(snapshot.unitCollections || []);
    setTweakModules(snapshot.tweakModules || []);
    setLobbySetup(snapshot.lobbySetup || PROJECT_STORE_DEFAULTS.lobbySetup);
  }, [setBuildMenuPacks, setBuildMenuSteps, setClones, setDisabledUnitIds, setLobbySetup, setSupportingWeaponDefs, setTweaks, setUnitCollections, setWeaponLibrary, setTweakModules]);

  const handleUndo = useCallback(() => {
    if (historyPast.length === 0) return;
    const target = historyPast[historyPast.length - 1];
    applyingHistoryRef.current = true;
    setHistoryPast(prev => prev.slice(0, -1));
    setHistoryFuture(prev => [projectSnapshot, ...prev].slice(0, 50));
    lastSnapshotRef.current = target;
    applyProjectSnapshot(target);
  }, [historyPast, projectSnapshot, applyProjectSnapshot]);

  const handleRedo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const target = historyFuture[0];
    applyingHistoryRef.current = true;
    setHistoryPast(prev => [...prev.slice(-49), projectSnapshot]);
    setHistoryFuture(prev => prev.slice(1));
    lastSnapshotRef.current = target;
    applyProjectSnapshot(target);
  }, [historyFuture, projectSnapshot, applyProjectSnapshot]);

  const showToast = useCallback((message) => {
    setToast({ show: true, message });
    setTimeout(() => setToast({ show: false, message: '' }), 2500);
  }, []);

  const {
    document: normalizedProjectDocument,
    createCheckpoint,
  } = useProjectPersistence({ state: projectStore, hydrate: hydrateProjectStore, onNotice: showToast });

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
    applyingHistoryRef.current = true;
    applyProjectSnapshot(snapshot);
    setUnitDescriptions(snapshot.unitDescriptions || {});
    setProjectName(snapshot.projectName || 'BAR Editor Mod');
    setProjectAuthor(snapshot.projectAuthor || 'Developer');
    setProjectDesc(snapshot.projectDesc || 'A custom unit configuration mod.');
    setIncludeTweaks(snapshot.includeTweaks ?? true);
    setIncludeClones(snapshot.includeClones ?? true);
    setIncludeRosters(snapshot.includeRosters ?? true);
    setIncludeHeader(snapshot.includeHeader ?? true);
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
  const knownTweakPackageUnitIds = useMemo(() => allUnitsList.map(unit => unit.id), [allUnitsList]);

  const handleAddTweakModules = useCallback((incomingModules) => {
    setTweakModules(current => {
      const hashes = new Set(current.map(module => module.contentHash));
      const additions = incomingModules.filter(module => !hashes.has(module.contentHash));
      return [...current, ...additions].map((module, index) => ({ ...module, order: index }));
    });
  }, [setTweakModules]);

  const handleImportLobbyBundle = useCallback(({ modules: incomingModules = [], lobbySetup: importedSetup }) => {
    if (incomingModules.length) handleAddTweakModules(incomingModules);
    if (importedSetup) setLobbySetup(importedSetup);
  }, [handleAddTweakModules, setLobbySetup]);

  const handleClearLobbySetup = useCallback(() => {
    setLobbySetup(PROJECT_STORE_DEFAULTS.lobbySetup);
  }, [setLobbySetup]);

  const handleUpdateTweakModule = useCallback((moduleId, patch) => {
    setTweakModules(current => current.map(module => {
      if (module.id !== moduleId) return module;
      if (module.converted && patch.enabled) return module;
      return { ...module, ...patch };
    }));
  }, [setTweakModules]);

  const handleRemoveTweakModule = useCallback((moduleId) => {
    setTweakModules(current => current.filter(module => module.id !== moduleId));
  }, [setTweakModules]);

  const handleMoveTweakModule = useCallback((moduleId, direction) => {
    setTweakModules(current => {
      const target = current.find(module => module.id === moduleId);
      if (!target) return current;
      const lane = current
        .filter(module => module.kind === target.kind && module.stage === target.stage)
        .sort((left, right) => left.order - right.order);
      const index = lane.findIndex(module => module.id === moduleId);
      const swapIndex = index + direction;
      if (index < 0 || swapIndex < 0 || swapIndex >= lane.length) return current;
      const leftId = lane[index].id;
      const rightId = lane[swapIndex].id;
      const leftOrder = lane[index].order;
      const rightOrder = lane[swapIndex].order;
      const moved = current.map(module => module.id === leftId
        ? { ...module, order: rightOrder }
        : module.id === rightId ? { ...module, order: leftOrder } : module);
      return moved.sort((left, right) => left.order - right.order);
    });
  }, [setTweakModules]);

  const handleReorderTweakModules = useCallback((orderedIds) => {
    setTweakModules(current => {
      const orderById = new Map((orderedIds || []).map((moduleId, index) => [moduleId, index]));
      return current.map(module => orderById.has(module.id)
        ? { ...module, order: orderById.get(module.id) }
        : module).sort((left, right) => left.order - right.order);
    });
  }, [setTweakModules]);

  const handleAddSupportingWeaponDefs = useCallback((incomingDefinitions) => {
    const incoming = Array.isArray(incomingDefinitions) ? incomingDefinitions : [incomingDefinitions];
    setSupportingWeaponDefs(current => {
      const next = [...current];
      incoming.filter(Boolean).forEach(definition => {
        const destination = `${definition.ownerUnitId}:${definition.key}`.toLowerCase();
        const index = next.findIndex(item => `${item.ownerUnitId}:${item.key}`.toLowerCase() === destination);
        if (index >= 0) next[index] = { ...next[index], ...definition, enabled: true };
        else next.push({ ...definition, enabled: true });
      });
      return next;
    });
  }, [setSupportingWeaponDefs]);

  const handleUpdateSupportingWeaponDef = useCallback((definitionId, patch) => {
    const target = supportingWeaponDefs.find(definition => definition.id === definitionId);
    if (!target) return;
    const nextKey = typeof patch.key === 'string' ? patch.key : target.key;
    const renaming = nextKey && nextKey !== target.key;
    setSupportingWeaponDefs(current => {
      const updated = current.map(definition => {
        if (definition.id === definitionId) return {
          ...definition,
          ...patch,
          ...(renaming && definition.label === target.key.toUpperCase() ? { label: nextKey.toUpperCase() } : {}),
        };
        if (!renaming || definition.ownerUnitId !== target.ownerUnitId) return definition;
        const referencesTarget = definition.definition?.customparams?.cluster_def?.toLowerCase() === target.key.toLowerCase();
        const referencedBy = (definition.referencedBy || []).map(key => key.toLowerCase() === target.key.toLowerCase() ? nextKey : key);
        return {
          ...definition,
          ...(referencesTarget ? {
            definition: {
              ...definition.definition,
              customparams: { ...definition.definition.customparams, cluster_def: nextKey },
            },
            dependencies: (definition.dependencies || []).map(key => key.toLowerCase() === target.key.toLowerCase() ? nextKey : key),
          } : {}),
          referencedBy,
        };
      });
      return updated.map(definition => {
        const dependency = typeof definition.definition?.customparams?.cluster_def === 'string'
          ? definition.definition.customparams.cluster_def.trim().toLowerCase()
          : '';
        return {
          ...definition,
          dependencies: dependency ? [dependency] : [],
          referencedBy: updated
            .filter(candidate => candidate.ownerUnitId === definition.ownerUnitId
              && candidate.definition?.customparams?.cluster_def?.trim().toLowerCase() === definition.key.toLowerCase())
            .map(candidate => candidate.key),
        };
      });
    });
    if (renaming) {
      setTweaks(currentTweaks => {
        const ownerPatch = currentTweaks[target.ownerUnitId];
        if (!ownerPatch) return currentTweaks;
        let changed = false;
        const updatedOwnerPatch = Object.fromEntries(Object.entries(ownerPatch).map(([key, value]) => {
          if (/^weapon_slot_\d+_cluster_def$/.test(key) && String(value).toLowerCase() === target.key.toLowerCase()) {
            changed = true;
            return [key, nextKey];
          }
          return [key, value];
        }));
        return changed ? { ...currentTweaks, [target.ownerUnitId]: updatedOwnerPatch } : currentTweaks;
      });
    }
  }, [setSupportingWeaponDefs, setTweaks, supportingWeaponDefs]);

  const handleRemoveSupportingWeaponDef = useCallback((definitionId) => {
    setSupportingWeaponDefs(current => current.filter(definition => definition.id !== definitionId));
  }, [setSupportingWeaponDefs]);

  const handleApplyTweakConversions = useCallback((module, conversions) => {
    if (!module || module.enabled || module.converted) return;
    const existingIds = new Set(allUnitsList.map(unit => unit.id.toLowerCase()));
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
    if (safeClones.length) {
      setIncludeClones(true);
      setClones(current => [...current, ...safeClones]);
    }

    const menuConversions = conversions.filter(item => (
      item.type === 'build-add' || item.type === 'build-remove' || item.type === 'build-roster'
    ));
    if (menuConversions.length) {
      setIncludeRosters(true);
      setBuildMenuSteps(current => {
        const next = current.map(step => ({ ...step, add: [...(step.add || [])], remove: [...(step.remove || [])], order: [...(step.order || [])] }));
        menuConversions.forEach(item => {
          let step = next.find(entry => entry.builderId.toLowerCase() === item.builderId);
          if (!step) {
            step = { builderId: item.builderId, add: [], remove: [], order: [] };
            next.push(step);
          }
          if (item.type === 'build-roster') {
            const desired = [...new Set((item.unitIds || []).map(id => id.toLowerCase()))];
            const rootBuilderId = resolveCloneRootId(item.builderId);
            const defaults = activeFactoryRosters[item.builderId] || activeFactoryRosters[rootBuilderId] || [];
            const defaultIds = defaults.map(id => id.toLowerCase());
            const desiredSet = new Set(desired);
            const defaultSet = new Set(defaultIds);
            step.add = desired.filter(id => !defaultSet.has(id));
            step.remove = defaultIds.filter(id => !desiredSet.has(id));
            step.order = desired;
          } else if (item.type === 'build-add') {
            step.remove = step.remove.filter(id => id.toLowerCase() !== item.unitId);
            if (!step.add.some(id => id.toLowerCase() === item.unitId)) step.add.push(item.unitId);
          } else {
            step.add = step.add.filter(id => id.toLowerCase() !== item.unitId);
            if (!step.remove.some(id => id.toLowerCase() === item.unitId)) step.remove.push(item.unitId);
          }
        });
        return next.filter(step => step.add.length || step.remove.length || step.order.length);
      });
    }

    const parameterConversions = conversions.filter(item => item.type === 'unit-parameter' && existingIds.has(item.unitId));
    const importedCloneBases = new Map(safeClones.map(clone => [clone.newId, clone.baseId]));
    const weaponConversions = conversions.flatMap(item => {
      if (item.type !== 'weapon-parameter' || !existingIds.has(item.unitId)) return [];
      const unitInfo = allUnitsList.find(unit => unit.id.toLowerCase() === item.unitId);
      const baseId = importedCloneBases.get(item.unitId) || (unitInfo?.isClone ? resolveCloneRootId(item.unitId) : item.unitId);
      const resolvedSlot = Number.isInteger(Number(item.slot)) && Number(item.slot) > 0
        ? Number(item.slot)
        : defaultsDb[baseId]?.weaponSlots?.find(entry => entry.defKey?.toLowerCase() === item.weaponDefKey)?.slot;
      return resolvedSlot ? [{ ...item, tweakKey: `weapon_slot_${resolvedSlot}_${item.key}` }] : [];
    });
    if (parameterConversions.length || weaponConversions.length) {
      setIncludeTweaks(true);
      setTweaks(current => {
        const next = { ...current };
        parameterConversions.forEach(item => {
          next[item.unitId] = { ...(next[item.unitId] || {}), [item.key]: item.value };
        });
        weaponConversions.forEach(item => {
          next[item.unitId] = { ...(next[item.unitId] || {}), [item.tweakKey]: item.value };
        });
        return next;
      });
    }

    const supportingConversions = conversions
      .filter(item => item.type === 'supporting-weapondef' && existingIds.has(item.weaponDef?.ownerUnitId))
      .map(item => item.weaponDef);
    if (supportingConversions.length) handleAddSupportingWeaponDefs(supportingConversions);

    const appliedCount = safeClones.length + menuConversions.length + parameterConversions.length + weaponConversions.length + supportingConversions.length;
    if (appliedCount === 0) {
      showToast('No recognized changes could be applied. Resolve ID conflicts or inspect the module warnings.');
      return;
    }
    setTweakModules(current => current.map(item => item.id === module.id ? { ...item, converted: true, enabled: false } : item));
    showToast(`${appliedCount} recognized change${appliedCount === 1 ? '' : 's'} applied. Source module archived.`);
  }, [activeFactoryRosters, allUnitsList, defaultsDb, handleAddSupportingWeaponDefs, resolveCloneRootId, setBuildMenuSteps, setClones, setIncludeClones, setIncludeRosters, setIncludeTweaks, setTweakModules, setTweaks, showToast]);

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
    setIncludeClones(true);
    setClones(prev => prev.map(clone => {
      if (clone.newId.toLowerCase() !== selectedUnit.id.toLowerCase()) return clone;
      const weaponSwaps = { ...(clone.weaponSwaps || {}) };
      weaponSwaps[String(slotNum)] = {
        sourceUnitId: blueprint.sourceUnitId,
        sourceWeaponDefKey: blueprint.sourceWeaponDefKey,
        libraryWeaponId: blueprint.id
      };
      return { ...clone, weaponSwaps };
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
    if (clones.some(clone => clone.newId.toLowerCase() === unitId.toLowerCase())) {
      setIncludeClones(true);
      setIncludeTweaks(true);
    }
    setTweaks(prev => {
      const unitTweaks = { ...prev[unitId] };
      if (value === '' || value === undefined) {
        delete unitTweaks[statKey];
      } else {
        unitTweaks[statKey] = value;
      }

      const next = { ...prev };
      if (Object.keys(unitTweaks).length === 0) {
        delete next[unitId];
      } else {
        next[unitId] = unitTweaks;
      }
      return next;
    });
  };

  const setNestedVal = (obj, path, val) => {
    const keys = path.split('.');
    let cur = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!cur[k]) cur[k] = {};
      cur = cur[k];
    }
    cur[keys[keys.length - 1]] = val;
  };

  // Compile Lua tweaks script
  const generatedTweakUnitsLua = useMemo(() => {
    if (!includeTweaks) return '{\n}';
    const patchObj = {};

    const getActiveWeaponSlotsForUnit = (uId) => {
      const uInfo = allUnitsList.find(u => u.id === uId);
      if (!uInfo) return [];
      const bId = uInfo.isClone ? resolveCloneRootId(uId) : uId;
      const baseDefaults = defaultsDb[bId];
      if (!baseDefaults) return [];
      let slots = baseDefaults.weaponSlots ? JSON.parse(JSON.stringify(baseDefaults.weaponSlots)) : [];
      const cloneInfo = uInfo.isClone ? clones.find(c => c.newId.toLowerCase() === uId.toLowerCase()) : null;
      const effectiveWeaponSwaps = cloneInfo ? getInheritedCloneWeaponSwaps(uId) : null;
      if (effectiveWeaponSwaps && slots.length > 0) {
        slots = slots.map(wSlot => {
          const slotKey = String(wSlot.slot);
          const swap = effectiveWeaponSwaps[slotKey];
          if (swap) {
            const swapDefaults = defaultsDb[resolveCloneRootId(swap.sourceUnitId)];
            if (swapDefaults && swapDefaults.weaponSlots) {
              const srcSlot = swapDefaults.weaponSlots.find(s => s.defKey === swap.sourceWeaponDefKey.toLowerCase());
              if (srcSlot) {
                return { ...srcSlot, slot: wSlot.slot };
              }
            }
          }
          return wSlot;
        });
      }
      return slots;
    };

    Object.entries(tweaks).forEach(([unitId, statPatch]) => {
      const unitInfo = allUnitsList.find(u => u.id === unitId);
      const defaults = defaultsDb[unitInfo?.isClone ? resolveCloneRootId(unitId) : unitId];
      if (!defaults) return;

      const unitPatch = {};

      Object.entries(statPatch).forEach(([key, val]) => {
        // Multi-slot weapon properties
        if (key.startsWith('weapon_slot_')) {
          const match = key.match(/^weapon_slot_(\d+)_(.+)$/);
          if (match) {
            const slotNum = parseInt(match[1], 10);
            const param = match[2];
            const activeSlots = getActiveWeaponSlotsForUnit(unitId);
            const slot = activeSlots.find(s => s.slot === slotNum);
            if (slot && slot.defKey) {
              const wDef = slot.defKey.toLowerCase();
              let typedVal = null;
              let subPath = null;
              if (param === 'onlytargetcategory' || param === 'badtargetcategory' || WEAPON_SLOT_MOUNT_PARAMS.has(param)) {
                // Target categories belong to the UnitDef weapon slot, not the WeaponDef.
                let mountValue = val;
                if (['fastautoretargeting', 'fastquerypointupdate'].includes(param)) mountValue = val === 'true' || val === true;
                else if (!['onlytargetcategory', 'badtargetcategory', 'maindir'].includes(param)) {
                  const numericValue = Number(val);
                  if (Number.isFinite(numericValue)) mountValue = numericValue;
                } else mountValue = val ? String(val) : '';
                setNestedVal(unitPatch, `weapons.${slotNum}.${param}`, mountValue);
              } else if (param === 'interceptedbyshields') {
                // Compatibility for projects saved before the bitmask correction.
                subPath = 'interceptedbyshieldtype';
                typedVal = val === 'true' || val === true ? 1 : 0;
              } else if (WEAPON_SLOT_BOOLEAN_PARAMS.has(param)) {
                subPath = WEAPON_SLOT_PATHS[param] || param;
                typedVal = val === 'true' || val === true;
                if (param === 'toairweapon' && typedVal && !Object.prototype.hasOwnProperty.call(statPatch, `weapon_slot_${slotNum}_onlytargetcategory`)) {
                  setNestedVal(unitPatch, `weapons.${slotNum}.onlytargetcategory`, 'VTOL');
                }
              } else if (WEAPON_SLOT_STRING_PARAMS.has(param)) {
                subPath = WEAPON_SLOT_PATHS[param] || param;
                typedVal = val ? String(val) : '';
              } else {
                const parsedNum = parseFloat(val);
                if (!Number.isNaN(parsedNum)) {
                  typedVal = parsedNum;
                  subPath = WEAPON_SLOT_PATHS[param] || param;
                }
              }
              if (subPath && typedVal !== null) {
                setNestedVal(unitPatch, `weapondefs.${wDef}.${subPath}`, typedVal);
              }
            }
          }
          return;
        }

        // Legacy compatibility fallback for weapon1... keys
        if (key.startsWith('weapon1')) {
          const legacyParam = key.slice(7).toLowerCase();
          const activeSlots = getActiveWeaponSlotsForUnit(unitId);
          const slot = activeSlots.find(s => s.slot === 1);
          if (slot && slot.defKey) {
            const wDef = slot.defKey.toLowerCase();
            let typedVal = parseFloat(val);
            if (!Number.isNaN(typedVal)) {
              let subPath = null;
              if (legacyParam === 'damage') subPath = 'damage.default';
              else if (legacyParam === 'reload') subPath = 'reloadtime';
              else if (legacyParam === 'range') subPath = 'range';
              else if (legacyParam === 'velocity') subPath = 'weaponvelocity';
              else if (legacyParam === 'flighttime') subPath = 'flighttime';
              else if (legacyParam === 'aoe') subPath = 'areaofeffect';
              else if (legacyParam === 'accuracy') subPath = 'accuracy';
              else if (legacyParam === 'sprayangle') subPath = 'sprayangle';
              else if (legacyParam === 'projectiles') subPath = 'projectiles';
              else if (legacyParam === 'burst') subPath = 'burst';
              else if (legacyParam === 'burstrate') subPath = 'burstrate';

              if (subPath) {
                setNestedVal(unitPatch, `weapondefs.${wDef}.${subPath}`, typedVal);
              }
            }
          }
          return;
        }

        const config = STAT_KEYS.find(s => s.key === key);
        if (!config && key.startsWith('customparams.')) {
          const customKey = key.slice('customparams.'.length);
          if (!isValidCustomParameterKey(customKey)) return;
          let typedValue = val;
          if (typeof val === 'string' && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(val.trim())) typedValue = Number(val);
          else if (val === 'true' || val === 'false') typedValue = val === 'true';
          setNestedVal(unitPatch, `customparams.${customKey}`, typedValue);
          return;
        }
        if (!config) return;
        if (config.output === 'tweakdefs') return;
        if (key === 'explodeas' && Object.keys(statPatch).some(statKey => statKey.startsWith('death_explosion_'))) return;
        if (key === 'selfdestructas' && Object.keys(statPatch).some(statKey => statKey.startsWith('selfd_explosion_'))) return;

        let typedVal = val;
        if (config.type === 'number') {
          typedVal = parseFloat(val);
          if (Number.isNaN(typedVal)) return;
        } else if (config.type === 'boolean') {
          typedVal = val === 'true' || val === true;
        }

        if (config.key === 'energymake') {
          unitPatch.energymake = typedVal;
        } else {
          const patchKey = config.patchKey ?? config.key;
          if (config.nestedIn) {
            setNestedVal(unitPatch, `${config.nestedIn}.${patchKey}`, typedVal);
          } else if (patchKey.includes('.')) {
            setNestedVal(unitPatch, patchKey, typedVal);
          } else {
            unitPatch[patchKey] = typedVal;
          }
        }
      });

      if (Object.keys(unitPatch).length > 0) {
        patchObj[unitId] = unitPatch;
      }
    });

    return Object.keys(patchObj).length > 0 ? serializeLuaTable(patchObj) : '{\n}';
  }, [tweaks, allUnitsList, includeTweaks, clones, defaultsDb, getInheritedCloneWeaponSwaps, resolveCloneRootId]);

  // Base64 Tweak Units
  const tweakUnitsB64 = useMemo(() => {
    if (generatedTweakUnitsLua === '{\n}') return '';
    return encodeLobbyBase64(generatedTweakUnitsLua + ' ', base64Options);
  }, [generatedTweakUnitsLua, base64Options]);

  const deathExplosionTweaks = useMemo(() => {
    if (!includeTweaks) return [];
    return Object.entries(tweaks).flatMap(([unitId, unitTweaks]) => {
    const unitInfo = allUnitsList.find(unit => unit.id === unitId);
    const baseId = unitInfo?.isClone ? resolveCloneRootId(unitId) : unitId;
    const defaults = defaultsDb[baseId] || {};
    const readProfile = prefix => {
      const profile = {};
      for (const key of ['damage', 'aoe', 'camerashake', 'impulsefactor']) {
        const tweakKey = `${prefix}_explosion_${key}`;
        if (unitTweaks[tweakKey] !== undefined) profile[key] = unitTweaks[tweakKey];
      }
      return profile;
    };
    const death = readProfile('death');
    const selfd = readProfile('selfd');
    if (Object.keys(death).length === 0 && Object.keys(selfd).length === 0) return [];
    const explodeAs = unitTweaks.explodeas ?? defaults.explodeas;
    const selfDestructAs = unitTweaks.selfdestructas ?? defaults.selfdestructas ?? defaults.explodeas;
    return [{
      unitId,
      explodeAs,
      selfDestructAs,
      sources: {
        death: {
          name: explodeAs,
          definition: explosionProfiles[String(explodeAs || '').toLowerCase()],
        },
        selfd: {
          name: selfDestructAs,
          definition: explosionProfiles[String(selfDestructAs || '').toLowerCase()],
        },
      },
      death,
      selfd,
    }];
    });
  }, [tweaks, allUnitsList, defaultsDb, explosionProfiles, resolveCloneRootId, includeTweaks]);

  // Compile Lua Tweak Defs
  const generatedTweakDefsLua = useMemo(() => {
    return compileTweakDefsLua({
      currentTweakDefsLua: tweakDefsLua,
      customUnitClones: clones,
      buildMenuWizardSteps: buildMenuSteps,
      disabledUnitIds,
      unitBuildOptions: activeFactoryRosters,
      projectMeta: includeHeader ? { name: projectName, author: projectAuthor, desc: projectDesc } : null,
      compileFlags: { includeClones, includeRosters },
      weaponLibrary,
      deathExplosionTweaks,
      supportingWeaponDefs,
    });
  }, [tweakDefsLua, clones, buildMenuSteps, disabledUnitIds, activeFactoryRosters, projectName, projectAuthor, projectDesc, includeClones, includeRosters, includeHeader, weaponLibrary, deathExplosionTweaks, supportingWeaponDefs]);

  const tweakDefsB64 = useMemo(() => {
    if (!generatedTweakDefsLua.trim()) return '';
    return encodeLobbyBase64(generatedTweakDefsLua + ' ', base64Options);
  }, [generatedTweakDefsLua, base64Options]);

  const compiledLobbyModules = useMemo(() => compileLobbyModules({
    tweakModules,
    generatedTweakDefsLua,
    generatedTweakUnitsLua,
    base64Options,
  }), [tweakModules, generatedTweakDefsLua, generatedTweakUnitsLua, base64Options]);
  const lobbyCommands = useMemo(() => buildLobbyCommands(compiledLobbyModules), [compiledLobbyModules]);

  const totalBytesUsed = compiledLobbyModules.aggregateBytes;
  const lobbyByteLimit = 12000;
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

  // Add Clone
  const applyCloneBuilderAssignments = (steps, cloneId, builderIds) => {
    const normalizedCloneId = cloneId.trim().toLowerCase();
    const desiredBuilders = new Set(builderIds.map(id => id.trim().toLowerCase()).filter(Boolean));
    const next = steps.map(step => ({
      ...step,
      add: step.add.filter(id => id.toLowerCase() !== normalizedCloneId)
    }));

    desiredBuilders.forEach(builderId => {
      const idx = next.findIndex(step => step.builderId.toLowerCase() === builderId);
      if (idx === -1) {
        next.push({ builderId, add: [normalizedCloneId], remove: [] });
      } else {
        next[idx] = {
          ...next[idx],
          remove: next[idx].remove.filter(id => id.toLowerCase() !== normalizedCloneId),
          add: [...next[idx].add, normalizedCloneId]
        };
      }
    });

    return next.filter(step => step.add.length > 0 || step.remove.length > 0 || (step.order && step.order.length > 0));
  };

  const handleCloneBuildersChange = (cloneId, builderIds) => {
    const normalized = [...new Set(builderIds.map(id => id.trim().toLowerCase()).filter(Boolean))];
    setIncludeClones(true);
    if (normalized.length > 0) setIncludeRosters(true);
    setClones(prev => prev.map(clone => (
      clone.newId.toLowerCase() === cloneId.toLowerCase()
        ? { ...clone, builderIds: normalized }
        : clone
    )));
    setBuildMenuSteps(prev => applyCloneBuilderAssignments(prev, cloneId, normalized));
  };

  const getAutomaticCloneBuilders = unitId => {
    const targetId = unitId.trim().toLowerCase();
    const builders = new Set(
      Object.entries(activeFactoryRosters)
        .filter(([, roster]) => Array.isArray(roster) && roster.some(id => id.toLowerCase() === targetId))
        .map(([factoryId]) => factoryId.toLowerCase())
    );

    buildMenuSteps.forEach(step => {
      const builderId = step.builderId.trim().toLowerCase();
      if ((step.remove || []).some(id => id.toLowerCase() === targetId)) builders.delete(builderId);
      if ((step.add || []).some(id => id.toLowerCase() === targetId)) builders.add(builderId);
    });

    return [...builders];
  };

  const handleCreateClone = (e) => {
    e.preventDefault();
    const cleanBase = cloneBaseId.trim().toLowerCase();
    const cleanNew = cloneNewId.trim().toLowerCase();
    const cleanName = cloneName.trim();

    if (!cleanBase || !cleanNew) {
      showToast('Error: Base and New ID are required');
      return;
    }

    if (allUnitsList.some(u => u.id === cleanNew)) {
      showToast('Error: Unit ID already exists');
      return;
    }

    const cleanBuilders = cloneBuilders
      .map(b => b.trim().toLowerCase())
      .filter(Boolean);

    const parentClone = clones.find(clone => clone.newId.trim().toLowerCase() === cleanBase);
    const { rootId, lineage } = getCloneLineage(cleanBase);
    const inheritedTweaks = lineage.reduce((merged, clone) => {
      const cloneId = clone.newId?.trim().toLowerCase();
      return cloneId ? { ...merged, ...(tweaks[cloneId] || {}) } : merged;
    }, { ...(tweaks[rootId] || {}) });
    const inheritedWeaponSwaps = parentClone ? getInheritedCloneWeaponSwaps(cleanBase) : {};

    const newClone = {
      baseId: cleanBase,
      newId: cleanNew,
      displayName: cleanName || cleanNew,
      description: cloneDesc.trim() || undefined,
      builderIds: cleanBuilders,
      addToOriginalBuilders: true,
      ...(Object.keys(inheritedWeaponSwaps).length > 0
        ? {
            weaponSwaps: Object.fromEntries(
              Object.entries(inheritedWeaponSwaps).map(([slot, swap]) => [slot, { ...swap }])
            )
          }
        : {})
    };

    setIncludeClones(true);
    if (Object.keys(inheritedTweaks).length > 0) setIncludeTweaks(true);
    if (newClone.builderIds.length > 0) setIncludeRosters(true);
    setClones(prev => [...prev, newClone]);
    if (activeCollection) {
      setUnitCollections(previous => previous.map(collection => (
        collection.id === activeCollection.id && !collection.unitIds.includes(cleanNew)
          ? { ...collection, unitIds: [...collection.unitIds, cleanNew] }
          : collection
      )));
    }
    if (Object.keys(inheritedTweaks).length > 0) {
      setTweaks(prev => ({ ...prev, [cleanNew]: { ...inheritedTweaks } }));
    }
    setBuildMenuSteps(prev => applyCloneBuilderAssignments(prev, cleanNew, newClone.builderIds));
    setSelectedUnitId(cleanNew);
    setShowClonePanel(false);
    showToast(`Created clone: ${cleanNew}${activeCollection ? ` in ${activeCollection.name}` : ''}`);

    setCloneBaseId('');
    setCloneNewId('');
    setCloneName('');
    setCloneBuilders([]);
    setCloneAutoAssignBuilders(false);
    setCloneDesc('');
  };

  // Reset tweaks
  const handleResetUnit = (unitId) => {
    setTweaks(prev => {
      const next = { ...prev };
      delete next[unitId];
      return next;
    });
    setDisabledUnitIds(prev => prev.filter(id => id !== unitId));
    showToast(`Reset stats for ${unitId}`);
  };

  const handleResetSummaryUnitEdits = (unitId) => {
    setTweaks(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => id.toLowerCase() !== unitId.toLowerCase())));
    setUnitDescriptions(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => id.toLowerCase() !== unitId.toLowerCase())));
    showToast(`Reset all edits for ${unitId}`);
  };

  const handleResetAllSummaryUnitEdits = () => {
    setTweaks({});
    setUnitDescriptions({});
    setActiveRelationshipKey(null);
    showToast('Reset all unit edits');
  };

  const handleDeleteSummaryClone = (clone) => {
    const cloneId = clone.newId.toLowerCase();
    setClones(prev => prev.filter(item => item.newId.toLowerCase() !== cloneId));
    setTweaks(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => id.toLowerCase() !== cloneId)));
    setUnitDescriptions(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => id.toLowerCase() !== cloneId)));
    setBuildMenuSteps(prev => applyCloneBuilderAssignments(prev, clone.newId, []));
    if (selectedUnitId?.toLowerCase() === cloneId) setSelectedUnitId(clone.baseId);
    showToast(`Deleted clone ${clone.newId}`);
  };

  const handleDeleteAllSummaryClones = () => {
    const cloneIds = new Set(clones.map(clone => clone.newId.toLowerCase()));
    const selectedClone = clones.find(clone => clone.newId.toLowerCase() === selectedUnitId?.toLowerCase());
    setClones([]);
    setTweaks(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !cloneIds.has(id.toLowerCase()))));
    setUnitDescriptions(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => !cloneIds.has(id.toLowerCase()))));
    setBuildMenuSteps(prev => clones.reduce((steps, clone) => applyCloneBuilderAssignments(steps, clone.newId, []), prev));
    if (selectedClone) setSelectedUnitId(selectedClone.baseId);
    showToast('Deleted all custom clones');
  };

  const handleRevertSummaryRoster = (builderId) => {
    setBuildMenuSteps(prev => prev.filter(step => step.builderId.toLowerCase() !== builderId.toLowerCase()));
    showToast(`Reverted build menu for ${builderId}`);
  };

  const handleResetAllSummaryRosters = () => {
    setBuildMenuSteps([]);
    setBuildMenuPacks({ extraUnits: false, scavengerUnits: false });
    setSupportingWeaponDefs([]);
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
    setTweaks({});
    setUnitDescriptions({});
    setClones([]);
    setDisabledUnitIds([]);
    setBuildMenuSteps([]);
    setBuildMenuPacks({ extraUnits: false, scavengerUnits: false });
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
          handleStatChange(unit.id, tweakKey, newVal.toFixed(2));
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
        handleStatChange(unit.id, bulkStatKey, newVal.toFixed(2));
        count++;
      }
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

  // Mod Import/Export Handlers
  const handleExportConfig = () => {
    const config = normalizedProjectDocument;
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${projectName.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_mod_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Configuration exported!');
  };

  const handleImportConfig = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      assertProjectSize(file.size);
    } catch (error) {
      showToast(error.message);
      e.target.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = normalizeProjectDocument(JSON.parse(event.target.result));
        void createCheckpoint('before import').catch(() => undefined);
        hydrateProjectStore(config);
        showToast('Configuration imported successfully!');
      } catch (error) {
        showToast(error?.message || 'Error: Invalid config file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
      { id: 'tool-batch', kind: 'Tool', label: 'Batch adjust stats', description: 'Apply one adjustment across matching units.', onSelect: () => { openEditor(); setShowBulkPanel(true); } },
      { id: 'tool-presets', kind: 'Tool', label: 'Preset gallery', description: 'Save or apply reusable project snapshots.', onSelect: () => { setShowMainMenu(false); setShowPresetGallery(true); setActiveWorkspace('preset-gallery'); } },
      { id: 'tool-tweak-package', kind: 'Tool', label: 'Tweak Package Lab', description: 'Inspect and package modular tweakdefs and tweakunits safely.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('tweak-lab'); } },
      { id: 'tool-bar-reference-library', kind: 'Tool', label: 'BAR Reference Library', description: 'Search verified units, WeaponDefs, models, scripts, artwork, effects, sounds, and explosion profiles.', onSelect: () => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('reference-library'); } },
      { id: 'tool-mutation', kind: 'Tool', label: 'Mutation lab', description: 'Generate controlled random adjustments.', onSelect: () => { openEditor(); setShowRandomPanel(true); } },
    ];

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

    Object.keys(WEAPON_SLOT_PATHS).forEach(key => commands.push({
      id: `weapon-parameter-${key}`,
      kind: 'Weapon field',
      label: getRelationshipLabel(key),
      description: 'Open the active weapon slot and focus this field.',
      keywords: key,
      onSelect: () => { openEditor(); setActiveParamTab('weapons'); setActiveRelationshipKey(key); },
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
  }, [handleUndo, handleRedo]);

  useEffect(() => {
    if (!showToolsMenu) return undefined;

    const closeMenuOnOutsidePointer = (event) => {
      if (!toolsMenuRef.current?.contains(event.target)) setShowToolsMenu(false);
    };
    const closeMenuOnEscape = (event) => {
      if (event.key === 'Escape') {
        setShowToolsMenu(false);
        toolsMenuRef.current?.querySelector('.header-tools-trigger')?.focus();
      }
    };

    document.addEventListener('pointerdown', closeMenuOnOutsidePointer);
    window.addEventListener('keydown', closeMenuOnEscape);
    toolsMenuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener('pointerdown', closeMenuOnOutsidePointer);
      window.removeEventListener('keydown', closeMenuOnEscape);
    };
  }, [showToolsMenu]);

  // --- Roster Designer Helpers ---
  const producerCatalog = useMemo(
    () => createProducerCatalog(activeFactoryRosters, unitsDb.names, defaultsDb),
    [activeFactoryRosters, defaultsDb, unitsDb.names]
  );

  const selectedProducer = useMemo(
    () => producerCatalog.find(producer => producer.id === selectedFactoryId) || null,
    [producerCatalog, selectedFactoryId]
  );

  const producerCounts = useMemo(() => ({
    all: producerCatalog.length,
    [PRODUCER_KIND.FACTORY]: producerCatalog.filter(producer => producer.kind === PRODUCER_KIND.FACTORY).length,
    [PRODUCER_KIND.BUILDER]: producerCatalog.filter(producer => producer.kind === PRODUCER_KIND.BUILDER).length,
  }), [producerCatalog]);

  const filteredProducers = useMemo(() => {
    return producerCatalog.filter(producer => {
      if (designerFaction !== 'all' && producer.faction !== designerFaction) return false;
      if (producerKindFilter !== 'all' && producer.kind !== producerKindFilter) return false;
      if (factorySearchQuery.trim()) {
        const query = factorySearchQuery.toLowerCase();
        if (!producer.id.toLowerCase().includes(query) && !producer.name.toLowerCase().includes(query)) return false;
      }
      return true;
    });
  }, [producerCatalog, designerFaction, producerKindFilter, factorySearchQuery]);

  useEffect(() => {
    if (producerCatalog.length > 0 && !selectedProducer) {
      setSelectedFactoryId(producerCatalog[0].id);
    }
  }, [producerCatalog, selectedProducer]);

  const activeRosterItems = useMemo(() => {
    const defaults = activeFactoryRosters[selectedFactoryId] || [];
    const step = buildMenuSteps.find(s => s.builderId === selectedFactoryId);
    const removedSet = new Set(step ? step.remove.map(r => r.toLowerCase()) : []);
    const addedList = step ? step.add : [];

    let items = defaults.map(id => ({
      id,
      name: unitsDb.names[id] || id,
      status: removedSet.has(id.toLowerCase()) ? 'removed' : 'default',
      sourcePack: getBuildMenuPackSource(selectedFactoryId, id, buildMenuPacks)
    }));

    addedList.forEach(id => {
      if (!defaults.map(d => d.toLowerCase()).includes(id.toLowerCase())) {
        const cloneInfo = clones.find(c => c.newId.toLowerCase() === id.toLowerCase());
        const name = cloneInfo ? (cloneInfo.displayName || cloneInfo.newId) : (unitsDb.names[id] || id);
        items.push({
          id,
          name,
          status: 'added'
        });
      }
    });

    if (step && step.order && step.order.length > 0) {
      const orderMap = {};
      step.order.forEach((id, idx) => {
        orderMap[id.toLowerCase()] = idx;
      });
      items.sort((a, b) => {
        const idxA = orderMap[a.id.toLowerCase()];
        const idxB = orderMap[b.id.toLowerCase()];
        if (idxA !== undefined && idxB !== undefined) {
          return idxA - idxB;
        }
        if (idxA !== undefined) return -1;
        if (idxB !== undefined) return 1;
        return 0;
      });
    }

    return items;
  }, [selectedFactoryId, buildMenuSteps, clones, activeFactoryRosters, buildMenuPacks, unitsDb.names]);

  const availableUnitsForFactory = useMemo(() => {
    const activeIds = new Set(
      activeRosterItems
        .filter(item => item.status !== 'removed')
        .map(item => item.id.toLowerCase())
    );
    const factoryFaction = getFactionOfUnit(selectedFactoryId);

    return allUnitsList.filter(unit => {
      if (activeIds.has(unit.id.toLowerCase())) return false;

      if (availableFactionFilter === 'clone') {
        if (!unit.isClone) return false;
      } else if (availableFactionFilter === 'factory') {
        if (unit.faction !== factoryFaction) return false;
      } else if (availableFactionFilter !== 'all') {
        if (unit.faction !== availableFactionFilter) return false;
      }

      if (availableSearchQuery.trim()) {
        const query = availableSearchQuery.toLowerCase();
        return unit.id.toLowerCase().includes(query) || unit.name.toLowerCase().includes(query);
      }

      return true;
    });
  }, [allUnitsList, activeRosterItems, selectedFactoryId, availableFactionFilter, availableSearchQuery]);

  const validationIssues = useMemo(() => {
    const issues = [];
    const knownUnitIds = new Set(allUnitsList.map(unit => unit.id.toLowerCase()));
    const knownWeaponDefs = new Set(Object.values(defaultsDb).flatMap(unit => (
      unit?.weaponSlots || []
    )).map(slot => String(slot.defKey || '').toLowerCase()).filter(Boolean));
    const enabledSupportingWeaponDefs = supportingWeaponDefs.filter(definition => definition.enabled !== false);
    const supportingDestinations = new Set(enabledSupportingWeaponDefs.map(definition => (
      `${definition.ownerUnitId}:${definition.key}`.toLowerCase()
    )));
    Object.entries(tweaks).forEach(([unitId, patch]) => {
      const unitName = unitsDb.names[unitId] || clones.find(c => c.newId.toLowerCase() === unitId.toLowerCase())?.displayName || unitId;
      Object.entries(patch).forEach(([key, val]) => {
        const warning = getValidationWarning(key, val);
        if (warning) {
          issues.push({
            unitId,
            unitName,
            key,
            value: val,
            ...warning
          });
        }
        const referenceId = String(val || '').trim().toLowerCase();
        if ((key === 'customparams.carried_unit' || /^weapon_slot_\d+_spawns_name$/.test(key))
          && referenceId && !knownUnitIds.has(referenceId)) {
          issues.push({
            unitId,
            unitName,
            key,
            value: val,
            level: 'warning',
            message: `Referenced unit "${val}" is not present in the current BAR definition catalog or project clones.`,
          });
        }
        const localSupportingWeaponDef = supportingDestinations.has(`${unitId}:${referenceId}`.toLowerCase());
        if (/^weapon_slot_\d+_cluster_def$/.test(key)
          && referenceId && !knownWeaponDefs.has(referenceId) && !localSupportingWeaponDef) {
          issues.push({
            unitId,
            unitName,
            key,
            value: val,
            level: 'warning',
            message: `Referenced WeaponDef "${val}" is not present in the loaded BAR definitions. Raw imported modules may define it later.`,
          });
        }
      });
    });
    const checkedSupportingDestinations = new Set();
    enabledSupportingWeaponDefs.forEach(definition => {
      const destination = `${definition.ownerUnitId}:${definition.key}`.toLowerCase();
      if (checkedSupportingDestinations.has(destination)) {
        issues.push({
          unitId: definition.ownerUnitId, unitName: unitsDb.names[definition.ownerUnitId] || definition.ownerUnitId,
          key: `supporting_weapondef_${definition.key}`, level: 'error',
          message: `Supporting WeaponDef "${definition.key}" is defined more than once for ${definition.ownerUnitId}.`,
        });
      }
      checkedSupportingDestinations.add(destination);
      if (!knownUnitIds.has(definition.ownerUnitId)) {
        issues.push({
          unitId: definition.ownerUnitId, unitName: definition.ownerUnitId,
          key: `supporting_weapondef_${definition.key}`, level: 'error',
          message: `Supporting WeaponDef owner "${definition.ownerUnitId}" is not present in the BAR catalog or project clones.`,
        });
      }
      (definition.dependencies || []).forEach(dependency => {
        const localDependency = `${definition.ownerUnitId}:${dependency}`.toLowerCase();
        const baseHasDependency = defaultsDb[resolveCloneRootId(definition.ownerUnitId)]?.weaponSlots?.some(slot => slot.defKey?.toLowerCase() === dependency);
        if (!supportingDestinations.has(localDependency) && !baseHasDependency) {
          issues.push({
            unitId: definition.ownerUnitId, unitName: unitsDb.names[definition.ownerUnitId] || definition.ownerUnitId,
            key: `supporting_weapondef_${definition.key}`, level: 'warning',
            message: `Supporting WeaponDef "${definition.key}" references missing dependency "${dependency}".`,
          });
        }
      });
    });
    if (compiledLobbyModules.defs.overflow) {
      issues.push({
        unitId: 'project', unitName: 'Lobby package', key: 'tweakdefs_slots', level: 'error',
        message: `${compiledLobbyModules.defs.required} Definitions slots required; BAR provides 9.`,
      });
    }
    if (compiledLobbyModules.units.overflow) {
      issues.push({
        unitId: 'project', unitName: 'Lobby package', key: 'tweakunits_slots', level: 'error',
        message: `${compiledLobbyModules.units.required} Units slots required; BAR provides 9.`,
      });
    }
    return issues;
  }, [tweaks, clones, unitsDb.names, compiledLobbyModules, allUnitsList, defaultsDb, resolveCloneRootId, supportingWeaponDefs]);
  const scopedValidationIssues = useMemo(
    () => activeCollectionUnitIds
      ? validationIssues.filter(issue => activeCollectionUnitIds.has(issue.unitId))
      : validationIssues,
    [activeCollectionUnitIds, validationIssues]
  );

  const factoryIsModified = (factoryId) => {
    const step = buildMenuSteps.find(s => s.builderId === factoryId);
    return step && (step.add.length > 0 || step.remove.length > 0);
  };

  const handleAddUnitToFactory = (factoryId, unitId) => {
    setBuildMenuSteps(prev => {
      const next = [...prev];
      let idx = next.findIndex(s => s.builderId === factoryId);
      if (idx === -1) {
        next.push({ builderId: factoryId, add: [unitId], remove: [] });
      } else {
        const step = { ...next[idx] };
        step.remove = step.remove.filter(r => r.toLowerCase() !== unitId.toLowerCase());
        const defaults = activeFactoryRosters[factoryId] || [];
        const isDefault = defaults.map(d => d.toLowerCase()).includes(unitId.toLowerCase());
        if (!isDefault && !step.add.map(a => a.toLowerCase()).includes(unitId.toLowerCase())) {
          step.add = [...step.add, unitId];
        }
        if (step.order && step.order.length > 0) {
          if (!step.order.map(o => o.toLowerCase()).includes(unitId.toLowerCase())) {
            step.order = [...step.order, unitId];
          }
        }
        next[idx] = step;
      }
      return next.filter(s => s.add.length > 0 || s.remove.length > 0 || (s.order && s.order.length > 0));
    });
    if (clones.some(clone => clone.newId.toLowerCase() === unitId.toLowerCase())) {
      setClones(prev => prev.map(clone => (
        clone.newId.toLowerCase() === unitId.toLowerCase()
          ? { ...clone, builderIds: [...new Set([...(clone.builderIds || []), factoryId.toLowerCase()])] }
          : clone
      )));
    }
  };

  const handleRemoveUnitFromFactory = (factoryId, unitId) => {
    setBuildMenuSteps(prev => {
      const next = [...prev];
      let idx = next.findIndex(s => s.builderId === factoryId);
      if (idx === -1) {
        next.push({ builderId: factoryId, add: [], remove: [unitId] });
      } else {
        const step = { ...next[idx] };
        step.add = step.add.filter(a => a.toLowerCase() !== unitId.toLowerCase());
        const defaults = activeFactoryRosters[factoryId] || [];
        const isDefault = defaults.map(d => d.toLowerCase()).includes(unitId.toLowerCase());
        if (isDefault && !step.remove.map(r => r.toLowerCase()).includes(unitId.toLowerCase())) {
          step.remove = [...step.remove, unitId];
        }
        if (step.order && step.order.length > 0) {
          step.order = step.order.filter(o => o.toLowerCase() !== unitId.toLowerCase());
        }
        next[idx] = step;
      }
      return next.filter(s => s.add.length > 0 || s.remove.length > 0 || (s.order && s.order.length > 0));
    });
    if (clones.some(clone => clone.newId.toLowerCase() === unitId.toLowerCase())) {
      setClones(prev => prev.map(clone => (
        clone.newId.toLowerCase() === unitId.toLowerCase()
          ? { ...clone, builderIds: (clone.builderIds || []).filter(id => id.toLowerCase() !== factoryId.toLowerCase()) }
          : clone
      )));
    }
  };

  const handleRevertUnitInFactory = (factoryId, unitId) => {
    setBuildMenuSteps(prev => {
      const next = [...prev];
      let idx = next.findIndex(s => s.builderId === factoryId);
      if (idx !== -1) {
        const step = { ...next[idx] };
        step.remove = step.remove.filter(r => r.toLowerCase() !== unitId.toLowerCase());
        step.add = step.add.filter(a => a.toLowerCase() !== unitId.toLowerCase());
        if (step.order && step.order.length > 0) {
          const defaults = activeFactoryRosters[factoryId] || [];
          const isDefault = defaults.map(d => d.toLowerCase()).includes(unitId.toLowerCase());
          if (isDefault && !step.order.map(o => o.toLowerCase()).includes(unitId.toLowerCase())) {
            const defIdx = defaults.findIndex(d => d.toLowerCase() === unitId.toLowerCase());
            const newOrder = [...step.order];
            newOrder.splice(defIdx >= 0 ? defIdx : newOrder.length, 0, unitId);
            step.order = newOrder;
          }
        }
        next[idx] = step;
      }
      return next.filter(s => s.add.length > 0 || s.remove.length > 0 || (s.order && s.order.length > 0));
    });
  };

  const handleReorderFactoryRoster = (factoryId, reorderedIds) => {
    setBuildMenuSteps(prev => {
      const next = [...prev];
      let idx = next.findIndex(s => s.builderId === factoryId);
      if (idx === -1) {
        next.push({ builderId: factoryId, add: [], remove: [], order: reorderedIds });
      } else {
        const step = { ...next[idx] };
        step.order = reorderedIds;
        next[idx] = step;
      }
      return next;
    });
  };

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
        <p>{coreDataStatus === 'error' ? 'Reload the editor to try loading the bundled BAR data again.' : 'Loading unit statistics and weapon definitions…'}</p>
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
          onLoadProject={(event) => {
            handleImportConfig(event);
            setShowDesignerPanel(false);
            setShowPresetGallery(false);
            setActiveWorkspace('edit');
            setShowMainMenu(false);
          }}
          onSaveProject={handleExportConfig}
        />
        {showCreditsModal && <CreditsModal onClose={() => setShowCreditsModal(false)} />}
        {showCommandPalette && (
          <Suspense fallback={null}>
            <LazyCommandPalette commands={commandPaletteCommands} onClose={() => setShowCommandPalette(false)} />
          </Suspense>
        )}
        {showProjectCheckpoints && (
          <Suspense fallback={null}>
            <LazyProjectCheckpointsDialog
              currentDocument={normalizedProjectDocument}
              onRestore={hydrateProjectStore}
              onNotice={showToast}
              onClose={() => setShowProjectCheckpoints(false)}
            />
          </Suspense>
        )}
      </>
    );
  }

  return (
    <div className="app-container" style={{ '--border-accent': factionAccentColor }}>
      {/* Toast */}
      {toast.show && <div className="toast">{toast.message}</div>}

      {/* Header */}
      <header className="app-header">
        <div className="header-brand-group">
          <button type="button" className="brand-section header-brand" onClick={() => setShowMainMenu(true)} title="Return to main menu">
            <img src="/logo.svg" alt="BAR Editor" className="app-logo" />
            <div className="brand-text">
              <span className="brand-kicker">Mod workspace</span>
              <h1>BAR Editor</h1>
            </div>
          </button>
          <OnlinePresenceBadge
            count={onlineCount}
            status={presenceStatus}
            activityCounts={presenceActivityCounts}
            currentActivity={presenceActivity}
            compact
          />
        </div>

        <nav className="workflow-nav" aria-label="Editor workflow">
          <button
            className={activeWorkspace === 'edit' ? 'active' : ''}
            aria-current={activeWorkspace === 'edit' ? 'page' : undefined}
            onClick={() => setActiveWorkspace('edit')}
          >
            <span className="workflow-nav__step">01</span>
            <span className="workflow-nav__label">Edit Units</span>
          </button>
          <button
            className={activeWorkspace === 'collections' ? 'active' : ''}
            aria-current={activeWorkspace === 'collections' ? 'page' : undefined}
            onClick={() => { setShowDesignerPanel(false); setActiveWorkspace('collections'); }}
          >
            <span className="workflow-nav__step">02</span>
            <span className="workflow-nav__label">Collections</span>
          </button>
          <button
            className={activeWorkspace === 'designer' ? 'active' : ''}
            aria-current={activeWorkspace === 'designer' ? 'page' : undefined}
            onClick={() => { setShowDesignerPanel(true); setActiveWorkspace('designer'); }}
          >
            <span className="workflow-nav__step">03</span>
            <span className="workflow-nav__label">Build Menus</span>
          </button>
          <button
            className={activeWorkspace === 'review' ? 'active' : ''}
            aria-current={activeWorkspace === 'review' ? 'page' : undefined}
            onClick={() => setActiveWorkspace('review')}
          >
            <span className="workflow-nav__step">04</span>
            <span className="workflow-nav__label">Review &amp; Export</span>
          </button>
        </nav>

        <div className="header-actions header-utility-actions">
          <div className="header-control-cluster">
          <Button
            variant="quiet"
            className="btn-action btn-secondary header-menu-action"
            onClick={() => setShowMainMenu(true)}
            title="Return to main menu"
            aria-label="Return to main menu"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M6.5 3.25 1.75 8l4.75 4.75" />
              <path d="M2.25 8h8.25a3.25 3.25 0 0 1 3.25 3.25v1" />
            </svg>
            <span className="header-menu-label">Main menu</span>
          </Button>
          <Button
            variant="quiet"
            className="theme-toggle"
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
            aria-pressed={themeMode === 'dark'}
            onClick={() => setThemeMode(mode => mode === 'dark' ? 'light' : 'dark')}
          >
            <span className="theme-toggle-mark" aria-hidden="true">{themeMode === 'dark' ? '☼' : '◐'}</span>
            <span>{themeMode === 'dark' ? 'Light' : 'Dark'}</span>
          </Button>
          <ButtonGroup className="history-controls" label="Change history">
            <IconButton variant="quiet" size="sm" label="Undo" onClick={handleUndo} disabled={historyPast.length === 0} title="Undo (Ctrl+Z)">↶</IconButton>
            <IconButton variant="quiet" size="sm" label="Redo" onClick={handleRedo} disabled={historyFuture.length === 0} title="Redo (Ctrl+Y)">↷</IconButton>
          </ButtonGroup>
          <Button
            variant="quiet"
            className="btn-action btn-secondary header-credits-action"
            onClick={() => setShowCreditsModal(true)}
            title="Disclaimer, asset sources, and project credits"
          >
            <span className="header-credits-icon" aria-hidden="true">i</span>
            <span className="header-credits-label">Credits</span>
          </Button>
          <Button
            variant="quiet"
            className="btn-action btn-secondary header-chat-action"
            onClick={() => {
              setChatReadAt(Date.now());
              setShowChatModal(true);
            }}
            aria-haspopup="dialog"
            title="Open temporary editor chat"
          >
            <svg viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3.25h10a1.5 1.5 0 0 1 1.5 1.5v5.5a1.5 1.5 0 0 1-1.5 1.5H8l-3.25 2v-2H3a1.5 1.5 0 0 1-1.5-1.5v-5.5A1.5 1.5 0 0 1 3 3.25Z" />
              <path d="M4.5 6.5h7M4.5 8.75h4.75" />
            </svg>
            <span className="header-chat-label">Chat</span>
            {unreadChatCount > 0 && (
              <span className="header-chat-unread" aria-label={`${unreadChatCount} unread chat messages`}>
                {Math.min(unreadChatCount, 9)}{unreadChatCount > 9 ? '+' : ''}
              </span>
            )}
          </Button>
          </div>
          <Button
            className="btn-action btn-secondary header-create-action"
            aria-label="Create a clone of the selected unit"
            title="Create a clone of the selected unit"
            onClick={() => {
              if (selectedUnit) {
                setCloneBaseId(selectedUnit.id);
                setCloneName(`${selectedUnit.name} (Clone)`);

                setCloneAutoAssignBuilders(false);
                setCloneBuilders([]);

                setShowClonePanel(true);
              } else {
                showToast('Please select a unit to clone first');
              }
            }}
          >
            <svg className="header-create-icon" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2.25" y="2.25" width="8.5" height="8.5" rx="1.25" />
              <path d="M5.25 5.25h7.5a1 1 0 0 1 1 1v7.5" />
              <path d="M10 11.5h4" />
              <path d="M12 9.5v4" />
            </svg>
            <span className="header-create-label">Clone unit</span>
          </Button>

          <div className="header-tools" ref={toolsMenuRef}>
            <Button
              className="btn-action btn-secondary header-tools-trigger"
              aria-expanded={showToolsMenu}
              aria-controls="header-tools-menu"
              onClick={() => setShowToolsMenu(open => !open)}
            >
              Tools <span aria-hidden="true">⌄</span>
            </Button>
            {showToolsMenu && (
              <div className="header-tools-menu" id="header-tools-menu" role="menu" aria-label="Editor tools">
                <button type="button" role="menuitem" onClick={() => { setShowCommandPalette(true); setShowToolsMenu(false); }}>Command Palette <span aria-hidden="true">Ctrl K</span></button>
                <button type="button" role="menuitem" onClick={() => { setShowProjectCheckpoints(true); setShowToolsMenu(false); }}>Project Checkpoints</button>
                <button type="button" role="menuitem" onClick={() => { setActiveWorkspace('collections'); setShowToolsMenu(false); }}>Collections</button>
                <button type="button" role="menuitem" onClick={() => { setShowBulkPanel(true); setShowToolsMenu(false); }}>Batch Adjust</button>
                <button type="button" role="menuitem" onClick={() => { setShowPresetGallery(true); setActiveWorkspace('preset-gallery'); setShowToolsMenu(false); }}>Preset Gallery</button>
                <button type="button" role="menuitem" onClick={() => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('tweak-lab'); setShowToolsMenu(false); }}>Tweak Package Lab</button>
                <button type="button" role="menuitem" onClick={() => { setShowMainMenu(false); setShowDesignerPanel(false); setShowPresetGallery(false); setActiveWorkspace('reference-library'); setShowToolsMenu(false); }}>BAR Reference Library</button>
                {WEAPON_LAB_ENABLED && <button type="button" role="menuitem" onClick={() => { openWeaponLab(); setShowToolsMenu(false); }}>Weapon Lab</button>}
                <button type="button" role="menuitem" onClick={() => { setShowRandomPanel(true); setShowToolsMenu(false); }}>Mutation Lab</button>
                <div className="header-tools-menu-project-actions" role="group" aria-label="Project files">
                  <button type="button" onClick={() => { handleExportConfig(); setShowToolsMenu(false); }}>Save Project</button>
                  <label>
                    Load Project
                    <input type="file" accept=".json" onChange={(event) => { handleImportConfig(event); setShowToolsMenu(false); }} />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="header-project-actions">
            <Button
              className="btn-action btn-secondary header-file-action"
              onClick={handleExportConfig}
              title="Download your configuration profile locally"
            >
              Save Project
            </Button>
            <FileButton className="btn-action btn-secondary header-file-action" title="Upload an exported .json config" accept=".json" onChange={handleImportConfig}>
              Load Project
            </FileButton>
          </div>
        </div>
      </header>

      {showCreditsModal && <CreditsModal onClose={() => setShowCreditsModal(false)} />}
      {showChatModal && (
        <Suspense fallback={null}>
          <LazyTemporaryChatDialog chat={temporaryChat} onClose={closeTemporaryChat} />
        </Suspense>
      )}
      {showCommandPalette && (
        <Suspense fallback={null}>
          <LazyCommandPalette commands={commandPaletteCommands} onClose={() => setShowCommandPalette(false)} />
        </Suspense>
      )}
      {showProjectCheckpoints && (
        <Suspense fallback={null}>
          <LazyProjectCheckpointsDialog
            currentDocument={normalizedProjectDocument}
            onRestore={hydrateProjectStore}
            onNotice={showToast}
            onClose={() => setShowProjectCheckpoints(false)}
          />
        </Suspense>
      )}

      {/* Main Workspace */}
      {activeWorkspace === 'edit' ? (
      <EditorShell
        layout={workspaceLayout.layout}
        actions={{
          setLeftWidth: workspaceLayout.setLeftWidth,
          setRightWidth: workspaceLayout.setRightWidth,
          setLeftCollapsed: workspaceLayout.setLeftCollapsed,
          setRightCollapsed: workspaceLayout.setRightCollapsed,
          closeOverlayPanes: workspaceLayout.closeOverlayPanes,
        }}
      >

        {/* Sidebar Panel */}
        <UnitLibraryPane
          collapsed={workspaceLayout.layout.leftCollapsed}
          total={allUnitsList.length}
          filteredCount={filteredUnits.length}
          onToggle={workspaceLayout.setLeftCollapsed}
        >
          <CollectionScopePicker
            collections={unitCollections}
            activeCollectionId={activeCollectionId}
            totalUnits={allUnitsList.length}
            onSelect={setActiveCollectionId}
            onManage={() => setActiveWorkspace('collections')}
          />
          <div className="search-filter-section">

            {/* Search */}
            <div className="search-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder="Search unit name, ID, or stat..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <div className="stat-search-query-tip">
                Query format: <code>hp &gt; 3000</code> or <code>speed &lt; 50</code>
              </div>
            </div>

            {/* Faction selector (no emojis) */}
            <div className="sidebar-filter-label">Faction</div>
            <div className="faction-tabs">
              <button
                className={`faction-tab ${selectedFaction === 'all' ? 'active' : ''}`}
                onClick={() => setSelectedFaction('all')}
              >
                ALL
              </button>
              <button
                className={`faction-tab ${selectedFaction === 'arm' ? 'active' : ''}`}
                onClick={() => setSelectedFaction('arm')}
              >
                <img src="/factions/armada.png" alt="Armada" />
              </button>
              <button
                className={`faction-tab ${selectedFaction === 'cor' ? 'active' : ''}`}
                onClick={() => setSelectedFaction('cor')}
              >
                <img src="/factions/cortex.png" alt="Cortex" />
              </button>
              <button
                className={`faction-tab ${selectedFaction === 'leg' ? 'active' : ''}`}
                onClick={() => setSelectedFaction('leg')}
              >
                <img src="/factions/legion.png" alt="Legion" />
              </button>
              <button
                className={`faction-tab ${selectedFaction === 'rap' ? 'active' : ''}`}
                onClick={() => setSelectedFaction('rap')}
                title="Raptors"
              >
                Raptors
              </button>
              <button
                className={`faction-tab ${selectedFaction === 'scav' ? 'active' : ''}`}
                onClick={() => setSelectedFaction('scav')}
                title="Scavengers"
              >
                Scavs
              </button>
            </div>

            {/* Category tags */}
            <div className="sidebar-filter-label">Classification</div>
            <div className="category-chips" role="group" aria-label="Unit classification filters">
              {CATEGORIES.map(cat => (
                <button
                  type="button"
                  key={cat}
                  className={`category-chip ${selectedCats.includes(cat) ? 'active' : ''}`}
                  onClick={() => handleCatClick(cat)}
                  aria-pressed={selectedCats.includes(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="filter-actions">
              <button
                className={`filter-action-btn ${showModifiedOnly ? 'active' : ''}`}
                onClick={() => setShowModifiedOnly(prev => !prev)}
                title="Show changed, disabled, and cloned units"
              >
                Modified only
              </button>
              <button
                className="filter-action-btn"
                onClick={clearUnitFilters}
                disabled={!hasActiveUnitFilters}
              >
                Clear filters
              </button>
            </div>

            <div className="results-summary" aria-live="polite">
              <span>{filteredUnits.length.toLocaleString()} units</span>
              {activeCollection ? <span>{activeCollection.name}</span> : hasActiveUnitFilters && <span>Filtered</span>}
            </div>

          </div>

          {/* Scrollable list of units with icons */}
          <div className="unit-list-region">
          <div
            ref={unitListContainerRef}
            className="unit-list-container"
            onScroll={event => setUnitListScrollTop(event.currentTarget.scrollTop)}
          >
              {filteredUnits.length === 0 ? (
                <div className="unit-list-empty">
                  <strong>No matching units</strong>
                  <span>Try removing a category or clearing the current filters.</span>
                  <button className="filter-action-btn active" onClick={clearUnitFilters}>Clear all filters</button>
                </div>
              ) : (
              <div className="unit-list-virtual" style={{ height: `${filteredUnits.length * unitRowHeight}px` }}>
              <div className="unit-list" style={{ transform: `translateY(${virtualUnitRange.start * unitRowHeight}px)` }}>
              {virtualUnitRange.units.map(unit => {
                const isModified = tweaks[unit.id] && Object.keys(tweaks[unit.id]).length > 0;
                const isDisabled = disabledUnitIds.includes(unit.id);
                return (
                  <button
                    type="button"
                    key={unit.id}
                    className={`unit-item ${selectedUnitId === unit.id ? 'active' : ''}`}
                    onClick={() => setSelectedUnitId(unit.id)}
                    aria-pressed={selectedUnitId === unit.id}
                    style={{ height: `${unitRowHeight}px` }}
                  >
                    <div className="unit-item-icon">
                      <UnitArtwork src={getProjectUnitIconUrl(unit.id)} alt="" />
                    </div>
                    <div className="unit-item-info">
                      <div className="unit-item-header">
                        <span className="unit-item-name">
                          {unit.name}
                        </span>
                        {isModified && (
                          <span className="unit-status unit-status--modified">MOD</span>
                        )}
                        {isDisabled && (
                          <span className="unit-status unit-status--disabled">DIS</span>
                        )}
                      </div>
                      <span className="unit-item-id">
                        {unit.id}
                      </span>
                    </div>
                    <span className="unit-tier">
                      {unit.techTier.toUpperCase()}
                    </span>
                  </button>
                );
              })}
              </div>
            </div>
              )}
          </div>
          {unitScrollHint.hasMore && (
            <div className="unit-scroll-hint" aria-hidden="true">
              <svg viewBox="0 0 16 16"><path d="M8 3.25v8.5" /><path d="m4.75 8.5 3.25 3.25 3.25-3.25" /></svg>
              <span>Scroll to browse</span>
              <strong>{unitScrollHint.remaining.toLocaleString()} more</strong>
            </div>
          )}
          </div>
        </UnitLibraryPane>

        {/* Center: selected unit stat parameters editor */}
        <main className="editor-workspace">
          {selectedUnit ? (() => {
            const baseId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
            const originalDefaults = defaultsDb[baseId] || {};
            const defaults = selectedUnitDefaults || originalDefaults;
            const slots = defaults.weaponSlots || [];
            const activeTechTier = selectedUnit.techTier || getEffectiveTechTier(selectedUnit.id, baseId);

            const activeSlotIdx = slots.some(s => s.slot === activeWeaponSlotTab) ? activeWeaponSlotTab : (slots[0]?.slot || 1);
            const slot = slots.find(s => s.slot === activeSlotIdx) || slots[0];
            const cloneInfo = selectedUnit.isClone ? clones.find(c => c.newId.toLowerCase() === selectedUnit.id.toLowerCase()) : null;
            const swap = cloneInfo ? getInheritedCloneWeaponSwaps(selectedUnit.id)?.[String(slot?.slot)] : null;
            const originalSlot = originalDefaults.weaponSlots?.find(item => item.slot === slot?.slot);

            let calculatedDps = '0.0';
            let rawRange = 0;
            let rawSpray = 0;
            if (slot) {
              const rawDamage = parseFloat(tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_damage`] ?? slot.damage ?? 0);
              const rawReload = parseFloat(tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_reload`] ?? slot.reload ?? 1);
              const rawProj = parseInt(tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_projectiles`] ?? slot.projectiles ?? 1, 10);
              const rawBurst = parseInt(tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_burst`] ?? slot.burst ?? 1, 10);
              rawRange = parseFloat(tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_range`] ?? slot.range ?? 0);
              rawSpray = parseFloat(tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_sprayangle`] ?? slot.sprayangle ?? 0);
              calculatedDps = rawReload > 0 ? (((rawDamage * rawProj * rawBurst) / rawReload).toFixed(1)) : '0.0';
            }

            const featuredWeaponParameters = new Set(['damage', 'reload', 'range', 'velocity', 'aoe']);
            const weaponParameterGroups = {
              damage: 'Damage & cadence', damage_vs_light: 'Damage & cadence', damage_vs_medium: 'Damage & cadence',
              damage_vs_heavy: 'Damage & cadence', damage_vs_commander: 'Damage & cadence', reload: 'Damage & cadence',
              projectiles: 'Damage & cadence', burst: 'Damage & cadence', burstrate: 'Damage & cadence',
              range: 'Range & accuracy', velocity: 'Range & accuracy', flighttime: 'Range & accuracy', aoe: 'Range & accuracy',
              accuracy: 'Range & accuracy', sprayangle: 'Range & accuracy', heightmod: 'Range & accuracy', hightrajectory: 'Range & accuracy',
              canattackground: 'Targeting & safety', toairweapon: 'Targeting & safety', avoidfriendly: 'Targeting & safety', collidefriendly: 'Targeting & safety', interceptedbyshieldtype: 'Targeting & safety',
              stockpile: 'Ammunition', stockpiletime: 'Ammunition', stockpilelimit: 'Ammunition',
              weapontype: 'Presentation', cegTag: 'Presentation', model: 'Presentation', explosiongenerator: 'Presentation',
            };
            const weaponParameterUnits = {
              damage: 'damage', reload: 'seconds', range: 'elmos', velocity: 'elmos/s', flighttime: 'seconds',
              aoe: 'elmos', accuracy: 'angle', sprayangle: 'angle', burstrate: 'seconds', stockpiletime: 'seconds',
            };
            const slotParams = [
              { key: 'damage', label: 'Damage', sub: 'damage.default', type: 'number' },
              { key: 'damage_vs_commander', label: 'Damage vs Commanders', sub: 'damage.commanders', type: 'number' },
              { key: 'damage_vs_vtol', label: 'Damage vs VTOL', sub: 'damage.vtol', type: 'number' },
              { key: 'damage_vs_subs', label: 'Damage vs Submarines', sub: 'damage.subs', type: 'number' },
              { key: 'damage_vs_shields', label: 'Damage vs Shields', sub: 'damage.shields', type: 'number' },
              { key: 'damage_vs_scavboss', label: 'Damage vs Scav Bosses', sub: 'damage.scavboss', type: 'number' },
              { key: 'damage_vs_raptorqueen', label: 'Damage vs Raptor Queen', sub: 'damage.raptorqueen', type: 'number' },
              { key: 'damage_vs_raptor', label: 'Damage vs Raptors', sub: 'damage.raptor', type: 'number' },
              { key: 'damage_vs_mines', label: 'Damage vs Mines', sub: 'damage.mines', type: 'number' },
              { key: 'reload', label: 'Reload (s)', sub: 'reloadtime', type: 'number' },
              { key: 'range', label: 'Range', sub: 'range', type: 'number' },
              { key: 'velocity', label: 'Velocity', sub: 'weaponvelocity', type: 'number' },
              { key: 'flighttime', label: 'Lifetime', sub: 'flighttime', type: 'number' },
              { key: 'aoe', label: 'Splash AoE', sub: 'areaofeffect', type: 'number' },
              { key: 'accuracy', label: 'Inaccuracy', sub: 'accuracy', type: 'number' },
              { key: 'sprayangle', label: 'Spray Angle', sub: 'sprayangle', type: 'number' },
              { key: 'heightmod', label: 'Height Modifier', sub: 'heightmod', type: 'number' },
              { key: 'hightrajectory', label: 'High Trajectory', sub: 'hightrajectory', type: 'text', options: ['0', '1', '2'] },
              { key: 'projectiles', label: 'Projectiles', sub: 'projectiles', type: 'number' },
              { key: 'burst', label: 'Burst Count', sub: 'burst', type: 'number' },
              { key: 'burstrate', label: 'Burst Rate', sub: 'burstrate', type: 'number' },
              { key: 'canattackground', label: 'Can Target Ground', sub: 'canattackground', type: 'boolean' },
              { key: 'stockpile', label: 'Stockpile Required', sub: 'stockpile', type: 'boolean' },
              { key: 'avoidfriendly', label: 'Avoid Friendly', sub: 'avoidfriendly', type: 'boolean' },
              { key: 'collidefriendly', label: 'Collide Friendly', sub: 'collidefriendly', type: 'boolean' },
              { key: 'interceptedbyshieldtype', label: 'Shield Intercept Mask', sub: 'interceptedbyshieldtype', type: 'number' },
              { key: 'stockpiletime', label: 'Stockpile Time (s)', sub: 'stockpiletime', type: 'number' },
              { key: 'stockpilelimit', label: 'Stockpile Limit', sub: 'customparams.stockpilelimit', type: 'number' },
              { key: 'weapontype', label: 'Projectile Class', sub: 'weapontype', type: 'text', options: ['LaserCannon', 'Cannon', 'MissileLauncher', 'EmgCannon', 'AircraftBomb', 'Flame', 'BeamLaser'] },
              { key: 'cegTag', label: 'Visual Effect / Trail', sub: 'cegTag', type: 'text', assetType: 'ceg' },
              { key: 'model', label: '3D Projectile Model', sub: 'model', type: 'text', assetType: 'projectileModel' },
              { key: 'explosiongenerator', label: 'Explosion Generator', sub: 'explosiongenerator', type: 'text', assetType: 'ceg' }
            ].map((parameter, order) => ({
              ...parameter,
              featured: featuredWeaponParameters.has(parameter.key),
              group: weaponParameterGroups[parameter.key] || 'Additional',
              order,
              unit: weaponParameterUnits[parameter.key] || '',
            }));

            const advancedWeaponGroups = [
              {
                title: 'Advanced behavior',
                description: 'BAR gadget-backed unit spawning and cluster/MIRV behavior. Referenced IDs must exist when the game loads.',
                params: [
                  { key: 'spawns_name', label: 'Spawned Unit ID', type: 'string' },
                  { key: 'spawns_surface', label: 'Spawn Surface', type: 'string' },
                  { key: 'spawn_metal_cost', label: 'Spawn Metal per Shot', type: 'number' },
                  { key: 'spawn_energy_cost', label: 'Spawn Energy per Shot', type: 'number' },
                  { key: 'cluster_def', label: 'Cluster Weapon Def', type: 'string' },
                  { key: 'cluster_number', label: 'Cluster Projectile Count', type: 'number' },
                ]
              },
              {
                title: 'Impact & resource behavior',
                description: 'Damage falloff, projectile persistence, impulse, and per-shot costs.',
                params: [
                  { key: 'edgeeffectiveness', label: 'AoE Edge Damage', type: 'number' },
                  { key: 'explosionspeed', label: 'Explosion Propagation', type: 'number' },
                  { key: 'camerashake', label: 'Camera Shake', type: 'number' },
                  { key: 'impactonly', label: 'Direct Hit Only', type: 'tri-state' },
                  { key: 'noexplode', label: 'Continue Through Impact', type: 'tri-state', danger: true },
                  { key: 'burnblow', label: 'Explode at Max Range', type: 'tri-state' },
                  { key: 'noselfdamage', label: 'No Self Damage', type: 'tri-state' },
                  { key: 'impulsefactor', label: 'Impulse Multiplier', type: 'number' },
                  { key: 'impulseboost', label: 'Impulse Boost', type: 'number' },
                  { key: 'cratermult', label: 'Crater Strength', type: 'number' },
                  { key: 'craterboost', label: 'Crater Boost', type: 'number' },
                  { key: 'crateraoe', label: 'Crater Diameter', type: 'number' },
                  { key: 'scarttl', label: 'Scar Lifetime', type: 'number' },
                  { key: 'firestarter', label: 'Fire-Start Chance', type: 'number' },
                  { key: 'energypershot', label: 'Energy per Shot', type: 'number' },
                  { key: 'metalpershot', label: 'Metal per Shot', type: 'number' },
                  { key: 'paralyzer', label: 'Paralyzer', type: 'tri-state' },
                  { key: 'paralyzetime', label: 'Paralyze Time', type: 'number' },
                  { key: 'mygravity', label: 'Custom Gravity', type: 'number' },
                  { key: 'heightboostfactor', label: 'Terrain Range Boost', type: 'number' }
                ]
              },
              {
                title: 'Guidance & trajectory',
                description: 'Missile acceleration, tracking, arc, and flight motion.',
                params: [
                  { key: 'startvelocity', label: 'Start Velocity', type: 'number' },
                  { key: 'weaponacceleration', label: 'Weapon Acceleration', type: 'number' },
                  { key: 'tracks', label: 'Tracks Target', type: 'tri-state' },
                  { key: 'turnrate', label: 'Guidance Turn Rate', type: 'number' },
                  { key: 'trajectoryheight', label: 'Missile Arc Height', type: 'number' },
                  { key: 'wobble', label: 'Wobble', type: 'number' },
                  { key: 'dance', label: 'Dance', type: 'number' },
                  { key: 'fixedlauncher', label: 'Fixed Launcher', type: 'tri-state' },
                  { key: 'weaponTimer', label: 'Vertical Ascent Time', type: 'number' },
                  { key: 'windup', label: 'Salvo Windup', type: 'number' },
                  { key: 'gravityaffected', label: 'Gravity Affected', type: 'tri-state' },
                  { key: 'smoketrail', label: 'Smoke Trail', type: 'tri-state' },
                  { key: 'waterweapon', label: 'Water Weapon', type: 'tri-state' },
                  { key: 'firesubmersed', label: 'Fire Submerged', type: 'tri-state' },
                  { key: 'submissile', label: 'Torpedo Can Exit Water', type: 'tri-state' }
                ]
              },
              {
                title: 'Aim, collision & bounce',
                description: 'Practical hit chance, collision rules, and ricochet behavior.',
                params: [
                  { key: 'movingaccuracy', label: 'Moving Inaccuracy', type: 'number' },
                  { key: 'targetmoveerror', label: 'Target Move Error', type: 'number' },
                  { key: 'predictboost', label: 'Prediction Boost', type: 'number' },
                  { key: 'leadlimit', label: 'Lead Limit', type: 'number' },
                  { key: 'leadbonus', label: 'Experience Lead Bonus', type: 'number' },
                  { key: 'targetborder', label: 'Target Border', type: 'number' },
                  { key: 'cylindertargeting', label: 'Cylinder Targeting', type: 'number' },
                  { key: 'tolerance', label: 'Aim Tolerance', type: 'number' },
                  { key: 'firetolerance', label: 'Fire Tolerance', type: 'number' },
                  { key: 'proximitypriority', label: 'Proximity Priority', type: 'number' },
                  { key: 'avoidfeature', label: 'Avoid Features', type: 'tri-state' },
                  { key: 'avoidground', label: 'Avoid Ground', type: 'tri-state' },
                  { key: 'avoidneutral', label: 'Avoid Neutral Units', type: 'tri-state' },
                  { key: 'collidefeature', label: 'Collide Features', type: 'tri-state' },
                  { key: 'collideenemy', label: 'Collide Enemy Units', type: 'tri-state' },
                  { key: 'collidenontarget', label: 'Collide Non-Targets', type: 'tri-state' },
                  { key: 'collidecloaked', label: 'Collide Cloaked Units', type: 'tri-state' },
                  { key: 'collideneutral', label: 'Collide Neutral Units', type: 'tri-state' },
                  { key: 'collideground', label: 'Collide Ground', type: 'tri-state' },
                  { key: 'collisionSize', label: 'Collision Size', type: 'number' },
                  { key: 'groundbounce', label: 'Ground Bounce', type: 'tri-state' },
                  { key: 'waterbounce', label: 'Water Bounce', type: 'tri-state' },
                  { key: 'numbounce', label: 'Bounce Count', type: 'number' },
                  { key: 'bounceslip', label: 'Bounce Slip', type: 'number' },
                  { key: 'bouncerebound', label: 'Bounce Rebound', type: 'number' }
                ]
              },
              {
                title: 'Beam, visuals & audio',
                description: 'Weapon-type-specific beam behavior and presentation overrides.',
                params: [
                  { key: 'beamtime', label: 'Beam Time', type: 'number' },
                  { key: 'beamttl', label: 'Beam Linger Frames', type: 'number' },
                  { key: 'beamdecay', label: 'Beam Decay', type: 'number' },
                  { key: 'beamburst', label: 'Beam Burst', type: 'tri-state' },
                  { key: 'largebeamlaser', label: 'Large Beam Texturing', type: 'tri-state' },
                  { key: 'sweepfire', label: 'Sweep Fire', type: 'tri-state' },
                  { key: 'minintensity', label: 'Minimum Damage Intensity', type: 'number' },
                  { key: 'duration', label: 'Laser Duration', type: 'number' },
                  { key: 'hardstop', label: 'Laser Hard Stop', type: 'tri-state' },
                  { key: 'falloffrate', label: 'Laser Falloff Rate', type: 'number' },
                  { key: 'thickness', label: 'Beam Thickness', type: 'number' },
                  { key: 'corethickness', label: 'Core Thickness', type: 'number' },
                  { key: 'laserflaresize', label: 'Laser Flare Size', type: 'number' },
                  { key: 'intensity', label: 'Visual Intensity', type: 'number' },
                  { key: 'rgbcolor', label: 'Primary RGB Color', type: 'string' },
                  { key: 'rgbcolor2', label: 'Core RGB Color', type: 'string' },
                  { key: 'explosionscar', label: 'Explosion Scar', type: 'tri-state' },
                  { key: 'alwaysvisible', label: 'Always Visible', type: 'tri-state' },
                  { key: 'soundstart', label: 'Fire Sound', type: 'string' },
                  { key: 'soundhit', label: 'Hit Sound', type: 'string' },
                  { key: 'soundhitwet', label: 'Water Hit Sound', type: 'string' },
                  { key: 'soundhitdry', label: 'Dry Hit Sound', type: 'string' },
                  { key: 'soundstartvolume', label: 'Fire Sound Volume', type: 'number' },
                  { key: 'soundhitvolume', label: 'Hit Sound Volume', type: 'number' },
                  { key: 'soundhitwetvolume', label: 'Water Hit Volume', type: 'number' },
                  { key: 'soundhitdryvolume', label: 'Dry Hit Volume', type: 'number' },
                  { key: 'texture1', label: 'Primary Texture', type: 'string' },
                  { key: 'texture2', label: 'Secondary Texture', type: 'string' },
                  { key: 'texture3', label: 'Tertiary Texture', type: 'string' },
                  { key: 'colormap', label: 'Projectile Color Map', type: 'string' },
                  { key: 'smokecolor', label: 'Smoke Color', type: 'number' },
                  { key: 'smokeperiod', label: 'Smoke Period', type: 'number' },
                  { key: 'smokesize', label: 'Smoke Size', type: 'number' },
                  { key: 'smoketime', label: 'Smoke Lifetime', type: 'number' },
                  { key: 'castshadow', label: 'Projectile Shadow', type: 'tri-state' },
                  { key: 'smoketrailcastshadow', label: 'Smoke Trail Shadow', type: 'tri-state' },
                  { key: 'size', label: 'Projectile Size', type: 'number' },
                  { key: 'sizedecay', label: 'Size Decay', type: 'number' },
                  { key: 'sizegrowth', label: 'Size Growth', type: 'number' },
                  { key: 'alphadecay', label: 'Alpha Decay', type: 'number' },
                  { key: 'stages', label: 'Visual Stages', type: 'number' },
                  { key: 'tilelength', label: 'Beam Tile Length', type: 'number' },
                  { key: 'scrollspeed', label: 'Texture Scroll Speed', type: 'number' }
                ]
              },
              {
                title: 'Weapon mount behavior',
                description: 'Per-slot firing arc, slaving, retargeting, and leading behavior.',
                params: [
                  { key: 'turret', label: 'Turreted Weapon', type: 'tri-state' },
                  { key: 'slaveto', label: 'Slave to Weapon Slot', type: 'number' },
                  { key: 'maindir', label: 'Primary Aim Direction', type: 'string' },
                  { key: 'maxangledif', label: 'Firing Arc Width', type: 'number' },
                  { key: 'weaponaimadjustpriority', label: 'Aim Adjustment Priority', type: 'number' },
                  { key: 'fastautoretargeting', label: 'Fast Auto Retargeting', type: 'tri-state' },
                  { key: 'fastquerypointupdate', label: 'Fast Query-Piece Update', type: 'tri-state' },
                  { key: 'burstcontrolwhenoutofarc', label: 'Out-of-Arc Burst Control', type: 'number' },
                  { key: 'accurateleading', label: 'Accurate Leading Iterations', type: 'number' }
                ]
              },
              {
                title: 'Dynamic damage',
                description: 'Optional range-dependent weapon damage curve.',
                params: [
                  { key: 'dyndamageinverted', label: 'Invert Damage Curve', type: 'tri-state' },
                  { key: 'dyndamageexp', label: 'Damage Curve Exponent', type: 'number' },
                  { key: 'dyndamagemin', label: 'Minimum Dynamic Damage', type: 'number' },
                  { key: 'dyndamagerange', label: 'Dynamic Damage Range', type: 'number' }
                ]
              },
              {
                title: 'Shield profile',
                description: 'Shield capacity, regeneration, interception, and repulsor behavior.',
                params: [
                  { key: 'shieldrepulser', label: 'Repulsor Shield', type: 'tri-state' },
                  { key: 'shieldsmart', label: 'Smart Allied Pass-Through', type: 'tri-state' },
                  { key: 'shieldexterior', label: 'Exterior Shield', type: 'tri-state' },
                  { key: 'shieldvisible', label: 'Shield Visible', type: 'tri-state' },
                  { key: 'shieldmaxspeed', label: 'Maximum Repulse Speed', type: 'number' },
                  { key: 'shieldforce', label: 'Repulse Force', type: 'number' },
                  { key: 'shieldradius', label: 'Shield Radius', type: 'number' },
                  { key: 'shieldpower', label: 'Shield Capacity', type: 'number' },
                  { key: 'shieldstartingpower', label: 'Starting Capacity', type: 'number' },
                  { key: 'shieldpowerregen', label: 'Regeneration per Second', type: 'number' },
                  { key: 'shieldpowerregenenergy', label: 'Regen Energy per HP', type: 'number' },
                  { key: 'shieldenergyuse', label: 'Interception Energy Use', type: 'number' },
                  { key: 'shieldrechargedelay', label: 'Recharge Delay', type: 'number' },
                  { key: 'shieldintercepttype', label: 'Shield Intercept Mask', type: 'number' }
                ]
              }
            ];

            const activeSlotTweaks = tweaks[selectedUnit.id] || {};
            const hasWeaponParameter = key => slot && (
              Object.prototype.hasOwnProperty.call(slot, key)
              || Object.prototype.hasOwnProperty.call(activeSlotTweaks, `weapon_slot_${slot.slot}_${key}`)
            );
            const essentialWeaponParams = new Set([
              'damage', 'reload', 'range', 'velocity', 'aoe', 'projectiles', 'burst', 'burstrate',
              'canattackground', 'toairweapon'
            ]);
            const applicableSlotParams = showAllWeaponParams
              ? slotParams
              : slotParams.filter(param => essentialWeaponParams.has(param.key) || hasWeaponParameter(param.key));
            const applicableAdvancedWeaponGroups = advancedWeaponGroups
              .map(group => ({
                ...group,
                params: showAllWeaponParams ? group.params : group.params.filter(param => hasWeaponParameter(param.key))
              }))
              .filter(group => group.params.length > 0);
            const detectedWeaponParameterCount = slot
              ? slotParams.filter(param => hasWeaponParameter(param.key)).length
                + advancedWeaponGroups.reduce((total, group) => total + group.params.filter(param => hasWeaponParameter(param.key)).length, 0)
                + 2
              : 0;
            const weaponSignature = `${slot?.weapontype || ''} ${slot?.defKey || ''}`.toLowerCase();
            const weaponProfile = !slot
              ? 'No weapon selected'
              : slot.paralyzer || weaponSignature.includes('emp') || weaponSignature.includes('paraly')
                ? 'EMP / paralyzer'
                : hasWeaponParameter('beamtime') || hasWeaponParameter('thickness') || /beam|laser|lightning/.test(weaponSignature)
                  ? 'Beam / energy'
                  : hasWeaponParameter('tracks') || hasWeaponParameter('weaponacceleration') || /missile|rocket|torpedo|starburst/.test(weaponSignature)
                    ? 'Guided projectile'
                    : hasWeaponParameter('groundbounce') || hasWeaponParameter('waterbounce')
                      ? 'Bouncing projectile'
                      : 'Ballistic / direct fire';

            const unitParameterTweaks = tweaks[selectedUnit.id] || {};
            const allStructureParams = STAT_KEYS.filter(stat => !MOBILITY_STAT_KEYS.has(stat.key));
            const allMobilityParams = STAT_KEYS.filter(stat => {
              if (!MOBILITY_STAT_KEYS.has(stat.key)) return false;
              return stat.key !== 'cruisealt' || getTagsOfUnit(baseId).includes('aircraft');
            });
            const relevanceOptions = { showAll: showAllUnitParams, activeKey: activeRelationshipKey };
            const structureParams = getApplicableUnitParameters(
              allStructureParams,
              defaults,
              unitParameterTweaks,
              relevanceOptions
            );
            const mobilityParams = getApplicableUnitParameters(
              allMobilityParams,
              defaults,
              unitParameterTweaks,
              relevanceOptions
            );
            const weaponParameterCount = slot
              ? applicableSlotParams.length + applicableAdvancedWeaponGroups.reduce((total, group) => total + group.params.length, 0) + 2
              : 0;
            const workspaceTabs = WORKSPACE_TAB_DEFINITIONS.map(tab => ({
              ...tab,
              count: tab.id === 'structure'
                ? structureParams.length
                : tab.id === 'mobility'
                  ? mobilityParams.length
                  : weaponParameterCount
            }));
            const unitOverrideCount = Object.keys(tweaks[selectedUnit.id] || {}).length;
            const unitIsDisabled = disabledUnitIds.includes(selectedUnit.id);
            const activeRelationship = getParameterRelationship(activeParamTab, activeRelationshipKey);
            const relationshipKeys = new Set(activeRelationship?.keys || []);
            const getRelationshipStateClass = key => activeRelationshipKey === key
              ? 'relationship-focus'
              : relationshipKeys.has(key)
                ? 'relationship-related'
                : '';
            return (
              <div className="editor-content">

                {/* Unit info header */}
                <UnitCommandBar
                  baseId={baseId}
                  artworkUrl={getProjectUnitIconUrl(selectedUnit.id)}
                  unitId={selectedUnit.id}
                  name={selectedUnit.name}
                  faction={getFactionOfUnit(baseId)}
                  tier={activeTechTier}
                  unitClass={selectedUnit.tags?.[0] || 'Unit'}
                  weaponCount={slots.length}
                  overrideCount={unitOverrideCount}
                  isClone={selectedUnit.isClone}
                  disabled={unitIsDisabled}
                  onDisabledChange={nextDisabled => {
                    if (nextDisabled) setDisabledUnitIds(previous => [...new Set([...previous, selectedUnit.id])]);
                    else setDisabledUnitIds(previous => previous.filter(id => id !== selectedUnit.id));
                  }}
                  onReset={() => handleResetUnit(selectedUnit.id)}
                  onOpenIdentity={() => {
                    workspaceLayout.setInspectorTab('identity');
                    workspaceLayout.setRightCollapsed(false);
                  }}
                />

                {/* Tab Selector Navigation for Parameters */}
                <div className="workspace-tabs editor-section-tabs" role="tablist" aria-label="Editor parameter sections">
                  {workspaceTabs.map(tab => (
                    <button
                      key={tab.id}
                      id={`workspace-tab-${tab.id}`}
                      type="button"
                      role="tab"
                      aria-selected={activeParamTab === tab.id}
                      aria-controls={tab.panelId}
                      onClick={() => setActiveParamTab(tab.id)}
                      onKeyDown={event => {
                        const tabs = [...event.currentTarget.closest('[role="tablist"]').querySelectorAll('[role="tab"]')];
                        const currentIndex = tabs.indexOf(event.currentTarget);
                        let nextIndex = currentIndex;
                        if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                        else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                        else if (event.key === 'Home') nextIndex = 0;
                        else if (event.key === 'End') nextIndex = tabs.length - 1;
                        else return;
                        event.preventDefault();
                        tabs[nextIndex].focus();
                        tabs[nextIndex].click();
                      }}
                      className={`workspace-tab-btn ${activeParamTab === tab.id ? 'active' : ''}`}
                    >
                      <span className="workspace-tab-heading">
                        <span className="workspace-tab-label">{tab.label}</span>
                        <span className="workspace-tab-count" aria-label={`${tab.count} parameters`}>{tab.count}</span>
                      </span>
                      <small>{tab.description}</small>
                    </button>
                  ))}
                </div>

                {/* Operational overview: analysis and weapon context without duplicating unit identity. */}
                <section
                  className="unit-context-strip unit-context-strip--canonical operational-overview"
                  aria-labelledby="operational-overview-title"
                >
                  <header className="operational-overview__header">
                    <span className="operational-overview__eyebrow">Live analysis</span>
                    <h2 id="operational-overview-title">Operational overview</h2>
                    <small>Performance and hardpoint telemetry</small>
                  </header>

                  <div className="operational-overview__modules">

                  {/* Efficiency Analysis Card */}
                  <div className="unit-context-card unit-efficiency-card">
                    <span className="unit-context-label">
                      Efficiency Analysis
                    </span>
                    {(() => {
                      const baseId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
                      const uDefaults = defaultsDb[baseId] || {};
                      const metalCost = parseFloat(tweaks[selectedUnit.id]?.metalcost ?? uDefaults.metalcost ?? 1);
                      const health = parseFloat(tweaks[selectedUnit.id]?.health ?? uDefaults.health ?? 1);
                      const buildTime = parseFloat(tweaks[selectedUnit.id]?.buildtime ?? uDefaults.buildtime ?? 1);
                      const costPerHp = health > 0 ? (metalCost / health).toFixed(3) : '—';
                      const dpsVal = parseFloat(calculatedDps) || 0;
                      const dpsPerMetal = metalCost > 0 ? ((dpsVal / metalCost) * 100).toFixed(2) : '—';
                      const buildEfficiency = buildTime > 0 ? (health / buildTime).toFixed(2) : '—';
                      const effRows = [
                        { label: 'Cost / HP', value: costPerHp, unit: 'm', tone: 'wisteria' },
                        { label: 'DPS / 100m', value: dpsPerMetal, unit: '', tone: 'sakura' },
                        { label: 'HP / Build-s', value: buildEfficiency, unit: '', tone: 'earth' }
                      ];
                      return (
                        <div className="unit-efficiency-metrics">
                          {effRows.map(r => (
                            <div className={`unit-efficiency-metric tone-${r.tone}`} key={r.label}>
                              <span>{r.label}</span>
                              <span>
                                {r.value}<small> {r.unit}</small>
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Weapon Slot Nodes Selector List */}
                  {slots.length > 0 && (
                    <div className="unit-context-card unit-weapon-card">
                      <span className="unit-context-label">
                        Chassis Weapon Slots ({slots.length})
                      </span>
                      <div className="unit-slot-list">
                        {slots.map(s => {
                          const isCurrent = s.slot === activeSlotIdx;
                          const isSwapped = cloneInfo?.weaponSwaps?.[String(s.slot)];
                          return (
                            <button
                              type="button"
                              key={s.slot}
                              onClick={() => setActiveWeaponSlotTab(s.slot)}
                              className={`unit-slot-node ${isCurrent ? 'active' : ''} ${isSwapped ? 'swapped' : ''}`}
                              aria-pressed={isCurrent}
                            >
                              <span className="unit-slot-index">{s.slot}</span>
                              <span className="unit-slot-name">
                                {s.defKey.toUpperCase()}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Current weapon firing profile */}
                  {slot && (
                    <div className="unit-context-card unit-trajectory-card">
                      <span className="unit-context-label">Firing Profile</span>
                      <div className="unit-trajectory-copy">
                        <div className="unit-trajectory-values">
                          <div>
                            <span>DPS</span>
                            <span className="tone-wisteria">
                              {calculatedDps} <small>/s</small>
                            </span>
                          </div>
                          <div>
                            <span>Range</span>
                            <span className="tone-sakura">
                              {rawRange} <small>el</small>
                            </span>
                          </div>
                          <div>
                            <span>Spread</span>
                            <span>{rawSpray > 0 ? `${rawSpray}°` : 'Direct'}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  </div>
                </section>

                <ParameterCanvas comparisonMode={comparisonMode}>

                  {/* Structure View */}
                  {activeParamTab === 'structure' && (
                    <div id="workspace-panel-structure" className="workspace-parameter-panel" role="tabpanel" aria-labelledby="workspace-tab-structure" tabIndex={0}>
                      <SectionHeader
                        className="section-heading"
                        eyebrow="Unit parameters"
                        title="Structure & Economic Metrics"
                        description="Costs, durability, production, storage, and utility systems."
                        actions={(
                          <UnitParameterViewControl
                            showAll={showAllUnitParams}
                            visibleCount={structureParams.length}
                            totalCount={allStructureParams.length}
                            onChange={setShowAllUnitParams}
                          />
                        )}
                      />
                      <ParameterMatrix
                        sectionId="structure"
                        parameters={structureParams}
                        collapsedGroups={workspaceLayout.layout.collapsedGroups}
                        onToggleGroup={workspaceLayout.toggleGroup}
                        renderParameter={stat => {
                          const baseId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
                          const defaults = defaultsDb[baseId] || {};
                          const defaultResolution = resolveUnitParameterDefault(stat, defaults);
                          let defaultVal = defaultResolution.value;

                          if (stat.weaponSubPath && defaultVal === undefined && defaults.weaponSlots) {
                            const wDef = defaults.weapon1def;
                            if (wDef) {
                              const slot = defaults.weaponSlots[0];
                              if (slot) {
                                if (stat.key.endsWith('Reload')) defaultVal = slot.reload;
                                if (stat.key.endsWith('Range')) defaultVal = slot.range;
                                if (stat.key.endsWith('Velocity')) defaultVal = slot.velocity;
                                if (stat.key.endsWith('Flighttime')) defaultVal = slot.flighttime;
                              }
                            }
                          }

                          const currentTweakValue = tweaks[selectedUnit.id]?.[stat.key];
                          const isModified = currentTweakValue !== undefined;
                          const displayValue = isModified ? currentTweakValue : (defaultVal !== undefined ? defaultVal : '');

                          let diffPercent = null;
                          if (isModified && defaultVal !== undefined && typeof defaultVal === 'number') {
                            const cur = parseFloat(currentTweakValue);
                            const def = parseFloat(defaultVal);
                            if (def !== 0) {
                              diffPercent = (((cur - def) / def) * 100).toFixed(0);
                            }
                          }

                          return (
                            <StatCard
                              key={stat.key}
                              modified={isModified}
                              className={`${stat.featured ? 'parameter-card--featured' : 'parameter-card--compact'} ${getRelationshipStateClass(stat.key)}`}
                              data-param-key={stat.key}
                              data-param-unit={stat.unit || undefined}
                              onFocusCapture={() => setActiveRelationshipKey(stat.key)}
                              onClick={() => setActiveRelationshipKey(stat.key)}
                            >
                              <div className="stat-card-label">
                                <span>
                                  <span className="icon">{stat.icon}</span>
                                  {stat.label}
                                  <ParameterHelp paramKey={stat.key} label={stat.label} onOpen={() => {
                                    setActiveRelationshipKey(stat.key);
                                    workspaceLayout.setInspectorTab('details');
                                    workspaceLayout.setRightCollapsed(false);
                                  }} />
                                </span>
                                {diffPercent !== null && (
                                  <span className={`stat-card-diff ${diffPercent >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                                    {diffPercent >= 0 ? '+' : ''}{diffPercent}%
                                  </span>
                                )}
                                {!isModified && defaultResolution.source.startsWith('engine') && (
                                  <span className="stat-card-engine-default" title={`Inherited Recoil default: ${defaultResolution.label}`}>Engine</span>
                                )}
                              </div>

                              <div className="stat-card-input-wrapper">
                                {stat.type === 'boolean' ? (
                                  <InheritedBooleanControl
                                    label={stat.label}
                                    inheritedValue={defaultVal}
                                    inheritedLabel={defaultResolution.label}
                                    modified={isModified}
                                    value={currentTweakValue}
                                    onChange={value => handleStatChange(selectedUnit.id, stat.key, value)}
                                  />
                                ) : (
                                  (() => {
                                    const warning = getValidationWarning(stat.key, displayValue);
                                    return (
                                      <div className="stat-card-field">
                                        {stat.assetType ? (
                                          <AssetPicker
                                            assetType={stat.assetType}
                                            label={stat.label}
                                            value={displayValue}
                                            placeholder={defaultVal !== undefined ? String(defaultVal) : defaultResolution.label}
                                            onChange={value => handleStatChange(selectedUnit.id, stat.key, value)}
                                          />
                                        ) : (
                                          <input
                                            type={stat.type === 'string' ? 'text' : 'number'}
                                            className={`stat-card-input ${warning ? `is-${warning.level}` : ''}`}
                                            value={displayValue}
                                            placeholder={defaultVal !== undefined ? String(defaultVal) : defaultResolution.label}
                                            onChange={e => handleStatChange(selectedUnit.id, stat.key, e.target.value)}
                                          />
                                        )}
                                        {warning && (
                                          <div className={`stat-card-warning is-${warning.level}`}>
                                            {warning.message}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                                {isModified && (
                                  <button
                                    type="button"
                                    className="stat-card-default-pill"
                                    title="Reset to default"
                                    onClick={() => handleStatChange(selectedUnit.id, stat.key, undefined)}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <ComparisonValue active={comparisonMode && isModified} before={defaultVal} after={currentTweakValue} />
                            </StatCard>
                          );
                        }}
                      />
                      <AdvancedCustomParameters
                        defaults={defaults}
                        tweaks={tweaks[selectedUnit.id] || {}}
                        onChange={(key, value) => handleStatChange(selectedUnit.id, key, value)}
                      />
                    </div>
                  )}

                  {/* Mobility View */}
                  {activeParamTab === 'mobility' && (
                    <div id="workspace-panel-mobility" className="workspace-parameter-panel" role="tabpanel" aria-labelledby="workspace-tab-mobility" tabIndex={0}>
                      <SectionHeader
                        className="section-heading"
                        eyebrow="Unit parameters"
                        title="Mobility & Movement Vectors"
                        description="Speed, handling, terrain response, altitude, and detection."
                        actions={(
                          <UnitParameterViewControl
                            showAll={showAllUnitParams}
                            visibleCount={mobilityParams.length}
                            totalCount={allMobilityParams.length}
                            onChange={setShowAllUnitParams}
                          />
                        )}
                      />
                      <ParameterMatrix
                        sectionId="mobility"
                        parameters={mobilityParams}
                        collapsedGroups={workspaceLayout.layout.collapsedGroups}
                        onToggleGroup={workspaceLayout.toggleGroup}
                        renderParameter={stat => {
                          const baseId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
                          const defaults = defaultsDb[baseId] || {};
                          const defaultResolution = resolveUnitParameterDefault(stat, defaults);
                          const defaultVal = defaultResolution.value;

                          const currentTweakValue = tweaks[selectedUnit.id]?.[stat.key];
                          const isModified = currentTweakValue !== undefined;
                          const displayValue = isModified ? currentTweakValue : (defaultVal !== undefined ? defaultVal : '');

                          let diffPercent = null;
                          if (isModified && defaultVal !== undefined && typeof defaultVal === 'number') {
                            const cur = parseFloat(currentTweakValue);
                            const def = parseFloat(defaultVal);
                            if (def !== 0) {
                              diffPercent = (((cur - def) / def) * 100).toFixed(0);
                            }
                          }

                          return (
                            <StatCard
                              key={stat.key}
                              modified={isModified}
                              className={`${stat.featured ? 'parameter-card--featured' : 'parameter-card--compact'} ${getRelationshipStateClass(stat.key)}`}
                              data-param-key={stat.key}
                              data-param-unit={stat.unit || undefined}
                              onFocusCapture={() => setActiveRelationshipKey(stat.key)}
                              onClick={() => setActiveRelationshipKey(stat.key)}
                            >
                              <div className="stat-card-label">
                                <span>
                                  <span className="icon">{stat.icon}</span>
                                  {stat.label}
                                  <ParameterHelp paramKey={stat.key} label={stat.label} onOpen={() => {
                                    setActiveRelationshipKey(stat.key);
                                    workspaceLayout.setInspectorTab('details');
                                    workspaceLayout.setRightCollapsed(false);
                                  }} />
                                </span>
                                {diffPercent !== null && (
                                  <span className={`stat-card-diff ${diffPercent >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                                    {diffPercent >= 0 ? '+' : ''}{diffPercent}%
                                  </span>
                                )}
                                {!isModified && defaultResolution.source.startsWith('engine') && (
                                  <span className="stat-card-engine-default" title={`Inherited Recoil default: ${defaultResolution.label}`}>Engine</span>
                                )}
                              </div>

                              <div className="stat-card-input-wrapper">
                                {stat.type === 'boolean' ? (
                                  <InheritedBooleanControl
                                    label={stat.label}
                                    inheritedValue={defaultVal}
                                    inheritedLabel={defaultResolution.label}
                                    modified={isModified}
                                    value={currentTweakValue}
                                    onChange={value => handleStatChange(selectedUnit.id, stat.key, value)}
                                  />
                                ) : (
                                  (() => {
                                    const warning = getValidationWarning(stat.key, displayValue);
                                    return (
                                      <div className="stat-card-field">
                                        <input
                                          type={stat.type === 'string' ? 'text' : 'number'}
                                          className={`stat-card-input ${warning ? `is-${warning.level}` : ''}`}
                                          value={displayValue}
                                          placeholder={defaultVal !== undefined ? String(defaultVal) : defaultResolution.label}
                                          onChange={e => handleStatChange(selectedUnit.id, stat.key, e.target.value)}
                                        />
                                        {warning && (
                                          <div className={`stat-card-warning is-${warning.level}`}>
                                            {warning.message}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()
                                )}
                                {isModified && (
                                  <button
                                    type="button"
                                    className="stat-card-default-pill"
                                    title="Reset to default"
                                    onClick={() => handleStatChange(selectedUnit.id, stat.key, undefined)}
                                  >
                                    Reset
                                  </button>
                                )}
                              </div>
                              <ComparisonValue active={comparisonMode && isModified} before={defaultVal} after={currentTweakValue} />
                            </StatCard>
                          );
                        }}
                      />
                    </div>
                  )}

                  {/* Weapon Systems View */}
                  {activeParamTab === 'weapons' && (
                    <div id="workspace-panel-weapons" className="workspace-parameter-panel" role="tabpanel" aria-labelledby="workspace-tab-weapons" tabIndex={0}>
                      {slot ? (
                        <div className="workspace-parameter-panel__content">

                          <SectionHeader
                            className="section-heading"
                            eyebrow={`Weapon slot ${slot.slot}`}
                            title="Active Weapon Slot Parameters"
                            description="Tune the selected slot without changing the rest of the unit loadout."
                            actions={(
                              <span className={`section-heading__status ${swap ? 'is-substituted' : ''}`}>
                                {swap ? `Substituted from ${swap.sourceUnitId}` : 'Default chassis weapon'}
                              </span>
                            )}
                          />

                          {/* Swap and Restore Actions */}
                          {selectedUnit.isClone && (
                            <section className={`weapon-substitution ${swap ? 'is-substituted' : ''}`} aria-label={`Weapon substitution for slot ${slot.slot}`}>
                              <div className="weapon-substitution-summary">
                                <span className="weapon-substitution-glyph" aria-hidden="true">
                                  <svg viewBox="0 0 16 16" fill="none">
                                    <path d="M2 5h10M9 2l3 3-3 3M14 11H4M7 8l-3 3 3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                  </svg>
                                </span>
                                <div className="weapon-substitution-copy">
                                  <span>Slot {slot.slot} · Clone loadout</span>
                                  <div className="weapon-substitution-title">
                                    <strong>Weapon substitution</strong>
                                    <span className="weapon-substitution-status" aria-live="polite">
                                      {swap ? 'Borrowed' : 'Original'}
                                    </span>
                                  </div>
                                  {swap ? (
                                    <div className="weapon-substitution-route">
                                      <code>{(originalSlot?.defKey || slot.defKey).toUpperCase()}</code>
                                      <span aria-hidden="true">→</span>
                                      <code>{swap.sourceWeaponDefKey.toUpperCase()}</code>
                                    </div>
                                  ) : (
                                    <small>Borrow a compatible weapon while preserving this slot’s editable overrides.</small>
                                  )}
                                </div>
                              </div>
                              <div className="weapon-substitution-actions">
                                <button
                                  type="button"
                                  className="weapon-substitution-primary"
                                  onClick={() => {
                                    setActiveSwapSlotNum(slot.slot);
                                    setSelectedSwapUnitId(null);
                                    setSwapSearchQuery('');
                                    setSwapPosition(null);
                                    setShowSwapModal(true);
                                  }}
                                >
                                  {swap ? 'Replace weapon' : 'Choose weapon'}
                                </button>
                                {swap && (
                                  <button
                                    type="button"
                                    className="weapon-substitution-restore"
                                    onClick={() => {
                                      setClones(prev => prev.map(c => {
                                        if (c.newId.toLowerCase() === selectedUnit.id.toLowerCase()) {
                                          const nextSwaps = { ...(c.weaponSwaps || {}) };
                                          delete nextSwaps[String(slot.slot)];
                                          return { ...c, weaponSwaps: nextSwaps };
                                        }
                                        return c;
                                      }));
                                      showToast(`Restored default weapon on Slot ${slot.slot}`);
                                    }}
                                  >
                                    Restore original
                                  </button>
                                )}
                              </div>
                            </section>
                          )}

                          <section className="weapon-parameter-profile" aria-label="Active weapon parameter profile">
                            <div className="weapon-parameter-profile__identity">
                              <span className="weapon-parameter-profile__label">Parameter profile</span>
                              <div className="weapon-parameter-profile__heading">
                                <strong>{weaponProfile}</strong>
                                <span className={`weapon-parameter-profile__origin ${swap ? 'is-borrowed' : 'is-native'}`}>
                                  {swap ? 'Borrowed' : 'Native'}
                                </span>
                              </div>
                              <small className="weapon-parameter-profile__source">
                                {swap
                                  ? `Copied from ${unitsDb.names[swap.sourceUnitId] || swap.sourceUnitId} · ${swap.sourceWeaponDefKey.toUpperCase()}`
                                  : `${slot.defKey.toUpperCase()} · native slot ${slot.slot}`}
                              </small>
                            </div>
                            <div className="weapon-parameter-profile__coverage" aria-label="Parameter coverage">
                              <span className="weapon-parameter-profile__label">Coverage</span>
                              <div className="weapon-parameter-profile__metrics" aria-live="polite">
                                <span className="weapon-parameter-profile__metric">
                                  <strong>{detectedWeaponParameterCount}</strong>
                                  <small>Detected</small>
                                </span>
                                <span className="weapon-parameter-profile__metric">
                                  <strong>{weaponParameterCount}</strong>
                                  <small>Visible</small>
                                </span>
                              </div>
                            </div>
                            <div className="weapon-parameter-view-toggle" role="group" aria-label="Weapon parameter view">
                              <span className="weapon-parameter-profile__label">Parameter view</span>
                              <div className="weapon-parameter-view-toggle__options">
                                <button
                                  type="button"
                                  className={!showAllWeaponParams ? 'is-active' : ''}
                                  aria-pressed={!showAllWeaponParams}
                                  onClick={() => setShowAllWeaponParams(false)}
                                >
                                  <strong>Relevant</strong>
                                  <small>Detected fields</small>
                                </button>
                                <button
                                  type="button"
                                  className={showAllWeaponParams ? 'is-active' : ''}
                                  aria-pressed={showAllWeaponParams}
                                  onClick={() => setShowAllWeaponParams(true)}
                                >
                                  <strong>All</strong>
                                  <small>Engine fields</small>
                                </button>
                              </div>
                            </div>
                          </section>

                          <ParameterMatrix
                            sectionId={`weapon-slot-${slot.slot}`}
                            parameters={applicableSlotParams}
                            collapsedGroups={workspaceLayout.layout.collapsedGroups}
                            onToggleGroup={workspaceLayout.toggleGroup}
                            renderParameter={param => {
                              const tweakKey = `weapon_slot_${slot.slot}_${param.key}`;
                              const currentTweakValue = tweaks[selectedUnit.id]?.[tweakKey];
                              const isModified = currentTweakValue !== undefined;
                              const defaultVal = slot[param.key];
                              const displayValue = isModified ? currentTweakValue : (defaultVal !== undefined ? defaultVal : '');

                              let diffPercent = null;
                              if (isModified && defaultVal !== undefined && typeof defaultVal === 'number' && defaultVal !== 0) {
                                diffPercent = (((parseFloat(currentTweakValue) - defaultVal) / defaultVal) * 100).toFixed(0);
                              }

                              return (
                                <div
                                  key={param.key}
                                  className={`stat-card ${param.featured ? 'parameter-card--featured' : 'parameter-card--compact'} ${isModified ? 'modified' : ''} ${getRelationshipStateClass(param.key)}`}
                                  data-param-key={param.key}
                                  data-param-unit={param.unit || undefined}
                                  onFocusCapture={() => setActiveRelationshipKey(param.key)}
                                  onClick={() => setActiveRelationshipKey(param.key)}
                                >
                                  <div className="stat-card-label">
                                    <span>{param.label}<ParameterHelp paramKey={param.key} label={param.label} onOpen={() => {
                                      setActiveRelationshipKey(param.key);
                                      workspaceLayout.setInspectorTab('details');
                                      workspaceLayout.setRightCollapsed(false);
                                    }} /></span>
                                    {diffPercent !== null && (
                                      <span className={`stat-card-diff ${diffPercent >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                                        {diffPercent >= 0 ? '+' : ''}{diffPercent}%
                                      </span>
                                    )}
                                  </div>
                                  <div className="stat-card-input-wrapper">
                                    {param.assetType ? (
                                      <AssetPicker
                                        assetType={param.assetType}
                                        label={param.label}
                                        value={displayValue}
                                        placeholder={defaultVal !== undefined ? String(defaultVal) : 'Inherited'}
                                        onChange={value => handleStatChange(selectedUnit.id, tweakKey, value)}
                                      />
                                    ) : param.type === 'text' ? (
                                      <select
                                        className="stat-card-input"
                                        value={displayValue}
                                        onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value)}
                                      >
                                        <option value="">Default (Inherited)</option>
                                        {param.options?.map(opt => (
                                          <option key={opt} value={opt}>{opt}</option>
                                        ))}
                                      </select>
                                    ) : param.type === 'boolean' ? (
                                      <Switch
                                          className="weapon-parameter-switch"
                                          label={param.label}
                                          checked={displayValue === 'true' || displayValue === true}
                                          onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.checked)}
                                      />
                                    ) : (
                                      (() => {
                                        const warning = getValidationWarning(param.key, displayValue);
                                        return (
                                          <div className="stat-card-field">
                                            <input
                                              type="number"
                                              className={`stat-card-input ${warning ? `is-${warning.level}` : ''}`}
                                              value={displayValue}
                                              placeholder={defaultVal !== undefined ? String(defaultVal) : '0'}
                                              onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value)}
                                            />
                                            {warning && (
                                              <div className={`stat-card-warning is-${warning.level}`}>
                                                {warning.message}
                                              </div>
                                            )}
                                          </div>
                                        );
                                      })()
                                    )}
                                    {isModified && (
                                      <button
                                        type="button"
                                        className="stat-card-default-pill"
                                        aria-label={`Reset ${param.label}`}
                                        title="Reset to default"
                                        onClick={() => handleStatChange(selectedUnit.id, tweakKey, undefined)}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </div>
                                  <ComparisonValue active={comparisonMode && isModified} before={defaultVal} after={currentTweakValue} />
                                </div>
                              );
                            }}
                          />

                          <Suspense fallback={<div className="feature-loading">Loading behaviour controls…</div>}>
                            <LazyBehaviorInterceptorEditor
                              slot={slot}
                              unitDefaults={defaults}
                              unitTweaks={tweaks[selectedUnit.id] || {}}
                              knownTargetableMask={knownTargetableMask}
                              onWeaponChange={(key, value) => handleStatChange(selectedUnit.id, key, value)}
                              onUnitChange={(key, value) => handleStatChange(selectedUnit.id, key, value)}
                              onParameterFocus={key => setActiveRelationshipKey(key)}
                            />
                          </Suspense>

                          <div className="weapon-advanced-groups">
                            {applicableAdvancedWeaponGroups.map(group => (
                              <section className="weapon-advanced-group" key={group.title}>
                                <div className="weapon-advanced-group-heading">
                                  <div>
                                    <span>{group.title}</span>
                                    <small>{group.description}</small>
                                  </div>
                                </div>
                                <div className="editor-grid weapon-parameter-grid weapon-advanced-grid">
                                  {group.params.map(param => {
                                    const tweakKey = `weapon_slot_${slot.slot}_${param.key}`;
                                    const currentTweakValue = tweaks[selectedUnit.id]?.[tweakKey];
                                    const isModified = currentTweakValue !== undefined;
                                    const defaultVal = slot[param.key];
                                    const displayValue = isModified ? currentTweakValue : (defaultVal !== undefined ? defaultVal : '');
                                    return (
                                      <div
                                        key={param.key}
                                        className={`stat-card stat-card--advanced ${isModified ? 'modified' : ''} ${getRelationshipStateClass(param.key)}`}
                                        data-param-key={param.key}
                                        onFocusCapture={() => setActiveRelationshipKey(param.key)}
                                        onClick={() => setActiveRelationshipKey(param.key)}
                                      >
                                        <div className="stat-card-label">
                                          <span>{param.label}<ParameterHelp paramKey={param.key} label={param.label} onOpen={() => {
                                            setActiveRelationshipKey(param.key);
                                            workspaceLayout.setInspectorTab('details');
                                            workspaceLayout.setRightCollapsed(false);
                                          }} /></span>
                                          {param.danger && <span className="stat-card-diff diff-negative">Caution</span>}
                                        </div>
                                        <div className="stat-card-input-wrapper">
                                          {param.type === 'tri-state' ? (
                                            <select
                                              className="stat-card-input"
                                              value={displayValue === true ? 'true' : displayValue === false ? 'false' : displayValue}
                                              onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value === '' ? undefined : e.target.value)}
                                            >
                                              <option value="">Inherited</option>
                                              <option value="true">Enabled</option>
                                              <option value="false">Disabled</option>
                                            </select>
                                          ) : param.type === 'string' ? (
                                            WEAPON_ASSET_TYPES[param.key] ? (
                                              <AssetPicker
                                                assetType={WEAPON_ASSET_TYPES[param.key]}
                                                label={param.label}
                                                value={displayValue}
                                                placeholder="Inherited"
                                                onChange={value => handleStatChange(selectedUnit.id, tweakKey, value || undefined)}
                                              />
                                            ) : (
                                              <input
                                                type="text"
                                                className="stat-card-input"
                                                value={displayValue}
                                                placeholder="Inherited"
                                                onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value === '' ? undefined : e.target.value)}
                                              />
                                            )
                                          ) : (
                                            <input
                                              type="number"
                                              className="stat-card-input"
                                              value={displayValue}
                                              placeholder={defaultVal !== undefined ? String(defaultVal) : 'Inherited'}
                                              onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value)}
                                            />
                                          )}
                                          {isModified && (
                                            <span
                                              className="stat-card-default-pill"
                                              title="Reset to inherited value"
                                              onClick={() => handleStatChange(selectedUnit.id, tweakKey, undefined)}
                                            >
                                              ×
                                            </span>
                                          )}
                                        </div>
                                        <ComparisonValue active={comparisonMode && isModified} before={defaultVal} after={currentTweakValue} />
                                      </div>
                                    );
                                  })}
                                </div>
                              </section>
                            ))}
                          </div>

                          {/* Target Category Masks */}
                          {(() => {
                            const catFields = [
                              { key: 'onlytargetcategory', label: 'Allow targets', helper: 'The weapon can only acquire matching unit categories.' },
                              { key: 'badtargetcategory', label: 'De-prioritise targets', helper: 'Matching categories are targeted last, not blocked.' }
                            ];
                            return (
                              <div className="target-filter-panel">
                                <SectionHeader
                                  className="section-heading section-heading--compact target-filter-panel-heading"
                                  eyebrow="Target logic"
                                  title="Target Category Filters"
                                  description="Control target eligibility and priority through engine category masks."
                                  actions={<span className="section-heading__meta">{catFields.length} masks</span>}
                                  headingLevel={3}
                                />
                                {catFields.map(cf => {
                                  const tweakKey = `weapon_slot_${slot.slot}_${cf.key}`;
                                  const currentVal = tweaks[selectedUnit.id]?.[tweakKey];
                                  const activeCats = currentVal ? String(currentVal).split(/\s+/).filter(Boolean) : [];
                                  const isModified = currentVal !== undefined;
                                  return (
                                    <div
                                      key={cf.key}
                                      className={`target-filter-row target-filter-row--${cf.key} ${getRelationshipStateClass(cf.key)}`}
                                      data-param-key={cf.key}
                                      onFocusCapture={() => setActiveRelationshipKey(cf.key)}
                                      onClick={() => setActiveRelationshipKey(cf.key)}
                                    >
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <div className="target-filter-copy">
                                          <span className="target-filter-label">{cf.label}<ParameterHelp paramKey={cf.key} label={cf.label} onOpen={() => {
                                            setActiveRelationshipKey(cf.key);
                                            workspaceLayout.setInspectorTab('details');
                                            workspaceLayout.setRightCollapsed(false);
                                          }} /></span>
                                          <span className="target-filter-helper">{cf.helper}</span>
                                        </div>
                                        <div className="target-filter-groups">
                                          {TARGET_CATEGORY_GROUPS.map(group => (
                                            <div className="target-filter-group" key={group.label}>
                                              <span>{group.label}</span>
                                              <div className="target-filter-chips">
                                                {group.categories.map(cat => {
                                                  const isActive = activeCats.includes(cat);
                                                  return (
                                                    <button
                                                      type="button"
                                                      key={cat}
                                                      className={`target-filter-chip ${isActive ? 'active' : ''}`}
                                                      onClick={() => {
                                                        const next = isActive ? activeCats.filter(c => c !== cat) : [...activeCats, cat];
                                                        handleStatChange(selectedUnit.id, tweakKey, next.length > 0 ? next.join(' ') : undefined);
                                                      }}
                                                    >
                                                      {cat}
                                                    </button>
                                                  );
                                                })}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                        {isModified && (
                                          <button
                                            type="button"
                                            className="target-filter-reset"
                                            aria-label="Reset target categories"
                                            onClick={() => handleStatChange(selectedUnit.id, tweakKey, undefined)}
                                            style={{
                                              fontSize: '9px', cursor: 'pointer', color: 'var(--text-muted)',
                                              fontWeight: 600, opacity: 0.5, padding: '2px 6px'
                                            }}
                                          >
                                            ×
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
                          No active weapon slot selected.
                        </div>
                      )}
                    </div>
                  )}

                </ParameterCanvas>
              </div>
            );
          })() : (
            <div className="workspace-empty">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75" />
              </svg>
              <h3>No Unit Selected</h3>
              <p>Select a unit from the sidebar to inspect parameters.</p>
            </div>
          )}
        </main>

        <EditorInspector
          collapsed={workspaceLayout.layout.rightCollapsed}
          onCollapsedChange={workspaceLayout.setRightCollapsed}
          activeTab={workspaceLayout.layout.inspectorTab}
          onTabChange={workspaceLayout.setInspectorTab}
          tabs={inspectorTabs}
          density={workspaceLayout.layout.density}
          onDensityChange={workspaceLayout.setDensity}
          projectChangeCount={projectChangeCount}
          panels={{
            details: (
              <div className="inspector-panel-stack">
                <section className="inspector-intro">
                  <span>Selected parameter</span>
                  <h3>{activeRelationshipKey ? getRelationshipLabel(activeRelationshipKey) : 'Choose a parameter'}</h3>
                  <p>{activeRelationshipKey
                    ? getParameterHelp(activeRelationshipKey, getRelationshipLabel(activeRelationshipKey))
                    : 'Open a help control or select a relationship to inspect its behavior and connected values.'}</p>
                </section>
                <ParameterGuide section={activeParamTab} />
                <ParameterRelationshipPanel
                  section={activeParamTab}
                  activeKey={activeRelationshipKey}
                  onSelect={selectInspectorParameter}
                  onClear={() => setActiveRelationshipKey(null)}
                />
                {selectedUnit && (
                  <section className="inspector-section-card">
                    <div className="inspector-section-heading">
                      <span>Unit description</span>
                      <small>Saved with this project</small>
                    </div>
                    <textarea
                      className="form-input inspector-description-field"
                      aria-label={`Custom description for ${selectedUnit.name}`}
                      placeholder={selectedUnit.desc || 'No chassis description available.'}
                      value={unitDescriptions[selectedUnit.id] || ''}
                      onChange={event => updateSelectedUnitDescription(event.target.value)}
                    />
                  </section>
                )}
              </div>
            ),
            compare: (
              <div className="inspector-panel-stack">
                <section className="inspector-intro">
                  <span>Before / after</span>
                  <h3>{selectedUnitOverrideEntries.length} active override{selectedUnitOverrideEntries.length === 1 ? '' : 's'}</h3>
                  <p>Compare edited values with their inherited BAR definitions directly in the parameter canvas.</p>
                  <Button
                    variant={comparisonMode ? 'secondary' : 'primary'}
                    onClick={() => setComparisonMode(current => !current)}
                  >
                    {comparisonMode ? 'Exit comparison' : 'Enable comparison'}
                  </Button>
                </section>
                {activeCollection && (
                  <section className="inspector-section-card">
                    <div className="inspector-section-heading">
                      <span>Collection scope</span>
                      <small>{activeCollectionUnits.length} available members</small>
                    </div>
                    <div className="inspector-change-list">
                      {activeCollectionUnits.slice(0, 8).map(unit => (
                        <button type="button" key={unit.id} onClick={() => setSelectedUnitId(unit.id)}>
                          <span>{unit.name}</span>
                          <code>{Object.keys(tweaks[unit.id] || {}).length} edits</code>
                        </button>
                      ))}
                    </div>
                    {activeCollectionUnits.length > 8 && <p className="inspector-empty-copy">+{activeCollectionUnits.length - 8} additional collection members</p>}
                  </section>
                )}
                <div className="inspector-change-list">
                  {selectedUnitOverrideEntries.length > 0 ? selectedUnitOverrideEntries.map(([key, value]) => (
                    <button type="button" key={key} onClick={() => selectInspectorParameter(key.replace(/^weapon_slot_\d+_/, ''))}>
                      <span>{getRelationshipLabel(key.replace(/^weapon_slot_\d+_/, ''))}</span>
                      <code>{String(value)}</code>
                    </button>
                  )) : <p className="inspector-empty-copy">This unit still uses every inherited value.</p>}
                </div>
              </div>
            ),
            identity: selectedUnit?.isClone ? (() => {
              const selectedClone = clones.find(clone => clone.newId.toLowerCase() === selectedUnit.id.toLowerCase());
              if (!selectedClone) return null;
              return (
                <div className="inspector-panel-stack">
                  <section className="inspector-intro">
                    <span>Clone identity</span>
                    <h3>{selectedUnit.name}</h3>
                    <p>Metadata stays synchronized with Build Menus and exported clone definitions.</p>
                  </section>
                  <div className="inspector-form-grid">
                    <label>
                      <span>Display name</span>
                      <input
                        type="text"
                        className="form-input"
                        value={selectedClone.displayName || ''}
                        onChange={event => setClones(previous => previous.map(clone => clone.newId.toLowerCase() === selectedUnit.id.toLowerCase()
                          ? { ...clone, displayName: event.target.value }
                          : clone))}
                      />
                    </label>
                    <label>
                      <span>Builder IDs</span>
                      <input
                        type="text"
                        className="form-input"
                        value={selectedClone.builderIds?.join(', ') || ''}
                        onChange={event => handleCloneBuildersChange(selectedUnit.id, event.target.value.split(','))}
                      />
                      <small>{selectedClone.builderIds?.length || 0} assigned · synced with Build Menus</small>
                    </label>
                  </div>
                </div>
              );
            })() : null,
            changes: (
              <div className="editor-inspector-changes">
                <div className="changes-context-summary">
                  <div>
                    <span>{activeCollection ? 'Collection ledger' : 'Project ledger'}</span>
                    <strong>{activeCollection
                      ? `${activeCollectionModifiedCount} edited member${activeCollectionModifiedCount === 1 ? '' : 's'}`
                      : `${projectChangeCount} tracked change${projectChangeCount === 1 ? '' : 's'}`}</strong>
                  </div>
                  {scopedValidationIssues.length > 0 && <small>{scopedValidationIssues.length} need review</small>}
                </div>
                <div className="code-scroll-area changes-pane-content">

                {(() => {
                  const healthState = scopedValidationIssues.some(issue => issue.level === 'error')
                    ? 'error'
                    : scopedValidationIssues.length > 0 ? 'warning' : 'ready';
                  const isReady = healthState === 'ready';
                  return (
                    <div className={`change-health-card ${healthState}`} role="status" aria-live="polite">
                      <span className="change-health-icon" aria-hidden="true">
                        {isReady ? (
                          <svg viewBox="0 0 16 16"><path d="m3.25 8.25 2.8 2.8 6.7-6.7" /></svg>
                        ) : (
                          <svg viewBox="0 0 16 16"><path d="M8 3v5.25" /><path d="M8 11.5h.01" /></svg>
                        )}
                      </span>
                      <div className="change-health-copy">
                        <span className="change-health-eyebrow">{activeCollection ? activeCollection.name : isReady ? 'Validation complete' : healthState === 'error' ? 'Action required' : 'Review suggested'}</span>
                        <strong>{isReady ? (activeCollection ? 'Collection clear' : 'Project ready') : 'Review recommended'}</strong>
                        <span>
                          {isReady
                            ? `No validation issues detected${activeCollection ? ' in this collection' : ''}`
                            : `${scopedValidationIssues.length} validation ${scopedValidationIssues.length === 1 ? 'issue needs' : 'issues need'} attention`}
                        </span>
                      </div>
                      <div className="change-health-budget" aria-label={`${totalBytesUsed.toLocaleString()} bytes in generated project output`}>
                        <span>Export size</span>
                        <strong>{totalBytesUsed.toLocaleString()}</strong>
                        <small>bytes</small>
                      </div>
                    </div>
                  );
                })()}

                {/* Active Tweaks Summary Strip */}
                <div className="changes-summary-grid">
                  <button
                    onClick={() => {
                      setActiveSummaryTab('tweaks');
                      setShowSummaryModal(true);
                    }}
                    title="View/reset active tweaks"
                  >
                    Tweaks: <span style={{ color: 'var(--color-arm)', fontWeight: 800 }}>{modifiedUnitIds.length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSummaryTab('clones');
                      setShowSummaryModal(true);
                    }}
                    title="View/remove custom clones"
                  >
                    Clones: <span style={{ color: 'var(--color-leg)', fontWeight: 800 }}>{clones.length}</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveSummaryTab('rosters');
                      setShowSummaryModal(true);
                    }}
                    title="View/reset roster configurations"
                  >
                    Rosters: <span style={{ color: 'var(--color-rap)', fontWeight: 800 }}>{buildMenuSteps.length + activeBuildMenuPackCount}</span>
                  </button>
                </div>

                {/* Mod Project Settings Card */}
                <div className="expert-settings-card project-metadata-card">
                  <div className="drawer-section-heading">
                    Project Metadata
                  </div>
                  <div className="project-metadata-grid">
                    <div className="drawer-field">
                      <label>Mod Name</label>
                      <input
                        type="text"
                        className="form-input"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                      />
                    </div>
                    <div className="drawer-field">
                      <label>Author</label>
                      <input
                        type="text"
                        className="form-input"
                        value={projectAuthor}
                        onChange={e => setProjectAuthor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="drawer-field">
                    <label>Mod Description</label>
                    <textarea
                      className="form-input"
                      value={projectDesc}
                      onChange={e => setProjectDesc(e.target.value)}
                    />
                  </div>
                </div>

                {/* Compilation Flags Card */}
                <div className="expert-settings-card compilation-flags-card">
                  <div className="drawer-section-heading">
                    Mod Compilation Flags
                  </div>
                  <div className="compilation-flags-list">
                    <div className="expert-toggle-row">
                      <span>Parameter Tweaks</span>
                      <Switch
                        label="Include parameter tweaks"
                        checked={includeTweaks}
                        onChange={e => setIncludeTweaks(e.target.checked)}
                      />
                    </div>
                    <div className="expert-toggle-row">
                      <span>Custom Cloned Units</span>
                      <Switch
                        label="Include custom cloned units"
                        checked={includeClones}
                        onChange={e => setIncludeClones(e.target.checked)}
                      />
                    </div>
                    <div className="expert-toggle-row">
                      <span>Factory Roster Changes</span>
                      <Switch
                        label="Include factory roster changes"
                        checked={includeRosters}
                        onChange={e => setIncludeRosters(e.target.checked)}
                      />
                    </div>
                    <div className="expert-toggle-row">
                      <span>Include Header Comments</span>
                      <Switch
                        label="Include header comments"
                        checked={includeHeader}
                        onChange={e => setIncludeHeader(e.target.checked)}
                      />
                    </div>
                  </div>
                </div>

                {/* Tabs Row for Code outputs */}
                <div className="compiled-output-section">
                  <div className="compiled-output-tabs">
                    {['tweakdefs_lua', 'tweakunits_lua', 'tweakdefs_b64', 'tweakunits_b64'].map(tab => {
                      const isActive = activeOutputTab === tab;
                      const label = tab === 'tweakdefs_lua' ? 'Defs Lua' : tab === 'tweakunits_lua' ? 'Units Lua' : tab === 'tweakdefs_b64' ? 'B64 Defs' : 'B64 Units';
                      return (
                        <button
                          key={tab}
                          className={`compiled-output-tab ${isActive ? 'active' : ''}`}
                          onClick={() => setActiveOutputTab(tab)}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dynamic Code Viewer Card */}
                  {(() => {
                    let codeVal = '';
                    let isLua = false;
                    let fallbackMsg = '';

                    if (activeOutputTab === 'tweakdefs_lua') {
                      codeVal = generatedTweakDefsLua;
                      isLua = true;
                      fallbackMsg = '-- No clone or custom builder definitions compile.';
                    } else if (activeOutputTab === 'tweakunits_lua') {
                      codeVal = generatedTweakUnitsLua;
                      isLua = true;
                      fallbackMsg = '{\n}';
                    } else if (activeOutputTab === 'tweakdefs_b64') {
                      codeVal = tweakDefsB64;
                      fallbackMsg = 'No clones/disabled definitions base64 generated.';
                    } else if (activeOutputTab === 'tweakunits_b64') {
                      codeVal = tweakUnitsB64;
                      fallbackMsg = 'No parameter tweaks base64 generated.';
                    }

                    return (
                      <div className="code-block-wrapper compiled-code-wrapper">
                        <div className="code-block-header">
                          <span className="code-block-title">
                            {activeOutputTab.includes('lua') ? 'Lua Source Code' : 'Encoded Base64'}
                          </span>
                          <button
                            className="copy-output-button"
                            onClick={() => {
                              const valueToCopy = codeVal || fallbackMsg;
                              navigator.clipboard.writeText(valueToCopy);
                              showToast(`Copied current view text!`);
                            }}
                          >
                            Copy to Clipboard
                          </button>
                        </div>
                        {isLua ? (
                          <pre className="code-box lua">
                            {codeVal || fallbackMsg}
                          </pre>
                        ) : (
                          <div className="code-box code-box--encoded">
                            {codeVal || fallbackMsg}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>

                {/* Base64 toggles & Budget limit indicators at bottom */}
                <div className="changes-pane-footer">
                  {scopedValidationIssues.length > 0 && (
                    <div className="drawer-validation-card">
                      <span className="drawer-validation-title">
                        ⚠️ Smart Validation Warning ({scopedValidationIssues.length})
                      </span>
                      <div className="drawer-validation-list">
                        {scopedValidationIssues.map((issue, idx) => (
                          <span key={idx} className="drawer-validation-item">
                            <code>{issue.unitName}</code> ({issue.key.replace('weapon_slot_', 'Slot ')}): <span className={`drawer-validation-message ${issue.level}`}>{issue.message}</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className={`lobby-limit-indicator ${limitRisk}`}>
                    Byte Budget: {totalBytesUsed} / {lobbyByteLimit} bytes
                    {limitRisk === 'error' && <span> [LIMIT EXCEEDED]</span>}
                    {limitRisk === 'warning' && <span> [APPROACHING LIMIT]</span>}
                    {limitRisk === 'ok' && <span> [SAFE]</span>}
                  </div>

                  <div className="expert-settings-card base64-options-card">
                    <div className="expert-toggle-row">
                      <span>Lobby-safe encoding</span>
                      <span className="expert-setting-status" title="Required so BAR start scripts preserve the generated Lua">Required</span>
                    </div>
                    <div className="expert-toggle-row">
                      <span>Padding</span>
                      <Switch
                        label="Include Base64 padding"
                        checked={base64Options.padding}
                        onChange={e => setBase64Options(prev => ({ ...prev, padding: e.target.checked }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              </div>
            )
          }}
        />

      </EditorShell>
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

      {/* Legacy review markup retained temporarily as a parity reference during extraction. */}
      {SHOW_LEGACY_REVIEW_REFERENCE && (
        <main className="review-workspace">
          <div className="review-page-header">
            <div>
              <span className="workflow-eyebrow">Final review</span>
              <h2>Review & Export</h2>
              <p>Validate the project, inspect every change, and prepare the generated BAR configuration.</p>
            </div>
            <div className="review-header-actions">
              <button className="btn-action btn-secondary" onClick={() => setActiveWorkspace('edit')}>Back to editor</button>
              <button className="btn-action" onClick={handleExportConfig}>Download project file</button>
            </div>
          </div>

          <div className="review-content-grid">
            <div className="review-main-column">
              <section className="review-summary-grid" aria-label="Project summary">
                <button onClick={() => { setActiveSummaryTab('tweaks'); setShowSummaryModal(true); }}>
                  <span>Modified units</span><strong>{modifiedUnitIds.length}</strong><small>Parameter overrides</small>
                </button>
                <button onClick={() => { setActiveSummaryTab('clones'); setShowSummaryModal(true); }}>
                  <span>Custom units</span><strong>{clones.length}</strong><small>Cloned definitions</small>
                </button>
                <button onClick={() => { setActiveSummaryTab('rosters'); setShowSummaryModal(true); }}>
                  <span>Build menus</span><strong>{buildMenuSteps.length + activeBuildMenuPackCount}</strong><small>Roster operations and packs</small>
                </button>
                <div>
                  <span>Disabled units</span><strong>{disabledUnitIds.length}</strong><small>Removed from play</small>
                </div>
              </section>

              <section className="review-card validation-center">
                <div className="review-card-heading">
                  <div>
                    <span className="workflow-eyebrow">Validation center</span>
                    <h3>{validationIssues.length === 0 ? 'Ready to export' : `${validationIssues.length} ${validationIssues.length === 1 ? 'issue' : 'issues'} to review`}</h3>
                  </div>
                  <span className={`review-status ${validationIssues.some(issue => issue.level === 'error') ? 'error' : validationIssues.length ? 'warning' : 'ready'}`}>
                    {validationIssues.some(issue => issue.level === 'error') ? 'Blocked' : validationIssues.length ? 'Review' : 'Ready'}
                  </span>
                </div>
                {validationIssues.length === 0 ? (
                  <div className="review-empty-state">
                    <strong>No validation issues detected</strong>
                    <span>Your current parameter values pass the editor's safety checks.</span>
                  </div>
                ) : (
                  <div className="validation-list">
                    {validationIssues.map((issue, index) => (
                      <div key={`${issue.unitName}-${issue.key}-${index}`} className={`validation-row ${issue.level}`}>
                        <span>{issue.unitName}</span>
                        <code>{issue.key.replace('weapon_slot_', 'Weapon ')}</code>
                        <strong>{issue.message}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="review-card change-ledger">
                <div className="review-card-heading">
                  <div>
                    <span className="workflow-eyebrow">Change ledger</span>
                    <h3>{projectChangeCount} project changes</h3>
                  </div>
                  <button className="text-button" onClick={() => { setActiveSummaryTab('tweaks'); setShowSummaryModal(true); }}>Open full summary</button>
                </div>
                {modifiedUnitIds.length === 0 && clones.length === 0 && disabledUnitIds.length === 0 ? (
                  <div className="review-empty-state">
                    <strong>No unit changes yet</strong>
                    <span>Return to Edit Units to begin modifying the project.</span>
                  </div>
                ) : (
                  <div className="change-ledger-list">
                    {modifiedUnitIds.slice(0, 8).map(id => (
                      <button key={id} onClick={() => { setSelectedUnitId(id); setActiveWorkspace('edit'); }}>
                        <span>{unitsDb.names[id] || id}</span>
                        <code>{Object.keys(tweaks[id] || {}).length} fields</code>
                        <strong>Edit →</strong>
                      </button>
                    ))}
                    {modifiedUnitIds.length > 8 && <div className="ledger-more">+{modifiedUnitIds.length - 8} more modified units</div>}
                  </div>
                )}
              </section>
            </div>

            <aside className="export-console">
              <div className="export-console-header">
                <div>
                  <span className="workflow-eyebrow">Export console</span>
                  <h3>{projectName}</h3>
                </div>
                <span className={`review-status ${limitRisk}`}>{totalBytesUsed.toLocaleString()} / {lobbyByteLimit.toLocaleString()} bytes</span>
              </div>

              <div className="export-metadata-grid">
                <label>Mod name<input className="form-input" value={projectName} onChange={e => setProjectName(e.target.value)} /></label>
                <label>Author<input className="form-input" value={projectAuthor} onChange={e => setProjectAuthor(e.target.value)} /></label>
                <label className="full">Description<textarea className="form-input" value={projectDesc} onChange={e => setProjectDesc(e.target.value)} /></label>
              </div>

              <div className="export-flags">
                <div><Switch label="Include parameter tweaks" checked={includeTweaks} onChange={e => setIncludeTweaks(e.target.checked)} /><span>Parameter tweaks</span></div>
                <div><Switch label="Include custom units" checked={includeClones} onChange={e => setIncludeClones(e.target.checked)} /><span>Custom units</span></div>
                <div><Switch label="Include build menus" checked={includeRosters} onChange={e => setIncludeRosters(e.target.checked)} /><span>Build menus</span></div>
                <div><Switch label="Include header comments" checked={includeHeader} onChange={e => setIncludeHeader(e.target.checked)} /><span>Header comments</span></div>
              </div>

              <div className="export-output-tabs">
                {[
                  ['tweakdefs_lua', 'Definitions Lua'],
                  ['tweakunits_lua', 'Units Lua'],
                  ['tweakdefs_b64', 'Definitions Base64'],
                  ['tweakunits_b64', 'Units Base64']
                ].map(([id, label]) => (
                  <button key={id} className={activeOutputTab === id ? 'active' : ''} onClick={() => setActiveOutputTab(id)}>{label}</button>
                ))}
              </div>

              <pre className="export-code-preview">{activeCompiledOutput || activeCompiledOutputFallback}</pre>

              <div className="export-primary-actions">
                <button className="btn-action btn-secondary" onClick={() => {
                  navigator.clipboard.writeText(activeCompiledOutput || activeCompiledOutputFallback);
                  showToast('Compiled output copied');
                }}>Copy current output</button>
                <button className="btn-action" onClick={handleExportConfig}>Download project JSON</button>
              </div>
            </aside>
          </div>
        </main>
      )}

      {/* Roster Designer Page — lazy loaded on entry */}
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
            onToggleRosterPack={(packId) => {
              setBuildMenuPacks(current => ({ ...current, [packId]: !current[packId] }));
            }}
            onClose={() => { setShowDesignerPanel(false); setActiveWorkspace('edit'); }}
          >
            <div className="designer-modal-content">
              {/* Left Column: Factory Selection */}
              <div className="designer-panel designer-factory-browser">
                <div className="designer-panel-header">
                  <span className="designer-panel-kicker">Producer catalog</span>
                  <span className="designer-panel-title">Choose a producer <small>{filteredProducers.length}</small></span>
                  <span className="designer-producer-summary">
                    {producerCounts.factory} factories <span aria-hidden="true">·</span> {producerCounts.builder} builders
                  </span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search producers by name or ID..."
                    value={factorySearchQuery}
                    onChange={e => setFactorySearchQuery(e.target.value)}
                    aria-label="Search producers"
                  />
                  <div className="faction-tabs designer-faction-tabs designer-faction-tabs--four">
                    <button
                      className={`faction-tab ${designerFaction === 'all' ? 'active' : ''}`}
                      onClick={() => setDesignerFaction('all')}
                    >
                      ALL
                    </button>
                    <button
                      className={`faction-tab ${designerFaction === 'arm' ? 'active' : ''}`}
                      onClick={() => setDesignerFaction('arm')}
                    >
                      ARM
                    </button>
                    <button
                      className={`faction-tab ${designerFaction === 'cor' ? 'active' : ''}`}
                      onClick={() => setDesignerFaction('cor')}
                    >
                      COR
                    </button>
                    <button
                      className={`faction-tab ${designerFaction === 'leg' ? 'active' : ''}`}
                      onClick={() => setDesignerFaction('leg')}
                    >
                      LEG
                    </button>
                  </div>
                  <div className="designer-producer-kind-tabs" role="group" aria-label="Producer type">
                    {[
                      ['all', 'All'],
                      [PRODUCER_KIND.FACTORY, 'Factories'],
                      [PRODUCER_KIND.BUILDER, 'Builders'],
                    ].map(([kind, label]) => (
                      <button
                        type="button"
                        key={kind}
                        className={`designer-producer-kind-tab ${producerKindFilter === kind ? 'active' : ''}`}
                        onClick={() => setProducerKindFilter(kind)}
                        aria-pressed={producerKindFilter === kind}
                      >
                        <span>{label}</span>
                        <small>{producerCounts[kind]}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="designer-panel-scroll">
                  {filteredProducers.length === 0 && (
                    <div className="designer-producer-empty">
                      <strong>No producers found</strong>
                      <span>Try another faction, producer type, or search term.</span>
                      <button
                        type="button"
                        onClick={() => {
                          setDesignerFaction('all');
                          setProducerKindFilter('all');
                          setFactorySearchQuery('');
                        }}
                      >
                        Clear catalog filters
                      </button>
                    </div>
                  )}
                  {filteredProducers.map(producer => {
                    const isActive = selectedFactoryId === producer.id;
                    const isMod = factoryIsModified(producer.id);
                    return (
                      <button
                        type="button"
                        key={producer.id}
                        className={`designer-factory-item ${isActive ? 'active' : ''}`}
                        onClick={() => setSelectedFactoryId(producer.id)}
                        aria-pressed={isActive}
                      >
                        <div className="designer-unit-pic designer-unit-pic--factory">
                          <UnitArtwork unitId={producer.id} alt="" />
                        </div>
                        <div className="designer-unit-info">
                          <span className="designer-unit-name">
                            {producer.name}
                          </span>
                          <div className="designer-unit-meta">
                            <span className="designer-unit-id">{producer.id}</span>
                            <span className={`designer-producer-kind designer-producer-kind--${producer.kind}`}>
                              {producer.kindLabel}
                            </span>
                            <span className="designer-producer-tier">{producer.tier}</span>
                            {isMod && <span className="designer-item-status designer-item-status--modified">Modified</span>}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Middle Column: Active Roster Grid (Build Menu Simulation) */}
              <div className="designer-panel designer-roster-canvas">
                <div className="designer-panel-header">
                  <span className="designer-panel-kicker">Production sequence</span>
                  <span className="designer-panel-title">
                    {selectedProducer?.name || unitsDb.names[selectedFactoryId] || selectedFactoryId}
                    {factoryIsModified(selectedFactoryId) && (
                      <button
                        type="button"
                        className="designer-reset-factory"
                        onClick={() => {
                          setBuildMenuSteps(prev => prev.filter(s => s.builderId !== selectedFactoryId));
                          showToast(`Reset build options for ${selectedProducer?.name || selectedFactoryId} to the selected game setup`);
                        }}
                      >
                        Reset producer
                      </button>
                    )}
                  </span>
                  <div className="designer-panel-description">
                    Drag units to reorder the build menu. Removed slots remain visible until restored.
                  </div>
                </div>

                { }
                <div className="designer-panel-scroll designer-roster-scroll">
                  <div className="build-menu-grid">
                    {activeRosterItems.map((item, index) => {
                      const isAdded = item.status === 'added';
                      const isRemoved = item.status === 'removed';
                      const displayIndex = String(index + 1).padStart(2, '0');
                      return (
                        <div
                          key={item.id}
                          draggable={!isRemoved}
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', item.id);
                            e.currentTarget.classList.add('dragging');
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.classList.remove('dragging');
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            if (!isRemoved) {
                              e.currentTarget.classList.add('drag-over');
                            }
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('drag-over');
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.currentTarget.classList.remove('drag-over');
                            if (isRemoved) return;

                            const draggedId = e.dataTransfer.getData('text/plain');
                            if (draggedId === item.id) return;

                            const activeIds = activeRosterItems.filter(x => x.status !== 'removed').map(x => x.id);
                            const dragIdx = activeIds.indexOf(draggedId);
                            const targetIdx = activeIds.indexOf(item.id);

                            if (dragIdx === -1 || targetIdx === -1) return;

                            const newOrder = [...activeIds];
                            newOrder.splice(dragIdx, 1);
                            newOrder.splice(targetIdx, 0, draggedId);

                            handleReorderFactoryRoster(selectedFactoryId, newOrder);
                          }}
                          className={`build-menu-slot ${isAdded ? 'added' : ''} ${isRemoved ? 'removed' : ''}`}
                        >
                          <span className="slot-index">{displayIndex}</span>
                          <UnitArtwork
                            src={getProjectUnitIconUrl(item.id)}
                            alt=""
                            className="build-menu-slot-image"
                          />

                          <div className="slot-overlay-actions">
                            <span className="slot-unit-name" title={item.name}>{item.name}</span>
                            <span className="slot-unit-id">{item.id}</span>
                            {item.sourcePack && (
                              <span className={`slot-pack-source slot-pack-source--${item.sourcePack}`}>
                                {item.sourcePack === 'extraUnits' ? 'Extra pack' : 'Scavenger pack'}
                              </span>
                            )}
                            {!isRemoved ? (
                              <button
                                className="slot-btn slot-btn-remove"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemoveUnitFromFactory(selectedFactoryId, item.id);
                                }}
                              >
                                Remove
                              </button>
                            ) : (
                              <button
                                className="slot-btn slot-btn-restore"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRevertUnitInFactory(selectedFactoryId, item.id);
                                }}
                              >
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {activeRosterItems.filter(i => i.status !== 'removed').length === 0 && (
                    <div className="designer-empty-state">
                      <strong>No production options</strong>
                      <span>
                      Roster is currently empty. Game engine will not display this factory in-game.
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Available Units to Add */}
              { }
              <div className="designer-panel designer-unit-library">
                <div className="designer-panel-header">
                  <span className="designer-panel-kicker">Unit library</span>
                  <span className="designer-panel-title">Add production options <small>{availableUnitsForFactory.length}</small></span>
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search units to add..."
                    value={availableSearchQuery}
                    onChange={e => setAvailableSearchQuery(e.target.value)}
                  />
                  <div className="faction-tabs designer-faction-tabs designer-faction-tabs--three">
                    <button
                      className={`faction-tab ${availableFactionFilter === 'factory' ? 'active' : ''}`}
                      onClick={() => setAvailableFactionFilter('factory')}
                    >
                      PRODUCER FACTION
                    </button>
                    <button
                      className={`faction-tab ${availableFactionFilter === 'all' ? 'active' : ''}`}
                      onClick={() => setAvailableFactionFilter('all')}
                    >
                      ALL FACTIONS
                    </button>
                    <button
                      className={`faction-tab ${availableFactionFilter === 'clone' ? 'active' : ''}`}
                      onClick={() => setAvailableFactionFilter('clone')}
                    >
                      CLONES ONLY
                    </button>
                  </div>
                </div>

                <div className="designer-panel-scroll">
                  {availableUnitsForFactory.map(unit => (
                      <div key={unit.id} className="designer-roster-item">
                        <div className="designer-unit-card">
                          <div className="designer-unit-pic">
                            <UnitArtwork
                              src={getProjectUnitIconUrl(unit.id)}
                              alt=""
                            />
                          </div>
                          <div className="designer-unit-info">
                            <span className="designer-unit-name">{unit.name}</span>
                            <div className="designer-unit-meta">
                              <span className="designer-unit-id">{unit.id}</span>
                              {unit.isClone && <span className="designer-item-status designer-item-status--clone">Clone</span>}
                            </div>
                          </div>
                        </div>

                        <button
                          className="designer-add-unit"
                          onClick={() => handleAddUnitToFactory(selectedFactoryId, unit.id)}
                        >
                          + Add
                        </button>
                      </div>
                    ))}
                  {availableUnitsForFactory.length === 0 && (
                    <div className="designer-empty-state">
                      <strong>No matching units</strong>
                      <span>Try another search or faction filter.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </LazyDesignerPage>
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

      {/* Mutation Lab */}
      {showRandomPanel && (
        <div className="mutation-lab-overlay">
          <div className="mutation-lab-modal" role="dialog" aria-modal="true" aria-labelledby="mutation-lab-title">
            <div className="mutation-lab-header">
              <div>
                <span>Guided randomization</span>
                <h3 id="mutation-lab-title">Mutation Lab</h3>
                <p>Generate a controlled variation from each unit’s original values. Every change remains editable and undoable.</p>
              </div>
              <button type="button" className="mutation-lab-close" onClick={() => setShowRandomPanel(false)}>Close</button>
            </div>

            <div className="mutation-lab-body">
              <section className="mutation-lab-section">
                <div className="mutation-lab-section-heading">
                  <span>01</span>
                  <div><strong>Choose scope</strong><small>Decide what the mutation touches.</small></div>
                </div>
                <div className="mutation-choice-grid">
                  <button type="button" className={randomScope === 'selected' ? 'active' : ''} onClick={() => setRandomScope('selected')}>
                    <strong>Selected unit</strong><span>{selectedUnit?.name || 'No unit selected'}</span>
                  </button>
                  <button type="button" className={randomScope === 'filtered' ? 'active' : ''} onClick={() => setRandomScope('filtered')}>
                    <strong>Filtered units</strong><span>{filteredUnits.length.toLocaleString()} units match current filters</span>
                  </button>
                </div>
              </section>

              <section className="mutation-lab-section">
                <div className="mutation-lab-section-heading">
                  <span>02</span>
                  <div><strong>Set volatility</strong><small>Changes are calculated from each original stat.</small></div>
                </div>
                <div className="mutation-intensity-row">
                  {[
                    { id: 'cautious', label: 'Cautious', note: '±10%' },
                    { id: 'balanced', label: 'Balanced', note: '±25%' },
                    { id: 'chaos', label: 'Chaos', note: '±50%' }
                  ].map(option => (
                    <button type="button" key={option.id} className={randomIntensity === option.id ? 'active' : ''} onClick={() => setRandomIntensity(option.id)}>
                      <strong>{option.label}</strong><span>{option.note}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="mutation-lab-section">
                <div className="mutation-lab-section-heading">
                  <span>03</span>
                  <div><strong>Select mutation domains</strong><small>Only checked domains receive a new value.</small></div>
                </div>
                <div className="mutation-domain-grid">
                  {[
                    { id: 'durability', label: 'Durability', note: 'Health' },
                    { id: 'economy', label: 'Economy', note: 'Costs & build time' },
                    { id: 'mobility', label: 'Mobility', note: 'Movement speed' },
                    { id: 'weapons', label: 'Weapons', note: 'Damage, range & reload' }
                  ].map(domain => (
                    <div key={domain.id} className={`mutation-domain-option ${randomDomains[domain.id] ? 'active' : ''}`}>
                      <Switch label={`Mutate ${domain.label}`} checked={randomDomains[domain.id]} onChange={e => setRandomDomains(prev => ({ ...prev, [domain.id]: e.target.checked }))} />
                      <span><strong>{domain.label}</strong><small>{domain.note}</small></span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mutation-lab-actions">
              <span>{randomScope === 'selected' ? 'One unit will be mutated.' : `${filteredUnits.length.toLocaleString()} filtered units will be mutated.`}</span>
              <div>
                <button type="button" className="mutation-cancel" onClick={() => setShowRandomPanel(false)}>Cancel</button>
                <button type="button" className="mutation-apply" onClick={handleRandomAdjustments}>Generate mutation</button>
              </div>
            </div>
          </div>
        </div>
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

      {/* Clone Creator Modal */}
      {showClonePanel && createPortal(
        <div className="clone-creator-overlay" role="presentation">
          <div
            className="panel-card clone-creator-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="clone-creator-title"
            aria-describedby="clone-creator-description"
          >
            <div className="clone-creator-header">
              <span>Unit fork workflow</span>
              <h3 id="clone-creator-title">Clone Unit Creator</h3>
              <p id="clone-creator-description">Create a new editable unit from the selected chassis and assign its initial production sources.</p>
            </div>

            <form onSubmit={handleCreateClone} className="clone-form clone-creator-form">
              <div className="form-group clone-field clone-field--parent">
                <label htmlFor="clone-parent-unit">Parent Unit</label>
                <input
                  id="clone-parent-unit"
                  type="text"
                  className="form-input"
                  value={cloneBaseId}
                  disabled
                />
              </div>

              <div className="form-group clone-field clone-field--id">
                <label htmlFor="clone-new-unit-id">New Unit ID</label>
                <input
                  id="clone-new-unit-id"
                  type="text"
                  className="form-input"
                  placeholder="e.g. armpw_epic"
                  value={cloneNewId}
                  onChange={e => setCloneNewId(e.target.value.toLowerCase())}
                  required
                />
              </div>

              <div className="form-group clone-field clone-field--name">
                <label htmlFor="clone-display-name">Display Name</label>
                <input
                  id="clone-display-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Epic Vanguard pawn"
                  value={cloneName}
                  onChange={e => setCloneName(e.target.value)}
                />
              </div>

              <div className="form-group clone-field clone-field--description">
                <label htmlFor="clone-custom-description">Custom Description</label>
                <input
                  id="clone-custom-description"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Heavy infantry bot with lightning gun"
                  value={cloneDesc}
                  onChange={e => setCloneDesc(e.target.value)}
                />
              </div>

              {cloneBaseId.startsWith('raptor_') && (
                <div className="panel-card clone-source-warning">
                  <div className="clone-source-warning__title">
                    ⚠ Raptor base unit — verify in-game
                  </div>
                  <div className="clone-source-warning__copy">
                    Raptor units are loaded into UnitDefs and should be cloneable. The generated code
                    strips raptor-specific properties (maxthisunit, customparams) that could prevent the
                    clone from appearing in player build menus. Test in-game and adjust if needed.
                  </div>
                </div>
              )}
              {cloneBaseId.startsWith('scav_') && (
                <div className="panel-card clone-source-warning">
                  <div className="clone-source-warning__title">
                    ⚠ Scavenger unit — the clone will use the base unit as source
                  </div>
                  <div className="clone-source-warning__copy">
                    Scavenger units don't exist in UnitDefs at tweakdefs time. The tool will clone from the
                    equivalent base unit (e.g. armflash) instead.
                  </div>
                </div>
              )}
              <div className={`clone-builder-mode ${cloneAutoAssignBuilders ? 'is-active' : ''}`}>
                <Switch
                  label="Automatically assign the clone to its parent unit builders"
                  checked={cloneAutoAssignBuilders}
                  onChange={event => {
                    const enabled = event.target.checked;
                    setCloneAutoAssignBuilders(enabled);
                    setCloneBuilders(enabled ? getAutomaticCloneBuilders(cloneBaseId) : []);
                  }}
                />
                <div>
                  <strong>Auto-assign parent builders</strong>
                  <small>
                    {cloneAutoAssignBuilders
                      ? cloneBuilders.length > 0
                        ? `${cloneBuilders.length} matching ${cloneBuilders.length === 1 ? 'builder' : 'builders'} found in the active Build Menus.`
                        : 'No active Build Menu currently contains the parent unit.'
                      : 'Off by default. The clone starts with no production assignment.'}
                  </small>
                </div>
              </div>
              <div className="form-group clone-field clone-field--builders">
                <label htmlFor="clone-builder-ids">Builder IDs (comma separated)</label>
                <input
                  id="clone-builder-ids"
                  type="text"
                  className="form-input"
                  placeholder="e.g. armlab, armavp"
                  value={cloneBuilders.join(', ')}
                  disabled={cloneAutoAssignBuilders}
                  onChange={e => setCloneBuilders(e.target.value.split(',').map(b => b.trim()))}
                />
                <small>
                  {cloneAutoAssignBuilders
                    ? 'Builder IDs are derived from the parent unit. Turn off auto-assign to enter a custom list.'
                    : 'Optional. Leave empty for an unassigned clone, or enter builder IDs manually.'}
                </small>
              </div>

              <div className="clone-creator-actions">
                <Button type="submit" variant="primary" className="clone-creator-submit">Create Clone</Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setShowClonePanel(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {showBulkPanel && <Suspense fallback={null}><LazyBatchAdjustDialog
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
