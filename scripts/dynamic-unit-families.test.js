import { describe, expect, it } from 'vitest';
import {
  SCAVENGER_BOSS_DIFFICULTIES,
  reconcileDynamicUnitFamilies,
} from './dynamic-unit-families.mjs';

function makeTemplate() {
  return {
    health: 2000000,
    buildtime: 2000000,
    autoheal: 25,
    weaponSlots: [
      { slot: 1, defKey: 'machinegun', damage: 500 },
      { slot: 3, defKey: 'disintegratorxl', reload: 1 },
      { slot: 4, defKey: 'corkorg_laser', damage: 10000 },
    ],
    weapon1Damage: 500,
  };
}

describe('dynamic BAR UnitDef families', () => {
  it('replaces the nonexistent boss base ID with all official difficulty IDs', () => {
    const defaults = {
      armscavengerbossv2: makeTemplate(),
      armscavengerbossv2_epic: makeTemplate(),
    };
    const categories = { armscavengerbossv2: ['bots', 't4'] };
    const names = { armscavengerbossv2: 'Epic Commander - Final Boss' };
    const descriptions = { armscavengerbossv2: 'Incorrect base record' };
    const artwork = {
      units: { scav_legcom: '/unitpics/assets/scav-boss.webp', armscavengerbossv2: '/broken.webp' },
      pictures: {},
    };

    const result = reconcileDynamicUnitFamilies({ defaults, categories, names, descriptions, artwork });

    expect(result).toEqual({ repaired: 6, removed: 1 });
    expect(defaults).not.toHaveProperty('armscavengerbossv2');
    expect(names).not.toHaveProperty('armscavengerbossv2');
    expect(Object.keys(SCAVENGER_BOSS_DIFFICULTIES).every(key => (
      Boolean(defaults[`armscavengerbossv2_${key}`])
    ))).toBe(true);
    expect(defaults.armscavengerbossv2_normal).toMatchObject({
      health: 800000,
      buildtime: 800000,
      autoheal: 10,
      weapon1Damage: 200,
    });
    expect(defaults.armscavengerbossv2_normal.weaponSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ defKey: 'machinegun', damage: 200, damage_vs_vtol: 600 }),
      expect.objectContaining({ defKey: 'disintegratorxl', reload: 4, stockpile: true, stockpiletime: 40 }),
      expect.objectContaining({ defKey: 'corkorg_laser', damage: 5500 }),
    ]));
    expect(categories.armscavengerbossv2_normal).toEqual(['bots', 't4', 'scavenger']);
    expect(artwork.units.armscavengerbossv2_normal).toBe('/unitpics/assets/scav-boss.webp');
  });
});
