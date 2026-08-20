import { describe, expect, it } from 'vitest';
import {
  MOTION_TIMING,
  MOTION_TRANSITION,
  MOTION_VARIANTS,
} from './motionConfig.js';

describe('shared motion configuration', () => {
  it('keeps timed interaction transitions compact', () => {
    expect(Math.max(...Object.values(MOTION_TIMING))).toBeLessThanOrEqual(0.2);
  });

  it('builds named transitions from canonical timing tokens', () => {
    expect(MOTION_TRANSITION.feedback.duration).toBe(MOTION_TIMING.feedback);
    expect(MOTION_TRANSITION.enter.duration).toBe(MOTION_TIMING.enter);
    expect(MOTION_TRANSITION.exit.duration).toBe(MOTION_TIMING.exit);
  });

  it('limits shared variants to compositor-friendly properties', () => {
    const allowed = new Set(['opacity', 'x', 'y', 'scale']);
    Object.values(MOTION_VARIANTS).forEach(variant => {
      Object.values(variant).forEach(target => {
        Object.keys(target).forEach(property => expect(allowed.has(property)).toBe(true));
      });
    });
  });
});
