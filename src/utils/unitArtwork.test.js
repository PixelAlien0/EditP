import { describe, expect, it } from 'vitest';
import { getBuildPictureOptions, getBuildPicturePreviewUrl, getUnitIconUrl, setUnitArtworkManifest } from './unitArtwork.js';

describe('unit artwork manifest cache', () => {
  it('resolves known unit IDs without issuing guessed URLs', () => {
    setUnitArtworkManifest({ units: { armpw: '/unitpics/assets/example.webp' } });
    expect(getUnitIconUrl('ARMPW')).toBe('/unitpics/assets/example.webp');
    expect(getUnitIconUrl('unknown_unit')).toBe('/logo.svg');
  });

  it('keeps duplicate build-picture filenames distinct by BAR namespace', () => {
    setUnitArtworkManifest({
      units: {},
      pictures: {
        'LEGRAIL.DDS': '/unitpics/assets/legion.webp',
        'scavengers/LEGRAIL.DDS': '/unitpics/assets/scavenger.webp',
      },
    });
    expect(getBuildPictureOptions()).toEqual(['LEGRAIL.DDS', 'scavengers/LEGRAIL.DDS']);
    expect(getBuildPicturePreviewUrl('legrail.dds')).toBe('/unitpics/assets/legion.webp');
    expect(getBuildPicturePreviewUrl('SCAVENGERS\\LEGRAIL.DDS')).toBe('/unitpics/assets/scavenger.webp');
  });
});
