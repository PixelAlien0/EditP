import { strToU8, zipSync } from 'fflate';
import { parseJsonc, stableContentHash } from './barbarianAiPackage.js';

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

const PROFILE_FIELD_GUIDANCE = {
  weight: 'Relative preference used when this profile chooses between eligible options.',
  importance: 'Priority assigned to this entry when the AI compares possible actions.',
  ratio: 'Relative proportion used by the imported AI profile.',
  chance: 'Probability or selection chance used by the imported profile.',
  time: 'Timing value used by this profile. The runtime decides the exact unit.',
  radius: 'Distance around the relevant unit, task, or position.',
  distance: 'Distance threshold used by the imported AI profile.',
  threat: 'Threat threshold or modifier used by the AI decision system.',
  role: 'One or more strategic roles assigned to this entry.',
  side: 'Faction or side identifier recognized by the imported AI package.',
  unit: 'BAR UnitDef identifier referenced by this profile.',
  factor: 'Multiplier applied by the imported AI profile.',
  build_speed: 'Builder output value used by the AI profile when evaluating production.',
  max_percent: 'Maximum share this response group may occupy.',
  min_income: 'Minimum resource income expected before this policy becomes eligible.',
  build_delay: 'Delay used by the production policy before another build decision.',
  production: 'Production policy value used by the imported economy profile.',
  assist: 'Assistance policy used when assigning available builders.',
  retreat: 'Retreat threshold or policy value for this unit group.',
};

function cloneEditableValue(value) {
  if (value === undefined) return undefined;
  return cloneJson(value);
}

function pathId(path) {
  return path.map(part => String(part).replaceAll('~', '~0').replaceAll('/', '~1')).join('/');
}

function getValueAtPath(value, path) {
  return path.reduce((current, part) => current?.[part], value);
}

function setValueAtPath(value, path, nextValue) {
  const next = cloneJson(value);
  let cursor = next;
  path.forEach((part, index) => {
    if (index === path.length - 1) cursor[part] = cloneEditableValue(nextValue);
    else cursor = cursor[part];
  });
  return next;
}

function humanizeProfileKey(key) {
  return String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_.-]+/g, ' ')
    .replace(/\b\w/g, letter => letter.toUpperCase());
}

function inferFieldDescription(key, type, comment) {
  if (comment) return comment;
  const normalized = String(key).toLowerCase();
  const exact = PROFILE_FIELD_GUIDANCE[normalized];
  if (exact) return exact;
  const partial = Object.entries(PROFILE_FIELD_GUIDANCE).find(([token]) => normalized.includes(token));
  if (partial) return partial[1];
  if (type === 'boolean') return 'Turns this imported profile option on or off.';
  if (type === 'array') return 'Ordered values consumed together by the imported AI profile.';
  if (type === 'number') return 'Numeric tuning value defined by the imported AI package.';
  if (type === 'string') return 'Text identifier or mode defined by the imported AI package.';
  return 'Structured package data. Use Advanced source when its runtime meaning is known.';
}

function extractJsoncCommentHints(source) {
  const hints = new Map();
  let pending = [];
  for (const rawLine of String(source || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('//')) {
      pending.push(line.replace(/^\/\/\s?/, '').trim());
      continue;
    }
    const property = line.match(/^"([^"]+)"\s*:/);
    if (property) {
      const inline = line.match(/\/\/\s*(.+)$/)?.[1]?.trim();
      const copy = [...pending, inline].filter(Boolean).join(' ');
      if (copy && !hints.has(property[1])) hints.set(property[1], copy);
      pending = [];
      continue;
    }
    if (line && !line.startsWith('/*') && !line.startsWith('*')) pending = [];
  }
  return hints;
}

function classifyProfileValue(value) {
  if (Array.isArray(value)) {
    const primitive = value.every(item => item === null || ['string', 'number', 'boolean'].includes(typeof item));
    return { type: 'array', editable: primitive, format: primitive ? `List of ${value.length} values` : 'Nested structure' };
  }
  if (value === null) return { type: 'null', editable: false, format: 'Null value' };
  if (typeof value === 'object') return { type: 'object', editable: false, format: 'Nested structure' };
  return { type: typeof value, editable: ['string', 'number', 'boolean'].includes(typeof value), format: typeof value };
}

function flattenProfileGroup(entry, groupKey, originalEntry, commentHints, path = [groupKey], output = []) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    for (const [key, value] of Object.entries(entry)) {
      flattenProfileGroup(value, groupKey, originalEntry?.[key], commentHints, [...path, key], output);
    }
    return output;
  }

  const key = path.at(-1);
  const classification = classifyProfileValue(entry);
  output.push({
    id: pathId(path),
    path,
    key,
    groupKey,
    label: humanizeProfileKey(key),
    value: cloneEditableValue(entry),
    originalValue: cloneEditableValue(originalEntry),
    changed: canonicalJson(entry) !== canonicalJson(originalEntry),
    description: inferFieldDescription(key, classification.type, commentHints.get(key)),
    ...classification,
  });
  return output;
}

export function createAiProfileSchema(profile) {
  if (!profile?.valid) return { groups: [], fields: [], editableCount: 0, sourceOnlyCount: 0 };
  const value = assertProfileObject(parseJsonc(profile.draftSource), profile.path);
  const comments = extractJsoncCommentHints(profile.originalSource);
  const fields = [];
  for (const [groupKey, entry] of Object.entries(value)) {
    const originalEntry = profile.originalValue?.[groupKey];
    flattenProfileGroup(entry, groupKey, originalEntry, comments, [groupKey], fields);
  }
  const groups = Object.keys(value).map(groupKey => {
    const groupFields = fields.filter(field => field.groupKey === groupKey);
    return {
      id: groupKey,
      label: humanizeProfileKey(groupKey),
      count: groupFields.length,
      editableCount: groupFields.filter(field => field.editable).length,
    };
  });
  return {
    groups,
    fields,
    editableCount: fields.filter(field => field.editable).length,
    sourceOnlyCount: fields.filter(field => !field.editable).length,
  };
}

export function updateAiProfileValue(profile, path, value) {
  if (!profile?.valid) return profile;
  const parsed = assertProfileObject(parseJsonc(profile.draftSource), profile.path);
  const next = setValueAtPath(parsed, path, value);
  return updateAiProfileDraft(profile, `${JSON.stringify(next, null, 2)}\n`);
}

export function resetAiProfileValue(profile, path) {
  if (!profile?.valid || !profile.originalValue) return profile;
  return updateAiProfileValue(profile, path, getValueAtPath(profile.originalValue, path));
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
