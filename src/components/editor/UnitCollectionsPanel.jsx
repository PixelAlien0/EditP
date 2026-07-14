import { useEffect, useMemo, useState } from 'react';
import { getCollectionUnitIds } from '../../project/unitCollections.js';

function FolderIcon({ open = false }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d={open ? 'M2 5.5h12l-1.4 7H3.2L2 5.5Z' : 'M2.25 3.5h4l1.25 1.5h6.25v7.5H2.25v-9Z'} />
    </svg>
  );
}

export default function UnitCollectionsPanel({
  collections,
  activeCollectionId,
  selectedUnit,
  availableUnitIds,
  onSelectCollection,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onToggleMembership,
  onCleanupCollection,
}) {
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [actionCollectionId, setActionCollectionId] = useState(null);
  const [draft, setDraft] = useState(null);
  const availableIds = useMemo(() => new Set(availableUnitIds), [availableUnitIds]);
  const byParent = useMemo(() => {
    const groups = new Map();
    collections.forEach(collection => {
      const key = collection.parentId || 'root';
      const siblings = groups.get(key) || [];
      siblings.push(collection);
      groups.set(key, siblings);
    });
    groups.forEach(siblings => siblings.sort((left, right) => (
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name)
    )));
    return groups;
  }, [collections]);
  const scopeIds = useMemo(() => new Map(collections.map(collection => [
    collection.id,
    getCollectionUnitIds(collections, collection.id),
  ])), [collections]);
  const activeCollection = collections.find(collection => collection.id === activeCollectionId) || null;
  const activeScopeIds = activeCollection ? scopeIds.get(activeCollection.id) : new Set();
  const unresolvedIds = [...activeScopeIds].filter(unitId => !availableIds.has(unitId));

  useEffect(() => {
    if (!activeCollection) return;
    setExpandedIds(current => {
      const next = new Set(current);
      let changed = false;
      let parentId = activeCollection.parentId;
      while (parentId) {
        if (!next.has(parentId)) {
          next.add(parentId);
          changed = true;
        }
        parentId = collections.find(collection => collection.id === parentId)?.parentId || null;
      }
      return changed ? next : current;
    });
  }, [activeCollection, collections]);

  const beginCreate = parentId => {
    setDraft({ mode: 'create', id: null, parentId: parentId || null, name: '' });
    setActionCollectionId(null);
    if (parentId) setExpandedIds(current => new Set([...current, parentId]));
  };

  const beginRename = collection => {
    setDraft({ mode: 'rename', id: collection.id, parentId: collection.parentId, name: collection.name });
    setActionCollectionId(null);
  };

  const submitDraft = event => {
    event.preventDefault();
    const name = draft.name.trim();
    if (!name) return;
    if (draft.mode === 'create') onCreateCollection(name, draft.parentId);
    else onRenameCollection(draft.id, name);
    setDraft(null);
  };

  const renderBranch = (parentId = null, depth = 0) => (byParent.get(parentId || 'root') || []).map(collection => {
    const children = byParent.get(collection.id) || [];
    const isExpanded = expandedIds.has(collection.id);
    const isMember = Boolean(selectedUnit && collection.unitIds.includes(selectedUnit.id));
    const scopeCount = scopeIds.get(collection.id)?.size || 0;
    return (
      <div className="unit-collection-branch" key={collection.id}>
        <div
          className={`unit-collection-row ${activeCollectionId === collection.id ? 'is-active' : ''}`}
          style={{ '--collection-depth': depth }}
        >
          <button
            type="button"
            className="unit-collection-disclosure"
            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${collection.name}`}
            aria-expanded={isExpanded}
            disabled={children.length === 0}
            onClick={() => setExpandedIds(current => {
              const next = new Set(current);
              if (next.has(collection.id)) next.delete(collection.id);
              else next.add(collection.id);
              return next;
            })}
          >
            {children.length > 0 ? (isExpanded ? '−' : '+') : ''}
          </button>
          <button
            type="button"
            className="unit-collection-select"
            onClick={() => onSelectCollection(collection.id)}
            aria-pressed={activeCollectionId === collection.id}
          >
            <FolderIcon open={isExpanded} />
            <span>{collection.name}</span>
            <small>{scopeCount}</small>
          </button>
          <button
            type="button"
            className={`unit-collection-membership ${isMember ? 'is-member' : ''}`}
            disabled={!selectedUnit}
            onClick={() => onToggleMembership(collection.id, selectedUnit?.id)}
            aria-label={selectedUnit
              ? `${isMember ? 'Remove' : 'Add'} ${selectedUnit.name} ${isMember ? 'from' : 'to'} ${collection.name}`
              : `Select a unit to assign it to ${collection.name}`}
            aria-pressed={isMember}
            title={selectedUnit ? `${isMember ? 'Remove' : 'Add'} selected unit` : 'Select a unit first'}
          >
            {isMember ? '✓' : '+'}
          </button>
          <button
            type="button"
            className="unit-collection-menu-trigger"
            aria-label={`Manage ${collection.name}`}
            aria-expanded={actionCollectionId === collection.id}
            onClick={() => setActionCollectionId(current => current === collection.id ? null : collection.id)}
          >
            ···
          </button>
        </div>
        {actionCollectionId === collection.id && (
          <div className="unit-collection-actions" style={{ '--collection-depth': depth }}>
            <button type="button" onClick={() => beginCreate(collection.id)}>New child</button>
            <button type="button" onClick={() => beginRename(collection)}>Rename</button>
            <button type="button" onClick={() => { onDeleteCollection(collection.id); setActionCollectionId(null); }}>Delete folder</button>
          </div>
        )}
        {children.length > 0 && isExpanded && renderBranch(collection.id, depth + 1)}
      </div>
    );
  });

  return (
    <section className="unit-collections" aria-labelledby="unit-collections-title">
      <header className="unit-collections__header">
        <div>
          <span>Workspace scopes</span>
          <strong id="unit-collections-title">Collections</strong>
        </div>
        <button type="button" onClick={() => beginCreate(null)}>New</button>
      </header>

      {draft && (
        <form className="unit-collection-editor" onSubmit={submitDraft}>
          <label htmlFor="unit-collection-name">
            {draft.mode === 'rename' ? 'Rename folder' : draft.parentId ? 'New child folder' : 'New collection'}
          </label>
          <div>
            <input
              id="unit-collection-name"
              autoFocus
              maxLength={80}
              value={draft.name}
              placeholder="e.g. T2 air rebalance"
              onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            />
            <button type="submit" disabled={!draft.name.trim()}>Save</button>
            <button type="button" onClick={() => setDraft(null)} aria-label="Cancel collection edit">×</button>
          </div>
        </form>
      )}

      <div className="unit-collections__tree" role="group" aria-label="Unit collections">
        <button
          type="button"
          className={`unit-collection-all ${activeCollectionId === null ? 'is-active' : ''}`}
          onClick={() => onSelectCollection(null)}
          aria-pressed={activeCollectionId === null}
        >
          <FolderIcon open />
          <span>All units</span>
          <small>{availableUnitIds.length.toLocaleString()}</small>
        </button>
        {collections.length > 0 ? renderBranch() : (
          <p className="unit-collections__empty">Create a folder, then use + to assign the selected unit.</p>
        )}
      </div>

      {activeCollection && (
        <footer className="unit-collections__scope">
          <div>
            <span>Active scope</span>
            <strong>{activeCollection.name}</strong>
            <small>{activeScopeIds.size} members including nested folders</small>
          </div>
          <button type="button" onClick={() => onSelectCollection(null)}>Clear</button>
          {unresolvedIds.length > 0 && (
            <button type="button" className="is-warning" onClick={() => onCleanupCollection(activeCollection.id, unresolvedIds)}>
              Remove {unresolvedIds.length} unresolved
            </button>
          )}
        </footer>
      )}
    </section>
  );
}
