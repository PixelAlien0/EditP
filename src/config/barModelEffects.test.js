import { describe, expect, it } from 'vitest';
import {
  BAR_MODEL_EFFECT_PATHS,
  getBarModelEffectProfile,
  getBarModelNodeEffect,
} from './barModelEffects.js';

describe('BAR model effect registry', () => {
  it('restores the official Fusion Reactor ball meshes', () => {
    const profile = getBarModelEffectProfile('Units/ARMFUS.s3o');
    expect(getBarModelNodeEffect(profile, 'ball1')).toMatchObject({ color: '#77d9ff' });
    expect(getBarModelNodeEffect(profile, 'BALL2')).toBeTruthy();
  });

  it('creates advanced-fusion orbs from verified emit anchors', () => {
    const profile = getBarModelEffectProfile('units/ARMAFUST3.s3o');
    expect(profile.proceduralEffects).toEqual([
      expect.objectContaining({ anchor: 'emit', radiusFactor: 0.095 }),
    ]);
  });

  it('covers all six Elysium shield pieces explicitly', () => {
    const profile = getBarModelEffectProfile('Units/LEGGATET3.s3o');
    expect(profile.nodeEffects).toHaveLength(6);
    expect(getBarModelNodeEffect(profile, 'smallshield_3')).toBeTruthy();
  });

  it('does not infer effects for unverified model paths', () => {
    expect(getBarModelEffectProfile('Units/ARMPW.s3o')).toBeNull();
    expect(BAR_MODEL_EFFECT_PATHS.length).toBeGreaterThanOrEqual(13);
  });
});
