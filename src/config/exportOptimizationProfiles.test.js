import { describe, expect, it } from 'vitest';
import {
  EXPORT_OPTIMIZATION_PROFILES,
  getExportOptimizationPolicy,
  normalizeExportOptimizationProfile,
} from './exportOptimizationProfiles.js';

describe('export optimization profiles', () => {
  it('publishes stable safe, balanced, and maximum policies', () => {
    expect(EXPORT_OPTIMIZATION_PROFILES.map(profile => profile.id)).toEqual([
      'safe',
      'balanced',
      'maximum',
    ]);
    expect(getExportOptimizationPolicy('safe')).toMatchObject({
      compactGenerated: false,
      deduplicate: false,
      exportEnglishOnly: false,
    });
    expect(getExportOptimizationPolicy('maximum')).toMatchObject({
      compactGenerated: true,
      deduplicate: true,
      exportEnglishOnly: true,
    });
  });

  it('falls back to balanced for unknown or missing values', () => {
    expect(normalizeExportOptimizationProfile()).toBe('balanced');
    expect(normalizeExportOptimizationProfile('unknown')).toBe('balanced');
  });
});
