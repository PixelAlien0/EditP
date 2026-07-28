import { describe, expect, it } from 'vitest';
import { getTagsOfUnit, mergeDerivedCategoryTags } from './categories.js';

describe('unit classification', () => {
  it('derives aircraft from engine movement data when a snapshot tag is absent', () => {
    expect(mergeDerivedCategoryTags(['t2'], { cruisealt: 160 })).toEqual(['aircraft', 't2']);
    expect(mergeDerivedCategoryTags(['factories', 't1'], { cruisealt: 75 })).toEqual([
      'factories',
      'aircraft',
      't1',
    ]);
  });

  it('does not misclassify grounded units or duplicate aircraft tags', () => {
    expect(mergeDerivedCategoryTags(['vehicles', 't1'], { maxvelocity: 90 })).toEqual([
      'vehicles',
      't1',
    ]);
    expect(mergeDerivedCategoryTags(['aircraft', 't2'], { cruisealt: 100 })).toEqual([
      'aircraft',
      't2',
    ]);
  });

  it('exposes standard Legion aircraft through the editor tag resolver', () => {
    expect(getTagsOfUnit('legfig', { legfig: { cruisealt: 125 } })).toContain('aircraft');
    expect(getTagsOfUnit('legphoenix', { legphoenix: { cruisealt: 220 } })).toContain('aircraft');
  });
});
