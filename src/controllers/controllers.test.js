import { describe, expect, it } from 'vitest';
import { applyCloneBuilderAssignments } from './useCloneController.js';
import { getValidationWarning } from './useProjectValidation.js';

describe('controller helpers', () => {
  it('moves a clone between builders without leaving duplicate assignments', () => {
    const result = applyCloneBuilderAssignments([
      { builderId: 'armlab', add: ['test_clone'], remove: [] },
      { builderId: 'armvp', add: ['other_unit'], remove: ['test_clone'] },
    ], 'test_clone', ['armvp', 'armvp']);

    expect(result).toEqual([
      { builderId: 'armvp', add: ['other_unit', 'test_clone'], remove: [] },
    ]);
  });

  it('removes stale clone ordering while preserving unrelated roster order', () => {
    const result = applyCloneBuilderAssignments([
      {
        builderId: 'armlab',
        add: ['test_clone'],
        remove: [],
        order: ['armck', 'test_clone'],
      },
    ], 'test_clone', []);

    expect(result).toEqual([{
      builderId: 'armlab',
      add: [],
      remove: [],
      order: ['armck'],
    }]);
  });

  it('validates carrier lists and engine-sensitive parameter values', () => {
    expect(getValidationWarning('customparams.maxunits', '4 2')).toBeNull();
    expect(getValidationWarning('customparams.maxunits', '4 zero')).toMatchObject({
      level: 'error',
    });
    expect(getValidationWarning('weapon_slot_1_burstrate', '0')).toBeNull();
    expect(getValidationWarning('weapon_slot_1_burstrate', '-1')).toMatchObject({
      level: 'error',
    });
    expect(getValidationWarning('weapon_slot_1_speceffect', 'sector_fire')).toBeNull();
    expect(getValidationWarning('weapon_slot_1_speceffect', 'sector_fyre')).toMatchObject({
      level: 'error',
    });
    expect(getValidationWarning('weapon_slot_1_spread_angle', '22')).toBeNull();
    expect(getValidationWarning('weapon_slot_1_spread_angle', '0')).toMatchObject({
      level: 'error',
    });
    expect(getValidationWarning('weapon_slot_1_max_range_reduction', '0.3')).toBeNull();
    expect(getValidationWarning('weapon_slot_1_max_range_reduction', '1.1')).toMatchObject({
      level: 'error',
    });
  });
});
