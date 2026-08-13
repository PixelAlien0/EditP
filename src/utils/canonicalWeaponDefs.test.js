import { describe, expect, it } from 'vitest';
import unitDefaults from '../data/unit-defaults.json';
import {
  getCanonicalWeaponDef,
  getCanonicalWeaponDefKeys,
  getKnownWeaponDefKeys,
} from './canonicalWeaponDefs.js';

describe('canonical nested WeaponDef snapshot', () => {
  it('preserves unmounted split-projectile definitions owned by BAR UnitDefs', () => {
    expect(getCanonicalWeaponDef(unitDefaults.armmship, 'rocket_split')).toMatchObject({
      damage: 350,
      burst: 6,
    });
    expect(getCanonicalWeaponDef(unitDefaults.cormship, 'rocket_split')).toMatchObject({
      damage: 350,
      burst: 8,
    });
    expect(unitDefaults.armmship.weaponSlots.some(slot => slot.defKey === 'rocket_split')).toBe(false);
  });

  it('indexes both local keys and engine-qualified WeaponDef names', () => {
    const known = getKnownWeaponDefKeys(unitDefaults);
    expect(known.has('rocket_split')).toBe(true);
    expect(known.has('armmship_rocket_split')).toBe(true);
    expect(known.has('cormship_rocket_split')).toBe(true);
  });

  it('keeps mounted-slot fixtures backward compatible', () => {
    expect(getCanonicalWeaponDefKeys({
      weaponSlots: [{ slot: 1, defKey: 'legacy_laser', damage: 20 }],
    })).toEqual(['legacy_laser']);
  });
});
