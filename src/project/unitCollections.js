const COLLECTION_ID_PATTERN = /^[a-z0-9_-]+$/i;
const UNIT_ID_PATTERN = /^[a-z0-9_]+$/i;

export const MAX_UNIT_COLLECTIONS = 500;
export const MAX_COLLECTION_MEMBERS = 5000;

function cleanId(value, pattern) {
  const id = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return pattern.test(id) ? id : null;
}

function cleanUnitIds(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .slice(0, MAX_COLLECTION_MEMBERS)
    .map(item => cleanId(item, UNIT_ID_PATTERN))
    .filter(Boolean))];
}

export function normalizeUnitCollections(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  const collections = value.slice(0, MAX_UNIT_COLLECTIONS).flatMap((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const id = cleanId(item.id, COLLECTION_ID_PATTERN);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const name = typeof item.name === 'string' ? item.name.trim().slice(0, 80) : '';
    return [{
      id,
      name: name || 'Untitled collection',
      parentId: cleanId(item.parentId, COLLECTION_ID_PATTERN),
      unitIds: cleanUnitIds(item.unitIds),
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : index,
    }];
  });

  const byId = new Map(collections.map(collection => [collection.id, collection]));
  collections.forEach(collection => {
    if (collection.parentId === collection.id || !byId.has(collection.parentId)) collection.parentId = null;
  });
  collections.forEach(collection => {
    const visited = new Set([collection.id]);
    let parentId = collection.parentId;
    while (parentId) {
      if (visited.has(parentId)) {
        collection.parentId = null;
        break;
      }
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId || null;
    }
  });

  return collections;
}

export function getCollectionDescendantIds(collections, collectionId) {
  if (!collectionId) return new Set();
  const result = new Set([collectionId]);
  let changed = true;
  while (changed) {
    changed = false;
    collections.forEach(collection => {
      if (collection.parentId && result.has(collection.parentId) && !result.has(collection.id)) {
        result.add(collection.id);
        changed = true;
      }
    });
  }
  return result;
}

export function getCollectionUnitIds(collections, collectionId) {
  const collectionIds = getCollectionDescendantIds(collections, collectionId);
  return new Set(collections
    .filter(collection => collectionIds.has(collection.id))
    .flatMap(collection => collection.unitIds || []));
}

export function createUnitCollection(name, parentId, sortOrder) {
  const generatedId = globalThis.crypto?.randomUUID?.()
    || `collection_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: generatedId.toLowerCase(),
    name: String(name || '').trim().slice(0, 80) || 'Untitled collection',
    parentId: parentId || null,
    unitIds: [],
    sortOrder,
  };
}

export function deleteCollectionAndPromoteChildren(collections, collectionId) {
  const removed = collections.find(collection => collection.id === collectionId);
  if (!removed) return collections;
  return collections
    .filter(collection => collection.id !== collectionId)
    .map(collection => collection.parentId === collectionId
      ? { ...collection, parentId: removed.parentId || null }
      : collection);
}
