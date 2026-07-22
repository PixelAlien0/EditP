import { describe, expect, it } from 'vitest';
import { buildLobbyCommands, compileLobbyModules } from './lobbyModules.js';
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
});
