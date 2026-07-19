export const LEGACY_PROJECT_FIELDS = Object.freeze({
  tweaks: ['bmf_tweaks', 'json'],
  clones: ['bmf_clones', 'json'],
  disabledUnitIds: ['bmf_disabled', 'json'],
  unitDescriptions: ['bmf_descriptions', 'json'],
  buildMenuSteps: ['bmf_buildmenu_steps', 'json'],
  buildMenuPacks: ['bmf_buildmenu_packs', 'packs'],
  presets: ['bmf_presets', 'json'],
  weaponLibrary: ['bmf_weapon_library', 'json'],
  unitCollections: ['bmf_unit_collections', 'json'],
  projectName: ['bmf_project_name', 'name'],
  projectAuthor: ['bmf_project_author', 'string'],
  projectDesc: ['bmf_project_desc', 'string'],
  includeTweaks: ['bmf_inc_tweaks', 'boolean'],
  includeClones: ['bmf_inc_clones', 'boolean'],
  includeRosters: ['bmf_inc_rosters', 'boolean'],
  includeHeader: ['bmf_inc_header', 'boolean'],
});

function readValue(field, fallback, storage) {
  const legacyField = LEGACY_PROJECT_FIELDS[field];
  if (!legacyField) return fallback;
  const [key, kind] = legacyField;
  try {
    const raw = storage.getItem(key);
    if (raw === null) return fallback;
    if (kind === 'json') return JSON.parse(raw);
    if (kind === 'boolean') return raw === 'true';
    if (kind === 'name') return raw === 'BAR EDITP Mod' ? fallback : raw;
    if (kind === 'packs') {
      const parsed = JSON.parse(raw || '{}');
      return { extraUnits: Boolean(parsed.extraUnits), scavengerUnits: Boolean(parsed.scavengerUnits) };
    }
    return raw || fallback;
  } catch {
    return fallback;
  }
}

export function loadLegacyProjectState(defaults, storage = globalThis.localStorage) {
  if (!storage) return { ...defaults };
  return Object.fromEntries(Object.entries(defaults).map(([field, fallback]) => [
    field,
    readValue(field, fallback, storage),
  ]));
}

export function persistLegacyProjectState(state, storage = globalThis.localStorage) {
  if (!storage) throw new Error('Legacy project storage is unavailable.');
  Object.entries(LEGACY_PROJECT_FIELDS).forEach(([field, [key]]) => {
    const value = state[field];
    if (field === 'unitDescriptions' && Object.keys(value || {}).length === 0) {
      storage.removeItem(key);
      return;
    }
    storage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
}

export function clearLegacyProjectState(storage = globalThis.localStorage) {
  if (!storage) return;
  Object.values(LEGACY_PROJECT_FIELDS).forEach(([key]) => {
    try {
      storage.removeItem(key);
    } catch {
      // IndexedDB remains canonical even when old storage cannot be cleaned up.
    }
  });
}
