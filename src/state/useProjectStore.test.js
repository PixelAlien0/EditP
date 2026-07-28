import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  PROJECT_STORE_DEFAULTS,
  createProjectStoreState,
  projectStoreReducer,
  useProjectStore,
} from './useProjectStore.js';

describe('projectStoreReducer', () => {
  it('supports React-style updater functions and records the change', () => {
    const store = createProjectStoreState({ ...PROJECT_STORE_DEFAULTS, clones: [] });
    const next = projectStoreReducer(store, {
      type: 'set-field',
      field: 'clones',
      value: current => [...current, { baseId: 'armflash', newId: 'armflash_clone' }],
    });

    expect(next.present.clones).toHaveLength(1);
    expect(store.present.clones).toHaveLength(0);
    expect(next.past).toHaveLength(1);
  });

  it('ignores unknown persistent fields', () => {
    const store = createProjectStoreState();
    expect(projectStoreReducer(store, {
      type: 'set-field',
      field: 'openDialog',
      value: true,
    })).toBe(store);
  });

  it('commits a multi-field transaction as one undo step', () => {
    const store = createProjectStoreState();
    const changed = projectStoreReducer(store, {
      type: 'transaction',
      value: current => ({
        tweaks: { ...current.tweaks, armflash: { health: '900' } },
        clones: [{ baseId: 'armflash', newId: 'armflash_clone' }],
        buildMenuSteps: [{ builderId: 'armlab', add: ['armflash_clone'], remove: [] }],
      }),
    });

    expect(changed.present.tweaks.armflash.health).toBe('900');
    expect(changed.present.clones).toHaveLength(1);
    expect(changed.present.buildMenuSteps).toHaveLength(1);
    expect(changed.past).toHaveLength(1);

    const undone = projectStoreReducer(changed, { type: 'undo' });
    expect(undone.present.tweaks).toEqual({});
    expect(undone.present.clones).toEqual([]);
    expect(undone.present.buildMenuSteps).toEqual([]);
    expect(undone.future).toHaveLength(1);

    const redone = projectStoreReducer(undone, { type: 'redo' });
    expect(redone.present.tweaks.armflash.health).toBe('900');
    expect(redone.present.clones[0].newId).toBe('armflash_clone');
    expect(redone.past).toHaveLength(1);
  });

  it('includes unit descriptions in undo while keeping the preset library independent', () => {
    const store = createProjectStoreState({
      presets: [{ id: 'preset-a', name: 'Saved' }],
    });
    const described = projectStoreReducer(store, {
      type: 'set-field',
      field: 'unitDescriptions',
      value: { armflash: 'Custom description' },
    });
    const libraryChanged = projectStoreReducer(described, {
      type: 'set-field',
      field: 'presets',
      value: [{ id: 'preset-b', name: 'New saved preset' }],
    });

    expect(libraryChanged.past).toHaveLength(1);
    const undone = projectStoreReducer(libraryChanged, { type: 'undo' });
    expect(undone.present.unitDescriptions).toEqual({});
    expect(undone.present.presets[0].id).toBe('preset-b');
  });

  it('hydrates recovered projects without creating an undo entry', () => {
    const changed = projectStoreReducer(createProjectStoreState(), {
      type: 'set-field',
      field: 'tweaks',
      value: { armflash: { health: '900' } },
    });
    const hydrated = projectStoreReducer(changed, {
      type: 'hydrate',
      value: { tweaks: { corak: { health: '1200' } } },
    });

    expect(hydrated.present.tweaks).toEqual({ corak: { health: '1200' } });
    expect(hydrated.past).toEqual([]);
    expect(hydrated.future).toEqual([]);
  });

  it('applies a complete preset snapshot atomically while preserving the preset library', () => {
    const store = createProjectStoreState({
      tweaks: { armflash: { health: '800' } },
      presets: [{ id: 'preset-a', name: 'Saved' }],
    });
    const applied = projectStoreReducer(store, {
      type: 'apply-snapshot',
      value: {
        tweaks: { corak: { health: '1400' } },
        clones: [{ baseId: 'corak', newId: 'corak_clone' }],
        unitDescriptions: { corak_clone: 'Preset clone' },
        projectName: 'Imported preset',
      },
    });

    expect(applied.present.tweaks).toEqual({ corak: { health: '1400' } });
    expect(applied.present.clones[0].newId).toBe('corak_clone');
    expect(applied.present.unitDescriptions.corak_clone).toBe('Preset clone');
    expect(applied.present.projectName).toBe('Imported preset');
    expect(applied.present.presets[0].id).toBe('preset-a');
    expect(applied.past).toHaveLength(1);
  });

  it('exposes compatible setters and reducer-owned undo/redo controls', () => {
    const { result } = renderHook(() => useProjectStore());

    act(() => {
      result.current.transactProject(current => ({
        tweaks: { ...current.tweaks, armflash: { health: '950' } },
        disabledUnitIds: ['corak'],
      }));
    });
    expect(result.current.state.tweaks.armflash.health).toBe('950');
    expect(result.current.state.disabledUnitIds).toEqual(['corak']);
    expect(result.current.canUndo).toBe(true);
    expect(result.current.historyPastCount).toBe(1);

    act(() => result.current.undoProject());
    expect(result.current.state.tweaks).toEqual({});
    expect(result.current.state.disabledUnitIds).toEqual([]);
    expect(result.current.canRedo).toBe(true);

    act(() => result.current.redoProject());
    expect(result.current.state.tweaks.armflash.health).toBe('950');
  });
});
