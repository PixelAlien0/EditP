export const ARMOR_DAMAGE_KEY_PREFIX = 'damage_profile__';
export const ARMOR_PROFILE_PATTERN = /^[a-z_][a-z0-9_]*$/;

export const BUILTIN_ARMOR_PROFILES = Object.freeze([
  'default',
  'commanders',
  'vtol',
  'subs',
  'shields',
  'scavboss',
  'raptorqueen',
  'raptor',
  'mines',
]);

export function normalizeArmorProfile(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '');
}

export function isValidArmorProfile(value) {
  return ARMOR_PROFILE_PATTERN.test(String(value || ''));
}

export function getArmorDamageParameterKey(profile) {
  const normalized = normalizeArmorProfile(profile);
  return isValidArmorProfile(normalized) ? `${ARMOR_DAMAGE_KEY_PREFIX}${normalized}` : '';
}

export function getArmorProfileFromDamageKey(key) {
  if (!String(key || '').startsWith(ARMOR_DAMAGE_KEY_PREFIX)) return '';
  const profile = String(key).slice(ARMOR_DAMAGE_KEY_PREFIX.length);
  return isValidArmorProfile(profile) ? profile : '';
}

export function isArmorDamageParameterKey(key) {
  return Boolean(getArmorProfileFromDamageKey(key));
}

export function createArmorDamageParameter(profile) {
  const normalized = normalizeArmorProfile(profile);
  if (!isValidArmorProfile(normalized)) return null;
  return Object.freeze({
    key: getArmorDamageParameterKey(normalized),
    label: `Damage vs ${normalized.replaceAll('_', ' ')}`,
    description: `Damage applied to units whose customparams.armordef is "${normalized}".`,
    type: 'number',
    valueType: 'number',
    acceptedTypes: ['number'],
    path: `damage.${normalized}`,
    compileTarget: 'weapondef',
    surface: 'armor-profile',
    capabilities: Object.freeze(['tweak-defined']),
  });
}

export function collectArmorDamageProfiles(values = {}) {
  return Object.keys(values)
    .map(getArmorProfileFromDamageKey)
    .filter(Boolean)
    .sort();
}
