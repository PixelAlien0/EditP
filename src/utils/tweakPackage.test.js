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
});

