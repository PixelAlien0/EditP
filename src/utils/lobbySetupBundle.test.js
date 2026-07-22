import { describe, expect, it } from 'vitest';
import { encodeLobbyBase64 } from './tweakSerializer.js';
import {
  filterLobbySetupCategories,
  LOBBY_SETUP_CATEGORIES,
  parseLobbySetupBundle,
} from './lobbySetupBundle.js';

describe('full lobby setup bundles', () => {
  it('classifies commands and resolves settings and tweak fields with last-command-wins semantics', () => {
    const oldDefs = encodeLobbyBase64('-- Old defs\nlocal old = true', { padding: false });
    const currentDefs = encodeLobbyBase64('-- Current defs\nlocal current = true', { padding: false });
    const result = parseLobbySetupBundle(`
      !preset coop
      !unit_restrictions_nonukes 0
      !bSet unit_restrictions_nonukes 1
      !map Full Metal Plate
      !addbox 82 82 117 117 2
      $rename PvE Reference Lobby
      $welcome-message Imported with BAR Editor
      !forceallunits 1
      !bset tweakdefs1 0
      !bset tweakdefs1 ${oldDefs}
      !bset tweakdefs1 ${currentDefs}
      !bset tweakunits4 0
      informational heading
    `, { sourceName: 'reference.txt', importedAt: '2026-07-22T00:00:00.000Z' });

    expect(result.isBundle).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.modules).toHaveLength(1);
    expect(result.modules[0]).toMatchObject({
      originalFieldName: 'tweakdefs1',
      rawLua: '-- Current defs\nlocal current = true',
      requirements: ['forceallunits'],
    });
    expect(result.lobbySetup.slotClears).toEqual(['tweakunits4']);
    expect(result.lobbySetup.slotResetFields).toEqual(['tweakdefs1', 'tweakunits4']);
    expect(result.lobbySetup.commands).toContainEqual(expect.objectContaining({
      name: 'bset', key: 'unit_restrictions_nonukes', value: '1', category: LOBBY_SETUP_CATEGORIES.GAME,
    }));
    expect(result.lobbySetup.commands).not.toContainEqual(expect.objectContaining({
      name: 'unit_restrictions_nonukes', value: '0',
    }));
    expect(result.summary).toMatchObject({
      moduleCount: 1,
      slotClearCount: 1,
      ignoredLineCount: 1,
    });
    expect(result.summary.overwrittenCount).toBe(3);
    expect(result.summary.categoryCounts[LOBBY_SETUP_CATEGORIES.MAP]).toBe(2);
    expect(result.summary.categoryCounts[LOBBY_SETUP_CATEGORIES.IDENTITY]).toBe(2);
  });

  it('keeps ordered map actions instead of collapsing them', () => {
    const result = parseLobbySetupBundle(`
      !map Map One
      !map Map Two
      !clearbox 1
      !addbox 0 0 50 50 1
      !addbox 50 50 100 100 2
    `, { importedAt: '2026-07-22T00:00:00.000Z' });
    expect(result.lobbySetup.commands.map(command => command.raw)).toEqual([
      '!map Map Two',
      '!clearbox 1',
      '!addbox 0 0 50 50 1',
      '!addbox 50 50 100 100 2',
    ]);
    expect(result.summary.overwrittenCount).toBe(1);
  });

  it('does not intercept a normal single tweak command', () => {
    const payload = encodeLobbyBase64('-- module\nreturn {}', { padding: false });
    const result = parseLobbySetupBundle(`!bset tweakdefs1 ${payload}`);
    expect(result.isBundle).toBe(false);
  });

  it('filters stored commands by selected categories without changing module metadata', () => {
    const result = parseLobbySetupBundle('!preset coop\n!map Comet Catcher Redux\n$rename Test Lobby', {
      importedAt: '2026-07-22T00:00:00.000Z',
    });
    const filtered = filterLobbySetupCategories(result.lobbySetup, [LOBBY_SETUP_CATEGORIES.MAP]);
    expect(filtered.commands).toHaveLength(1);
    expect(filtered.commands[0].name).toBe('map');
    expect(filtered.importedAt).toBe(result.lobbySetup.importedAt);
  });
});
