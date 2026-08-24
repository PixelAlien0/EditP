import { describe, expect, it } from 'vitest';
import {
  buildAiSmokeTestProtocol,
  buildAiSmokeTestReport,
  createAiSmokeTestRecord,
  normalizeAiSmokeTestRecord,
  serializeAiSmokeTestReport,
  summarizeAiSmokeTestRecord,
} from './barbarianAiSmokeTest.js';

function makeAudit({ profileCount = 1 } = {}) {
  return {
    compatibility: 'compatible',
    parsedProfileCount: profileCount,
    contract: {
      id: 'barbarian-ai-v1',
      identity: {
        name: 'Test AI',
        shortName: 'TAI',
        version: '1.2.3',
      },
      version: 1,
      profileSurfaces: [],
      optionKeys: [],
      scriptRoutes: [],
      runtimeFingerprints: [],
    },
    totals: { files: 3, bytes: 40, scripts: 1, nativeFiles: 1, blockers: 0, reviews: 0, notes: 0 },
    references: { referenced: [], missing: [], unresolved: [], deprecated: [] },
    findings: [],
    files: [
      { path: 'AIInfo.lua', kind: 'lua', size: 10, hash: 'a1' },
      { path: 'SkirmishAI.dll', kind: 'native', size: 20, hash: 'b2' },
      { path: 'config/behavior.json', kind: 'json', size: 10, hash: 'c3' },
    ],
  };
}

describe('AI package smoke-test protocol', () => {
  it('includes the profile check only when parsed profiles exist', () => {
    expect(buildAiSmokeTestProtocol(makeAudit()).tests.map(test => test.id)).toContain('profile-overlay');
    expect(buildAiSmokeTestProtocol(makeAudit({ profileCount: 0 })).tests.map(test => test.id)).not.toContain('profile-overlay');
  });

  it('normalizes untrusted local record values and removes unknown tests', () => {
    const audit = makeAudit();
    const normalized = normalizeAiSmokeTestRecord(audit, {
      environment: { platform: 'windows\u0000', mapName: 'Test map' },
      results: {
        'package-discovery': { status: 'maybe', note: 'bad\u0000note' },
        unknown: { status: 'passed', note: 'ignore me' },
      },
    });

    expect(normalized.environment.platform).toBe('windows');
    expect(normalized.results['package-discovery']).toEqual({ status: 'pending', note: 'badnote' });
    expect(normalized.results.unknown).toBeUndefined();
  });

  it('keeps the verdict incomplete until all checks are reviewed', () => {
    const audit = makeAudit();
    const record = createAiSmokeTestRecord(audit);
    expect(summarizeAiSmokeTestRecord(audit, record).verdict).toBe('incomplete');

    Object.values(record.results).forEach(result => { result.status = 'passed'; });
    expect(summarizeAiSmokeTestRecord(audit, record).verdict).toBe('passed');

    record.results['match-start'].status = 'failed';
    const failed = summarizeAiSmokeTestRecord(audit, record);
    expect(failed.verdict).toBe('failed');
    expect(failed.criticalFailures).toBe(1);
  });

  it('exports deterministic sanitized evidence without package contents', () => {
    const audit = makeAudit();
    const record = createAiSmokeTestRecord(audit);
    record.environment.barVersion = 'test-123';
    record.results['package-discovery'] = { status: 'passed', note: 'Visible in lobby.' };
    const report = buildAiSmokeTestReport(audit, record);
    const first = serializeAiSmokeTestReport(audit, record);
    const second = serializeAiSmokeTestReport(audit, record);

    expect(first).toBe(second);
    expect(report.safety).toEqual({
      manualEvidenceOnly: true,
      importedCodeExecuted: false,
      sourceContentsIncluded: false,
      nativeBinariesIncluded: false,
    });
    expect(first).not.toContain('SkirmishAI.dll');
    expect(first).not.toContain('config/behavior.json');
    expect(first).toContain('Visible in lobby.');
  });
});
