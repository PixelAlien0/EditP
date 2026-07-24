import { describe, expect, it, vi } from 'vitest';

vi.mock('./barAssets.js', () => ({
  ASSET_TYPE_LABELS: {
    unitModel: 'Unit models', unitScript: 'Unit scripts', buildPicture: 'Build pictures', iconType: 'Icon types',
    collisionVolumeType: 'Collision volume types', projectileModel: 'Projectile models', sound: 'Sounds', ceg: 'CEGs', texture: 'Textures',
  },
  getAssetManifestMetadata: () => ({ version: 1, sourceRepository: 'BAR', sourceCommit: 'abc123' }),
  getAssetOptions: category => ({
    unitModel: ['Units/alpha.s3o'], unitScript: ['Units/alpha.cob'], buildPicture: ['ALPHA.DDS'], iconType: [], collisionVolumeType: [],
    projectileModel: ['rocket.s3o'], sound: ['launch'], ceg: ['custom:impact'], texture: [],
  }[category] || []),
  getAssetPreviewUrl: (category, value) => category === 'buildPicture' ? `/preview/${value}` : '',
}));

vi.mock('./unitArtwork.js', () => ({ getUnitIconUrl: id => `/units/${id}.webp` }));

import { buildBarReferenceCatalog, filterBarReferences } from './barReferenceLibrary.js';

const fixture = {
  units: [{ id: 'alpha', name: 'Alpha', description: 'Test unit', faction: 'arm', techTier: 2, tags: ['bots'] }],
  defaultsDb: {
    alpha: {
      health: 1000, objectname: 'Units/alpha.s3o', script: 'Units/alpha.cob', buildpic: 'ALPHA.DDS',
      explodeas: 'alpha_boom',
      weaponSlots: [{ slot: 1, defKey: 'alpha_rocket', damage: 100, range: 500, model: 'rocket.s3o', soundstart: 'launch', explosiongenerator: 'custom:impact' }],
    },
  },
  explosionProfiles: { alpha_boom: { damage: { default: 250 }, areaofeffect: 96, explosiongenerator: 'custom:impact' } },
};

describe('BAR reference library', () => {
  it('normalizes units, mounted weapons, explosions, and assets into one catalog', () => {
    const catalog = buildBarReferenceCatalog(fixture);
    expect(catalog.counts.unit).toBe(1);
    expect(catalog.counts.weapon).toBe(1);
    expect(catalog.counts.explosionProfile).toBe(1);
    expect(catalog.items.find(item => item.id === 'asset:unitModel:units/alpha.s3o')?.usedBy).toEqual([
      expect.objectContaining({ id: 'unit:alpha' }),
    ]);
    expect(catalog.items.find(item => item.id === 'asset:ceg:custom:impact')?.usedBy).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: 'weapon' }),
      expect.objectContaining({ category: 'explosionProfile' }),
    ]));
  });

  it('searches exact values and reverse usage relationships', () => {
    const { items } = buildBarReferenceCatalog(fixture);
    expect(filterBarReferences(items, { query: 'alpha_rocket' }).map(item => item.category)).toContain('weapon');
    expect(filterBarReferences(items, { category: 'unitModel', query: 'Alpha' })).toHaveLength(1);
    expect(filterBarReferences(items, { category: 'sound', usedOnly: true })).toHaveLength(1);
    expect(filterBarReferences(items, { category: 'texture', usedOnly: true })).toHaveLength(0);
    expect(filterBarReferences(items, { faction: 'arm' })).toHaveLength(2);
    expect(filterBarReferences(items, { faction: 'core' })).toHaveLength(0);
    expect(filterBarReferences(items, { sortBy: 'usage-desc' })[0].id).toBe('asset:ceg:custom:impact');
  });
});
