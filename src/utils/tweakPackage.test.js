import { describe, expect, it } from 'vitest';
import { encodeLobbyBase64 } from './tweakSerializer.js';
import { analyzeTweakModule, parseTweakPackageInput } from './tweakPackage.js';

describe('tweak package import', () => {
  it('imports numbered URL-safe lobby commands without enabling them', () => {
    const lua = 'UnitDefs["editp_test"] = table.copy(UnitDefs["armflea"], true)\ntable.insert(UnitDefs["armlab"].buildoptions, "editp_test")';
    const payload = encodeLobbyBase64(lua, { padding: false });
    const result = parseTweakPackageInput(`!bset tweakdefs9 ${payload}`);
    expect(result.errors).toEqual([]);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]).toMatchObject({ kind: 'defs', originalFieldName: 'tweakdefs9', enabled: false });
    expect(result.modules[0].rawLua).toBe(lua);
  });

  it('requires an explicit kind for naked raw Lua', () => {
    const result = parseTweakPackageInput('return { armflea = { health = 1 } }');
    expect(result.modules).toEqual([]);
    expect(result.errors[0]).toContain('Choose whether');
  });

  it('reports safe literal conversions and dangerous global operations', () => {
    const module = parseTweakPackageInput(`
      UnitDefs["editp_test"] = table.copy(UnitDefs["armflea"], true)
      table.insert(UnitDefs["armlab"].buildoptions, "editp_test")
      UnitDefs["editp_test"].customparams.spawnrate = 8
      for name, unit in pairs(UnitDefs) do if name == "bad" then UnitDefs[name] = nil end end
    `, { kind: 'defs' }).modules[0];
    const analysis = analyzeTweakModule(module);
    expect(analysis.createdUnits).toEqual(['editp_test']);
    expect(analysis.buildMenuOperations).toBe(1);
    expect(analysis.conversions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'clone', baseId: 'armflea', newId: 'editp_test' }),
      expect.objectContaining({ type: 'build-add', builderId: 'armlab', unitId: 'editp_test' }),
      expect.objectContaining({ type: 'unit-parameter', key: 'customparams.spawnrate', value: 8 }),
    ]));
    expect(analysis.warnings.map(item => item.code)).toContain('global-loop');
    expect(analysis.warnings.map(item => item.code)).toContain('dynamic-id');
  });

  it('deduplicates modules with identical decoded Lua', () => {
    const payload = encodeLobbyBase64('return {}', { padding: false });
    const result = parseTweakPackageInput(`!bset tweakdefs1 ${payload}\n!bset tweakdefs2 ${payload}`);
    expect(result.modules).toHaveLength(1);
    expect(result.errors[0]).toContain('duplicate');
  });

  it('extracts mixed legacy packages, dependencies, and duplicate fields', () => {
    const first = encodeLobbyBase64('-- First module\nlocal a = true', { padding: false });
    const second = encodeLobbyBase64('-- Second module\nlocal b = true', { padding: false });
    const units = encodeLobbyBase64('{ armflea = { health = 100 } }', { padding: false });
    const result = parseTweakPackageInput(`
      ALL TWEAKS
      !bset forceallunits 1
      !bset tweakdefs ${first}
      SCAVENGERS
      !bset tweakdefs ${second}
      !bset tweakunits1 ${units}
    `);
    expect(result.errors).toEqual([]);
    expect(result.modules).toHaveLength(3);
    expect(result.modules.map(module => module.label)).toEqual(['First module', 'Second module', 'tweakunits1']);
    expect(result.modules.every(module => module.requirements.includes('forceallunits'))).toBe(true);
    expect(result.notices.join(' ')).toContain('tweakdefs appears 2 times');
    expect(result.notices.join(' ')).toContain('Force-load all units');
    expect(result.notices.join(' ')).toContain('unnumbered legacy');
  });

  it('converts literal tweakunits tables into unit and weapon edits', () => {
    const module = parseTweakPackageInput(`{
      editp_ship = {
        health = 900,
        speed = 2.5,
        buildoptions = { 'editp_drone', 'armflea' },
        customparams = { carried_unit = 'editp_drone', spawnrate = 5 },
        weapondefs = {
          laser = {
            range = 600,
            reloadtime = 0.7,
            damage = { default = 42 },
            customparams = { cluster_def = 'laser_sub', cluster_number = 4 },
          },
        },
        weapons = { [1] = { def = 'LASER', onlytargetcategory = 'SURFACE' } },
      },
    }`, { kind: 'units' }).modules[0];
    const analysis = analyzeTweakModule(module);
    expect(analysis.literalUnitTables).toBe(1);
    expect(analysis.literalWeaponDefinitions).toBe(1);
    expect(analysis.conversions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'unit-parameter', unitId: 'editp_ship', key: 'health', value: 900 }),
      expect.objectContaining({ type: 'unit-parameter', unitId: 'editp_ship', key: 'maxvelocity', value: 2.5 }),
      expect.objectContaining({ type: 'unit-parameter', unitId: 'editp_ship', key: 'customparams.carried_unit', value: 'editp_drone' }),
      expect.objectContaining({ type: 'build-roster', builderId: 'editp_ship', unitIds: ['editp_drone', 'armflea'] }),
      expect.objectContaining({ type: 'weapon-parameter', unitId: 'editp_ship', slot: 1, key: 'damage', value: 42 }),
      expect.objectContaining({ type: 'weapon-parameter', unitId: 'editp_ship', slot: 1, key: 'reload', value: 0.7 }),
      expect.objectContaining({ type: 'weapon-parameter', unitId: 'editp_ship', slot: 1, key: 'cluster_number', value: 4 }),
      expect.objectContaining({ type: 'weapon-parameter', unitId: 'editp_ship', slot: 1, key: 'onlytargetcategory', value: 'SURFACE' }),
    ]));
    expect(analysis.buildMenuOperations).toBe(1);
  });

  it('recognizes the compact SET and ADD clone pattern without executing it', () => {
    const module = parseTweakPackageInput(`
      local a = {}
      function SET(id) a = table.copy(UnitDefs[id]) end
      function ADD(id) UnitDefs[id] = a end
      SET('armflea') NAME('Orbital Flea') DESC('Space scout') ADD('editp_orbital_flea')
    `, { kind: 'defs' }).modules[0];
    const analysis = analyzeTweakModule(module);
    expect(analysis.conversions).toContainEqual(expect.objectContaining({
      type: 'clone', baseId: 'armflea', newId: 'editp_orbital_flea',
      displayName: 'Orbital Flea', description: 'Space scout',
    }));
  });
});
