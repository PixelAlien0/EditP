import { useState } from 'react';
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUnitCollectionsController } from './useUnitCollectionsController.js';

const UNITS = [
  { id: 'armflash', name: 'Flash' },
  { id: 'corvoy', name: 'Voy' },
  { id: 'armck', name: 'Constructor' },
];

function setup({ unitCollections = [], allUnitsList = UNITS } = {}) {
  const showToast = vi.fn();
  const useHarness = () => {
    const [collections, setCollections] = useState(unitCollections);
    const controller = useUnitCollectionsController({
      unitCollections: collections,
      setUnitCollections: setCollections,
      allUnitsList,
      showToast,
    });
    return { collections, setCollections, ...controller };
  };
  const view = renderHook(() => useHarness());
  return { view, showToast };
}

const makeCollection = (overrides = {}) => ({
  id: 'root',
  name: 'Root',
  parentId: null,
  unitIds: [],
  sortOrder: 0,
  ...overrides,
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useUnitCollectionsController', () => {
  it('creates collections with sibling-based sort order and activates them', () => {
    const { view, showToast } = setup();

    act(() => {
      view.result.current.handleCreateCollection('Frontline');
    });
    expect(view.result.current.collections).toHaveLength(1);
    const first = view.result.current.collections[0];
    expect(first.name).toBe('Frontline');
    expect(first.parentId).toBeNull();
    expect(first.sortOrder).toBe(0);
    expect(first.unitIds).toEqual([]);
    expect(view.result.current.activeCollectionId).toBe(first.id);
    expect(showToast).toHaveBeenCalledWith('Created collection: Frontline');

    act(() => {
      view.result.current.handleCreateCollection('Reserve');
    });
    expect(view.result.current.collections[1].sortOrder).toBe(1);
    expect(view.result.current.activeCollectionId).toBe(view.result.current.collections[1].id);
  });

  it('creates nested collections under the given parent', () => {
    const { view } = setup({ unitCollections: [makeCollection()] });

    act(() => {
      view.result.current.handleCreateCollection('Sub', 'root');
    });

    const child = view.result.current.collections.find(collection => collection.name === 'Sub');
    expect(child.parentId).toBe('root');
    expect(child.sortOrder).toBe(0);
  });

  it('renames collections, trimming and capping at 80 characters', () => {
    const { view, showToast } = setup({ unitCollections: [makeCollection({ name: 'Old' })] });

    act(() => {
      view.result.current.handleRenameCollection('root', '  New Name  ');
    });
    expect(view.result.current.collections[0].name).toBe('New Name');
    expect(showToast).toHaveBeenCalledWith('Renamed collection to   New Name  ');

    const longName = 'x'.repeat(120);
    act(() => {
      view.result.current.handleRenameCollection('root', longName);
    });
    expect(view.result.current.collections[0].name).toBe('x'.repeat(80));
  });

  it('keeps the previous name when renamed to a blank value', () => {
    const { view } = setup({ unitCollections: [makeCollection({ name: 'Keeper' })] });

    act(() => {
      view.result.current.handleRenameCollection('root', '   ');
    });
    expect(view.result.current.collections[0].name).toBe('Keeper');
  });

  it('deletes collections, promotes children, and retargets the active id', () => {
    const { view, showToast } = setup({
      unitCollections: [
        makeCollection({ id: 'grandparent' }),
        makeCollection({ id: 'parent', parentId: 'grandparent', sortOrder: 1 }),
        makeCollection({ id: 'child', parentId: 'parent', sortOrder: 2 }),
      ],
    });

    act(() => {
      view.result.current.setActiveCollectionId('parent');
    });
    act(() => {
      view.result.current.handleDeleteCollection('parent');
    });

    expect(view.result.current.collections.map(collection => collection.id)).toEqual([
      'grandparent',
      'child',
    ]);
    expect(view.result.current.collections[1].parentId).toBe('grandparent');
    expect(view.result.current.activeCollectionId).toBe('grandparent');
    expect(showToast).toHaveBeenCalledWith('Deleted collection: Root; units were not changed');
  });

  it('falls back to a generic toast when deleting a collection that no longer exists', () => {
    const { view, showToast } = setup({ unitCollections: [makeCollection()] });

    act(() => {
      view.result.current.handleDeleteCollection('missing');
    });

    expect(view.result.current.collections).toHaveLength(1);
    expect(showToast).toHaveBeenCalledWith('Deleted collection; units were not changed');
  });

  it('toggles unit membership without touching other collections', () => {
    const { view } = setup({
      unitCollections: [
        makeCollection({ id: 'a', unitIds: ['armflash'] }),
        makeCollection({ id: 'b' }),
      ],
    });

    act(() => {
      view.result.current.handleToggleCollectionMembership('a', 'corvoy');
    });
    expect(view.result.current.collections[0].unitIds).toEqual(['armflash', 'corvoy']);
    expect(view.result.current.collections[1].unitIds).toEqual([]);

    act(() => {
      view.result.current.handleToggleCollectionMembership('a', 'armflash');
    });
    expect(view.result.current.collections[0].unitIds).toEqual(['corvoy']);
  });

  it('ignores membership toggles without a unit id', () => {
    const { view } = setup({ unitCollections: [makeCollection()] });
    const before = view.result.current.collections;

    act(() => {
      view.result.current.handleToggleCollectionMembership('root', '');
    });
    expect(view.result.current.collections).toBe(before);
  });

  it('cleans unresolved unit references from every collection', () => {
    const { view, showToast } = setup({
      unitCollections: [
        makeCollection({ id: 'a', unitIds: ['armflash', 'ghost_unit'] }),
        makeCollection({ id: 'b', unitIds: ['ghost_unit', 'corvoy'] }),
      ],
    });

    act(() => {
      view.result.current.handleCleanupCollection('a', ['ghost_unit']);
    });

    expect(view.result.current.collections[0].unitIds).toEqual(['armflash']);
    expect(view.result.current.collections[1].unitIds).toEqual(['corvoy']);
    expect(showToast).toHaveBeenCalledWith('Removed 1 unresolved collection reference');
  });

  it('pluralizes cleanup toasts for multiple unresolved references', () => {
    const { view, showToast } = setup({ unitCollections: [makeCollection({ unitIds: ['ghost_a', 'ghost_b'] })] });

    act(() => {
      view.result.current.handleCleanupCollection('root', ['ghost_a', 'ghost_b']);
    });

    expect(view.result.current.collections[0].unitIds).toEqual([]);
    expect(showToast).toHaveBeenCalledWith('Removed 2 unresolved collection references');
  });

  it('derives the active collection and its units including nested folders', () => {
    const { view } = setup({
      unitCollections: [
        makeCollection({ id: 'parent', unitIds: ['armflash'] }),
        makeCollection({ id: 'nested', parentId: 'parent', unitIds: ['corvoy'] }),
      ],
    });

    expect(view.result.current.activeCollection).toBeNull();
    expect(view.result.current.activeCollectionUnitIds).toBeNull();
    expect(view.result.current.activeCollectionUnits).toEqual(UNITS);

    act(() => {
      view.result.current.setActiveCollectionId('parent');
    });

    expect(view.result.current.activeCollection.id).toBe('parent');
    expect(view.result.current.activeCollectionUnitIds).toEqual(new Set(['armflash', 'corvoy']));
    expect(view.result.current.activeCollectionUnits.map(unit => unit.id)).toEqual(['armflash', 'corvoy']);
  });

  it('clears the active collection id when the collection disappears', () => {
    const { view } = setup({ unitCollections: [makeCollection()] });

    act(() => {
      view.result.current.setActiveCollectionId('root');
    });
    expect(view.result.current.activeCollectionId).toBe('root');

    act(() => {
      view.result.current.setCollections([]);
    });
    expect(view.result.current.activeCollectionId).toBeNull();
  });
});
