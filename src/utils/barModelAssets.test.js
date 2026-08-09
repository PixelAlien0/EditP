import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import unitDefaults from '../data/unit-defaults.json';
import {
  BAR_MODEL_ENTRIES,
  BAR_MODEL_MANIFEST,
  getBarModelEntry,
  getBarModelEntryByPath,
  getBarModelEntryForReference,
  getBarModelFallbackByPath,
} from './barModelLibrary.js';

const ASSET_ROOT = 'public/bar-models';
const normalizePath = value => String(value || '').replace(/\\/g, '/').toLowerCase();

describe('BAR reference model assets', () => {
  it('accounts for every model in the pinned BAR snapshot', () => {
    const publicManifest = JSON.parse(readFileSync(`${ASSET_ROOT}/manifest.json`, 'utf8'));
    expect(publicManifest).toEqual(BAR_MODEL_MANIFEST);
    expect(BAR_MODEL_MANIFEST.version).toBe(6);
    expect(BAR_MODEL_ENTRIES).toHaveLength(BAR_MODEL_MANIFEST.coverage.supported);
    expect(BAR_MODEL_MANIFEST.coverage.supported).toBeGreaterThan(800);
    expect(BAR_MODEL_MANIFEST.coverage.uniqueModelPaths).toBe(
      BAR_MODEL_MANIFEST.coverage.supported + BAR_MODEL_MANIFEST.coverage.unsupported,
    );

    Object.entries(unitDefaults).forEach(([unitId, definition]) => {
      if (!definition.objectname) return;
      const modelPath = normalizePath(definition.objectname);
      const supported = getBarModelEntry(unitId);
      const fallback = getBarModelFallbackByPath(modelPath);
      expect(Boolean(supported) || Boolean(fallback)).toBe(true);
    });
  });

  it('streams official GLBs and only ships deduplicated material textures locally', () => {
    BAR_MODEL_ENTRIES.forEach(entry => {
      expect(entry.model).toMatch(/^\/bar-model-cdn\/glb\/[a-z0-9_]+\.glb\?snapshot=[a-f0-9]{12}$/);
      expect(entry.sourceUrl).toMatch(/^https:\/\/pub-[^/]+\.r2\.dev\/glb\//);
      expect(entry.materialMode).toMatch(/^(bar-pbr|native)$/);
      if (entry.materialMode === 'bar-pbr') {
        Object.values(entry.textures)
          .filter(value => typeof value === 'string' && value.startsWith('/'))
          .forEach(assetUrl => expect(existsSync(`public${assetUrl}`)).toBe(true));
      } else {
        expect(entry.textures).toBeNull();
      }
    });

    const referenced = new Set();
    BAR_MODEL_ENTRIES.forEach(entry => Object.values(entry.textures || {})
      .filter(value => typeof value === 'string' && value.startsWith('/'))
      .forEach(value => referenced.add(value.split('/').at(-1))));
    const shipped = readdirSync(`${ASSET_ROOT}/assets`).sort();
    expect(shipped).toEqual([...referenced].sort());
    expect(shipped.every(file => file.endsWith('.webp'))).toBe(true);
    expect(shipped).toHaveLength(BAR_MODEL_MANIFEST.coverage.uniqueLocalAssets);

    const totalBytes = shipped.reduce((total, file) => total + statSync(`${ASSET_ROOT}/assets/${file}`).size, 0);
    expect(totalBytes).toBe(BAR_MODEL_MANIFEST.coverage.localAssetBytes);
    expect(totalBytes).toBeLessThanOrEqual(BAR_MODEL_MANIFEST.settings.maxLibraryBytes);
  });

  it('resolves unit aliases and model references through the canonical manifest', () => {
    expect(getBarModelEntry('ARMFAV')?.name).toBe('Rover');
    expect(getBarModelEntry('scav_legsrail')?.modelPath).toBe('units/legsrail.s3o');
    expect(getBarModelEntryByPath('Units\\CORAK.s3o')?.unitId).toBe('corak');
    expect(getBarModelEntryForReference({ category: 'unit', value: 'legcom' })?.role).toBe('Commander');
    expect(getBarModelEntryForReference({ category: 'sound', value: 'cannhvy1' })).toBeNull();
  });

  it('uses discovered BAR materials for Raptor models instead of native flat shading', () => {
    const raptor = getBarModelEntry('raptor_land_swarmer_basic_t1_v1');
    expect(raptor?.materialMode).toBe('bar-pbr');
    expect(raptor?.textureFamily).toMatch(/^model-[a-f0-9]{12}$/);
    expect(raptor?.textures?.color).toMatch(/^\/bar-models\/assets\/[a-f0-9]{20}\.webp$/);
    expect(BAR_MODEL_MANIFEST.coverage.discoveredMaterialModels).toBeGreaterThan(100);
    expect(BAR_MODEL_MANIFEST.coverage.discoveredTextureFamilies).toBeGreaterThan(35);
  });
});
