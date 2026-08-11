import { describe, expect, it } from 'vitest';
import {
  evaluateGadgetContracts,
  gadgetContractResultsToIssues,
} from './gadgetContractValidation.js';
import unitDefaults from '../data/unit-defaults.json';

const context = {
  unitId: 'armtest',
  unitName: 'Test Unit',
  knownUnitIds: new Set(['armtest', 'armflea', 'armfav']),
  knownWeaponDefs: new Set(['cluster_child']),
  supportingWeaponDefs: new Set(),
};

function evaluate({ slot = {}, unit = {}, patch = {} } = {}) {
  return evaluateGadgetContracts({
    ...context,
    defaults: {
      ...unit,
      weaponSlots: Object.keys(slot).length ? [{ slot: 1, defKey: 'test_weapon', ...slot }] : [],
    },
    patch,
  });
}

describe('BAR gadget contract validation', () => {
  it('detects an incomplete multiple-unit explosion spawner', () => {
    const [result] = evaluate({ slot: { spawns_name: 'armflea armfav' } });
    expect(result.contractId).toBe('explosion-spawner');
    expect(result.status).toBe('incomplete');
    expect(result.problems).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'spawns_mode', level: 'warning' }),
    ]));
  });

  it('recognizes a complete carrier contract as experimental', () => {
    const results = evaluate({
      slot: {
        carried_unit: 'armflea armfav',
        spawnrate: 5,
        maxunits: '4 4',
        controlradius: 900,
      },
    });
    const carrier = results.find(result => result.contractId === 'carrier-spawner');
    expect(carrier.status).toBe('experimental');
    expect(carrier.problems).toHaveLength(0);
  });

  it('blocks a cluster definition with no count before BAR can compare nil', () => {
    const results = evaluate({ slot: { cluster_def: 'cluster_child' } });
    const cluster = results.find(result => result.contractId === 'cluster-projectile');
    expect(cluster.status).toBe('incomplete');
    expect(cluster.problems).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'cluster_number', level: 'error' }),
    ]));
  });

  it('detects sector fire only when the BAR behavior mode activates it', () => {
    const valid = evaluate({
      slot: { speceffect: 'sector_fire', spread_angle: 20, max_range_reduction: 0.5 },
    }).find(result => result.contractId === 'sector-fire');
    expect(valid.status).toBe('ready');

    const ordinary = evaluate({
      slot: { speceffect: 'cruise', spread_angle: 20, max_range_reduction: 0.5 },
    }).find(result => result.contractId === 'sector-fire');
    expect(ordinary).toBeUndefined();
  });

  it('does not activate contracts from empty or disabled copied fields', () => {
    const results = evaluate({
      patch: {
        weapon_slot_1_spawns_name: '',
        weapon_slot_1_carried_unit: false,
        weapon_slot_1_interceptor: 0,
      },
    });
    expect(results).toHaveLength(0);
  });

  it('does not infer a spawner contract from optional tuning fields alone', () => {
    const results = evaluate({
      slot: {
        spawns_surface: 'LAND',
        spawnrate: 5,
        maxunits: 4,
        controlradius: 900,
      },
    });
    expect(results.some(result => result.contractId === 'explosion-spawner')).toBe(false);
    expect(results.some(result => result.contractId === 'carrier-spawner')).toBe(false);
  });

  it('reports explicitly edited companion fields that have no active contract key', () => {
    const results = evaluate({
      patch: {
        weapon_slot_1_spawns_surface: 'LAND',
        weapon_slot_1_controlradius: 900,
        weapon_slot_1_cruise_min_height: 80,
      },
    });
    expect(results).toEqual(expect.arrayContaining([
      expect.objectContaining({ contractId: 'explosion-spawner', status: 'incomplete' }),
      expect.objectContaining({ contractId: 'carrier-spawner', status: 'incomplete' }),
      expect.objectContaining({ contractId: 'special-projectile-behavior', status: 'incomplete' }),
    ]));
    expect(results.flatMap(result => result.problems)).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'warning', suggestedFix: expect.any(String) }),
    ]));
  });

  it('reports Scavenger companion fields without enabling squad registration', () => {
    const result = evaluate({
      patch: {
        'customparams.scavsquadunitsamount': 4,
        'customparams.scavsquadrarity': 'basic',
      },
    }).find(entry => entry.contractId === 'scavenger-squad');
    expect(result.status).toBe('incomplete');
    expect(result.problems).toContainEqual(expect.objectContaining({
      key: 'customparams.scavcustomsquad',
      level: 'warning',
      companionKeys: expect.arrayContaining([
        'customparams.scavsquadunitsamount',
        'customparams.scavsquadrarity',
      ]),
    }));
  });

  it('keeps a combined carrier and explosion slot exportable with an advisory', () => {
    const results = evaluate({
      slot: {
        spawns_name: 'armflea',
        carried_unit: 'armfav',
        spawnrate: 5,
        maxunits: 4,
        controlradius: 900,
      },
    });
    const carrier = results.find(result => result.contractId === 'carrier-spawner');
    expect(carrier.status).toBe('experimental');
    expect(carrier.problems).toContainEqual(expect.objectContaining({
      kind: 'advisory',
      level: 'warning',
    }));
    expect(gadgetContractResultsToIssues(results).some(issue => issue.level === 'error')).toBe(false);
  });

  it('requires positive coverage for an interceptor weapon', () => {
    const result = evaluate({ slot: { interceptor: 1, coverage: 0 } })
      .find(entry => entry.contractId === 'projectile-interception');
    expect(result.status).toBe('incomplete');
    expect(result.problems).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'coverage', level: 'error' }),
    ]));
  });

  it('validates mode-specific projectile companions and supporting WeaponDefs', () => {
    const cruise = evaluate({
      patch: {
        weapon_slot_1_speceffect: 'cruise',
        weapon_slot_1_cruise_min_height: 240,
        weapon_slot_1_cruise_max_height: 80,
        weapon_slot_1_lockon_dist: 300,
      },
    }).find(entry => entry.contractId === 'special-projectile-behavior');
    expect(cruise.status).toBe('incomplete');
    expect(cruise.problems).toContainEqual(expect.objectContaining({
      key: 'cruise_min_height',
      level: 'error',
    }));

    const split = evaluate({
      patch: {
        weapon_slot_1_speceffect: 'split',
        weapon_slot_1_speceffect_def: 'missing_child',
        weapon_slot_1_speceffect_number: 0,
      },
    }).find(entry => entry.contractId === 'special-projectile-behavior');
    expect(split.problems).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'speceffect_number', level: 'error' }),
      expect.objectContaining({ key: 'speceffect_def', level: 'warning' }),
    ]));
  });

  it('warns when docking-only carrier fields are configured while docking is disabled', () => {
    const carrier = evaluate({
      patch: {
        weapon_slot_1_carried_unit: 'armflea',
        weapon_slot_1_spawnrate: 5,
        weapon_slot_1_maxunits: 4,
        weapon_slot_1_controlradius: 900,
        weapon_slot_1_enabledocking: false,
        weapon_slot_1_dockingradius: 120,
      },
    }).find(entry => entry.contractId === 'carrier-spawner');
    expect(carrier.status).toBe('conflicting');
    expect(carrier.problems).toContainEqual(expect.objectContaining({
      key: 'enabledocking',
      level: 'warning',
      suggestedFix: 'Enable docking or reset the docking-only fields.',
    }));
  });

  it('does not detect a contract from an inactive inherited flag', () => {
    expect(evaluate({ slot: { interceptsolo: false } })).toHaveLength(0);
  });

  it('requires both energy-conversion fields', () => {
    const result = evaluate({ unit: { 'customparams.energyconv_capacity': 600 } })
      .find(entry => entry.contractId === 'energy-converter');
    expect(result.status).toBe('incomplete');
    expect(result.problems).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'customparams.energyconv_efficiency' }),
    ]));
  });

  it('accepts a complete Scavenger squad profile and rejects impossible bounds', () => {
    const complete = evaluate({
      patch: {
        'customparams.scavcustomsquad': true,
        'customparams.scavsquadunitsamount': 2,
        'customparams.scavsquadminanger': 30,
        'customparams.scavsquadmaxanger': 120,
        'customparams.scavsquadweight': 150,
        'customparams.scavsquadrarity': 'basic',
        'customparams.scavsquadbehavior': 'berserk',
        'customparams.scavsquadbehaviordistance': 1000,
        'customparams.scavsquadbehaviorchance': 1,
      },
    }).find(entry => entry.contractId === 'scavenger-squad');
    expect(complete.status).toBe('ready');
    expect(complete.problems).toHaveLength(0);

    const invalid = evaluate({
      patch: {
        'customparams.scavcustomsquad': true,
        'customparams.scavsquadminanger': 140,
        'customparams.scavsquadmaxanger': 10,
        'customparams.scavsquadbehaviorchance': 2,
      },
    }).find(entry => entry.contractId === 'scavenger-squad');
    expect(invalid.status).toBe('incomplete');
    expect(invalid.problems).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'customparams.scavsquadunitsamount', level: 'error' }),
      expect.objectContaining({ key: 'customparams.scavsquadbehaviorchance', level: 'error' }),
    ]));
  });

  it('converts contract problems into routed project validation issues', () => {
    const results = evaluate({ slot: { cluster_def: 'missing_weapon' } });
    const issues = gadgetContractResultsToIssues(results);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'gadget-contract',
        group: 'contracts',
        unitId: 'armtest',
        action: expect.objectContaining({ type: 'unit' }),
        contractSource: expect.objectContaining({ path: expect.stringMatching(/\.lua$/) }),
      }),
    ]));
  });

  it('accepts representative contracts from the pinned BAR snapshot', () => {
    const knownUnitIds = new Set(Object.keys(unitDefaults));
    const knownWeaponDefs = new Set(
      Object.values(unitDefaults)
        .flatMap(unit => unit.weaponSlots || [])
        .map(slot => String(slot.defKey || '').toLowerCase())
        .filter(Boolean),
    );
    const fixtures = [
      ['legmineb', 'explosion-spawner', 'ready'],
      ['armdronecarry', 'carrier-spawner', 'experimental'],
      ['legcluster', 'cluster-projectile', 'ready'],
      ['cortrem', 'sector-fire', 'ready'],
      ['armcarry', 'projectile-interception', 'ready'],
      ['armmakr', 'energy-converter', 'ready'],
    ];

    fixtures.forEach(([unitId, contractId, expectedStatus]) => {
      const result = evaluateGadgetContracts({
        unitId,
        unitName: unitId,
        defaults: unitDefaults[unitId],
        knownUnitIds,
        knownWeaponDefs,
      }).find(entry => entry.contractId === contractId);
      expect(result, `${unitId} should activate ${contractId}`).toBeDefined();
      expect(result.status, `${unitId} ${contractId}`).toBe(expectedStatus);
      expect(result.problems, `${unitId} ${contractId}`).toHaveLength(0);
    });
  });
});
