import { useCallback, useEffect, useMemo, useRef } from 'react';
import { createProjectDocument, normalizeProjectDocument } from '../project/projectDocument.js';
import { projectStorage } from '../storage/projectStorage.js';

const LEGACY_KEYS = {
  tweaks: 'bmf_tweaks', clones: 'bmf_clones', disabledUnitIds: 'bmf_disabled',
  unitDescriptions: 'bmf_descriptions', buildMenuSteps: 'bmf_buildmenu_steps',
  buildMenuPacks: 'bmf_buildmenu_packs', presets: 'bmf_presets', weaponLibrary: 'bmf_weapon_library',
  unitCollections: 'bmf_unit_collections',
  projectName: 'bmf_project_name', projectAuthor: 'bmf_project_author', projectDesc: 'bmf_project_desc',
  includeTweaks: 'bmf_inc_tweaks', includeClones: 'bmf_inc_clones',
  includeRosters: 'bmf_inc_rosters', includeHeader: 'bmf_inc_header',
};

function persistLegacyState(state) {
  Object.entries(LEGACY_KEYS).forEach(([field, key]) => {
    const value = state[field];
    if (field === 'unitDescriptions' && Object.keys(value || {}).length === 0) {
      localStorage.removeItem(key);
      return;
    }
    localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
  });
}

export function useProjectPersistence({ state, hydrate, onNotice }) {
  const document = useMemo(() => createProjectDocument(state), [state]);
  const initialDocumentRef = useRef(document);
  const initialPresetsRef = useRef(state.presets);
  const storageReadyRef = useRef(false);
  const lastCheckpointAtRef = useRef(0);

  useEffect(() => {
    try {
      persistLegacyState(state);
    } catch {
      onNotice('Browser storage is unavailable; use Save Project to keep this session.');
    }
  }, [onNotice, state]);

  useEffect(() => {
    let disposed = false;
    void Promise.all([projectStorage.getActive(), projectStorage.getLibrary('presets')])
      .then(([active, presetLibrary]) => {
        if (disposed) return;
        const recovery = {};
        if (active?.document) {
          Object.assign(recovery, normalizeProjectDocument(active.document));
          onNotice('Recovered the latest local project.');
        } else {
          void projectStorage.saveActive(initialDocumentRef.current);
        }
        if (presetLibrary?.value) recovery.presets = presetLibrary.value;
        else void projectStorage.saveLibrary('presets', initialPresetsRef.current);
        if (Object.keys(recovery).length) hydrate(recovery);
        storageReadyRef.current = true;
      })
      .catch(() => {
        if (!disposed) onNotice('Recovery storage is unavailable; this session still works.');
      });
    return () => { disposed = true; };
  }, [hydrate, onNotice]);

  useEffect(() => {
    if (!storageReadyRef.current) return undefined;
    const timer = window.setTimeout(() => {
      void projectStorage.saveActive(document).catch(() => undefined);
      void projectStorage.saveLibrary('presets', state.presets).catch(() => undefined);
      if (Date.now() - lastCheckpointAtRef.current >= 30000) {
        lastCheckpointAtRef.current = Date.now();
        void projectStorage.saveCheckpoint(document).catch(() => undefined);
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [document, state.presets]);

  const createCheckpoint = useCallback(
    reason => projectStorage.saveCheckpoint(document, reason),
    [document]
  );

  return { document, createCheckpoint };
}
