import { useEffect, useMemo, useState } from 'react';
import { analyzeSupportingWeaponDefLibrary, getSupportingWeaponDefDestination } from '../utils/supportingWeaponDefLibrary.js';
import { Button, EmptyState, PageShell, Switch, TextField, Type } from './ui.jsx';
import '../styles/features/weapondef-library.css';

const STATUS_LABELS = Object.freeze({
  ready: 'Ready',
  review: 'Review',
  error: 'Invalid',
  disabled: 'Disabled',
});

function createDefinition(ownerUnitId, key, definition = { damage: { default: 0 } }) {
  return {
    id: `support_manual_${ownerUnitId}_${key}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    ownerUnitId,
    key,
    label: key.toUpperCase(),
    definition,
    enabled: true,
    mode: 'replace',
    role: 'auxiliary',
    mountedSlots: [],
    dependencies: [],
    referencedBy: [],
    sourceName: 'Created in BAR Editor',
  };
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
        <div>
          <Type variant="eyebrow">Definition dossier</Type>
          <Type as="h3" variant="section-title" id="weapondef-editor-title">{entry.label || entry.key.toUpperCase()}</Type>
          <Type as="p" variant="description">{entry.ownerUnitId} / {entry.key}</Type>
        </div>
        <Switch
          label={`Compile ${entry.key}`}
          checked={entry.enabled}
          onChange={event => onUpdate(entry.id, { enabled: event.target.checked })}
        />
      </header>

      {(entry.errors.length > 0 || entry.warnings.length > 0) && (
        <div className={`weapondef-editor__diagnostics is-${entry.errors.length ? 'error' : 'warning'}`} role={entry.errors.length ? 'alert' : 'status'}>
          {[...entry.errors, ...entry.warnings].map(message => <p key={message}>{message}</p>)}
        </div>
      )}

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
        <label className="weapondef-native-field"><span>Write mode</span><select value={entry.mode || 'replace'} onChange={event => onUpdate(entry.id, { mode: event.target.value })}><option value="replace">Replace existing</option><option value="create-only">Create only</option></select></label>
        <label className="weapondef-native-field"><span>Role</span><select value={entry.role || 'auxiliary'} onChange={event => onUpdate(entry.id, { role: event.target.value })}><option value="auxiliary">Auxiliary</option><option value="dependency">Dependency</option><option value="mounted">Mounted</option></select></label>
      </div>

      <div className="weapondef-editor__source-heading">
        <div><Type as="h4" variant="subsection-title">Literal WeaponDef fields</Type><p>JSON is compiled into the owning UnitDef. Imported Lua is never executed here.</p></div>
        <span>{entry.rootFieldCount} fields / {entry.encodedBytes.toLocaleString()} bytes</span>
      </div>
      <textarea className="weapondef-editor__source" value={draft} onChange={event => setDraft(event.target.value)} aria-label={`Literal fields for ${entry.key}`} spellCheck="false" />
      <div className="weapondef-editor__source-actions">
        <span className={draftError ? 'is-error' : ''}>{draftError || 'Valid JSON object required.'}</span>
        <Button variant="primary" onClick={saveDefinition}>Save fields</Button>
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
  const analysis = useMemo(() => analyzeSupportingWeaponDefLibrary({
    definitions,
    knownUnitIds: knownUnits,
    tweaks,
  }), [definitions, knownUnits, tweaks]);
  const allDestinations = useMemo(() => new Set(definitions.map(getSupportingWeaponDefDestination)), [definitions]);
  const normalizedQuery = query.trim().toLowerCase();
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
        { label: 'Needs review', value: analysis.totals.issues },
        { label: 'Literal bytes', value: analysis.totals.bytes.toLocaleString() },
      ]}
      actions={<Button onClick={onBack}>Back to editor</Button>}
      bodyClassName="weapondef-library-page__body"
    >
      <div className="weapondef-library-layout">
        <aside className="weapondef-catalog" aria-label="Supporting WeaponDef catalog">
          <header><Type variant="eyebrow">Project catalog</Type><Type as="h3" variant="section-title">Definitions</Type><p>One destination is an owner UnitDef plus a unique WeaponDef key.</p></header>
          <div className="weapondef-create">
            <TextField label="Owner UnitDef" placeholder="armflea" value={newOwner} onChange={event => setNewOwner(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
            <TextField label="WeaponDef key" placeholder="cluster_child" value={newKey} onChange={event => setNewKey(event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} />
            <Button variant="primary" disabled={!newOwner || !newKey || allDestinations.has(`${newOwner}:${newKey}`)} onClick={createNewDefinition}>Create definition</Button>
          </div>
          <div className="weapondef-catalog__filters">
            <label><span className="ui-visually-hidden">Search supporting WeaponDefs</span><input type="search" placeholder="Search owner, key, or role..." value={query} onChange={event => setQuery(event.target.value)} /></label>
            <div role="group" aria-label="Definition status filter">
              {['all', 'ready', 'issues', 'disabled'].map(filter => <button type="button" key={filter} className={statusFilter === filter ? 'is-active' : ''} aria-pressed={statusFilter === filter} onClick={() => setStatusFilter(filter)}>{filter === 'all' ? 'All' : filter === 'issues' ? 'Review' : STATUS_LABELS[filter]}</button>)}
            </div>
          </div>
          <div className="weapondef-catalog__list" aria-live="polite">
            {visibleEntries.length ? visibleEntries.map(entry => (
              <button type="button" key={entry.id} className={selectedEntry?.id === entry.id ? 'is-selected' : ''} onClick={() => setSelectedId(entry.id)} aria-current={selectedEntry?.id === entry.id ? 'true' : undefined}>
                <span className={`weapondef-status-mark is-${entry.status}`} aria-hidden="true" />
                <span><strong>{entry.label || entry.key.toUpperCase()}</strong><small>{entry.ownerUnitId} / {entry.key}</small></span>
                <em className={`is-${entry.status}`}>{STATUS_LABELS[entry.status]}</em>
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
          <header><Type variant="eyebrow">Relationship desk</Type><Type as="h3" variant="section-title">Usage and dependencies</Type></header>
          {selectedEntry ? (
            <>
              <dl className="weapondef-insights__metrics"><div><dt>Status</dt><dd className={`is-${selectedEntry.status}`}>{STATUS_LABELS[selectedEntry.status]}</dd></div><div><dt>Consumers</dt><dd>{selectedEntry.consumers.length}</dd></div><div><dt>Dependencies</dt><dd>{selectedEntry.dependencies.length}</dd></div><div><dt>Fields</dt><dd>{selectedEntry.rootFieldCount}</dd></div></dl>
              <section><h4>Used by</h4>{selectedEntry.consumers.length ? <ul>{selectedEntry.consumers.map(consumer => <li key={consumer}>{consumer}</li>)}</ul> : <p>No current project consumer was detected.</p>}</section>
              <section><h4>Requires</h4>{selectedEntry.dependencies.length ? <ul>{selectedEntry.dependencies.map(dependency => <li className={selectedEntry.missingDependencies.includes(dependency) ? 'is-missing' : ''} key={dependency}>{dependency}{selectedEntry.missingDependencies.includes(dependency) ? ' / missing' : ''}</li>)}</ul> : <p>No supporting definition dependencies.</p>}</section>
              <section><h4>Literal field inventory</h4><ul>{Object.keys(selectedEntry.definition || {}).sort().map(field => <li key={field}>{field}</li>)}</ul></section>
              <div className="weapondef-insights__route"><small>Compile route</small><strong>Definitions lane</strong><span>{selectedEntry.enabled ? 'Included in generated TweakDefs' : 'Excluded from output'}</span></div>
            </>
          ) : <p>Select or create a definition to inspect its relationships.</p>}
        </aside>
      </div>
    </PageShell>
  );
}
