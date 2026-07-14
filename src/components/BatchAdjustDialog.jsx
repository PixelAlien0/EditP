import { useId, useMemo } from 'react';
import '../styles/features/batch-adjust.css';
import UnitArtwork from './UnitArtwork.jsx';
import { Badge, Button, ButtonGroup, Dialog, IconButton, SelectField } from './ui.jsx';

const MODE_OPTIONS = [
  { id: 'percent', label: 'Percentage', description: 'Scale each current value proportionally.', defaultValue: '10' },
  { id: 'flat', label: 'Flat offset', description: 'Add the same amount to every current value.', defaultValue: '50' },
];

const QUICK_VALUES = {
  percent: [-25, -10, 10, 25],
  flat: [-100, -50, 50, 100],
};

function formatAdjustment(value, mode) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Invalid value';
  return `${number > 0 ? '+' : ''}${number}${mode === 'percent' ? '%' : ''}`;
}

export default function BatchAdjustDialog({
  open,
  onClose,
  parameterGroups,
  statKey,
  onStatKeyChange,
  mode,
  onModeChange,
  value,
  onValueChange,
  targetUnits,
  onApply,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const valueId = useId();
  const numericValue = Number(value);
  const isValid = Number.isFinite(numericValue);
  const range = mode === 'percent'
    ? { min: -100, max: 200, step: 5 }
    : { min: -1000, max: 1000, step: 10 };
  const options = useMemo(
    () => parameterGroups.flatMap(group => group.options),
    [parameterGroups],
  );
  const selectedParameter = options.find(option => option.value === statKey) || options[0];
  const selectedMode = MODE_OPTIONS.find(option => option.id === mode) || MODE_OPTIONS[0];
  const previewUnits = targetUnits.slice(0, 12);
  const remainingCount = Math.max(0, targetUnits.length - previewUnits.length);

  const changeMode = nextMode => {
    const option = MODE_OPTIONS.find(item => item.id === nextMode);
    onModeChange(nextMode);
    onValueChange(option.defaultValue);
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="batch-adjust"
      overlayClassName="batch-adjust-overlay"
      labelledBy={titleId}
      describedBy={descriptionId}
    >
      <form onSubmit={event => { event.preventDefault(); onApply(); }}>
        <header className="batch-adjust__header">
          <div className="batch-adjust__heading">
            <span className="batch-adjust__eyebrow">Bulk editor · current filters</span>
            <h2 id={titleId}>Batch Adjust Stats</h2>
            <p id={descriptionId}>Apply one controlled adjustment across every eligible unit in the current sidebar scope.</p>
          </div>
          <IconButton label="Close batch adjustment" variant="quiet" size="sm" onClick={onClose}>×</IconButton>
        </header>

        <div className="batch-adjust__body">
          <div className="batch-adjust__controls">
            <section className="batch-adjust__step" aria-labelledby={`${titleId}-parameter`}>
              <div className="batch-adjust__step-heading">
                <span aria-hidden="true">01</span>
                <div>
                  <h3 id={`${titleId}-parameter`}>Choose a parameter</h3>
                  <p>One field will be updated across the selected scope.</p>
                </div>
              </div>
              <SelectField
                label="Parameter"
                description={selectedParameter?.description}
                value={statKey}
                onChange={event => onStatKeyChange(event.target.value)}
              >
                {parameterGroups.map(group => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </optgroup>
                ))}
              </SelectField>
            </section>

            <section className="batch-adjust__step" aria-labelledby={`${titleId}-adjustment`}>
              <div className="batch-adjust__step-heading">
                <span aria-hidden="true">02</span>
                <div>
                  <h3 id={`${titleId}-adjustment`}>Set the adjustment</h3>
                  <p>{selectedMode.description}</p>
                </div>
              </div>

              <ButtonGroup className="batch-adjust__mode" label="Adjustment type">
                {MODE_OPTIONS.map(option => (
                  <Button
                    key={option.id}
                    variant={mode === option.id ? 'primary' : 'secondary'}
                    aria-pressed={mode === option.id}
                    onClick={() => changeMode(option.id)}
                  >
                    {option.label}
                  </Button>
                ))}
              </ButtonGroup>

              <div className="batch-adjust__value-heading">
                <label htmlFor={valueId}>Adjustment value</label>
                <output htmlFor={valueId} className={!isValid ? 'is-invalid' : undefined}>
                  {formatAdjustment(value, mode)}
                </output>
              </div>
              <div className="batch-adjust__value-control">
                <input
                  id={valueId}
                  className="batch-adjust__range"
                  type="range"
                  {...range}
                  value={isValid ? Math.min(range.max, Math.max(range.min, numericValue)) : 0}
                  onChange={event => onValueChange(event.target.value)}
                />
                <input
                  className="ui-control ui-input batch-adjust__number"
                  type="number"
                  step={range.step}
                  value={value}
                  aria-label="Adjustment value"
                  aria-invalid={!isValid}
                  onChange={event => onValueChange(event.target.value)}
                />
              </div>
              <div className="batch-adjust__quick-values" aria-label="Quick adjustment values">
                {QUICK_VALUES[mode].map(quickValue => (
                  <Button key={quickValue} size="sm" variant="quiet" onClick={() => onValueChange(String(quickValue))}>
                    {quickValue > 0 ? '+' : ''}{quickValue}{mode === 'percent' ? '%' : ''}
                  </Button>
                ))}
              </div>
            </section>
          </div>

          <aside className="batch-adjust__scope" aria-labelledby={`${titleId}-scope`}>
            <div className="batch-adjust__scope-header">
              <span className="batch-adjust__scope-kicker">03 · Review scope</span>
              <Badge tone={targetUnits.length > 0 ? 'success' : 'warning'} size="sm">Live filter scope</Badge>
            </div>
            <div className="batch-adjust__scope-count">
              <strong>{targetUnits.length.toLocaleString()}</strong>
              <span id={`${titleId}-scope`}>eligible {targetUnits.length === 1 ? 'unit' : 'units'}</span>
            </div>
            <p>Faction, classification, search, and “modified only” filters from the unit library determine this list.</p>

            <div className="batch-adjust__unit-list">
              {previewUnits.length === 0 ? (
                <div className="batch-adjust__empty">No units match the current filters.</div>
              ) : previewUnits.map(unit => (
                <div className="batch-adjust__unit" key={unit.id}>
                  <UnitArtwork unitId={unit.isClone ? unit.baseId : unit.id} alt="" />
                  <span><strong>{unit.name}</strong><small>{unit.id}</small></span>
                </div>
              ))}
            </div>
            {remainingCount > 0 && <div className="batch-adjust__remainder">+ {remainingCount.toLocaleString()} additional units</div>}

            <div className="batch-adjust__summary">
              <span>Pending operation</span>
              <strong>{selectedParameter?.label} {formatAdjustment(value, mode)}</strong>
              <small>Existing edited values are used as the starting point.</small>
            </div>
          </aside>
        </div>

        <footer className="batch-adjust__footer">
          <p>This creates individual unit edits and can be reversed with Undo.</p>
          <div>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={!isValid || targetUnits.length === 0}>
              Apply to {targetUnits.length.toLocaleString()} {targetUnits.length === 1 ? 'unit' : 'units'}
            </Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
