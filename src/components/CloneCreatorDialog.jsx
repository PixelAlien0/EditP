import { useRef } from 'react';
import { Badge, Button, Dialog, IconButton, Switch, TextField, Type } from './ui.jsx';
import UnitArtwork from './UnitArtwork.jsx';

function WorkflowHeading({ id, step, eyebrow, title, description }) {
  return (
    <header className="clone-workflow-heading">
      <span className="clone-workflow-heading__step" aria-hidden="true">{step}</span>
      <div>
        <Type variant="eyebrow">{eyebrow}</Type>
        <Type as="h4" variant="subsection-title" id={id}>{title}</Type>
        <Type as="p" variant="description">{description}</Type>
      </div>
    </header>
  );
}

export default function CloneCreatorDialog({
  open,
  baseId,
  baseName,
  baseIconUrl,
  baseFaction,
  baseTier,
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
  const newIdRef = useRef(null);
  const normalizedBuilders = builders.filter(Boolean);
  const sourceWarning = baseId.startsWith('raptor_')
    ? {
        title: 'Raptor source requires an in-game check',
        body: 'The generated clone removes Raptor-specific properties that can prevent player production. Verify the result in an isolated lobby.',
      }
    : baseId.startsWith('scav_')
      ? {
          title: 'Scavenger source resolves through its base definition',
          body: 'Scavenger definitions are unavailable during tweakdefs loading, so the compiler uses the equivalent base UnitDef as the clone source.',
        }
      : null;
  const productionStatus = autoAssignBuilders
    ? normalizedBuilders.length > 0
      ? `${normalizedBuilders.length} ${normalizedBuilders.length === 1 ? 'builder' : 'builders'} detected`
      : 'No matching builders detected'
    : normalizedBuilders.length > 0
      ? `${normalizedBuilders.length} manual ${normalizedBuilders.length === 1 ? 'builder' : 'builders'}`
      : 'Unassigned at creation';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      overlayClassName="clone-creator-overlay"
      className="clone-creator-modal"
      labelledBy="clone-creator-title"
      describedBy="clone-creator-description"
      initialFocusRef={newIdRef}
    >
      <header className="clone-creator-header">
        <div>
          <Type variant="eyebrow">Unit fork workflow</Type>
          <Type as="h3" variant="page-title" id="clone-creator-title">Clone Unit Creator</Type>
          <Type as="p" variant="description" id="clone-creator-description">
            Create an independent UnitDef while preserving the selected chassis as its source.
          </Type>
        </div>
        <IconButton className="clone-creator-close" label="Close Clone Unit Creator" onClick={onClose}>×</IconButton>
      </header>

      <form onSubmit={onSubmit} className="clone-creator-form">
        <div className="clone-creator-scroll">
          <section className="clone-workflow-section clone-workflow-section--source" aria-labelledby="clone-source-heading">
            <WorkflowHeading
              id="clone-source-heading"
              step="01"
              eyebrow="Source"
              title="Source chassis"
              description="The original remains unchanged; its definition becomes the starting point."
            />
            <div className="clone-source-card">
              <UnitArtwork src={baseIconUrl} unitId={baseId} alt="" eager className="clone-source-card__art" />
              <div className="clone-source-card__identity">
                <Type as="strong" variant="section-title">{baseName || baseId}</Type>
                <input
                  className="clone-source-card__id"
                  aria-label="Parent Unit"
                  value={baseId}
                  readOnly
                />
              </div>
              <div className="clone-source-card__meta">
                {baseFaction && <Badge size="sm">{String(baseFaction).toUpperCase()}</Badge>}
                {baseTier && <Badge size="sm">{String(baseTier).toUpperCase()}</Badge>}
                <Badge size="sm" tone="success">Source locked</Badge>
              </div>
              <Type as="p" variant="description">
                Stats, weapons, assets, and behavior are copied into the new definition.
              </Type>
            </div>
          </section>

          {sourceWarning && (
            <aside className="clone-source-warning" role="status">
              <span className="clone-source-warning__mark" aria-hidden="true">!</span>
              <div>
                <Type as="strong" variant="subsection-title">{sourceWarning.title}</Type>
                <Type as="p" variant="description">{sourceWarning.body}</Type>
              </div>
            </aside>
          )}

          <section className="clone-workflow-section" aria-labelledby="clone-identity-heading">
            <WorkflowHeading
              id="clone-identity-heading"
              step="02"
              eyebrow="Identity"
              title="Name the new definition"
              description="Use a unique lowercase ID. Display copy can be refined later from the Identity inspector."
            />
            <div className="clone-identity-grid">
              <TextField
                ref={newIdRef}
                className="clone-field clone-field--id"
                label="New Unit ID"
                description="Lowercase letters, numbers, and underscores are safest for BAR."
                aria-label="New Unit ID"
                placeholder="e.g. armpw_epic"
                value={newId}
                onChange={event => onNewIdChange(event.target.value.toLowerCase())}
                autoComplete="off"
                required
              />
              <TextField
                className="clone-field clone-field--name"
                label="Display name"
                description="Shown in the build menu and editor."
                placeholder="e.g. Epic Vanguard"
                value={name}
                onChange={event => onNameChange(event.target.value)}
              />
              <TextField
                className="clone-field clone-field--description"
                label="Unit description"
                description="A short role description; optional."
                placeholder="e.g. Heavy infantry bot with a lightning weapon"
                value={description}
                onChange={event => onDescriptionChange(event.target.value)}
              />
            </div>
          </section>

          <section className="clone-workflow-section" aria-labelledby="clone-production-heading">
            <WorkflowHeading
              id="clone-production-heading"
              step="03"
              eyebrow="Production"
              title="Choose its initial builders"
              description="Production assignments remain editable later from Build Menus."
            />
            <div className={`clone-builder-mode ${autoAssignBuilders ? 'is-active' : ''}`}>
              <Switch
                label="Automatically assign the clone to its parent unit builders"
                checked={autoAssignBuilders}
                onChange={event => onAutoAssignChange(event.target.checked)}
              />
              <div>
                <Type as="strong" variant="subsection-title">Match the source unit’s builders</Type>
                <Type as="small" variant="description">
                  {autoAssignBuilders
                    ? normalizedBuilders.length > 0
                      ? `${normalizedBuilders.length} matching ${normalizedBuilders.length === 1 ? 'producer was' : 'producers were'} found in active Build Menus.`
                      : 'No active Build Menu currently contains the source unit.'
                    : 'Off by default. Leave the clone unassigned or enter producers manually.'}
                </Type>
              </div>
            </div>

            <TextField
              className="clone-field clone-field--builders"
              label="Builder IDs"
              description={autoAssignBuilders
                ? 'Derived from the source unit. Turn off automatic matching to edit the list.'
                : 'Optional comma-separated producer IDs, such as armlab, armavp.'}
              placeholder="e.g. armlab, armavp"
              value={builders.join(', ')}
              disabled={autoAssignBuilders}
              onChange={event => onBuildersChange(event.target.value.split(',').map(builder => builder.trim()))}
            />
          </section>
        </div>

        <footer className="clone-creator-actions">
          <div className="clone-creator-outcome" aria-live="polite">
            <Type variant="metadata">Creation result</Type>
            <Type as="strong" variant="subsection-title">{newId || 'Enter a new Unit ID'}</Type>
            <Type as="small" variant="technical">{productionStatus}</Type>
          </div>
          <div>
            <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant="primary" className="clone-creator-submit">Create Clone</Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
