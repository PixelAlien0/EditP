import CustomWeaponBorrowPanel from './CustomWeaponBorrowPanel.jsx';
import UnitArtwork from './UnitArtwork.jsx';
import { getFactionOfUnit } from '../utils/categories.js';
import {
  filterDonorUnits,
  getWeaponClass,
  getWeaponRoleLabel,
} from '../controllers/useWeaponSwapController.js';

export default function WeaponSwapModal({
  activeSwapSlotNum,
  allUnitsList,
  defaultsDb,
  equipWeaponBlueprint,
  onBorrowWeapon,
  onClose,
  onHeaderMouseDown,
  openWeaponLab,
  selectedSwapBlueprintId,
  selectedSwapUnitId,
  selectedUnitDefaults,
  setSelectedSwapBlueprintId,
  setSelectedSwapUnitId,
  setSwapLibraryMode,
  setSwapSearchQuery,
  setSwapUnitFactionFilter,
  setSwapWeaponTypeFilter,
  swapLibraryMode,
  swapPosition,
  swapSearchQuery,
  swapUnitFactionFilter,
  swapWeaponTypeFilter,
  unitNames,
  weaponLibrary,
}) {
  return (
        <div className="weapon-swap-overlay">
        <div
          className="weapon-swap-modal weapon-borrow-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="weapon-borrow-title"
          style={swapPosition ? { top: swapPosition.y, left: swapPosition.x, transform: 'none' } : undefined}
          onKeyDown={event => {
            if (event.key !== 'Escape') return;
            onClose();
          }}
        >
          {/* Header (Drag Handle) */}
          <div
            className="weapon-swap-header"
            onMouseDown={onHeaderMouseDown}
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
              onClick={onClose}
            >
              <span>Close</span>
              <svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" /></svg>
            </button>
          </div>

          <div className="weapon-swap-mode-tabs" role="tablist" aria-label="Weapon source type">
            <button
              type="button"
              role="tab"
              aria-selected={swapLibraryMode === 'bar'}
              className={swapLibraryMode === 'bar' ? 'is-active' : ''}
              onClick={() => setSwapLibraryMode('bar')}
            >
              BAR weapons
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={swapLibraryMode === 'custom'}
              className={swapLibraryMode === 'custom' ? 'is-active' : ''}
              onClick={() => {
                setSwapLibraryMode('custom');
                setSelectedSwapBlueprintId(current => current || weaponLibrary[0]?.id || null);
              }}
            >
              Custom weapons
              <span>{weaponLibrary.length}</span>
            </button>
          </div>

          {swapLibraryMode === 'bar' ? (
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
                {filterDonorUnits(allUnitsList, swapSearchQuery, swapUnitFactionFilter, defaultsDb)
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
                const srcName = unitNames[selectedSwapUnitId] || selectedSwapUnitId;

                // Extract available weapons from dynamic weaponSlots array
                const weapons = srcDefaults?.weaponSlots || [];

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
                              onClick={() => onBorrowWeapon(w)}
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
          ) : (
            <div className="weapon-swap-body">
              <CustomWeaponBorrowPanel
                library={weaponLibrary}
                selectedBlueprintId={selectedSwapBlueprintId}
                targetSlot={activeSwapSlotNum}
                onSelect={setSelectedSwapBlueprintId}
                onEquip={blueprint => {
                  equipWeaponBlueprint(blueprint, activeSwapSlotNum);
                  onClose();
                }}
                onOpenLaboratory={() => {
                  onClose();
                  openWeaponLab();
                }}
              />
            </div>
          )}
      </div>
        </div>
  );
}
