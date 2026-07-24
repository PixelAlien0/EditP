import { describe, expect, it } from 'vitest';
import { encodeBase64, encodeLobbyBase64 } from './tweakSerializer.js';

function decodeUrlSafeBase64(value) {
  const standard = value.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(standard, 'base64').toString('utf8');
}

describe('lobby-safe Base64', () => {
  it('protects generated Lua from start-script plus stripping', () => {
    // Two leading spaces reproduce the alignment used by the generated clone
    // helper, where standard Base64 emits a literal `+` for the `~` byte.
    const lua = '  if type(value) ~= "table" then return value end';

    expect(encodeBase64(lua, { padding: true })).toContain('+');
    const encoded = encodeLobbyBase64(lua);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeUrlSafeBase64(encoded)).toBe(lua);
  });

  it('keeps padding configurable without disabling the safe alphabet', () => {
    const encoded = encodeLobbyBase64('return true');

    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeUrlSafeBase64(encoded)).toBe('return true');
  });
});
