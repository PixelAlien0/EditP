import { useCallback, useEffect, useState } from 'react';
import factoryRostersUrl from '../data/factory-rosters.json?url';
import explosionProfilesUrl from '../data/explosion-profiles.json?url';
import gameDataManifestUrl from '../data/game-data-manifest.json?url';
import unitCategories from '../data/unit-categories.json';
import unitDefaultsUrl from '../data/unit-defaults.json?url';
import unitpicManifestUrl from '../data/unitpic-manifest.json?url';
import unitsDbUrl from '../data/units.json?url';
import { getTagsOfUnit, getTechTierOfUnit } from '../utils/categories.js';
import { formatSnapshotError, validateCoreGameDataSnapshot } from '../utils/gameDataSnapshot.js';
import { setUnitArtworkManifest } from '../utils/unitArtwork.js';

const EMPTY_UNITS = Object.freeze({ names: {}, descriptions: {} });

function fetchJson(url) {
  return fetch(url).then(response => {
    if (!response.ok) throw new Error(`Bundled data request failed: ${response.status}`);
    return response.json();
  });
}

export function useCoreGameData() {
  const [data, setData] = useState({
    unitsDb: EMPTY_UNITS,
    factoryRosters: {},
    defaultsDb: {},
    explosionProfiles: {},
    snapshot: null,
    error: '',
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([
      fetchJson(unitDefaultsUrl),
      fetchJson(unitsDbUrl),
      fetchJson(factoryRostersUrl),
      fetchJson(unitpicManifestUrl),
      fetchJson(explosionProfilesUrl),
      fetchJson(gameDataManifestUrl),
    ])
      .then(([defaultsDb, unitsDb, factoryRosters, artworkManifest, explosionProfiles, manifest]) => {
        if (cancelled) return;
        const validation = validateCoreGameDataSnapshot({
          manifest,
          unitsDb,
          defaultsDb,
          unitCategories,
          factoryRosters,
          artworkManifest,
          explosionProfiles,
        });
        if (!validation.isValid) throw new Error(formatSnapshotError(validation));
        setUnitArtworkManifest(artworkManifest);
        setData({
          defaultsDb: defaultsDb || {},
          unitsDb: unitsDb || EMPTY_UNITS,
          factoryRosters: factoryRosters || {},
          explosionProfiles: explosionProfiles || {},
          snapshot: {
            schemaVersion: validation.schemaVersion,
            snapshotId: validation.snapshotId,
            sourceCommit: validation.sourceCommit,
            sourceDate: validation.sourceDate,
          },
          error: '',
          status: 'ready',
        });
      })
      .catch(error => {
        if (!cancelled) {
          setData(current => ({
            ...current,
            error: error instanceof Error ? error.message : 'Bundled BAR data could not be loaded.',
            status: 'error',
          }));
        }
      });

    const idleHandle = 'requestIdleCallback' in window
      ? window.requestIdleCallback(load, { timeout: 1500 })
      : window.setTimeout(load, 0);

    return () => {
      cancelled = true;
      if ('cancelIdleCallback' in window) window.cancelIdleCallback(idleHandle);
      else window.clearTimeout(idleHandle);
    };
  }, []);

  const getTechTier = useCallback(
    unitId => getTechTierOfUnit(unitId, data.defaultsDb),
    [data.defaultsDb]
  );
  const getTags = useCallback(
    unitId => getTagsOfUnit(unitId, data.defaultsDb),
    [data.defaultsDb]
  );

  return { ...data, getTechTierOfUnit: getTechTier, getTagsOfUnit: getTags };
}
