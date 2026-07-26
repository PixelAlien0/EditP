import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const DATA_DIRECTORY = path.join(ROOT, 'src', 'data');
export const GAME_DATA_MANIFEST_PATH = path.join(DATA_DIRECTORY, 'game-data-manifest.json');
export const SOURCE_REPOSITORY = 'beyond-all-reason/Beyond-All-Reason';
export const SNAPSHOT_SCHEMA_VERSION = 1;

export const SNAPSHOT_PATHS = Object.freeze({
  units: path.join(DATA_DIRECTORY, 'units.json'),
  defaults: path.join(DATA_DIRECTORY, 'unit-defaults.json'),
  categories: path.join(DATA_DIRECTORY, 'unit-categories.json'),
  rosters: path.join(DATA_DIRECTORY, 'factory-rosters.json'),
  explosions: path.join(DATA_DIRECTORY, 'explosion-profiles.json'),
  artwork: path.join(DATA_DIRECTORY, 'unitpic-manifest.json'),
  tacticalIcons: path.join(DATA_DIRECTORY, 'tactical-icon-manifest.json'),
  assets: path.join(DATA_DIRECTORY, 'bar-asset-manifest.json'),
});

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function normalizeUnitId(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeBuildPicture(value) {
  const normalized = String(value || '')
    .replaceAll('\\', '/')
    .replace(/^unitpics\//i, '')
    .replace(/^\/+|\/+$/g, '')
    .toLowerCase();
  return normalized && !/\.(dds|png|tga)$/i.test(normalized) ? `${normalized}.dds` : normalized;
}

export function sortedObject(source) {
  return Object.fromEntries(
    Object.entries(source || {}).sort(([left], [right]) => left.localeCompare(right, 'en'))
  );
}

export function getDatasetCounts(datasets) {
  const names = datasets.units?.names || {};
  const descriptions = datasets.units?.descriptions || {};
  const tacticalIcons = datasets.tacticalIcons?.icons || {};
  const assetReferences = Object.values(datasets.assets?.categories || {})
    .reduce((total, values) => total + (Array.isArray(values) ? values.length : 0), 0);
  return {
    units: Object.keys(names).length,
    descriptions: Object.keys(descriptions).length,
    defaults: Object.keys(datasets.defaults || {}).length,
    categories: Object.keys(datasets.categories || {}).length,
    rosters: Object.keys(datasets.rosters || {}).length,
    explosions: Object.keys(datasets.explosions || {}).length,
    artwork: Object.keys(datasets.artwork?.units || {}).length,
    tacticalIcons: Object.keys(tacticalIcons).length,
    assetReferences,
  };
}

export function loadSnapshotDatasets() {
  return Object.fromEntries(
    Object.entries(SNAPSHOT_PATHS).map(([key, filePath]) => [key, readJson(filePath)])
  );
}

export function buildGameDataManifest({ sourceCommit, sourceDate = null, datasets }) {
  const files = Object.fromEntries(
    Object.entries(SNAPSHOT_PATHS).map(([key, filePath]) => [
      key,
      {
        path: path.relative(ROOT, filePath).replaceAll('\\', '/'),
        schemaVersion: SNAPSHOT_SCHEMA_VERSION,
        sha256: sha256File(filePath),
      },
    ])
  );
  return {
    version: SNAPSHOT_SCHEMA_VERSION,
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    snapshotId: `bar-${sourceCommit.slice(0, 12)}`,
    sourceRepository: SOURCE_REPOSITORY,
    sourceCommit,
    sourceDate,
    counts: getDatasetCounts(datasets),
    files,
  };
}
