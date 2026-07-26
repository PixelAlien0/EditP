import { describe, expect, it } from 'vitest';
import defaultsDb from './unit-defaults.json';

describe('bundled BAR carrier defaults', () => {
  it('retains the carrier gadget custom parameters on the mounted WeaponDef', () => {
    const armCarrier = defaultsDb.armdronecarry.weaponSlots.find(slot => slot.defKey === 'plasma');
    expect(armCarrier).toMatchObject({
      carried_unit: 'armdrone',
      spawns_surface: 'SEA',
      spawnrate: 4,
      maxunits: 16,
      startingdronecount: 8,
      docktohealthreshold: 65,
      enabledocking: true,
      droneammo: 9,
    });

    const legionRampart = defaultsDb.legrampart.weaponSlots.find(slot => slot.defKey === 'plasma');
    expect(legionRampart).toMatchObject({
      carried_unit: 'legheavydrone',
      spawns_surface: 'LAND',
      spawnrate: 8,
      maxunits: 3,
      docktohealthreshold: 33,
    });
  });
});
