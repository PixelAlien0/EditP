import { describe, expect, it } from 'vitest';
import {
  createWeaponBlueprintDraft,
  generateWeaponVfxPackLua,
  getWeaponBlueprintMetrics,
  normalizeWeaponBlueprint,
  validateWeaponBlueprint,
} from './weaponBlueprint.js';

describe('weapon blueprints', () => {
  it('creates a reusable draft from the active weapon slot', () => {
    const draft = createWeaponBlueprintDraft({
      sourceUnitId: 'armflash',
      slot: { defKey: 'plasma', damage: 100, reload: 2, range: 500, cegTag: 'laser' },
    });
    expect(draft.sourceWeaponDefKey).toBe('plasma');
    expect(draft.overrides).toMatchObject({ damage: 100, reload: 2, range: 500, cegtag: 'laser' });
  });

  it('uses BAR EditP names for generated CEG bindings', () => {
    const blueprint = normalizeWeaponBlueprint({
      id: 'rose-cannon',
      name: 'Rose Cannon',
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'plasma',
      appearance: { vfxEnabled: true },
      overrides: {},
    });
    expect(blueprint.overrides.cegtag).toBe('editp_rose_cannon_trail');
    expect(blueprint.overrides.explosiongenerator).toBe('custom:editp_rose_cannon_impact');
    expect(generateWeaponVfxPackLua([blueprint])).toContain('["editp_rose_cannon_trail"]');
    expect(generateWeaponVfxPackLua([blueprint])).not.toContain('bmf_');
  });

  it('calculates practical weapon output and rejects invalid counts', () => {
    expect(getWeaponBlueprintMetrics({ overrides: { damage: 100, reload: 2, burst: 3, projectiles: 2 } }).dps).toBe(300);
    expect(validateWeaponBlueprint({
      name: 'Broken',
      sourceUnitId: 'armflash',
      sourceWeaponDefKey: 'plasma',
      overrides: { projectiles: 0, burst: 1 },
    })).toContainEqual(expect.objectContaining({ field: 'projectiles' }));
  });
});
