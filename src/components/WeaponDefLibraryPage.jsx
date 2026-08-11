import { useEffect, useId, useMemo, useState } from 'react';
import {
  analyzeSupportingWeaponDefLibrary,
  createSupportingWeaponDefFromSource,
  getSupportingWeaponDefDestination,
} from '../utils/supportingWeaponDefLibrary.js';
import { Button, EmptyState, PageShell, SelectField, StatusBadge, Switch, TextField, Type } from './ui.jsx';
import '../styles/features/weapondef-library.css';

const STATUS_LABELS = Object.freeze({
  ready: 'Ready',
  review: 'Review',
  error: 'Invalid',
  disabled: 'Disabled',
});

const STATUS_TONES = Object.freeze({
  ready: 'success',
  review: 'warning',
  error: 'danger',
  disabled: 'neutral',
});

function createDefinition(ownerUnitId, key, definition = { damage: { default: 0 } }) {
  return {
    id: `support_manual_${ownerUnitId}_${key}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerUnitId,
    key,
    label: key.toUpperCase(),
    definition,
    enabled: true,
    alwaysExport: false,
    mode: 'replace',
    role: 'auxiliary',
    mountedSlots: [],
    dependencies: [],
    referencedBy: [],
    sourceName: 'Created in BAR Editor',
  };
}

function formatFieldValue(value) {
  if (value === null || value === undefined) return 'unset';
  const text = typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
  if (!text) return 'unset';
  return text.length > 34 ? `${text.slice(0, 34)}…` : text;
}

function DefinitionEditor({ entry, allDestinations, onUpdate, onAdd, onRemove, onOpenUnit, onNotice }) {
  const [draft, setDraft] = useState(() => JSON.stringify(entry.definition || {}, null, 2));
  const [draftError, setDraftError] = useState('');
  const [pendingDelete, setPendingDelete] = useState(false);

  useEffect(() => {
    setDraft(JSON.stringify(entry.definition || {}, null, 2));
    setDraftError('');
    setPendingDelete(false);
  }, [entry.id, entry.definition]);

  const saveDefinition = () => {
    try {
      const parsed = JSON.parse(draft);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Definition must be a JSON object.');
      onUpdate(entry.id, { definition: parsed });
      setDraftError('');
      onNotice?.(`Saved literal fields for ${entry.key.toUpperCase()}.`);
    } catch (error) {
      setDraftError(error.message);
    }
  };

  const duplicateDefinition = () => {
    let suffix = 2;
    let nextKey = `${entry.key}_copy`;
    while (allDestinations.has(`${entry.ownerUnitId}:${nextKey}`)) {
      nextKey = `${entry.key}_copy_${suffix}`;
      suffix += 1;
    }
    onAdd([createDefinition(entry.ownerUnitId, nextKey, structuredClone(entry.definition || {}))]);
    onNotice?.(`Duplicated ${entry.key.toUpperCase()} as ${nextKey.toUpperCase()}.`);
  };

  return (
    <section className="weapondef-editor" aria-labelledby="weapondef-editor-title">
      <header className="weapondef-editor__header">
        <div className="weapondef-editor__heading">
          <Type variant="eyebrow">Definition dossier</Type>
          <Type as="h3" variant="section-title" id="weapondef-editor-title">{entry.label || entry.key.toUpperCase()}</Type>
          <Type as="p" variant="description">{entry.ownerUnitId} / {entry.key}</Type>
        </div>
        <div className="weapondef-editor__controls">
          <StatusBadge status={STATUS_TONES[entry.status]}>{STATUS_LABELS[entry.status]}</StatusBadge>
          <Switch
            label={`Enable ${entry.key} in the project library`}
            checked={entry.enabled}
            onChange={event => onUpdate(entry.id, { enabled: event.target.checked })}
          />
        </div>
      </header>

      {(entry.errors.length > 0 || entry.warnings.length > 0) && (
        <div className={`weapondef-editor__diagnostics is-${entry.errors.length ? 'error' : 'warning'}`} role={entry.errors.length ? 'alert' : 'status'}>
          {[...entry.errors, ...entry.warnings].map(message => <p key={message}>{message}</p>)}
        </div>
      )}

      <div className="weapondef-editor__group">
        <div className="weapondef-editor__group-heading">
          <div>
            <Type as="h4" variant="subsection-title">Identity and routing</Type>
            <p>Ownership, destination key, and how the compiler places this definition.</p>
          </div>
        </div>
        <div className="weapondef-editor__identity">
          <TextField
            label="Owner UnitDef"
            value={entry.ownerUnitId}
            onChange={event => onUpdate(entry.id, { ownerUnitId: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          />
          <TextField
            label="WeaponDef key"
            value={entry.key}
            onChange={event => onUpdate(entry.id, { key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '') })}
          />
          <SelectField label="Write mode" value={entry.mode || 'replace'} onChange={event => onUpdate(entry.id, { mode: event.target.value })}>
            <option value="replace">Replace existing</option>
            <option value="create-only">Create only</option>
          </SelectField>
          <SelectField label="Role" value={entry.role || 'auxiliary'} onChange={event => onUpdate(entry.id, { role: event.target.value })}>
            <option value="auxiliary">Auxiliary</option>
            <option value="dependency">Dependency</option>
            <option value="mounted">Mounted</option>
          </SelectField>
        </div>
        <div className="weapondef-editor__export-policy">
          <div>
            <strong>Always export</strong>
            <span>Pin this definition only when dynamic or imported Lua references it and automatic discovery cannot see the consumer.</span>
          </div>
          <Switch
            label={`Always export ${entry.key}`}
            checked={entry.alwaysExport}
            onChange={event => onUpdate(entry.id, { alwaysExport: event.target.checked })}
          />
        </div>
      </div>

      <div className="weapondef-editor__group">
        <div className="weapondef-editor__group-heading">
          <div>
            <Type as="h4" variant="subsection-title">Literal WeaponDef fields</Type>
            <p>JSON is compiled into the owning UnitDef. Imported Lua is never executed here.</p>
          </div>
          <span className="weapondef-editor__source-stats">{entry.rootFieldCount} fields / {entry.encodedBytes.toLocaleString()} bytes</span>
        </div>
        <textarea className="weapondef-editor__source" value={draft} onChange={event => setDraft(event.target.value)} aria-label={`Literal fields for ${entry.key}`} spellCheck="false" />
        <div className="weapondef-editor__source-actions">
          <span className={draftError ? 'is-error' : ''}>{draftError || 'Valid JSON object required.'}</span>
          <Button variant="primary" onClick={saveDefinition}>Save fields</Button>
        </div>
      </div>

      <footer className="weapondef-editor__actions">
        <Button onClick={() => onOpenUnit(entry.ownerUnitId)}>Open owner unit</Button>
        <Button onClick={duplicateDefinition}>Duplicate</Button>
        <Button variant="danger" onClick={() => setPendingDelete(true)}>Delete</Button>
      </footer>

      {pendingDelete && (
        <div className="weapondef-delete-confirmation" role="alertdialog" aria-labelledby={`delete-weapondef-${entry.id}`}>
          <div><strong id={`delete-weapondef-${entry.id}`}>Delete {entry.key.toUpperCase()}?</strong><span>Consumers that reference this key may stop compiling correctly.</span></div>
          <div><Button size="sm" onClick={() => setPendingDelete(false)}>Cancel</Button><Button size="sm" variant="danger" onClick={() => onRemove(entry.id)}>Delete permanently</Button></div>
        </div>
      )}
    </section>
  );
}

export default function WeaponDefLibraryPage({
  definitions = [],
  knownUnits = [],
  tweaks = {},
  clones = [],
  weaponLibrary = [],
  sourceCatalog = [],
  onAdd,
  onUpdate,
  onRemove,
  onOpenUnit,
  onOpenTweakLab,
  onBack,
  onNotice,
}) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(definitions[0]?.id || '');
  const [newOwner, setNewOwner] = useState('');
  const [newKey, setNewKey] = useState('');
  const [sourceQuery, setSourceQuery] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState('');
  const [sourceResultsOpen, setSourceResultsOpen] = useState(false);
  const [activeSourceIndex, setActiveSourceIndex] = useState(-1);
  const sourceResultsId = useId();
  const analysis = useMemo(() => analyzeSupportingWeaponDefLibrary({
    definitions,
    knownUnitIds: knownUnits,
    tweaks,
    clones,
    weaponLibrary,
  }), [clones, definitions, knownUnits, tweaks, weaponLibrary]);
  const allDestinations = useMemo(() => new Set(definitions.map(getSupportingWeaponDefDestination)), [definitions]);
  const normalizedQuery = query.trim().toLowerCase();
  const sourceMatches = useMemo(() => {
    const normalizedSourceQuery = sourceQuery.trim().toLowerCase();
    const matchingSources = normalizedSourceQuery
      ? sourceCatalog.filter(source => [
        source.sourceWeaponDefKey,
        source.sourceUnitName,
        source.sourceUnitId,
      ].some(value => String(value || '').toLowerCase().includes(normalizedSourceQuery)))
      : sourceCatalog;
    return matchingSources.slice(0, 8);
  }, [sourceCatalog, sourceQuery]);
  const selectedSource = useMemo(
    () => sourceCatalog.find(source => source.id === selectedSourceId) || null,
    [selectedSourceId, sourceCatalog],
  );
  const visibleEntries = analysis.entries.filter(entry => {
    const matchesQuery = !normalizedQuery || `${entry.label || ''} ${entry.ownerUnitId} ${entry.key} ${entry.role || ''}`.toLowerCase().includes(normalizedQuery);
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'issues' ? entry.status === 'error' || entry.status === 'review' : entry.status === statusFilter);
    return matchesQuery && matchesStatus;
  });
  const selectedEntry = visibleEntries.find(entry => entry.id === selectedId) || visibleEntries[0] || null;

  useEffect(() => {
    if (selectedEntry && selectedEntry.id !== selectedId) setSelectedId(selectedEntry.id);
  }, [selectedEntry, selectedId]);

  const createNewDefinition = () => {
    const ownerUnitId = newOwner.trim().toLowerCase();
    const key = newKey.trim().toLowerCase();
    if (!ownerUnitId || !key || allDestinations.has(`${ownerUnitId}:${key}`)) return;
    const definition = createDefinition(ownerUnitId, key);
    onAdd([definition]);
    setSelectedId(definition.id);
    setNewOwner('');
    setNewKey('');
    onNotice?.(`Created ${key.toUpperCase()} for ${ownerUnitId}.`);
  };

  const selectSource = source => {
    setSelectedSourceId(source.id);
    setSourceQuery(`${source.sourceWeaponDefKey} / ${source.sourceUnitName}`);
    setSourceResultsOpen(false);
    setActiveSourceIndex(-1);
    if (!newKey.trim()) setNewKey(`${source.sourceWeaponDefKey}_copy`);
  };

  const openSourceResults = () => {
    if (!sourceQuery.trim()) return;
    setSourceResultsOpen(true);
    const selectedIndex = sourceMatches.findIndex(source => source.id === selectedSourceId);
    setActiveSourceIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const handleSourceSearchKeyDown = event => {
    if (!sourceQuery.trim() || sourceMatches.length === 0) {
      if (event.key === 'Escape') setSourceResultsOpen(false);
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setSourceResultsOpen(true);
      setActiveSourceIndex(index => Math.min(Math.max(index + 1, 0), sourceMatches.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setSourceResultsOpen(true);
      setActiveSourceIndex(index => index <= 0 ? sourceMatches.length - 1 : index - 1);
    } else if (event.key === 'Enter' && sourceResultsOpen && activeSourceIndex >= 0) {
      event.preventDefault();
      selectSource(sourceMatches[activeSourceIndex]);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSourceResultsOpen(false);
      setActiveSourceIndex(-1);
    }
  };

  const createFromSource = () => {
    const ownerUnitId = newOwner.trim().toLowerCase();
    const key = newKey.trim().toLowerCase();
    if (!selectedSource || !ownerUnitId || !key || allDestinations.has(`${ownerUnitId}:${key}`)) return;
    const definition = createSupportingWeaponDefFromSource({ ownerUnitId, key, source: selectedSource });
    onAdd([definition]);
    setSelectedId(definition.id);
    setNewOwner('');
    setNewKey('');
    setSourceQuery('');
    setSelectedSourceId('');
    setSourceResultsOpen(false);
    setActiveSourceIndex(-1);
    onNotice?.(`Copied ${selectedSource.sourceWeaponDefKey.toUpperCase()} into ${key.toUpperCase()} for ${ownerUnitId}.`);
  };

  return (
    <PageShell
      className="weapondef-library-page"
      label="WeaponDef Library"
      eyebrow="Definition engineering"
      title="WeaponDef Library"
      description="Create, validate, and maintain auxiliary WeaponDefs used by cluster, mounted, and advanced projectile systems."
      capabilityId="tool.weapondef-library"
      metrics={[
        { label: 'Definitions', value: analysis.totals.all },
        { label: 'Exported', value: analysis.reachability.totals.included },
        { label: 'Local only', value: analysis.reachability.totals.localOnly },
      ]}
      actions={<Button onClick={onBack}>Back to editor</Button>}
      bodyClassName="weapondef-library-page__body"
    >
      <div className="weapondef-library-layout">
        <aside className="weapondef-catalog" aria-label="Supporting WeaponDef catalog">
          <header>
            <Type variant="eyebrow">Project catalog</Type>
            <Type as="h3" variant="section-title">Definitions</Type>
            <p>One destination is an owner UnitDef plus a unique WeaponDef key.</p>
          </header>
          <div className="weapondef-create">
            <header className="weapondef-create__heading">
              <strong>Create definition</strong>
              <span>Start empty or copy a validated BAR WeaponDef.</span>
            </header>
            <TextField label="Owner UnitDef" placeholder="armflea" value={newOwner} onChange={event => setNewOwner(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
            <TextField label="WeaponDef key" placeholder="cluster_child" value={newKey} onChange={event => setNewKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
            <div className="weapondef-source-picker">
              <label>
                <span>BAR WeaponDef source</span>
                <input
                  type="search"
                  className="ui-control ui-input"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-expanded={sourceResultsOpen}
                  aria-controls={sourceResultsId}
                  aria-activedescendant={sourceResultsOpen && activeSourceIndex >= 0 ? `${sourceResultsId}-option-${activeSourceIndex}` : undefined}
                  placeholder="Search weapon, unit, or definition ID..."
                  value={sourceQuery}
                  onFocus={openSourceResults}
                  onClick={openSourceResults}
                  onKeyDown={handleSourceSearchKeyDown}
                  onChange={event => {
                    setSourceQuery(event.target.value);
                    setSourceResultsOpen(Boolean(event.target.value.trim()));
                    setActiveSourceIndex(event.target.value.trim() ? 0 : -1);
                    if (selectedSource && event.target.value !== `${selectedSource.sourceWeaponDefKey} / ${selectedSource.sourceUnitName}`) setSelectedSourceId('');
                  }}
                />
              </label>
              {sourceResultsOpen && sourceQuery.trim() && (
                <div id={sourceResultsId} className="weapondef-source-picker__results" role="listbox" aria-label="Matching BAR WeaponDefs">
                  {sourceMatches.length ? sourceMatches.map((source, index) => (
                    <button
                      type="button"
                      role="option"
                      id={`${sourceResultsId}-option-${index}`}
                      tabIndex={-1}
                      aria-selected={selectedSource?.id === source.id}
                      key={source.id}
                      className={[selectedSource?.id === source.id && 'is-selected', activeSourceIndex === index && 'is-active'].filter(Boolean).join(' ')}
                      onMouseEnter={() => setActiveSourceIndex(index)}
                      onClick={() => selectSource(source)}
                    >
                      <span><strong>{source.sourceWeaponDefKey.toUpperCase()}</strong><small>{source.sourceUnitName} / {source.sourceUnitId}</small></span>
                      <em>{selectedSource?.id === source.id ? 'Selected' : 'Copy'}</em>
                    </button>
                  )) : <p>No BAR WeaponDefs match this search.</p>}
                </div>
              )}
              {selectedSource && <p className="weapondef-source-picker__selection"><strong>Selected source:</strong> {selectedSource.sourceWeaponDefKey.toUpperCase()} from {selectedSource.sourceUnitName}. Its literal fields will be copied; the original BAR definition remains unchanged.</p>}
            </div>
            <div className="weapondef-create__actions">
              <Button variant="primary" disabled={!newOwner || !newKey || allDestinations.has(`${newOwner}:${newKey}`)} onClick={createNewDefinition}>Create empty</Button>
              <Button disabled={!selectedSource || !newOwner || !newKey || allDestinations.has(`${newOwner}:${newKey}`)} onClick={createFromSource}>Copy BAR source</Button>
            </div>
          </div>
          <div className="weapondef-catalog__filters">
            <label><span className="ui-visually-hidden">Search supporting WeaponDefs</span><input type="search" className="ui-control ui-input" placeholder="Search owner, key, or role..." value={query} onChange={event => setQuery(event.target.value)} /></label>
            <div className="weapondef-catalog__status-group" role="group" aria-label="Definition status filter">
              {['all', 'ready', 'issues', 'disabled'].map(filter => <button type="button" key={filter} className={statusFilter === filter ? 'is-active' : ''} aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>{filter === 'all' ? 'All' : filter === 'issues' ? 'Review' : STATUS_LABELS[filter]}</button>)}
            </div>
          </div>
          <div className="weapondef-catalog__list" aria-live="polite">
            {visibleEntries.length ? visibleEntries.map(entry => (
              <button type="button" key={entry.id} className={selectedEntry?.id === entry.id ? 'is-selected' : ''} onClick={() => setSelectedId(entry.id)} aria-current={selectedEntry?.id === entry.id ? 'true' : undefined}>
                <span><strong>{entry.label || entry.key.toUpperCase()}</strong><small>{entry.ownerUnitId} / {entry.key}</small></span>
                <span className="weapondef-catalog__entry-status">
                  <small>{entry.exportState === 'included' ? 'Exported' : entry.exportState === 'local-only' ? 'Local only' : 'Excluded'}</small>
                  <StatusBadge size="sm" status={STATUS_TONES[entry.status]}>{STATUS_LABELS[entry.status]}</StatusBadge>
                </span>
              </button>
            )) : <EmptyState compact title="No definitions match" description="Clear the search or choose another status." action={<Button size="sm" onClick={() => { setQuery(''); setStatusFilter('all'); }}>Clear filters</Button>} />}
          </div>
          <footer><span>{visibleEntries.length} shown</span><Button size="sm" onClick={onOpenTweakLab}>Import from Tweak Lab</Button></footer>
        </aside>

        <main className="weapondef-workbench">
          {selectedEntry ? <DefinitionEditor entry={selectedEntry} allDestinations={allDestinations} onUpdate={onUpdate} onAdd={onAdd} onRemove={onRemove} onOpenUnit={onOpenUnit} onNotice={onNotice} /> : (
            <EmptyState title="No Supporting WeaponDefs yet" description="Create a literal definition here or import recognized candidates from Tweak Package Lab." action={<Button onClick={onOpenTweakLab}>Open Tweak Package Lab</Button>} />
          )}
        </main>

        <aside className="weapondef-insights" aria-label="Definition relationships">
          <header>
            <Type variant="eyebrow">Relationship desk</Type>
            <Type as="h3" variant="section-title">Usage and dependencies</Type>
          </header>
          {selectedEntry ? (
            <>
              <dl className="weapondef-insights__metrics"><div><dt>Status</dt><dd className={`is-${selectedEntry.status}`}>{STATUS_LABELS[selectedEntry.status]}</dd></div><div><dt>Consumers</dt><dd>{selectedEntry.consumers.length}</dd></div><div><dt>Dependencies</dt><dd>{selectedEntry.dependencies.length}</dd></div><div><dt>Fields</dt><dd>{selectedEntry.rootFieldCount}</dd></div></dl>
              <section><h4>Used by</h4>{selectedEntry.consumers.length ? <ul>{selectedEntry.consumers.map(consumer => <li key={consumer}>{consumer}</li>)}</ul> : <p>No current project consumer was detected.</p>}</section>
              <section><h4>Requires</h4>{selectedEntry.dependencies.length ? <ul>{selectedEntry.dependencies.map(dependency => <li className={selectedEntry.missingDependencies.includes(dependency) ? 'is-missing' : ''} key={dependency}>{dependency}{selectedEntry.missingDependencies.includes(dependency) ? ' / missing' : ''}</li>)}</ul> : <p>No supporting definition dependencies.</p>}</section>
              <section>
                <h4>Literal field inventory</h4>
                {Object.keys(selectedEntry.definition || {}).length ? (
                  <ul className="weapondef-insights__fields">
                    {Object.keys(selectedEntry.definition || {}).sort().map(field => (
                      <li key={field}><span>{field}</span><code title={JSON.stringify(selectedEntry.definition[field]) ?? ''}>{formatFieldValue(selectedEntry.definition[field])}</code></li>
                    ))}
                  </ul>
                ) : <p>No literal fields are defined yet.</p>}
              </section>
              <div className="weapondef-insights__route"><small>Compile route</small><strong>{selectedEntry.exportState === 'included' ? 'Definitions lane' : 'Project library'}</strong><span>{selectedEntry.exportState === 'included' ? 'Included in generated TweakDefs because a reachable project consumer uses it.' : selectedEntry.exportState === 'local-only' ? 'Stored locally and omitted until a project consumer uses it.' : 'Disabled and excluded from output.'}</span></div>
            </>
          ) : <EmptyState compact title="Nothing selected" description="Select or create a definition to inspect its relationships." />}
        </aside>
      </div>
    </PageShell>
  );
}
