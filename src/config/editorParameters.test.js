import { describe, expect, it } from 'vitest';
import {
  getApplicableUnitParameters,
  resolveUnitParameterDefault,
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

  it('keeps declared, featured, active, and edited unit parameters in the relevant view', () => {
    const parameters = [
      { key: 'health', featured: true },
      { key: 'radar', featured: false },
      { key: 'cloak', featured: false },
      { key: 'transport', featured: false },
      { key: 'kamikaze', featured: false },
    ];
    const defaults = { radar: 400 };
    const tweaks = { cloak: false };

    expect(getApplicableUnitParameters(parameters, defaults, tweaks, { activeKey: 'transport' }).map(item => item.key))
      .toEqual(['health', 'radar', 'cloak', 'transport']);
    expect(getApplicableUnitParameters(parameters, defaults, tweaks, { showAll: true }))
      .toBe(parameters);
  });

  it('resolves fixed and dependent Recoil defaults without replacing explicit BAR values', () => {
    const byKey = key => STAT_KEYS.find(parameter => parameter.key === key);

    expect(resolveUnitParameterDefault(byKey('canselfdestruct'), {})).toMatchObject({ value: true, source: 'engine' });
    expect(resolveUnitParameterDefault(byKey('idleautoheal'), {})).toMatchObject({ value: 10, source: 'engine' });
    expect(resolveUnitParameterDefault(byKey('brakerate'), { acceleration: 0.2 })).toMatchObject({ value: 0.2, source: 'engine' });
    expect(resolveUnitParameterDefault(byKey('airsightdistance'), { sightdistance: 400 })).toMatchObject({ value: 600, source: 'engine' });
    expect(resolveUnitParameterDefault(byKey('mass'), { metalcost: 0 })).toMatchObject({ value: 1, source: 'engine' });
    expect(resolveUnitParameterDefault(byKey('cancloak'), { cloakcost: 0 })).toMatchObject({ value: false, source: 'engine' });
    expect(resolveUnitParameterDefault(byKey('blocking'), { blocking: false })).toMatchObject({ value: false, source: 'unit' });
    expect(resolveUnitParameterDefault(byKey('canrepair'), {})).toMatchObject({ value: undefined, label: 'Builder capability', source: 'engine-derived' });
  });
});
