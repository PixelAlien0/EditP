import { normalizeUnitCollections } from './unitCollections.js';

export const PROJECT_DOCUMENT_VERSION = '1.8';
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

function normalizeLiteralTree(value, depth = 0) {
  if (depth > 12) return undefined;
  if (scalar(value)) return value;
  if (Array.isArray(value)) {
    return value.slice(0, 500).map(item => normalizeLiteralTree(item, depth + 1)).filter(item => item !== undefined);
  }
  if (!isRecord(value)) return undefined;
  const result = {};
  Object.entries(value).slice(0, 1000).forEach(([key, item]) => {
    const normalizedKey = text(key, '', 160).trim().toLowerCase();
    const normalizedValue = normalizeLiteralTree(item, depth + 1);
    if (normalizedKey && normalizedValue !== undefined) result[normalizedKey] = normalizedValue;
  });
  return result;
}

function normalizeSupportingWeaponDefs(value) {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set();
  const seenDestinations = new Set();
  return value.slice(0, 1000).flatMap((rawDefinition, index) => {
    if (!isRecord(rawDefinition)) return [];
    const ownerUnitId = unitId(rawDefinition.ownerUnitId);
    const key = unitId(rawDefinition.key);
    const definition = normalizeLiteralTree(rawDefinition.definition);
    const fallbackId = ownerUnitId && key ? `support_${ownerUnitId}_${key}` : `support_${index + 1}`;
    const id = text(rawDefinition.id, fallbackId, 240).replace(/[^a-z0-9_:-]/gi, '_').toLowerCase();
    const destination = `${ownerUnitId}:${key}`;
    if (!ownerUnitId || !key || !isRecord(definition) || !Object.keys(definition).length || !id || seenIds.has(id) || seenDestinations.has(destination)) return [];
    seenIds.add(id);
    seenDestinations.add(destination);
    const clusterDependency = typeof definition.customparams?.cluster_def === 'string'
      ? unitId(definition.customparams.cluster_def)
      : null;
    return [{
      id,
      ownerUnitId,
      key,
      label: text(rawDefinition.label, key.toUpperCase(), 160).trim() || key.toUpperCase(),
      definition,
      enabled: rawDefinition.enabled !== false,
      mode: rawDefinition.mode === 'create-only' ? 'create-only' : 'replace',
      role: rawDefinition.role === 'dependency' ? 'dependency' : rawDefinition.role === 'mounted' ? 'mounted' : 'auxiliary',
      mountedSlots: Array.isArray(rawDefinition.mountedSlots)
        ? [...new Set(rawDefinition.mountedSlots.map(Number).filter(slot => Number.isInteger(slot) && slot > 0))].slice(0, 64)
        : [],
      dependencies: clusterDependency ? [clusterDependency] : [],
      referencedBy: idList(rawDefinition.referencedBy),
      sourceModuleId: text(rawDefinition.sourceModuleId, '', 240),
      sourceName: text(rawDefinition.sourceName, '', 260),
      attribution: text(rawDefinition.attribution, '', 500),
    }];
  });
}

function normalizeTweakModules(value) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value.slice(0, 500).flatMap((rawModule, index) => {
    if (!isRecord(rawModule)) return [];
    const kind = rawModule.kind === 'units' ? 'units' : rawModule.kind === 'defs' ? 'defs' : null;
    const rawLua = text(rawModule.rawLua, '', 1024 * 1024);
    const contentHash = text(rawModule.contentHash, '', 120).trim();
    const id = text(rawModule.id, `${kind || 'module'}-${index + 1}`, 160).trim();
    if (!kind || !rawLua || !id || seen.has(id)) return [];
    seen.add(id);
    return [{
      id,
      kind,
      label: text(rawModule.label, `${kind === 'defs' ? 'Definitions' : 'Units'} module ${index + 1}`, 160),
      sourceName: text(rawModule.sourceName, '', 260),
      originalFieldName: text(rawModule.originalFieldName, '', 40),
      rawLua,
      originalPayload: text(rawModule.originalPayload, '', 2 * 1024 * 1024),
      contentHash,
      enabled: Boolean(rawModule.enabled),
      converted: Boolean(rawModule.converted),
      stage: rawModule.stage === 'after-editor' ? 'after-editor' : 'before-editor',
      order: Number.isFinite(Number(rawModule.order)) ? Number(rawModule.order) : index,
      attribution: text(rawModule.attribution, '', 500),
      requirements: Array.isArray(rawModule.requirements)
        ? [...new Set(rawModule.requirements.map(item => text(item, '', 80).trim()).filter(Boolean))].slice(0, 10)
        : [],
    }];
  });
}

const LOBBY_COMMAND_CATEGORIES = new Set([
  'game-settings', 'lobby-control', 'map-setup', 'lobby-identity', 'unknown',
]);
const LOBBY_COMMAND_SAFETY = new Set(['review', 'manual', 'unknown']);
const TWEAK_FIELD_PATTERN = /^tweak(?:defs|units)(?:[1-9])?$/i;

function normalizeLobbySetup(value) {
  const empty = {
    version: 1,
    sourceName: '',
    importedAt: '',
    commands: [],
    slotClears: [],
    slotResetFields: [],
    requirements: [],
    ignoredLineCount: 0,
    overwrittenCount: 0,
  };
  if (!isRecord(value)) return empty;
  const commands = Array.isArray(value.commands) ? value.commands.slice(0, 500).flatMap((rawCommand, index) => {
    if (!isRecord(rawCommand)) return [];
    const prefix = rawCommand.prefix === '$' ? '$' : rawCommand.prefix === '!' ? '!' : null;
    const name = text(rawCommand.name, '', 80).trim().toLowerCase();
    const category = LOBBY_COMMAND_CATEGORIES.has(rawCommand.category) ? rawCommand.category : 'unknown';
    const safety = LOBBY_COMMAND_SAFETY.has(rawCommand.safety) ? rawCommand.safety : 'unknown';
    if (!prefix || !name) return [];
    return [{
      id: text(rawCommand.id, `lobby-${index + 1}`, 160).trim() || `lobby-${index + 1}`,
      prefix,
      name,
      key: text(rawCommand.key, '', 120).trim().toLowerCase(),
      value: text(rawCommand.value, '', 2000).trim(),
      raw: text(rawCommand.raw, '', 2400).trim(),
      line: Number.isInteger(Number(rawCommand.line)) && Number(rawCommand.line) > 0 ? Number(rawCommand.line) : index + 1,
      category,
      safety,
      enabled: rawCommand.enabled !== false,
    }];
  }) : [];
  const normalizeFields = fields => Array.isArray(fields)
    ? [...new Set(fields.map(field => text(field, '', 40).trim().toLowerCase()).filter(field => TWEAK_FIELD_PATTERN.test(field)))].slice(0, 20)
    : [];
  return {
    version: 1,
    sourceName: text(value.sourceName, '', 260).trim(),
    importedAt: text(value.importedAt, '', 80).trim(),
    commands,
    slotClears: normalizeFields(value.slotClears),
    slotResetFields: normalizeFields(value.slotResetFields),
    requirements: Array.isArray(value.requirements)
      ? [...new Set(value.requirements.map(item => text(item, '', 80).trim()).filter(Boolean))].slice(0, 20)
      : [],
    ignoredLineCount: Math.max(0, Number(value.ignoredLineCount) || 0),
    overwrittenCount: Math.max(0, Number(value.overwrittenCount) || 0),
  };
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
    supportingWeaponDefs: normalizeSupportingWeaponDefs(migrated.supportingWeaponDefs),
    unitCollections: normalizeUnitCollections(migrated.unitCollections),
    tweakModules: normalizeTweakModules(migrated.tweakModules),
    lobbySetup: normalizeLobbySetup(migrated.lobbySetup),
    projectName: text(migrated.projectName, 'BAR Editor Mod', 120).trim() || 'BAR Editor Mod',
    projectAuthor: text(migrated.projectAuthor, 'Developer', 120).trim() || 'Developer',
    projectDesc: text(migrated.projectDesc, 'A custom unit configuration mod.', 2000),
    includeTweaks: migrated.includeTweaks !== false,
    includeClones: migrated.includeClones !== false,
    includeRosters: migrated.includeRosters !== false,
    includeHeader: migrated.includeHeader !== false,
  };
}

export function createProjectDocument(state) {
  return normalizeProjectDocument({ ...state, version: PROJECT_DOCUMENT_VERSION });
}
