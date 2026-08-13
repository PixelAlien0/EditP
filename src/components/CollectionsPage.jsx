import { useMemo, useState } from 'react';
import { Button, PageShell, Type } from './ui.jsx';
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
  const issueCountsByUnit = useMemo(() => {
    const counts = new Map();
    validationIssues.forEach(issue => {
      if (!issue.unitId) return;
      counts.set(issue.unitId, (counts.get(issue.unitId) || 0) + 1);
    });
    return counts;
  }, [validationIssues]);
  const validationCount = useMemo(
    () => [...scopeIds].reduce((total, unitId) => total + (issueCountsByUnit.get(unitId) || 0), 0),
    [issueCountsByUnit, scopeIds]
  );
  const modifiedCount = useMemo(
    () => units.filter(unit => scopeIds.has(unit.id) && Object.keys(tweaks[unit.id] || {}).length > 0).length,
    [scopeIds, tweaks, units]
  );

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
  const clearFilters = () => {
    setQuery('');
    setSourceFilter('all');
    setMembershipFilter('all');
  };

  return (
    <PageShell
      className="collections-page"
      label="Collections"
      eyebrow="Unit organization"
      title="Collections"
      description="Create reusable unit groups for editing, comparison, and export."
      capabilityId="workspace.collections"
      metrics={[
        { label: 'Collections', value: collections.length },
        { label: 'Units grouped', value: new Set(collections.flatMap(collection => collection.unitIds)).size },
      ]}
      actions={<Button onClick={onBack}>Back to editor</Button>}
      bodyClassName="collections-page__body"
    >
      <div className="collections-page__layout">
        <aside className="collections-page__folders" aria-label="Collection folders">
          <div className="collections-page__folders-heading">
            <span>Collection library</span>
            <strong>{collections.length} folders</strong>
          </div>
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
            <strong>Nested membership</strong>
            <p>Parent collections include units from their child collections.</p>
          </div>
        </aside>

        <section className="collection-members" aria-labelledby="collection-members-title">
          {activeCollection ? (
            <>
              <header className="collection-members__header">
                <div className="collection-members__identity">
                  <span>Selected collection</span>
                  <Type as="h3" variant="section-title" id="collection-members-title">{activeCollection.name}</Type>
                  <small>{descendantIds.size - 1} child {descendantIds.size - 1 === 1 ? 'collection' : 'collections'}</small>
                </div>
                <div className="collection-members__metrics" aria-label="Collection summary">
                  <div><strong>{directIds.size}</strong><span>Direct</span></div>
                  <div><strong>{nestedOnlyIds.size}</strong><span>Inherited</span></div>
                  <div><strong>{modifiedCount}</strong><span>Edited</span></div>
                  <div><strong>{validationCount}</strong><span>Issues</span></div>
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
                  <span>Find units</span>
                  <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Name, ID, faction, or tag" />
                </label>
                <label>
                  <span>Source</span>
                  <select value={sourceFilter} onChange={event => setSourceFilter(event.target.value)}>
                    <option value="all">All units</option><option value="vanilla">BAR units</option><option value="custom">Custom units</option>
                  </select>
                </label>
                <label>
                  <span>Membership</span>
                  <select value={membershipFilter} onChange={event => setMembershipFilter(event.target.value)}>
                    <option value="all">Entire catalog</option><option value="included">Included</option><option value="direct">Direct members</option><option value="available">Not included</option>
                  </select>
                </label>
              </div>

              <div className="collection-members__result-bar">
                <span>{filteredUnits.length.toLocaleString()} units</span>
                <small>Membership changes apply to {activeCollection.name}.</small>
              </div>

              <div className="collection-members__columns" aria-hidden="true">
                <span>Membership</span><span>Unit</span><span>Classification</span><span>Project status</span><span>Action</span>
              </div>

              <div className="collection-members__list" role="list" aria-label={`${activeCollection.name} unit membership`}>
                {visibleUnits.map(unit => {
                  const isDirect = directIds.has(unit.id);
                  const isNested = nestedOnlyIds.has(unit.id);
                  const issueCount = issueCountsByUnit.get(unit.id) || 0;
                  return (
                    <article className={`collection-member-row ${isDirect ? 'is-direct' : isNested ? 'is-nested' : ''}`} key={unit.id} role="listitem">
                      <label className="collection-member-row__toggle">
                        <input type="checkbox" checked={isDirect} onChange={() => onToggleMembership(activeCollection.id, unit.id)} />
                        <span aria-hidden="true" />
                        <em>{isDirect ? 'Direct' : isNested ? 'Inherited' : 'Add'}</em>
                      </label>
                      <UnitArtwork src={getUnitIconUrl(unit.rootBaseId || unit.id)} alt="" className="collection-member-row__art" />
                      <div className="collection-member-row__identity"><strong>{unit.name}</strong><code>{unit.id}</code></div>
                      <div className="collection-member-row__meta"><span>{unit.isClone ? 'Custom' : 'BAR'}</span><span>{unit.faction}</span><span>{unit.tags.find(tag => /^t[1-4]$/.test(tag)) || '—'}</span></div>
                      <div className="collection-member-row__signals"><span>{Object.keys(tweaks[unit.id] || {}).length} edits</span><span className={issueCount > 0 ? 'has-issues' : ''}>{issueCount} issues</span></div>
                      <button type="button" onClick={() => onEditUnit(unit.id)}>Open editor</button>
                    </article>
                  );
                })}
                {visibleUnits.length === 0 && (
                  <div className="collection-members__empty">
                    <strong>No matching units</strong>
                    <span>Clear the filters to return to the full catalog.</span>
                    <button type="button" onClick={clearFilters}>Clear filters</button>
                  </div>
                )}
              </div>
              {filteredUnits.length > RESULT_LIMIT && <p className="collection-members__limit">Showing {RESULT_LIMIT} of {filteredUnits.length.toLocaleString()} units. Use search to narrow the catalog.</p>}
            </>
          ) : (
            <div className="collection-members__blank">
              <Type as="h3" variant="section-title" id="collection-members-title">Select a collection</Type>
              <Type as="p" variant="description">Choose a collection from the library or create a new one.</Type>
            </div>
          )}
        </section>
      </div>
    </PageShell>
  );
}
