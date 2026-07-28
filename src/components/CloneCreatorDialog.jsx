import { createPortal } from 'react-dom';
import { Button, Switch } from './ui.jsx';

export default function CloneCreatorDialog({
  open,
  baseId,
  newId,
  name,
  description,
  builders,
  autoAssignBuilders,
  onNewIdChange,
  onNameChange,
  onDescriptionChange,
  onBuildersChange,
  onAutoAssignChange,
  onSubmit,
  onClose,
}) {
  if (!open) return null;

  const sourceWarning = baseId.startsWith('raptor_')
    ? {
        title: 'Raptor base unit — verify in-game',
        body: 'Raptor units are loaded into UnitDefs and should be cloneable. The generated code strips raptor-specific properties that could prevent the clone from appearing in player build menus. Test in-game and adjust if needed.',
      }
    : baseId.startsWith('scav_')
      ? {
          title: 'Scavenger unit — the clone will use the base unit as source',
          body: 'Scavenger units do not exist in UnitDefs at tweakdefs time. The tool will clone from the equivalent base unit instead.',
        }
      : null;

  return createPortal(
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

        <form onSubmit={onSubmit} className="clone-form clone-creator-form">
          <div className="form-group clone-field clone-field--parent">
            <label htmlFor="clone-parent-unit">Parent Unit</label>
            <input id="clone-parent-unit" type="text" className="form-input" value={baseId} disabled />
          </div>

          <div className="form-group clone-field clone-field--id">
            <label htmlFor="clone-new-unit-id">New Unit ID</label>
            <input
              id="clone-new-unit-id"
              type="text"
              className="form-input"
              placeholder="e.g. armpw_epic"
              value={newId}
              onChange={event => onNewIdChange(event.target.value.toLowerCase())}
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
              value={name}
              onChange={event => onNameChange(event.target.value)}
            />
          </div>

          <div className="form-group clone-field clone-field--description">
            <label htmlFor="clone-custom-description">Custom Description</label>
            <input
              id="clone-custom-description"
              type="text"
              className="form-input"
              placeholder="e.g. Heavy infantry bot with lightning gun"
              value={description}
              onChange={event => onDescriptionChange(event.target.value)}
            />
          </div>

          {sourceWarning && (
            <div className="panel-card clone-source-warning">
              <div className="clone-source-warning__title">⚠ {sourceWarning.title}</div>
              <div className="clone-source-warning__copy">{sourceWarning.body}</div>
            </div>
          )}

          <div className={`clone-builder-mode ${autoAssignBuilders ? 'is-active' : ''}`}>
            <Switch
              label="Automatically assign the clone to its parent unit builders"
              checked={autoAssignBuilders}
              onChange={event => onAutoAssignChange(event.target.checked)}
            />
            <div>
              <strong>Auto-assign parent builders</strong>
              <small>
                {autoAssignBuilders
                  ? builders.length > 0
                    ? `${builders.length} matching ${builders.length === 1 ? 'builder' : 'builders'} found in the active Build Menus.`
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
              value={builders.join(', ')}
              disabled={autoAssignBuilders}
              onChange={event => onBuildersChange(event.target.value.split(',').map(builder => builder.trim()))}
            />
            <small>
              {autoAssignBuilders
                ? 'Builder IDs are derived from the parent unit. Turn off auto-assign to enter a custom list.'
                : 'Optional. Leave empty for an unassigned clone, or enter builder IDs manually.'}
            </small>
          </div>

          <div className="clone-creator-actions">
            <Button type="submit" variant="primary" className="clone-creator-submit">Create Clone</Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
