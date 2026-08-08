import { describe, expect, it } from 'vitest';
import { analyzeSupportingWeaponDefLibrary, getSupportingWeaponDefDestination } from './supportingWeaponDefLibrary.js';

const definition = (overrides = {}) => ({
  id: 'support-child',
  ownerUnitId: 'armflea',
  key: 'cluster_child',
  label: 'Cluster child',
  definition: { damage: { default: 20 } },
  enabled: true,
  dependencies: [],
  referencedBy: [],
  mountedSlots: [],
  ...overrides,
});

describe('supporting WeaponDef library analysis', () => {
  it('normalizes destinations and discovers definition, slot, and tweak consumers', () => {
    const definitions = [
      definition({ mountedSlots: [2] }),
      definition({
        id: 'support-parent',
        key: 'cluster_parent',
        definition: { customparams: { cluster_def: 'cluster_child' } },
        dependencies: ['cluster_child'],
      }),
    ];
    const result = analyzeSupportingWeaponDefLibrary({
      definitions,
      knownUnitIds: [{ id: 'armflea' }],
      tweaks: { armflea: { weapon_slot_1_cluster_def: 'cluster_child' } },
    });

    expect(getSupportingWeaponDefDestination(definitions[0])).toBe('armflea:cluster_child');
    expect(result.entries[0].status).toBe('ready');
    expect(result.entries[0].consumers).toEqual(expect.arrayContaining([
      'cluster_parent',
      'weapon slot 2',
      'weapon slot 1 cluster def',
    ]));
    expect(result.entries[1].missingDependencies).toEqual([]);
  });

  it('reports invalid owners, duplicate destinations, and missing dependencies', () => {
    const result = analyzeSupportingWeaponDefLibrary({
      definitions: [
        definition({ dependencies: ['missing_child'] }),
        definition({ id: 'duplicate' }),
        definition({ id: 'unknown-owner', ownerUnitId: 'unknown', key: 'other' }),
      ],
      knownUnitIds: ['armflea'],
    });

    expect(result.entries[0].status).toBe('error');
    expect(result.entries[0].errors).toContain('Another supporting WeaponDef uses this owner and key.');
    expect(result.entries[0].missingDependencies).toEqual(['missing_child']);
    expect(result.entries[2].errors[0]).toContain('not present in this project');
    expect(result.totals.issues).toBe(3);
  });
});
