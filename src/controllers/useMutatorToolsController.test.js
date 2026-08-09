import { describe, expect, it } from 'vitest';
import {
  buildRandomMutations,
  computeBulkUpdates,
} from './useMutatorToolsController.js';

const identityResolve = unitId => unitId;

const DEFAULTS_DB = {
  armflash: {
    health: 1000,
    metalcost: 200,
    energycost: 1600,
    buildtime: 2500,
    maxvelocity: 2.5,
    weaponSlots: [
      { slot: 1, damage: 220, range: 330, reload: 2.5 },
    ],
  },
  corvoy: {
    health: 800,
    metalcost: 150,
    energycost: 900,
    buildtime: 1800,
    maxvelocity: 0,
    weaponSlots: [],
  },
};

describe('computeBulkUpdates', () => {
  const units = [{ id: 'armflash' }, { id: 'corvoy' }];

  it('applies percent mode against defaults when no tweaks exist', () => {
    const { updates, count } = computeBulkUpdates(units, DEFAULTS_DB, {}, {
      statKey: 'health',
      changeValue: 10,
      mode: 'percent',
      resolveCloneRootId: identityResolve,
    });

    expect(count).toBe(2);
    expect(updates).toEqual([
      { unitId: 'armflash', key: 'health', value: '1100.00' },
      { unitId: 'corvoy', key: 'health', value: '880.00' },
    ]);
  });

  it('prefers existing tweaks over defaults as the adjustment base', () => {
    const tweaks = { armflash: { health: '500' } };
    const { updates } = computeBulkUpdates(units, DEFAULTS_DB, tweaks, {
      statKey: 'health',
      changeValue: 20,
      mode: 'percent',
      resolveCloneRootId: identityResolve,
    });

    expect(updates[0]).toEqual({ unitId: 'armflash', key: 'health', value: '600.00' });
    expect(updates[1]).toEqual({ unitId: 'corvoy', key: 'health', value: '960.00' });
  });

  it('applies fixed mode additively', () => {
    const { updates } = computeBulkUpdates(units, DEFAULTS_DB, {}, {
      statKey: 'metalcost',
      changeValue: -50,
      mode: 'fixed',
      resolveCloneRootId: identityResolve,
    });

    expect(updates).toEqual([
      { unitId: 'armflash', key: 'metalcost', value: '150.00' },
      { unitId: 'corvoy', key: 'metalcost', value: '100.00' },
    ]);
  });

  it('clamps cost, health, and velocity stats at zero but allows negative values elsewhere', () => {
    const clamped = computeBulkUpdates([{ id: 'corvoy' }], DEFAULTS_DB, {}, {
      statKey: 'health',
      changeValue: -100,
      mode: 'percent',
      resolveCloneRootId: identityResolve,
    });
    expect(clamped.updates[0].value).toBe('0.00');

    const unclamped = computeBulkUpdates([{ id: 'corvoy' }], DEFAULTS_DB, {}, {
      statKey: 'buildtime',
      changeValue: -9999,
      mode: 'fixed',
      resolveCloneRootId: identityResolve,
    });
    expect(unclamped.updates[0].value).toBe('-8199.00');
  });

  it('adjusts every weapon slot for the all-weapons stat keys', () => {
    const { updates, count } = computeBulkUpdates([{ id: 'armflash' }], DEFAULTS_DB, {}, {
      statKey: 'all_weapons_damage',
      changeValue: 50,
      mode: 'percent',
      resolveCloneRootId: identityResolve,
    });

    expect(count).toBe(1);
    expect(updates).toEqual([
      { unitId: 'armflash', key: 'weapon_slot_1_damage', value: '330.00' },
    ]);

    const rangeUpdates = computeBulkUpdates([{ id: 'armflash' }], DEFAULTS_DB, {}, {
      statKey: 'all_weapons_range',
      changeValue: -30,
      mode: 'fixed',
      resolveCloneRootId: identityResolve,
    });
    expect(rangeUpdates.updates).toEqual([
      { unitId: 'armflash', key: 'weapon_slot_1_range', value: '300.00' },
    ]);
  });

  it('clamps weapon slot values at zero and honors existing weapon tweaks', () => {
    const tweaks = { armflash: { weapon_slot_1_damage: '100' } };
    const { updates } = computeBulkUpdates([{ id: 'armflash' }], DEFAULTS_DB, tweaks, {
      statKey: 'all_weapons_damage',
      changeValue: -500,
      mode: 'fixed',
      resolveCloneRootId: identityResolve,
    });

    expect(updates).toEqual([
      { unitId: 'armflash', key: 'weapon_slot_1_damage', value: '0.00' },
    ]);
  });

  it('resolves clone units against their root defaults', () => {
    const { updates } = computeBulkUpdates([{ id: 'armflash_mk2', isClone: true }], DEFAULTS_DB, {}, {
      statKey: 'health',
      changeValue: 10,
      mode: 'percent',
      resolveCloneRootId: () => 'armflash',
    });

    expect(updates).toEqual([
      { unitId: 'armflash_mk2', key: 'health', value: '1100.00' },
    ]);
  });
});

describe('buildRandomMutations', () => {
  const ALL_DOMAINS = { economy: true, durability: true, mobility: true, weapons: true };

  const buildRng = values => {
    let index = 0;
    return () => values[index++ % values.length];
  };

  it('uses the minimum ratio when the RNG returns zero', () => {
    const mutations = buildRandomMutations([{ id: 'armflash' }], DEFAULTS_DB, {
      intensity: 'balanced',
      domains: ALL_DOMAINS,
      resolveCloneRootId: identityResolve,
    }, buildRng([0]));

    expect(mutations).toEqual([
      { unitId: 'armflash', key: 'health', value: '750' },
      { unitId: 'armflash', key: 'metalcost', value: '150' },
      { unitId: 'armflash', key: 'energycost', value: '1200' },
      { unitId: 'armflash', key: 'buildtime', value: '1875' },
      { unitId: 'armflash', key: 'maxvelocity', value: '1.9' },
      { unitId: 'armflash', key: 'weapon_slot_1_damage', value: '165.0' },
      { unitId: 'armflash', key: 'weapon_slot_1_range', value: '247.5' },
      { unitId: 'armflash', key: 'weapon_slot_1_reload', value: '1.88' },
    ]);
  });

  it('uses the maximum ratio when the RNG returns one', () => {
    const mutations = buildRandomMutations([{ id: 'armflash' }], DEFAULTS_DB, {
      intensity: 'cautious',
      domains: { economy: false, durability: true, mobility: false, weapons: false },
      resolveCloneRootId: identityResolve,
    }, buildRng([1]));

    expect(mutations).toEqual([
      { unitId: 'armflash', key: 'health', value: '1100' },
    ]);
  });

  it('respects intensity ranges for chaos mode', () => {
    const mutations = buildRandomMutations([{ id: 'corvoy' }], DEFAULTS_DB, {
      intensity: 'chaos',
      domains: { economy: false, durability: true, mobility: true, weapons: true },
      resolveCloneRootId: identityResolve,
    }, buildRng([0.5]));

    // ratio = 0.50 + 0.5 * (1.50 - 0.50) = 1.00 — chaos midpoint is neutral.
    expect(mutations).toEqual([
      { unitId: 'corvoy', key: 'health', value: '800' },
    ]);
    // mobility skipped: corvoy maxvelocity is 0, weapons skipped: no slots.
  });

  it('only emits mutations for enabled domains', () => {
    const mutations = buildRandomMutations([{ id: 'armflash' }], DEFAULTS_DB, {
      intensity: 'balanced',
      domains: { economy: true, durability: false, mobility: false, weapons: false },
      resolveCloneRootId: identityResolve,
    }, buildRng([0]));

    expect(mutations.map(mutation => mutation.key)).toEqual([
      'metalcost', 'energycost', 'buildtime',
    ]);
  });

  it('skips units without defaults and resolves clones to their root', () => {
    const mutations = buildRandomMutations([
      { id: 'unknown_unit' },
      { id: 'armflash_mk2', isClone: true },
    ], DEFAULTS_DB, {
      intensity: 'balanced',
      domains: { economy: false, durability: true, mobility: false, weapons: false },
      resolveCloneRootId: () => 'armflash',
    }, buildRng([0]));

    expect(mutations).toEqual([
      { unitId: 'armflash_mk2', key: 'health', value: '750' },
    ]);
  });

  it('defaults to Math.random when no RNG is injected', () => {
    const mutations = buildRandomMutations([{ id: 'armflash' }], DEFAULTS_DB, {
      intensity: 'balanced',
      domains: { economy: false, durability: true, mobility: false, weapons: false },
      resolveCloneRootId: identityResolve,
    });

    expect(mutations).toHaveLength(1);
    const health = Number(mutations[0].value);
    expect(health).toBeGreaterThanOrEqual(750);
    expect(health).toBeLessThanOrEqual(1250);
  });
});
