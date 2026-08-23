import { strFromU8, unzipSync } from 'fflate';
import {
  BARBARIAN_OPTION_KEYS,
  BARBARIAN_PACKAGE_FILES,
  BARBARIAN_PROFILE_SURFACES,
  CURRENT_BARBARIAN_CONTRACT,
} from '../config/barbarianAiContracts.js';

export const AI_PACKAGE_LIMITS = Object.freeze({
  maxFileBytes: 16 * 1024 * 1024,
  maxPackageBytes: 32 * 1024 * 1024,
  maxFiles: 1200,
});

const TEXT_EXTENSIONS = /\.(?:lua|as|json|jsonc|txt|md|cfg|ini)$/i;
const PROFILE_PATH_PATTERN = /(?:^|\/)(?:config|configs|profile|profiles)(?:\/|$)/i;

function normalizedPath(value = '') {
  return String(value).replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\/+/, '');
}

function fileName(path = '') {
  return normalizedPath(path).split('/').pop() || '';
}

function baseName(path = '') {
  return fileName(path).replace(/\.[^.]+$/, '').toLowerCase();
}

export function stableContentHash(value) {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let hash = 2166136261;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function stripJsonComments(source) {
  let result = '';
  let inString = false;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === '\n') {
        lineComment = false;
        result += char;
      }
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      } else if (char === '\n') {
        result += char;
      }
      continue;
    }
    if (inString) {
      result += char;
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') {
      inString = true;
      result += char;
    } else if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
    } else if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
    } else {
      result += char;
    }
  }
  return result;
}

export function parseJsonc(source) {
  const withoutComments = stripJsonComments(String(source || ''));
  const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, '$1');
  return JSON.parse(withoutTrailingCommas);
}

function readLuaString(source, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`(?:^|[,{\\s])${escapedKey}\\s*=\\s*(["'])(.*?)\\1`, 'ims'));
  return match?.[2]?.trim() || '';
}

function collectLuaOptionKeys(source) {
  const keys = new Set();
  for (const match of source.matchAll(/\bkey\s*=\s*(["'])(.*?)\1/gims)) {
    if (match[2]) keys.add(match[2].trim());
  }
  return [...keys].sort();
}

function detectProfileSurface(path) {
  const candidate = baseName(path).replace(/[-\s]+/g, '_');
  return BARBARIAN_PROFILE_SURFACES.find(surface => (
    candidate === surface.id
    || candidate.startsWith(`${surface.id}_`)
    || surface.aliases.some(alias => candidate === alias || candidate.startsWith(`${alias}_`))
  )) || null;
}

function classifyPath(path) {
  const normalized = normalizedPath(path);
  return BARBARIAN_PACKAGE_FILES.find(entry => entry.pattern.test(normalized))?.id || 'other';
}

function createRecord(path, bytes, text = null) {
  const normalized = normalizedPath(path);
  return {
    path: normalized,
    name: fileName(normalized),
    size: bytes.byteLength,
    hash: stableContentHash(bytes),
    kind: classifyPath(normalized),
    isText: text !== null,
    text,
  };
}

function decodeText(bytes) {
  return strFromU8(bytes);
}

function assertSafePath(path) {
  const normalized = normalizedPath(path);
  if (!normalized || normalized.includes('\0') || normalized.split('/').includes('..')) {
    throw new Error(`Package contains an unsafe path: ${path || '(empty path)'}.`);
  }
}

function recordsFromZip(file, bytes, limits) {
  let extracted;
  let acceptedFiles = 0;
  let acceptedBytes = 0;
  try {
    extracted = unzipSync(bytes, {
      filter: entry => {
        if (entry.name.endsWith('/')) return false;
        assertSafePath(entry.name);
        acceptedFiles += 1;
        acceptedBytes += entry.originalSize;
        if (acceptedFiles > limits.maxFiles) throw new Error(`Archive exceeds the ${limits.maxFiles}-file safety limit.`);
        if (entry.originalSize > limits.maxFileBytes) throw new Error(`${entry.name} exceeds the ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB per-file limit.`);
        if (acceptedBytes > limits.maxPackageBytes) throw new Error(`Archive expands beyond the ${Math.round(limits.maxPackageBytes / 1024 / 1024)} MB package limit.`);
        return true;
      },
    });
  } catch (error) {
    throw new Error(`Could not read ${file.name}: ${error.message}`);
  }
  return Object.entries(extracted).map(([path, content]) => createRecord(
    path,
    content,
    TEXT_EXTENSIONS.test(path) ? decodeText(content) : null,
  ));
}

export async function readAiPackageFiles(fileList, limits = AI_PACKAGE_LIMITS) {
  const files = Array.from(fileList || []);
  const records = [];
  for (const file of files) {
    if (/\.zip$/i.test(file.name) && file.size > limits.maxPackageBytes) {
      throw new Error(`${file.name} exceeds the ${Math.round(limits.maxPackageBytes / 1024 / 1024)} MB archive limit.`);
    }
    if (!/\.zip$/i.test(file.name) && file.size > limits.maxFileBytes) {
      throw new Error(`${file.name} exceeds the ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB per-file limit.`);
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (/\.zip$/i.test(file.name)) records.push(...recordsFromZip(file, bytes, limits));
    else {
      const path = file.webkitRelativePath || file.name;
      assertSafePath(path);
      records.push(createRecord(path, bytes, TEXT_EXTENSIONS.test(path) ? decodeText(bytes) : null));
    }
  }

  if (records.length > limits.maxFiles) throw new Error(`Package contains ${records.length} files; the safe limit is ${limits.maxFiles}.`);
  const oversized = records.find(record => record.size > limits.maxFileBytes);
  if (oversized) throw new Error(`${oversized.path} exceeds the ${Math.round(limits.maxFileBytes / 1024 / 1024)} MB per-file limit.`);
  const totalBytes = records.reduce((sum, record) => sum + record.size, 0);
  if (totalBytes > limits.maxPackageBytes) throw new Error(`Package is ${Math.ceil(totalBytes / 1024 / 1024)} MB; the safe limit is ${Math.round(limits.maxPackageBytes / 1024 / 1024)} MB.`);
  return records.sort((left, right) => left.path.localeCompare(right.path));
}

function walkStrings(value, visit, path = []) {
  if (typeof value === 'string') visit(value, path);
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, visit, [...path, String(index)]));
  else if (value && typeof value === 'object') Object.entries(value).forEach(([key, item]) => walkStrings(item, visit, [...path, key]));
}

function profileReferenceCandidates(parsedProfiles, knownUnitIds) {
  const known = new Set(knownUnitIds.map(id => String(id).toLowerCase()));
  const referenced = new Set();
  const unresolved = new Set();
  for (const profile of parsedProfiles) {
    walkStrings(profile.value, (value, path) => {
      const keyPath = path.join('.').toLowerCase();
      if (!/(unit|builder|factory|commander|build|role|squad)/.test(keyPath)) return;
      for (const token of value.toLowerCase().match(/[a-z][a-z0-9_]{2,}/g) || []) {
        if (known.has(token)) referenced.add(token);
        else if (/^(arm|cor|leg|raptor|scav)[a-z0-9_]+$/.test(token)) unresolved.add(token);
      }
    });
  }
  return { referenced: [...referenced].sort(), unresolved: [...unresolved].sort() };
}

function finding(id, severity, title, description, path = '') {
  return { id, severity, title, description, path };
}

export function discoverBarbarianContract(records) {
  const files = records || [];
  const infoFile = files.find(record => record.kind === 'ai-info' && record.text !== null);
  const optionsFile = files.find(record => record.kind === 'ai-options' && record.text !== null);
  const surfaces = new Map();

  for (const record of files) {
    const surface = detectProfileSurface(record.path);
    if (!surface || !PROFILE_PATH_PATTERN.test(record.path)) continue;
    const current = surfaces.get(surface.id) || { ...surface, files: [] };
    current.files.push(record.path);
    surfaces.set(surface.id, current);
  }

  const optionKeys = optionsFile ? collectLuaOptionKeys(optionsFile.text) : [];
  const identity = infoFile ? {
    shortName: readLuaString(infoFile.text, 'shortName') || readLuaString(infoFile.text, 'shortname'),
    name: readLuaString(infoFile.text, 'name'),
    version: readLuaString(infoFile.text, 'version'),
    description: readLuaString(infoFile.text, 'description'),
  } : {};

  return {
    id: CURRENT_BARBARIAN_CONTRACT.id,
    version: CURRENT_BARBARIAN_CONTRACT.version,
    discoveredAt: new Date().toISOString(),
    identity,
    optionKeys,
    profileSurfaces: [...surfaces.values()].sort((left, right) => left.id.localeCompare(right.id)),
    fileKinds: Object.fromEntries(BARBARIAN_PACKAGE_FILES.map(kind => [kind.id, files.filter(record => record.kind === kind.id).length])),
    runtimeFingerprints: files.filter(record => record.kind === 'native').map(record => ({ path: record.path, size: record.size, hash: record.hash })),
    scriptRoutes: files.filter(record => record.kind === 'script').map(record => record.path),
  };
}

export function auditBarbarianAiPackage(records, { knownUnitIds = [] } = {}) {
  const files = records || [];
  const findings = [];
  const contract = discoverBarbarianContract(files);
  const parsedProfiles = [];

  if (!files.some(record => record.kind === 'ai-info')) {
    findings.push(finding('missing-ai-info', 'blocker', 'AIInfo.lua is missing', 'The package has no discoverable Skirmish AI identity and cannot be matched to a lobby AI.', 'AIInfo.lua'));
  }
  if (!files.some(record => record.kind === 'native')) {
    findings.push(finding('missing-native-runtime', 'review', 'No native runtime was found', 'A script-only package may be intentional, but BARbarIAn packages normally route through a platform runtime binary.'));
  } else {
    findings.push(finding('native-runtime', 'note', 'Native runtime is inspection-only', 'Runtime binaries are fingerprinted but never loaded or executed by BAR Editor.'));
  }

  for (const record of files.filter(item => item.kind === 'config')) {
    if (record.text === null) continue;
    try {
      parsedProfiles.push({ path: record.path, value: parseJsonc(record.text) });
    } catch (error) {
      findings.push(finding(`invalid-config:${record.path}`, 'blocker', 'Invalid profile data', error.message, record.path));
    }
  }

  const references = profileReferenceCandidates(parsedProfiles, knownUnitIds);
  if (references.unresolved.length) {
    findings.push(finding(
      'unresolved-unit-references',
      'review',
      `${references.unresolved.length} possible stale unit references`,
      `These BAR-shaped IDs were not found in the current editor snapshot: ${references.unresolved.slice(0, 12).join(', ')}${references.unresolved.length > 12 ? '…' : ''}`,
    ));
  }

  const discoveredSurfaceIds = new Set(contract.profileSurfaces.map(surface => surface.id));
  for (const surface of BARBARIAN_PROFILE_SURFACES) {
    if (!discoveredSurfaceIds.has(surface.id)) {
      findings.push(finding(`missing-surface:${surface.id}`, 'note', `${surface.label} profile not discovered`, 'This package may use a different profile schema or omit this optional policy surface.'));
    }
  }

  const unknownOptions = contract.optionKeys.filter(key => !BARBARIAN_OPTION_KEYS.includes(key));
  if (unknownOptions.length) {
    findings.push(finding('unknown-options', 'review', 'Package exposes additional lobby options', unknownOptions.join(', '), 'AIOptions.lua'));
  }

  const duplicateHashes = new Map();
  for (const record of files) {
    const paths = duplicateHashes.get(record.hash) || [];
    paths.push(record.path);
    duplicateHashes.set(record.hash, paths);
  }
  const duplicates = [...duplicateHashes.values()].filter(paths => paths.length > 1);
  if (duplicates.length) findings.push(finding('duplicate-files', 'note', `${duplicates.length} duplicate file groups`, 'Identical files may be intentional platform copies; review them before packaging.'));

  const blockers = findings.filter(item => item.severity === 'blocker').length;
  const reviews = findings.filter(item => item.severity === 'review').length;
  const compatibility = blockers ? 'incompatible' : reviews ? 'review' : 'compatible';
  const totalBytes = files.reduce((sum, record) => sum + record.size, 0);

  return {
    compatibility,
    contract,
    findings,
    files,
    parsedProfileCount: parsedProfiles.length,
    references,
    totals: {
      files: files.length,
      bytes: totalBytes,
      blockers,
      reviews,
      notes: findings.filter(item => item.severity === 'note').length,
      scripts: files.filter(record => record.kind === 'script').length,
      nativeFiles: files.filter(record => record.kind === 'native').length,
    },
  };
}
