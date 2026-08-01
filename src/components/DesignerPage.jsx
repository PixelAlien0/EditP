import { Button, PageShell, Switch, Type } from './ui.jsx';
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
  const removedItems = rosterItems.filter(item => item.status === 'removed');
  const baseSlotCount = rosterItems.filter(item => item.status !== 'added').length;
  const addedSlotCount = rosterItems.filter(item => item.status === 'added').length;
  const suggestedUnits = availableUnits.filter(unit => !unit.rosterStatus).slice(0, 3);

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
            <Type variant="eyebrow" className="designer-panel-kicker">Game setup</Type>
            <Type as="strong" variant="subsection-title" id="designer-roster-profiles-title">Roster profile</Type>
            <Type as="small" variant="description">Preview the same conditional build options enabled in a BAR lobby.</Type>
          </div>
          <div className="designer-roster-profiles__options">
            {Object.entries(packDefinitions).map(([packId, pack]) => {
              const affectedProducers = Object.keys(pack.additions || {}).length;
              const addedOptions = Object.values(pack.additions || {})
                .reduce((total, additions) => total + additions.length, 0);
              const enabled = Boolean(rosterPacks[packId]);
              return (
                <Switch
                  key={packId}
                  className="designer-pack-option"
                  checked={enabled}
                  onChange={() => onToggleRosterPack(packId)}
                  label={`${pack.label}: ${enabled ? 'enabled' : 'disabled'}`}
                >
                  <span className="designer-pack-option__copy">
                    <span className="designer-pack-option__heading">
                      <strong>{pack.label}</strong>
                      <span className="designer-pack-option__state">{enabled ? 'Enabled' : 'Off'}</span>
                    </span>
                    <small>{pack.description}</small>
                    <span className="designer-pack-option__impact">
                      {affectedProducers} producer rosters · {addedOptions} unit placements
                    </span>
                  </span>
                </Switch>
              );
            })}
          </div>
        </section>
        <div className="designer-modal-content">
          <div className="designer-panel designer-factory-browser">
            <div className="designer-panel-header">
              <Type variant="eyebrow" className="designer-panel-kicker">Producer catalog</Type>
              <Type variant="section-title" className="designer-panel-title">Choose a producer <small>{producerCatalog.length}</small></Type>
              <Type variant="technical" className="designer-producer-summary">
                {producerCounts.factory} factories <span aria-hidden="true">·</span> {producerCounts.builder} builders
              </Type>
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
                      <UnitArtwork src={getUnitIconUrl(producer.id)} alt="" />
                    </div>
                    <div className="designer-unit-info">
                      <span className="designer-unit-name">{producer.name}</span>
                      <div className="designer-unit-meta">
                        <span className="designer-unit-id">{producer.id}</span>
                        <span className={`designer-producer-faction designer-producer-faction--${producer.faction}`}>
                          {producer.faction}
                        </span>
                        <span className={`designer-producer-kind designer-producer-kind--${producer.kind}`}>{producer.kindLabel}</span>
                        <span className="designer-producer-tier">{producer.tier}</span>
                        {producer.isClone && <span className="designer-item-status designer-item-status--clone">Clone</span>}
                        {isFactoryModified(producer.id) && <span className="designer-item-status designer-item-status--modified">Modified</span>}
                      </div>
                    </div>
                    <span className={`designer-producer-capacity ${producer.rosterSize === 0 ? 'is-warning' : ''}`}>
                      <strong>{producer.rosterSize}</strong>
                      <small>{producer.rosterSize === 1 ? 'slot' : 'slots'}</small>
                      {producer.rosterSize === 0 && <em>Missing roster data</em>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="designer-panel designer-roster-canvas">
            <div className="designer-panel-header">
              <Type variant="eyebrow" className="designer-panel-kicker">Production sequence</Type>
              <Type variant="section-title" className="designer-panel-title">
                {factoryName}
                {isFactoryModified(factoryId) && (
                  <button type="button" className="designer-reset-factory" onClick={onResetProducer}>
                    Reset producer
                  </button>
                )}
              </Type>
              <Type as="div" variant="description" className="designer-panel-description">
                <span>Drag units to reorder the build menu. Removed slots remain visible until restored.</span>
                <span className="designer-sequence-summary">
                  {activeSlotCount} active · {baseSlotCount} roster references · {addedSlotCount} custom
                </span>
              </Type>
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
                      <span className="slot-index" aria-label={`Slot ${index + 1}`}>
                        <small>Slot</small>{String(index + 1).padStart(2, '0')}
                      </span>
                      {!removed && <span className="slot-drag-handle" aria-hidden="true" title="Drag to reorder">⠿</span>}
                      <span className={`slot-status slot-status--${item.status}`}>
                        {removed ? 'Removed' : added ? 'Added' : 'Default'}
                      </span>
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
                          <Button size="sm" variant="danger" className="slot-btn" aria-label={`Remove ${item.name} from ${factoryName}`} onClick={event => { event.stopPropagation(); onRemoveRosterUnit(item.id); }}>
                            <span className="slot-btn-icon" aria-hidden="true">✕</span> Remove
                          </Button>
                        ) : (
                          <Button size="sm" className="slot-btn slot-btn-restore" aria-label={`Restore ${item.name} to ${factoryName}`} onClick={event => { event.stopPropagation(); onRestoreRosterUnit(item.id); }}>
                            <span className="slot-btn-icon" aria-hidden="true">↺</span> Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              {(rosterItems.length === 0 || removedItems.length === rosterItems.length) && (
                <div className="designer-empty-state designer-empty-state--production">
                  <span className="designer-empty-state__index" aria-hidden="true">00</span>
                  <strong>No production options</strong>
                  <span>This producer has no active build choices and will not expose a usable production roster in game.</span>
                  <div className="designer-empty-state__actions">
                    {removedItems.length > 0 && (
                      <Button
                        size="sm"
                        onClick={() => removedItems.forEach(item => onRestoreRosterUnit(item.id))}
                      >
                        Restore {removedItems.length} removed
                      </Button>
                    )}
                    {suggestedUnits.map(unit => (
                      <Button size="sm" key={unit.id} onClick={() => onAddRosterUnit(unit.id)}>
                        + {unit.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="designer-panel designer-unit-library">
            <div className="designer-panel-header">
              <Type variant="eyebrow" className="designer-panel-kicker">Unit library</Type>
              <Type variant="section-title" className="designer-panel-title">Add production options <small>{availableUnits.length}</small></Type>
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
              {availableUnits.map(unit => {
                const inRoster = unit.rosterStatus && unit.rosterStatus !== 'removed';
                const wasRemoved = unit.rosterStatus === 'removed';
                return (
                <div
                  key={unit.id}
                  className={`designer-roster-item ${inRoster ? 'is-present' : ''} ${wasRemoved ? 'is-removed' : ''}`}
                >
                  <div className="designer-unit-card">
                    <div className="designer-unit-pic">
                      <UnitArtwork src={getUnitIconUrl(unit.id)} alt="" />
                    </div>
                    <div className="designer-unit-info">
                      <span className="designer-unit-name">{unit.name}</span>
                      <div className="designer-unit-meta">
                        <span className="designer-unit-id">{unit.id}</span>
                        {unit.isClone && <span className="designer-item-status designer-item-status--clone">Clone</span>}
                        {inRoster && <span className="designer-item-status designer-item-status--present">In roster</span>}
                        {wasRemoved && <span className="designer-item-status designer-item-status--removed">Removed</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className={`designer-add-unit ${wasRemoved ? 'is-restore' : ''}`}
                    disabled={Boolean(inRoster)}
                    onClick={() => wasRemoved ? onRestoreRosterUnit(unit.id) : onAddRosterUnit(unit.id)}
                    aria-label={
                      inRoster
                        ? `${unit.name} is already in this roster`
                        : `${wasRemoved ? 'Restore' : 'Add'} ${unit.name}`
                    }
                  >
                    <span className="designer-add-unit-icon" aria-hidden="true">{inRoster ? '✓' : wasRemoved ? '↺' : '+'}</span>
                    {inRoster ? 'Added' : wasRemoved ? 'Restore' : 'Add'}
                  </Button>
                </div>
                );
              })}
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
