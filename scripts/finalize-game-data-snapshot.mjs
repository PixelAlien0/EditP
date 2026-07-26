import fs from 'node:fs';
import {
  GAME_DATA_MANIFEST_PATH,
  SNAPSHOT_PATHS,
  buildGameDataManifest,
  loadSnapshotDatasets,
  normalizeBuildPicture,
  normalizeUnitId,
  writeJson,
} from './game-data-snapshot.mjs';

const write = process.argv.includes('--write');
const sourceCommit = String(process.env.BAR_SOURCE_COMMIT || '').trim();

if (!/^[a-f0-9]{40}$/i.test(sourceCommit)) {
  throw new Error('BAR_SOURCE_COMMIT must be the exact 40-character commit used to generate every snapshot.');
}

const datasets = loadSnapshotDatasets();
const canonicalIds = Object.keys(datasets.defaults).map(normalizeUnitId);
const canonicalSet = new Set(canonicalIds);
const existingNames = datasets.units.names || {};
const existingDescriptions = datasets.units.descriptions || {};

for (const defaults of Object.values(datasets.defaults)) {
  for (const slot of defaults.weaponSlots || []) {
    if (slot.defKey !== undefined) slot.defKey = String(slot.defKey).toLowerCase();
  }
}

function reconcileOrdered(source, fallback) {
  const reconciled = {};
  for (const [rawId, value] of Object.entries(source || {})) {
    const unitId = normalizeUnitId(rawId);
    if (canonicalSet.has(unitId) && !Object.hasOwn(reconciled, unitId)) reconciled[unitId] = value;
  }
  for (const unitId of canonicalIds) {
    if (!Object.hasOwn(reconciled, unitId)) reconciled[unitId] = fallback(unitId);
  }
  return reconciled;
}

datasets.units.names = reconcileOrdered(existingNames, unitId => unitId);
datasets.units.descriptions = reconcileOrdered(existingDescriptions, () => '');
datasets.categories = reconcileOrdered(datasets.categories, () => ['t1']);

for (const [producerId, roster] of Object.entries(datasets.rosters)) {
  if (!canonicalSet.has(normalizeUnitId(producerId))) {
    delete datasets.rosters[producerId];
    continue;
  }
  datasets.rosters[producerId] = [...new Set(
    (Array.isArray(roster) ? roster : [])
      .map(normalizeUnitId)
      .filter(unitId => canonicalSet.has(unitId))
  )];
}

const pictureLookup = new Map(
  Object.entries(datasets.artwork.pictures || {}).map(([picture, url]) => [
    normalizeBuildPicture(picture),
    url,
  ])
);
const placeholders = [];
const artworkUnits = reconcileOrdered(datasets.artwork.units, unitId => {
  const buildPicture = normalizeBuildPicture(datasets.defaults[unitId]?.buildpic);
  return pictureLookup.get(buildPicture) || '/logo.svg';
});
for (const [unitId, resolved] of Object.entries(artworkUnits)) {
  if (resolved === '/logo.svg') placeholders.push(unitId);
}
datasets.artwork.units = artworkUnits;
datasets.artwork.placeholders = placeholders;
datasets.artwork.sourceCommit = sourceCommit;
datasets.artwork.stats = {
  ...(datasets.artwork.stats || {}),
  unitCount: canonicalIds.length,
  unresolvedSourceCount: placeholders.length,
};

for (const key of ['artwork', 'tacticalIcons', 'assets']) {
  const manifestCommit = datasets[key]?.sourceCommit;
  if (manifestCommit !== sourceCommit) {
    throw new Error(`${key} was generated from ${manifestCommit || 'an unknown commit'}, not ${sourceCommit}.`);
  }
}

if (write) {
  writeJson(SNAPSHOT_PATHS.defaults, datasets.defaults);
  writeJson(SNAPSHOT_PATHS.units, datasets.units);
  writeJson(SNAPSHOT_PATHS.categories, datasets.categories);
  writeJson(SNAPSHOT_PATHS.rosters, datasets.rosters);
  writeJson(SNAPSHOT_PATHS.artwork, datasets.artwork);
}

const finalDatasets = write ? loadSnapshotDatasets() : datasets;
const manifest = buildGameDataManifest({
  sourceCommit,
  sourceDate: finalDatasets.artwork.sourceDate || null,
  datasets: finalDatasets,
});

if (write) writeJson(GAME_DATA_MANIFEST_PATH, manifest);
else if (!fs.existsSync(GAME_DATA_MANIFEST_PATH)) {
  throw new Error('game-data-manifest.json is missing. Run this command with --write.');
}

console.log(`${write ? 'Wrote' : 'Prepared'} coherent BAR snapshot ${sourceCommit.slice(0, 12)}.`);
console.log(`  Editable units: ${manifest.counts.units}`);
console.log(`  Factory rosters: ${manifest.counts.rosters}`);
console.log(`  Artwork placeholders: ${finalDatasets.artwork.placeholders.length}`);
