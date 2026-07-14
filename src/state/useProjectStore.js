import { useCallback, useMemo, useReducer } from 'react';

export const PROJECT_STORE_DEFAULTS = Object.freeze({
  tweaks: {},
  clones: [],
  disabledUnitIds: [],
  unitDescriptions: {},
  buildMenuSteps: [],
  buildMenuPacks: { extraUnits: false, scavengerUnits: false },
  presets: [],
  weaponLibrary: [],
  projectName: 'BAR Editor Mod',
  projectAuthor: 'Developer',
  projectDesc: 'A custom unit configuration mod.',
  includeTweaks: true,
  includeClones: true,
  includeRosters: true,
  includeHeader: true,
});

const STORAGE_FIELDS = {
  tweaks: ['bmf_tweaks', 'json'], clones: ['bmf_clones', 'json'],
  disabledUnitIds: ['bmf_disabled', 'json'], unitDescriptions: ['bmf_descriptions', 'json'],
  buildMenuSteps: ['bmf_buildmenu_steps', 'json'], buildMenuPacks: ['bmf_buildmenu_packs', 'packs'],
  presets: ['bmf_presets', 'json'], weaponLibrary: ['bmf_weapon_library', 'json'],
  projectName: ['bmf_project_name', 'name'], projectAuthor: ['bmf_project_author', 'string'],
  projectDesc: ['bmf_project_desc', 'string'], includeTweaks: ['bmf_inc_tweaks', 'boolean'],
  includeClones: ['bmf_inc_clones', 'boolean'], includeRosters: ['bmf_inc_rosters', 'boolean'],
  includeHeader: ['bmf_inc_header', 'boolean'],
};

function readLegacyValue(field, fallback) {
  if (typeof localStorage === 'undefined') return fallback;
  const [key, kind] = STORAGE_FIELDS[field];
  try {
    const raw = localStorage.getItem(key);
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

export function loadLegacyProjectState() {
  return Object.fromEntries(Object.entries(PROJECT_STORE_DEFAULTS).map(([field, fallback]) => [
    field,
    readLegacyValue(field, fallback),
  ]));
}

export function projectStoreReducer(state, action) {
  if (action.type === 'set-field') {
    if (!(action.field in PROJECT_STORE_DEFAULTS)) return state;
    const current = state[action.field];
    const next = typeof action.value === 'function' ? action.value(current) : action.value;
    return Object.is(current, next) ? state : { ...state, [action.field]: next };
  }
  if (action.type === 'hydrate') return { ...state, ...action.value };
  if (action.type === 'reset') return { ...PROJECT_STORE_DEFAULTS };
  return state;
}

export function useProjectStore() {
  const [state, dispatch] = useReducer(projectStoreReducer, undefined, loadLegacyProjectState);
  const setField = useCallback((field, value) => dispatch({ type: 'set-field', field, value }), []);
  const setters = useMemo(() => Object.keys(PROJECT_STORE_DEFAULTS).reduce((result, field) => {
    const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    result[setterName] = value => setField(field, value);
    return result;
  }, {}), [setField]);

  const hydrateProjectStore = useCallback(value => dispatch({ type: 'hydrate', value }), []);
  const resetProjectStore = useCallback(() => dispatch({ type: 'reset' }), []);

  return {
    state,
    ...setters,
    hydrateProjectStore,
    resetProjectStore,
  };
}
