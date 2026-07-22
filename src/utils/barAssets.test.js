import { describe, expect, it } from 'vitest';
import {
  getAssetManifestMetadata,
  getAssetOptionMetadata,
  getAssetOptions,
  getAssetPreviewUrl,
  isKnownBarAsset,
  loadAssetPreviewCatalog
} from './barAssets.js';

describe('BAR asset manifest', () => {
  it('contains deterministic source metadata and the required asset categories', () => {
    expect(getAssetManifestMetadata().sourceRepository).toBe('beyond-all-reason/Beyond-All-Reason');
    for (const category of ['unitModel', 'unitScript', 'buildPicture', 'iconType', 'collisionVolumeType', 'projectileModel', 'sound', 'ceg']) {
      expect(getAssetOptions(category).length).toBeGreaterThan(0);
    }
  });

  it('matches BAR asset references case-insensitively without accepting arbitrary paths', () => {
    const model = getAssetOptions('unitModel')[0];
    expect(isKnownBarAsset('unitModel', model.toUpperCase())).toBe(true);
    expect(isKnownBarAsset('unitModel', 'my_mod/missing-model.s3o')).toBe(false);
  });

  it('contains no duplicate names inside a category', () => {
    for (const category of ['unitModel', 'unitScript', 'sound', 'ceg']) {
      const values = getAssetOptions(category);
      expect(new Set(values.map(value => value.toLowerCase())).size).toBe(values.length);
    }
  });

  it('provides the complete visual BAR tactical icon catalog', async () => {
    const icons = getAssetOptions('iconType');
    expect(icons.length).toBeGreaterThan(900);
    expect(icons).toContain('armap');
    expect(isKnownBarAsset('iconType', 'ARMAP')).toBe(true);
    await loadAssetPreviewCatalog('iconType');
    expect(getAssetPreviewUrl('iconType', 'armap')).toMatch(/^\/tactical-icons\/assets\/[a-f0-9]{20}\.png$/);
    expect(getAssetOptionMetadata('iconType', 'armap')).toMatchObject({
      bitmap: 'icons/factory_air.png'
    });
  });
});
