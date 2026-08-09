import { existsSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const ASSET_ROOT = 'public/bar-models/corak';

describe('BAR reference model assets', () => {
  it('ships a valid local GLB and every declared material map', () => {
    const manifest = JSON.parse(readFileSync(`${ASSET_ROOT}/manifest.json`, 'utf8'));
    const glb = readFileSync(`${ASSET_ROOT}/corak.glb`);

    expect(manifest.version).toBe(2);
    expect(manifest.model).toBe('/bar-models/corak/corak.glb');
    expect(glb.subarray(0, 4).toString('ascii')).toBe('glTF');

    Object.values(manifest.textures).forEach(assetUrl => {
      const assetPath = `public${assetUrl}`;
      expect(existsSync(assetPath)).toBe(true);
      expect(statSync(assetPath).size).toBeLessThan(200_000);
    });
  });

  it('keeps the complete reference preview below its deployment budget', () => {
    const files = [
      'corak.glb',
      'cor_color.webp',
      'cor_emissive.webp',
      'cor_normal.webp',
      'cor_pbr.webp',
      'cor_team.webp',
      'manifest.json',
    ];
    const totalBytes = files.reduce((total, file) => total + statSync(`${ASSET_ROOT}/${file}`).size, 0);

    expect(totalBytes).toBeLessThan(500_000);
  });
});
