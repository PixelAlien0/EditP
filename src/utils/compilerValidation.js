import luaparse from 'luaparse';
import { encodeLobbyBase64 } from './tweakSerializer.js';
import { LOBBY_SLOT_LIMIT_CHARACTERS } from './byteBudget.js';

const textEncoder = new TextEncoder();

const CATEGORY_MARKERS = Object.freeze({
  'clone-definitions': ['-- EDITP_CLONES_BEGIN', '-- EDITP_CLONES_END'],
  'unit-def-patches': ['-- EDITP_UNIT_TWEAKS_BEGIN', '-- EDITP_UNIT_TWEAKS_END'],
  'carrier-linkages': ['-- EDITP_CARRIER_LINKAGE_BEGIN', '-- EDITP_CARRIER_LINKAGE_END'],
  'supporting-weapondefs': ['-- EDITP_SUPPORTING_WEAPONDEFS_BEGIN', '-- EDITP_SUPPORTING_WEAPONDEFS_END'],
  'build-menu': ['-- EDITP_BUILDMENU_BEGIN', '-- EDITP_BUILDMENU_END'],
  'death-profiles': ['-- EDITP_DEATH_PROFILES_BEGIN', '-- EDITP_DEATH_PROFILES_END'],
});

const INVALID_GENERATED_VALUE = /(?:^|[^\w])(?:undefined|NaN|Infinity)(?:[^\w]|$)|\[object Object\]/;

function compareCanonicalText(left, right) {
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

function normalizeLua(lua) {
  return String(lua || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
}

function executionSignature(block) {
  return [
    block.kind,
    block.stage,
    block.source,
    block.category,
    block.sourceFeature,
    block.atomic ? 'atomic' : 'composable',
    normalizeLua(block.lua),
  ].join('\u001f');
}

function parseLua(lua, kind) {
  const source = kind === 'units' ? `return ${lua}` : lua;
  return luaparse.parse(source, { luaVersion: '5.1', comments: false });
}

function tableUnitIds(ast) {
  const returned = ast?.body?.[0];
  const table = returned?.type === 'ReturnStatement' ? returned.arguments?.[0] : null;
  if (ast?.body?.length !== 1 || table?.type !== 'TableConstructorExpression') return null;
  return table.fields.map(field => {
    if (field.type === 'TableKeyString') return field.key?.name || null;
    if (field.type === 'TableKey' && field.key?.type === 'StringLiteral') return field.key.value || null;
    return null;
  });
}

function stableIssues(issues) {
  const levelOrder = { blocker: 0, warning: 1, info: 2 };
  return issues.sort((left, right) => (
    levelOrder[left.level] - levelOrder[right.level]
    || compareCanonicalText(left.lane, right.lane)
    || compareCanonicalText(left.fieldName, right.fieldName)
    || compareCanonicalText(left.blockId, right.blockId)
    || compareCanonicalText(left.code, right.code)
  ));
}

function validateCanonicalBlocks(canonicalBlocks, add) {
  if (canonicalBlocks?.schemaVersion !== 1) {
    add({ code: 'schema-version', level: 'blocker', message: `Unsupported canonical block schema ${canonicalBlocks?.schemaVersion ?? '(missing)'}.` });
  }
  const lanes = [
    ['defs', canonicalBlocks?.defs || []],
    ['units', canonicalBlocks?.units || []],
  ];
  const seenBlockIds = new Set();
  const blocksById = new Map();
  const generatedUnitIds = new Set();

  lanes.forEach(([lane, blocks]) => {
    blocks.forEach((block, index) => {
      const context = { lane, blockId: block?.id || `missing-${lane}-${index}`, source: block?.source };
      if (block?.schemaVersion !== 1) {
        add({ ...context, code: 'block-schema-version', level: 'blocker', message: `Block schema ${block?.schemaVersion ?? '(missing)'} is not supported.` });
      }
      if (!block?.id || seenBlockIds.has(block.id)) {
        add({ ...context, code: 'duplicate-block-id', level: 'blocker', message: `Canonical block ID ${block?.id || '(missing)'} is not unique.` });
      } else {
        seenBlockIds.add(block.id);
        blocksById.set(block.id, block);
      }
      if (block?.kind !== lane) {
        add({ ...context, code: 'lane-kind-mismatch', level: 'blocker', message: `Block kind ${block?.kind || '(missing)'} does not match the ${lane} lane.` });
      }
      if (lane === 'defs' && block?.metadata?.migratedFromLane === 'units') {
        const expectedUnitId = String(block.id || '').split(':').at(-1);
        if (!block.metadata.unitId || block.metadata.unitId !== expectedUnitId) {
          add({ ...context, code: 'generated-unit-identity', level: 'blocker', message: 'Post-definition unit patch metadata does not match its canonical UnitDef ID.' });
        }
      }
      if (block?.sequence !== index) {
        add({ ...context, code: 'sequence-gap', level: 'blocker', message: `Canonical sequence expected ${index}, received ${block?.sequence ?? '(missing)'}.` });
      }
      const normalizedLua = normalizeLua(block?.lua);
      if (!normalizedLua) {
        add({ ...context, code: 'empty-block', level: 'blocker', message: 'The compiler produced an empty canonical block.' });
        return;
      }
      const measuredBytes = textEncoder.encode(normalizedLua).byteLength;
      if (block.rawBytes !== measuredBytes) {
        add({ ...context, code: 'raw-byte-mismatch', level: 'blocker', message: `Recorded raw size ${block.rawBytes} does not match the ${measuredBytes}-byte block.` });
      }
      if (block.source === 'generated' && INVALID_GENERATED_VALUE.test(normalizedLua)) {
        add({ ...context, code: 'invalid-generated-value', level: 'blocker', message: 'Generated Lua contains an unserializable JavaScript value.' });
      }
      const markers = CATEGORY_MARKERS[block.category];
      if (block.source === 'generated' && markers && (!normalizedLua.includes(markers[0]) || !normalizedLua.includes(markers[1]))) {
        add({ ...context, code: 'feature-marker-mismatch', level: 'blocker', message: `${block.category} is missing its canonical feature boundaries.` });
      }

      try {
        const ast = parseLua(normalizedLua, lane);
        if (lane === 'units') {
          const unitIds = tableUnitIds(ast);
          if (!unitIds || unitIds.some(unitId => !unitId)) {
            add({ ...context, code: 'units-table-shape', level: 'blocker', message: 'A tweakunits block must return one literal table keyed by UnitDef ID.' });
          } else if (block.source === 'generated') {
            if (unitIds.length !== 1) {
              add({ ...context, code: 'generated-unit-cardinality', level: 'blocker', message: `Generated unit blocks must own exactly one UnitDef patch; found ${unitIds.length}.` });
            }
            const actualUnitId = String(unitIds[0] || '').toLowerCase();
            const expectedUnitId = String(block.metadata?.unitId || '').toLowerCase();
            if (expectedUnitId && actualUnitId !== expectedUnitId) {
              add({ ...context, code: 'generated-unit-identity', level: 'blocker', message: `Block metadata names ${expectedUnitId}, but its table patches ${actualUnitId || '(unknown)'}.` });
            }
            if (actualUnitId && generatedUnitIds.has(actualUnitId)) {
              add({ ...context, code: 'duplicate-generated-unit', level: 'blocker', message: `Generated UnitDef ${actualUnitId} is emitted by more than one block.` });
            }
            if (actualUnitId) generatedUnitIds.add(actualUnitId);
          }
        }
      } catch (error) {
        add({
          ...context,
          code: 'lua-syntax',
          level: 'blocker',
          message: `Lua 5.1 syntax failed: ${String(error?.message || error).replace(/^\\[\\d+:\\d+\\]\\s*/, '')}`,
        });
      }

      const dependencies = block.dependencies || [];
      const normalizedDependencies = [...new Set(dependencies.map(value => String(value || '').trim()).filter(Boolean))]
        .sort(compareCanonicalText);
      if (JSON.stringify(dependencies) !== JSON.stringify(normalizedDependencies)) {
        add({ ...context, code: 'dependency-order', level: 'blocker', message: 'Block dependencies are not normalized, unique, and deterministically ordered.' });
      }
    });
  });

  const expectedAllIds = lanes.flatMap(([, blocks]) => blocks.map(block => block.id));
  const actualAllIds = (canonicalBlocks?.all || []).map(block => block.id);
  if (JSON.stringify(actualAllIds) !== JSON.stringify(expectedAllIds)) {
    add({ code: 'canonical-lane-index', level: 'blocker', message: 'The canonical all-block index does not match Definitions followed by Units.' });
  }

  return { ids: seenBlockIds, blocksById };
}

function validateDeduplication(compiledModules, blocksById, add) {
  const report = compiledModules?.deduplication;
  if (!report) {
    add({ code: 'deduplication-report-missing', level: 'blocker', message: 'Safe deduplication provenance is unavailable.' });
    return new Map();
  }

  const groupsByRetainedId = new Map();
  const removedIds = new Set();
  let removedCount = 0;
  let rawBytesSaved = 0;
  (report.groups || []).forEach(group => {
    const retained = blocksById.get(group.retainedBlockId);
    const removed = (group.removedBlockIds || []).map(id => blocksById.get(id));
    const context = { lane: group.kind, blockId: group.retainedBlockId, source: group.source };
    if (!retained || removed.some(block => !block)) {
      add({ ...context, code: 'deduplication-provenance', level: 'blocker', message: 'A deduplication group references an unknown canonical block.' });
      return;
    }
    if (removed.length === 0 || removed.some(block => executionSignature(block) !== executionSignature(retained))) {
      add({ ...context, code: 'unsafe-deduplication', level: 'blocker', message: 'Only byte-identical blocks with matching lane, stage, source, category, and feature may be deduplicated.' });
    }
    group.removedBlockIds.forEach(id => {
      if (removedIds.has(id) || id === group.retainedBlockId) {
        add({ ...context, code: 'duplicate-deduplication-provenance', level: 'blocker', message: `Canonical block ${id} has invalid duplicate provenance.` });
      }
      removedIds.add(id);
    });
    const expectedRawSavings = removed.reduce((total, block) => total + (block?.rawBytes || 0), 0);
    if (group.rawBytesSaved !== expectedRawSavings) {
      add({ ...context, code: 'deduplication-byte-count', level: 'blocker', message: 'Deduplication raw-byte savings do not match the removed blocks.' });
    }
    removedCount += removed.length;
    rawBytesSaved += expectedRawSavings;
    groupsByRetainedId.set(group.retainedBlockId, group);
  });

  if (report.removedBlockCount !== removedCount || report.rawBytesSaved !== rawBytesSaved) {
    add({ code: 'deduplication-summary', level: 'blocker', message: 'Deduplication summary totals do not match their provenance groups.' });
  }
  if (
    report.before?.blockCount - report.after?.blockCount !== removedCount
    || report.before?.encodedBytes - report.after?.encodedBytes !== report.encodedBytesSaved
    || report.before?.slotCount - report.after?.slotCount !== report.slotsSaved
  ) {
    add({ code: 'deduplication-savings', level: 'blocker', message: 'Deduplication before/after savings are internally inconsistent.' });
  }

  const effectiveIds = compiledModules?.effectiveBlocks?.all?.map(block => block.id) || [];
  const expectedEffectiveIds = [...blocksById.keys()].filter(id => !removedIds.has(id));
  if (JSON.stringify(effectiveIds) !== JSON.stringify(expectedEffectiveIds)) {
    add({ code: 'deduplication-effective-index', level: 'blocker', message: 'Effective compiler blocks do not match the deduplicated canonical index.' });
  }
  return groupsByRetainedId;
}

function validateSlots(compiledModules, canonicalIds, deduplicationGroups, add) {
  const seenFields = new Set();
  const recordedBlockIds = [];
  const allSlots = compiledModules?.slots || [];
  const compactionTotals = {
    attemptedSlotCount: 0,
    appliedSlotCount: 0,
    fallbackSlotCount: 0,
    rawBytesSaved: 0,
    encodedBytesSaved: 0,
  };

  let defsStarted = false;
  allSlots.forEach(slot => {
    const context = { lane: slot.kind, fieldName: slot.fieldName, blockId: slot.id, source: slot.source };
    if (slot.kind === 'defs') defsStarted = true;
    if (defsStarted && slot.kind === 'units') {
      add({ ...context, code: 'lane-order', level: 'blocker', message: 'Units must be emitted before every Definitions slot.' });
    }
    if (seenFields.has(slot.fieldName)) {
      add({ ...context, code: 'duplicate-field', level: 'blocker', message: `Lobby field ${slot.fieldName} is emitted more than once.` });
    }
    seenFields.add(slot.fieldName);

    const expectedField = `tweak${slot.kind}${slot.index || ''}`;
    if (slot.fieldName !== expectedField || slot.index < 0 || slot.index > 29) {
      add({ ...context, code: 'field-numbering', level: 'blocker', message: `Expected ${expectedField} within BAR's base-through-29 field range.` });
    }
    const normalizedLua = normalizeLua(slot.lua);
    const expectedEncoded = encodeLobbyBase64(`${normalizedLua} `, { padding: compiledModules?.base64Padding ?? false });
    if (slot.encoded !== expectedEncoded || slot.encodedBytes !== expectedEncoded.length) {
      add({ ...context, code: 'encoded-payload-mismatch', level: 'blocker', message: `${slot.fieldName} Base64 does not match its canonical Lua source.` });
    }
    if (expectedEncoded.length > LOBBY_SLOT_LIMIT_CHARACTERS) {
      add({
        ...context,
        code: 'lobby-field-size-limit',
        level: 'blocker',
        message: `${slot.fieldName} is ${expectedEncoded.length.toLocaleString()} encoded characters; multiplayer lobby fields allow at most ${LOBBY_SLOT_LIMIT_CHARACTERS.toLocaleString()}.`,
      });
    }
    if (slot.command !== `!bset ${slot.fieldName} ${slot.encoded}`) {
      add({ ...context, code: 'command-mismatch', level: 'blocker', message: `${slot.fieldName} command does not match its encoded payload.` });
    }
    if (slot.source === 'imported' && slot.compaction) {
      add({ ...context, code: 'imported-compaction', level: 'blocker', message: 'Imported Lua must remain byte-for-byte untouched by semantic compaction.' });
    }
    if (slot.source === 'generated') {
      const compaction = slot.compaction;
      if (!compaction) {
        add({ ...context, code: 'compaction-evidence-missing', level: 'blocker', message: `${slot.fieldName} is missing its generated-Lua compaction evidence.` });
      } else {
        if (compaction.attempted) compactionTotals.attemptedSlotCount += 1;
        if (compaction.applied) compactionTotals.appliedSlotCount += 1;
        if (
          compaction.attempted
          && !compaction.applied
          && !['not-smaller', 'empty-source'].includes(compaction.reason)
        ) {
          compactionTotals.fallbackSlotCount += 1;
        }
        compactionTotals.rawBytesSaved += compaction.rawBytesSaved || 0;
        compactionTotals.encodedBytesSaved += compaction.encodedBytesSaved || 0;
        const measuredRawBytes = textEncoder.encode(normalizedLua).byteLength;
        if (
          compaction.rawBytesAfter !== measuredRawBytes
          || compaction.encodedBytesAfter !== expectedEncoded.length
          || compaction.rawBytesBefore - compaction.rawBytesAfter !== compaction.rawBytesSaved
          || compaction.encodedBytesBefore - compaction.encodedBytesAfter !== compaction.encodedBytesSaved
        ) {
          add({ ...context, code: 'compaction-byte-count', level: 'blocker', message: `${slot.fieldName} compaction savings do not match its delivered source.` });
        }
        if (compaction.applied && (!compaction.equivalent || compaction.reason !== 'equivalent')) {
          add({ ...context, code: 'compaction-equivalence', level: 'blocker', message: `${slot.fieldName} claims compaction without successful Lua 5.1 AST equivalence.` });
        }
      }
    }
    if (!Array.isArray(slot.blockIds) || slot.blockIds.length === 0 || slot.blockCount !== slot.blockIds.length) {
      add({ ...context, code: 'slot-block-index', level: 'blocker', message: `${slot.fieldName} has an invalid canonical block index.` });
    } else {
      recordedBlockIds.push(...slot.blockIds);
      if (slot.source === 'imported' && slot.blockIds.length !== 1) {
        const group = deduplicationGroups.get(slot.blockIds[0]);
        const expectedIds = group ? [group.retainedBlockId, ...group.removedBlockIds] : [];
        if (JSON.stringify(slot.blockIds) !== JSON.stringify(expectedIds)) {
          add({ ...context, code: 'imported-module-split', level: 'blocker', message: `${slot.fieldName} does not preserve one imported execution with complete duplicate provenance.` });
        }
      }
    }
    try {
      const ast = parseLua(normalizedLua, slot.kind);
      if (slot.kind === 'units' && !tableUnitIds(ast)) {
        add({ ...context, code: 'slot-units-table-shape', level: 'blocker', message: `${slot.fieldName} is not one literal tweakunits table.` });
      }
    } catch (error) {
      add({
        ...context,
        code: 'slot-lua-syntax',
        level: 'blocker',
        message: `${slot.fieldName} cannot be parsed as Lua 5.1: ${String(error?.message || error).replace(/^\\[\\d+:\\d+\\]\\s*/, '')}`,
      });
    }
  });

  const duplicateRecordedIds = recordedBlockIds.filter((id, index) => recordedBlockIds.indexOf(id) !== index);
  if (duplicateRecordedIds.length) {
    add({
      lane: 'delivery',
      code: 'duplicate-block-coverage',
      level: 'blocker',
      message: `Canonical blocks are packed more than once: ${[...new Set(duplicateRecordedIds)].sort(compareCanonicalText).join(', ')}.`,
    });
  }
  if (!compiledModules?.overflow) {
    const missing = [...canonicalIds].filter(id => !recordedBlockIds.includes(id)).sort(compareCanonicalText);
    const unknown = recordedBlockIds.filter(id => !canonicalIds.has(id)).sort(compareCanonicalText);
    if (missing.length || unknown.length) {
      add({
        lane: 'delivery',
        code: 'block-coverage',
        level: 'blocker',
        message: `Slot coverage is inconsistent${missing.length ? `; missing ${missing.join(', ')}` : ''}${unknown.length ? `; unknown ${unknown.join(', ')}` : ''}.`,
      });
    }
  }

  for (const kind of ['defs', 'units']) {
    const lane = compiledModules?.[kind];
    const laneSlots = lane?.slots || [];
    const expectedVisibleSlots = Math.min(lane?.required || 0, lane?.maximum || 30);
    if (laneSlots.length !== expectedVisibleSlots) {
      add({ lane: kind, code: 'required-slot-count', level: 'blocker', message: `${kind} slot accounting is inconsistent.` });
    }
    laneSlots.forEach((slot, index) => {
      if (slot.index !== (compiledModules?.contract?.firstSlotIndex ?? 0) + index) {
        add({ lane: kind, fieldName: slot.fieldName, code: 'slot-sequence', level: 'blocker', message: `${kind} slots are not consecutively numbered.` });
      }
    });
  }

  const compactionReport = compiledModules?.compaction;
  if (!compactionReport || compactionReport.equivalenceGuarded !== true) {
    add({ code: 'compaction-report-missing', level: 'blocker', message: 'Generated-Lua compaction guard evidence is unavailable.' });
  } else {
    const matchesVisibleSlots = (
      compactionReport.attemptedSlotCount === compactionTotals.attemptedSlotCount
      && compactionReport.appliedSlotCount === compactionTotals.appliedSlotCount
      && compactionReport.fallbackSlotCount === compactionTotals.fallbackSlotCount
      && compactionReport.rawBytesSaved === compactionTotals.rawBytesSaved
      && compactionReport.encodedBytesSaved === compactionTotals.encodedBytesSaved
    );
    const safelyIncludesOverflow = compiledModules?.overflow && (
      compactionReport.attemptedSlotCount >= compactionTotals.attemptedSlotCount
      && compactionReport.appliedSlotCount >= compactionTotals.appliedSlotCount
      && compactionReport.fallbackSlotCount >= compactionTotals.fallbackSlotCount
      && compactionReport.rawBytesSaved >= compactionTotals.rawBytesSaved
      && compactionReport.encodedBytesSaved >= compactionTotals.encodedBytesSaved
    );
    if (!matchesVisibleSlots && !safelyIncludesOverflow) {
      add({ code: 'compaction-summary', level: 'blocker', message: 'Semantic compaction summary totals do not match their generated slots.' });
    }
  }
}

export function validateCompiledLobbyModules(compiledModules) {
  const issues = [];
  const add = issue => issues.push({
    fieldName: '',
    blockId: '',
    lane: 'delivery',
    source: '',
    ...issue,
    id: `compiler-${issue.code}-${issue.fieldName || issue.blockId || issues.length}`,
  });

  if (!compiledModules || !compiledModules.canonicalBlocks) {
    add({ code: 'compiler-output-missing', level: 'blocker', message: 'Canonical compiler output is unavailable.' });
  } else {
    const canonical = validateCanonicalBlocks(compiledModules.canonicalBlocks, add);
    const deduplicationGroups = validateDeduplication(compiledModules, canonical.blocksById, add);
    validateSlots(compiledModules, canonical.ids, deduplicationGroups, add);
  }

  const orderedIssues = stableIssues(issues);
  const counts = orderedIssues.reduce((summary, issue) => {
    summary[issue.level] += 1;
    return summary;
  }, { blocker: 0, warning: 0, info: 0 });

  return {
    status: counts.blocker ? 'blocked' : counts.warning ? 'review' : 'ready',
    isValid: counts.blocker === 0,
    canExport: counts.blocker === 0 && !compiledModules?.overflow,
    counts,
    issues: orderedIssues,
    checkedBlockCount: compiledModules?.canonicalBlocks?.all?.length || 0,
    checkedSlotCount: compiledModules?.slots?.length || 0,
  };
}
