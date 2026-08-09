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
      expect.objectContaining({
        anchor: 'emit',
        sizeBasis: 'footprint',
        diameterRatio: 0.52,
      }),
    ]);
  });

  it('uses model-specific orb proportions instead of one fixed radius', () => {
    const advanced = getBarModelEffectProfile('units/armafus.s3o');
    const epic = getBarModelEffectProfile('units/armafust3.s3o');

    expect(advanced.proceduralEffects[0].diameterRatio).toBe(0.46);
    expect(epic.proceduralEffects[0].diameterRatio).toBeGreaterThan(
      advanced.proceduralEffects[0].diameterRatio,
    );
  });

  it('restores the large generated Cortex Fusion Reactor orb', () => {
    const profile = getBarModelEffectProfile('units/corfus.s3o');

    expect(profile.proceduralEffects).toEqual([
      expect.objectContaining({
        anchor: 'emit',
        sizeBasis: 'footprint',
        diameterRatio: 0.7,
      }),
    ]);
  });

  it('covers all six Elysium shield pieces explicitly', () => {
    const profile = getBarModelEffectProfile('Units/LEGGATET3.s3o');
    expect(profile.nodeEffects).toHaveLength(6);
    expect(getBarModelNodeEffect(profile, 'smallshield_3')).toBeTruthy();
  });

  it('does not infer effects for unverified model paths', () => {
    expect(getBarModelEffectProfile('Units/ARMPW.s3o')).toBeNull();
    expect(BAR_MODEL_EFFECT_PATHS.length).toBeGreaterThanOrEqual(14);
  });
});
