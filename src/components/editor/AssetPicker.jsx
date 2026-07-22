import { useId, useMemo, useRef, useState } from 'react';
import { Button, Dialog, IconButton } from '../ui.jsx';
import { ASSET_TYPE_LABELS, getAssetOptions, getAssetPreviewUrl, isKnownBarAsset } from '../../utils/barAssets.js';

export default function AssetPicker({ assetType, label, value = '', placeholder = 'Inherited', onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef(null);
  const titleId = `${useId()}-title`;
  const options = getAssetOptions(assetType);
  const known = isKnownBarAsset(assetType, value);
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matching = needle ? options.filter(option => option.toLowerCase().includes(needle)) : options;
    return matching.slice(0, 160);
  }, [options, query]);

  return (
    <div className="asset-picker">
      <div className="asset-picker__field">
        <input
          type="text"
          className={`stat-card-input ${value && !known ? 'is-unverified' : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={event => onChange(event.target.value)}
          aria-label={label}
        />
        <Button variant="secondary" className="asset-picker__browse" onClick={() => setOpen(true)}>Browse</Button>
      </div>
      {value && <span className={`asset-picker__status ${known ? 'is-known' : 'is-unverified'}`}>{known ? 'BAR asset' : 'Custom / unverified'}</span>}
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        className="asset-picker-dialog"
        labelledBy={titleId}
        initialFocusRef={searchRef}
      >
        <header className="asset-picker-dialog__header">
          <div>
            <span>Validated BAR references</span>
            <h2 id={titleId}>{ASSET_TYPE_LABELS[assetType] || 'Asset browser'}</h2>
            <p>{options.length.toLocaleString()} names found in the bundled BAR definition snapshot.</p>
          </div>
          <IconButton variant="quiet" label="Close asset browser" onClick={() => setOpen(false)}>×</IconButton>
        </header>
        <div className="asset-picker-dialog__search">
          <input
            ref={searchRef}
            type="search"
            value={query}
            placeholder={`Search ${ASSET_TYPE_LABELS[assetType]?.toLowerCase() || 'assets'}…`}
            onChange={event => setQuery(event.target.value)}
          />
          <span>{results.length}{results.length === 160 ? '+' : ''} shown</span>
        </div>
        <div className="asset-picker-dialog__results" role="listbox" aria-label={ASSET_TYPE_LABELS[assetType] || 'BAR assets'}>
          {results.map(option => {
            const previewUrl = getAssetPreviewUrl(assetType, option);
            const scopedPicture = assetType === 'buildPicture' && option.includes('/');
            return (
              <button
                type="button"
                role="option"
                aria-selected={option.toLowerCase() === String(value).toLowerCase()}
                className={`${option.toLowerCase() === String(value).toLowerCase() ? 'is-selected' : ''} ${previewUrl ? 'has-preview' : ''}`}
                key={option}
                onClick={() => { onChange(option); setOpen(false); setQuery(''); }}
              >
                <span className="asset-picker-dialog__option-copy">
                  {previewUrl && <img src={previewUrl} alt="" loading="lazy" decoding="async" />}
                  <span>
                    <code>{option}</code>
                    {scopedPicture && <small>{option.split('/')[0]} variant</small>}
                  </span>
                </span>
                <span className="asset-picker-dialog__select-label">Select</span>
              </button>
            );
          })}
          {results.length === 0 && <p>No matching BAR reference. You can close this browser and enter a custom path manually.</p>}
        </div>
        <footer className="asset-picker-dialog__footer">
          <p>Names are validated against BAR definitions, not copied into your export. Custom paths require the matching asset in the loaded game or mod.</p>
          <Button variant="secondary" onClick={() => setOpen(false)}>Keep manual value</Button>
        </footer>
      </Dialog>
    </div>
  );
}
