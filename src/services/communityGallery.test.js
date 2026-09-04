import { describe, expect, it } from 'vitest';
import {
  isCommunityLobbySchemaError,
  normalizeCommunityTags,
  sanitizeCommunityProjectDocument,
  validateCommunityLobbyArtifact,
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

  it('accepts deterministic editor lobby commands and records their optimization profile', () => {
    const result = validateCommunityLobbyArtifact({
      commands: '!bset tweakdefs1 QUJD\n!bset tweakunits1 REVG',
      optimizationProfile: 'maximum',
    });

    expect(result).toEqual({
      valid: true,
      errors: [],
      value: {
        commands: '!bset tweakdefs1 QUJD\n!bset tweakunits1 REVG',
        optimizationProfile: 'maximum',
        slotCount: 2,
        payloadCharacters: 8,
      },
    });
  });

  it('accepts the current base-through-29 Units-first BAR contract', () => {
    const result = validateCommunityLobbyArtifact({
      commands: '!bset tweakunits QUJD\n!bset tweakunits1 REVG\n!bset tweakdefs R0hJ',
      optimizationProfile: 'balanced',
    });

    expect(result).toMatchObject({
      valid: true,
      value: { slotCount: 3, payloadCharacters: 12 },
    });
  });

  it('rejects arbitrary lobby commands and non-deterministic field ordering', () => {
    expect(validateCommunityLobbyArtifact({
      commands: '!bset tweakunits1 REVG\n!bset tweakdefs1 QUJD\n!bset forceallunits 1',
      optimizationProfile: 'balanced',
    })).toMatchObject({
      valid: false,
      errors: expect.arrayContaining([
        'Definitions fields must appear before Units fields.',
        'Lobby output contains a command outside the supported tweakdefs/tweakunits format.',
      ]),
    });
  });

  it('recognizes an outdated Community lobby-export schema without masking unrelated errors', () => {
    expect(isCommunityLobbySchemaError({
      code: '42703',
      message: 'column community_projects.has_lobby_commands does not exist',
    })).toBe(true);
    expect(isCommunityLobbySchemaError({
      code: 'PGRST202',
      message: 'Could not find the function public.get_community_lobby_commands',
    })).toBe(true);
    expect(isCommunityLobbySchemaError({
      code: '42703',
      message: 'column community_projects.unrelated_column does not exist',
    })).toBe(false);
  });
});
