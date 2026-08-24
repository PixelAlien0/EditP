import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { auditBarbarianAiPackage, stableContentHash } from './barbarianAiPackage.js';
import {
  buildAiReleaseBundle,
  buildAiReleaseDossier,
  serializeAiReleaseDossier,
} from './barbarianAiReleaseDossier.js';
import { createAiSmokeTestRecord } from './barbarianAiSmokeTest.js';

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
    record('libSkirmishAI.so', null, 'native'),
  ], { knownUnitIds: ['armcom'] });
}

function completedRecord(audit, status = 'passed') {
  const smoke = createAiSmokeTestRecord(audit);
  Object.values(smoke.results).forEach(result => { result.status = status; });
  smoke.environment = {
    platform: 'Windows',
    barVersion: 'test-bar',
    engineVersion: 'test-recoil',
    mapName: 'Test Map',
  };
  return smoke;
}

describe('AI package release dossier', () => {
  it('keeps an untested package in review', () => {
    const dossier = buildAiReleaseDossier(exampleAudit());
    expect(dossier.status).toBe('review');
    expect(dossier.gates.find(gate => gate.id === 'runtime').status).toBe('review');
  });

  it('requires every critical runtime check to pass explicitly', () => {
    const audit = exampleAudit();
    const smoke = completedRecord(audit);
    expect(buildAiReleaseDossier(audit, smoke).status).toBe('verified');

    smoke.results['engine-log'].status = 'skipped';
    const reviewed = buildAiReleaseDossier(audit, smoke);
    expect(reviewed.status).toBe('review');
    expect(reviewed.gates.find(gate => gate.id === 'runtime').status).toBe('review');
  });

  it('blocks a release when a runtime check fails', () => {
    const audit = exampleAudit();
    const smoke = completedRecord(audit);
    smoke.results['match-start'].status = 'failed';
    const dossier = buildAiReleaseDossier(audit, smoke);
    expect(dossier.status).toBe('blocked');
    expect(dossier.summary.blockers).toBe(1);
  });

  it('builds a deterministic evidence-only archive without imported paths or source', () => {
    const audit = exampleAudit();
    const smoke = completedRecord(audit);
    const first = buildAiReleaseBundle(audit, smoke);
    const second = buildAiReleaseBundle(audit, smoke);
    const files = unzipSync(first.bytes);
    const dossierJson = strFromU8(files['release-dossier.json']);
    const archiveText = Object.values(files).map(bytes => strFromU8(bytes)).join('\n');

    expect(Array.from(first.bytes)).toEqual(Array.from(second.bytes));
    expect(Object.keys(files).sort()).toEqual([
      'README.txt',
      'compatibility-evidence.json',
      'deployment-evidence.json',
      'release-dossier.json',
      'runtime-smoke-test.json',
    ]);
    expect(JSON.parse(dossierJson)).toMatchObject({
      status: 'verified',
      safety: {
        evidenceOnly: true,
        sourceContentsIncluded: false,
        sourcePathsIncluded: false,
        nativeBinariesIncluded: false,
        installablePackageIncluded: false,
      },
    });
    expect(archiveText).not.toContain('SkirmishAI.dll');
    expect(archiveText).not.toContain('config/behaviour.json');
    expect(archiveText).not.toContain('return { shortName');
    expect(serializeAiReleaseDossier(audit, smoke)).toBe(serializeAiReleaseDossier(audit, smoke));
  });

  it('redacts imported relative paths embedded in compatibility findings', () => {
    const audit = exampleAudit();
    audit.findings.push({
      id: 'invalid-config:config/behaviour.json',
      severity: 'blocker',
      title: 'Invalid profile data',
      description: 'config/behaviour.json must contain a JSON object at its root.',
      path: 'config/behaviour.json',
    });

    const serialized = JSON.stringify(buildAiReleaseDossier(audit));

    expect(serialized).not.toContain('config/behaviour.json');
    expect(serialized).toContain('[source path]');
  });
});
