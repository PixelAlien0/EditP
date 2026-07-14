import { describe, expect, it } from 'vitest';
import {
  MOBILITY_STAT_KEYS,
  STAT_KEYS,
  WEAPON_SLOT_BOOLEAN_PARAMS,
  WEAPON_SLOT_PATHS,
  WORKSPACE_TAB_DEFINITIONS,
} from './editorParameters.js';

describe('editor parameter configuration', () => {
  it('keeps parameter and workspace identifiers unique', () => {
    expect(new Set(STAT_KEYS.map(parameter => parameter.key)).size).toBe(STAT_KEYS.length);
    expect(new Set(WORKSPACE_TAB_DEFINITIONS.map(tab => tab.id)).size).toBe(WORKSPACE_TAB_DEFINITIONS.length);
  });

  it('keeps mobility and weapon metadata derived from canonical definitions', () => {
    expect([...MOBILITY_STAT_KEYS].every(key => STAT_KEYS.some(parameter => parameter.key === key))).toBe(true);
    expect(WEAPON_SLOT_BOOLEAN_PARAMS.has('canattackground')).toBe(true);
    expect(WEAPON_SLOT_PATHS.damage).toBe('damage.default');
    expect(WEAPON_SLOT_PATHS.reload).toBe('reloadtime');
  });
});
