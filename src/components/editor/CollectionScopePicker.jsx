import { useMemo } from 'react';
import { getCollectionUnitIds } from '../../project/unitCollections.js';

function getCollectionDepth(collection, byId) {
  let depth = 0;
  let parentId = collection.parentId;
  const visited = new Set([collection.id]);
  while (parentId && !visited.has(parentId)) {
    visited.add(parentId);
    depth += 1;
    parentId = byId.get(parentId)?.parentId || null;
  }
  return depth;
}

export default function CollectionScopePicker({
  collections,
  activeCollectionId,
  totalUnits,
  onSelect,
  onManage,
}) {
  const options = useMemo(() => {
    const byId = new Map(collections.map(collection => [collection.id, collection]));
    return [...collections]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
      .map(collection => ({
        ...collection,
        depth: getCollectionDepth(collection, byId),
        count: getCollectionUnitIds(collections, collection.id).size,
      }));
  }, [collections]);
  const active = options.find(collection => collection.id === activeCollectionId) || null;

  return (
    <section className="collection-scope-picker" aria-labelledby="collection-scope-picker-title">
      <div className="collection-scope-picker__heading">
        <div>
          <span>Library scope</span>
          <strong id="collection-scope-picker-title">{active?.name || 'All units'}</strong>
        </div>
        <button type="button" onClick={onManage}>Manage</button>
      </div>
      <label>
        <span className="sr-only">Active unit collection</span>
        <select value={activeCollectionId || ''} onChange={event => onSelect(event.target.value || null)}>
          <option value="">All units · {totalUnits.toLocaleString()}</option>
          {options.map(collection => (
            <option key={collection.id} value={collection.id}>
              {`${'— '.repeat(collection.depth)}${collection.name} · ${collection.count}`}
            </option>
          ))}
        </select>
      </label>
      <p>{active ? `${active.count.toLocaleString()} members, including nested folders.` : 'Choose a collection to focus filters and expert tools.'}</p>
    </section>
  );
}
