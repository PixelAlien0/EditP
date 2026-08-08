import { describe, expect, it } from 'vitest';
import { getBuildPictureOptions, getBuildPicturePreviewUrl, getUnitIconUrl, setUnitArtworkManifest } from './unitArtwork.js';

describe('unit artwork manifest cache', () => {
  it('resolves known unit IDs without issuing guessed URLs', () => {
    setUnitArtworkManifest({ units: { armpw: '/unitpics/assets/example.webp' } });
    expect(getUnitIconUrl('ARMPW')).toBe('/unitpics/assets/example.webp');
    expect(getUnitIconUrl('unknown_unit')).toBe('/logo.svg');
  });

  it('rejects malformed manifest records instead of leaking objects into image sources', () => {
    setUnitArtworkManifest({
      units: {
        broken_unit: { assetPath: 'unitpics/broken.dds', resolved: true },
        remote_unit: 'https://example.invalid/unit.webp',
      },
      pictures: {
        'BROKEN.DDS': { assetPath: 'unitpics/broken.dds' },
      },
    });

    expect(getUnitIconUrl('broken_unit')).toBe('/logo.svg');
    expect(getUnitIconUrl('remote_unit')).toBe('/logo.svg');
    expect(getBuildPicturePreviewUrl('BROKEN.DDS')).toBe('');
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
