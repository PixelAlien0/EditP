import { Button, PageShell, Switch } from './ui.jsx';
import '../styles/features/build-menu.css';

export default function DesignerPage({
  children,
  factoryId,
  factoryName,
  factoryIconUrl,
  activeSlotCount,
  changeCount,
  rosterPacks,
  packDefinitions,
  onToggleRosterPack,
  onClose
}) {
  return (
    <PageShell className="designer-page" label="Factory Roster Designer">
      <div className="designer-modal-container">
        <div className="designer-modal-header">
          <div className="designer-modal-heading">
            <span className="designer-modal-eyebrow">Production planning</span>
            <span className="designer-modal-title">Factory Roster Designer</span>
            <span className="designer-modal-subtitle">Compose, sequence, and validate factory build options.</span>
          </div>
          <div className="designer-header-context">
            <div className="designer-selected-factory">
              <div className="designer-unit-pic"><img src={factoryIconUrl} alt="" /></div>
              <div><small>Current producer</small><span>{factoryName}</span><code>{factoryId}</code></div>
            </div>
            <div className="designer-header-stats" aria-label="Selected producer status">
              <div className="designer-header-stat"><span>Active slots</span><strong>{activeSlotCount}</strong></div>
              <div className="designer-header-stat"><span>Changes</span><strong>{changeCount}</strong></div>
            </div>
            <Button className="designer-close-button" onClick={onClose}>← Back to editor</Button>
          </div>
        </div>
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
        {children}
      </div>
    </PageShell>
  );
}
