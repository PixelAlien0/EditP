import { describe, expect, it } from 'vitest';
import { repairAndSanitizeTweakPackage } from './tweakPackage.js';

describe('Tweak Package Auto-Sanitizer & Repair Tool', () => {
  it('strips dangerous inline comments from tweak text', () => {
    const raw = `
health = 2000, -- removed 000 (was 150000) -- x10 (was 200)
speed = 100, -- buffed speed
`;
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);
    expect(sanitizedSource).not.toContain('-- removed 000');
    expect(sanitizedSource).not.toContain('-- buffed speed');
    expect(issuesFixed).toBe(2);
  });

  it('normalizes string booleans into raw booleans', () => {
    const raw = `
gravityaffected = "false",
turret = "true",
`;
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);
    expect(sanitizedSource).toContain('gravityaffected = false,');
    expect(sanitizedSource).toContain('turret = true,');
    expect(issuesFixed).toBe(2);
  });

  it('cleans empty array slots from buildoptions', () => {
    const raw = `
buildoptions = {
  [1] = "armmex",
  [2] = "",
  [3] = "",
  [4] = "cormex"
}
`;
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);
    expect(sanitizedSource).not.toContain('[3] = ""');
    expect(issuesFixed).toBe(2);
  });

  it('repairs function signature parameter list typos (e.g. jIa.metalcost -> j) a.metalcost)', () => {
    const raw = `function SOLBALANCEE(e,f,g,h,i,jIa.metalcost=100 end`;
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);
    expect(sanitizedSource).toContain('function SOLBALANCEE(e,f,g,h,i,j) a.metalcost=100 end');
    expect(issuesFixed).toBe(1);
  });

  it('auto-corrects mismatched helper call typos (e.g. ONX -> ON)', () => {
    const raw = `
function ON(d) a.onoffable=d end
ONX(true)
`;
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);
    expect(sanitizedSource).toContain('ON(true)');
    expect(issuesFixed).toBe(1);
  });

  it('repairs property and UnitDef key typos (e.g. seelfdestructas -> selfdestructas, oor_doomt3 -> cordoomt3)', () => {
    const raw = `
a.seelfdestructas = ''
a.cantbetranspVVted = false
a['oor_doomt3'] = nil
UnitDefs['raptor_turret_basic_t3s_v1'] = nil
`;
    const { sanitizedSource, issuesFixed } = repairAndSanitizeTweakPackage(raw);
    expect(sanitizedSource).toContain("a.selfdestructas = ''");
    expect(sanitizedSource).toContain('a.cantbetransported = false');
    expect(sanitizedSource).toContain("a['cordoomt3'] = nil");
    expect(sanitizedSource).toContain("UnitDefs['raptor_turret_basic_t3_v1'] = nil");
    expect(issuesFixed).toBe(4);
  });
});
