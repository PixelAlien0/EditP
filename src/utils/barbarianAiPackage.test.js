import { describe, expect, it } from 'vitest';
import {
  auditBarbarianAiPackage,
  discoverBarbarianContract,
  parseJsonc,
  stableContentHash,
} from './barbarianAiPackage.js';

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

describe('BARbarIAn AI package contracts', () => {
  it('parses JSONC comments and trailing commas without evaluating code', () => {
    expect(parseJsonc(`{
      // profile note
      "units": ["armcom",],
      /* policy */ "weight": 2,
    }`)).toEqual({ units: ['armcom'], weight: 2 });
  });

  it('discovers the canonical BARbarIAn identity, options, profiles, and runtime', () => {
    const records = [
      record('AIInfo.lua', `return { shortName = "BARb", name = "BARbarIAn", version = "stable", description = "Native Skirmish AI" }`, 'ai-info'),
      record('AIOptions.lua', `return { { key = "profile" }, { key = "cheating" } }`, 'ai-options'),
      record('config/behaviour.json', '{"roles": {}}', 'config'),
      record('config/build_chain.json', '{"builders": ["armcom"]}', 'config'),
      record('script/manager.as', 'void update() {}', 'script'),
      record('SkirmishAI.dll', null, 'native'),
    ];

    const contract = discoverBarbarianContract(records);
    expect(contract).toMatchObject({
      id: 'barbarian-ai-package',
      version: 1,
      identity: { shortName: 'BARb', name: 'BARbarIAn', version: 'stable' },
      optionKeys: ['cheating', 'profile'],
    });
    expect(contract.profileSurfaces.map(surface => surface.id)).toEqual(['behaviour', 'build_chain']);
    expect(contract.runtimeFingerprints).toHaveLength(1);
  });

  it('discovers identity from BAR installed AIInfo key-value records in a versioned package folder', () => {
    const records = [
      record('BARb/stable/AIInfo.lua', `
        local infos = {
          { key = 'shortName', value = 'BARb', desc = 'machine conform name.' },
          { key = 'version', value = 'stable' },
          { key = 'name', value = 'BARbarIAn' },
          { key = 'description', value = 'This AI is using the new C++ wrapper.' },
        }
        return infos
      `, 'ai-info'),
      record('BARb/stable/AIOptions.lua', `return { { key = 'profile' } }`, 'ai-options'),
      record('BARb/stable/config/behaviour.json', '{}', 'config'),
      record('BARb/stable/SkirmishAI.dll', null, 'native'),
    ];

    const contract = discoverBarbarianContract(records);
    expect(contract.identity).toEqual({
      shortName: 'BARb',
      name: 'BARbarIAn',
      version: 'stable',
      description: 'This AI is using the new C++ wrapper.',
    });

    const audit = auditBarbarianAiPackage(records);
    expect(audit.findings.map(item => item.id)).not.toContain('missing-ai-info');
    expect(audit.contract.runtimeFingerprints).toEqual([
      expect.objectContaining({ path: 'BARb/stable/SkirmishAI.dll' }),
    ]);
  });

  it('blocks malformed packages and reports stale BAR unit references', () => {
    const records = [
      record('config/factory.json', '{"units": ["armcom", "arm_unit_that_moved"],}', 'config'),
      record('config/economy.json', '{ invalid', 'config'),
    ];
    const audit = auditBarbarianAiPackage(records, { knownUnitIds: ['armcom'] });

    expect(audit.compatibility).toBe('incompatible');
    expect(audit.findings.map(item => item.id)).toContain('missing-ai-info');
    expect(audit.findings.some(item => item.id.startsWith('invalid-config:'))).toBe(true);
    expect(audit.references.unresolved).toContain('arm_unit_that_moved');
  });

  it('fingerprints native runtimes while keeping them inspection-only', () => {
    const audit = auditBarbarianAiPackage([
      record('AIInfo.lua', 'return { name = "Example AI" }', 'ai-info'),
      record('SkirmishAI.dll', null, 'native'),
    ]);

    expect(audit.contract.runtimeFingerprints[0]).toMatchObject({ path: 'SkirmishAI.dll' });
    expect(audit.findings).toContainEqual(expect.objectContaining({ id: 'native-runtime', severity: 'note' }));
  });
});
