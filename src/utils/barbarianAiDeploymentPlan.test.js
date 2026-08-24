import { describe, expect, it } from 'vitest';
import { auditBarbarianAiPackage, stableContentHash } from './barbarianAiPackage.js';
import {
  buildAiDeploymentChecklist,
  buildAiDeploymentPlan,
  serializeAiDeploymentPlan,
} from './barbarianAiDeploymentPlan.js';

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

function exampleAudit(identity = 'shortName = "EditP", name = "EditP Test AI", version = "1"') {
  return auditBarbarianAiPackage([
    record('AIInfo.lua', `return { ${identity} }`, 'ai-info'),
    record('AIOptions.lua', 'return { { key = "profile" } }', 'ai-options'),
    record('config/behaviour.json', '{"units":["armcom"]}', 'config'),
    record('SkirmishAI.dll', null, 'native'),
    record('libSkirmishAI.so', null, 'native'),
  ], { knownUnitIds: ['armcom'] });
}

describe('AI package deployment plans', () => {
  it('builds a deterministic sanitized installation plan', () => {
    const audit = exampleAudit();
    const plan = buildAiDeploymentPlan(audit);

    expect(plan).toMatchObject({
      kind: 'editp-skirmish-ai-deployment-plan',
      version: 1,
      readiness: 'ready',
      destination: 'AI/Skirmish/EditP/1',
      safety: {
        planOnly: true,
        importedCodeExecuted: false,
        sourceContentsIncluded: false,
        nativeBinariesIncluded: false,
      },
    });
    expect(plan.coverage.find(item => item.id === 'windows').status).toBe('present');
    expect(plan.coverage.find(item => item.id === 'linux').status).toBe('present');
    expect(plan.coverage.find(item => item.id === 'macos').status).toBe('missing');
    expect(JSON.stringify(plan)).not.toContain('return { shortName');
    expect(serializeAiDeploymentPlan(audit)).toBe(serializeAiDeploymentPlan(audit));
  });

  it('blocks a package without a discoverable short name', () => {
    const plan = buildAiDeploymentPlan(exampleAudit('name = "Nameless AI", version = "1"'));
    expect(plan.readiness).toBe('blocked');
    expect(plan.destination).toBe('AI/Skirmish/<shortName>/<version>');
  });

  it('produces a clipboard checklist with runtime and engine-update cautions', () => {
    const checklist = buildAiDeploymentChecklist(exampleAudit());
    expect(checklist).toContain('AI/Skirmish/EditP/1');
    expect(checklist).toContain('Windows present');
    expect(checklist).toContain('engine update can replace versioned engine folders');
  });
});
