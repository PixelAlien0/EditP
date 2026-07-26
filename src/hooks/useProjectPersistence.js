import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createProjectDocument,
  normalizeProjectDocumentWithReport,
} from '../project/projectDocument.js';
import { clearLegacyProjectState, persistLegacyProjectState } from '../storage/legacyProjectStorage.js';
import { projectStorage } from '../storage/projectStorage.js';

export function useProjectPersistence({ state, hydrate, onNotice }) {
  const document = useMemo(() => createProjectDocument(state), [state]);
  const initialDocumentRef = useRef(document);
  const initialPresetsRef = useRef(state.presets);
  const lastCheckpointAtRef = useRef(0);
  const [storageMode, setStorageMode] = useState('initializing');

  useEffect(() => {
    let disposed = false;
    void Promise.all([projectStorage.getActive(), projectStorage.getLibrary('presets')])
      .then(async ([active, presetLibrary]) => {
        if (disposed) return;
        const recovery = {};
        if (active?.document) {
          try {
            const prepared = normalizeProjectDocumentWithReport(active.document);
            Object.assign(recovery, prepared.document);
            if (prepared.migrated) {
              await projectStorage.saveActive(prepared.document);
              onNotice(`Recovered and migrated the local project from v${prepared.fromVersion}.`);
            } else {
              onNotice('Recovered the latest local project.');
            }
          } catch (error) {
            await projectStorage.saveRejectedProject({
              sourceName: 'Corrupted local autosave',
              rawText: JSON.stringify(active.document, null, 2),
              error: error?.message,
              code: error?.code,
            });
            const checkpoints = await projectStorage.listRecoveryCheckpoints();
            let restoredCheckpoint = null;
            for (const checkpoint of checkpoints) {
              try {
                restoredCheckpoint = {
                  checkpoint,
                  prepared: normalizeProjectDocumentWithReport(checkpoint.document),
                };
                break;
              } catch {
                // Keep looking for the newest checkpoint that still validates.
              }
            }
            if (restoredCheckpoint) {
              Object.assign(recovery, restoredCheckpoint.prepared.document);
              await projectStorage.saveActive(restoredCheckpoint.prepared.document);
              onNotice(`Recovered checkpoint: ${restoredCheckpoint.checkpoint.reason || 'Autosave'}.`);
            } else {
              await projectStorage.saveActive(initialDocumentRef.current);
              onNotice('The local autosave was corrupted. A clean project was opened and the rejected data was preserved in Recovery.');
            }
          }
        } else {
          await projectStorage.saveActive(initialDocumentRef.current);
        }
        if (presetLibrary?.value) recovery.presets = presetLibrary.value;
        else await projectStorage.saveLibrary('presets', initialPresetsRef.current);
        if (disposed) return;
        if (Object.keys(recovery).length) hydrate(recovery);
        clearLegacyProjectState();
        setStorageMode('indexeddb');
      })
      .catch(() => {
        if (!disposed) {
          setStorageMode('legacy');
          onNotice('Recovery storage is unavailable; using browser fallback storage.');
        }
      });
    return () => { disposed = true; };
  }, [hydrate, onNotice]);

  useEffect(() => {
    if (storageMode === 'initializing') return undefined;
    const timer = window.setTimeout(() => {
      if (storageMode === 'legacy') {
        try {
          persistLegacyProjectState(state);
        } catch {
          onNotice('Browser storage is unavailable; use Save Project to keep this session.');
        }
        return;
      }

      void projectStorage.saveActive(document).catch(() => undefined);
      void projectStorage.saveLibrary('presets', state.presets).catch(() => undefined);
      if (Date.now() - lastCheckpointAtRef.current >= 30000) {
        lastCheckpointAtRef.current = Date.now();
        void projectStorage.saveCheckpoint(document).catch(() => undefined);
      }
    }, 750);
    return () => window.clearTimeout(timer);
  }, [document, onNotice, state, storageMode]);

  const createCheckpoint = useCallback(
    reason => projectStorage.saveCheckpoint(document, reason),
    [document]
  );

  return { document, createCheckpoint };
}
