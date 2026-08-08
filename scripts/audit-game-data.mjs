import fs from 'node:fs';
import {
  GAME_DATA_MANIFEST_PATH,
  SNAPSHOT_PATHS,
  getDatasetCounts,
  loadSnapshotDatasets,
  normalizeUnitId,
  readJson,
  sha256File,
} from './game-data-snapshot.mjs';
import { SCAVENGER_BOSS_DIFFICULTIES } from './dynamic-unit-families.mjs';

const errors = [];
const manifest = readJson(GAME_DATA_MANIFEST_PATH);
const datasets = loadSnapshotDatasets();
const counts = getDatasetCounts(datasets);
const unitIds = Object.keys(datasets.units.names || {}).map(normalizeUnitId).sort();
const expectedIds = new Set(unitIds);

function compareKeys(label, source) {
  const actual = Object.keys(source || {}).map(normalizeUnitId).sort();
  const missing = unitIds.filter(unitId => !actual.includes(unitId));
  const unexpected = actual.filter(unitId => !expectedIds.has(unitId));
  if (missing.length) errors.push(`${label} is missing ${missing.length} units: ${missing.slice(0, 12).join(', ')}`);
  if (unexpected.length) errors.push(`${label} has ${unexpected.length} stale units: ${unexpected.slice(0, 12).join(', ')}`);
}

if (!/^[a-f0-9]{40}$/i.test(manifest.sourceCommit || '')) {
  errors.push('Snapshot manifest has no exact BAR source commit.');
}
if ((manifest.schemaVersion ?? manifest.version) !== 1) {
  errors.push(`Unsupported snapshot schema ${manifest.schemaVersion ?? manifest.version ?? 'unknown'}.`);
}
if (manifest.snapshotId !== `bar-${String(manifest.sourceCommit || '').slice(0, 12)}`) {
  errors.push('Snapshot ID does not match the pinned BAR source commit.');
}
if (manifest.sourceRepository !== 'beyond-all-reason/Beyond-All-Reason') {
  errors.push(`Unexpected snapshot repository: ${manifest.sourceRepository || 'unknown'}.`);
}

compareKeys('Descriptions', datasets.units.descriptions);
compareKeys('Defaults', datasets.defaults);
compareKeys('Categories', datasets.categories);
compareKeys('Artwork', datasets.artwork.units);

for (const [unitId, assetUrl] of Object.entries(datasets.artwork.units || {})) {
  if (typeof assetUrl !== 'string' || !assetUrl.startsWith('/')) {
    errors.push(`Artwork entry ${unitId} is not a local URL string.`);
  }
}

if (expectedIds.has('armscavengerbossv2')) {
  errors.push('Snapshot contains nonexistent generated-family base ID armscavengerbossv2.');
}
for (const difficulty of Object.keys(SCAVENGER_BOSS_DIFFICULTIES)) {
  const unitId = `armscavengerbossv2_${difficulty}`;
  if (!expectedIds.has(unitId)) errors.push(`Snapshot is missing generated BAR UnitDef ${unitId}.`);
}

for (const key of ['artwork', 'tacticalIcons', 'assets', 'customParameters']) {
  if (datasets[key]?.sourceCommit !== manifest.sourceCommit) {
    errors.push(`${key} source commit ${datasets[key]?.sourceCommit || 'unknown'} differs from ${manifest.sourceCommit}.`);
  }
}

for (const [producerId, roster] of Object.entries(datasets.rosters)) {
  if (!expectedIds.has(normalizeUnitId(producerId))) errors.push(`Roster owner does not exist: ${producerId}`);
  for (const unitId of roster || []) {
    if (!expectedIds.has(normalizeUnitId(unitId))) errors.push(`${producerId} roster references missing unit ${unitId}`);
  }
}

const airborneWithoutAircraftTag = unitIds.filter(unitId => (
  Number(datasets.defaults[unitId]?.cruisealt) > 0
  && !datasets.categories[unitId]?.includes('aircraft')
));
if (airborneWithoutAircraftTag.length) {
  errors.push(
    `${airborneWithoutAircraftTag.length} airborne units are missing the aircraft classification: `
    + airborneWithoutAircraftTag.slice(0, 12).join(', ')
  );
}

for (const [key, record] of Object.entries(manifest.files || {})) {
  const expectedPath = SNAPSHOT_PATHS[key];
  if (!expectedPath || !fs.existsSync(expectedPath)) {
    errors.push(`Manifest dataset is missing: ${key}`);
    continue;
  }
  if (record.schemaVersion !== 1) errors.push(`${key} has no supported dataset schema version.`);
  const actualHash = sha256File(expectedPath);
  if (record.sha256 !== actualHash) errors.push(`${key} changed without refreshing game-data-manifest.json.`);
}

for (const [key, value] of Object.entries(counts)) {
  if (manifest.counts?.[key] !== value) {
    errors.push(`${key} count is ${value}, manifest records ${manifest.counts?.[key] ?? 'nothing'}.`);
  }
}

console.log('BAR game-data snapshot audit');
console.log(`  Source: ${manifest.sourceCommit?.slice(0, 12) || 'unknown'}`);
console.log(`  Units/defaults/categories/artwork: ${counts.units}/${counts.defaults}/${counts.categories}/${counts.artwork}`);
console.log(`  Factory rosters: ${counts.rosters}`);
console.log(`  Tactical icons: ${counts.tacticalIcons}`);
console.log(`  Validated asset references: ${counts.assetReferences}`);
console.log(`  Discovered custom parameters: ${counts.customParameters}`);

if (errors.length) {
  console.error(`\nAudit failed with ${errors.length} issue${errors.length === 1 ? '' : 's'}:`);
  errors.slice(0, 100).forEach(error => console.error(`  - ${error}`));
  process.exitCode = 1;
} else {
  console.log('\nAudit passed.');
}
