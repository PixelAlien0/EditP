import { strToU8, zipSync } from 'fflate';
import { parseJsonc, stableContentHash } from './barbarianAiPackage.js';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function assertProfileObject(value, path = 'Profile') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must contain a JSON object at its root.`);
  }
  return value;
}

function profileId(surfaceId, path) {
  return `${surfaceId}:${path}`;
}

export function inspectAiProfileValue(value) {
  const summary = {
    groups: Object.keys(value || {}).length,
    objects: 0,
    arrays: 0,
    scalars: 0,
    maximumDepth: 0,
  };

  const visit = (entry, depth) => {
    summary.maximumDepth = Math.max(summary.maximumDepth, depth);
    if (Array.isArray(entry)) {
      summary.arrays += 1;
      entry.forEach(item => visit(item, depth + 1));
      return;
    }
    if (entry && typeof entry === 'object') {
      summary.objects += 1;
      Object.values(entry).forEach(item => visit(item, depth + 1));
      return;
    }
    summary.scalars += 1;
  };

  visit(value, 0);
  return summary;
}

export function describeAiProfileGroups(value) {
  return Object.entries(value || {}).map(([key, entry]) => {
    const type = Array.isArray(entry) ? 'array' : entry === null ? 'null' : typeof entry;
    const entries = Array.isArray(entry)
      ? entry.length
      : entry && typeof entry === 'object'
        ? Object.keys(entry).length
        : 1;
    return { key, type, entries };
  });
}

export function validateAiProfileSource(source, path = 'Profile') {
  try {
    const value = assertProfileObject(parseJsonc(source), path);
    return {
      valid: true,
      value,
      canonical: canonicalJson(value),
      summary: inspectAiProfileValue(value),
      groups: describeAiProfileGroups(value),
      error: '',
    };
  } catch (error) {
    return {
      valid: false,
      value: null,
      canonical: '',
      summary: null,
      groups: [],
      error: error.message || `${path} is not valid JSONC.`,
    };
  }
}

export function createAiProfileWorkspace(audit) {
  if (!audit?.contract?.profileSurfaces?.length) return [];
  const records = new Map((audit.files || []).map(record => [record.path, record]));
  const profiles = [];

  for (const surface of audit.contract.profileSurfaces) {
    for (const path of surface.files || []) {
      const record = records.get(path);
      if (!record?.isText) continue;
      const result = validateAiProfileSource(record.text, path);
      const source = result.valid ? `${JSON.stringify(result.value, null, 2)}\n` : record.text;
      profiles.push({
        id: profileId(surface.id, path),
        surfaceId: surface.id,
        label: surface.label,
        description: surface.description,
        path,
        originalSource: record.text,
        originalValue: result.valid ? cloneJson(result.value) : null,
        originalCanonical: result.canonical,
        draftSource: source,
        valid: result.valid,
        changed: false,
        error: result.error,
        summary: result.summary,
        groups: result.groups,
      });
    }
  }

  return profiles.sort((left, right) => left.label.localeCompare(right.label) || left.path.localeCompare(right.path));
}

export function updateAiProfileDraft(profile, source) {
  const result = validateAiProfileSource(source, profile.path);
  return {
    ...profile,
    draftSource: source,
    valid: result.valid,
    changed: result.valid ? result.canonical !== profile.originalCanonical : true,
    error: result.error,
    summary: result.summary,
    groups: result.groups,
  };
}

export function resetAiProfileDraft(profile) {
  if (!profile.originalValue) return updateAiProfileDraft(profile, profile.originalSource);
  return updateAiProfileDraft(profile, `${JSON.stringify(profile.originalValue, null, 2)}\n`);
}

export function buildAiProfileOverlay(profiles, { packageName = 'barbarian-profile-overlay' } = {}) {
  const changed = (profiles || []).filter(profile => profile.changed);
  if (!changed.length) throw new Error('Change at least one recognized profile before exporting an overlay.');
  const invalid = changed.filter(profile => !profile.valid);
  if (invalid.length) throw new Error(`Fix ${invalid.length} invalid profile${invalid.length === 1 ? '' : 's'} before exporting.`);

  const files = {};
  const manifestProfiles = [];
  for (const profile of changed) {
    const parsed = assertProfileObject(parseJsonc(profile.draftSource), profile.path);
    const output = `${JSON.stringify(parsed, null, 2)}\n`;
    files[profile.path] = strToU8(output);
    manifestProfiles.push({
      surface: profile.surfaceId,
      path: profile.path,
      hash: stableContentHash(output),
    });
  }

  const manifest = {
    schemaVersion: 1,
    kind: 'editp-barbarian-profile-overlay',
    packageName,
    profiles: manifestProfiles,
    safety: {
      configOnly: true,
      scriptsIncluded: false,
      nativeRuntimeIncluded: false,
    },
  };
  files['editp-ai-profile-manifest.json'] = strToU8(`${JSON.stringify(manifest, null, 2)}\n`);

  return {
    bytes: zipSync(files, { level: 6 }),
    manifest,
    fileCount: manifestProfiles.length,
  };
}
