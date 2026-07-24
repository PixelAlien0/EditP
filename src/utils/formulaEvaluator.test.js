import { describe, expect, it } from 'vitest';
import {
  evaluateFormulaTokens,
  evaluateUnitFormula,
  tokenizeFormula,
  validateFormula,
} from './formulaEvaluator.js';

describe('formulaEvaluator', () => {
  it('tokenizes basic arithmetic and identifiers correctly', () => {
    const tokens = tokenizeFormula('floor(health * 1.5 + 50)');
    expect(tokens.map(t => t.value || t.type)).toEqual([
      'floor', '(', 'health', '*', 1.5, '+', 50, ')'
    ]);
  });

  it('evaluates arithmetic expressions with context variables', () => {
    const tokens = tokenizeFormula('health * 1.5');
    const result = evaluateFormulaTokens(tokens, { health: 200 });
    expect(result).toBe(300);
  });

  it('handles Math functions such as floor, max, and clamp', () => {
    const tokens = tokenizeFormula('floor(max(10, health * 0.75 / 1.5))');
    const result = evaluateFormulaTokens(tokens, { health: 350 });
    expect(result).toBe(175);
  });

  it('validates syntax errors gracefully', () => {
    expect(validateFormula('health * 1.5')).toBeNull();
    expect(validateFormula('health * ')).toBe('Unexpected end of formula');
    expect(validateFormula('unknown_func(100)')).toBe('Unknown function "unknown_func"');
  });

  it('evaluates unit stat formula correctly with defaults and tweaks', () => {
    const defaults = { health: 1000, metalcost: 300 };
    const tweaks = { armflea: { health: 1200 } };
    const resHP = evaluateUnitFormula('health', 'health * 1.5', 'armflea', defaults, tweaks);
    expect(resHP).toBe(1800);

    const resMetal = evaluateUnitFormula('metalcost', 'floor(health * 0.75 / 1.5)', 'armflea', defaults, tweaks);
    expect(resMetal).toBe(600);
  });
});
