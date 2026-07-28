import { describe, expect, it } from 'vitest';
import {
  buildCanonicalCompilerBlocks,
  buildLobbyCommands,
  COMPILER_BLOCK_SCHEMA_VERSION,
  compileLobbyModules,
} from './lobbyModules.js';
import luaparse from 'luaparse';
import { serializeLuaTable } from './tweakSerializer.js';

const moduleOf = (kind, index, stage = 'before-editor') => ({
  id: `${kind}-${index}`, kind, label: `${kind} ${index}`,
  rawLua: kind === 'defs' ? `local defs_${index} = true` : `{ unit_${index} = { health = ${index} } }`,
  enabled: true, converted: false, stage, order: index,
});

describe('numbered lobby module compilation', () => {
  it('uses exactly the available nine slots per kind', () => {
    const compiled = compileLobbyModules({
      tweakModules: Array.from({ length: 9 }, (_, index) => moduleOf('defs', index)),
      generatedTweakDefsLua: '', generatedTweakUnitsLua: '', base64Options: { padding: false },
    });
    expect(compiled.defs.required).toBe(9);
    expect(compiled.defs.overflow).toBe(false);
    expect(compiled.defs.slots.at(-1).fieldName).toBe('tweakdefs9');
    expect(compiled.slots.some(slot => slot.fieldName === 'tweakdefs10')).toBe(false);
  });

  it('blocks command output when a tenth slot is required', () => {
    const compiled = compileLobbyModules({
      tweakModules: Array.from({ length: 10 }, (_, index) => moduleOf('units', index)),
      generatedTweakDefsLua: '', generatedTweakUnitsLua: '', base64Options: { padding: true },
    });
    expect(compiled.units.required).toBe(10);
    expect(compiled.units.slots).toHaveLength(9);
    expect(compiled.overflow).toBe(true);
    expect(buildLobbyCommands(compiled)).toBe('');
  });

  it('orders imported before, generated, then imported after', () => {
    const compiled = compileLobbyModules({
      tweakModules: [moduleOf('defs', 2, 'after-editor'), moduleOf('defs', 1, 'before-editor')],
      generatedTweakDefsLua: 'local generated = true', generatedTweakUnitsLua: '', base64Options: { padding: false },
    });
    expect(compiled.defs.slots.map(slot => slot.id)).toEqual(['defs-1', 'generated-defs-1', 'defs-2']);
    const commands = buildLobbyCommands(compiled);
    expect(commands.split('\n')).toHaveLength(3);
    expect(commands).toContain('!bset tweakdefs1 ');
    expect(commands).toContain('!bset tweakdefs3 ');
  });

  it('splits generated unit tables only between complete unit entries', () => {
    const table = Object.fromEntries(Array.from({ length: 90 }, (_, index) => [
      `unit_${index}`, { health: index + 1, description: 'safe-boundary'.repeat(12) },
    ]));
    const compiled = compileLobbyModules({
      tweakModules: [], generatedTweakDefsLua: '', generatedTweakUnitsLua: serializeLuaTable(table),
      base64Options: { padding: false },
    });
    expect(compiled.units.required).toBeGreaterThan(1);
    compiled.units.slots.forEach(slot => expect(() => luaparse.parse(`return ${slot.lua}`)).not.toThrow());
  });

  it('separates large generated definition feature blocks at canonical markers', () => {
    const cloneBlock = `do\n  local function clone_copy(value) return value end\n${'  local clone_value = true -- padding\n'.repeat(180)}  do\n    local nested = true\n  end\nend`;
    const menuBlock = `-- EDITP_BUILDMENU_BEGIN\n${'local menu_value = true -- padding\n'.repeat(180)}-- EDITP_BUILDMENU_END`;
    const compiled = compileLobbyModules({
      tweakModules: [], generatedTweakDefsLua: `${cloneBlock}\n${menuBlock}`, generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    expect(compiled.defs.required).toBe(2);
    compiled.defs.slots.forEach(slot => expect(() => luaparse.parse(slot.lua)).not.toThrow());
  });

  it('creates versioned canonical blocks with stable feature ownership and source metadata', () => {
    const generated = [
      '-- project preamble',
      '-- EDITP_CARRIER_LINKAGE_BEGIN',
      'local carrier_linkage = true',
      '-- EDITP_CARRIER_LINKAGE_END',
      '-- EDITP_SUPPORTING_WEAPONDEFS_BEGIN',
      'local supporting_weapon = true',
      '-- EDITP_SUPPORTING_WEAPONDEFS_END',
      '-- EDITP_BUILDMENU_BEGIN',
      'local build_menu = true',
      '-- EDITP_BUILDMENU_END',
    ].join('\n');
    const imported = {
      ...moduleOf('defs', 4),
      sourceName: 'reference.lua',
      originalFieldName: 'tweakdefs2',
      dependencies: [' unit_b ', 'unit_a', 'unit_a'],
    };
    const blocks = buildCanonicalCompilerBlocks({
      tweakModules: [imported],
      generatedTweakDefsLua: generated,
      generatedTweakUnitsLua: '{ armflash = { health = 100 }, corak = { speed = 60 } }',
    });

    expect(blocks.schemaVersion).toBe(COMPILER_BLOCK_SCHEMA_VERSION);
    expect(blocks.defs.map(block => block.sourceFeature)).toEqual([
      'tweak-package',
      'legacy-source',
      'carrier-workbench',
      'weapon-dependencies',
      'build-menus',
    ]);
    expect(blocks.defs[0]).toMatchObject({
      id: 'imported:defs:defs-4',
      kind: 'defs',
      category: 'imported-module',
      stage: 'before-editor',
      dependencies: ['unit_a', 'unit_b'],
      metadata: {
        moduleId: 'defs-4',
        sourceName: 'reference.lua',
        originalFieldName: 'tweakdefs2',
      },
    });
    expect(blocks.all.every(block => block.rawBytes > 0)).toBe(true);
    expect(new Set(blocks.all.map(block => block.id)).size).toBe(blocks.all.length);
    expect(blocks.defs.map(block => block.sequence)).toEqual([0, 1, 2, 3, 4]);
    expect(blocks.units.map(block => block.metadata.unitId)).toEqual(['armflash', 'corak']);
  });

  it('records every canonical block exactly once in its materialized lobby slots', () => {
    const compiled = compileLobbyModules({
      tweakModules: [
        moduleOf('defs', 1, 'before-editor'),
        moduleOf('defs', 2, 'after-editor'),
      ],
      generatedTweakDefsLua: [
        '-- EDITP_UNIT_TWEAKS_BEGIN',
        'local unit_patch = true',
        '-- EDITP_UNIT_TWEAKS_END',
        '-- EDITP_DEATH_PROFILES_BEGIN',
        'local death_patch = true',
        '-- EDITP_DEATH_PROFILES_END',
      ].join('\n'),
      generatedTweakUnitsLua: serializeLuaTable({
        armflash: { health: 100 },
        corak: { speed: 60 },
      }),
      base64Options: { padding: false },
    });
    const recordedIds = compiled.slots.flatMap(slot => slot.blockIds);
    const canonicalIds = compiled.canonicalBlocks.all.map(block => block.id);

    expect(recordedIds).toEqual(canonicalIds);
    expect(new Set(recordedIds).size).toBe(recordedIds.length);
    expect(compiled.slots.every(slot => slot.blockCount === slot.blockIds.length)).toBe(true);
  });

  it('keeps generated header comments attached to an oversized first feature block', () => {
    const compiled = compileLobbyModules({
      tweakModules: [],
      generatedTweakDefsLua: [
        '-- Mod Name: Canonical block test',
        '-- Generated with BAR Editor',
        '-- EDITP_CLONES_BEGIN',
        'do',
        '  local function clone_copy(value) return value end',
        ...Array.from({ length: 500 }, () => '  local clone_value = true -- padding'),
        'end',
        '-- EDITP_CLONES_END',
      ].join('\n'),
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    expect(compiled.defs.required).toBe(1);
    expect(compiled.defs.slots[0].blockCount).toBe(2);
    expect(compiled.defs.slots[0].lua).toContain('-- Mod Name: Canonical block test');
    expect(compiled.defs.slots[0].lua).toContain('-- EDITP_CLONES_BEGIN');
  });

  it('produces byte-identical slots and commands for equivalent input ordering', () => {
    const defsBefore = {
      ...moduleOf('defs', 1, 'before-editor'),
      rawLua: '\uFEFFlocal alpha = true\r\nlocal beta = true\r\n',
      dependencies: ['corak', 'armflash'],
    };
    const defsAfter = moduleOf('defs', 2, 'after-editor');
    const first = compileLobbyModules({
      tweakModules: [defsAfter, defsBefore],
      generatedTweakDefsLua: '-- stable generated defs\r\nlocal generated = true\r\n',
      generatedTweakUnitsLua: '{ corak = { speed = 60 }, armflash = { health = 100 } }',
      base64Options: { padding: false },
    });
    const second = compileLobbyModules({
      tweakModules: [
        { ...defsBefore, rawLua: 'local alpha = true\nlocal beta = true' },
        defsAfter,
      ],
      generatedTweakDefsLua: '-- stable generated defs\nlocal generated = true',
      generatedTweakUnitsLua: '{ armflash = { health = 100 }, corak = { speed = 60 } }',
      base64Options: { padding: false },
    });

    expect(first.slots.map(slot => slot.lua)).toEqual(second.slots.map(slot => slot.lua));
    expect(first.slots.map(slot => slot.encoded)).toEqual(second.slots.map(slot => slot.encoded));
    expect(first.canonicalBlocks).toEqual(second.canonicalBlocks);
    expect(buildLobbyCommands(first)).toBe(buildLobbyCommands(second));
  });

  it('uses deterministic tie-breakers for equally sized module diagnostics', () => {
    const first = compileLobbyModules({
      tweakModules: [moduleOf('defs', 2), moduleOf('defs', 1)],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
    });
    const second = compileLobbyModules({
      tweakModules: [moduleOf('defs', 1), moduleOf('defs', 2)],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
    });

    expect(first.defs.largestModules).toEqual(second.defs.largestModules);
    expect(first.defs.largestModules.map(module => module.id)).toEqual(['defs-1', 'defs-2']);
  });

  it('compacts only generated slots and records equivalence-guarded savings', () => {
    const importedLua = 'local imported_value = true\nlocal imported_spacing = true';
    const project = {
      tweakModules: [{
        ...moduleOf('defs', 1),
        rawLua: importedLua,
      }],
      generatedTweakDefsLua: [
        '-- EDITP_UNIT_TWEAKS_BEGIN',
        'do',
        '  local unit = UnitDefs.armflash',
        '  if unit then',
        '    unit.health = 750',
        '  end',
        'end',
        '-- EDITP_UNIT_TWEAKS_END',
      ].join('\n'),
      generatedTweakUnitsLua: '{\n  armflash = {\n    health = 750,\n  },\n}',
      base64Options: { padding: false },
    };
    const compacted = compileLobbyModules(project);
    const uncompacted = compileLobbyModules(project, { compactGenerated: false });

    expect(compacted.defs.slots[0].source).toBe('imported');
    expect(compacted.defs.slots[0].lua).toBe(importedLua);
    expect(compacted.defs.slots[0].compaction).toBeUndefined();
    expect(compacted.compaction).toMatchObject({
      enabled: true,
      equivalenceGuarded: true,
      attemptedSlotCount: 2,
      appliedSlotCount: 2,
      fallbackSlotCount: 0,
    });
    expect(compacted.compaction.encodedBytesSaved).toBeGreaterThan(0);
    expect(compacted.aggregateBytes).toBeLessThan(uncompacted.aggregateBytes);
    expect(compacted.slots.filter(slot => slot.source === 'generated').every(slot => (
      slot.compaction.applied && slot.compaction.equivalent
    ))).toBe(true);
  });

  it('safely collapses byte-identical imported modules in the same execution stage', () => {
    const duplicateLua = 'local exact_duplicate = true';
    const compiled = compileLobbyModules({
      tweakModules: [
        { ...moduleOf('defs', 1), rawLua: duplicateLua },
        { ...moduleOf('defs', 2), rawLua: duplicateLua },
      ],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    expect(compiled.defs.required).toBe(1);
    expect(compiled.defs.slots[0].blockIds).toEqual([
      'imported:defs:defs-1',
      'imported:defs:defs-2',
    ]);
    expect(compiled.deduplication).toMatchObject({
      removedBlockCount: 1,
      slotsSaved: 1,
      before: { blockCount: 2, slotCount: 2 },
      after: { blockCount: 1, slotCount: 1 },
    });
    expect(compiled.deduplication.rawBytesSaved).toBeGreaterThan(0);
    expect(compiled.deduplication.encodedBytesSaved).toBeGreaterThan(0);
  });

  it('does not collapse identical Lua across load stages, lanes, or source ownership', () => {
    const duplicateLua = 'local exact_duplicate = true';
    const compiled = compileLobbyModules({
      tweakModules: [
        { ...moduleOf('defs', 1, 'before-editor'), rawLua: duplicateLua },
        { ...moduleOf('defs', 2, 'after-editor'), rawLua: duplicateLua },
        {
          ...moduleOf('units', 3, 'before-editor'),
          rawLua: '{ exact_duplicate = { health = 1, }, }',
        },
      ],
      generatedTweakDefsLua: duplicateLua,
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    expect(compiled.deduplication.removedBlockCount).toBe(0);
    expect(compiled.defs.required).toBe(3);
    expect(compiled.units.required).toBe(1);
  });

  it('collapses repeated generated feature blocks while retaining canonical provenance', () => {
    const feature = [
      '-- EDITP_BUILDMENU_BEGIN',
      'local exact_menu = true',
      '-- EDITP_BUILDMENU_END',
    ].join('\n');
    const compiled = compileLobbyModules({
      tweakModules: [],
      generatedTweakDefsLua: `${feature}\n\n${feature}`,
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    expect(compiled.canonicalBlocks.defs).toHaveLength(2);
    expect(compiled.effectiveBlocks.defs).toHaveLength(1);
    expect(compiled.defs.slots[0].blockIds).toEqual([
      'generated:defs:build-menu:1',
      'generated:defs:build-menu:2',
    ]);
    expect(compiled.deduplication.removedBlockCount).toBe(1);
  });
});
