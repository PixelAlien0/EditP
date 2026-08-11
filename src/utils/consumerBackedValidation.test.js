import { describe, expect, it } from 'vitest';
import {
  CONSUMER_BACKED_VALIDATION_VERSION,
  validateConsumerBackedCustomParameter,
  validateConsumerBackedPatch,
} from './consumerBackedValidation.js';

const context = {
  unitId: 'armtest',
  unitName: 'Test Unit',
  knownUnitIds: new Set(['armtest', 'armflea']),
  knownWeaponDefs: new Set(['known_weapon']),
  supportingWeaponDefs: new Set(['armtest:cluster_child']),
};

describe('consumer-backed custom parameter validation', () => {
  it('is explicitly versioned and ignores keys without a discovered BAR consumer', () => {
    expect(CONSUMER_BACKED_VALIDATION_VERSION).toBe(1);
    expect(validateConsumerBackedCustomParameter({
      ...context,
      projectKey: 'customparams.not_a_bar_contract',
      parameterKey: 'not_a_bar_contract',
      value: 'anything',
    })).toEqual([]);
  });

  it('enforces documented enum, range, and integer rules with source evidence', () => {
    const rarity = validateConsumerBackedCustomParameter({
      ...context,
      projectKey: 'customparams.scavsquadrarity',
      parameterKey: 'scavsquadrarity',
      value: 'legendary',
    });
    expect(rarity).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', code: 'enum', consumerCount: expect.any(Number) }),
    ]));
    expect(rarity[0].message).toContain('BAR consumer:');

    const amount = validateConsumerBackedCustomParameter({
      ...context,
      projectKey: 'customparams.scavsquadunitsamount',
      parameterKey: 'scavsquadunitsamount',
      value: 1.5,
    });
    expect(amount.map(issue => issue.code)).toContain('integer');
  });

  it('uses observed declaration types when the key is not yet curated', () => {
    const issues = validateConsumerBackedCustomParameter({
      ...context,
      projectKey: 'customparams.airfactory',
      parameterKey: 'airfactory',
      value: 'sometimes',
    });
    expect(issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'error', code: 'type', parameterId: 'unit:airfactory' }),
    ]));
  });

  it('checks UnitDef and supporting WeaponDef references', () => {
    const unitIssues = validateConsumerBackedCustomParameter({
      ...context,
      scope: 'weapon',
      projectKey: 'weapon_slot_1_carried_unit',
      parameterKey: 'carried_unit',
      value: 'armflea missing_drone',
    });
    expect(unitIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ level: 'warning', code: 'unit-reference' }),
    ]));

    const supported = validateConsumerBackedCustomParameter({
      ...context,
      scope: 'weapon',
      projectKey: 'weapon_slot_1_cluster_def',
      parameterKey: 'cluster_def',
      value: 'cluster_child',
    });
    expect(supported).toEqual([]);
  });

  it('lets the canonical contract engine own references for contract-bound fields', () => {
    const issues = validateConsumerBackedPatch({
      ...context,
      skipContractReferences: true,
      patch: {
        weapon_slot_1_carried_unit: 'missing_drone',
        weapon_slot_1_cluster_def: 'missing_weapon',
      },
    });
    expect(issues.some(issue => ['unit-reference', 'weapon-reference'].includes(issue.code))).toBe(false);
  });

  it('validates unit and weapon custom parameters from one project patch', () => {
    const issues = validateConsumerBackedPatch({
      ...context,
      patch: {
        'customparams.scavsquadrarity': 'invalid',
        weapon_slot_1_carried_unit: 'missing_drone',
        health: -10,
      },
    });
    expect(issues.map(issue => issue.key)).toEqual(expect.arrayContaining([
      'customparams.scavsquadrarity',
      'weapon_slot_1_carried_unit',
    ]));
    expect(issues.some(issue => issue.key === 'health')).toBe(false);
  });
});
