import { lazy, Suspense } from 'react';
import { getFactionOfUnit } from '../../utils/categories.js';
import {
  getApplicableUnitParameters,
  resolveUnitParameterDefault,
  MOBILITY_STAT_KEYS,
  STAT_KEYS,
  TARGET_CATEGORY_GROUPS,
  UNIT_CATEGORIES as CATEGORIES,
  SPAWNER_CARRIER_WEAPON_GROUPS,
  WORKSPACE_TAB_DEFINITIONS,
} from '../../config/editorParameters.js';
import { Button, SectionHeader, Switch, StatCard } from '../ui.jsx';
import UnitArtwork from '../UnitArtwork.jsx';
import EditorShell from './EditorShell.jsx';
import UnitLibraryPane from './UnitLibraryPane.jsx';
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
import AdvancedCustomParameters from './AdvancedCustomParameters.jsx';

const LazyBehaviorInterceptorEditor = lazy(() => import('./BehaviorInterceptorEditor.jsx'));

const WEAPON_ASSET_TYPES = Object.freeze({
  cegTag: 'ceg',
  explosiongenerator: 'ceg',
  model: 'projectileModel',
  soundstart: 'sound',
  soundhit: 'sound',
  soundhitwet: 'sound',
  soundhitdry: 'sound',
  texture1: 'texture',
  texture2: 'texture',
  texture3: 'texture',
});

export default function EditUnitsWorkspace({ context }) {
  const {
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
  } = context;
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
              ...SPAWNER_CARRIER_WEAPON_GROUPS,
              {
                title: 'Cluster / MIRV behavior',
                description: 'Release a supporting WeaponDef as submunitions. The referenced definition must exist when BAR loads.',
                params: [
                  { key: 'cluster_def', label: 'Cluster Weapon Def', type: 'string' },
                  { key: 'cluster_number', label: 'Cluster Projectile Count', type: 'number' },
                ],
              },
              {
                title: 'Impact & resource behavior',
                description: 'Damage falloff, projectile persistence, impulse, and per-shot costs.',
                params: [
                  { key: 'flighttime', label: 'Rocket Flight Time (seconds)', type: 'number' },
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
                                    const warning = getValidationWarning(tweakKey, displayValue);
                                    return (
                                      <div
                                        key={param.key}
                                        className={`stat-card stat-card--advanced ${isModified ? 'modified' : ''} ${warning ? `is-${warning.level}` : ''} ${getRelationshipStateClass(param.key)}`}
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
                                          ) : param.options ? (
                                            <select
                                              className={`stat-card-input ${warning ? `is-${warning.level}` : ''}`}
                                              value={displayValue}
                                              onChange={e => handleStatChange(selectedUnit.id, tweakKey, e.target.value === '' ? undefined : e.target.value)}
                                            >
                                              {param.options.map(option => (
                                                <option key={option || 'inherited'} value={option}>
                                                  {option || 'Inherited'}
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
  );
}
