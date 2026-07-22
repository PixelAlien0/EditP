import { describe, expect, it } from 'vitest';
import unitDefaults from './unit-defaults.json';
import units from './units.json';

describe('special-unit defaults', () => {
  it('never exposes a bundled definition with placeholder core stats', () => {
    for (const [unitId, defaults] of Object.entries(unitDefaults)) {
      expect(defaults, `${unitId} has incomplete core defaults`).toEqual(expect.objectContaining({
        metalcost: expect.any(Number),
        energycost: expect.any(Number),
        buildtime: expect.any(Number),
        health: expect.any(Number),
      }));
    }
  });

  it('preserves legacy-key stats and the complete Apollyon loadout', () => {
    expect(units.names.legapollyon).toBe('Apollyon');
    expect(unitDefaults.legapollyon).toMatchObject({
      metalcost: 9000,
      energycost: 240000,
      buildtime: 320000,
      health: 56000,
      maxvelocity: 48,
      acceleration: 0.02,
      brakerate: 0.04,
    });
    expect(unitDefaults.legapollyon.weaponSlots).toHaveLength(10);
  });

  it('includes the prefixed Adjudicator source and its weapons', () => {
    expect(units.names.coresuppt3).toBe('Adjudicator');
    expect(unitDefaults.coresuppt3).toMatchObject({
      metalcost: 30000,
      energycost: 600000,
      buildtime: 400000,
      health: 89000,
      maxvelocity: 75,
    });
    expect(unitDefaults.coresuppt3.weaponSlots).toHaveLength(2);
  });

  it('keeps ordinary literal definitions such as Abductor intact', () => {
    expect(units.names.armdfly).toBe('Abductor');
    expect(unitDefaults.armdfly).toMatchObject({
      metalcost: 320,
      energycost: 10000,
      buildtime: 19000,
      health: 1170,
      maxvelocity: 210,
    });
    expect(unitDefaults.armdfly.weaponSlots).toHaveLength(1);
  });
});
