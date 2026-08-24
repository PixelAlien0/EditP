import { describe, expect, it } from 'vitest';
import { auditBarbarianAiPackage, stableContentHash } from './barbarianAiPackage.js';
import { buildAiUpgradeMigrationChecklist, buildAiUpgradeMigrationPlan } from './barbarianAiMigrationPlan.js';

function record(path, text = null, kind = 'other') {
  const content = text ?? path;
  return { path, name: path.split('/').pop(), size: content.length, hash: stableContentHash(content), kind, isText: text !== null, text };
}

function audit({ shortName = 'EditP', version = '1', option = 'profile', runtime = 'runtime-v1', units = ['armcom'] } = {}) {
  return auditBarbarianAiPackage([
    record('AIInfo.lua', `return { shortName = "${shortName}", name = "EditP AI", version = "${version}" }`, 'ai-info'),
    record('AIOptions.lua', `return { { key = "${option}" } }`, 'ai-options'),
    record('config/behaviour.json', JSON.stringify({ units }), 'config'),
    record('SkirmishAI.dll', runtime, 'native'),
  ], { knownUnitIds: ['armcom', 'corcom'] });
}

describe('AI upgrade migration plan', () => {
  it('keeps an unchanged upgrade ready with a required smoke test', () => {
    const plan = buildAiUpgradeMigrationPlan(audit(), audit());
    expect(plan.verdict).toBe('ready');
    expect(plan.summary.total).toBe(1);
    expect(plan.stages.at(-1).actions[0].id).toBe('validation:fresh-smoke-test');
  });

  it('orders identity, configuration, runtime, and validation work', () => {
    const baseline = audit();
    const current = audit({ shortName: 'EditP2', version: '2', option: 'difficulty', runtime: 'runtime-v2', units: ['armcom', 'armmissingunit'] });
    const plan = buildAiUpgradeMigrationPlan(baseline, current);

    expect(plan.verdict).toBe('blocked');
    expect(plan.stages.map(stage => stage.id)).toEqual(['identity', 'configuration', 'runtime', 'validation']);
    expect(plan.stages.flatMap(stage => stage.actions).some(item => item.id === 'references:unresolved' && item.status === 'blocked')).toBe(true);
    expect(plan.stages.flatMap(stage => stage.actions).some(item => item.id === 'runtime:skirmishai.dll')).toBe(true);
  });

  it('creates a portable static checklist without package source', () => {
    const summary = buildAiUpgradeMigrationChecklist(audit(), audit({ version: '2' }));
    expect(summary).toContain('Migration verdict: review');
    expect(summary).toContain('Run a fresh BAR smoke test');
    expect(summary).toContain('Imported package code was not executed');
  });
});
