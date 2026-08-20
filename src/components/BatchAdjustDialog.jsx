import { useId, useMemo } from 'react';
import '../styles/features/batch-adjust.css';
import UnitArtwork from './UnitArtwork.jsx';
import { Badge, Button, ButtonGroup, Dialog, IconButton, SelectField, TextField } from './ui.jsx';

const MODE_OPTIONS = Object.freeze([
  { id: 'percent', label: 'Scale', description: 'Change each current value by a percentage.', defaultValue: '10' },
  { id: 'add', label: 'Offset', description: 'Add or subtract the same amount from each current value.', defaultValue: '50' },
  { id: 'set', label: 'Set value', description: 'Replace every eligible value with one exact number.', defaultValue: '100' },
]);

const QUICK_VALUES = Object.freeze({
  percent: [-25, -10, 10, 25],
  add: [-100, -10, 10, 100],
  set: [0, 1, 100, 1000],
});

function formatAdjustment(value, mode) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 'Invalid value';
  if (mode === 'set') return `Set to ${number.toLocaleString()}`;
  return `${number > 0 ? '+' : ''}${number.toLocaleString()}${mode === 'percent' ? '%' : ''}`;
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
  scopeLabel = 'Current filters',
  preview,
  onApply,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const numericValue = Number(value);
  const isValid = String(value).trim() !== '' && Number.isFinite(numericValue);
  const options = useMemo(() => parameterGroups.flatMap(group => group.options), [parameterGroups]);
  const selectedParameter = options.find(option => option.value === statKey) || options[0];
  const selectedMode = MODE_OPTIONS.find(option => option.id === mode) || MODE_OPTIONS[0];
  const previewRows = preview?.previewRows || [];
  const visibleRows = previewRows.slice(0, 24);
  const remainingRows = Math.max(0, previewRows.length - visibleRows.length);
  const canApply = isValid && !preview?.blocked && previewRows.length > 0;

  const changeMode = nextMode => {
    const option = MODE_OPTIONS.find(item => item.id === nextMode);
    onModeChange(nextMode);
    onValueChange(option.defaultValue);
  };

  return (
    <Dialog open={open} onClose={onClose} className="batch-adjust" overlayClassName="batch-adjust-overlay" labelledBy={titleId} describedBy={descriptionId}>
      <form className="batch-adjust__form" onSubmit={event => { event.preventDefault(); onApply(); }}>
        <header className="batch-adjust__header">
          <div className="batch-adjust__heading">
            <div className="batch-adjust__title-line">
              <span className="batch-adjust__eyebrow">Controlled bulk editor</span>
              <Badge tone="success" size="sm">Preview first</Badge>
            </div>
            <h2 id={titleId}>Batch Adjust</h2>
            <p id={descriptionId}>Apply one verified numeric operation to the units in your active library scope.</p>
          </div>
          <IconButton label="Close Batch Adjust" variant="quiet" size="sm" onClick={onClose}>×</IconButton>
        </header>

        <section className="batch-adjust__metrics" aria-label="Adjustment impact summary">
          <div><span>Scope</span><strong>{targetUnits.length.toLocaleString()}</strong><small>{scopeLabel}</small></div>
          <div><span>Units changed</span><strong>{(preview?.affectedUnitCount || 0).toLocaleString()}</strong><small>with eligible values</small></div>
          <div><span>Field edits</span><strong>{(preview?.affectedFieldCount || 0).toLocaleString()}</strong><small>one undo step</small></div>
          <div><span>Units skipped</span><strong>{(preview?.skippedUnitCount || 0).toLocaleString()}</strong><small>missing or unchanged</small></div>
        </section>

        <div className="batch-adjust__workbench">
          <section className="batch-adjust__configuration" aria-labelledby={`${titleId}-configuration`}>
            <div className="batch-adjust__section-heading">
              <span aria-hidden="true">01</span>
              <div><h3 id={`${titleId}-configuration`}>Configure operation</h3><p>Only curated numeric fields with existing BAR values are eligible.</p></div>
            </div>

            <SelectField label="Parameter" description={selectedParameter?.description} value={statKey} onChange={event => onStatKeyChange(event.target.value)}>
              {parameterGroups.map(group => (
                <optgroup key={group.label} label={group.label}>
                  {group.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                </optgroup>
              ))}
            </SelectField>

            <div className="batch-adjust__mode-block">
              <span className="batch-adjust__control-label">Operation</span>
              <ButtonGroup className="batch-adjust__mode" label="Adjustment operation">
                {MODE_OPTIONS.map(option => (
                  <Button key={option.id} variant={mode === option.id ? 'primary' : 'secondary'} aria-pressed={mode === option.id} onClick={() => changeMode(option.id)}>
                    {option.label}
                  </Button>
                ))}
              </ButtonGroup>
              <small>{selectedMode.description}</small>
            </div>

            <TextField
              label={`Value${selectedParameter?.unit ? ` · ${selectedParameter.unit}` : ''}`}
              description={`Preview: ${selectedParameter?.label} · ${formatAdjustment(value, mode)}`}
              error={!isValid ? 'Enter a finite number.' : undefined}
              type="number"
              step="any"
              value={value}
              onChange={event => onValueChange(event.target.value)}
            />

            <div className="batch-adjust__quick-values" aria-label="Quick values">
              {QUICK_VALUES[mode].map(quickValue => (
                <Button key={quickValue} size="sm" variant="quiet" onClick={() => onValueChange(String(quickValue))}>
                  {mode === 'set' ? quickValue : `${quickValue > 0 ? '+' : ''}${quickValue}${mode === 'percent' ? '%' : ''}`}
                </Button>
              ))}
            </div>

            <div className="batch-adjust__safety-note">
              <strong>Safe application rules</strong>
              <p>Missing fields are skipped, edited values remain the baseline, invalid results are rejected, and minimum engine-safe values are clamped.</p>
            </div>
          </section>

          <section className="batch-adjust__preview" aria-labelledby={`${titleId}-preview`}>
            <div className="batch-adjust__preview-heading">
              <div className="batch-adjust__section-heading">
                <span aria-hidden="true">02</span>
                <div><h3 id={`${titleId}-preview`}>Before / after ledger</h3><p>Review the exact values that will be written.</p></div>
              </div>
              <Badge tone={canApply ? 'success' : 'warning'} size="sm">{canApply ? 'Ready' : 'No changes'}</Badge>
            </div>

            {preview?.warnings?.length > 0 && (
              <div className="batch-adjust__warnings" role="status">
                {preview.warnings.map(warning => <p key={warning}>{warning}</p>)}
              </div>
            )}

            <div className="batch-adjust__ledger" role="region" aria-label="Bulk adjustment preview" tabIndex="0">
              <div className="batch-adjust__ledger-head" aria-hidden="true"><span>Unit and field</span><span>Current</span><span>Result</span><span>Source</span></div>
              {visibleRows.length === 0 ? (
                <div className="batch-adjust__empty">
                  <strong>{preview?.error || 'No eligible changes in this scope.'}</strong>
                  <span>Choose another parameter, operation, value, or library scope.</span>
                </div>
              ) : visibleRows.map(row => (
                <div className="batch-adjust__ledger-row" key={`${row.unitId}-${row.key}`}>
                  <div className="batch-adjust__unit-field">
                    <UnitArtwork unitId={row.artworkUnitId} alt="" loading="lazy" />
                    <span><strong>{row.unitName}</strong><small>{row.fieldLabel}</small></span>
                  </div>
                  <code>{row.before}</code>
                  <code className="is-result">{row.after}</code>
                  <Badge tone={row.source === 'Edited' ? 'accent' : 'neutral'} size="sm">{row.source}</Badge>
                </div>
              ))}
              {remainingRows > 0 && <div className="batch-adjust__ledger-more">+ {remainingRows.toLocaleString()} more field edits included</div>}
            </div>
          </section>
        </div>

        <footer className="batch-adjust__footer">
          <div><strong>{canApply ? `${preview.affectedFieldCount.toLocaleString()} edits ready` : 'Nothing will be written'}</strong><span>Applying creates one project-history transaction. Undo restores the previous state.</span></div>
          <div className="batch-adjust__footer-actions">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={!canApply}>Apply to {(preview?.affectedUnitCount || 0).toLocaleString()} {preview?.affectedUnitCount === 1 ? 'unit' : 'units'}</Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
