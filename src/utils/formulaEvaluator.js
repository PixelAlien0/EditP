/**
 * Safe Math Formula Evaluator for BAR Editor
 * Supports arithmetic (+, -, *, /, ^, %), math functions (floor, ceil, round, abs, min, max, sqrt, clamp),
 * and unit stat variables (health, speed, metalcost, energycost, buildtime, turnrate, sightdistance, radardistance, damage, range, reload, techTier).
 */

export const FORMULA_VARIABLES = [
  { id: 'health', label: 'Health (HP)', category: 'Durability' },
  { id: 'speed', label: 'Speed (elmos/s)', category: 'Mobility' },
  { id: 'metalcost', label: 'Metal Cost', category: 'Economy' },
  { id: 'energycost', label: 'Energy Cost', category: 'Economy' },
  { id: 'buildtime', label: 'Build Time', category: 'Economy' },
  { id: 'turnrate', label: 'Turn Rate', category: 'Mobility' },
  { id: 'sightdistance', label: 'Sight Distance', category: 'Sensors' },
  { id: 'radardistance', label: 'Radar Distance', category: 'Sensors' },
  { id: 'damage', label: 'Weapon Damage (Default)', category: 'Weapons' },
  { id: 'range', label: 'Weapon Range', category: 'Weapons' },
  { id: 'reload', label: 'Weapon Reload (s)', category: 'Weapons' },
  { id: 'techTier', label: 'Technology Tier (1, 2, 3, 4)', category: 'General' },
];

export const PRESET_FORMULAS = [
  {
    name: 'Raptor HP Scaling (1.5x)',
    property: 'health',
    formula: 'health * 1.5',
    description: 'Scale health by 1.5x across selected units.',
  },
  {
    name: 'NuttyB Metal Formula',
    property: 'metalcost',
    formula: 'floor(health * 0.75 / 1.5)',
    description: 'Recalculate metal cost relative to unit durability.',
  },
  {
    name: 'T3 Economy Boost (+20%)',
    property: 'energycost',
    formula: 'energycost * 1.2',
    description: 'Increase energy cost by 20%.',
  },
  {
    name: 'Minimum Speed Normalizer',
    property: 'speed',
    formula: 'max(45, speed * 1.1)',
    description: 'Boost speed by 10% with a floor minimum of 45.',
  },
  {
    name: 'Damage Multiplier (1.25x)',
    property: 'damage',
    formula: 'damage * 1.25',
    description: 'Increase weapon damage by 25%.',
  },
];

const MATH_FUNCTIONS = {
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  abs: Math.abs,
  sqrt: Math.sqrt,
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  clamp: (val, minVal, maxVal) => Math.min(Math.max(val, minVal), maxVal),
};

/**
 * Tokenize a formula string into safe tokens
 */
export function tokenizeFormula(expression) {
  const tokens = [];
  let i = 0;
  const str = String(expression || '').trim();

  while (i < str.length) {
    const char = str[i];

    if (/\s/.test(char)) {
      i++;
      continue;
    }

    if (/[0-9.]/.test(char)) {
      let numStr = '';
      while (i < str.length && /[0-9.]/.test(str[i])) {
        numStr += str[i];
        i++;
      }
      tokens.push({ type: 'number', value: parseFloat(numStr) });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let ident = '';
      while (i < str.length && /[a-zA-Z0-9_.]/.test(str[i])) {
        ident += str[i];
        i++;
      }
      tokens.push({ type: 'ident', value: ident });
      continue;
    }

    if ('+-*/%^(),'.includes(char)) {
      tokens.push({ type: 'op', value: char });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: "${char}"`);
  }

  return tokens;
}

/**
 * Parses tokens into an AST and evaluates safely
 */
export function evaluateFormulaTokens(tokens, context = {}) {
  let pos = 0;

  function peek() {
    return tokens[pos];
  }

  function consume(expectedValue) {
    const tok = tokens[pos];
    if (expectedValue && tok?.value !== expectedValue) {
      throw new Error(`Expected "${expectedValue}", got "${tok?.value || 'EOF'}"`);
    }
    pos++;
    return tok;
  }

  function parseExpression() {
    return parseAdditive();
  }

  function parseAdditive() {
    let left = parseMultiplicative();
    while (peek()?.type === 'op' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value;
      const right = parseMultiplicative();
      const l = left;
      const r = right;
      left = () => op === '+' ? l() + r() : l() - r();
    }
    return left;
  }

  function parseMultiplicative() {
    let left = parseExponent();
    while (peek()?.type === 'op' && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = consume().value;
      const right = parseExponent();
      const l = left;
      const r = right;
      left = () => {
        const rv = r();
        if (op === '/' && rv === 0) return 0;
        if (op === '*') return l() * rv;
        if (op === '/') return l() / rv;
        return l() % rv;
      };
    }
    return left;
  }

  function parseExponent() {
    let left = parsePrimary();
    while (peek()?.type === 'op' && peek().value === '^') {
      consume();
      const right = parsePrimary();
      const l = left;
      const r = right;
      left = () => Math.pow(l(), r());
    }
    return left;
  }

  function parsePrimary() {
    const tok = peek();
    if (!tok) throw new Error('Unexpected end of formula');

    if (tok.type === 'number') {
      consume();
      const val = tok.value;
      return () => val;
    }

    if (tok.type === 'op' && tok.value === '-') {
      consume();
      const expr = parsePrimary();
      return () => -expr();
    }

    if (tok.type === 'op' && tok.value === '(') {
      consume('(');
      const expr = parseExpression();
      consume(')');
      return expr;
    }

    if (tok.type === 'ident') {
      const name = consume().value;

      if (peek()?.type === 'op' && peek().value === '(') {
        consume('(');
        const args = [];
        if (peek()?.value !== ')') {
          args.push(parseExpression());
          while (peek()?.value === ',') {
            consume(',');
            args.push(parseExpression());
          }
        }
        consume(')');
        const fn = MATH_FUNCTIONS[name.toLowerCase()];
        if (!fn) throw new Error(`Unknown function "${name}"`);
        return () => {
          const evaluatedArgs = args.map(arg => arg());
          return fn(...evaluatedArgs);
        };
      }

      return () => {
        if (Object.prototype.hasOwnProperty.call(context, name)) {
          return Number(context[name]) || 0;
        }
        const lower = name.toLowerCase();
        if (Object.prototype.hasOwnProperty.call(context, lower)) {
          return Number(context[lower]) || 0;
        }
        return 0;
      };
    }

    throw new Error(`Unexpected token "${tok.value}"`);
  }

  const ast = parseExpression();
  if (pos < tokens.length) {
    throw new Error(`Unexpected trailing token "${tokens[pos].value}"`);
  }

  const result = ast();
  return Number.isFinite(result) ? result : 0;
}

/**
 * Validates a formula string and returns error string or null if valid
 */
export function validateFormula(expression) {
  if (!expression || !expression.trim()) return 'Formula expression is required.';
  try {
    const tokens = tokenizeFormula(expression);
    evaluateFormulaTokens(tokens, {
      health: 100,
      speed: 10,
      metalcost: 50,
      energycost: 100,
      buildtime: 500,
      turnrate: 500,
      sightdistance: 400,
      radardistance: 1000,
      damage: 50,
      range: 300,
      reload: 1.5,
      techTier: 1,
    });
    return null;
  } catch (err) {
    return err.message || 'Invalid math expression syntax.';
  }
}

/**
 * Extracts context variables for a unit
 */
export function getUnitFormulaContext(unitId, defaults = {}, tweaks = {}) {
  const unitTweaks = tweaks[unitId] || {};
  const slots = defaults.weaponSlots || [];
  const primaryWeapon = slots[0] || {};

  return {
    health: unitTweaks.health ?? defaults.health ?? 100,
    speed: unitTweaks.speed ?? defaults.speed ?? 0,
    metalcost: unitTweaks.metalcost ?? defaults.metalcost ?? 0,
    energycost: unitTweaks.energycost ?? defaults.energycost ?? 0,
    buildtime: unitTweaks.buildtime ?? defaults.buildtime ?? 0,
    turnrate: unitTweaks.turnrate ?? defaults.turnrate ?? 0,
    sightdistance: unitTweaks.sightdistance ?? defaults.sightdistance ?? 0,
    radardistance: unitTweaks.radardistance ?? defaults.radardistance ?? 0,
    damage: primaryWeapon.damage ?? 0,
    range: primaryWeapon.range ?? 0,
    reload: primaryWeapon.reload ?? 1,
    techTier: defaults.techTier ?? 1,
  };
}

/**
 * Evaluates formula for a specific unit attribute
 */
export function evaluateUnitFormula(property, expression, unitId, defaults = {}, tweaks = {}) {
  const context = getUnitFormulaContext(unitId, defaults, tweaks);
  const tokens = tokenizeFormula(expression);
  const rawValue = evaluateFormulaTokens(tokens, context);

  if (['health', 'metalcost', 'energycost', 'buildtime', 'turnrate', 'sightdistance', 'radardistance', 'damage', 'range'].includes(property)) {
    return Math.max(0, Math.round(rawValue));
  }
  return Math.max(0, Number(rawValue.toFixed(2)));
}
