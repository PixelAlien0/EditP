import { describe, expect, it } from 'vitest';
import { buildCrossWorkspaceValidation } from './crossWorkspaceValidation.js';

const units = [
  { id: 'armlab', name: 'Bot Lab' },
  { id: 'armflash', name: 'Flash' },
  { id: 'armflea', name: 'Flea' },
];

const defaultsDb = {
  armlab: { weaponSlots: [] },
  armflash: { weaponSlots: [{ slot: 1, defKey: 'laser', damage: 10, reload: 1, projectiles: 1, burst: 1 }] },
  armflea: { weaponSlots: [{ slot: 1, defKey: 'tiny_laser', damage: 5, reload: 1, projectiles: 1, burst: 1 }] },
};

function validate(overrides = {}) {
  return buildCrossWorkspaceValidation({
    allUnitsList: units,
    defaultsDb,
    activeFactoryRosters: { armlab: ['armflash'] },
    resolveCloneRootId: id => id === 'flash_clone' ? 'armflash' : id,
    ...overrides,
  });
}

describe('cross-workspace project validation', () => {
  it('finds clones without a production path and mismatched builder metadata', () => {
    const unassigned = validate({
      clones: [{ baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: [] }],
    });
    expect(unassigned).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross-workspace-clone-flash_clone-unassigned', action: expect.objectContaining({ type: 'build-menu' }) }),
    ]));

    const mismatched = validate({
      clones: [{ baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: ['armlab'] }],
      buildMenuSteps: [],
    });
    expect(mismatched).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross-workspace-clone-flash_clone-builder-sync', level: 'error' }),
    ]));
  });

  it('detects stale Build Menu references and contradictory operations', () => {
    const result = validate({
      buildMenuSteps: [{
        builderId: 'armlab',
        add: ['missing_unit', 'armflea'],
        remove: ['armflea'],
        order: ['armflash', 'stale_unit'],
      }],
    });

    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross-workspace-roster-armlab-conflict', level: 'error' }),
      expect.objectContaining({ id: 'cross-workspace-roster-armlab-missing_unit-unknown', level: 'error' }),
      expect.objectContaining({ id: 'cross-workspace-roster-armlab-order' }),
    ]));
  });

  it('distinguishes unused custom weapons from broken equipped weapons', () => {
    const blueprint = {
      id: 'rose_laser',
      name: 'Rose Laser',
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'laser',
      sourceValues: { damage: 10, reload: 1, projectiles: 1, burst: 1 },
      overrides: { damage: 20 },
    };
    const unused = validate({ weaponLibrary: [blueprint] });
    expect(unused).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross-workspace-weapon-rose_laser-unused', level: 'info' }),
    ]));

    const broken = validate({
      clones: [{
        baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: ['armlab'],
        weaponSwaps: { 1: { sourceUnitId: 'armflash', sourceWeaponDefKey: 'laser', libraryWeaponId: 'deleted_weapon' } },
      }],
      buildMenuSteps: [{ builderId: 'armlab', add: ['flash_clone'], remove: [] }],
    });
    expect(broken).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross-workspace-weapon-flash_clone-1-missing-library', level: 'error' }),
    ]));
  });

  it('validates aligned multi-type carrier companion lists', () => {
    const result = validate({
      tweaks: {
        armflash: {
          weapon_slot_1_carried_unit: 'armflea armflash armflea',
          weapon_slot_1_maxunits: '4 3',
          weapon_slot_1_startingdronecount: '1 0 1',
        },
      },
    });
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cross-workspace-armflash-weapon_slot_1_maxunits-alignment', level: 'error' }),
    ]));
  });

  it('keeps a synchronized clone, roster, and equipped blueprint clear of link errors', () => {
    const blueprint = {
      id: 'rose_laser', name: 'Rose Laser', sourceUnitId: 'armflash', sourceWeaponDefKey: 'laser',
      sourceValues: { damage: 10, reload: 1, projectiles: 1, burst: 1 }, overrides: { damage: 20 },
    };
    const result = validate({
      weaponLibrary: [blueprint],
      clones: [{
        baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: ['armlab'],
        weaponSwaps: { 1: { sourceUnitId: 'armflash', sourceWeaponDefKey: 'laser', libraryWeaponId: 'rose_laser' } },
      }],
      buildMenuSteps: [{ builderId: 'armlab', add: ['flash_clone'], remove: [] }],
    });
    expect(result.filter(entry => entry.level === 'error')).toEqual([]);
    expect(result.some(entry => entry.id.endsWith('-unused'))).toBe(false);
  });
});
