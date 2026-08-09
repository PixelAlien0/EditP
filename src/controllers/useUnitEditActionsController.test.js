import { describe, expect, it } from 'vitest';
import {
  buildFullProjectResetPatch,
  buildRosterRevertPatch,
  buildSummaryUnitResetPatch,
  buildUnitEditsResetPatch,
  buildUnitResetPatch,
} from './useUnitEditActionsController.js';

describe('unit edit action reset-patch builders', () => {
  it('buildUnitResetPatch removes the unit tweaks entry and disabled flag only', () => {
    const project = {
      tweaks: {
        armck: { health: 1200 },
        corck: { health: 900 },
      },
      disabledUnitIds: ['armck', 'corllt'],
    };

    expect(buildUnitResetPatch(project, 'armck')).toEqual({
      tweaks: { corck: { health: 900 } },
      disabledUnitIds: ['corllt'],
    });
    // Input project must stay untouched.
    expect(project.tweaks.armck).toEqual({ health: 1200 });
    expect(project.disabledUnitIds).toEqual(['armck', 'corllt']);
  });

  it('buildUnitResetPatch keeps unrelated state when the unit has no edits', () => {
    const project = {
      tweaks: { corck: { health: 900 } },
      disabledUnitIds: [],
    };

    expect(buildUnitResetPatch(project, 'armck')).toEqual({
      tweaks: { corck: { health: 900 } },
      disabledUnitIds: [],
    });
  });

  it('buildSummaryUnitResetPatch clears tweaks and descriptions case-insensitively', () => {
    const project = {
      tweaks: {
        ARMCK: { health: 1200 },
        corck: { health: 900 },
      },
      unitDescriptions: {
        armck: 'Edited engineer',
        corllt: 'Light laser tower',
      },
    };

    expect(buildSummaryUnitResetPatch(project, 'ArmCk')).toEqual({
      tweaks: { corck: { health: 900 } },
      unitDescriptions: { corllt: 'Light laser tower' },
    });
  });

  it('buildUnitEditsResetPatch clears every tweak and description', () => {
    expect(buildUnitEditsResetPatch()).toEqual({
      tweaks: {},
      unitDescriptions: {},
    });
  });

  it('buildRosterRevertPatch restores the untouched build-menu baseline', () => {
    expect(buildRosterRevertPatch()).toEqual({
      buildMenuSteps: [],
      buildMenuPacks: { extraUnits: false, scavengerUnits: false },
      supportingWeaponDefs: [],
    });
  });

  it('buildFullProjectResetPatch resets unit, roster, and pack changes but keeps weapon libraries', () => {
    expect(buildFullProjectResetPatch()).toEqual({
      tweaks: {},
      unitDescriptions: {},
      clones: [],
      disabledUnitIds: [],
      buildMenuSteps: [],
      buildMenuPacks: { extraUnits: false, scavengerUnits: false },
    });
    expect(buildFullProjectResetPatch()).not.toHaveProperty('weaponLibrary');
    expect(buildFullProjectResetPatch()).not.toHaveProperty('supportingWeaponDefs');
  });
});
