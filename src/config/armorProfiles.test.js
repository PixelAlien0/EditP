import { describe, expect, it } from 'vitest';
import {
  createArmorDamageParameter,
  getArmorDamageParameterKey,
  getArmorProfileFromDamageKey,
  normalizeArmorProfile,
} from './armorProfiles.js';
import { getWeaponParameterDefinition } from './weaponParameters.js';

describe('custom armor profiles', () => {
  it('normalizes package armor identifiers into safe Lua paths', () => {
    expect(normalizeArmorProfile(' Space-Heavy ')).toBe('space_heavy');
    expect(getArmorDamageParameterKey('Space Heavy')).toBe('damage_profile__space_heavy');
    expect(getArmorProfileFromDamageKey('damage_profile__space_heavy')).toBe('space_heavy');
  });

  it('creates a compiler definition for dynamic armor damage', () => {
    expect(createArmorDamageParameter('space')).toMatchObject({
      key: 'damage_profile__space',
      path: 'damage.space',
      compileTarget: 'weapondef',
      valueType: 'number',
    });
    expect(getWeaponParameterDefinition('damage_profile__space')).toMatchObject({ path: 'damage.space' });
  });
});
