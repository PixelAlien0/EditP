import { describe, expect, it } from 'vitest';
import { repairAndSanitizeTweakPackage } from './tweakPackage.js';

describe('Tweak Package source normalizer', () => {
  it('normalizes transport formatting without changing Lua semantics', () => {
    const raw = '\uFEFFhealth = 2000, -- balance note  \r\ngravityaffected = "false",\t\r\n';
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);

    expect(sanitizedSource).toBe('health = 2000, -- balance note\ngravityaffected = "false",');
    expect(issuesFixed).toBeGreaterThan(0);
  });

  it('preserves comments, string booleans, sparse arrays, identifiers, and helper calls', () => {
    const raw = `-- module attribution
buildoptions = {
  [1] = "armmex",
  [2] = "",
}
function ON(d) a.onoffable=d end
ONX(true)
a.seelfdestructas = "preserve-literal-source"
gravityaffected = "false"`;

    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);

    expect(sanitizedSource).toBe(raw);
    expect(issuesFixed).toBe(0);
  });

  it('does not treat comment markers inside strings as comments', () => {
    const raw = 'description = "keep -- this text"';
    expect(repairAndSanitizeTweakPackage(raw).sanitizedSource).toBe(raw);
  });
});
