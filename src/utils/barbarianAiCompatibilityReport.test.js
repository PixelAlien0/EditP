import { describe, expect, it } from 'vitest';
import { auditBarbarianAiPackage, stableContentHash } from './barbarianAiPackage.js';
import {
  buildAiCompatibilityReport,
  buildAiCompatibilitySummary,
  serializeAiCompatibilityReport,
} from './barbarianAiCompatibilityReport.js';

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

function exampleAudit() {
  return auditBarbarianAiPackage([
    record('AIInfo.lua', 'return { shortName = "EditP", name = "EditP Test AI", version = "1" }', 'ai-info'),
    record('AIOptions.lua', 'return { { key = "profile" } }', 'ai-options'),
    record('config/behaviour.json', '{"units":["armcom"]}', 'config'),
    record('SkirmishAI.dll', null, 'native'),
  ], { knownUnitIds: ['armcom'] });
}

describe('AI package compatibility reports', () => {
  it('builds an actionable report without embedding imported source or binaries', () => {
    const report = buildAiCompatibilityReport(exampleAudit());

    expect(report).toMatchObject({
      kind: 'editp-skirmish-ai-compatibility-report',
      version: 1,
      safety: {
        inspectionMode: 'static-only',
        importedCodeExecuted: false,
        sourceFilesIncluded: false,
        nativeBinariesIncluded: false,
      },
      package: { name: 'EditP Test AI', files: 4 },
    });
    expect(report.checks.map(item => item.id)).toEqual([
      'identity',
      'runtime',
      'profiles',
      'lobby-options',
      'unit-references',
    ]);
    expect(JSON.stringify(report)).not.toContain('return { shortName');
  });

  it('serializes deterministically for the same package', () => {
    const audit = exampleAudit();
    expect(serializeAiCompatibilityReport(audit)).toBe(serializeAiCompatibilityReport(audit));
    expect(buildAiCompatibilityReport(audit).package.fingerprint).toMatch(/^[a-f0-9]{8}$/);
  });

  it('creates a concise clipboard summary with the required runtime caveat', () => {
    const summary = buildAiCompatibilitySummary(exampleAudit());
    expect(summary).toContain('EditP Test AI — Compatible');
    expect(summary).toContain('Static BAR Editor report');
    expect(summary).toContain('in-game testing is still required');
  });
});
