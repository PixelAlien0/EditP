import UnitArtwork from '../UnitArtwork.jsx';
import { Button, Switch } from '../ui.jsx';

export default function UnitCommandBar({
  baseId, unitId, name, faction, tier, unitClass, weaponCount, overrideCount,
  isClone, disabled, onDisabledChange, onReset, onOpenIdentity,
}) {
  return (
    <header className="editor-unit-header unit-command-bar">
      <div className="editor-unit-identity">
        <div className="unit-dossier-mark">
          <UnitArtwork unitId={baseId} alt="" eager />
          <span>{tier.toUpperCase()}</span>
        </div>
        <div className="unit-dossier-copy">
          <span className="unit-dossier-eyebrow">Unit dossier · {faction.toUpperCase()}</span>
          <div className="unit-dossier-title-row">
            <span className="unit-dossier-title">{name}</span>
          </div>
          <div className="unit-dossier-meta">
            <code className="unit-dossier-id">{unitId}</code>
            <span className={`clone-badge ${isClone ? '' : 'unit-source-badge'}`}>
              {isClone ? 'Clone prototype' : 'Vanilla unit'}
            </span>
            {isClone && (
              <button type="button" className="unit-identity-edit" onClick={onOpenIdentity}>
                Edit identity
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="unit-dossier-metrics" aria-label="Selected unit summary">
        <div><span>Tier</span><strong>{tier.toUpperCase()}</strong></div>
        <div><span>Class</span><strong>{unitClass || 'Unit'}</strong></div>
        <div><span>Weapons</span><strong>{weaponCount}</strong></div>
        <div className={overrideCount > 0 ? 'has-overrides' : ''}><span>Overrides</span><strong>{overrideCount}</strong></div>
      </div>

      <div className="editor-unit-actions">
        <div className="unit-state-summary">
          <span>Unit state</span>
          <strong className={disabled ? 'is-disabled' : 'is-active'}>{disabled ? 'Excluded' : 'Active'}</strong>
        </div>
        <div className="unit-action-controls">
          <div className="unit-disable-control">
            <span>{disabled ? 'Enable' : 'Disable'}</span>
            <Switch label={`Disable ${name}`} checked={disabled} onChange={event => onDisabledChange(event.target.checked)} />
          </div>
          <Button variant="danger" size="sm" disabled={overrideCount === 0 && !disabled} onClick={onReset}>
            Reset
          </Button>
        </div>
      </div>
    </header>
  );
}
