import { GAME_DATA_SNAPSHOT_SCHEMA_VERSION } from '../config/gameDataSchema.js';

const COMMIT_PATTERN = /^[a-f0-9]{40}$/i;

function normalizedKeys(value) {
  return Object.keys(value || {}).map(key => String(key).trim().toLowerCase()).sort();
}

function compareCatalog(label, value, canonicalIds, canonicalSet, issues) {
  const actualIds = normalizedKeys(value);
  if (actualIds.length !== canonicalIds.length) {
    issues.push(`${label} contains ${actualIds.length} entries; ${canonicalIds.length} were expected.`);
    return;
  }

  const missingId = canonicalIds.find(unitId => !Object.hasOwn(value || {}, unitId));
  const staleId = actualIds.find(unitId => !canonicalSet.has(unitId));
  if (missingId) issues.push(`${label} is missing unit "${missingId}".`);
  if (staleId) issues.push(`${label} contains stale unit "${staleId}".`);
}

function compareCount(label, actual, expected, issues) {
  if (!Number.isInteger(expected)) {
    issues.push(`The snapshot manifest does not declare a ${label} count.`);
  } else if (actual !== expected) {
    issues.push(`${label} contains ${actual} entries; the manifest declares ${expected}.`);
  }
}

export function validateCoreGameDataSnapshot({
  manifest,
  unitsDb,
  defaultsDb,
  unitCategories,
  factoryRosters,
  artworkManifest,
  explosionProfiles,
}) {
  const issues = [];
  const schemaVersion = manifest?.schemaVersion ?? manifest?.version;
  const sourceCommit = String(manifest?.sourceCommit || '');
  const canonicalIds = normalizedKeys(unitsDb?.names);
  const canonicalSet = new Set(canonicalIds);

  if (schemaVersion !== GAME_DATA_SNAPSHOT_SCHEMA_VERSION) {
    issues.push(`Snapshot schema ${schemaVersion ?? 'unknown'} is not supported.`);
  }
  if (!COMMIT_PATTERN.test(sourceCommit)) {
    issues.push('The snapshot is not pinned to an exact BAR commit.');
  }
  if (manifest?.snapshotId !== `bar-${sourceCommit.slice(0, 12)}`) {
    issues.push('The snapshot ID does not match its BAR source commit.');
  }

  compareCatalog('Unit descriptions', unitsDb?.descriptions, canonicalIds, canonicalSet, issues);
  compareCatalog('Unit defaults', defaultsDb, canonicalIds, canonicalSet, issues);
  compareCatalog('Unit categories', unitCategories, canonicalIds, canonicalSet, issues);
  compareCatalog('Unit artwork', artworkManifest?.units, canonicalIds, canonicalSet, issues);

  compareCount('unit catalog', canonicalIds.length, manifest?.counts?.units, issues);
  compareCount('unit descriptions', normalizedKeys(unitsDb?.descriptions).length, manifest?.counts?.descriptions, issues);
  compareCount('unit defaults', normalizedKeys(defaultsDb).length, manifest?.counts?.defaults, issues);
  compareCount('unit categories', normalizedKeys(unitCategories).length, manifest?.counts?.categories, issues);
  compareCount('factory rosters', normalizedKeys(factoryRosters).length, manifest?.counts?.rosters, issues);
  compareCount('explosion profiles', normalizedKeys(explosionProfiles).length, manifest?.counts?.explosions, issues);
  compareCount('unit artwork', normalizedKeys(artworkManifest?.units).length, manifest?.counts?.artwork, issues);

  if (artworkManifest?.sourceCommit !== sourceCommit) {
    issues.push('Unit artwork was generated from a different BAR commit.');
  }

  for (const [producerId, roster] of Object.entries(factoryRosters || {})) {
    if (!canonicalSet.has(String(producerId).toLowerCase())) {
      issues.push(`Factory roster owner "${producerId}" is not present in the unit catalog.`);
      break;
    }
    const missingUnit = (Array.isArray(roster) ? roster : [])
      .find(unitId => !canonicalSet.has(String(unitId).toLowerCase()));
    if (missingUnit) {
      issues.push(`Factory roster "${producerId}" references missing unit "${missingUnit}".`);
      break;
    }
  }

  return {
    isValid: issues.length === 0,
    issues,
    schemaVersion,
    snapshotId: manifest?.snapshotId || '',
    sourceCommit,
    sourceDate: manifest?.sourceDate || null,
  };
}

export function formatSnapshotError(validation) {
  if (validation?.isValid) return '';
  const details = (validation?.issues || []).slice(0, 3).join(' ');
  return `Bundled BAR data failed its consistency check.${details ? ` ${details}` : ''}`;
}
