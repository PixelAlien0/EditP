import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  buildAiProfileOverlay,
  createAiProfileSchema,
  createAiProfileWorkspace,
  resetAiProfileDraft,
  resetAiProfileValue,
  updateAiProfileDraft,
  updateAiProfileValue,
  validateAiProfileSource,
} from './barbarianAiProfiles.js';

function auditFixture() {
  return {
    contract: {
      profileSurfaces: [{
        id: 'economy',
        label: 'Economy',
        description: 'Resource policy.',
        files: ['stable/config/economy.json'],
      }],
    },
    files: [{
      path: 'stable/config/economy.json',
      isText: true,
      text: '{ // keep unknown fields\n "economy": { "energy": 0.7, }, "extension": true }',
    }],
  };
}

describe('BARbarIAn profile composer', () => {
  it('creates safe drafts while preserving unknown profile fields', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    expect(profile).toMatchObject({ surfaceId: 'economy', valid: true, changed: false });
    expect(JSON.parse(profile.draftSource)).toMatchObject({ extension: true });
    expect(profile.groups.map(group => group.key)).toEqual(['economy', 'extension']);
  });

  it('validates object-rooted JSONC and reports invalid drafts', () => {
    expect(validateAiProfileSource('{"factory": {"weight": 2,},}').valid).toBe(true);
    expect(validateAiProfileSource('[1, 2, 3]').error).toContain('JSON object');
    expect(validateAiProfileSource('{ invalid').valid).toBe(false);
  });

  it('tracks semantic changes and resets to the imported profile', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    const changed = updateAiProfileDraft(profile, '{"economy":{"energy":0.9},"extension":true}');
    expect(changed.changed).toBe(true);
    expect(resetAiProfileDraft(changed)).toMatchObject({ changed: false, valid: true });
  });

  it('builds a human-readable schema for visual profile editing', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    const schema = createAiProfileSchema(profile);

    expect(schema.groups).toEqual([
      expect.objectContaining({ id: 'economy', label: 'Economy', editableCount: 1 }),
      expect.objectContaining({ id: 'extension', label: 'Extension', editableCount: 1 }),
    ]);
    expect(schema.fields).toContainEqual(expect.objectContaining({
      label: 'Energy',
      type: 'number',
      editable: true,
      path: ['economy', 'energy'],
    }));
    expect(schema.fields.find(field => field.key === 'energy')?.description).toBeTruthy();
  });

  it('updates and resets one visual field without dropping unknown keys', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    const changed = updateAiProfileValue(profile, ['economy', 'energy'], 0.95);

    expect(changed.changed).toBe(true);
    expect(JSON.parse(changed.draftSource)).toMatchObject({
      economy: { energy: 0.95 },
      extension: true,
    });

    const reset = resetAiProfileValue(changed, ['economy', 'energy']);
    expect(reset.changed).toBe(false);
    expect(JSON.parse(reset.draftSource)).toMatchObject({
      economy: { energy: 0.7 },
      extension: true,
    });
  });

  it('exports only changed profiles in a config-only overlay', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    const changed = updateAiProfileDraft(profile, '{"economy":{"energy":0.9},"extension":true}');
    const overlay = buildAiProfileOverlay([changed], { packageName: 'Fast pressure' });
    const archive = unzipSync(overlay.bytes);
    const config = JSON.parse(strFromU8(archive['stable/config/economy.json']));
    const manifest = JSON.parse(strFromU8(archive['editp-ai-profile-manifest.json']));

    expect(config).toMatchObject({ economy: { energy: 0.9 }, extension: true });
    expect(manifest).toMatchObject({
      kind: 'editp-barbarian-profile-overlay',
      packageName: 'Fast pressure',
      safety: { configOnly: true, scriptsIncluded: false, nativeRuntimeIncluded: false },
    });
  });

  it('builds byte-identical overlays for identical profile inputs', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    const changed = updateAiProfileDraft(profile, '{"economy":{"energy":0.9},"extension":true}');

    const first = buildAiProfileOverlay([changed], { packageName: 'Deterministic overlay' });
    const second = buildAiProfileOverlay([changed], { packageName: 'Deterministic overlay' });

    expect([...first.bytes]).toEqual([...second.bytes]);
  });

  it('blocks empty and invalid overlay exports', () => {
    const [profile] = createAiProfileWorkspace(auditFixture());
    expect(() => buildAiProfileOverlay([profile])).toThrow('Change at least one');
    const invalid = updateAiProfileDraft(profile, '{ invalid');
    expect(() => buildAiProfileOverlay([invalid])).toThrow('Fix 1 invalid profile');
  });
});
