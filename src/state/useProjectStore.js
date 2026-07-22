import { useCallback, useMemo, useReducer } from 'react';
import { loadLegacyProjectState as readLegacyProjectState } from '../storage/legacyProjectStorage.js';

export const PROJECT_STORE_DEFAULTS = Object.freeze({
  tweaks: {},
  clones: [],
  disabledUnitIds: [],
  unitDescriptions: {},
  buildMenuSteps: [],
  buildMenuPacks: { extraUnits: false, scavengerUnits: false },
  presets: [],
  weaponLibrary: [],
  supportingWeaponDefs: [],
  unitCollections: [],
  tweakModules: [],
  lobbySetup: {
    version: 1,
    sourceName: '',
    importedAt: '',
    commands: [],
    slotClears: [],
    slotResetFields: [],
    requirements: [],
    ignoredLineCount: 0,
    overwrittenCount: 0,
  },
  projectName: 'BAR Editor Mod',
  projectAuthor: 'Developer',
  projectDesc: 'A custom unit configuration mod.',
  includeTweaks: true,
  includeClones: true,
  includeRosters: true,
  includeHeader: true,
});

export function loadLegacyProjectState() {
  return readLegacyProjectState(PROJECT_STORE_DEFAULTS);
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
