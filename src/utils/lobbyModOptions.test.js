import { describe, expect, it } from 'vitest';
import { generateLobbyModOptions } from './lobbyModOptions.js';

describe('lobby mod options', () => {
  it('emits the engine forceallunits option before generated tweak payloads', () => {
    expect(generateLobbyModOptions({
      forceAllUnits: true,
      tweakDefsBase64: 'ZGVmcw==',
      tweakUnitsBase64: 'dW5pdHM=',
    })).toBe([
      '[MODOPTIONS]',
      '{',
      '  forceallunits = true;',
      '  tweakdefs = ZGVmcw==;',
      '  tweakunits = dW5pdHM=;',
      '}',
    ].join('\n'));
  });

  it('keeps the option explicit when disabled and omits empty payloads', () => {
    expect(generateLobbyModOptions()).toContain('forceallunits = false;');
    expect(generateLobbyModOptions()).not.toContain('tweakdefs =');
  });
});
