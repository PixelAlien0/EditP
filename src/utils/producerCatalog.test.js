import { describe, expect, it } from 'vitest';
import {
  addCloneProducerRosters,
  addConstructionTurretProducerRosters,
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

  it('admits vanilla construction turrets as empty editable builder rosters', () => {
    const defaults = {
      armnanotc: {
        workertime: 200,
        builddistance: 400,
        'customparams.unitgroup': 'builder',
      },
      armnanotct2: {
        workertime: 600,
        builddistance: 500,
        'customparams.unitgroup': 'builder',
        'customparams.techlevel': 2,
      },
      armrad: {
        workertime: 200,
        builddistance: 400,
        'customparams.unitgroup': 'utility',
      },
    };
    const rosters = addConstructionTurretProducerRosters(
      { armlab: ['armck'] },
      {
        armnanotc: 'Construction Turret',
        armnanotct2: 'Advanced Construction Turret',
        armrad: 'Radar Tower',
      },
      defaults
    );
    const catalog = createProducerCatalog(
      rosters,
      {
        armlab: 'Bot Lab',
        armnanotc: 'Construction Turret',
        armnanotct2: 'Advanced Construction Turret',
      },
      defaults
    );

    expect(rosters.armnanotc).toEqual([]);
    expect(rosters.armnanotct2).toEqual([]);
    expect(rosters.armrad).toBeUndefined();
    expect(catalog).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'armnanotc',
        kind: PRODUCER_KIND.BUILDER,
        kindLabel: 'Builder',
        producerSubtype: 'construction-turret',
        rosterSize: 0,
      }),
      expect.objectContaining({
        id: 'armnanotct2',
        kind: PRODUCER_KIND.BUILDER,
        tier: 'T2',
      }),
    ]));
  });

  it('makes construction-turret clones and nested clones editable producers', () => {
    const seeded = addConstructionTurretProducerRosters(
      {},
      { armnanotct2: 'Advanced Construction Turret' },
      {
        armnanotct2: {
          workertime: 600,
          builddistance: 500,
          'customparams.unitgroup': 'builder',
        },
      }
    );
    const rosters = addCloneProducerRosters(seeded, [
      { baseId: 'armnanotct2', newId: 'epic_construction_turret' },
      { baseId: 'epic_construction_turret', newId: 'epic_construction_turret_mk2' },
    ]);

    expect(rosters.epic_construction_turret).toEqual([]);
    expect(rosters.epic_construction_turret_mk2).toEqual([]);

    const [producer] = createProducerCatalog(
      { epic_construction_turret: [] },
      { armnanotct2: 'Advanced Construction Turret' },
      {
        armnanotct2: {
          workertime: 600,
          builddistance: 500,
          'customparams.unitgroup': 'builder',
        },
      },
      [{
        id: 'epic_construction_turret',
        name: 'Nanoforge Omega',
        isClone: true,
        rootBaseId: 'armnanotct2',
      }]
    );
    expect(producer).toMatchObject({
      id: 'epic_construction_turret',
      name: 'Nanoforge Omega',
      kind: PRODUCER_KIND.BUILDER,
      producerSubtype: 'construction-turret',
    });
  });
});
