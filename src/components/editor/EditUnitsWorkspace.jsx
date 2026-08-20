import { lazy, Suspense, useState } from 'react';
import { getFactionOfUnit } from '../../utils/categories.js';
import {
  getApplicableUnitParameters,
  resolveUnitParameterDefault,
  MOBILITY_STAT_KEYS,
  STAT_KEYS,
  TARGET_CATEGORY_GROUPS,
  UNIT_CATEGORIES as CATEGORIES,
  WORKSPACE_TAB_DEFINITIONS,
} from '../../config/editorParameters.js';
import {
  getApplicableWeaponParameters,
  getWeaponParameterDefinition,
  getTriStateControlValue,
  getSpecialProjectileBehavior,
  getSpecialProjectileParameters,
  SPECIAL_PROJECTILE_PARAMETER_KEYS,
  WEAPON_ADVANCED_GROUPS,
  WEAPON_ASSET_TYPES,
  WEAPON_CORE_PARAMETERS,
  WEAPON_TARGET_MASK_PARAMETERS,
} from '../../config/weaponParameters.js';
import { Button, ParameterStatus, SectionHeader, Switch, StatCard } from '../ui.jsx';
import EditorShell from './EditorShell.jsx';
import UnitLibraryPane from './UnitLibraryPane.jsx';
import VirtualizedUnitList from './VirtualizedUnitList.jsx';
import CollectionScopePicker from './CollectionScopePicker.jsx';
import UnitCommandBar from './UnitCommandBar.jsx';
import ParameterCanvas, { ParameterMatrix } from './ParameterCanvas.jsx';
import InheritedBooleanControl from './InheritedBooleanControl.jsx';
import UnitParameterViewControl from './UnitParameterViewControl.jsx';
import EditorInspector from './EditorInspector.jsx';
import {
  ComparisonValue,
  ParameterGuide,
  ParameterHelp,
  ParameterRelationshipPanel,
} from './ParameterGuidance.jsx';
import {
  getParameterHelp,
  getParameterRelationship,
  getRelationshipLabel,
} from '../../config/parameterGuidance.js';
import AssetPicker from './AssetPicker.jsx';
import UnitDescriptionEditor from './UnitDescriptionEditor.jsx';
import GadgetContractSummary from './GadgetContractSummary.jsx';
import ArmorDamageEditor from './ArmorDamageEditor.jsx';
import { WEAPON_CLUSTER_RECIPES } from '../../utils/weaponClusterRecipes.js';

const LazyBehaviorInterceptorEditor = lazy(() => import('./BehaviorInterceptorEditor.jsx'));
const LazyAdvancedCustomParameters = lazy(() => import('./AdvancedCustomParameters.jsx'));

export default function EditUnitsWorkspace({ context }) {
  const {
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
  } = context;
  const [selectedCompiledField, setSelectedCompiledField] = useState('');
  const [compiledOutputView, setCompiledOutputView] = useState('command');
  const compiledOutputSlots = compiledLobbyModules?.slots || [];
  const selectedCompiledSlot = compiledOutputSlots.find(slot => slot.fieldName === selectedCompiledField)
    || compiledOutputSlots[0]
    || null;
  const selectedCompiledValue = selectedCompiledSlot
    ? compiledOutputView === 'lua'
      ? selectedCompiledSlot.lua
      : compiledOutputView === 'base64'
        ? selectedCompiledSlot.encoded
        : selectedCompiledSlot.command
    : '';
  const compiledOutputFallback = compiledLobbyModules?.overflow
    ? 'Modern lobby compilation is blocked. Resolve the slot or byte-budget overflow in Review & Export.'
    : 'No numbered lobby fields are currently generated.';
  const activeUnitFilterCount = (
    (searchQuery.trim() ? 1 : 0)
    + (selectedFaction !== 'all' ? 1 : 0)
    + selectedCats.length
    + (showModifiedOnly ? 1 : 0)
  );
  const inspectorParameterStatus = (() => {
    if (!selectedUnit || !activeRelationshipKey) return null;
    const parameterKey = activeRelationshipKey.replace(/^weapon_slot_\d+_/, '');
    const isWeaponParameter = activeParamTab === 'weapons';
    const parameter = isWeaponParameter
      ? getWeaponParameterDefinition(parameterKey)
      : STAT_KEYS.find(item => item.key === parameterKey);
    if (!parameter) return null;

    const baseId = selectedUnit.isClone ? resolveCloneRootId(selectedUnit.id) : selectedUnit.id;
    const defaults = selectedUnitDefaults || defaultsDb[baseId] || {};
    if (!isWeaponParameter) {
      const resolution = resolveUnitParameterDefault(parameter, defaults);
      return {
        modified: Object.prototype.hasOwnProperty.call(tweaks[selectedUnit.id] || {}, parameter.key),
        source: !selectedUnit.isClone && resolution.source === 'unit' ? 'bar' : 'inherited',
        capabilityIds: parameter.capabilities,
        generated: parameter.output === 'tweakdefs',
      };
    }

    const slots = defaults.weaponSlots || [];
    const slot = slots.find(item => item.slot === activeWeaponSlotTab) || slots[0];
    const tweakKey = slot ? `weapon_slot_${slot.slot}_${parameter.key}` : '';
    const cloneInfo = selectedUnit.isClone
      ? clones.find(clone => clone.newId.toLowerCase() === selectedUnit.id.toLowerCase())
      : null;
    const swap = cloneInfo && slot
      ? getInheritedCloneWeaponSwaps(selectedUnit.id)?.[String(slot.slot)]
      : null;
    return {
      modified: Boolean(tweakKey && Object.prototype.hasOwnProperty.call(tweaks[selectedUnit.id] || {}, tweakKey)),
      source: swap || (!selectedUnit.isClone && slot && Object.prototype.hasOwnProperty.call(slot, parameter.key))
        ? 'bar'
        : 'inherited',
      capabilityIds: parameter.capabilities,
      generated: Boolean(swap?.libraryWeaponId),
      external: Boolean(swap?.sourceUnitId && !defaultsDb[resolveCloneRootId(swap.sourceUnitId)]),
    };
  })();
  const selectedClone = selectedUnit?.isClone
    ? clones.find(clone => clone.newId.toLowerCase() === selectedUnit.id.toLowerCase())
    : null;
  const comparisonEntries = selectedUnitOverrideEntries.map(([tweakKey, currentValue], index) => {
    const weaponMatch = tweakKey.match(/^weapon_slot_(\d+)_(.+)$/);
    const slotNumber = weaponMatch ? Number(weaponMatch[1]) : null;
    const parameterKey = weaponMatch ? weaponMatch[2] : tweakKey;
    const parameter = weaponMatch
      ? getWeaponParameterDefinition(parameterKey)
      : STAT_KEYS.find(item => item.key === parameterKey);
    let inheritedValue;

    if (weaponMatch) {
      inheritedValue = selectedUnitDefaults?.weaponSlots
        ?.find(item => Number(item.slot) === slotNumber)?.[parameterKey];
    } else if (parameter) {
      const resolution = resolveUnitParameterDefault(parameter, selectedUnitDefaults || {});
      inheritedValue = resolution.value ?? resolution.label;
    } else {
      inheritedValue = selectedUnitDefaults?.[parameterKey];
    }

    const formatValue = value => {
      if (value === undefined || value === null || value === '') return 'Inherited';
      if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
      if (Array.isArray(value)) return value.join(', ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    };

    return {
      id: tweakKey,
      index: index + 1,
      parameterKey,
      slotNumber,
      label: getRelationshipLabel(parameterKey).replace(/([a-z0-9])([A-Z])/g, '$1 $2'),
      scope: weaponMatch ? `Weapon slot ${slotNumber}` : 'Unit parameter',
      inherited: formatValue(inheritedValue),
      current: formatValue(currentValue),
    };
  });
  const comparisonWeaponCount = comparisonEntries.filter(entry => entry.slotNumber !== null).length;
  const comparisonUnitCount = comparisonEntries.length - comparisonWeaponCount;
  const inspectComparisonEntry = entry => {
    const targetTab = entry.slotNumber !== null
      ? 'weapons'
      : MOBILITY_STAT_KEYS.has(entry.parameterKey) ? 'mobility' : 'structure';
    setActiveParamTab(targetTab);
    if (entry.slotNumber !== null) setActiveWeaponSlotTab(entry.slotNumber);
    setActiveRelationshipKey(entry.parameterKey);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const panel = document.getElementById(`workspace-panel-${targetTab}`);
      const target = panel?.querySelector(`[data-param-key="${entry.parameterKey}"]`);
      target?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      target?.querySelector('input, select, button')?.focus({ preventScroll: true });
    }));
  };
  return (
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
            <div className="unit-library-search">
              <label htmlFor="unit-library-search">Find a unit</label>
              <div className="search-wrapper">
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <circle cx="8.5" cy="8.5" r="4.75" />
                  <path d="m12 12 4 4" />
                </svg>
                <input
                  id="unit-library-search"
                  type="text"
                  className="search-input"
                  placeholder="Search unit name, ID, or stat..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="stat-search-query-tip">
                Query format: <code>hp &gt; 3000</code> or <code>speed &lt; 50</code>
              </div>
            </div>

            <details className="unit-filter-disclosure">
              <summary>
                <span>Filter library</span>
                <span className="unit-filter-disclosure__count">
                  {activeUnitFilterCount ? `${activeUnitFilterCount} active` : 'All units'}
                </span>
                <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4" /></svg>
              </summary>
              <div className="unit-filter-disclosure__body">
                <div className="unit-filter-group">
                  <div className="sidebar-filter-label">Faction</div>
                  <div className="faction-tabs" role="group" aria-label="Faction filters">
                    {[
                      { id: 'all', label: 'All' },
                      { id: 'arm', label: 'Armada', image: '/factions/armada.png' },
                      { id: 'cor', label: 'Cortex', image: '/factions/cortex.png' },
                      { id: 'leg', label: 'Legion', image: '/factions/legion.png' },
                      { id: 'rap', label: 'Raptors' },
                      { id: 'scav', label: 'Scavs' },
                    ].map(faction => (
                      <button
                        type="button"
                        key={faction.id}
                        className={`faction-tab ${selectedFaction === faction.id ? 'active' : ''}`}
                        onClick={() => setSelectedFaction(faction.id)}
                        aria-pressed={selectedFaction === faction.id}
                      >
                        {faction.image && <img src={faction.image} alt="" />}
                        <span>{faction.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="unit-filter-group">
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
                </div>

                <div className="filter-actions">
                  <button
                    className={`filter-action-btn ${showModifiedOnly ? 'active' : ''}`}
                    onClick={() => setShowModifiedOnly(prev => !prev)}
                    title="Show changed, disabled, and cloned units"
                    aria-pressed={showModifiedOnly}
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
              </div>
            </details>
          </div>

          <div className="unit-results-bar" aria-live="polite">
            <div>
              <span>Available units</span>
              <strong>{filteredUnits.length.toLocaleString()}</strong>
            </div>
            {activeCollection ? (
              <span className="unit-results-bar__context">{activeCollection.name}</span>
            ) : hasActiveUnitFilters ? (
              <span className="unit-results-bar__context">Filtered view</span>
            ) : (
              <span className="unit-results-bar__context">Complete catalog</span>
            )}
          </div>

          <VirtualizedUnitList
            units={filteredUnits}
            selectedUnitId={selectedUnitId}
            modifiedUnitIds={modifiedUnitIds}
            disabledUnitIds={disabledUnitIds}
            getUnitIconUrl={getProjectUnitIconUrl}
            onSelectUnit={setSelectedUnitId}
            onClearFilters={clearUnitFilters}
            resetKey={`${activeCollectionId || 'all'}|${searchQuery}|${selectedFaction}|${selectedCats.join(',')}|${showModifiedOnly}`}
          />
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

            const slotParams = WEAPON_CORE_PARAMETERS;
            const advancedWeaponGroups = WEAPON_ADVANCED_GROUPS;
            const activeSlotTweaks = tweaks[selectedUnit.id] || {};
            const selectedArmorProfile = activeSlotTweaks['customparams.armordef']
              ?? defaults['customparams.armordef']
              ?? '';
            const armorDamageValues = slot ? Object.fromEntries(
              Object.entries(slot).filter(([key]) => key.startsWith('damage_profile__'))
            ) : {};
            const armorDamageTweaks = slot ? Object.fromEntries(
              Object.entries(activeSlotTweaks)
                .filter(([key]) => key.startsWith(`weapon_slot_${slot.slot}_damage_profile__`))
                .map(([key, value]) => [key.slice(`weapon_slot_${slot.slot}_`.length), value])
            ) : {};
            const hasWeaponParameter = key => slot && (
              Object.prototype.hasOwnProperty.call(slot, key)
              || Object.prototype.hasOwnProperty.call(activeSlotTweaks, `weapon_slot_${slot.slot}_${key}`)
            );
            const applicableSlotParams = getApplicableWeaponParameters(slotParams, {
              showAll: showAllWeaponParams,
              hasParameter: hasWeaponParameter,
              includeEssential: true,
            });
            const activeSpecialProjectileValue = slot
              ? String(
                activeSlotTweaks[`weapon_slot_${slot.slot}_speceffect`]
                  ?? slot.speceffect
                  ?? ''
              ).trim().toLowerCase()
              : '';
            const applicableAdvancedWeaponGroups = advancedWeaponGroups
              .map(group => {
                const groupParameters = group.kind === 'special-projectile'
                  ? getSpecialProjectileParameters(activeSpecialProjectileValue)
                  : group.params;
                return {
                  ...group,
                  params: getApplicableWeaponParameters(groupParameters, {
                  showAll: showAllWeaponParams,
                  hasParameter: hasWeaponParameter,
                }),
                };
              })
              .filter(group => group.params.length > 0 || group.kind === 'cluster');
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
                  descriptionEdited={Object.hasOwn(unitDescriptions, selectedUnit.id)}
                  disabled={unitIsDisabled}
                  onDisabledChange={nextDisabled => {
                    if (nextDisabled) setDisabledUnitIds(previous => [...new Set([...previous, selectedUnit.id])]);
                    else setDisabledUnitIds(previous => previous.filter(id => id !== selectedUnit.id));
                  }}
                  onReset={() => handleResetUnit(selectedUnit.id)}
                  onOpenDescription={() => {
                    workspaceLayout.setInspectorTab('details');
                    workspaceLayout.setRightCollapsed(false);
                    requestAnimationFrame(() => {
                      document.getElementById('selected-unit-description')?.focus();
                    });
                  }}
                  onOpenIdentity={() => {
                    workspaceLayout.setInspectorTab('details');
                    workspaceLayout.setRightCollapsed(false);
                    requestAnimationFrame(() => {
                      document.getElementById('clone-identity-display-name')?.focus();
                    });
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
                    <span className="operational-overview__eyebrow">Selected chassis</span>
                    <h2 id="operational-overview-title">Operational overview</h2>
                    <small>Live performance and weapon telemetry</small>
                  </header>

                  <div className="operational-overview__modules">

                  {/* Efficiency Analysis Card */}
                  <article className="unit-context-card unit-efficiency-card">
                    <header className="unit-context-card__header">
                      <div>
                        <span className="unit-context-label">Efficiency</span>
                        <small>Cost, damage, and durability</small>
                      </div>
                      <span className="unit-context-card__status">Live</span>
                    </header>
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
                        { label: 'Cost / HP', value: costPerHp, unit: 'm' },
                        { label: 'DPS / 100m', value: dpsPerMetal, unit: '' },
                        { label: 'HP / Build-s', value: buildEfficiency, unit: '' }
                      ];
                      return (
                        <dl className="unit-efficiency-metrics">
                          {effRows.map(r => (
                            <div className="unit-efficiency-metric" key={r.label}>
                              <dt>{r.label}</dt>
                              <dd>
                                {r.value}<small> {r.unit}</small>
                              </dd>
                            </div>
                          ))}
                        </dl>
                      );
                    })()}
                  </article>

                  {/* Weapon Slot Nodes Selector List */}
                    <article className="unit-context-card unit-weapon-card">
                      <header className="unit-context-card__header">
                        <div>
                          <span className="unit-context-label">Weapon hardpoints</span>
                          <small>{slots.length > 0 ? `${slots.length} mounted ${slots.length === 1 ? 'definition' : 'definitions'}` : 'No mounted definitions'}</small>
                        </div>
                        <span className="unit-context-card__status">{slots.length}</span>
                      </header>
                      {slots.length > 0 ? (
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
                      ) : (
                        <p className="unit-context-empty">This chassis has no editable weapon slots.</p>
                      )}
                    </article>

                  {/* Current weapon firing profile */}
                    <article className="unit-context-card unit-trajectory-card">
                      <header className="unit-context-card__header">
                        <div>
                          <span className="unit-context-label">Firing profile</span>
                          <small>{slot ? `Slot ${slot.slot} · ${slot.defKey}` : 'No active weapon selected'}</small>
                        </div>
                        <span className="unit-context-card__status">{slot ? 'Active' : 'Empty'}</span>
                      </header>
                      {slot ? (
                      <div className="unit-trajectory-copy">
                        <dl className="unit-trajectory-values">
                          <div>
                            <dt>DPS</dt>
                            <dd>
                              {calculatedDps} <small>/s</small>
                            </dd>
                          </div>
                          <div>
                            <dt>Range</dt>
                            <dd>
                              {rawRange} <small>el</small>
                            </dd>
                          </div>
                          <div>
                            <dt>Spread</dt>
                            <dd>{rawSpray > 0 ? `${rawSpray}°` : 'Direct'}</dd>
                          </div>
                        </dl>
                      </div>
                      ) : (
                        <p className="unit-context-empty">Select a hardpoint to inspect its firing data.</p>
                      )}
                    </article>

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
                        isParameterModified={stat => tweaks[selectedUnit.id]?.[stat.key] !== undefined}
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
                                  {stat.unit && <small className="parameter-card-unit">{stat.unit}</small>}
                                </span>
                                <span className="parameter-card-status">
                                  {diffPercent !== null && (
                                    <span className={`stat-card-diff ${diffPercent >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                                      {diffPercent >= 0 ? '+' : ''}{diffPercent}%
                                    </span>
                                  )}
                                  <ParameterStatus
                                    modified={isModified}
                                    source={!selectedUnit.isClone && defaultResolution.source === 'unit' ? 'bar' : 'inherited'}
                                    capabilityIds={stat.capabilities}
                                    generated={stat.output === 'tweakdefs'}
                                  />
                                </span>
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
                      <Suspense fallback={<div className="feature-loading-state">Loading advanced custom parameters…</div>}>
                        <LazyAdvancedCustomParameters
                          defaults={defaults}
                          tweaks={tweaks[selectedUnit.id] || {}}
                          allUnitsList={allUnitsList}
                          defaultsDb={defaultsDb}
                          inheritedFromClone={selectedUnit.isClone}
                          onChange={(key, value) => handleStatChange(selectedUnit.id, key, value)}
                          onApplyProfile={patch => handleStatPatch(selectedUnit.id, patch)}
                        />
                      </Suspense>
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
                        isParameterModified={stat => tweaks[selectedUnit.id]?.[stat.key] !== undefined}
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
                                  {stat.unit && <small className="parameter-card-unit">{stat.unit}</small>}
                                </span>
                                <span className="parameter-card-status">
                                  {diffPercent !== null && (
                                    <span className={`stat-card-diff ${diffPercent >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                                      {diffPercent >= 0 ? '+' : ''}{diffPercent}%
                                    </span>
                                  )}
                                  <ParameterStatus
                                    modified={isModified}
                                    source={!selectedUnit.isClone && defaultResolution.source === 'unit' ? 'bar' : 'inherited'}
                                    capabilityIds={stat.capabilities}
                                    generated={stat.output === 'tweakdefs'}
                                  />
                                </span>
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
                                      {swap?.libraryWeaponId ? 'Custom' : swap ? 'Borrowed' : 'Original'}
                                    </span>
                                  </div>
                                  {swap ? (
                                    <div className="weapon-substitution-route">
                                      <code>{(originalSlot?.defKey || slot.defKey).toUpperCase()}</code>
                                      <span aria-hidden="true">→</span>
                                      <code>{swap.libraryWeaponId ? `CUSTOM:${swap.libraryWeaponId}` : swap.sourceWeaponDefKey.toUpperCase()}</code>
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

                          <ArmorDamageEditor
                            values={{ ...armorDamageValues, ...armorDamageTweaks }}
                            modifiedValues={armorDamageTweaks}
                            linkedProfiles={selectedArmorProfile ? [selectedArmorProfile] : []}
                            onChange={(key, value) => handleStatChange(selectedUnit.id, `weapon_slot_${slot.slot}_${key}`, value)}
                            compact
                          />

                          <ParameterMatrix
                            sectionId={`weapon-slot-${slot.slot}`}
                            parameters={applicableSlotParams}
                            collapsedGroups={workspaceLayout.layout.collapsedGroups}
                            onToggleGroup={workspaceLayout.toggleGroup}
                            isParameterModified={param => (
                              tweaks[selectedUnit.id]?.[`weapon_slot_${slot.slot}_${param.key}`] !== undefined
                            )}
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
                                    <span>
                                      {param.label}
                                      <ParameterHelp paramKey={param.key} label={param.label} onOpen={() => {
                                        setActiveRelationshipKey(param.key);
                                        workspaceLayout.setInspectorTab('details');
                                        workspaceLayout.setRightCollapsed(false);
                                      }} />
                                      {param.unit && <small className="parameter-card-unit">{param.unit}</small>}
                                    </span>
                                    <span className="parameter-card-status">
                                      {diffPercent !== null && (
                                        <span className={`stat-card-diff ${diffPercent >= 0 ? 'diff-positive' : 'diff-negative'}`}>
                                          {diffPercent >= 0 ? '+' : ''}{diffPercent}%
                                        </span>
                                      )}
                                      <ParameterStatus
                                        modified={isModified}
                                        source={swap || (!selectedUnit.isClone && Object.prototype.hasOwnProperty.call(slot, param.key)) ? 'bar' : 'inherited'}
                                        capabilityIds={param.capabilities}
                                        generated={Boolean(swap?.libraryWeaponId)}
                                      />
                                    </span>
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
                            {applicableAdvancedWeaponGroups.map(group => {
                              const specialProjectileValue = group.kind === 'special-projectile'
                                ? (activeSlotTweaks[`weapon_slot_${slot.slot}_speceffect`] ?? slot.speceffect ?? '')
                                : '';
                              const specialProjectileBehavior = getSpecialProjectileBehavior(specialProjectileValue);
                              const specialProjectileHasOverrides = group.kind === 'special-projectile'
                                && ['speceffect', ...SPECIAL_PROJECTILE_PARAMETER_KEYS].some(key => (
                                  activeSlotTweaks[`weapon_slot_${slot.slot}_${key}`] !== undefined
                                ));
                              const changeSpecialProjectileBehavior = nextValue => {
                                const nextBehavior = getSpecialProjectileBehavior(nextValue);
                                handleStatChange(
                                  selectedUnit.id,
                                  `weapon_slot_${slot.slot}_speceffect`,
                                  nextBehavior?.id
                                );
                                const retainedKeys = new Set(nextBehavior?.parameterKeys || []);
                                SPECIAL_PROJECTILE_PARAMETER_KEYS
                                  .filter(key => !retainedKeys.has(key))
                                  .forEach(key => handleStatChange(
                                    selectedUnit.id,
                                    `weapon_slot_${slot.slot}_${key}`,
                                    undefined
                                  ));
                              };
                              const applySectorFireBaseline = () => {
                                changeSpecialProjectileBehavior('sector_fire');
                                handleStatChange(
                                  selectedUnit.id,
                                  `weapon_slot_${slot.slot}_spread_angle`,
                                  activeSlotTweaks[`weapon_slot_${slot.slot}_spread_angle`] ?? slot.spread_angle ?? 22
                                );
                                handleStatChange(
                                  selectedUnit.id,
                                  `weapon_slot_${slot.slot}_max_range_reduction`,
                                  activeSlotTweaks[`weapon_slot_${slot.slot}_max_range_reduction`] ?? slot.max_range_reduction ?? 0.3
                                );
                                handleStatChange(selectedUnit.id, `weapon_slot_${slot.slot}_accuracy`, 0);
                                handleStatChange(selectedUnit.id, `weapon_slot_${slot.slot}_sprayangle`, 0);
                              };
                              const resetSpecialProjectileSetup = () => {
                                const keys = ['speceffect', ...SPECIAL_PROJECTILE_PARAMETER_KEYS];
                                if (specialProjectileValue === 'sector_fire') keys.push('accuracy', 'sprayangle');
                                keys
                                  .forEach(key => handleStatChange(
                                    selectedUnit.id,
                                    `weapon_slot_${slot.slot}_${key}`,
                                    undefined
                                  ));
                              };
                              const applyClusterRecipe = recipeId => {
                                handleApplyWeaponClusterRecipe({
                                  recipeId,
                                  unitId: selectedUnit.id,
                                  slotNumber: slot.slot,
                                  sourceSlot: slot,
                                });
                              };
                              return (
                              <section
                                className={`weapon-advanced-group ${group.kind === 'special-projectile' ? 'weapon-special-projectile' : ''}`}
                                key={group.title}
                              >
                                <div className="weapon-advanced-group-heading">
                                  <div className="weapon-advanced-group-heading__copy">
                                    <span className="weapon-advanced-group-heading__title">{group.title}</span>
                                    <small>{specialProjectileBehavior?.description || group.description}</small>
                                  </div>
                                  {group.kind === 'special-projectile' && (
                                    <div className="weapon-advanced-group-heading__actions">
                                      <span className="section-heading__meta">
                                        {specialProjectileBehavior?.summary || 'Standard / inherited'}
                                      </span>
                                      <div className="ui-button-group">
                                        {specialProjectileValue === 'sector_fire' && (
                                          <Button size="sm" variant="primary" onClick={applySectorFireBaseline}>
                                            Apply Tremor baseline
                                          </Button>
                                        )}
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          disabled={!specialProjectileBehavior && !specialProjectileHasOverrides}
                                          onClick={resetSpecialProjectileSetup}
                                        >
                                          Reset behavior
                                        </Button>
                                      </div>
                                    </div>
                                  )}
                                  {group.kind === 'cluster' && (
                                    <div className="weapon-advanced-group-heading__actions">
                                      <span className="section-heading__meta">Preset library</span>
                                      <div className="weapon-cluster-recipe-palette" role="group" aria-label="Cluster recipe presets">
                                        {[
                                          ['combat', 'Gameplay'],
                                          ['visual', 'Visual only'],
                                        ].map(([kind, label]) => (
                                          <div className="weapon-cluster-recipe-palette__group" key={kind}>
                                            <span className="weapon-cluster-recipe-palette__label">{label}</span>
                                            <div className="weapon-cluster-recipe-palette__grid">
                                              {Object.values(WEAPON_CLUSTER_RECIPES)
                                                .filter(recipe => recipe.kind === kind)
                                                .map(recipe => (
                                                  <Button key={recipe.id} size="sm" variant="secondary" title={recipe.description} onClick={() => applyClusterRecipe(recipe.id)}>
                                                    {recipe.label}
                                                  </Button>
                                                ))}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                                {group.params.length > 0 && (
                                <div className="editor-grid weapon-parameter-grid weapon-advanced-grid">
                                  {group.params.map(param => {
                                    const tweakKey = `weapon_slot_${slot.slot}_${param.key}`;
                                    const currentTweakValue = tweaks[selectedUnit.id]?.[tweakKey];
                                    const isModified = currentTweakValue !== undefined;
                                    const defaultVal = slot[param.key];
                                    const displayValue = isModified ? currentTweakValue : (defaultVal !== undefined ? defaultVal : '');
                                    const warning = getValidationWarning(tweakKey, displayValue);
                                    return (
                                      <div
                                        key={param.key}
                                        className={`stat-card stat-card--advanced ${isModified ? 'modified' : ''} ${warning ? `is-${warning.level}` : ''} ${getRelationshipStateClass(param.key)}`}
                                        data-param-key={param.key}
                                        data-param-unit={param.unit || undefined}
                                        onFocusCapture={() => setActiveRelationshipKey(param.key)}
                                        onClick={() => setActiveRelationshipKey(param.key)}
                                      >
                                        <div className="stat-card-label">
                                          <span>
                                            {param.label}
                                            <ParameterHelp paramKey={param.key} label={param.label} onOpen={() => {
                                              setActiveRelationshipKey(param.key);
                                              workspaceLayout.setInspectorTab('details');
                                              workspaceLayout.setRightCollapsed(false);
                                            }} />
                                            {param.unit && <small className="parameter-card-unit">{param.unit}</small>}
                                          </span>
                                          <span className="parameter-card-status">
                                            {param.danger && <span className="stat-card-diff diff-negative">Caution</span>}
                                            <ParameterStatus
                                              modified={isModified}
                                              source={swap || (!selectedUnit.isClone && Object.prototype.hasOwnProperty.call(slot, param.key)) ? 'bar' : 'inherited'}
                                              capabilityIds={param.capabilities}
                                              generated={Boolean(swap?.libraryWeaponId)}
                                            />
                                          </span>
                                        </div>
                                        <div className="stat-card-input-wrapper">
                                          {param.type === 'tri-state' ? (
                                            <select
                                              className="stat-card-input"
                                              value={getTriStateControlValue(param, displayValue)}
                                              onChange={e => handleStatChange(
                                                selectedUnit.id,
                                                tweakKey,
                                                e.target.value === ''
                                                  ? undefined
                                                  : param.valueEncoding === 'numeric-boolean'
                                                    ? (e.target.value === 'true' ? 1 : 0)
                                                    : e.target.value,
                                              )}
                                            >
                                              <option value="">Inherited</option>
                                              <option value="true">Enabled</option>
                                              <option value="false">Disabled</option>
                                            </select>
                                          ) : param.options && (
                                            displayValue === ''
                                            || param.options.some(option => String(option) === String(displayValue))
                                          ) ? (
                                            <select
                                              className={`stat-card-input ${warning ? `is-${warning.level}` : ''}`}
                                              value={displayValue}
                                              onChange={e => {
                                                if (param.key === 'speceffect') {
                                                  changeSpecialProjectileBehavior(e.target.value);
                                                  return;
                                                }
                                                handleStatChange(selectedUnit.id, tweakKey, e.target.value === '' ? undefined : e.target.value);
                                              }}
                                            >
                                              {param.options.map(option => (
                                                <option key={option || 'inherited'} value={option}>
                                                  {param.optionLabels?.[option] || option || 'Inherited'}
                                                </option>
                                              ))}
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
                                              className={`stat-card-input ${warning ? `is-${warning.level}` : ''}`}
                                              value={displayValue}
                                              min={param.min}
                                              max={param.max}
                                              step={param.step}
                                              placeholder={defaultVal !== undefined ? String(defaultVal) : 'Inherited'}
                                              onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value)}
                                            />
                                          )}
                                          {isModified && (
                                            <button
                                              type="button"
                                              className="stat-card-default-pill"
                                              aria-label={`Reset ${param.label}`}
                                              title="Reset to inherited value"
                                              onClick={() => handleStatChange(selectedUnit.id, tweakKey, undefined)}
                                            >
                                              ×
                                            </button>
                                          )}
                                        </div>
                                        {warning && (
                                          <div className={`stat-card-warning is-${warning.level}`}>
                                            {warning.message}
                                          </div>
                                        )}
                                        <ComparisonValue active={comparisonMode && isModified} before={defaultVal} after={currentTweakValue} />
                                      </div>
                                    );
                                  })}
                                </div>
                                )}
                              </section>
                              );
                            })}
                          </div>

                          {/* Target Category Masks */}
                          {(() => {
                            const catFields = WEAPON_TARGET_MASK_PARAMETERS;
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
                                          <span className="target-filter-helper">{cf.description}</span>
                                          <ParameterStatus
                                            modified={isModified}
                                            source={swap || (!selectedUnit.isClone && Object.prototype.hasOwnProperty.call(slot, cf.key)) ? 'bar' : 'inherited'}
                                            generated={Boolean(swap?.libraryWeaponId)}
                                          />
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
                <section className="inspector-intro inspector-context-lead">
                  <span>Selected parameter</span>
                  <h3>{activeRelationshipKey ? getRelationshipLabel(activeRelationshipKey) : 'Choose a parameter'}</h3>
                  <p>{activeRelationshipKey
                    ? getParameterHelp(activeRelationshipKey, getRelationshipLabel(activeRelationshipKey))
                    : 'Open a help control or select a relationship to inspect its behavior and connected values.'}</p>
                  {inspectorParameterStatus && (
                    <ParameterStatus {...inspectorParameterStatus} detailed />
                  )}
                </section>
                {selectedClone && (
                  <section className="inspector-section-card inspector-identity-section" aria-labelledby="clone-identity-heading">
                    <div className="inspector-identity-heading">
                      <div>
                        <span>Clone profile</span>
                        <h3 id="clone-identity-heading">Identity &amp; production</h3>
                      </div>
                      <small>{selectedClone.builderIds?.length || 0} producer{selectedClone.builderIds?.length === 1 ? '' : 's'}</small>
                    </div>
                    <p className="inspector-identity-copy">Display metadata and production assignments stay synchronized with Build Menus and generated clone definitions.</p>
                    <dl className="inspector-identity-reference">
                      <div><dt>Unit ID</dt><dd><code>{selectedClone.newId}</code></dd></div>
                      <div><dt>Source chassis</dt><dd><code>{selectedClone.baseId}</code></dd></div>
                    </dl>
                    <div className="inspector-form-grid inspector-identity-form">
                      <label htmlFor="clone-identity-display-name">
                        <span>Display name</span>
                        <input
                          id="clone-identity-display-name"
                          type="text"
                          className="form-input"
                          value={selectedClone.displayName || ''}
                          onChange={event => setClones(previous => previous.map(clone => clone.newId.toLowerCase() === selectedUnit.id.toLowerCase()
                            ? { ...clone, displayName: event.target.value }
                            : clone))}
                        />
                      </label>
                      <label htmlFor="clone-identity-builder-ids">
                        <span>Builder and factory IDs</span>
                        <input
                          id="clone-identity-builder-ids"
                          type="text"
                          className="form-input"
                          value={selectedClone.builderIds?.join(', ') || ''}
                          placeholder="e.g. armlab, armvp"
                          aria-describedby="clone-identity-builder-help"
                          onChange={event => handleCloneBuildersChange(selectedUnit.id, event.target.value.split(','))}
                        />
                        <small id="clone-identity-builder-help">Comma separated · changes also appear in Build Menus.</small>
                      </label>
                    </div>
                  </section>
                )}
                <GadgetContractSummary results={selectedGadgetContracts} />
                <ParameterGuide section={activeParamTab} />
                <ParameterRelationshipPanel
                  section={activeParamTab}
                  activeKey={activeRelationshipKey}
                  onSelect={selectInspectorParameter}
                  onClear={() => setActiveRelationshipKey(null)}
                />
                {selectedUnit && (
                  <UnitDescriptionEditor
                    unitId={selectedUnit.id}
                    unitName={selectedUnit.name}
                    inheritedDescription={selectedUnit.baseDesc}
                    value={unitDescriptions[selectedUnit.id] || ''}
                    onCommit={updateSelectedUnitDescription}
                  />
                )}
              </div>
            ),
            compare: (
              <div className="inspector-panel-stack inspector-compare-panel">
                <section className="inspector-compare-summary" aria-labelledby="inspector-compare-heading">
                  <div className="inspector-compare-summary__copy">
                    <span>Selected unit baseline</span>
                    <h3 id="inspector-compare-heading">{comparisonEntries.length} active override{comparisonEntries.length === 1 ? '' : 's'}</h3>
                    <p>Review what changed, where it applies, and the inherited BAR value it replaces.</p>
                  </div>
                  <dl className="inspector-compare-metrics" aria-label="Override summary">
                    <div><dt>Unit</dt><dd>{comparisonUnitCount}</dd></div>
                    <div><dt>Weapon</dt><dd>{comparisonWeaponCount}</dd></div>
                    <div><dt>Canvas</dt><dd>{comparisonMode ? 'On' : 'Off'}</dd></div>
                  </dl>
                  <Button
                    className="inspector-compare-toggle"
                    variant={comparisonMode ? 'secondary' : 'primary'}
                    fullWidth
                    aria-pressed={comparisonMode}
                    onClick={() => setComparisonMode(current => !current)}
                  >
                    {comparisonMode ? 'Hide canvas comparison' : 'Show differences on canvas'}
                  </Button>
                </section>
                <section className="inspector-compare-section" aria-labelledby="changed-fields-heading">
                  <div className="inspector-compare-section__heading">
                    <div>
                      <span>Change ledger</span>
                      <h3 id="changed-fields-heading">Changed fields</h3>
                    </div>
                    <small>{comparisonEntries.length} total</small>
                  </div>
                  {comparisonEntries.length > 0 ? (
                    <div className="inspector-compare-list">
                      {comparisonEntries.map(entry => (
                        <button
                          type="button"
                          key={entry.id}
                          onClick={() => inspectComparisonEntry(entry)}
                          aria-label={`Inspect ${entry.label}, changed from ${entry.inherited} to ${entry.current}`}
                        >
                          <span className="inspector-compare-item__heading">
                            <small>{String(entry.index).padStart(2, '0')}</small>
                            <span>
                              <strong>{entry.label}</strong>
                              <small>{entry.scope}</small>
                            </span>
                          </span>
                          <span className="inspector-compare-values">
                            <span>
                              <small>Inherited</small>
                              <code title={entry.inherited}>{entry.inherited}</code>
                            </span>
                            <span className="is-current">
                              <small>Current</small>
                              <code title={entry.current}>{entry.current}</code>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="inspector-compare-empty">
                      <strong>No overrides to compare</strong>
                      <p>This unit still uses its inherited BAR values.</p>
                      <Button variant="secondary" size="sm" onClick={() => workspaceLayout.setInspectorTab('details')}>Open parameter details</Button>
                    </div>
                  )}
                </section>
                {activeCollection && (
                  <section className="inspector-compare-section inspector-compare-collection">
                    <div className="inspector-compare-section__heading">
                      <div>
                        <span>Collection scope</span>
                        <h3>{activeCollection.name}</h3>
                      </div>
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
              </div>
            ),
            changes: (
              <div className="editor-inspector-changes">
                <div className="changes-context-summary">
                  <div className="changes-context-summary__identity">
                    <span>{activeCollection ? 'Collection ledger' : 'Project ledger'}</span>
                    <strong>{activeCollection
                      ? `${activeCollectionModifiedCount} edited member${activeCollectionModifiedCount === 1 ? '' : 's'}`
                      : `${projectChangeCount} tracked change${projectChangeCount === 1 ? '' : 's'}`}</strong>
                    <small>Review scope, export contents, validation, and generated output.</small>
                  </div>
                  <div className={`changes-context-summary__status ${scopedValidationIssues.length > 0 ? 'needs-review' : 'is-clear'}`}>
                    <strong>{scopedValidationIssues.length}</strong>
                    <span>{scopedValidationIssues.length === 1 ? 'issue' : 'issues'}</span>
                  </div>
                </div>
                <div className="changes-pane-content">

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
                    type="button"
                    className="changes-summary-card"
                    onClick={() => {
                      setActiveSummaryTab('tweaks');
                      setShowSummaryModal(true);
                    }}
                    title="View/reset active tweaks"
                  >
                    <span>Edited units</span>
                    <strong>{modifiedUnitIds.length}</strong>
                    <small>Open ledger</small>
                  </button>
                  <button
                    type="button"
                    className="changes-summary-card"
                    onClick={() => {
                      setActiveSummaryTab('clones');
                      setShowSummaryModal(true);
                    }}
                    title="View/remove custom clones"
                  >
                    <span>Custom units</span>
                    <strong>{clones.length}</strong>
                    <small>Open ledger</small>
                  </button>
                  <button
                    type="button"
                    className="changes-summary-card"
                    onClick={() => {
                      setActiveSummaryTab('rosters');
                      setShowSummaryModal(true);
                    }}
                    title="View/reset roster configurations"
                  >
                    <span>Build menus</span>
                    <strong>{buildMenuSteps.length + activeBuildMenuPackCount}</strong>
                    <small>Open ledger</small>
                  </button>
                </div>

                {/* Mod Project Settings Card */}
                <section className="inspector-changes-section project-metadata-card">
                  <header className="inspector-changes-section__heading">
                    <span>Project identity</span>
                    <h3>Metadata</h3>
                    <p>Used in generated header comments and downloaded project files.</p>
                  </header>
                  <div className="project-metadata-grid">
                    <div className="drawer-field">
                      <label htmlFor="inspector-project-name">Mod name</label>
                      <input
                        id="inspector-project-name"
                        type="text"
                        className="form-input"
                        value={projectName}
                        onChange={e => setProjectName(e.target.value)}
                      />
                    </div>
                    <div className="drawer-field">
                      <label htmlFor="inspector-project-author">Author</label>
                      <input
                        id="inspector-project-author"
                        type="text"
                        className="form-input"
                        value={projectAuthor}
                        onChange={e => setProjectAuthor(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="drawer-field">
                    <label htmlFor="inspector-project-description">Description</label>
                    <textarea
                      id="inspector-project-description"
                      className="form-input"
                      value={projectDesc}
                      onChange={e => setProjectDesc(e.target.value)}
                    />
                  </div>
                </section>

                {/* Compilation Flags Card */}
                <section className="inspector-changes-section compilation-flags-card">
                  <header className="inspector-changes-section__heading">
                    <span>Compiler scope</span>
                    <h3>Export contents</h3>
                    <p>Choose which project systems contribute to generated Lua.</p>
                  </header>
                  <div className="compilation-flags-list">
                    <div className="expert-toggle-row">
                      <div><strong>Parameter tweaks</strong><small>Edited UnitDef and WeaponDef values</small></div>
                      <Switch
                        label="Include parameter tweaks"
                        checked={includeTweaks}
                        onChange={e => setIncludeTweaks(e.target.checked)}
                      />
                    </div>
                    <div className="expert-toggle-row">
                      <div><strong>Custom units</strong><small>Cloned definitions and supporting weapons</small></div>
                      <Switch
                        label="Include custom cloned units"
                        checked={includeClones}
                        onChange={e => setIncludeClones(e.target.checked)}
                      />
                    </div>
                    <div className="expert-toggle-row">
                      <div><strong>Build menus</strong><small>Factory and builder roster changes</small></div>
                      <Switch
                        label="Include factory roster changes"
                        checked={includeRosters}
                        onChange={e => setIncludeRosters(e.target.checked)}
                      />
                    </div>
                    <div className="expert-toggle-row">
                      <div><strong>Header comments</strong><small>Project name, author, and description</small></div>
                      <Switch
                        label="Include header comments"
                        checked={includeHeader}
                        onChange={e => setIncludeHeader(e.target.checked)}
                      />
                    </div>
                  </div>
                </section>

                <section className="compiled-output-section">
                  <header className="inspector-changes-section__heading compiled-output-heading">
                    <span>Modern compiler output</span>
                    <h3>Numbered lobby package</h3>
                    <p>Inspect the exact deterministic fields delivered to BAR.</p>
                  </header>
                  <div className={`compiled-package-status ${compiledLobbyModules?.overflow ? 'is-blocked' : ''}`}>
                    <div><span>Definitions</span><strong>{compiledLobbyModules?.defs?.required || 0} / {compiledLobbyModules?.defs?.maximum || 9}</strong></div>
                    <div><span>Units</span><strong>{compiledLobbyModules?.units?.required || 0} / {compiledLobbyModules?.units?.maximum || 9}</strong></div>
                    <div><span>Payload</span><strong>{(compiledLobbyModules?.aggregateBytes || 0).toLocaleString()}</strong><small>chars</small></div>
                  </div>
                  {compiledOutputSlots.length > 0 && (
                    <div className="compiled-slot-navigator">
                      {['defs', 'units'].map(kind => {
                        const laneSlots = compiledOutputSlots.filter(slot => slot.kind === kind);
                        if (laneSlots.length === 0) return null;
                        return (
                          <div className="compiled-slot-lane" key={kind}>
                            <span>{kind === 'defs' ? 'Definitions' : 'Units'}</span>
                            <div role="tablist" aria-label={`${kind === 'defs' ? 'Definitions' : 'Units'} lobby fields`}>
                              {laneSlots.map(slot => (
                                <button
                                  type="button"
                                  role="tab"
                                  aria-selected={selectedCompiledSlot?.fieldName === slot.fieldName}
                                  key={slot.fieldName}
                                  className={selectedCompiledSlot?.fieldName === slot.fieldName ? 'active' : ''}
                                  onClick={() => setSelectedCompiledField(slot.fieldName)}
                                >
                                  {slot.fieldName}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="compiled-output-tabs" role="tablist" aria-label="Selected lobby field format">
                    {[
                      ['command', 'Command'],
                      ['lua', 'Lua'],
                      ['base64', 'Base64'],
                    ].map(([view, label]) => (
                      <button
                        type="button"
                        role="tab"
                        aria-selected={compiledOutputView === view}
                        key={view}
                        className={`compiled-output-tab ${compiledOutputView === view ? 'active' : ''}`}
                        onClick={() => setCompiledOutputView(view)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div id="compiled-output-view" className="code-block-wrapper compiled-code-wrapper" role="tabpanel">
                    <div className="code-block-header">
                      <span className="code-block-title">
                        {selectedCompiledSlot
                          ? `${selectedCompiledSlot.fieldName} · ${selectedCompiledSlot.encodedBytes.toLocaleString()} chars · ${selectedCompiledSlot.compatibility}`
                          : 'No generated fields'}
                      </span>
                      <div className="compiled-output-actions">
                        <Button
                          size="sm"
                          variant="quiet"
                          className="copy-output-button"
                          disabled={!selectedCompiledValue}
                          onClick={() => {
                            navigator.clipboard.writeText(selectedCompiledValue);
                            showToast(`${selectedCompiledSlot?.fieldName || 'Current output'} copied.`);
                          }}
                        >
                          Copy current
                        </Button>
                        <Button
                          size="sm"
                          variant="quiet"
                          disabled={!compiledOutputSlots.length || compiledLobbyModules?.overflow}
                          onClick={() => {
                            navigator.clipboard.writeText(compiledOutputSlots.map(slot => slot.command).join('\n'));
                            showToast('All numbered lobby commands copied.');
                          }}
                        >
                          Copy all commands
                        </Button>
                      </div>
                    </div>
                    <pre className={`code-box ${compiledOutputView === 'base64' ? 'code-box--encoded' : 'lua'}`}>
                      {selectedCompiledValue || compiledOutputFallback}
                    </pre>
                  </div>
                </section>

                {/* Base64 toggles & Budget limit indicators at bottom */}
                <div className="changes-pane-footer">
                  {scopedValidationIssues.length > 0 && (
                    <section className="drawer-validation-card" aria-labelledby="inspector-validation-title">
                      <header>
                        <div>
                          <span>Validation review</span>
                          <strong id="inspector-validation-title">{scopedValidationIssues.length} {scopedValidationIssues.length === 1 ? 'issue needs' : 'issues need'} attention</strong>
                        </div>
                        <small>{scopedValidationIssues.some(issue => issue.level === 'error') ? 'Action required' : 'Review suggested'}</small>
                      </header>
                      <div className="drawer-validation-list">
                        {scopedValidationIssues.map((issue, idx) => (
                          <div key={`${issue.unitName}:${issue.key}:${idx}`} className="drawer-validation-item">
                            <div><code>{issue.unitName}</code><span>{issue.key.replace('weapon_slot_', 'Slot ')}</span></div>
                            <p className={`drawer-validation-message ${issue.level}`}>{issue.message}</p>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}

                  <section className="inspector-changes-section delivery-status-card">
                    <header className="inspector-changes-section__heading">
                      <span>Lobby delivery</span>
                      <h3>Payload status</h3>
                      <p>BAR-safe encoding and current per-field budget.</p>
                    </header>
                    <div className="delivery-status-grid">
                      <div className={`lobby-limit-indicator ${limitRisk}`}>
                        <span>Generated characters</span>
                        <strong>{totalBytesUsed.toLocaleString()}</strong>
                        <small>of {lobbyByteLimit.toLocaleString()} per field</small>
                        <b>{limitRisk === 'error' ? 'Export blocked' : limitRisk === 'warning' ? 'Safety reserve in use' : 'Within safe range'}</b>
                      </div>
                      <div className="encoding-contract">
                        <span>Encoding contract</span>
                        <strong>URL-safe Base64</strong>
                        <small>Unpadded lobby command output</small>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
              </div>
            )
          }}
        />

      </EditorShell>
  );
}
