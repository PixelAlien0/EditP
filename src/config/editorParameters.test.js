import { describe, expect, it } from 'vitest';
import {
  MOBILITY_STAT_KEYS,
  STAT_KEYS,
  WEAPON_SLOT_BOOLEAN_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS,
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
    expect(WEAPON_SLOT_PATHS.damage_vs_commander).toBe('damage.commanders');
    expect(WEAPON_SLOT_PATHS.damage_vs_vtol).toBe('damage.vtol');
    expect(WEAPON_SLOT_MOUNT_PARAMS.has('maxangledif')).toBe(true);
    expect(STAT_KEYS.find(parameter => parameter.key === 'explodeas')?.patchKey).toBe('explodeAs');
    expect(STAT_KEYS.find(parameter => parameter.key === 'death_explosion_damage')?.output).toBe('tweakdefs');
    expect(STAT_KEYS.find(parameter => parameter.key === 'acceleration')?.patchKey).toBe('maxAcc');
    expect(STAT_KEYS.find(parameter => parameter.key === 'brakerate')?.patchKey).toBe('maxDec');
    expect(STAT_KEYS.some(parameter => parameter.key === 'airsubalt')).toBe(false);
  });
});
