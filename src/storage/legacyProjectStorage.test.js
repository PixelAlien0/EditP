import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearLegacyProjectState,
  LEGACY_PROJECT_FIELDS,
  loadLegacyProjectState,
  persistLegacyProjectState,
} from './legacyProjectStorage.js';

const defaults = {
  tweaks: {},
  clones: [],
  buildMenuPacks: { extraUnits: false, scavengerUnits: false },
  projectName: 'BAR Editor Mod',
  includeTweaks: true,
};

describe('legacy project storage', () => {
  beforeEach(() => localStorage.clear());

  it('loads the previous project shape for one-time migration', () => {
    localStorage.setItem('bmf_tweaks', JSON.stringify({ armfus: { health: 9000 } }));
    localStorage.setItem('bmf_buildmenu_packs', JSON.stringify({ extraUnits: true }));
    localStorage.setItem('bmf_inc_tweaks', 'false');

    expect(loadLegacyProjectState(defaults)).toEqual({
      ...defaults,
      tweaks: { armfus: { health: 9000 } },
      buildMenuPacks: { extraUnits: true, scavengerUnits: false },
      includeTweaks: false,
    });
  });

  it('writes only for fallback mode and can remove every migrated key', () => {
    persistLegacyProjectState(defaults);
    expect(localStorage.getItem('bmf_project_name')).toBe('BAR Editor Mod');

    clearLegacyProjectState();
    expect(Object.values(LEGACY_PROJECT_FIELDS).every(([key]) => localStorage.getItem(key) === null)).toBe(true);
  });
});
