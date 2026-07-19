import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PARAMETER_BY_KEY,
  CUSTOM_PARAMETER_CATALOG,
  coerceCustomParameterValue,
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
    expect(coerceCustomParameterValue(' hello ', 'string')).toBe('hello');
  });
});
