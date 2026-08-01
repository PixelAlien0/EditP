import { describe, expect, it } from 'vitest';
import {
  addCloneProducerRosters,
  createProducerCatalog,
  PRODUCER_KIND,
} from './producerCatalog.js';

describe('producer catalog', () => {
  it('separates static factories from mobile builders', () => {
    const catalog = createProducerCatalog(
      { armlab: ['armck'], armck: ['armlab'] },
      { armlab: 'Bot Lab', armck: 'Construction Bot' },
      {
        armlab: { 'customparams.techlevel': 1 },
        armck: { maxvelocity: 36, 'customparams.techlevel': 1 },
      }
    );

    expect(catalog).toEqual([
      expect.objectContaining({ id: 'armlab', kind: PRODUCER_KIND.FACTORY, kindLabel: 'Factory' }),
      expect.objectContaining({ id: 'armck', kind: PRODUCER_KIND.BUILDER, kindLabel: 'Builder' }),
    ]);
  });

  it('omits unnamed BAR helper definitions instead of exposing raw IDs', () => {
    const catalog = createProducerCatalog(
      { armlab: [], armsalab: [], armcomcon: [], armsaap: [] },
      { armlab: 'Bot Lab', armsaap: 'armsaap' },
      {}
    );

    expect(catalog.map(entry => entry.id)).toEqual(['armlab']);
  });

  it('keeps decimal tech levels and roster size as useful catalog metadata', () => {
    const [producer] = createProducerCatalog(
      { armplat: ['armseap', 'armsfig'] },
      { armplat: 'Seaplane Platform' },
      { armplat: { 'customparams.techlevel': 1.5 } }
    );

    expect(producer).toMatchObject({ tier: 'T1.5', rosterSize: 2 });
  });

  it('adds cloned factories and nested factory clones with inherited rosters', () => {
    const rosters = addCloneProducerRosters(
      { armavp: ['armbull', 'armmart'] },
      [
        { baseId: 'armavp', newId: 'tactical_assault_facility' },
        { baseId: 'tactical_assault_facility', newId: 'forward_assault_facility' },
        { baseId: 'armflash', newId: 'not_a_producer' },
      ]
    );

    expect(rosters.tactical_assault_facility).toEqual(['armbull', 'armmart']);
    expect(rosters.forward_assault_facility).toEqual(['armbull', 'armmart']);
    expect(rosters.not_a_producer).toBeUndefined();
  });

  it('uses clone identity and source metadata in the producer catalog', () => {
    const [producer] = createProducerCatalog(
      { tactical_assault_facility: ['armbull', 'armmart'] },
      {},
      { armavp: { 'customparams.techlevel': 2 } },
      [{
        id: 'tactical_assault_facility',
        name: 'Tactical Assault Facility',
        isClone: true,
        rootBaseId: 'armavp',
        faction: 'arm',
        techTier: 'T3',
      }]
    );

    expect(producer).toMatchObject({
      id: 'tactical_assault_facility',
      name: 'Tactical Assault Facility',
      kind: PRODUCER_KIND.FACTORY,
      faction: 'arm',
      tier: 'T3',
      rosterSize: 2,
      isClone: true,
      sourceId: 'armavp',
    });
  });
});
