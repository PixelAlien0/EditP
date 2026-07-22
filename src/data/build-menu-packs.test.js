import { describe, expect, it } from 'vitest';
import { BUILD_MENU_PACK_SOURCE_COMMIT, buildEffectiveFactoryRosters } from './build-menu-packs.js';

describe('BAR optional build-menu profiles', () => {
  it('adds Apollyon to the Legion T3 Gantry when Extra Units is enabled', () => {
    const rosters = buildEffectiveFactoryRosters({ leggant: ['legbunk'] }, { extraUnits: true });

    expect(BUILD_MENU_PACK_SOURCE_COMMIT).toBe('32197852b08b20a5b2b2e439d4d4e7c6b7897445');
    expect(rosters.leggant).toEqual(['legbunk', 'legapollyon']);
  });
});
