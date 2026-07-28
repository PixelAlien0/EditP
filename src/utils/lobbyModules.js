import { encodeLobbyBase64 } from './tweakSerializer.js';
import {
  BUILDMENU_BEGIN,
  BUILDMENU_END,
  CARRIER_LINKAGE_BEGIN,
  CARRIER_LINKAGE_END,
  CLONES_BEGIN,
  CLONES_END,
  DEATH_PROFILE_BEGIN,
  DEATH_PROFILE_END,
  SUPPORTING_WEAPONDEFS_BEGIN,
  SUPPORTING_WEAPONDEFS_END,
  UNIT_TWEAKS_BEGIN,
  UNIT_TWEAKS_END,
} from './tweakdefsHelper.js';

export const MAX_DEFS_SLOTS = 9;
export const MAX_UNITS_SLOTS = 9;
export const GENERATED_SLOT_TARGET = 10000;
export const COMPILER_BLOCK_SCHEMA_VERSION = 1;

const FEATURE_MARKERS = [
  { begin: CLONES_BEGIN, end: CLONES_END, category: 'clone-definitions', feature: 'cloned-units' },
  { begin: UNIT_TWEAKS_BEGIN, end: UNIT_TWEAKS_END, category: 'unit-def-patches', feature: 'unit-parameters' },
  { begin: CARRIER_LINKAGE_BEGIN, end: CARRIER_LINKAGE_END, category: 'carrier-linkages', feature: 'carrier-workbench' },
  { begin: SUPPORTING_WEAPONDEFS_BEGIN, end: SUPPORTING_WEAPONDEFS_END, category: 'supporting-weapondefs', feature: 'weapon-dependencies' },
  { begin: BUILDMENU_BEGIN, end: BUILDMENU_END, category: 'build-menu', feature: 'build-menus' },
  { begin: DEATH_PROFILE_BEGIN, end: DEATH_PROFILE_END, category: 'death-profiles', feature: 'explosion-profiles' },
];

const textEncoder = new TextEncoder();

function normalizedDependencies(dependencies) {
  return [...new Set((dependencies || [])
    .map(value => String(value || '').trim())
    .filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

function canonicalBlock({
  id,
  label,
  kind,
  category,
  source,
  stage,
  order,
  sourceFeature,
  lua,
  atomic = true,
  dependencies = [],
  metadata = {},
}) {
  const normalizedLua = String(lua || '').trim();
  if (!normalizedLua) return null;
  return {
    schemaVersion: COMPILER_BLOCK_SCHEMA_VERSION,
    id,
    label,
    kind,
    category,
    source,
    stage,
    order,
    sourceFeature,
    lua: normalizedLua,
    atomic,
    dependencies: normalizedDependencies(dependencies),
    rawBytes: textEncoder.encode(normalizedLua).byteLength,
    metadata,
  };
}

function normalizeImported(modules, kind, stage) {
  return (modules || [])
    .filter(module => module.enabled && !module.converted && module.kind === kind && module.stage === stage)
    .sort((left, right) => (Number(left.order) || 0) - (Number(right.order) || 0)
      || String(left.label || '').localeCompare(String(right.label || ''))
      || String(left.id || '').localeCompare(String(right.id || '')))
    .map((module, index) => canonicalBlock({
      id: `imported:${kind}:${module.id}`,
      label: module.label || module.id || `Imported ${kind} module ${index + 1}`,
      kind,
      category: 'imported-module',
      source: 'imported',
      stage,
      order: Number.isFinite(Number(module.order)) ? Number(module.order) : index,
      sourceFeature: 'tweak-package',
      lua: module.rawLua,
      atomic: true,
      dependencies: module.dependencies,
      metadata: {
        moduleId: module.id,
        label: module.label,
        sourceName: module.sourceName || '',
        originalFieldName: module.originalFieldName || '',
      },
    }))
    .filter(Boolean);
}

function splitSerializedUnitTable(lua) {
  const source = String(lua || '').trim();
  if (!source.startsWith('{') || !source.endsWith('}')) return [source];
  const entries = [];
  let depth = 0;
  let quote = null;
  let escaped = false;
  let entryStart = 1;
  for (let index = 0; index < source.length - 1; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === '"' || character === "'") { quote = character; continue; }
    if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    else if (character === ',' && depth === 1) {
      const entry = source.slice(entryStart, index + 1).trim();
      if (entry) entries.push(entry);
      entryStart = index + 1;
    }
  }
  const tail = source.slice(entryStart, -1).trim();
  if (tail) entries.push(tail);
  return entries.length ? entries.map(entry => `{\n  ${entry.replace(/^\s*/, '')}\n}`) : [source];
}

function findMarkedSpans(source) {
  const spans = [];
  FEATURE_MARKERS.forEach(marker => {
    let searchFrom = 0;
    let occurrence = 0;
    while (searchFrom < source.length) {
      const start = source.indexOf(marker.begin, searchFrom);
      if (start < 0) break;
      const endStart = source.indexOf(marker.end, start + marker.begin.length);
      if (endStart < 0) break;
      occurrence += 1;
      spans.push({
        ...marker,
        occurrence,
        start,
        end: endStart + marker.end.length,
      });
      searchFrom = endStart + marker.end.length;
    }
  });
  return spans.sort((left, right) => left.start - right.start);
}

function addLegacyCloneSpan(source, spans) {
  if (spans.some(span => span.category === 'clone-definitions')) return spans;
  const cloneBlock = source.match(/^do\r?\n(?=[\s\S]*?local function clone_copy\b)[\s\S]*?^end\r?\n^end(?=\r?\n\r?\n|$)/m);
  if (!cloneBlock) return spans;
  return [...spans, {
    category: 'clone-definitions',
    feature: 'cloned-units',
    occurrence: 1,
    start: cloneBlock.index,
    end: cloneBlock.index + cloneBlock[0].length,
  }].sort((left, right) => left.start - right.start);
}

function splitGeneratedDefinitions(lua) {
  const source = String(lua || '').trim();
  const blocks = [];
  const spans = addLegacyCloneSpan(source, findMarkedSpans(source));
  let cursor = 0;
  let customIndex = 0;
  spans.forEach(span => {
    if (span.start < cursor) return;
    const prefix = source.slice(cursor, span.start).trim();
    if (prefix) {
      customIndex += 1;
      blocks.push({
        category: 'custom-generated-source',
        feature: 'legacy-source',
        occurrence: customIndex,
        lua: prefix,
      });
    }
    blocks.push({
      category: span.category,
      feature: span.feature,
      occurrence: span.occurrence,
      lua: source.slice(span.start, span.end).trim(),
    });
    cursor = span.end;
  });
  const suffix = source.slice(cursor).trim();
  if (suffix) {
    customIndex += 1;
    blocks.push({
      category: 'custom-generated-source',
      feature: 'legacy-source',
      occurrence: customIndex,
      lua: suffix,
    });
  }
  return blocks.length ? blocks : [{
    category: 'generated-definitions',
    feature: 'editor-definitions',
    occurrence: 1,
    lua: source,
  }];
}

function extractUnitId(lua, fallbackIndex) {
  const match = String(lua || '').match(/^\{\s*(?:([A-Za-z_][A-Za-z0-9_]*)|\["((?:\\.|[^"])*)"\])\s*=/);
  return match?.[1] || match?.[2] || `entry-${fallbackIndex}`;
}

function generatedCanonicalBlocks(kind, lua) {
  if (!String(lua || '').trim() || (kind === 'units' && String(lua).trim() === '{}')) return [];
  if (kind === 'units') {
    return splitSerializedUnitTable(lua).map((blockLua, index) => {
      const unitId = extractUnitId(blockLua, index + 1);
      return canonicalBlock({
        id: `generated:units:unit-patch:${unitId}`,
        label: `Unit patch · ${unitId}`,
        kind,
        category: 'unit-patch',
        source: 'generated',
        stage: 'editor',
        order: index,
        sourceFeature: 'unit-parameters',
        lua: blockLua,
        metadata: { unitId },
      });
    }).filter(Boolean);
  }
  return splitGeneratedDefinitions(lua).map((descriptor, index) => canonicalBlock({
    id: `generated:defs:${descriptor.category}:${descriptor.occurrence}`,
    label: descriptor.category
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' '),
    kind,
    category: descriptor.category,
    source: 'generated',
    stage: 'editor',
    order: index,
    sourceFeature: descriptor.feature,
    lua: descriptor.lua,
  })).filter(Boolean);
}

function combineUnitTables(left, right) {
  return `{\n${left.trim().slice(1, -1).trim()}\n${right.trim().slice(1, -1).trim()}\n}`;
}

function packedGeneratedBlock(kind, blocks, lua, index) {
  const blockIds = blocks.map(block => block.id);
  const features = [...new Set(blocks.map(block => block.sourceFeature))];
  const dependencies = normalizedDependencies(blocks.flatMap(block => block.dependencies));
  return {
    schemaVersion: COMPILER_BLOCK_SCHEMA_VERSION,
    id: `generated-${kind}-${index + 1}`,
    kind,
    category: 'generated-slot',
    source: 'generated',
    stage: 'editor',
    order: index,
    sourceFeature: features.length === 1 ? features[0] : 'editor-generated',
    label: `Editor ${kind === 'defs' ? 'definitions' : 'unit patches'} ${index + 1}`,
    lua,
    atomic: true,
    dependencies,
    rawBytes: textEncoder.encode(lua).byteLength,
    blockIds,
    blockCount: blockIds.length,
    features,
  };
}

function isCommentOnlyLua(lua) {
  return String(lua || '').split(/\r?\n/).every(line => {
    const trimmed = line.trim();
    return !trimmed || trimmed.startsWith('--');
  });
}

function packGeneratedBlocks(blocks, kind) {
  const packed = [];
  blocks.filter(Boolean).forEach(block => {
    const current = packed.at(-1);
    const combined = current
      ? kind === 'units'
        ? combineUnitTables(current.lua, block.lua)
        : `${current.lua}\n\n${block.lua}`
      : block.lua;
    const encodedLength = encodeLobbyBase64(`${combined} `, { padding: false }).length;
    const currentIsHeader = kind === 'defs'
      && current
      && current.blocks.every(item => isCommentOnlyLua(item.lua));
    if (current && (encodedLength <= GENERATED_SLOT_TARGET || currentIsHeader)) {
      current.lua = combined;
      current.blocks.push(block);
    } else {
      packed.push({ lua: block.lua, blocks: [block] });
    }
  });
  return packed.map((entry, index) => packedGeneratedBlock(kind, entry.blocks, entry.lua, index));
}

function materializeLane(blocks, kind) {
  const output = [];
  let pendingGenerated = [];
  const flushGenerated = () => {
    if (!pendingGenerated.length) return;
    output.push(...packGeneratedBlocks(pendingGenerated, kind));
    pendingGenerated = [];
  };
  blocks.forEach(block => {
    if (block.source === 'generated') {
      pendingGenerated.push(block);
      return;
    }
    flushGenerated();
    output.push({
      ...block,
      id: block.metadata.moduleId,
      blockIds: [block.id],
      blockCount: 1,
      features: [block.sourceFeature],
    });
  });
  flushGenerated();
  return output;
}

export function buildCanonicalCompilerBlocks(projectState = {}) {
  const imported = projectState.tweakModules || [];
  const defs = [
    ...normalizeImported(imported, 'defs', 'before-editor'),
    ...generatedCanonicalBlocks('defs', projectState.generatedTweakDefsLua),
    ...normalizeImported(imported, 'defs', 'after-editor'),
  ].map((block, sequence) => ({ ...block, sequence }));
  const units = [
    ...normalizeImported(imported, 'units', 'before-editor'),
    ...generatedCanonicalBlocks('units', projectState.generatedTweakUnitsLua),
    ...normalizeImported(imported, 'units', 'after-editor'),
  ].map((block, sequence) => ({ ...block, sequence }));
  return {
    schemaVersion: COMPILER_BLOCK_SCHEMA_VERSION,
    defs,
    units,
    all: [...defs, ...units],
  };
}

function finalizeSlots(blocks, kind, maximum, padding) {
  const required = blocks.length;
  const overflow = required > maximum;
  const prepared = blocks.map(block => {
    const encoded = encodeLobbyBase64(`${block.lua} `, { padding });
    return { ...block, encoded, encodedBytes: encoded.length };
  });
  const slots = prepared.slice(0, maximum).map((block, index) => {
    const encoded = block.encoded;
    const fieldName = `tweak${kind}${index + 1}`;
    return {
      ...block,
      index: index + 1,
      fieldName,
      encoded,
      compatibility: encoded.length > 12000 ? 'advisory' : 'ok',
      command: `!bset ${fieldName} ${encoded}`,
    };
  });
  const largestModules = [...prepared]
    .sort((left, right) => right.encodedBytes - left.encodedBytes)
    .slice(0, 3)
    .map(({ id, label, encodedBytes, source }) => ({ id, label, encodedBytes, source }));
  return { kind, slots, required, maximum, overflow, largestModules };
}

export function compileLobbyModules(projectState, options = {}) {
  const maxDefsSlots = options.maxDefsSlots ?? MAX_DEFS_SLOTS;
  const maxUnitsSlots = options.maxUnitsSlots ?? MAX_UNITS_SLOTS;
  const canonicalBlocks = buildCanonicalCompilerBlocks(projectState);
  const defsBlocks = materializeLane(canonicalBlocks.defs, 'defs');
  const unitsBlocks = materializeLane(canonicalBlocks.units, 'units');
  const defs = finalizeSlots(defsBlocks, 'defs', maxDefsSlots, projectState.base64Options?.padding ?? false);
  const units = finalizeSlots(unitsBlocks, 'units', maxUnitsSlots, projectState.base64Options?.padding ?? false);
  const overflow = defs.overflow || units.overflow;
  const allSlots = [...defs.slots, ...units.slots];
  return {
    defs,
    units,
    overflow,
    slots: allSlots,
    aggregateBytes: allSlots.reduce((total, slot) => total + slot.encodedBytes, 0),
    canonicalBlocks,
  };
}

export function buildLobbyCommands(compiledModules) {
  if (!compiledModules || compiledModules.overflow) return '';
  return compiledModules.slots.map(slot => slot.command).join('\n');
}
