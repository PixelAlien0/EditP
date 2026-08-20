import { useEffect, useId, useMemo, useState } from 'react';
import '../styles/features/batch-adjust.css';
import UnitArtwork from './UnitArtwork.jsx';
import { Badge, Button, ButtonGroup, Dialog, IconButton, SelectField, TextField } from './ui.jsx';

const UNIT_PAGE_SIZE = 40;

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

function getUnitTier(unit) {
  return unit.tags?.find(tag => /^t\d$/i.test(tag))?.toUpperCase() || '';
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
  candidateUnits,
  selectedUnitIds,
  currentUnitId,
  scopeLabel = 'Current filters',
  preview,
  onToggleUnit,
  onSelectUnits,
  onDeselectUnits,
  onClearSelection,
  onApply,
}) {
  const titleId = useId();
  const descriptionId = useId();
  const [query, setQuery] = useState('');
  const [selectionView, setSelectionView] = useState('candidates');
  const [page, setPage] = useState(1);
  const [largeBatchConfirmation, setLargeBatchConfirmation] = useState('');
  const numericValue = Number(value);
  const isValid = String(value).trim() !== '' && Number.isFinite(numericValue);
  const options = useMemo(() => parameterGroups.flatMap(group => group.options), [parameterGroups]);
  const selectedParameter = options.find(option => option.value === statKey) || options[0];
  const selectedMode = MODE_OPTIONS.find(option => option.id === mode) || MODE_OPTIONS[0];
  const selectedIds = useMemo(() => new Set(selectedUnitIds), [selectedUnitIds]);
  const selectedUnits = useMemo(
    () => candidateUnits.filter(unit => selectedIds.has(unit.id)),
    [candidateUnits, selectedIds],
  );
  const sourceUnits = selectionView === 'selected' ? selectedUnits : candidateUnits;
  const normalizedQuery = query.trim().toLowerCase();
  const filteredUnits = useMemo(() => sourceUnits.filter(unit => {
    if (!normalizedQuery) return true;
    return [unit.name, unit.id, unit.faction, ...(unit.tags || [])]
      .filter(Boolean)
      .some(valueToSearch => String(valueToSearch).toLowerCase().includes(normalizedQuery));
  }), [normalizedQuery, sourceUnits]);
  const pageCount = Math.max(1, Math.ceil(filteredUnits.length / UNIT_PAGE_SIZE));
  const visibleUnits = filteredUnits.slice((page - 1) * UNIT_PAGE_SIZE, page * UNIT_PAGE_SIZE);
  const visibleUnitIds = visibleUnits.map(unit => unit.id);
  const allVisibleSelected = visibleUnitIds.length > 0 && visibleUnitIds.every(unitId => selectedIds.has(unitId));
  const previewRows = preview?.previewRows || [];
  const visibleRows = previewRows.slice(0, 40);
  const remainingRows = Math.max(0, previewRows.length - visibleRows.length);
  const confirmationSignature = `${[...selectedUnitIds].sort().join(',')}|${statKey}|${mode}|${value}`;
  const largeBatchConfirmed = largeBatchConfirmation === confirmationSignature;
  const needsLargeBatchConfirmation = Boolean(preview?.requiresLargeScopeConfirmation);
  const canApply = selectedUnitIds.length > 0
    && isValid
    && !preview?.blocked
    && previewRows.length > 0
    && (!needsLargeBatchConfirmation || largeBatchConfirmed);

  useEffect(() => {
    setPage(1);
  }, [normalizedQuery, selectionView]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const changeMode = nextMode => {
    const option = MODE_OPTIONS.find(item => item.id === nextMode);
    onModeChange(nextMode);
    onValueChange(option.defaultValue);
  };

  const submit = event => {
    event.preventDefault();
    if (canApply) onApply({ allowLargeScope: largeBatchConfirmed });
  };

  return (
    <Dialog open={open} onClose={onClose} className="batch-adjust" overlayClassName="batch-adjust-overlay" labelledBy={titleId} describedBy={descriptionId}>
      <form className="batch-adjust__form" onSubmit={submit}>
        <header className="batch-adjust__header">
          <div className="batch-adjust__heading">
            <div className="batch-adjust__title-line">
              <span className="batch-adjust__eyebrow">Selection-first bulk editor</span>
              <Badge tone="success" size="sm">Preview required</Badge>
            </div>
            <h2 id={titleId}>Batch Adjust</h2>
            <p id={descriptionId}>Choose an explicit unit set, configure one operation, then verify every generated edit before applying it.</p>
          </div>
          <IconButton label="Close Batch Adjust" variant="quiet" size="sm" onClick={onClose}>X</IconButton>
        </header>

        <section className="batch-adjust__metrics" aria-label="Adjustment impact summary">
          <div><span>Available</span><strong>{candidateUnits.length.toLocaleString()}</strong><small>{scopeLabel}</small></div>
          <div><span>Selected</span><strong>{selectedUnitIds.length.toLocaleString()}</strong><small>explicit targets</small></div>
          <div><span>Field edits</span><strong>{(preview?.affectedFieldCount || 0).toLocaleString()}</strong><small>one undo step</small></div>
          <div><span>Payload estimate</span><strong>{(preview?.estimatedBase64Chars || 0).toLocaleString()}</strong><small>encoded characters</small></div>
        </section>

        <div className="batch-adjust__workbench">
          <section className="batch-adjust__selection" aria-labelledby={`${titleId}-selection`}>
            <div className="batch-adjust__section-heading">
              <span aria-hidden="true">01</span>
              <div><h3 id={`${titleId}-selection`}>Select units</h3><p>No unit is targeted automatically.</p></div>
            </div>

            <div className="batch-adjust__selection-tools">
              <TextField label="Find units" value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, ID, faction, or tier" />
              <ButtonGroup className="batch-adjust__selection-view" label="Unit selection view">
                <Button size="sm" variant={selectionView === 'candidates' ? 'primary' : 'secondary'} aria-pressed={selectionView === 'candidates'} onClick={() => setSelectionView('candidates')}>
                  Candidates {candidateUnits.length.toLocaleString()}
                </Button>
                <Button size="sm" variant={selectionView === 'selected' ? 'primary' : 'secondary'} aria-pressed={selectionView === 'selected'} onClick={() => setSelectionView('selected')}>
                  Selected {selectedUnitIds.length.toLocaleString()}
                </Button>
              </ButtonGroup>
              <div className="batch-adjust__selection-actions">
                <Button size="sm" variant="secondary" disabled={!currentUnitId || selectedIds.has(currentUnitId)} onClick={() => onSelectUnits([currentUnitId])}>Add current</Button>
                <Button size="sm" variant="secondary" disabled={visibleUnitIds.length === 0 || allVisibleSelected} onClick={() => onSelectUnits(visibleUnitIds)}>Select page</Button>
                <Button size="sm" variant="quiet" disabled={!visibleUnitIds.some(unitId => selectedIds.has(unitId))} onClick={() => onDeselectUnits(visibleUnitIds)}>Clear page</Button>
                <Button size="sm" variant="quiet" disabled={selectedUnitIds.length === 0} onClick={onClearSelection}>Clear all</Button>
              </div>
            </div>

            <div className="batch-adjust__unit-list" role="list" aria-label="Selectable units">
              {visibleUnits.length === 0 ? (
                <div className="batch-adjust__unit-empty">
                  <strong>{selectionView === 'selected' ? 'No units selected' : 'No matching units'}</strong>
                  <span>{selectionView === 'selected' ? 'Return to Candidates and choose the units this operation may change.' : 'Try a different search term.'}</span>
                </div>
              ) : visibleUnits.map(unit => {
                const isSelected = selectedIds.has(unit.id);
                return (
                  <button key={unit.id} className={`batch-adjust__unit-option${isSelected ? ' is-selected' : ''}`} type="button" aria-pressed={isSelected} onClick={() => onToggleUnit(unit.id)}>
                    <UnitArtwork unitId={unit.isClone ? (unit.baseId || unit.id) : unit.id} alt="" loading="lazy" />
                    <span className="batch-adjust__unit-copy"><strong>{unit.name || unit.id}</strong><small>{unit.id}</small></span>
                    <span className="batch-adjust__unit-meta">{getUnitTier(unit) || unit.faction?.toUpperCase() || 'UNIT'}</span>
                    <span className="batch-adjust__unit-state">{isSelected ? 'Selected' : 'Add'}</span>
                  </button>
                );
              })}
            </div>

            <div className="batch-adjust__pagination">
              <Button size="sm" variant="quiet" disabled={page <= 1} onClick={() => setPage(current => current - 1)}>Previous</Button>
              <span>{filteredUnits.length.toLocaleString()} units · page {page} of {pageCount}</span>
              <Button size="sm" variant="quiet" disabled={page >= pageCount} onClick={() => setPage(current => current + 1)}>Next</Button>
            </div>
          </section>

          <section className="batch-adjust__configuration" aria-labelledby={`${titleId}-configuration`}>
            <div className="batch-adjust__section-heading">
              <span aria-hidden="true">02</span>
              <div><h3 id={`${titleId}-configuration`}>Configure</h3><p>Only curated numeric fields with existing BAR values are eligible.</p></div>
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
                  <Button key={option.id} variant={mode === option.id ? 'primary' : 'secondary'} aria-pressed={mode === option.id} onClick={() => changeMode(option.id)}>{option.label}</Button>
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
              <strong>Export-safe workflow</strong>
              <p>Only selected units are compiled. Missing fields are skipped, invalid results are rejected, and large payloads require an extra confirmation.</p>
            </div>
          </section>

          <section className="batch-adjust__preview" aria-labelledby={`${titleId}-preview`}>
            <div className="batch-adjust__preview-heading">
              <div className="batch-adjust__section-heading">
                <span aria-hidden="true">03</span>
                <div><h3 id={`${titleId}-preview`}>Verify changes</h3><p>Review the exact values that will be written.</p></div>
              </div>
              <Badge tone={canApply ? 'success' : 'warning'} size="sm">{canApply ? 'Ready' : selectedUnitIds.length === 0 ? 'Select units' : 'Review'}</Badge>
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
                  <strong>{preview?.error || 'No eligible changes for this selection.'}</strong>
                  <span>{selectedUnitIds.length === 0 ? 'Use the unit selector to create a deliberate batch.' : 'Choose another parameter, operation, or value.'}</span>
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

            {needsLargeBatchConfirmation && (
              <label className="batch-adjust__large-confirmation">
                <input type="checkbox" checked={largeBatchConfirmed} onChange={event => setLargeBatchConfirmation(event.target.checked ? confirmationSignature : '')} />
                <span><strong>Confirm large export impact</strong><small>I reviewed {preview.affectedUnitCount.toLocaleString()} affected units and the projected {(preview.estimatedBase64Chars || 0).toLocaleString()} encoded characters.</small></span>
              </label>
            )}
          </section>
        </div>

        <footer className="batch-adjust__footer">
          <div><strong>{canApply ? `${preview.affectedFieldCount.toLocaleString()} edits ready` : 'Nothing will be written yet'}</strong><span>Applying creates one project-history transaction. Undo restores the previous state.</span></div>
          <div className="batch-adjust__footer-actions">
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button variant="primary" type="submit" disabled={!canApply}>Apply to {(preview?.affectedUnitCount || 0).toLocaleString()} {preview?.affectedUnitCount === 1 ? 'unit' : 'units'}</Button>
          </div>
        </footer>
      </form>
    </Dialog>
  );
}
