import { describe, expect, it } from 'vitest';
import {
  deleteCollectionAndPromoteChildren,
  getCollectionUnitIds,
  normalizeUnitCollections,
} from './unitCollections.js';

describe('unit collections', () => {
  it('normalizes nested collections while preserving unresolved unit ids', () => {
    const collections = normalizeUnitCollections([
      { id: 'AIR', name: ' Air ', unitIds: ['ARMDFLY', 'MISSING_UNIT', '../bad'] },
      { id: 'T2', name: 'T2', parentId: 'AIR', unitIds: ['CORAPE', 'ARMDFLY'] },
    ]);

    expect(collections).toEqual([
      { id: 'air', name: 'Air', parentId: null, unitIds: ['armdfly', 'missing_unit'], sortOrder: 0 },
      { id: 't2', name: 'T2', parentId: 'air', unitIds: ['corape', 'armdfly'], sortOrder: 1 },
    ]);
    expect([...getCollectionUnitIds(collections, 'air')].sort()).toEqual(['armdfly', 'corape', 'missing_unit']);
  });

  it('breaks parent cycles and promotes children when a folder is deleted', () => {
    const collections = normalizeUnitCollections([
      { id: 'one', name: 'One', parentId: 'two' },
      { id: 'two', name: 'Two', parentId: 'one' },
      { id: 'child', name: 'Child', parentId: 'two' },
    ]);
    expect(collections.some(collection => collection.parentId === null)).toBe(true);

    const next = deleteCollectionAndPromoteChildren([
      { id: 'root', name: 'Root', parentId: null, unitIds: [], sortOrder: 0 },
      { id: 'parent', name: 'Parent', parentId: 'root', unitIds: ['armdfly'], sortOrder: 0 },
      { id: 'child', name: 'Child', parentId: 'parent', unitIds: [], sortOrder: 0 },
    ], 'parent');
    expect(next.find(collection => collection.id === 'child').parentId).toBe('root');
    expect(next.some(collection => collection.id === 'parent')).toBe(false);
  });
});
