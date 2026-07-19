export const CUSTOM_PARAMETER_KEY_PATTERN = /^[a-z_][a-z0-9_]*$/;

export const CUSTOM_PARAMETER_CATALOG = Object.freeze([
  {
    key: 'armordef', label: 'Armor Definition', type: 'string', owner: 'Package-specific',
    description: 'Optional armor-table identifier. Only has an effect when the loaded game or package consumes this key.'
  },
  {
    key: 'restrictions_exclusion', label: 'Restriction Exclusion', type: 'string', owner: 'BAR gadget',
    description: 'Exempts this unit from a named BAR unit-restriction group, for example _noantinuke_.'
  },
  {
    key: 'crashable', label: 'Crashable', type: 'boolean', owner: 'BAR gadget',
    description: 'Controls whether BAR aircraft-crash handling may turn the unit into a crashing wreck.'
  },
  {
    key: 'fall_damage_multiplier', label: 'Fall Damage Multiplier', type: 'number', owner: 'BAR gadget',
    description: 'Multiplies damage applied by BAR fall-impact handling. Zero disables that additional damage.'
  },
  {
    key: 'water_fall_damage_multiplier', label: 'Water Fall Damage Multiplier', type: 'number', owner: 'BAR gadget',
    description: 'Multiplies BAR fall-impact damage when the landing occurs in water.'
  },
  {
    key: 'unitgroup', label: 'Unit Group', type: 'string', owner: 'BAR convention',
    description: 'BAR role classification used by UI, targeting, restrictions, and supporting gadgets.'
  },
  {
    key: 'ignore_noair', label: 'Ignore No-Air Restriction', type: 'boolean', owner: 'Package-specific',
    description: 'Package convention for bypassing a no-air restriction. It requires code that explicitly reads the key.'
  },
  {
    key: 'attacksafetydistance', label: 'Attack Safety Distance', type: 'number', owner: 'BAR gadget',
    description: 'Minimum safety distance used by BAR attack behavior for units whose own attack may be dangerous.'
  },
  {
    key: 'overrange_distance', label: 'Overrange Distance', type: 'number', owner: 'BAR gadget',
    description: 'Extra distance consumed by BAR overrange projectile behavior. This does not replace the WeaponDef range.'
  },
  {
    key: 'paralyzemultiplier', label: 'Paralyze Multiplier', type: 'number', owner: 'BAR gadget',
    description: 'BAR-specific multiplier for paralysis received or applied by supporting EMP logic.'
  },
  {
    key: 'removestop', label: 'Remove Stop Command', type: 'boolean', owner: 'BAR UI convention',
    description: 'Asks BAR command UI logic to hide the Stop command for this unit.'
  },
  {
    key: 'maxrange', label: 'Reported Maximum Range', type: 'number', owner: 'BAR UI convention',
    description: 'Range hint used by BAR presentation and supporting logic. It does not change a WeaponDef range by itself.'
  }
]);

export const CUSTOM_PARAMETER_BY_KEY = new Map(CUSTOM_PARAMETER_CATALOG.map(parameter => [parameter.key, parameter]));

export function normalizeCustomParameterKey(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidCustomParameterKey(value) {
  return CUSTOM_PARAMETER_KEY_PATTERN.test(normalizeCustomParameterKey(value));
}

export function coerceCustomParameterValue(value, type) {
  if (type === 'boolean') return value === true || value === 'true';
  if (type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return String(value ?? '').trim();
}
