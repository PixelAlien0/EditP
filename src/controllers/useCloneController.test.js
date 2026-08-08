import { describe, expect, it } from 'vitest';
import { removeDeletedCloneReferences } from './useCloneController.js';

describe('clone deletion reference cleanup', () => {
  it('removes the deleted cloned producer roster and every inbound reference', () => {
    const result = removeDeletedCloneReferences({
      buildMenuSteps: [
        {
          builderId: 'allbuildert4',
          add: ['allmet3', 'allmt2'],
          remove: ['armmex'],
          order: ['allmet3', 'allmt2'],
        },
        {
          builderId: 'armaca',
          add: ['allbuildert4', 'armflash'],
          remove: ['allbuildert4'],
          order: ['allbuildert4', 'armflash'],
        },
      ],
      disabledUnitIds: ['allbuildert4', 'corak'],
      unitCollections: [{
        id: 'builders',
        unitIds: ['allbuildert4', 'armaca'],
      }],
    }, ['ALLBUILDERT4']);

    expect(result.buildMenuSteps).toEqual([{
      builderId: 'armaca',
      add: ['armflash'],
      remove: [],
      order: ['armflash'],
    }]);
    expect(result.disabledUnitIds).toEqual(['corak']);
    expect(result.unitCollections[0].unitIds).toEqual(['armaca']);
  });

  it('drops roster steps that become empty after deleting clone targets', () => {
    const result = removeDeletedCloneReferences({
      buildMenuSteps: [{
        builderId: 'armaca',
        add: ['clone_building'],
        remove: [],
        order: ['clone_building'],
      }],
      disabledUnitIds: [],
      unitCollections: [],
    }, new Set(['clone_building']));

    expect(result.buildMenuSteps).toEqual([]);
  });
});
