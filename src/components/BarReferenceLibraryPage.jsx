import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, Switch } from './ui.jsx';
import UnitArtwork from './UnitArtwork.jsx';
import {
  BAR_REFERENCE_CATEGORIES,
  buildBarReferenceCatalog,
  filterBarReferences,
} from '../utils/barReferenceLibrary.js';
import '../styles/features/bar-reference-library.css';

const PAGE_SIZE = 80;

function ReferenceGlyph({ item }) {
  if (item.previewUrl) {
    return <UnitArtwork className="bar-reference-card__preview" src={item.previewUrl} alt="" loading="lazy" decoding="async" />;
  }
  const labels = {
    weapon: 'W', explosionProfile: 'X', unitModel: '3D', unitScript: 'L', projectileModel: 'P',
    sound: 'S', ceg: 'FX', texture: 'T', iconType: 'I', collisionVolumeType: 'C',
  };
  return <span className={`bar-reference-card__glyph is-${item.category}`} aria-hidden="true">{labels[item.category] || 'R'}</span>;
}

function ReferenceCard({ item, selected, onSelect }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      className={`bar-reference-card ${selected ? 'is-selected' : ''} ${item.previewUrl ? 'has-preview' : ''}`}
      onClick={onSelect}
    >
      <ReferenceGlyph item={item} />
      <span className="bar-reference-card__copy">
        <small>{item.subtitle}</small>
        <strong>{item.title}</strong>
        <span>{item.description}</span>
      </span>
      <span className="bar-reference-card__signals">
        {item.usedBy?.length > 0 && <em>{item.usedBy.length} uses</em>}
        <code>{item.value}</code>
      </span>
    </button>
  );
}

function ReferenceInspector({ item, catalogById, onSelect, onOpenUnit, onCopy }) {
  if (!item) {
    return (
      <aside className="bar-reference-inspector is-empty" aria-label="Reference details">
        <span>Reference desk</span>
        <h3>Select a BAR reference</h3>
        <p>Inspect exact names, definition values, ownership, and reverse usage without leaving the library.</p>
      </aside>
    );
  }

  const canOpenUnit = item.category === 'unit' || item.ownerUnitId;
  const unitId = item.category === 'unit' ? item.value : item.ownerUnitId;
  return (
    <aside className="bar-reference-inspector" aria-label="Reference details">
      <header>
        <ReferenceGlyph item={item} />
        <div><span>{item.subtitle}</span><h3>{item.title}</h3><code>{item.value}</code></div>
      </header>

      <p className="bar-reference-inspector__description">{item.description}</p>
      <div className="bar-reference-inspector__actions">
        <Button variant="primary" size="sm" onClick={() => onCopy(item.value)}>Copy exact value</Button>
        {canOpenUnit && <Button size="sm" onClick={() => onOpenUnit(unitId)}>Open unit editor</Button>}
      </div>

      <section className="bar-reference-inspector__facts" aria-label="Reference properties">
        <span>Definition facts</span>
        <dl>
          {item.details.map(entry => (
            <div key={`${entry.label}-${entry.value}`}><dt>{entry.label}</dt><dd>{entry.value}{entry.unit ? ` ${entry.unit}` : ''}</dd></div>
          ))}
        </dl>
      </section>

      <section className="bar-reference-inspector__usage" aria-label="Used by definitions">
        <div><span>Used by</span><small>{item.usedBy?.length || 0} bundled references</small></div>
        {item.usedBy?.length > 0 ? (
          <div className="bar-reference-inspector__usage-list">
            {item.usedBy.slice(0, 24).map(reference => (
              <button type="button" key={reference.id} onClick={() => catalogById.has(reference.id) && onSelect(reference.id)}>
                <strong>{reference.title}</strong><small>{reference.subtitle}</small>
              </button>
            ))}
            {item.usedBy.length > 24 && <p>+{item.usedBy.length - 24} additional references</p>}
          </div>
        ) : <p>No bundled UnitDef, mounted WeaponDef, or explosion profile currently references this exact value.</p>}
      </section>

      <footer>
        <strong>Reference only</strong>
        <span>Copying a value does not add its underlying asset to generated tweaks.</span>
      </footer>
    </aside>
  );
}

export default function BarReferenceLibraryPage({ units, defaultsDb, explosionProfiles, onOpenUnit, onBack, onToast }) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [usedOnly, setUsedOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const resultsRef = useRef(null);
  const catalog = useMemo(
    () => buildBarReferenceCatalog({ units, defaultsDb, explosionProfiles }),
    [defaultsDb, explosionProfiles, units]
  );
  const catalogById = useMemo(() => new Map(catalog.items.map(item => [item.id, item])), [catalog.items]);
  const filtered = useMemo(
    () => filterBarReferences(catalog.items, { category, query, usedOnly }),
    [catalog.items, category, query, usedOnly]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedItem = catalogById.get(selectedId) || visibleItems[0] || null;
  const rangeStart = filtered.length ? currentPage * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, filtered.length);

  useEffect(() => {
    if (selectedItem && selectedId !== selectedItem.id) setSelectedId(selectedItem.id);
  }, [selectedId, selectedItem]);

  const changePage = nextPage => {
    setPage(Math.max(0, Math.min(nextPage, pageCount - 1)));
    setSelectedId('');
    requestAnimationFrame(() => resultsRef.current?.scrollTo({ top: 0 }));
  };
  const changeCategory = nextCategory => {
    setCategory(nextCategory);
    setPage(0);
    setSelectedId('');
  };
  const copyValue = async value => {
    try {
      await navigator.clipboard.writeText(value);
      onToast(`Copied ${value}`);
    } catch {
      onToast('Clipboard access is unavailable.');
    }
  };

  return (
    <main className="bar-reference-library" aria-labelledby="bar-reference-library-title">
      <header className="bar-reference-library__hero">
        <div>
          <span className="workflow-eyebrow">Bundled game knowledge</span>
          <h2 id="bar-reference-library-title">Unified BAR Reference Library</h2>
          <p>Search exact UnitDef, WeaponDef, artwork, model, script, effect, sound, texture, and explosion names from one verified workspace.</p>
        </div>
        <div className="bar-reference-library__hero-meta">
          <div><strong>{catalog.items.length.toLocaleString()}</strong><span>references</span></div>
          <div><strong>{catalog.counts.unit?.toLocaleString() || 0}</strong><span>units</span></div>
          <div><strong>{catalog.counts.weapon?.toLocaleString() || 0}</strong><span>mounted weapons</span></div>
          <Button onClick={onBack}>Back to editor</Button>
        </div>
      </header>

      <nav className="bar-reference-library__categories" aria-label="Reference categories">
        {BAR_REFERENCE_CATEGORIES.map(item => (
          <button
            type="button"
            key={item.id}
            className={category === item.id ? 'is-active' : ''}
            aria-current={category === item.id ? 'page' : undefined}
            onClick={() => changeCategory(item.id)}
          >
            <span>{item.shortLabel}</span><small>{(catalog.counts[item.id] || 0).toLocaleString()}</small>
          </button>
        ))}
      </nav>

      <section className="bar-reference-library__toolbar" aria-label="Reference search">
        <label className="bar-reference-library__search">
          <span>Search the library</span>
          <input
            type="search"
            value={query}
            placeholder="Name, ID, asset path, owner, effect, or category…"
            onChange={event => { setQuery(event.target.value); setPage(0); setSelectedId(''); }}
          />
        </label>
        <Switch
          className="bar-reference-library__used-toggle"
          label="Show references used by bundled definitions only"
          checked={usedOnly}
          onChange={event => { setUsedOnly(event.target.checked); setPage(0); setSelectedId(''); }}
        >
          <span><strong>Used references only</strong><small>Hide validated but currently unreferenced assets</small></span>
        </Switch>
        <div className="bar-reference-library__result-count"><strong>{filtered.length.toLocaleString()}</strong><span>matches</span></div>
      </section>

      <div className="bar-reference-library__workspace">
        <section className="bar-reference-results" aria-label="BAR references">
          <div ref={resultsRef} className="bar-reference-results__grid" role="listbox" aria-label="Matching BAR references">
            {visibleItems.map(item => (
              <ReferenceCard key={item.id} item={item} selected={selectedItem?.id === item.id} onSelect={() => setSelectedId(item.id)} />
            ))}
            {visibleItems.length === 0 && (
              <EmptyState title="No references match" description="Try a broader search, another category, or include unused validated assets." />
            )}
          </div>
          {filtered.length > 0 && (
            <nav className="bar-reference-results__pagination" aria-label="Reference pages">
              <Button size="sm" variant="quiet" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Previous</Button>
              <span>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {filtered.length.toLocaleString()}</span>
              <label><span>Page</span><select aria-label="Reference page" value={currentPage} onChange={event => changePage(Number(event.target.value))}>{Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} of {pageCount}</option>)}</select></label>
              <Button size="sm" variant="quiet" disabled={currentPage >= pageCount - 1} onClick={() => changePage(currentPage + 1)}>Next</Button>
            </nav>
          )}
        </section>

        <ReferenceInspector item={selectedItem} catalogById={catalogById} onSelect={setSelectedId} onOpenUnit={onOpenUnit} onCopy={copyValue} />
      </div>

      <footer className="bar-reference-library__footer">
        <span>Source <strong>{catalog.metadata.sourceRepository}</strong></span>
        <span>Snapshot <code>{catalog.metadata.sourceCommit?.slice(0, 12) || 'bundled'}</code></span>
        <span>Schema v{catalog.metadata.version}</span>
      </footer>
    </main>
  );
}
