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
  exportEnglishOnly: false,
  compactLuaFormatting: false,
});

export const PROJECT_HISTORY_LIMIT = 50;

const PROJECT_FIELDS = Object.freeze(Object.keys(PROJECT_STORE_DEFAULTS));
const PROJECT_FIELD_SET = new Set(PROJECT_FIELDS);

// Presets are a reusable local library rather than part of the active project
// timeline. Project metadata and compiler-view flags retain the established
// behavior of changing independently from unit-edit undo/redo.
export const PROJECT_HISTORY_FIELDS = Object.freeze([
  'tweaks',
  'clones',
  'disabledUnitIds',
  'unitDescriptions',
  'buildMenuSteps',
  'buildMenuPacks',
  'weaponLibrary',
  'supportingWeaponDefs',
  'unitCollections',
  'tweakModules',
  'lobbySetup',
]);
const PROJECT_HISTORY_FIELD_SET = new Set(PROJECT_HISTORY_FIELDS);

function createDefaultProjectState() {
  return structuredClone(PROJECT_STORE_DEFAULTS);
}

export function loadLegacyProjectState() {
  return readLegacyProjectState(createDefaultProjectState());
}

function pickKnownFields(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([field]) => PROJECT_FIELD_SET.has(field))
  );
}

function projectValuesEqual(left, right) {
  if (Object.is(left, right)) return true;
  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function getChangedFields(current, next, candidates = PROJECT_FIELDS) {
  return candidates.filter(field => !projectValuesEqual(current[field], next[field]));
}

function createHistorySnapshot(project) {
  return Object.fromEntries(PROJECT_HISTORY_FIELDS.map(field => [field, project[field]]));
}

function restoreHistorySnapshot(project, snapshot) {
  return { ...project, ...snapshot };
}

function commitProject(store, nextProject, {
  recordHistory = true,
  changedFields = getChangedFields(store.present, nextProject),
} = {}) {
  if (changedFields.length === 0) return store;
  if (!recordHistory || !changedFields.some(field => PROJECT_HISTORY_FIELD_SET.has(field))) {
    return { ...store, present: nextProject };
  }
  return {
    present: nextProject,
    past: [
      ...store.past.slice(-(PROJECT_HISTORY_LIMIT - 1)),
      createHistorySnapshot(store.present),
    ],
    future: [],
  };
}

export function createProjectStoreState(project = loadLegacyProjectState()) {
  return {
    present: { ...createDefaultProjectState(), ...pickKnownFields(project) },
    past: [],
    future: [],
  };
}

export function projectStoreReducer(store, action) {
  switch (action.type) {
    case 'set-field': {
      if (!PROJECT_FIELD_SET.has(action.field)) return store;
      const current = store.present[action.field];
      const nextValue = typeof action.value === 'function'
        ? action.value(current)
        : action.value;
      if (projectValuesEqual(current, nextValue)) return store;
      return commitProject(store, {
        ...store.present,
        [action.field]: nextValue,
      }, { changedFields: [action.field] });
    }

    case 'transaction': {
      const requestedPatch = typeof action.value === 'function'
        ? action.value(store.present)
        : action.value;
      const patch = pickKnownFields(requestedPatch);
      if (Object.keys(patch).length === 0) return store;
      const changedFields = getChangedFields(store.present, patch, Object.keys(patch));
      return commitProject(store, { ...store.present, ...patch }, {
        recordHistory: action.recordHistory !== false,
        changedFields,
      });
    }

    case 'apply-snapshot': {
      const snapshot = pickKnownFields(action.value);
      const defaults = createDefaultProjectState();
      const restored = Object.fromEntries(PROJECT_HISTORY_FIELDS.map(field => [
        field,
        snapshot[field] ?? defaults[field],
      ]));
      const independentFields = Object.fromEntries(
        PROJECT_FIELDS
          .filter(field => !PROJECT_HISTORY_FIELDS.includes(field) && field !== 'presets')
          .map(field => [field, snapshot[field] ?? defaults[field]])
      );
      return commitProject(store, {
        ...store.present,
        ...restored,
        ...independentFields,
      });
    }

    case 'hydrate': {
      const hydrated = {
        ...store.present,
        ...pickKnownFields(action.value),
      };
      if (getChangedFields(store.present, hydrated).length === 0) return store;
      return { present: hydrated, past: [], future: [] };
    }

    case 'undo': {
      if (store.past.length === 0) return store;
      const target = store.past[store.past.length - 1];
      return {
        present: restoreHistorySnapshot(store.present, target),
        past: store.past.slice(0, -1),
        future: [
          createHistorySnapshot(store.present),
          ...store.future,
        ].slice(0, PROJECT_HISTORY_LIMIT),
      };
    }

    case 'redo': {
      if (store.future.length === 0) return store;
      const target = store.future[0];
      return {
        present: restoreHistorySnapshot(store.present, target),
        past: [
          ...store.past.slice(-(PROJECT_HISTORY_LIMIT - 1)),
          createHistorySnapshot(store.present),
        ],
        future: store.future.slice(1),
      };
    }

    case 'clear-history':
      return store.past.length || store.future.length
        ? { ...store, past: [], future: [] }
        : store;

    case 'reset':
      return commitProject(store, createDefaultProjectState());

    default:
      return store;
  }
}

export function useProjectStore() {
  const [store, dispatch] = useReducer(
    projectStoreReducer,
    undefined,
    () => createProjectStoreState()
  );
  const setField = useCallback(
    (field, value) => dispatch({ type: 'set-field', field, value }),
    []
  );
  const setters = useMemo(() => PROJECT_FIELDS.reduce((result, field) => {
    const setterName = `set${field.charAt(0).toUpperCase()}${field.slice(1)}`;
    result[setterName] = value => setField(field, value);
    return result;
  }, {}), [setField]);

  const transactProject = useCallback(
    (value, options = {}) => dispatch({
      type: 'transaction',
      value,
      recordHistory: options.recordHistory,
    }),
    []
  );
  const applyProjectSnapshot = useCallback(
    value => dispatch({ type: 'apply-snapshot', value }),
    []
  );
  const hydrateProjectStore = useCallback(
    value => dispatch({ type: 'hydrate', value }),
    []
  );
  const resetProjectStore = useCallback(
    () => dispatch({ type: 'reset' }),
    []
  );
  const undoProject = useCallback(() => dispatch({ type: 'undo' }), []);
  const redoProject = useCallback(() => dispatch({ type: 'redo' }), []);
  const clearProjectHistory = useCallback(
    () => dispatch({ type: 'clear-history' }),
    []
  );

  return {
    state: store.present,
    ...setters,
    transactProject,
    applyProjectSnapshot,
    hydrateProjectStore,
    resetProjectStore,
    undoProject,
    redoProject,
    clearProjectHistory,
    canUndo: store.past.length > 0,
    canRedo: store.future.length > 0,
    historyPastCount: store.past.length,
    historyFutureCount: store.future.length,
  };
}
