import { describe, expect, it } from 'vitest';
import { generateStartscriptGameOptions } from './lobbyModOptions.js';

describe('lobby mod options', () => {
  it('emits the engine forceallunits option before generated tweak payloads', () => {
    expect(generateStartscriptGameOptions({
      forceAllUnits: true,
      tweakDefsBase64: 'ZGVmcw==',
      tweakUnitsBase64: 'dW5pdHM=',
    })).toBe([
      '[GAME]',
      '{',
      '  [MODOPTIONS]',
      '  {',
      '    forceallunits = 1;',
      '    tweakdefs = ZGVmcw==;',
      '    tweakunits = dW5pdHM=;',
      '  }',
      '}',
    ].join('\n'));
  });

  it('keeps the option explicit when disabled and omits empty payloads', () => {
    expect(generateStartscriptGameOptions()).toContain('forceallunits = 0;');
    expect(generateStartscriptGameOptions()).not.toContain('tweakdefs =');
  });
});
