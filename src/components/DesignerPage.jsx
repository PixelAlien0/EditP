import { Button, PageShell, Switch } from './ui.jsx';
import UnitArtwork from './UnitArtwork.jsx';
import '../styles/features/build-menu.css';

export default function DesignerPage({
  factoryId,
  factoryName,
  factoryIconUrl,
  activeSlotCount,
  changeCount,
  rosterPacks,
  packDefinitions,
  onToggleRosterPack,
  producerCatalog,
  producerCounts,
  producerSearch,
  producerFaction,
  producerKind,
  rosterItems,
  availableUnits,
  availableSearch,
  availableFaction,
  getUnitIconUrl,
  isFactoryModified,
  onProducerSearchChange,
  onProducerFactionChange,
  onProducerKindChange,
  onSelectProducer,
  onResetProducer,
  onReorderRoster,
  onRemoveRosterUnit,
  onRestoreRosterUnit,
  onAvailableSearchChange,
  onAvailableFactionChange,
  onAddRosterUnit,
  onClose,
}) {
  return (
    <PageShell
      className="designer-page"
      label="Factory Roster Designer"
      eyebrow="Production planning"
      title="Factory Roster Designer"
      description="Compose, sequence, and validate factory build options."
      capabilityId="workspace.build-menus"
      context={(
            <div className="designer-selected-factory">
              <div className="designer-unit-pic"><img src={factoryIconUrl} alt="" /></div>
              <div><small>Current producer</small><span>{factoryName}</span><code>{factoryId}</code></div>
            </div>
      )}
      metrics={[
        { label: 'Active slots', value: activeSlotCount },
        { label: 'Changes', value: changeCount },
      ]}
      actions={<Button className="designer-close-button" onClick={onClose}>Back to editor</Button>}
      bodyClassName="designer-page__body"
    >
        <section className="designer-roster-profiles" aria-labelledby="designer-roster-profiles-title">
          <div className="designer-roster-profiles__intro">
            <span className="designer-panel-kicker">Game setup</span>
            <strong id="designer-roster-profiles-title">Roster profile</strong>
            <small>Preview the same conditional build options enabled in a BAR lobby.</small>
          </div>
          <div className="designer-roster-profiles__options">
            {Object.entries(packDefinitions).map(([packId, pack]) => (
              <Switch
                key={packId}
                className="designer-pack-option"
                checked={Boolean(rosterPacks[packId])}
                onChange={() => onToggleRosterPack(packId)}
                label={`${pack.label}: ${rosterPacks[packId] ? 'enabled' : 'disabled'}`}
              >
                <span className="designer-pack-option__copy">
                  <strong>{pack.label}</strong>
                  <small>{pack.description}</small>
                </span>
              </Switch>
            ))}
          </div>
        </section>
        <div className="designer-modal-content">
          <div className="designer-panel designer-factory-browser">
            <div className="designer-panel-header">
              <span className="designer-panel-kicker">Producer catalog</span>
              <span className="designer-panel-title">Choose a producer <small>{producerCatalog.length}</small></span>
              <span className="designer-producer-summary">
                {producerCounts.factory} factories <span aria-hidden="true">·</span> {producerCounts.builder} builders
              </span>
              <input
                type="text"
                className="search-input"
                placeholder="Search producers by name or ID..."
                value={producerSearch}
                onChange={event => onProducerSearchChange(event.target.value)}
                aria-label="Search producers"
              />
              <div className="faction-tabs designer-faction-tabs designer-faction-tabs--four">
                {[
                  ['all', 'ALL'],
                  ['arm', 'ARM'],
                  ['cor', 'COR'],
                  ['leg', 'LEG'],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={`faction-tab ${producerFaction === id ? 'active' : ''}`}
                    onClick={() => onProducerFactionChange(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="designer-producer-kind-tabs" role="group" aria-label="Producer type">
                {[
                  ['all', 'All'],
                  ['factory', 'Factories'],
                  ['builder', 'Builders'],
                ].map(([kind, label]) => (
                  <button
                    type="button"
                    key={kind}
                    className={`designer-producer-kind-tab ${producerKind === kind ? 'active' : ''}`}
                    onClick={() => onProducerKindChange(kind)}
                    aria-pressed={producerKind === kind}
                  >
                    <span>{label}</span>
                    <small>{producerCounts[kind]}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="designer-panel-scroll">
              {producerCatalog.length === 0 && (
                <div className="designer-producer-empty">
                  <strong>No producers found</strong>
                  <span>Try another faction, producer type, or search term.</span>
                  <button type="button" onClick={() => {
                    onProducerFactionChange('all');
                    onProducerKindChange('all');
                    onProducerSearchChange('');
                  }}>
                    Clear catalog filters
                  </button>
                </div>
              )}
              {producerCatalog.map(producer => {
                const active = factoryId === producer.id;
                return (
                  <button
                    type="button"
                    key={producer.id}
                    className={`designer-factory-item ${active ? 'active' : ''}`}
                    onClick={() => onSelectProducer(producer.id)}
                    aria-pressed={active}
                  >
                    <div className="designer-unit-pic designer-unit-pic--factory">
                      <UnitArtwork unitId={producer.id} alt="" />
                    </div>
                    <div className="designer-unit-info">
                      <span className="designer-unit-name">{producer.name}</span>
                      <div className="designer-unit-meta">
                        <span className="designer-unit-id">{producer.id}</span>
                        <span className={`designer-producer-kind designer-producer-kind--${producer.kind}`}>{producer.kindLabel}</span>
                        <span className="designer-producer-tier">{producer.tier}</span>
                        {isFactoryModified(producer.id) && <span className="designer-item-status designer-item-status--modified">Modified</span>}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="designer-panel designer-roster-canvas">
            <div className="designer-panel-header">
              <span className="designer-panel-kicker">Production sequence</span>
              <span className="designer-panel-title">
                {factoryName}
                {isFactoryModified(factoryId) && (
                  <button type="button" className="designer-reset-factory" onClick={onResetProducer}>
                    Reset producer
                  </button>
                )}
              </span>
              <div className="designer-panel-description">
                Drag units to reorder the build menu. Removed slots remain visible until restored.
              </div>
            </div>

            <div className="designer-panel-scroll designer-roster-scroll">
              <div className="build-menu-grid">
                {rosterItems.map((item, index) => {
                  const added = item.status === 'added';
                  const removed = item.status === 'removed';
                  return (
                    <div
                      key={item.id}
                      draggable={!removed}
                      onDragStart={event => {
                        event.dataTransfer.setData('text/plain', item.id);
                        event.currentTarget.classList.add('dragging');
                      }}
                      onDragEnd={event => event.currentTarget.classList.remove('dragging')}
                      onDragOver={event => {
                        event.preventDefault();
                        if (!removed) event.currentTarget.classList.add('drag-over');
                      }}
                      onDragLeave={event => event.currentTarget.classList.remove('drag-over')}
                      onDrop={event => {
                        event.preventDefault();
                        event.currentTarget.classList.remove('drag-over');
                        if (removed) return;
                        const draggedId = event.dataTransfer.getData('text/plain');
                        if (draggedId === item.id) return;
                        const activeIds = rosterItems.filter(entry => entry.status !== 'removed').map(entry => entry.id);
                        const fromIndex = activeIds.indexOf(draggedId);
                        const toIndex = activeIds.indexOf(item.id);
                        if (fromIndex < 0 || toIndex < 0) return;
                        const reorderedIds = [...activeIds];
                        reorderedIds.splice(fromIndex, 1);
                        reorderedIds.splice(toIndex, 0, draggedId);
                        onReorderRoster(reorderedIds);
                      }}
                      className={`build-menu-slot ${added ? 'added' : ''} ${removed ? 'removed' : ''}`}
                    >
                      <span className="slot-index">{String(index + 1).padStart(2, '0')}</span>
                      <UnitArtwork src={getUnitIconUrl(item.id)} alt="" className="build-menu-slot-image" />
                      <div className="slot-overlay-actions">
                        <span className="slot-unit-name" title={item.name}>{item.name}</span>
                        <span className="slot-unit-id">{item.id}</span>
                        {item.sourcePack && (
                          <span className={`slot-pack-source slot-pack-source--${item.sourcePack}`}>
                            {item.sourcePack === 'extraUnits' ? 'Extra pack' : 'Scavenger pack'}
                          </span>
                        )}
                        {!removed ? (
                          <button className="slot-btn slot-btn-remove" onClick={event => { event.stopPropagation(); onRemoveRosterUnit(item.id); }}>
                            Remove
                          </button>
                        ) : (
                          <button className="slot-btn slot-btn-restore" onClick={event => { event.stopPropagation(); onRestoreRosterUnit(item.id); }}>
                            Restore
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {rosterItems.every(item => item.status === 'removed') && (
                <div className="designer-empty-state">
                  <strong>No production options</strong>
                  <span>Roster is currently empty. Game engine will not display this factory in-game.</span>
                </div>
              )}
            </div>
          </div>

          <div className="designer-panel designer-unit-library">
            <div className="designer-panel-header">
              <span className="designer-panel-kicker">Unit library</span>
              <span className="designer-panel-title">Add production options <small>{availableUnits.length}</small></span>
              <input
                type="text"
                className="search-input"
                placeholder="Search units to add..."
                value={availableSearch}
                onChange={event => onAvailableSearchChange(event.target.value)}
              />
              <div className="faction-tabs designer-faction-tabs designer-faction-tabs--three">
                {[
                  ['factory', 'PRODUCER FACTION'],
                  ['all', 'ALL FACTIONS'],
                  ['clone', 'CLONES ONLY'],
                ].map(([id, label]) => (
                  <button
                    type="button"
                    key={id}
                    className={`faction-tab ${availableFaction === id ? 'active' : ''}`}
                    onClick={() => onAvailableFactionChange(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="designer-panel-scroll">
              {availableUnits.map(unit => (
                <div key={unit.id} className="designer-roster-item">
                  <div className="designer-unit-card">
                    <div className="designer-unit-pic">
                      <UnitArtwork src={getUnitIconUrl(unit.id)} alt="" />
                    </div>
                    <div className="designer-unit-info">
                      <span className="designer-unit-name">{unit.name}</span>
                      <div className="designer-unit-meta">
                        <span className="designer-unit-id">{unit.id}</span>
                        {unit.isClone && <span className="designer-item-status designer-item-status--clone">Clone</span>}
                      </div>
                    </div>
                  </div>
                  <button className="designer-add-unit" onClick={() => onAddRosterUnit(unit.id)}>+ Add</button>
                </div>
              ))}
              {availableUnits.length === 0 && (
                <div className="designer-empty-state">
                  <strong>No matching units</strong>
                  <span>Try another search or faction filter.</span>
                </div>
              )}
            </div>
          </div>
      </div>
    </PageShell>
  );
}
