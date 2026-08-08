import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PARAMETER_BY_KEY,
  CUSTOM_PARAMETER_CATALOG,
  CUSTOM_PARAMETER_DISCOVERY,
  CUSTOM_PARAMETER_REGISTRY,
  coerceCustomParameterValue,
  getCustomParameterDefinition,
  getCustomParameterObservation,
  isValidCustomParameterKey,
  normalizeCustomParameterKey
} from './customParameters.js';

describe('advanced custom parameter metadata', () => {
  it('defines unique, valid lowercase keys with an ownership label', () => {
    expect(new Set(CUSTOM_PARAMETER_CATALOG.map(parameter => parameter.key)).size).toBe(CUSTOM_PARAMETER_CATALOG.length);
    for (const parameter of CUSTOM_PARAMETER_CATALOG) {
      expect(isValidCustomParameterKey(parameter.key)).toBe(true);
      expect(parameter.owner).toBeTruthy();
      expect(CUSTOM_PARAMETER_BY_KEY.get(parameter.key)).toBe(parameter);
    }
  });

  it('merges documented metadata with the pinned BAR discovery snapshot', () => {
    expect(CUSTOM_PARAMETER_DISCOVERY.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.unitParameters).toBeGreaterThan(100);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.weaponParameters).toBeGreaterThan(50);
    expect(new Set(CUSTOM_PARAMETER_REGISTRY.map(parameter => parameter.id)).size).toBe(CUSTOM_PARAMETER_REGISTRY.length);

    const unitGroup = getCustomParameterDefinition('unitgroup', 'unit');
    expect(unitGroup).toMatchObject({ scope: 'unit', owner: 'BAR convention', observed: true });
    expect(getCustomParameterObservation('unitgroup', 'unit')?.occurrences).toBeGreaterThan(0);

    const cluster = getCustomParameterDefinition('cluster_def', 'weapon');
    expect(cluster).toMatchObject({ scope: 'weapon', editorKey: 'cluster_def' });
  });

  it('normalizes safe custom keys and rejects Lua paths or expressions', () => {
    expect(normalizeCustomParameterKey('  My_Key  ')).toBe('my_key');
    expect(isValidCustomParameterKey('my_key_2')).toBe(true);
    expect(isValidCustomParameterKey('weapondefs.bad')).toBe(false);
    expect(isValidCustomParameterKey('x[1]')).toBe(false);
  });

  it('coerces supported scalar values without evaluating input', () => {
    expect(coerceCustomParameterValue('12.5', 'number')).toBe(12.5);
    expect(coerceCustomParameterValue('not-a-number', 'number')).toBeUndefined();
    expect(coerceCustomParameterValue('true', 'boolean')).toBe(true);
    expect(coerceCustomParameterValue('1', 'boolean')).toBe(true);
    expect(coerceCustomParameterValue('0', 'boolean')).toBe(false);
    expect(coerceCustomParameterValue('maybe', 'boolean')).toBeUndefined();
    expect(coerceCustomParameterValue(' hello ', 'string')).toBe('hello');
  });
});
