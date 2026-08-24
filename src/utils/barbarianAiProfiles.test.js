import { describe, expect, it } from 'vitest';
import { strFromU8, unzipSync } from 'fflate';
import {
  applyAiProfileStrategy,
  buildAiProfileOverlay,
  createAiProfileSchema,
  createAiProfileWorkspace,
  previewAiProfileStrategy,
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

function fullMetalAuditFixture() {
  return {
    contract: {
      profileSurfaces: [
        { id: 'behaviour', label: 'Behaviour', description: 'Combat policy.', files: ['stable/config/behaviour.json'] },
        { id: 'economy', label: 'Economy', description: 'Resource policy.', files: ['stable/config/economy.json'] },
      ],
    },
    files: [
      {
        path: 'stable/config/behaviour.json',
        isText: true,
        text: JSON.stringify({ quota: { attack: 60, raid: [9, 420], num_batch: 5 }, extension: true }),
      },
      {
        path: 'stable/config/economy.json',
        isText: true,
        text: JSON.stringify({ economy: { energy: { link_inc: 16 }, cluster_range: 800, mex_up: 3, goal_exec: 42, buildpower: 1.2 } }),
      },
    ],
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

  it('previews and applies the Full Metal strategy using recognized package keys only', () => {
    const profiles = createAiProfileWorkspace(fullMetalAuditFixture());
    const preview = previewAiProfileStrategy(profiles, 'full-metal-pressure');

    expect(preview).toMatchObject({ ruleCount: 8, supportedCount: 8, changeCount: 8, unavailableCount: 0 });
    expect(preview.changes).toContainEqual(expect.objectContaining({
      path: ['quota', 'attack'],
      before: 60,
      after: 44,
    }));

    const result = applyAiProfileStrategy(profiles, 'full-metal-pressure');
    const behaviour = result.profiles.find(profile => profile.surfaceId === 'behaviour');
    const economy = result.profiles.find(profile => profile.surfaceId === 'economy');
    expect(JSON.parse(behaviour.draftSource)).toMatchObject({
      quota: { attack: 44, raid: [7, 320], num_batch: 7 },
      extension: true,
    });
    expect(JSON.parse(economy.draftSource)).toMatchObject({
      economy: { energy: { link_inc: 10 }, cluster_range: 650, mex_up: 5, goal_exec: 32, buildpower: 1.5 },
    });
  });

  it('reports unavailable Full Metal controls instead of fabricating missing settings', () => {
    const profiles = createAiProfileWorkspace(auditFixture());
    const preview = previewAiProfileStrategy(profiles, 'full-metal-pressure');

    expect(preview.supportedCount).toBe(0);
    expect(preview.unavailableCount).toBe(8);
    expect(preview.changes).toEqual([]);
  });
});
