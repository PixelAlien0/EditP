import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BAR_MODEL_ENTRIES,
  BAR_MODEL_MANIFEST,
  getBarModelEntry,
  getBarModelEntryByPath,
  getBarModelEntryForReference,
} from './barModelLibrary.js';

const ASSET_ROOT = 'public/bar-models';

describe('BAR reference model assets', () => {
  it('ships a valid local GLB and material set for every supported unit', () => {
    const publicManifest = JSON.parse(readFileSync(`${ASSET_ROOT}/manifest.json`, 'utf8'));
    expect(publicManifest).toEqual(BAR_MODEL_MANIFEST);
    expect(BAR_MODEL_MANIFEST.version).toBe(3);
    expect(BAR_MODEL_ENTRIES).toHaveLength(10);

    BAR_MODEL_ENTRIES.forEach(entry => {
      const glb = readFileSync(`public${entry.model}`);
      expect(glb.subarray(0, 4).toString('ascii')).toBe('glTF');
      expect(glb.byteLength).toBe(entry.modelBytes);
      expect(glb.byteLength).toBeLessThanOrEqual(BAR_MODEL_MANIFEST.settings.maxModelBytes);
      Object.values(entry.textures).filter(value => typeof value === 'string' && value.startsWith('/')).forEach(assetUrl => {
        expect(existsSync(`public${assetUrl}`)).toBe(true);
      });
    });
  });

  it('contains no duplicate or orphaned content-addressed assets', () => {
    const referenced = new Set();
    BAR_MODEL_ENTRIES.forEach(entry => {
      referenced.add(entry.model.split('/').at(-1));
      Object.values(entry.textures).filter(value => typeof value === 'string' && value.startsWith('/')).forEach(value => referenced.add(value.split('/').at(-1)));
    });
    const shipped = readdirSync(`${ASSET_ROOT}/assets`).sort();
    expect(shipped).toEqual([...referenced].sort());
    expect(shipped).toHaveLength(BAR_MODEL_MANIFEST.coverage.uniqueAssets);

    const totalBytes = shipped.reduce((total, file) => total + statSync(`${ASSET_ROOT}/assets/${file}`).size, 0);
    expect(totalBytes).toBe(BAR_MODEL_MANIFEST.coverage.totalBytes);
    expect(totalBytes).toBeLessThanOrEqual(BAR_MODEL_MANIFEST.settings.maxLibraryBytes);
  });

  it('resolves unit and model references through the canonical manifest', () => {
    expect(getBarModelEntry('ARMFAV')?.name).toBe('Rover');
    expect(getBarModelEntryByPath('Units\\CORAK.s3o')?.unitId).toBe('corak');
    expect(getBarModelEntryForReference({ category: 'unit', value: 'legcom' })?.role).toBe('Commander');
    expect(getBarModelEntryForReference({ category: 'sound', value: 'cannhvy1' })).toBeNull();
  });
});
