export const CUSTOM_PARAMETER_KEY_PATTERN = /^[a-z_][a-z0-9_]*$/;

export function normalizeCustomParameterKey(value) {
  return String(value || '').trim().toLowerCase();
}

export function isValidCustomParameterKey(value) {
  return CUSTOM_PARAMETER_KEY_PATTERN.test(normalizeCustomParameterKey(value));
}
