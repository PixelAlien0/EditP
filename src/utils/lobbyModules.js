import { encodeLobbyBase64 } from './tweakSerializer.js';
import luaparse from 'luaparse';
import {
  GENERATED_SLOT_TARGET_BYTES,
  LOBBY_SLOT_LIMIT_CHARACTERS,
} from './byteBudget.js';
import { compactLuaIfEquivalent } from './luaCompaction.js';
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
export const GENERATED_SLOT_TARGET = GENERATED_SLOT_TARGET_BYTES;
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

function compareCanonicalText(left, right) {
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

function normalizeCompilerLua(lua) {
  return String(lua || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function normalizedDependencies(dependencies) {
  return [...new Set((dependencies || [])
    .map(value => String(value || '').trim())
    .filter(Boolean))]
    .sort(compareCanonicalText);
}

function canonicalExecutionKey(block) {
  const executionLua = block.source === 'generated'
    ? compactLuaIfEquivalent(block.lua, {
      kind: block.kind,
      enabled: true,
      padding: false,
    }).lua.replace(/^(?:\s*--[^\n]*(?:\n|$))+/, '').trim()
    : block.lua;
  return [
    block.kind,
    block.stage,
    block.source,
    block.category,
    block.sourceFeature,
    block.atomic ? 'atomic' : 'composable',
    executionLua,
  ].join('\u001f');
}

function blockProvenance(block) {
  return {
    id: block.id,
    label: block.label,
    source: block.source,
    moduleId: block.metadata?.moduleId || '',
    sourceName: block.metadata?.sourceName || '',
    originalFieldName: block.metadata?.originalFieldName || '',
  };
}

function deduplicateCanonicalLane(blocks, kind) {
  const retained = [];
  const byExecution = new Map();
  const groupsByRetainedId = new Map();

  blocks.forEach(block => {
    const key = canonicalExecutionKey(block);
    const retainedIndex = byExecution.get(key);
    if (retainedIndex === undefined) {
      byExecution.set(key, retained.length);
      retained.push({
        ...block,
        deduplicatedBlockIds: [],
        provenance: [blockProvenance(block)],
      });
      return;
    }

    const original = retained[retainedIndex];
    const next = {
      ...original,
      dependencies: normalizedDependencies([...original.dependencies, ...block.dependencies]),
      deduplicatedBlockIds: [...original.deduplicatedBlockIds, block.id],
      provenance: [...original.provenance, blockProvenance(block)],
    };
    retained[retainedIndex] = next;
    const group = groupsByRetainedId.get(original.id) || {
      kind,
      stage: original.stage,
      source: original.source,
      category: original.category,
      retainedBlockId: original.id,
      retainedLabel: original.label,
      removedBlockIds: [],
      removedLabels: [],
      rawBytesSaved: 0,
    };
    group.removedBlockIds.push(block.id);
    group.removedLabels.push(block.label);
    group.rawBytesSaved += block.rawBytes;
    groupsByRetainedId.set(original.id, group);
  });

  return {
    blocks: retained,
    groups: [...groupsByRetainedId.values()],
  };
}

export function deduplicateCanonicalBlocks(canonicalBlocks) {
  const defs = deduplicateCanonicalLane(canonicalBlocks?.defs || [], 'defs');
  const units = deduplicateCanonicalLane(canonicalBlocks?.units || [], 'units');
  return {
    blocks: {
      schemaVersion: canonicalBlocks?.schemaVersion ?? COMPILER_BLOCK_SCHEMA_VERSION,
      defs: defs.blocks,
      units: units.blocks,
      all: [...defs.blocks, ...units.blocks],
    },
    groups: [...defs.groups, ...units.groups],
  };
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
  const normalizedLua = normalizeCompilerLua(lua);
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
      || compareCanonicalText(left.label, right.label)
      || compareCanonicalText(left.id, right.id)
      || compareCanonicalText(normalizeCompilerLua(left.rawLua), normalizeCompilerLua(right.rawLua)))
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
  const source = normalizeCompilerLua(lua);
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
  return entries.length
    ? entries
      .map((entry, index) => ({
        lua: `{\n  ${entry.replace(/^\s*/, '').replace(/,\s*$/, '')},\n}`,
        index,
      }))
      .sort((left, right) => (
        compareCanonicalText(extractUnitId(left.lua, left.index + 1), extractUnitId(right.lua, right.index + 1))
        || left.index - right.index
      ))
      .map(entry => entry.lua)
    : [source];
}

function recoverCompactedCloneEnd(source, markerStart) {
  try {
    const syntaxTree = luaparse.parse(source, {
      luaVersion: '5.1',
      comments: false,
      ranges: true,
    });
    const codeStart = markerStart + CLONES_BEGIN.length;
    const cloneScope = syntaxTree.body.find(statement => (
      statement.type === 'DoStatement'
      && statement.range?.[0] >= codeStart
    ));
    return cloneScope?.range?.[1] ?? -1;
  } catch {
    return -1;
  }
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
      const nextStart = source.indexOf(marker.begin, start + marker.begin.length);
      const orphaned = endStart < 0 || (nextStart >= 0 && nextStart < endStart);
      if (orphaned) {
        const recoveredEnd = marker.category === 'clone-definitions'
          ? recoverCompactedCloneEnd(source, start)
          : -1;
        if (recoveredEnd > start) {
          occurrence += 1;
          spans.push({
            ...marker,
            occurrence,
            start,
            end: recoveredEnd,
            recoveredBoundary: true,
          });
        }
        searchFrom = nextStart >= 0 ? nextStart : start + marker.begin.length;
        continue;
      }
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
  const source = normalizeCompilerLua(lua);
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
  const normalizedLua = normalizeCompilerLua(lua);
  // The generated Units serializer formats an empty table as `{\n}`. Treat
  // every whitespace-only table as empty so it cannot become a fabricated
  // `entry-1` canonical block and falsely block lobby export.
  if (!normalizedLua || (kind === 'units' && /^\{\s*\}$/.test(normalizedLua))) return [];
  if (kind === 'units') {
    return splitSerializedUnitTable(normalizedLua).map((blockLua, index) => {
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
  return splitGeneratedDefinitions(normalizedLua).map((descriptor, index) => canonicalBlock({
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

function packedGeneratedBlock(kind, blocks, lua, compaction, index) {
  const blockIds = blocks.flatMap(block => [block.id, ...(block.deduplicatedBlockIds || [])]);
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
    compaction,
    blockIds,
    blockCount: blockIds.length,
    executionBlockCount: blocks.length,
    deduplicatedBlockCount: blockIds.length - blocks.length,
    features,
  };
}

function isCommentOnlyLua(lua) {
  return String(lua || '').split(/\r?\n/).every(line => {
    const trimmed = line.trim();
    return !trimmed || trimmed.startsWith('--');
  });
}

function packGeneratedBlocks(blocks, kind, options) {
  const packed = [];
  blocks.filter(Boolean).forEach(block => {
    const current = packed.at(-1);
    const combinedSource = current
      ? kind === 'units'
        ? combineUnitTables(current.sourceLua, block.lua)
        : `${current.sourceLua}\n\n${block.lua}`
      : block.lua;
    const compaction = compactLuaIfEquivalent(combinedSource, {
      kind,
      enabled: options.compactGenerated,
      padding: options.padding,
    });
    const encodedLength = compaction.encodedBytesAfter;
    const currentIsHeader = kind === 'defs'
      && current
      && current.blocks.every(item => isCommentOnlyLua(item.lua));
    if (current && (encodedLength <= GENERATED_SLOT_TARGET || currentIsHeader)) {
      current.sourceLua = combinedSource;
      current.lua = compaction.lua;
      current.compaction = compaction;
      current.blocks.push(block);
    } else {
      // `compaction` describes `current + block` when a current slot exists.
      // A new slot must be compiled from the incoming block alone; otherwise
      // every block from the previous slot is duplicated into this field.
      const isolatedCompaction = current
        ? compactLuaIfEquivalent(block.lua, {
          kind,
          enabled: options.compactGenerated,
          padding: options.padding,
        })
        : compaction;
      packed.push({
        sourceLua: block.lua,
        lua: isolatedCompaction.lua,
        compaction: isolatedCompaction,
        blocks: [block],
      });
    }
  });
  return packed.map((entry, index) => packedGeneratedBlock(
    kind,
    entry.blocks,
    entry.lua,
    entry.compaction,
    index,
  ));
}

function materializeLane(blocks, kind, options) {
  const output = [];
  let pendingGenerated = [];
  const flushGenerated = () => {
    if (!pendingGenerated.length) return;
    output.push(...packGeneratedBlocks(pendingGenerated, kind, options));
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
      blockIds: [block.id, ...(block.deduplicatedBlockIds || [])],
      blockCount: 1 + (block.deduplicatedBlockIds?.length || 0),
      executionBlockCount: 1,
      deduplicatedBlockCount: block.deduplicatedBlockIds?.length || 0,
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
  const slotOverflow = required > maximum;
  const prepared = blocks.map(block => {
    const encoded = encodeLobbyBase64(`${block.lua} `, { padding });
    return { ...block, encoded, encodedBytes: encoded.length };
  });
  const oversizedModules = prepared.filter(block => (
    block.encodedBytes > LOBBY_SLOT_LIMIT_CHARACTERS
  ));
  const sizeOverflow = oversizedModules.length > 0;
  const overflow = slotOverflow || sizeOverflow;
  const slots = prepared.slice(0, maximum).map((block, index) => {
    const encoded = block.encoded;
    const fieldName = `tweak${kind}${index + 1}`;
    return {
      ...block,
      index: index + 1,
      fieldName,
      encoded,
      compatibility: encoded.length > LOBBY_SLOT_LIMIT_CHARACTERS
        ? 'blocked'
        : encoded.length >= GENERATED_SLOT_TARGET_BYTES
          ? 'near-limit'
          : 'ok',
      command: `!bset ${fieldName} ${encoded}`,
    };
  });
  const largestModules = [...prepared]
    .sort((left, right) => (
      right.encodedBytes - left.encodedBytes
      || compareCanonicalText(left.kind, right.kind)
      || compareCanonicalText(left.id, right.id)
    ))
    .slice(0, 3)
    .map(({ id, label, encodedBytes, source }) => ({ id, label, encodedBytes, source }));
  const compacted = prepared.filter(block => block.compaction?.applied);
  return {
    kind,
    slots,
    required,
    maximum,
    overflow,
    slotOverflow,
    sizeOverflow,
    oversizedModules: oversizedModules.map(({ id, label, encodedBytes, source }) => ({
      id, label, encodedBytes, source,
    })),
    largestModules,
    totalEncodedBytes: prepared.reduce((total, block) => total + block.encodedBytes, 0),
    compaction: {
      attemptedSlotCount: prepared.filter(block => block.compaction?.attempted).length,
      appliedSlotCount: compacted.length,
      rawBytesSaved: compacted.reduce((total, block) => total + block.compaction.rawBytesSaved, 0),
      encodedBytesSaved: compacted.reduce((total, block) => total + block.compaction.encodedBytesSaved, 0),
      fallbackSlotCount: prepared.filter(block => (
        block.source === 'generated'
        && block.compaction?.attempted
        && !block.compaction?.applied
        && !['not-smaller', 'empty-source'].includes(block.compaction.reason)
      )).length,
    },
  };
}

export function compileLobbyModules(projectState, options = {}) {
  const maxDefsSlots = options.maxDefsSlots ?? MAX_DEFS_SLOTS;
  const maxUnitsSlots = options.maxUnitsSlots ?? MAX_UNITS_SLOTS;
  // BAR lobby fields use one canonical encoding. Padding is intentionally
  // disabled even when an older project document contains base64Options.
  const base64Padding = false;
  const compactionOptions = {
    compactGenerated: options.compactGenerated !== false,
    padding: base64Padding,
  };
  const canonicalBlocks = buildCanonicalCompilerBlocks(projectState);
  const deduplicated = options.deduplicate === false
    ? { blocks: canonicalBlocks, groups: [] }
    : deduplicateCanonicalBlocks(canonicalBlocks);
  const defsBlocks = materializeLane(deduplicated.blocks.defs, 'defs', compactionOptions);
  const unitsBlocks = materializeLane(deduplicated.blocks.units, 'units', compactionOptions);
  const defs = finalizeSlots(defsBlocks, 'defs', maxDefsSlots, base64Padding);
  const units = finalizeSlots(unitsBlocks, 'units', maxUnitsSlots, base64Padding);
  const hasDuplicates = deduplicated.groups.length > 0;
  const baselineDefs = hasDuplicates
    ? finalizeSlots(materializeLane(canonicalBlocks.defs, 'defs', compactionOptions), 'defs', maxDefsSlots, base64Padding)
    : defs;
  const baselineUnits = hasDuplicates
    ? finalizeSlots(materializeLane(canonicalBlocks.units, 'units', compactionOptions), 'units', maxUnitsSlots, base64Padding)
    : units;
  const overflow = defs.overflow || units.overflow;
  const allSlots = [...defs.slots, ...units.slots];
  const removedBlockCount = deduplicated.groups.reduce(
    (total, group) => total + group.removedBlockIds.length,
    0,
  );
  const rawBytesSaved = deduplicated.groups.reduce((total, group) => total + group.rawBytesSaved, 0);
  const baselineEncodedBytes = baselineDefs.totalEncodedBytes + baselineUnits.totalEncodedBytes;
  const effectiveEncodedBytes = defs.totalEncodedBytes + units.totalEncodedBytes;
  return {
    defs,
    units,
    overflow,
    slots: allSlots,
    aggregateBytes: allSlots.reduce((total, slot) => total + slot.encodedBytes, 0),
    canonicalBlocks,
    effectiveBlocks: deduplicated.blocks,
    base64Padding,
    compaction: {
      enabled: options.compactGenerated !== false,
      equivalenceGuarded: true,
      attemptedSlotCount: defs.compaction.attemptedSlotCount + units.compaction.attemptedSlotCount,
      appliedSlotCount: defs.compaction.appliedSlotCount + units.compaction.appliedSlotCount,
      rawBytesSaved: defs.compaction.rawBytesSaved + units.compaction.rawBytesSaved,
      encodedBytesSaved: defs.compaction.encodedBytesSaved + units.compaction.encodedBytesSaved,
      fallbackSlotCount: defs.compaction.fallbackSlotCount + units.compaction.fallbackSlotCount,
    },
    deduplication: {
      enabled: options.deduplicate !== false,
      groups: deduplicated.groups,
      removedBlockCount,
      rawBytesSaved,
      encodedBytesSaved: Math.max(0, baselineEncodedBytes - effectiveEncodedBytes),
      slotsSaved: Math.max(0, baselineDefs.required + baselineUnits.required - defs.required - units.required),
      before: {
        blockCount: canonicalBlocks.all.length,
        slotCount: baselineDefs.required + baselineUnits.required,
        encodedBytes: baselineEncodedBytes,
      },
      after: {
        blockCount: deduplicated.blocks.all.length,
        slotCount: defs.required + units.required,
        encodedBytes: effectiveEncodedBytes,
      },
    },
  };
}

export function buildLobbyCommands(compiledModules) {
  if (!compiledModules || compiledModules.overflow) return '';
  return compiledModules.slots.map(slot => slot.command).join('\n');
}
