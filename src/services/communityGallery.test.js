import { describe, expect, it } from 'vitest';
import {
  normalizeCommunityTags,
  sanitizeCommunityProjectDocument,
  validateCommunityPublication,
} from './communityGallery.js';

describe('community gallery publication safety', () => {
  it('removes imported Lua and lobby commands from public project copies', () => {
    const document = sanitizeCommunityProjectDocument({
      version: '1.9',
      tweakModules: [{ rawLua: 'UnitDefs.armcom.health = 1' }],
      lobbySetup: { commands: ['!bset tweakunits1 unsafe'] },
      tweaks: { armcom: { health: 5000 } },
      unexpectedPayload: { rawLua: 'hidden' },
    });

    expect(document.tweakModules).toEqual([]);
    expect(document.lobbySetup.commands).toEqual([]);
    expect(document.tweaks.armcom.health).toBe(5000);
    expect(document).not.toHaveProperty('unexpectedPayload');
  });

  it('rejects external links and accepts structured local projects', () => {
    expect(validateCommunityPublication({
      title: 'Safe balance pass',
      summary: 'A structured balance project for local game testing.',
      authorName: 'Workshop Pilot',
      tags: ['balance', 'ARMADA', 'balance'],
      document: { version: '1.9', tweaks: {} },
    })).toMatchObject({ valid: true, values: { tags: ['balance', 'armada'] } });

    expect(validateCommunityPublication({
      title: 'Unsafe link project',
      summary: 'Download more content from https://example.com before using this.',
      authorName: 'Workshop Pilot',
      tags: [],
      document: { version: '1.9' },
    }).valid).toBe(false);
  });

  it('normalizes and limits searchable tags', () => {
    expect(normalizeCommunityTags('Balance, ARMADA, balance, invalid!, air power')).toEqual(['balance', 'armada', 'air power']);
  });
});
