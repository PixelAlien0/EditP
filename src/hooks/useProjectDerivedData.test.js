import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { setUnitArtworkManifest } from '../utils/unitArtwork.js';
import { resolveLineage, useProjectDerivedData } from './useProjectDerivedData.js';

function createInput(overrides = {}) {
  return {
    tweaks: {},
    clones: [],
    unitDescriptions: {},
    defaultsDb: {
      armflash: { health: 620 },
      corak: { health: 840, 'customparams.techlevel': '2' },
    },
    unitsDb: {
      names: { armflash: 'Flash', corak: 'Krogoth' },
      descriptions: { armflash: 'Fast raider.', corak: 'Heavy assault bot.' },
    },
    getTechTierOfUnit: unitId => (unitId === 'corak' ? 't2' : 't1'),
    getTagsOfUnit: unitId => (unitId === 'corak' ? ['t2', 'bot'] : ['t1', 'vehicle']),
    ...overrides,
  };
}

function renderDerivedData(overrides = {}) {
  return renderHook(() => useProjectDerivedData(createInput(overrides)));
}

describe('resolveLineage', () => {
  const clones = [
    { newId: 'flash_mk2', baseId: 'armflash' },
    { newId: 'flash_mk3', baseId: 'flash_mk2' },
  ];

  it('returns the unit itself when it is not a clone', () => {
    expect(resolveLineage(clones, 'armflash')).toEqual({ rootId: 'armflash', lineage: [] });
  });

  it('resolves a single-level clone to its vanilla root', () => {
    const { rootId, lineage } = resolveLineage(clones, 'flash_mk2');
    expect(rootId).toBe('armflash');
    expect(lineage.map(clone => clone.newId)).toEqual(['flash_mk2']);
  });

  it('walks multi-level lineages back to the vanilla root, root-most first', () => {
    const { rootId, lineage } = resolveLineage(clones, 'flash_mk3');
    expect(rootId).toBe('armflash');
    expect(lineage.map(clone => clone.newId)).toEqual(['flash_mk2', 'flash_mk3']);
  });

  it('guards against clone cycles without looping forever', () => {
    const cyclic = [
      { newId: 'loop_a', baseId: 'loop_b' },
      { newId: 'loop_b', baseId: 'loop_a' },
    ];
    const { rootId, lineage } = resolveLineage(cyclic, 'loop_b');
    expect(lineage.map(clone => clone.newId)).toEqual(['loop_a', 'loop_b']);
    expect(rootId).toBe('loop_b');
  });

  it('normalizes unit ids and clone ids case-insensitively', () => {
    expect(resolveLineage(clones, '  FLASH_MK2 ').rootId).toBe('armflash');
  });
});

describe('useProjectDerivedData', () => {
  it('builds allUnitsList from the vanilla database with derived faction and tags', () => {
    const { result } = renderDerivedData();
    const list = result.current.allUnitsList;

    expect(list).toHaveLength(2);
    expect(list.map(unit => unit.id)).toEqual(['armflash', 'corak']);
    expect(list[0]).toMatchObject({
      name: 'Flash',
      desc: 'Fast raider.',
      baseDesc: 'Fast raider.',
      faction: 'arm',
      techTier: 't1',
      isClone: false,
    });
    expect(list[0].tags).toEqual(['vehicle', 't1']);
    expect(list[1].tags).toEqual(['bot', 't2']);
  });

  it('appends clones with inherited descriptions, faction, and root base id', () => {
    const { result } = renderDerivedData({
      clones: [{ newId: 'flash_mk2', baseId: 'armflash', displayName: 'Flash Mk2' }],
    });

    const clone = result.current.allUnitsList.find(unit => unit.id === 'flash_mk2');
    expect(clone).toMatchObject({
      name: 'Flash Mk2',
      desc: 'Cloned from Flash',
      baseDesc: 'Cloned from Flash',
      faction: 'arm',
      techTier: 't1',
      isClone: true,
      baseId: 'armflash',
      rootBaseId: 'armflash',
    });
  });

  it('applies customparams.techlevel tweaks as effective tech tier overrides', () => {
    const { result } = renderDerivedData({
      tweaks: { armflash: { 'customparams.techlevel': '3' } },
    });

    expect(result.current.getEffectiveTechTier('armflash')).toBe('t3');
    expect(result.current.getEffectiveTechTier('corak')).toBe('t2');
    expect(result.current.techTierOverrides.get('armflash')).toBe('3');
    expect(result.current.allUnitsList.find(unit => unit.id === 'armflash').techTier).toBe('t3');
  });

  it('inherits tweaks and weapon swaps along multi-level clone lineages', () => {
    const clones = [
      { newId: 'flash_mk2', baseId: 'armflash', weaponSwaps: { slot1: 'corllt' } },
      { newId: 'flash_mk3', baseId: 'flash_mk2', weaponSwaps: { slot2: 'armcir' } },
    ];
    const { result } = renderDerivedData({
      clones,
      tweaks: {
        flash_mk2: { health: '700' },
        flash_mk3: { health: '800', 'customparams.techlevel': '2' },
      },
    });

    expect(result.current.resolveCloneRootId('flash_mk3')).toBe('armflash');
    expect(result.current.getInheritedCloneTweaks('flash_mk3')).toEqual({
      health: '800',
      'customparams.techlevel': '2',
    });
    expect(result.current.getInheritedCloneWeaponSwaps('flash_mk3')).toEqual({
      slot1: 'corllt',
      slot2: 'armcir',
    });
    const mk3 = result.current.allUnitsList.find(unit => unit.id === 'flash_mk3');
    expect(mk3.techTier).toBe('t2');
    expect(mk3.rootBaseId).toBe('armflash');
  });

  it('prefers edited buildpics for project unit icons and falls back to the clone root', () => {
    setUnitArtworkManifest({
      units: { armflash: '/unitpics/armflash.png' },
      pictures: { 'custom_flash.png': '/buildpics/custom_flash.png' },
    });
    const { result } = renderDerivedData({
      clones: [{ newId: 'flash_mk2', baseId: 'armflash' }],
      tweaks: { armflash: { buildpic: 'custom_flash.png' } },
    });

    expect(result.current.getProjectUnitIconUrl('armflash')).toBe('/buildpics/custom_flash.png');
    expect(result.current.getProjectUnitIconUrl('flash_mk2')).toBe('/unitpics/armflash.png');
    setUnitArtworkManifest(null);
  });
});
