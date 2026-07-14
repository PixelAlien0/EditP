import { useMemo, useState } from 'react';
import UnitArtwork from './UnitArtwork.jsx';
import UnitCollectionsPanel from './editor/UnitCollectionsPanel.jsx';
import { getCollectionDescendantIds, getCollectionUnitIds } from '../project/unitCollections.js';
import { getUnitIconUrl } from '../utils/unitArtwork.js';

const RESULT_LIMIT = 300;

export default function CollectionsPage({
  collections,
  activeCollectionId,
  units,
  selectedUnit,
  tweaks,
  validationIssues,
  onSelectCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onToggleMembership,
  onCleanupCollection,
  onEditUnit,
  onBack,
}) {
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [membershipFilter, setMembershipFilter] = useState('all');
  const availableUnitIds = useMemo(() => units.map(unit => unit.id), [units]);
  const availableIds = useMemo(() => new Set(availableUnitIds), [availableUnitIds]);
  const activeCollection = collections.find(collection => collection.id === activeCollectionId) || null;
  const directIds = useMemo(() => new Set(activeCollection?.unitIds || []), [activeCollection]);
  const scopeIds = useMemo(
    () => activeCollection ? getCollectionUnitIds(collections, activeCollection.id) : new Set(),
    [activeCollection, collections]
  );
  const descendantIds = useMemo(
    () => activeCollection ? getCollectionDescendantIds(collections, activeCollection.id) : new Set(),
    [activeCollection, collections]
  );
  const nestedOnlyIds = useMemo(() => new Set([...scopeIds].filter(id => !directIds.has(id))), [directIds, scopeIds]);
  const unresolvedIds = useMemo(() => [...scopeIds].filter(id => !availableIds.has(id)), [availableIds, scopeIds]);
  const validationCount = validationIssues.filter(issue => scopeIds.has(issue.unitId)).length;
  const modifiedCount = units.filter(unit => scopeIds.has(unit.id) && Object.keys(tweaks[unit.id] || {}).length > 0).length;

  const filteredUnits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return units.filter(unit => {
      if (sourceFilter === 'vanilla' && unit.isClone) return false;
      if (sourceFilter === 'custom' && !unit.isClone) return false;
      if (membershipFilter === 'included' && !scopeIds.has(unit.id)) return false;
      if (membershipFilter === 'direct' && !directIds.has(unit.id)) return false;
      if (membershipFilter === 'available' && scopeIds.has(unit.id)) return false;
      return !needle || `${unit.name} ${unit.id} ${unit.faction} ${unit.tags.join(' ')}`.toLowerCase().includes(needle);
    });
  }, [directIds, membershipFilter, query, scopeIds, sourceFilter, units]);

  const visibleUnits = filteredUnits.slice(0, RESULT_LIMIT);

  return (
    <main className="collections-page" aria-labelledby="collections-page-title">
      <header className="collections-page__hero">
        <div>
          <span className="workflow-eyebrow">Reusable unit scopes</span>
          <h2 id="collections-page-title">Collections</h2>
          <p>Organize vanilla and custom units into nested, overlapping folders for focused editing and review.</p>
        </div>
        <div className="collections-page__hero-actions">
          <div><strong>{collections.length}</strong><span>folders</span></div>
          <div><strong>{new Set(collections.flatMap(collection => collection.unitIds)).size}</strong><span>organized units</span></div>
          <button type="button" onClick={onBack}>Back to editor</button>
        </div>
      </header>

      <div className="collections-page__layout">
        <aside className="collections-page__folders" aria-label="Collection folders">
          <UnitCollectionsPanel
            variant="page"
            collections={collections}
            activeCollectionId={activeCollectionId}
            selectedUnit={selectedUnit}
            availableUnitIds={availableUnitIds}
            onSelectCollection={onSelectCollection}
            onCreateCollection={onCreateCollection}
            onRenameCollection={onRenameCollection}
            onDeleteCollection={onDeleteCollection}
            onToggleMembership={onToggleMembership}
            onCleanupCollection={onCleanupCollection}
          />
          <div className="collections-page__guidance">
            <span>Scope behavior</span>
            <p>A parent includes every member in its child folders. A unit can belong directly to as many folders as needed.</p>
          </div>
        </aside>

        <section className="collection-members" aria-labelledby="collection-members-title">
          {activeCollection ? (
            <>
              <header className="collection-members__header">
                <div>
                  <span>Active collection</span>
                  <h3 id="collection-members-title">{activeCollection.name}</h3>
                  <p>{descendantIds.size - 1} nested folders contribute to this scope.</p>
                </div>
                <div className="collection-members__metrics" aria-label="Collection summary">
                  <div><strong>{directIds.size}</strong><span>direct</span></div>
                  <div><strong>{nestedOnlyIds.size}</strong><span>nested</span></div>
                  <div><strong>{modifiedCount}</strong><span>edited</span></div>
                  <div><strong>{validationCount}</strong><span>issues</span></div>
                </div>
              </header>

              {unresolvedIds.length > 0 && (
                <div className="collection-members__warning" role="status">
                  <div><strong>{unresolvedIds.length} unresolved references</strong><span>{unresolvedIds.join(', ')}</span></div>
                  <button type="button" onClick={() => onCleanupCollection(activeCollection.id, unresolvedIds)}>Clean up</button>
                </div>
              )}

              <div className="collection-members__toolbar">
                <label className="collection-members__search">
                  <span>Search catalog</span>
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Unit name, ID, faction, or tag…" />
                </label>
                <label><span>Source</span><select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}><option value="all">All units</option><option value="vanilla">Vanilla</option><option value="custom">Custom</option></select></label>
                <label><span>Membership</span><select value={membershipFilter} onChange={event => setMembershipFilter(event.target.value)}><option value="all">Entire catalog</option><option value="included">Included in scope</option><option value="direct">Direct members</option><option value="available">Not included</option></select></label>
              </div>

              <div className="collection-members__result-bar">
                <span>{filteredUnits.length.toLocaleString()} matching units</span>
                <small>Checking a unit changes direct membership in {activeCollection.name}.</small>
              </div>

              <div className="collection-members__list" role="list" aria-label={`${activeCollection.name} unit membership`}>
                {visibleUnits.map(unit => {
                  const isDirect = directIds.has(unit.id);
                  const isNested = nestedOnlyIds.has(unit.id);
                  const issueCount = validationIssues.filter(issue => issue.unitId === unit.id).length;
                  return (
                    <article className={`collection-member-row ${isDirect ? 'is-direct' : isNested ? 'is-nested' : ''}`} key={unit.id} role="listitem">
                      <label className="collection-member-row__toggle">
                        <input type="checkbox" checked={isDirect} onChange={() => onToggleMembership(activeCollection.id, unit.id)} />
                        <span aria-hidden="true" />
                        <em>{isDirect ? 'Direct' : isNested ? 'Nested' : 'Add'}</em>
                      </label>
                      <UnitArtwork src={getUnitIconUrl(unit.rootBaseId || unit.id)} alt="" className="collection-member-row__art" />
                      <div className="collection-member-row__identity"><strong>{unit.name}</strong><code>{unit.id}</code></div>
                      <div className="collection-member-row__meta"><span>{unit.isClone ? 'Custom' : 'Vanilla'}</span><span>{unit.faction}</span><span>{unit.tags.find(tag => /^t[1-4]$/.test(tag)) || '—'}</span></div>
                      <div className="collection-member-row__signals"><span>{Object.keys(tweaks[unit.id] || {}).length} edits</span><span>{issueCount} issues</span></div>
                      <button type="button" onClick={() => onEditUnit(unit.id)}>Open editor</button>
                    </article>
                  );
                })}
                {visibleUnits.length === 0 && <div className="collection-members__empty"><strong>No units match</strong><span>Change the catalog filters or search query.</span></div>}
              </div>
              {filteredUnits.length > RESULT_LIMIT && <p className="collection-members__limit">Showing the first {RESULT_LIMIT} results. Refine the search to reach a specific unit.</p>}
            </>
          ) : (
            <div className="collection-members__blank">
              <span>Collection workspace</span>
              <h3 id="collection-members-title">Select a collection to inspect its unit scope</h3>
              <p>Choose an existing collection or create a new one to review included units, nested scope inheritance, and editing impact.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
