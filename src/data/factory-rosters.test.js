import { describe, expect, it } from 'vitest';
import factoryRosters from './factory-rosters.json';
import unitCategories from './unit-categories.json';
import unitDefaults from './unit-defaults.json';
import units from './units.json';
import { createProducerCatalog } from '../utils/producerCatalog.js';

const LEGION_FACTORY_ROSTERS = {
  legaap: [
    'legaca', 'legstronghold', 'legmineb', 'legatorpbomber', 'legafigdef',
    'legwhisper', 'legfort', 'legphoenix', 'legvenator',
  ],
  legvp: [
    'legscout', 'legcv', 'legotter', 'leghades', 'leghelios', 'leggat',
    'legbar', 'legrail', 'legmlv', 'legamphtank',
  ],
  legavp: [
    'legacv', 'legmrv', 'legaskirmtank', 'legfloat', 'legaheattank', 'legmed',
    'legamcluster', 'legvcarry', 'legavroc', 'leginf', 'legvflak',
    'legavantinuke', 'legavjam', 'legavrad', 'legafcv',
  ],
};

describe('Legion factory roster data', () => {
  it('matches the BAR build options for all standard air and vehicle plants', () => {
    for (const [factoryId, roster] of Object.entries(LEGION_FACTORY_ROSTERS)) {
      expect(factoryRosters[factoryId]).toEqual(roster);
      expect(unitDefaults[factoryId]).toBeDefined();
      expect(unitCategories[factoryId]).toContain('factories');
    }
  });

  it('exposes all three factories in the producer catalog with the correct tiers', () => {
    const catalog = createProducerCatalog(factoryRosters, units.names, unitDefaults);
    const entries = Object.fromEntries(
      catalog.filter(entry => Object.hasOwn(LEGION_FACTORY_ROSTERS, entry.id)).map(entry => [entry.id, entry])
    );

    expect(entries.legaap).toMatchObject({ name: 'Legion Advanced Aircraft Plant', tier: 'T2', rosterSize: 9 });
    expect(entries.legvp).toMatchObject({ name: 'Legion Vehicle Plant', tier: 'T1', rosterSize: 10 });
    expect(entries.legavp).toMatchObject({ name: 'Advanced Vehicle Plant', tier: 'T2', rosterSize: 15 });
  });
});
