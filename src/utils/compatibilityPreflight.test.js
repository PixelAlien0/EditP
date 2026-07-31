import { describe, expect, it } from 'vitest';
import { buildCompatibilityPreflight } from './compatibilityPreflight.js';

function compiled(overrides = {}) {
  const defs = { required: 1, maximum: 9, overflow: false, slots: [] };
  const units = { required: 1, maximum: 9, overflow: false, slots: [] };
  return {
    defs,
    units,
    overflow: false,
    slots: [
      { fieldName: 'tweakdefs1', compatibility: 'ok', encodedBytes: 900 },
      { fieldName: 'tweakunits1', compatibility: 'ok', encodedBytes: 800 },
    ],
    ...overrides,
  };
}

function packageAnalysis(moduleId = 'module-a', overrides = {}) {
  return {
    analyses: new Map([[moduleId, {
      warnings: [],
      unknownCustomParameters: [],
    }]]),
    blockingIssues: [],
    moduleReports: [{
      moduleId,
      unresolved: [],
      orderingIssues: [],
      typeIssues: [],
      runtimeRisks: [],
      assetReferences: [],
    }],
    cycles: [],
    ...overrides,
  };
}

describe('buildCompatibilityPreflight', () => {
  it('marks a structured package within both nine-slot limits as ready', () => {
    const result = buildCompatibilityPreflight({ compiledModules: compiled() });

    expect(result).toMatchObject({ status: 'ready', canCopyLobbyCommands: true, activeModuleCount: 0 });
    expect(result.counts.blocker).toBe(0);
    expect(result.counts.warning).toBe(0);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'delivery-defs-capacity', level: 'pass' }),
      expect.objectContaining({ id: 'delivery-units-capacity', level: 'pass' }),
      expect.objectContaining({ id: 'modules-none', level: 'pass' }),
    ]));
  });

  it('blocks definite project and slot failures', () => {
    const defs = { required: 10, maximum: 9, overflow: true, slots: [] };
    const result = buildCompatibilityPreflight({
      compiledModules: compiled({ defs, overflow: true }),
      validationIssues: [{ unitId: 'armflea', unitName: 'Flea', key: 'health', level: 'error', message: 'Health must be positive.' }],
    });

    expect(result.status).toBe('blocked');
    expect(result.canCopyLobbyCommands).toBe(false);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'delivery-defs-overflow', level: 'blocker' }),
      expect.objectContaining({ group: 'project', level: 'blocker', action: expect.objectContaining({ unitId: 'armflea' }) }),
    ]));
  });

  it('blocks copy when final compiler semantics fail', () => {
    const result = buildCompatibilityPreflight({
      compiledModules: compiled(),
      compilerValidation: {
        isValid: false,
        issues: [{
          id: 'compiler-lua-syntax-tweakdefs1',
          code: 'lua-syntax',
          level: 'blocker',
          fieldName: 'tweakdefs1',
          source: 'generated',
          message: 'Lua 5.1 syntax failed.',
        }],
      },
    });

    expect(result).toMatchObject({ status: 'blocked', canCopyLobbyCommands: false });
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'compiler-lua-syntax-tweakdefs1',
        group: 'delivery',
        level: 'blocker',
      }),
    ]));
  });

  it('reports safe compiler deduplication without downgrading readiness', () => {
    const result = buildCompatibilityPreflight({
      compiledModules: compiled({
        deduplication: {
          removedBlockCount: 2,
          rawBytesSaved: 240,
          encodedBytesSaved: 320,
          slotsSaved: 1,
        },
      }),
      compilerValidation: {
        isValid: true,
        checkedBlockCount: 4,
        checkedSlotCount: 2,
        issues: [],
      },
    });

    expect(result).toMatchObject({ status: 'ready', canCopyLobbyCommands: true });
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'delivery-safe-deduplication',
        level: 'info',
      }),
    ]));
  });

  it('keeps imperfect community Lua exportable when findings are advisory rather than definite failures', () => {
    const module = { id: 'module-a', label: 'Community tweak', enabled: true, converted: false, requirements: ['forceallunits'] };
    const analysis = packageAnalysis('module-a', {
      analyses: new Map([['module-a', {
        warnings: [{ code: 'global-loop', level: 'warning', message: 'Iterates over every UnitDef.' }],
        unknownCustomParameters: ['community_runtime_flag'],
      }]]),
      moduleReports: [{
        moduleId: 'module-a',
        unresolved: [{ unitId: 'scav_epic_unit' }],
        orderingIssues: [],
        typeIssues: [{ field: 'range', actualType: 'string', expectedType: 'number' }],
        runtimeRisks: [{ code: 'nested-weapondefs', message: 'Target must exist.', count: 2 }],
        assetReferences: [{ value: 'Units/custom.s3o' }],
      }],
      cycles: [],
    });
    const result = buildCompatibilityPreflight({
      compiledModules: compiled(),
      tweakModules: [module],
      packageAnalysis: analysis,
    });

    expect(result.status).toBe('review');
    expect(result.canCopyLobbyCommands).toBe(true);
    expect(result.counts.blocker).toBe(0);
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'requirement-forceallunits', level: 'warning' }),
      expect.objectContaining({ id: 'modules-types-module-a', level: 'warning' }),
      expect.objectContaining({ id: 'assets-module-a', level: 'warning' }),
    ]));
  });

  it('blocks active syntax failures and duplicate supporting WeaponDef destinations', () => {
    const module = { id: 'bad-module', label: 'Broken source', enabled: true, converted: false };
    const result = buildCompatibilityPreflight({
      compiledModules: compiled(),
      tweakModules: [module],
      packageAnalysis: packageAnalysis('bad-module', {
        analyses: new Map([['bad-module', { warnings: [{ code: 'syntax', level: 'error', message: 'Unexpected token' }], unknownCustomParameters: [] }]]),
        blockingIssues: [{ code: 'syntax', moduleIds: ['bad-module'] }],
      }),
      knownUnitIds: ['armflea'],
      supportingWeaponDefs: [
        { id: 'one', ownerUnitId: 'armflea', key: 'child', definition: { range: 100 }, enabled: true },
        { id: 'two', ownerUnitId: 'armflea', key: 'child', definition: { range: 200 }, enabled: true },
      ],
    });

    expect(result.status).toBe('blocked');
    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: expect.stringContaining('module-blocker-syntax'), level: 'blocker' }),
      expect.objectContaining({ id: 'support-duplicate-armflea:child', level: 'blocker' }),
    ]));
  });

  it('detects UnitDef typos using fuzzy Levenshtein distance and suggests corrections', () => {
    const module = {
      id: 'typo-mod',
      label: 'Typo Source',
      enabled: true,
      converted: false,
      rawLua: `a['oor_doomt3'] = nil`,
    };
    const result = buildCompatibilityPreflight({
      compiledModules: compiled(),
      tweakModules: [module],
      packageAnalysis: packageAnalysis('typo-mod'),
      knownUnitIds: ['cordoomt3', 'armflea'],
    });

    expect(result.items).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'fuzzy-typo-typo-mod-oor_doomt3',
        level: 'warning',
        title: expect.stringContaining('UnitDef Typo "oor_doomt3"'),
        action: expect.objectContaining({
          target: 'oor_doomt3',
          replacement: 'cordoomt3',
        }),
      }),
    ]));
  });
});
