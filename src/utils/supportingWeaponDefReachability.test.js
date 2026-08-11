import { describe, expect, it } from 'vitest';
import { resolveSupportingWeaponDefReachability } from './supportingWeaponDefReachability.js';

const definition = (id, ownerUnitId, key, extra = {}) => ({
  id,
  ownerUnitId,
  key,
  enabled: true,
  definition: { damage: { default: 10 } },
  ...extra,
});

describe('Supporting WeaponDef reachability', () => {
  it('keeps unused definitions local and includes directly referenced definitions', () => {
    const unused = definition('unused', 'armtest', 'unused_child');
    const used = definition('used', 'armtest', 'cluster_child');
    const result = resolveSupportingWeaponDefReachability({
      definitions: [unused, used],
      tweaks: { armtest: { weapon_slot_1_cluster_def: 'CLUSTER_CHILD' } },
    });

    expect(result.included).toEqual([used]);
    expect(result.excluded).toContain(unused);
    expect(result.totals.localOnly).toBe(1);
  });

  it('follows nested dependencies without crossing UnitDef owners', () => {
    const root = definition('root', 'armtest', 'cluster_root', {
      definition: { customparams: { cluster_def: 'cluster_child' } },
    });
    const child = definition('child', 'armtest', 'cluster_child');
    const otherOwner = definition('other', 'cortest', 'cluster_child');
    const result = resolveSupportingWeaponDefReachability({
      definitions: [root, child, otherOwner],
      tweaks: { armtest: { weapon_slot_1_cluster_def: 'cluster_root' } },
    });

    expect(result.included).toEqual([root, child]);
    expect(result.excluded).toContain(otherOwner);
  });

  it('includes mounted and explicitly pinned definitions', () => {
    const mounted = definition('mounted', 'armtest', 'mounted_gun', { mountedSlots: [2] });
    const pinned = definition('pinned', 'armtest', 'dynamic_child', { alwaysExport: true });
    const result = resolveSupportingWeaponDefReachability({ definitions: [mounted, pinned] });

    expect(result.included).toEqual([mounted, pinned]);
    expect(result.reasons['armtest:mounted_gun']).toContain('mounted weapon slot');
    expect(result.reasons['armtest:dynamic_child']).toContain('always export');
  });

  it('discovers references from equipped custom weapon blueprints', () => {
    const child = definition('child', 'armclone', 'blueprint_child');
    const result = resolveSupportingWeaponDefReachability({
      definitions: [child],
      clones: [{
        newId: 'armclone',
        weaponSwaps: { 1: { sourceUnitId: 'armtest', sourceWeaponDefKey: 'main', libraryWeaponId: 'custom-aa' } },
      }],
      weaponLibrary: [{
        id: 'custom-aa',
        sourceValues: {},
        overrides: { cluster_def: 'blueprint_child' },
      }],
    });

    expect(result.included).toEqual([child]);
  });

  it('never exports a disabled definition even when pinned', () => {
    const disabled = definition('disabled', 'armtest', 'disabled_child', { enabled: false, alwaysExport: true });
    const result = resolveSupportingWeaponDefReachability({ definitions: [disabled] });

    expect(result.included).toEqual([]);
    expect(result.totals.disabled).toBe(1);
  });
});

