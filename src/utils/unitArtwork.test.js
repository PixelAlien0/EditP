import { describe, expect, it } from 'vitest';
import { getUnitIconUrl, setUnitArtworkManifest } from './unitArtwork.js';

describe('unit artwork manifest cache', () => {
  it('resolves known unit IDs without issuing guessed URLs', () => {
    setUnitArtworkManifest({ units: { armpw: '/unitpics/assets/example.webp' } });
    expect(getUnitIconUrl('ARMPW')).toBe('/unitpics/assets/example.webp');
    expect(getUnitIconUrl('unknown_unit')).toBe('/logo.svg');
  });
});
