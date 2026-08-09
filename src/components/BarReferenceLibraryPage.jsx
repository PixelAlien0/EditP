import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, PageShell, Type } from './ui.jsx';
import SoundPreviewButton from './ui/SoundPreviewButton.jsx';
import UnitArtwork from './UnitArtwork.jsx';
import {
  BAR_REFERENCE_CATEGORIES,
  buildBarReferenceCatalog,
  filterBarReferences,
} from '../utils/barReferenceLibrary.js';
import '../styles/features/bar-reference-library.css';

const PAGE_SIZE = 80;
const LazyBarModelViewer = lazy(() => import('./BarModelViewer.jsx'));

const REFERENCE_GLYPHS = Object.freeze({
  weapon: 'W',
  explosionProfile: 'X',
  unitModel: '3D',
  unitScript: 'L',
  projectileModel: 'P',
  sound: 'S',
  ceg: 'FX',
  texture: 'T',
  iconType: 'I',
  collisionVolumeType: 'C',
});

const FACTION_OPTIONS = [
  { value: 'all', label: 'All factions' },
  { value: 'arm', label: 'ARM · Armada' },
  { value: 'core', label: 'CORE · Cortex' },
  { value: 'scavenger', label: 'Scavengers' },
  { value: 'raptor', label: 'Raptors' },
  { value: 'other', label: 'Other / common' },
];

const USAGE_STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'used', label: 'Used in definitions' },
  { value: 'unused', label: 'Unused standalone' },
];

const SORT_OPTIONS = [
  { value: 'relevance', label: 'Catalog order' },
  { value: 'usage-desc', label: 'Most used first' },
  { value: 'name-asc', label: 'Name · A–Z' },
  { value: 'name-desc', label: 'Name · Z–A' },
];

function ReferenceGlyph({ item }) {
  if (item.previewUrl) {
    return <UnitArtwork className="bar-reference-card__preview" src={item.previewUrl} alt="" loading="lazy" decoding="async" />;
  }
  return (
    <span className={`bar-reference-card__glyph is-${item.category}`} aria-hidden="true">
      {REFERENCE_GLYPHS[item.category] || 'R'}
    </span>
  );
}

function ReferenceCard({ item, selected, onSelect }) {
  return (
    <article
      role="listitem"
      className={`bar-reference-card is-${item.category} ${selected ? 'is-selected' : ''} ${item.previewUrl ? 'has-preview' : ''}`}
    >
      <button
        type="button"
        className="bar-reference-card__select"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <ReferenceGlyph item={item} />
        <span className="bar-reference-card__copy">
          <small>{item.subtitle}</small>
          <strong>{item.title}</strong>
          <span>{item.description}</span>
        </span>
        <span className="bar-reference-card__signals">
          <em>{item.usedBy?.length > 0 ? `${item.usedBy.length} uses` : 'Verified'}</em>
          <code>{item.value}</code>
        </span>
      </button>
      {item.category === 'sound' && (
        <SoundPreviewButton soundName={item.value} compact className="bar-reference-card__audio" />
      )}
    </article>
  );
}

function ReferenceInspector({ item, catalogById, onSelect, onOpenUnit, onCopy }) {
  if (!item) {
    return (
      <aside className="bar-reference-inspector is-empty" aria-label="Reference details">
        <Type variant="eyebrow">Reference desk</Type>
        <Type as="h3" variant="section-title">Select a BAR reference</Type>
        <Type as="p" variant="description">Inspect exact names, ownership, reverse usage, and verified asset details.</Type>
      </aside>
    );
  }

  const canOpenUnit = Boolean(onOpenUnit && (item.category === 'unit' || item.ownerUnitId));
  const unitId = item.category === 'unit' ? item.value : item.ownerUnitId;
  const isSound = item.category === 'sound';
  const modelPrototype = (item.category === 'unit' && item.value.toLowerCase() === 'corak')
    || (item.category === 'unitModel' && item.value.replace(/\\/g, '/').toLowerCase().endsWith('/corak.s3o'));

  return (
    <aside className="bar-reference-inspector" aria-label="Reference details">
      <header>
        <ReferenceGlyph item={item} />
        <div>
          <Type variant="eyebrow">{item.subtitle}</Type>
          <Type as="h3" variant="section-title">{item.title}</Type>
          <Type as="code" variant="technical">{item.value}</Type>
        </div>
      </header>

      <p className="bar-reference-inspector__description">{item.description}</p>
      <div className="bar-reference-inspector__actions">
        {isSound && <SoundPreviewButton soundName={item.value} />}
        <Button variant="primary" size="sm" onClick={() => onCopy(item.value)}>Copy exact value</Button>
        {canOpenUnit && <Button size="sm" onClick={() => onOpenUnit(unitId)}>Open unit editor</Button>}
      </div>

      {modelPrototype && <ReferenceModelPrototype />}

      <section className="bar-reference-inspector__facts" aria-label="Reference properties">
        <div className="bar-reference-inspector__section-heading">
          <span>Definition facts</span>
          <small>{item.details.length} fields</small>
        </div>
        <dl>
          {item.details.map(entry => (
            <div key={`${entry.label}-${entry.value}`}>
              <dt>{entry.label}</dt>
              <dd>{entry.value}{entry.unit ? ` ${entry.unit}` : ''}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bar-reference-inspector__usage" aria-label="Used by definitions">
        <div className="bar-reference-inspector__section-heading">
          <span>Used by</span>
          <small>{item.usedBy?.length || 0} bundled references</small>
        </div>
        {item.usedBy?.length > 0 ? (
          <div className="bar-reference-inspector__usage-list">
            {item.usedBy.slice(0, 24).map(reference => (
              <button type="button" key={reference.id} onClick={() => catalogById.has(reference.id) && onSelect(reference.id)}>
                <strong>{reference.title}</strong>
                <small>{reference.subtitle}</small>
                <span aria-hidden="true">→</span>
              </button>
            ))}
            {item.usedBy.length > 24 && <p>+{item.usedBy.length - 24} additional references</p>}
          </div>
        ) : <p>No bundled UnitDef, mounted WeaponDef, or explosion profile references this exact value.</p>}
      </section>

      <footer>
        <strong>{isSound ? 'Official BAR audio preview' : 'Reference only'}</strong>
        <span>{isSound
          ? 'Audio is streamed from the BAR source repository and is not added to generated tweaks.'
          : 'Copying a value does not add its underlying asset to generated tweaks.'}</span>
      </footer>
    </aside>
  );
}

function ReferenceModelPrototype() {
  const [open, setOpen] = useState(false);
  return (
    <section className="bar-reference-inspector__model" aria-label="3D model preview">
      <div className="bar-reference-inspector__section-heading">
        <div>
          <span>3D model reference</span>
          <small>CORAK proof of concept</small>
        </div>
        <Button size="sm" variant={open ? 'quiet' : 'secondary'} aria-expanded={open} onClick={() => setOpen(value => !value)}>
          {open ? 'Close viewer' : 'Open 3D viewer'}
        </Button>
      </div>
      {open && (
        <Suspense fallback={<div className="bar-model-viewer__fallback" role="status">Loading the isolated 3D viewer…</div>}>
          <LazyBarModelViewer />
        </Suspense>
      )}
    </section>
  );
}

function FilterSelect({ label, value, options, onChange }) {
  return (
    <label className="bar-reference-library__select-label">
      <span>{label}</span>
      <select
        className="bar-reference-library__select"
        value={value}
        aria-label={`Filter by ${label.toLowerCase()}`}
        onChange={event => onChange(event.target.value)}
      >
        {options.map(option => <option value={option.value} key={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export default function BarReferenceLibraryPage({
  units = [],
  defaultsDb = {},
  explosionProfiles = {},
  onBack,
  onOpenUnit,
  onToast = () => {},
}) {
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [faction, setFaction] = useState('all');
  const [usageStatus, setUsageStatus] = useState('all');
  const [sortBy, setSortBy] = useState('relevance');
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState('');
  const resultsRef = useRef(null);

  const catalog = useMemo(
    () => buildBarReferenceCatalog({ units, defaultsDb, explosionProfiles }),
    [units, defaultsDb, explosionProfiles],
  );
  const catalogById = useMemo(
    () => new Map(catalog.items.map(item => [item.id, item])),
    [catalog.items],
  );
  const filtered = useMemo(
    () => filterBarReferences(catalog.items, { category, query, faction, usageStatus, sortBy }),
    [catalog.items, category, query, faction, usageStatus, sortBy],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visibleItems = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const selectedItem = catalogById.get(selectedId) || visibleItems[0] || null;
  const rangeStart = filtered.length ? currentPage * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, filtered.length);
  const hasActiveFilters = Boolean(query.trim()) || faction !== 'all' || usageStatus !== 'all' || sortBy !== 'relevance';
  const activeCategory = BAR_REFERENCE_CATEGORIES.find(item => item.id === category);

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
  const clearFilters = () => {
    setQuery('');
    setFaction('all');
    setUsageStatus('all');
    setSortBy('relevance');
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
    <PageShell
      className="bar-reference-library"
      label="Unified BAR Reference Library"
      eyebrow="Bundled game knowledge"
      title="Unified BAR Reference Library"
      description="Search exact UnitDef, WeaponDef, artwork, model, script, effect, sound, texture, and explosion names from one verified workspace."
      capabilityId="tool.reference-library"
      metrics={[
        { label: 'references', value: catalog.items.length.toLocaleString() },
        { label: 'units', value: catalog.counts.unit?.toLocaleString() || 0 },
        { label: 'mounted weapons', value: catalog.counts.weapon?.toLocaleString() || 0 },
      ]}
      actions={<Button variant="secondary" onClick={onBack}>Back to editor</Button>}
      bodyClassName="bar-reference-library__body"
      footer={(
        <>
          <span>Source <strong>{catalog.metadata.sourceRepository}</strong></span>
          <span>Snapshot <code>{catalog.metadata.sourceCommit?.slice(0, 12) || 'bundled'}</code></span>
          <span>Schema v{catalog.metadata.version}</span>
        </>
      )}
    >
      <nav className="bar-reference-library__categories" aria-label="Reference categories">
        {BAR_REFERENCE_CATEGORIES.map(item => (
          <button
            type="button"
            key={item.id}
            className={category === item.id ? 'is-active' : ''}
            aria-pressed={category === item.id}
            onClick={() => changeCategory(item.id)}
          >
            <span>{item.shortLabel}</span>
            <small>{(catalog.counts[item.id] || 0).toLocaleString()}</small>
          </button>
        ))}
      </nav>

      <section className="bar-reference-library__toolbar" aria-label="Reference search and filters">
        <label className="bar-reference-library__search">
          <span>Search the library</span>
          <span className="bar-reference-library__search-control">
            <input
              type="search"
              aria-label="Search the library"
              value={query}
              placeholder="Name, ID, asset path, owner, effect, or category…"
              onChange={event => { setQuery(event.target.value); setPage(0); setSelectedId(''); }}
            />
            {query && (
              <button type="button" aria-label="Clear reference search" onClick={() => { setQuery(''); setPage(0); setSelectedId(''); }}>
                Clear
              </button>
            )}
          </span>
        </label>
        <div className="bar-reference-library__filter-group">
          <FilterSelect label="Faction" value={faction} options={FACTION_OPTIONS} onChange={value => { setFaction(value); setPage(0); setSelectedId(''); }} />
          <FilterSelect label="Usage" value={usageStatus} options={USAGE_STATUS_OPTIONS} onChange={value => { setUsageStatus(value); setPage(0); setSelectedId(''); }} />
          <FilterSelect label="Sort by" value={sortBy} options={SORT_OPTIONS} onChange={value => { setSortBy(value); setPage(0); setSelectedId(''); }} />
          {hasActiveFilters && <Button size="sm" variant="quiet" className="bar-reference-library__reset" onClick={clearFilters}>Reset filters</Button>}
        </div>
        <div className="bar-reference-library__result-count" aria-live="polite">
          <strong>{filtered.length.toLocaleString()}</strong>
          <span>matches</span>
        </div>
      </section>

      <div className="bar-reference-library__workspace">
        <section className="bar-reference-results" aria-label="BAR references">
          <header className="bar-reference-results__header">
            <div>
              <Type variant="eyebrow">Catalog entries</Type>
              <Type as="h2" variant="subsection-title">{activeCategory?.label || 'References'}</Type>
            </div>
            <Type variant="technical">{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} shown</Type>
          </header>
          <div ref={resultsRef} className="bar-reference-results__grid" role="list" aria-label="Matching BAR references">
            {visibleItems.map(item => (
              <ReferenceCard key={item.id} item={item} selected={selectedItem?.id === item.id} onSelect={() => setSelectedId(item.id)} />
            ))}
            {visibleItems.length === 0 && (
              <EmptyState
                title="No references match"
                description="Try a broader search, another category, or include unused validated assets."
                action={<Button size="sm" onClick={clearFilters}>Clear filters</Button>}
              />
            )}
          </div>
          {filtered.length > 0 && (
            <nav className="bar-reference-results__pagination" aria-label="Reference pages">
              <Button size="sm" variant="quiet" disabled={currentPage === 0} onClick={() => changePage(currentPage - 1)}>Previous</Button>
              <span>{rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {filtered.length.toLocaleString()}</span>
              <label>
                <span>Page</span>
                <select aria-label="Reference page" value={currentPage} onChange={event => changePage(Number(event.target.value))}>
                  {Array.from({ length: pageCount }, (_, index) => <option key={index} value={index}>{index + 1} of {pageCount}</option>)}
                </select>
              </label>
              <Button size="sm" variant="quiet" disabled={currentPage >= pageCount - 1} onClick={() => changePage(currentPage + 1)}>Next</Button>
            </nav>
          )}
        </section>

        <ReferenceInspector
          item={selectedItem}
          catalogById={catalogById}
          onSelect={setSelectedId}
          onOpenUnit={onOpenUnit}
          onCopy={copyValue}
        />
      </div>
    </PageShell>
  );
}
