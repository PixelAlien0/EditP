import { describe, expect, it } from 'vitest';
import {
  compileTweakDefsLua,
  generateBuildMenuBlockLua,
  generateClonesBlockLua,
  sortClonesDependency,
  traceAncestor
} from './tweakdefsHelper.js';

const nestedClones = [
  { baseId: 'armflash_clone', newId: 'armflash_clone_2', displayName: 'Child', builderIds: [] },
  { baseId: 'armflash', newId: 'armflash_clone', displayName: 'Parent', builderIds: [] }
];

describe('nested clone generation', () => {
  it('resolves ancestors case-insensitively', () => {
    expect(traceAncestor('ARMFLASH_CLONE_2', nestedClones)).toBe('armflash');
  });

  it('emits parents before dependent children', () => {
    expect(sortClonesDependency(nestedClones).map(clone => clone.newId)).toEqual([
      'armflash_clone',
      'armflash_clone_2'
    ]);
    const lua = generateClonesBlockLua(nestedClones);
    expect(lua.indexOf('local n = "armflash_clone"')).toBeLessThan(lua.indexOf('local n = "armflash_clone_2"'));
  });

  it('compiles clone and build-menu blocks into generated Lua', () => {
    const lua = compileTweakDefsLua({
      currentTweakDefsLua: 'return {}',
      customUnitClones: nestedClones,
      buildMenuWizardSteps: [{ builderId: 'armlab', add: ['armflash_clone_2'], remove: [] }],
      disabledUnitIds: [],
      unitBuildOptions: {},
      compileFlags: { includeClones: true, includeRosters: true },
    });
    expect(lua).toContain('armflash_clone_2');
    expect(lua).toContain('armlab');
    expect(generateBuildMenuBlockLua([{ builderId: 'armlab', add: ['armflash'], remove: [] }]))
      .toContain('armflash');
  });
});
