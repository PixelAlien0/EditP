import { normalizeUnitCollections } from './unitCollections.js';

export const PROJECT_DOCUMENT_VERSION = '1.6';
export const MAX_PROJECT_BYTES = 5 * 1024 * 1024;

const UNIT_ID_PATTERN = /^[a-z0-9_]+$/i;

export class ProjectDocumentError extends Error {
  constructor(message, code = 'INVALID_PROJECT') {
    super(message);
    this.name = 'ProjectDocumentError';
    this.code = code;
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function text(value, fallback = '', maxLength = 5000) {
  return typeof value === 'string' ? value.slice(0, maxLength) : fallback;
}

function unitId(value) {
  const normalized = text(value).trim().toLowerCase();
  return UNIT_ID_PATTERN.test(normalized) ? normalized : null;
}

function idList(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(unitId).filter(Boolean))];
}

function scalar(value) {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function normalizeTweaks(value) {
  if (!isRecord(value)) return {};
  const result = {};
  Object.entries(value).forEach(([rawId, rawPatch]) => {
    const id = unitId(rawId);
    if (!id || !isRecord(rawPatch)) return;
    const patch = Object.fromEntries(Object.entries(rawPatch)
      .filter(([key, item]) => text(key).length <= 160 && scalar(item)));
    if (Object.keys(patch).length) result[id] = patch;
  });
  return result;
}

function normalizeClones(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.flatMap(rawClone => {
    if (!isRecord(rawClone)) return [];
    const baseId = unitId(rawClone.baseId);
    const newId = unitId(rawClone.newId);
    if (!baseId || !newId || seen.has(newId)) return [];
    seen.add(newId);
    return [{
      ...structuredClone(rawClone),
      baseId,
      newId,
      name: text(rawClone.name, newId, 160),
      description: text(rawClone.description, '', 1000),
      builderIds: idList(rawClone.builderIds),
      weaponSwaps: isRecord(rawClone.weaponSwaps) ? structuredClone(rawClone.weaponSwaps) : {},
    }];
  });
}

function normalizeBuildMenuSteps(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap(rawStep => {
    if (!isRecord(rawStep)) return [];
    const builderId = unitId(rawStep.builderId);
    if (!builderId) return [];
    return [{ builderId, add: idList(rawStep.add), remove: idList(rawStep.remove), order: idList(rawStep.order) }];
  });
}

function normalizeDescriptions(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([rawId, description]) => {
    const id = unitId(rawId);
    const normalized = text(description, '', 1000).trim();
    return id && normalized ? [[id, normalized]] : [];
  }));
}

function safeArray(value, maxItems = 5000) {
  return Array.isArray(value) ? structuredClone(value.slice(0, maxItems)) : [];
}

export function assertProjectSize(value) {
  const bytes = typeof value === 'number'
    ? value
    : typeof value === 'string'
    ? new TextEncoder().encode(value).byteLength
    : new TextEncoder().encode(JSON.stringify(value)).byteLength;
  if (bytes > MAX_PROJECT_BYTES) {
    throw new ProjectDocumentError('Project files must be 5 MB or smaller.', 'PROJECT_TOO_LARGE');
  }
  return bytes;
}

export function migrateProjectDocument(input) {
  if (!isRecord(input)) throw new ProjectDocumentError('This file does not contain a BAR Editor project.');
  assertProjectSize(input);
  return { ...input, version: PROJECT_DOCUMENT_VERSION };
}

export function normalizeProjectDocument(input) {
  const migrated = migrateProjectDocument(input);
  return {
    version: PROJECT_DOCUMENT_VERSION,
    tweaks: normalizeTweaks(migrated.tweaks),
    clones: normalizeClones(migrated.clones),
    disabledUnitIds: idList(migrated.disabledUnitIds),
    buildMenuSteps: normalizeBuildMenuSteps(migrated.buildMenuSteps),
    buildMenuPacks: {
      extraUnits: Boolean(migrated.buildMenuPacks?.extraUnits),
      scavengerUnits: Boolean(migrated.buildMenuPacks?.scavengerUnits),
    },
    unitDescriptions: normalizeDescriptions(migrated.unitDescriptions),
    weaponLibrary: safeArray(migrated.weaponLibrary, 1000),
    unitCollections: normalizeUnitCollections(migrated.unitCollections),
    projectName: text(migrated.projectName, 'BAR Editor Mod', 120).trim() || 'BAR Editor Mod',
    projectAuthor: text(migrated.projectAuthor, 'Developer', 120).trim() || 'Developer',
    projectDesc: text(migrated.projectDesc, 'A custom unit configuration mod.', 2000),
    includeTweaks: migrated.includeTweaks !== false,
    includeClones: migrated.includeClones !== false,
    includeRosters: migrated.includeRosters !== false,
    includeHeader: migrated.includeHeader !== false,
    forceAllUnits: migrated.forceAllUnits === true,
  };
}

export function createProjectDocument(state) {
  return normalizeProjectDocument({ ...state, version: PROJECT_DOCUMENT_VERSION });
}
