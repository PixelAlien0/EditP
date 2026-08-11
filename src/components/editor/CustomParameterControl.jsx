import { useId, useMemo, useRef, useState } from 'react';
import { getCustomParameterEditor } from '../../config/customParameterEditors.js';
import { Button, Dialog, IconButton, Switch } from '../ui.jsx';
import AssetPicker from './AssetPicker.jsx';

const PAGE_SIZE = 80;

function ReferencePicker({ label, type, options = [], value, multiple = false, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const searchRef = useRef(null);
  const titleId = `${useId()}-title`;
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(option => `${option.id} ${option.label} ${option.detail || ''}`.toLowerCase().includes(needle));
  }, [options, query]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedIds = String(value || '').split(/[\s,]+/).filter(Boolean);

  const choose = option => {
    if (multiple) {
      onChange([...new Set([...selectedIds, option.id])].join(', '));
      return;
    }
    onChange(option.id);
    setOpen(false);
    setQuery('');
  };

  return (
    <div className="custom-parameter-reference">
      <input
        className="stat-card-input"
        value={value ?? ''}
        aria-label={`${label} value`}
        onChange={event => onChange(event.target.value)}
      />
      <Button size="sm" variant="secondary" onClick={() => { setPage(0); setOpen(true); }}>Browse</Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="asset-picker-dialog custom-parameter-reference-dialog"
        labelledBy={titleId}
        initialFocusRef={searchRef}
      >
        <header className="asset-picker-dialog__header">
          <div className="asset-picker-dialog__header-copy">
            <span>Validated project references</span>
            <h2 id={titleId}>Choose {type === 'unit' ? 'a UnitDef' : 'a WeaponDef'}</h2>
            <p>{multiple ? 'Add one or more references to the current value.' : 'Select a reference without typing an internal identifier.'}</p>
          </div>
          <IconButton size="sm" variant="quiet" label="Close reference picker" onClick={() => setOpen(false)}>x</IconButton>
        </header>
        <div className="asset-picker-dialog__search">
          <label>
            <span className="ui-visually-hidden">Search references</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              placeholder={`Search ${type === 'unit' ? 'units' : 'weapons'}...`}
              onChange={event => { setQuery(event.target.value); setPage(0); }}
            />
          </label>
          <span className="asset-picker-dialog__match-count" aria-live="polite">{filtered.length.toLocaleString()} matches</span>
        </div>
        <div className="asset-picker-dialog__results" role="listbox" aria-label={`${label} references`}>
          {visible.map(option => {
            const selected = selectedIds.includes(option.id);
            return (
              <button
                type="button"
                role="option"
                aria-selected={selected}
                key={option.id}
                className={selected ? 'is-selected' : ''}
                onClick={() => choose(option)}
              >
                <span className="asset-picker-dialog__option-copy">
                  <span>
                    <strong>{option.label}</strong>
                    <code>{option.id}</code>
                    <small>{option.detail || (type === 'unit' ? 'UnitDef' : 'WeaponDef')}</small>
                  </span>
                </span>
                <span className="asset-picker-dialog__select-label">{selected ? 'Selected' : multiple ? 'Add' : 'Select'}</span>
              </button>
            );
          })}
          {visible.length === 0 && <p>No matching reference. Enter a package-provided ID manually if it is not in this project.</p>}
        </div>
        <nav className="asset-picker-dialog__pagination" aria-label="Reference pages">
          <Button size="sm" variant="quiet" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>Previous</Button>
          <span>Page {currentPage + 1} of {pageCount}</span>
          <Button size="sm" variant="quiet" disabled={currentPage >= pageCount - 1} onClick={() => setPage(currentPage + 1)}>Next</Button>
        </nav>
        <footer className="asset-picker-dialog__footer">
          <p>References come from the current BAR snapshot and project clones. Manual package IDs remain supported.</p>
          <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>{multiple ? 'Done' : 'Keep manual value'}</Button>
        </footer>
      </Dialog>
    </div>
  );
}

export default function CustomParameterControl({ definition, label, value, onChange, referenceCatalogs = {} }) {
  const editor = getCustomParameterEditor(definition);
  const controlLabel = label || definition?.label || definition?.key || 'Custom parameter';

  if (editor.kind === 'asset') {
    return <AssetPicker assetType={editor.assetType} label={controlLabel} value={value ?? ''} onChange={onChange} />;
  }
  if (editor.kind === 'reference' || editor.kind === 'reference-list') {
    const options = editor.referenceType === 'weapon' ? (referenceCatalogs.weapons || []) : (referenceCatalogs.units || []);
    return (
      <ReferencePicker
        label={controlLabel}
        type={editor.referenceType}
        options={options}
        value={value}
        multiple={editor.kind === 'reference-list'}
        onChange={onChange}
      />
    );
  }
  if (editor.kind === 'boolean') {
    const checked = value === true || value === 1 || value === '1' || value === 'true';
    return (
      <div className="custom-parameter-boolean">
        <Switch label={controlLabel} checked={checked} onChange={event => onChange(event.target.checked)} />
        <span>{checked ? 'Enabled' : 'Disabled'}</span>
      </div>
    );
  }
  if (editor.kind === 'enum') {
    const hasCurrentValue = value !== undefined && value !== null && value !== ''
      && !editor.options.map(String).includes(String(value));
    return (
      <select className="stat-card-input" aria-label={`${controlLabel} value`} value={value ?? ''} onChange={event => onChange(event.target.value)}>
        {hasCurrentValue && <option value={value}>Current: {String(value)}</option>}
        {editor.options.map(option => <option key={String(option)} value={option}>{option}</option>)}
      </select>
    );
  }
  if (editor.kind === 'number') {
    return (
      <div className="custom-parameter-number">
        <input
          className="stat-card-input"
          type="number"
          min={editor.min}
          max={editor.max}
          step={editor.step ?? 'any'}
          aria-label={`${controlLabel} value`}
          value={value ?? ''}
          onChange={event => onChange(event.target.value)}
        />
        {editor.unit && <span>{editor.unit}</span>}
      </div>
    );
  }

  const listId = editor.kind === 'suggested-text' ? `${definition.id || definition.key}-suggestions` : undefined;
  return (
    <>
      <input
        className="stat-card-input"
        type="text"
        list={listId}
        aria-label={`${controlLabel} value`}
        value={value ?? ''}
        onChange={event => onChange(event.target.value)}
      />
      {listId && <datalist id={listId}>{editor.options.map(option => <option key={String(option)} value={String(option)} />)}</datalist>}
    </>
  );
}
