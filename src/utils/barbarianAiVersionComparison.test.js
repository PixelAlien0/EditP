import { describe, expect, it } from 'vitest';
import { auditBarbarianAiPackage, stableContentHash } from './barbarianAiPackage.js';
import { buildAiVersionComparisonSummary, compareBarbarianAiPackages } from './barbarianAiVersionComparison.js';

function record(path, text = null, kind = 'other') {
  const content = text ?? path;
  return {
    path,
    name: path.split('/').pop(),
    size: content.length,
    hash: stableContentHash(content),
    kind,
    isText: text !== null,
    text,
  };
}

function audit({ version = '1', option = 'profile', runtime = 'runtime-v1', units = ['armcom'], surface = 'behaviour' } = {}) {
  return auditBarbarianAiPackage([
    record('AIInfo.lua', `return { shortName = "EditP", name = "EditP AI", version = "${version}" }`, 'ai-info'),
    record('AIOptions.lua', `return { { key = "${option}" } }`, 'ai-options'),
    record(`config/${surface}.json`, JSON.stringify({ units }), 'config'),
    record('SkirmishAI.dll', runtime, 'native'),
  ], { knownUnitIds: ['armcom', 'corcom'] });
}

describe('AI package version comparison', () => {
  it('reports an unchanged package as compatible', () => {
    const baseline = audit();
    const current = audit();
    const report = compareBarbarianAiPackages(baseline, current);

    expect(report.verdict).toBe('compatible');
    expect(report.summary.totalChanges).toBe(0);
    expect(report.runtimes[0].status).toBe('unchanged');
  });

  it('flags runtime, option, profile, and reference changes for review', () => {
    const baseline = audit();
    const current = audit({ version: '2', option: 'difficulty', runtime: 'runtime-v2', units: ['armcom', 'armmissingunit'], surface: 'factory' });
    const report = compareBarbarianAiPackages(baseline, current);

    expect(report.verdict).toBe('review');
    expect(report.summary.identity).toBe(1);
    expect(report.options).toMatchObject({ added: ['difficulty'], removed: ['profile'] });
    expect(report.surfaces.filter(item => item.status !== 'unchanged')).toHaveLength(2);
    expect(report.runtimes[0].status).toBe('changed');
    expect(report.references.unresolved.added).toContain('armmissingunit');
  });

  it('blocks when the current audit itself is incompatible', () => {
    const baseline = audit();
    const current = auditBarbarianAiPackage([record('config/behaviour.json', '{ invalid', 'config')]);
    const report = compareBarbarianAiPackages(baseline, current);

    expect(report.verdict).toBe('blocked');
    expect(report.findings.some(item => item.status === 'added' && item.currentSeverity === 'blocker')).toBe(true);
    expect(buildAiVersionComparisonSummary(baseline, current)).toContain('Upgrade verdict: blocked');
  });
});
