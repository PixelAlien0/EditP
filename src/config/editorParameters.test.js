import { describe, expect, it } from 'vitest';
import {
  getApplicableUnitParameters,
  resolveUnitParameterDefault,
  MOBILITY_STAT_KEYS,
  STAT_KEYS,
  WORKSPACE_TAB_DEFINITIONS,
} from './editorParameters.js';
import {
  getWeaponParameterDefinition,
  SPAWNER_CARRIER_WEAPON_GROUPS,
  WEAPON_ADVANCED_GROUPS,
  WEAPON_CORE_PARAMETERS,
  WEAPON_EDITABLE_PARAMETER_CATALOG,
  WEAPON_PARAMETER_CATALOG,
  WEAPON_SLOT_BOOLEAN_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS,
  WEAPON_SLOT_PATHS,
} from './weaponParameters.js';

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

  it('uses one unique weapon catalog for presentation and compilation', () => {
    expect(new Set(WEAPON_PARAMETER_CATALOG.map(parameter => parameter.key)).size)
      .toBe(WEAPON_PARAMETER_CATALOG.length);
    expect(WEAPON_EDITABLE_PARAMETER_CATALOG.length)
      .toBe(WEAPON_CORE_PARAMETERS.length + WEAPON_ADVANCED_GROUPS.flatMap(group => group.params).length + 7);

    WEAPON_PARAMETER_CATALOG.forEach(parameter => {
      expect(parameter.path, parameter.key).toBeTruthy();
      expect(['weapondef', 'mount'], parameter.key).toContain(parameter.compileTarget);
      expect(['number', 'boolean', 'string'], parameter.key).toContain(parameter.valueType);
      expect(getWeaponParameterDefinition(parameter.key)).toBe(parameter);
    });
  });

  it('maps every visible spawner and carrier field to its BAR WeaponDef path', () => {
    const parameters = SPAWNER_CARRIER_WEAPON_GROUPS.flatMap(group => group.params);
    expect(parameters.length).toBeGreaterThan(20);
    parameters.forEach(parameter => {
      expect(WEAPON_SLOT_PATHS[parameter.key], parameter.key).toMatch(/^customparams\./);
    });
    expect(WEAPON_SLOT_PATHS.docktohealthreshold).toBe('customparams.docktohealthreshold');
    expect(WEAPON_SLOT_PATHS.startingdronecount).toBe('customparams.startingdronecount');
    expect(WEAPON_SLOT_PATHS.droneammo).toBe('customparams.droneammo');
    expect(WEAPON_SLOT_BOOLEAN_PARAMS.has('enabledocking')).toBe(true);
    expect(WEAPON_SLOT_BOOLEAN_PARAMS.has('manualdrones')).toBe(true);
    expect(WEAPON_SLOT_PATHS.spawns_height).toBeUndefined();
    expect(WEAPON_SLOT_PATHS.is_controllable).toBeUndefined();
  });

  it('keeps declared, featured, active, and edited unit parameters in the relevant view', () => {
    const parameters = [
      { key: 'health', featured: true },
      { key: 'radar', featured: false },
      { key: 'cloak', featured: false },
      { key: 'transport', featured: false },
      { key: 'kamikaze', featured: false },
      { key: 'icontype', featured: false, alwaysRelevant: true },
    ];
    const defaults = { radar: 400 };
    const tweaks = { cloak: false };

    expect(getApplicableUnitParameters(parameters, defaults, tweaks, { activeKey: 'transport' }).map(item => item.key))
      .toEqual(['health', 'radar', 'cloak', 'transport', 'icontype']);
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
