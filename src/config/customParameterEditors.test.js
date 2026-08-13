import { describe, expect, it } from 'vitest';
import {
  buildCustomParameterReferenceCatalogs,
  getCustomParameterEditor,
} from './customParameterEditors.js';

describe('custom parameter editors', () => {
  it('selects controls from semantic parameter metadata', () => {
    expect(getCustomParameterEditor({ key: 'crashable', type: 'boolean' })).toEqual({ kind: 'boolean' });
    expect(getCustomParameterEditor({ key: 'scavsquadrarity', type: 'string', acceptedValues: ['basic', 'special'] })).toEqual({
      kind: 'enum',
      options: ['basic', 'special'],
    });
    expect(getCustomParameterEditor({ key: 'attacksafetydistance', type: 'number', min: 0, unit: 'elmos' })).toEqual({
      kind: 'number',
      min: 0,
      max: undefined,
      step: undefined,
      unit: 'elmos',
    });
    expect(getCustomParameterEditor({ key: 'unitgroup', type: 'string', sampleValues: ['weapon', 'builder'] })).toEqual({
      kind: 'suggested-text',
      options: ['weapon', 'builder'],
    });
    expect(getCustomParameterEditor({
      key: 'discovered_mode', type: 'string', sampleValues: ['legacy'], suggestedValues: ['roam', 'guard'],
    })).toEqual({
      kind: 'suggested-text',
      options: ['roam', 'guard'],
    });
  });

  it('uses dedicated reference and asset browsers only for known contracts', () => {
    expect(getCustomParameterEditor({ key: 'spawns_name', type: 'string' })).toEqual({ kind: 'reference', referenceType: 'unit' });
    expect(getCustomParameterEditor({ key: 'cluster_def', type: 'string' })).toEqual({ kind: 'reference', referenceType: 'weapon' });
    expect(getCustomParameterEditor({ key: 'normaltex', type: 'string' })).toEqual({ kind: 'asset', assetType: 'texture' });
    expect(getCustomParameterEditor({ key: 'package_owned_id', type: 'string' })).toEqual({ kind: 'text' });
  });

  it('builds deterministic UnitDef and WeaponDef reference catalogs', () => {
    const catalogs = buildCustomParameterReferenceCatalogs(
      [
        { id: 'corak', name: 'Grunt', faction: 'COR', techTier: 'T1' },
        { id: 'armck', name: 'Construction Bot', faction: 'ARM', techTier: 'T1' },
      ],
      {
        corak: { weaponSlots: [{ defKey: 'LASER' }] },
        armck: { weaponSlots: [{ defKey: 'laser' }, { defKey: 'NANO' }] },
      }
    );

    expect(catalogs.units.map(unit => unit.id)).toEqual(['armck', 'corak']);
    expect(catalogs.weapons).toEqual([
      expect.objectContaining({ id: 'laser', detail: '2 owning units · 2 mounted' }),
      expect.objectContaining({ id: 'nano', detail: '1 owning unit · 1 mounted' }),
    ]);
  });
});
