import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {
  DATA_DIRECTORY,
  GAME_DATA_MANIFEST_PATH,
  ROOT,
  readJson,
  writeJson,
} from './game-data-snapshot.mjs';

export const BAR_UPDATE_REPORT_PATH = path.join(DATA_DIRECTORY, 'bar-update-report.json');
export const BAR_UPDATE_REPORT_VERSION = 1;

const DATASET_DEFINITIONS = Object.freeze([
  { id: 'units', label: 'Unit definitions', group: 'gameplay', file: 'unit-defaults.json', select: value => value },
  {
    id: 'identity',
    label: 'Names and descriptions',
    group: 'gameplay',
    file: 'units.json',
    select: value => Object.fromEntries([
      ...Object.entries(value?.names || {}).map(([id, name]) => [`${id}:name`, name]),
      ...Object.entries(value?.descriptions || {}).map(([id, description]) => [`${id}:description`, description]),
    ]),
  },
  { id: 'rosters', label: 'Factory rosters', group: 'gameplay', file: 'factory-rosters.json', select: value => value },
  { id: 'explosions', label: 'Explosion profiles', group: 'gameplay', file: 'explosion-profiles.json', select: value => value },
  { id: 'artwork', label: 'Unit artwork mappings', group: 'delivery', file: 'unitpic-manifest.json', select: value => value?.units || {} },
  { id: 'tacticalIcons', label: 'Tactical icons', group: 'delivery', file: 'tactical-icon-manifest.json', select: value => value?.icons || {} },
  {
    id: 'assets',
    label: 'BAR asset references',
    group: 'delivery',
    file: 'bar-asset-manifest.json',
    select: value => Object.fromEntries(
      Object.entries(value?.categories || {}).flatMap(([category, entries]) =>
        (Array.isArray(entries) ? entries : []).map(entry => [`${category}:${String(entry).toLowerCase()}`, entry])
      )
    ),
  },
  {
    id: 'customParameters',
    label: 'Custom parameter contracts',
    group: 'compatibility',
    file: 'custom-parameter-discovery.json',
    select: value => Object.fromEntries(
      Object.entries(value?.parameters || {}).flatMap(([scope, entries]) =>
        (Array.isArray(entries) ? entries : []).map(entry => [`${scope}:${entry.key}`, entry])
      )
    ),
  },
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right, 'en'))
      .map(([key, nested]) => [key, stableValue(nested)])
  );
}

function sameValue(left, right) {
  return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right));
}

export function diffRecords(previous = {}, current = {}, sampleLimit = 18) {
  const previousKeys = new Set(Object.keys(previous));
  const currentKeys = new Set(Object.keys(current));
  const added = [...currentKeys].filter(key => !previousKeys.has(key)).sort((a, b) => a.localeCompare(b, 'en'));
  const removed = [...previousKeys].filter(key => !currentKeys.has(key)).sort((a, b) => a.localeCompare(b, 'en'));
  const changed = [...currentKeys]
    .filter(key => previousKeys.has(key) && !sameValue(previous[key], current[key]))
    .sort((a, b) => a.localeCompare(b, 'en'));

  return {
    currentCount: currentKeys.size,
    previousCount: previousKeys.size,
    delta: currentKeys.size - previousKeys.size,
    addedCount: added.length,
    removedCount: removed.length,
    changedCount: changed.length,
    added: added.slice(0, sampleLimit),
    removed: removed.slice(0, sampleLimit),
    changed: changed.slice(0, sampleLimit),
  };
}

function gitJson(ref, relativePath) {
  try {
    const content = execFileSync('git', ['-C', ROOT, 'show', `${ref}:${relativePath.replaceAll('\\', '/')}`], {
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    });
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function directoryJson(directory, filename) {
  const candidates = [
    path.join(directory, filename),
    path.join(directory, 'src', 'data', filename),
  ];
  const filePath = candidates.find(candidate => fs.existsSync(candidate));
  return filePath ? readJson(filePath) : null;
}

function loadBaseline({ baselineDirectory, baselineRef } = {}) {
  if (baselineRef) {
    return {
      manifest: gitJson(baselineRef, 'src/data/game-data-manifest.json'),
      read: filename => gitJson(baselineRef, `src/data/${filename}`),
    };
  }
  if (baselineDirectory) {
    return {
      manifest: directoryJson(baselineDirectory, 'game-data-manifest.json'),
      read: filename => directoryJson(baselineDirectory, filename),
    };
  }
  return { manifest: null, read: () => null };
}

function snapshotSummary(manifest) {
  if (!manifest) return null;
  return {
    snapshotId: manifest.snapshotId,
    sourceCommit: manifest.sourceCommit,
    sourceDate: manifest.sourceDate,
    schemaVersion: manifest.schemaVersion,
    counts: manifest.counts,
  };
}

export function buildBarUpdateReport({ currentManifest, currentRead, previousManifest, previousRead }) {
  const datasets = DATASET_DEFINITIONS.map(definition => {
    const currentSource = currentRead(definition.file) || {};
    const previousSource = previousRead(definition.file) || {};
    const comparison = diffRecords(definition.select(previousSource), definition.select(currentSource));
    const changeCount = comparison.addedCount + comparison.removedCount + comparison.changedCount;
    return {
      id: definition.id,
      label: definition.label,
      group: definition.group,
      status: previousManifest ? (changeCount > 0 ? 'changed' : 'unchanged') : 'baseline',
      ...comparison,
    };
  });

  const summarizeGroup = group => {
    const relevant = datasets.filter(dataset => dataset.group === group);
    return {
      datasets: relevant.length,
      changedDatasets: relevant.filter(dataset => dataset.status === 'changed').length,
      added: relevant.reduce((total, dataset) => total + dataset.addedCount, 0),
      removed: relevant.reduce((total, dataset) => total + dataset.removedCount, 0),
      changed: relevant.reduce((total, dataset) => total + dataset.changedCount, 0),
    };
  };

  return {
    version: BAR_UPDATE_REPORT_VERSION,
    generatedAt: currentManifest.sourceDate || null,
    current: snapshotSummary(currentManifest),
    previous: snapshotSummary(previousManifest),
    summary: {
      gameplay: summarizeGroup('gameplay'),
      delivery: summarizeGroup('delivery'),
      compatibility: summarizeGroup('compatibility'),
    },
    datasets,
  };
}

export function generateBarUpdateReport({ baselineDirectory, baselineRef, write = false } = {}) {
  const currentManifest = readJson(GAME_DATA_MANIFEST_PATH);
  const baseline = loadBaseline({ baselineDirectory, baselineRef });
  const report = buildBarUpdateReport({
    currentManifest,
    currentRead: filename => readJson(path.join(DATA_DIRECTORY, filename)),
    previousManifest: baseline.manifest,
    previousRead: baseline.read,
  });
  if (write) writeJson(BAR_UPDATE_REPORT_PATH, report);
  return report;
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
if (invokedDirectly) {
  const readArgument = name => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : '';
  };
  const report = generateBarUpdateReport({
    baselineDirectory: readArgument('--baseline-dir'),
    baselineRef: readArgument('--baseline-ref'),
    write: process.argv.includes('--write'),
  });
  console.log(`Prepared BAR update report ${report.previous?.snapshotId || 'initial baseline'} -> ${report.current.snapshotId}.`);
}
