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
    expect(sanitizedSource).not.toContain('[2] = ""');
    expect(sanitizedSource).not.toContain('[3] = ""');
    expect(issuesFixed).toBe(2);
  });
});
