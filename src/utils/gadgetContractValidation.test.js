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
    expect(result.status).toBe('ready');
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

  it('converts contract problems into routed project validation issues', () => {
    const results = evaluate({ slot: { cluster_def: 'missing_weapon' } });
    const issues = gadgetContractResultsToIssues(results);
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        source: 'gadget-contract',
        group: 'contracts',
        unitId: 'armtest',
        action: expect.objectContaining({ type: 'unit' }),
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
