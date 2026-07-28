import luaparse from 'luaparse';
import { describe, expect, it } from 'vitest';
import {
  areLuaProgramsEquivalent,
  compactLuaIfEquivalent,
} from './luaCompaction.js';

function parse(lua, kind) {
  return luaparse.parse(kind === 'units' ? `return ${lua}` : lua, {
    luaVersion: '5.1',
    comments: false,
  });
}

describe('equivalence-guarded Lua compaction', () => {
  it('compacts generated Definitions only after their Lua 5.1 ASTs match', () => {
    const source = [
      '-- Stable project header',
      '-- EDITP_UNIT_TWEAKS_BEGIN',
      'do',
      '  local unit = UnitDefs.armflash',
      '  if unit then',
      '    unit.health = 750',
      '    unit.description = "spaces and -- comment text stay"',
      '  end',
      'end',
      '-- EDITP_UNIT_TWEAKS_END',
    ].join('\n');
    const result = compactLuaIfEquivalent(source, { kind: 'defs' });

    expect(result).toMatchObject({
      applied: true,
      equivalent: true,
      reason: 'equivalent',
    });
    expect(result.rawBytesSaved).toBeGreaterThan(0);
    expect(result.encodedBytesSaved).toBeGreaterThan(0);
    expect(result.lua).toContain('"spaces and -- comment text stay"');
    expect(parse(result.lua, 'defs')).toEqual(parse(source, 'defs'));
  });

  it('compacts literal Units tables without changing their parsed structure', () => {
    const source = [
      '{',
      '  armflash = {',
      '    health = 750,',
      '    maxvelocity = 3.5,',
      '  },',
      '}',
    ].join('\n');
    const result = compactLuaIfEquivalent(source, { kind: 'units', padding: true });

    expect(result.applied).toBe(true);
    expect(areLuaProgramsEquivalent(source, result.lua, 'units')).toBe(true);
    expect(parse(result.lua, 'units')).toEqual(parse(source, 'units'));
  });

  it('preserves token boundaries around concatenation, decimals, and unary minus', () => {
    const source = [
      'local first = 1 .. 2',
      'local second = .5',
      'local third = - -1',
      'return first, second, third',
    ].join('\n');
    const result = compactLuaIfEquivalent(source, { kind: 'defs' });

    expect(result.applied).toBe(true);
    expect(result.lua).toContain('1 .. 2');
    expect(result.lua).toContain('- -1');
    expect(areLuaProgramsEquivalent(source, result.lua, 'defs')).toBe(true);
  });

  it('falls back to the original bytes when equivalence cannot be proven', () => {
    const source = 'local broken = 1 +';
    const result = compactLuaIfEquivalent(source, { kind: 'defs' });

    expect(result.lua).toBe(source);
    expect(result.applied).toBe(false);
    expect(result.equivalent).toBe(false);
    expect(result.reason).toBe('equivalence-failed');
    expect(result.rawBytesSaved).toBe(0);
  });

  it('does not alter source when compaction is explicitly disabled', () => {
    const source = 'local value = true\nreturn value';
    const result = compactLuaIfEquivalent(source, { kind: 'defs', enabled: false });

    expect(result).toMatchObject({
      lua: source,
      attempted: false,
      applied: false,
      reason: 'disabled',
    });
  });
});
