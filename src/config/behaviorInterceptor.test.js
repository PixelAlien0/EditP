import { describe, expect, it } from 'vitest';
import {
  collectKnownTargetableMask,
  getInterceptionDiagnostics,
  getInterceptionRole,
  normalizeInterceptionMask,
  toggleInterceptionChannel,
} from './behaviorInterceptor.js';

describe('behavior and interceptor configuration', () => {
  it('normalizes and toggles interception bitmasks', () => {
    expect(normalizeInterceptionMask('5')).toBe(5);
    expect(normalizeInterceptionMask('-1')).toBe(0);
    expect(toggleInterceptionChannel(1, 4)).toBe(5);
    expect(toggleInterceptionChannel(5, 1)).toBe(4);
    expect(toggleInterceptionChannel(5, 3)).toBe(5);
  });

  it('classifies standard, targetable, interceptor, and dual-role weapons', () => {
    expect(getInterceptionRole(0, 0)).toBe('standard');
    expect(getInterceptionRole(1, 0)).toBe('targetable');
    expect(getInterceptionRole(0, 1)).toBe('interceptor');
    expect(getInterceptionRole(1, 1)).toBe('dual');
  });

  it('reports missing coverage and masks that cannot match known projectiles', () => {
    const result = getInterceptionDiagnostics({ interceptor: 2, targetable: 0, coverage: 0, range: 900, knownTargetableMask: 1 });
    expect(result.messages).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'coverage-missing', level: 'error' }),
      expect.objectContaining({ code: 'no-known-match', level: 'warning' }),
    ]));
  });

  it('recognizes coherent and dual-role configurations', () => {
    const ready = getInterceptionDiagnostics({ interceptor: 1, targetable: 0, coverage: 1600, range: 1200, knownTargetableMask: 1 });
    expect(ready.messages).toEqual([expect.objectContaining({ code: 'ready', level: 'success' })]);

    const dual = getInterceptionDiagnostics({ interceptor: 1, targetable: 1, coverage: 1600, range: 1200, knownTargetableMask: 1 });
    expect(dual.messages).toEqual([expect.objectContaining({ code: 'self-compatible', level: 'info' })]);
  });

  it('collects targetable channels from the bundled definition shape', () => {
    expect(collectKnownTargetableMask({
      alpha: { weaponSlots: [{ targetable: 1 }, { targetable: 4 }] },
      beta: { weaponSlots: [{ targetable: 2 }] },
    })).toBe(7);
  });
});
