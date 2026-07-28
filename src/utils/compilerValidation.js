import luaparse from 'luaparse';
import { encodeLobbyBase64 } from './tweakSerializer.js';

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
      }
      if (block?.kind !== lane) {
        add({ ...context, code: 'lane-kind-mismatch', level: 'blocker', message: `Block kind ${block?.kind || '(missing)'} does not match the ${lane} lane.` });
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

  return seenBlockIds;
}

function validateSlots(compiledModules, canonicalIds, add) {
  const seenFields = new Set();
  const recordedBlockIds = [];
  const allSlots = compiledModules?.slots || [];

  let unitsStarted = false;
  allSlots.forEach(slot => {
    const context = { lane: slot.kind, fieldName: slot.fieldName, blockId: slot.id, source: slot.source };
    if (slot.kind === 'units') unitsStarted = true;
    if (unitsStarted && slot.kind === 'defs') {
      add({ ...context, code: 'lane-order', level: 'blocker', message: 'Definitions must be emitted before every Units slot.' });
    }
    if (seenFields.has(slot.fieldName)) {
      add({ ...context, code: 'duplicate-field', level: 'blocker', message: `Lobby field ${slot.fieldName} is emitted more than once.` });
    }
    seenFields.add(slot.fieldName);

    const expectedField = `tweak${slot.kind}${slot.index}`;
    if (slot.fieldName !== expectedField || slot.index < 1 || slot.index > 9) {
      add({ ...context, code: 'field-numbering', level: 'blocker', message: `Expected ${expectedField} within BAR's 1–9 field range.` });
    }
    const normalizedLua = normalizeLua(slot.lua);
    const expectedEncoded = encodeLobbyBase64(`${normalizedLua} `, { padding: compiledModules?.base64Padding ?? false });
    if (slot.encoded !== expectedEncoded || slot.encodedBytes !== expectedEncoded.length) {
      add({ ...context, code: 'encoded-payload-mismatch', level: 'blocker', message: `${slot.fieldName} Base64 does not match its canonical Lua source.` });
    }
    if (slot.command !== `!bset ${slot.fieldName} ${slot.encoded}`) {
      add({ ...context, code: 'command-mismatch', level: 'blocker', message: `${slot.fieldName} command does not match its encoded payload.` });
    }
    if (!Array.isArray(slot.blockIds) || slot.blockIds.length === 0 || slot.blockCount !== slot.blockIds.length) {
      add({ ...context, code: 'slot-block-index', level: 'blocker', message: `${slot.fieldName} has an invalid canonical block index.` });
    } else {
      recordedBlockIds.push(...slot.blockIds);
      if (slot.source === 'imported' && slot.blockIds.length !== 1) {
        add({ ...context, code: 'imported-module-split', level: 'blocker', message: `${slot.fieldName} does not preserve its imported module as one atomic slot.` });
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
    const canonicalOrder = [...canonicalIds];
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
    if (!missing.length && !unknown.length && JSON.stringify(recordedBlockIds) !== JSON.stringify(canonicalOrder)) {
      add({
        lane: 'delivery',
        code: 'block-delivery-order',
        level: 'blocker',
        message: 'Lobby slots do not preserve canonical block order.',
      });
    }
  }

  for (const kind of ['defs', 'units']) {
    const lane = compiledModules?.[kind];
    const laneSlots = lane?.slots || [];
    const expectedVisibleSlots = Math.min(lane?.required || 0, lane?.maximum || 9);
    if (laneSlots.length !== expectedVisibleSlots) {
      add({ lane: kind, code: 'required-slot-count', level: 'blocker', message: `${kind} slot accounting is inconsistent.` });
    }
    laneSlots.forEach((slot, index) => {
      if (slot.index !== index + 1) {
        add({ lane: kind, fieldName: slot.fieldName, code: 'slot-sequence', level: 'blocker', message: `${kind} slots are not consecutively numbered.` });
      }
    });
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
    const canonicalIds = validateCanonicalBlocks(compiledModules.canonicalBlocks, add);
    validateSlots(compiledModules, canonicalIds, add);
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
