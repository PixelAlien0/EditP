import { useCallback, useEffect, useState } from 'react';
import factoryRostersUrl from '../data/factory-rosters.json?url';
import unitDefaultsUrl from '../data/unit-defaults.json?url';
import unitpicManifestUrl from '../data/unitpic-manifest.json?url';
import unitsDbUrl from '../data/units.json?url';
import { getTagsOfUnit, getTechTierOfUnit } from '../utils/categories.js';
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
    status: 'loading',
  });

  useEffect(() => {
    let cancelled = false;
    const load = () => Promise.all([
      fetchJson(unitDefaultsUrl),
      fetchJson(unitsDbUrl),
      fetchJson(factoryRostersUrl),
      fetchJson(unitpicManifestUrl),
    ])
      .then(([defaultsDb, unitsDb, factoryRosters, artworkManifest]) => {
        if (cancelled) return;
        setUnitArtworkManifest(artworkManifest);
        setData({
          defaultsDb: defaultsDb || {},
          unitsDb: unitsDb || EMPTY_UNITS,
          factoryRosters: factoryRosters || {},
          status: 'ready',
        });
      })
      .catch(() => {
        if (!cancelled) setData(current => ({ ...current, status: 'error' }));
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
