import { describe, expect, it } from 'vitest';
import { analyzeProjectIntegrity, repairProjectIntegrity } from './projectIntegrityDoctor.js';

const allUnitsList = [
  { id: 'armlab', name: 'Bot Lab' },
  { id: 'armflash', name: 'Flash' },
  { id: 'armflea', name: 'Flea' },
];
const context = {
  allUnitsList,
  activeFactoryRosters: { armlab: ['armflash'] },
  defaultsDb: {
    armlab: { weaponSlots: [] },
    armflash: { weaponSlots: [{ slot: 1, defKey: 'laser' }] },
  },
  resolveCloneRootId: unitId => unitId === 'flash_clone' ? 'armflash' : unitId,
};

function project(overrides = {}) {
  return {
    tweaks: {}, clones: [], disabledUnitIds: [], unitDescriptions: {}, buildMenuSteps: [],
    weaponLibrary: [], supportingWeaponDefs: [], ...overrides,
  };
}

describe('Project Integrity Doctor', () => {
  it('prunes missing producers, unknown units, conflicts, and stale ordering', () => {
    const source = project({
      buildMenuSteps: [
        { builderId: 'deleted_factory', add: ['armflash'], remove: [], order: [] },
        { builderId: 'armlab', add: ['armflea', 'missing'], remove: ['armflea'], order: ['armflash', 'missing'] },
      ],
    });
    const result = repairProjectIntegrity(source, context, ['clean-build-menus']);
    expect(result.applied).toEqual(['clean-build-menus']);
    expect(result.project.buildMenuSteps).toEqual([{
      builderId: 'armlab', add: ['armflea'], remove: [], order: ['armflash'],
    }]);
  });

  it('merges valid producer assignments into Clone Identity and Build Menus', () => {
    const source = project({
      clones: [{ baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: ['armlab'] }],
    });
    const result = repairProjectIntegrity(source, context, ['sync-clone-producers']);
    expect(result.project.clones[0].builderIds).toEqual(['armlab']);
    expect(result.project.buildMenuSteps).toEqual([{
      builderId: 'armlab', add: ['flash_clone'], remove: [], order: [],
    }]);
  });

  it('respects an explicit Build Menu removal when synchronizing clone producers', () => {
    const source = project({
      clones: [{ baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: ['armlab'] }],
      buildMenuSteps: [{ builderId: 'armlab', add: [], remove: ['flash_clone'], order: [] }],
    });
    const result = repairProjectIntegrity(source, context, ['sync-clone-producers']);
    expect(result.project.clones[0].builderIds).toEqual([]);
    expect(result.project.buildMenuSteps[0].remove).toEqual(['flash_clone']);
  });

  it('restores unresolved weapon swaps without removing the clone', () => {
    const source = project({
      clones: [{
        baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: [],
        weaponSwaps: {
          1: { sourceUnitId: 'armflash', sourceWeaponDefKey: 'laser', libraryWeaponId: 'deleted' },
        },
      }],
    });
    const report = analyzeProjectIntegrity({ project: source, context });
    expect(report.findings.some(item => item.repair?.id === 'restore-invalid-weapon-swaps')).toBe(true);
    const result = repairProjectIntegrity(source, context, ['restore-invalid-weapon-swaps']);
    expect(result.project.clones[0].weaponSwaps).toEqual({});
    expect(result.project.clones).toHaveLength(1);
  });

  it('removes stale records and disables ownerless supporting definitions', () => {
    const source = project({
      disabledUnitIds: ['armflash', 'deleted_clone'],
      unitDescriptions: { armflash: 'Edited', deleted_clone: 'Stale' },
      supportingWeaponDefs: [{ id: 'orphan', ownerUnitId: 'deleted_clone', key: 'child', enabled: true }],
    });
    const result = repairProjectIntegrity(source, context);
    expect(result.project.disabledUnitIds).toEqual(['armflash']);
    expect(result.project.unitDescriptions).toEqual({ armflash: 'Edited' });
    expect(result.project.supportingWeaponDefs[0].enabled).toBe(false);
  });

  it('keeps ambiguous unassigned clones review-only', () => {
    const source = project({
      clones: [{ baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: [] }],
    });
    const report = analyzeProjectIntegrity({ project: source, context });
    const unassigned = report.findings.find(item => item.id === 'integrity-clone-flash_clone-unassigned');
    expect(unassigned?.repair).toBeNull();
    expect(unassigned?.action).toMatchObject({ type: 'build-menu' });
  });

  it('does not mistake a spawned clone for a missing Build Menu assignment', () => {
    const source = project({
      clones: [{ baseId: 'armflash', newId: 'flash_clone', displayName: 'Flash Clone', builderIds: [] }],
      tweaks: { armlab: { weapon_slot_1_spawns_name: 'flash_clone' } },
    });
    const report = analyzeProjectIntegrity({ project: source, context });
    expect(report.findings.some(item => item.id === 'integrity-clone-flash_clone-unassigned')).toBe(false);
  });
});
