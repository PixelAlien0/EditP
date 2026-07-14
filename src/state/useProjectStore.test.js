import { describe, expect, it } from 'vitest';
import { PROJECT_STORE_DEFAULTS, projectStoreReducer } from './useProjectStore.js';

describe('projectStoreReducer', () => {
  it('supports React-style updater functions', () => {
    const state = { ...PROJECT_STORE_DEFAULTS, clones: [] };
    const next = projectStoreReducer(state, {
      type: 'set-field',
      field: 'clones',
      value: current => [...current, { baseId: 'armflash', newId: 'armflash_clone' }],
    });
    expect(next.clones).toHaveLength(1);
    expect(state.clones).toHaveLength(0);
  });

  it('ignores unknown persistent fields', () => {
    const state = { ...PROJECT_STORE_DEFAULTS };
    expect(projectStoreReducer(state, { type: 'set-field', field: 'openDialog', value: true })).toBe(state);
  });
});
