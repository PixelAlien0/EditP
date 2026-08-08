import { encodeLobbyBase64 } from './tweakSerializer.js';

export const LOBBY_SLOT_LIMIT_CHARACTERS = 16384;
export const LOBBY_SLOT_SAFETY_MARGIN_CHARACTERS = 1024;
export const GENERATED_SLOT_TARGET_BYTES = LOBBY_SLOT_LIMIT_CHARACTERS
  - LOBBY_SLOT_SAFETY_MARGIN_CHARACTERS;

const textEncoder = new TextEncoder();

function compareText(left, right) {
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

function slotStatus(encodedBytes, targetBytes, limitBytes) {
  if (encodedBytes > limitBytes) return 'blocked';
  if (encodedBytes >= targetBytes) return 'near';
  return 'healthy';
}

function analyzeLane(kind, lane, options) {
  const required = Number(lane?.required) || 0;
  const maximum = Number(lane?.maximum) || options.maximumSlots;
  const encodedBytes = Number(lane?.totalEncodedBytes) || 0;
  const remainingSlots = Math.max(0, maximum - required);
  const capacityBytes = maximum * options.limitBytes;
  return {
    kind,
    label: kind === 'defs' ? 'Definitions' : 'Units',
    required,
    maximum,
    remainingSlots,
    overflowBy: Math.max(0, required - maximum),
    overflow: Boolean(lane?.overflow),
    encodedBytes,
    capacityBytes,
    limitHeadroom: capacityBytes - encodedBytes,
    utilization: capacityBytes ? Math.min(100, (encodedBytes / capacityBytes) * 100) : 0,
  };
}

function analyzeSlots(compiledModules, options) {
  return (compiledModules?.slots || []).map(slot => {
    const encodedBytes = Number(slot.encodedBytes) || 0;
    const rawBytes = textEncoder.encode(String(slot.lua || '')).byteLength;
    return {
      fieldName: slot.fieldName,
      label: slot.label,
      kind: slot.kind,
      index: slot.index,
      source: slot.source,
      encodedBytes,
      rawBytes,
      targetHeadroom: options.targetBytes - encodedBytes,
      limitHeadroom: options.limitBytes - encodedBytes,
      utilization: Math.min(100, (encodedBytes / options.limitBytes) * 100),
      status: slotStatus(encodedBytes, options.targetBytes, options.limitBytes),
      blockCount: Number(slot.blockCount) || 0,
      executionBlockCount: Number(slot.executionBlockCount) || 0,
      deduplicatedBlockCount: Number(slot.deduplicatedBlockCount) || 0,
      blockIds: [...(slot.blockIds || [])],
    };
  });
}

function analyzeContributors(compiledModules, slots, options) {
  const slotByBlockId = new Map();
  slots.forEach(slot => slot.blockIds.forEach(blockId => slotByBlockId.set(blockId, slot.fieldName)));

  return (compiledModules?.effectiveBlocks?.all || []).map(block => {
    const rawBytes = Number(block.rawBytes)
      || textEncoder.encode(String(block.lua || '')).byteLength;
    const estimatedEncodedBytes = encodeLobbyBase64(`${block.lua || ''} `, {
      padding: compiledModules?.base64Padding ?? false,
    }).length;
    return {
      id: block.id,
      label: block.label,
      kind: block.kind,
      stage: block.stage,
      source: block.source,
      category: block.category,
      sourceFeature: block.sourceFeature,
      rawBytes,
      estimatedEncodedBytes,
      slotFieldName: slotByBlockId.get(block.id) || '',
      duplicateCount: block.deduplicatedBlockIds?.length || 0,
      exceedsTarget: estimatedEncodedBytes > options.targetBytes,
    };
  }).sort((left, right) => (
    right.estimatedEncodedBytes - left.estimatedEncodedBytes
    || compareText(left.kind, right.kind)
    || compareText(left.stage, right.stage)
    || compareText(left.id, right.id)
  ));
}

function buildSuggestions(compiledModules, lanes, slots, contributors, options) {
  const suggestions = [];

  lanes.filter(lane => lane.overflowBy > 0).forEach(lane => {
    suggestions.push({
      level: 'error',
      title: `${lane.label} needs ${lane.overflowBy} fewer ${lane.overflowBy === 1 ? 'slot' : 'slots'}`,
      detail: `BAR exposes ${lane.maximum} ${lane.label.toLowerCase()} fields. Disable a module or reduce complete compiler blocks before export.`,
    });
  });

  const oversizedSlots = slots.filter(slot => slot.status === 'blocked');
  if (oversizedSlots.length) {
    suggestions.push({
      level: 'error',
      title: `${oversizedSlots.length} ${oversizedSlots.length === 1 ? 'field exceeds' : 'fields exceed'} the multiplayer limit`,
      detail: `${oversizedSlots.map(slot => slot.fieldName).join(', ')} exceed ${options.limitBytes.toLocaleString()} encoded characters. Export is blocked until the source is reduced or safely split.`,
    });
  }

  lanes.filter(lane => !lane.overflow && lane.remainingSlots <= 1 && lane.required > 0).forEach(lane => {
    suggestions.push({
      level: 'warning',
      title: `${lane.label} has ${lane.remainingSlots} numbered ${lane.remainingSlots === 1 ? 'field' : 'fields'} free`,
      detail: 'Future imported modules or editor features may overflow this lane even if the current output remains valid.',
    });
  });

  const largestImported = contributors.find(contributor => (
    contributor.source === 'imported'
    && contributor.estimatedEncodedBytes >= options.targetBytes
  ));
  if (largestImported) {
    suggestions.push({
      level: 'warning',
      title: `Inspect imported module “${largestImported.label}”`,
      detail: `Its standalone encoded estimate is ${largestImported.estimatedEncodedBytes.toLocaleString()} characters. Imported Lua is atomic, so disable or split it at the source if pressure persists.`,
    });
  }

  const deduplication = compiledModules?.deduplication;
  if (deduplication?.removedBlockCount > 0) {
    suggestions.push({
      level: 'info',
      title: `Safe deduplication recovered ${deduplication.encodedBytesSaved.toLocaleString()} encoded characters`,
      detail: `${deduplication.removedBlockCount} exact ${deduplication.removedBlockCount === 1 ? 'duplicate was' : 'duplicates were'} removed without changing execution order or source ownership.`,
    });
  }

  const compaction = compiledModules?.compaction;
  if (compaction?.appliedSlotCount > 0) {
    suggestions.push({
      level: 'info',
      title: `Equivalent Lua compaction recovered ${compaction.encodedBytesSaved.toLocaleString()} encoded characters`,
      detail: `${compaction.appliedSlotCount} generated ${compaction.appliedSlotCount === 1 ? 'slot was' : 'slots were'} compacted only after Lua 5.1 AST equivalence passed. Imported modules remain untouched.`,
    });
  }
  if (compaction?.fallbackSlotCount > 0) {
    suggestions.push({
      level: 'warning',
      title: `${compaction.fallbackSlotCount} generated ${compaction.fallbackSlotCount === 1 ? 'slot used' : 'slots used'} the safe fallback`,
      detail: 'Equivalence could not be proven, so the compiler retained the original generated Lua for those slots.',
    });
  }

  if (!suggestions.length) {
    suggestions.push({
      level: 'info',
      title: 'Budget is healthy',
      detail: 'No lane overflow, oversized slot, or immediate numbered-field pressure was detected.',
    });
  }

  return suggestions;
}

export function buildByteBudgetReport(compiledModules, configuration = {}) {
  const options = {
    targetBytes: configuration.targetBytes ?? GENERATED_SLOT_TARGET_BYTES,
    limitBytes: configuration.limitBytes
      ?? configuration.advisoryBytes
      ?? LOBBY_SLOT_LIMIT_CHARACTERS,
    maximumSlots: configuration.maximumSlots ?? 9,
  };
  const lanes = [
    analyzeLane('defs', compiledModules?.defs, options),
    analyzeLane('units', compiledModules?.units, options),
  ];
  const slots = analyzeSlots(compiledModules, options);
  const contributors = analyzeContributors(compiledModules, slots, options);
  const encodedBytes = lanes.reduce((total, lane) => total + lane.encodedBytes, 0);
  const rawBytes = contributors.reduce((total, contributor) => total + contributor.rawBytes, 0);
  const maximumLimitBytes = lanes.reduce((total, lane) => total + lane.capacityBytes, 0);
  const hasOversizedSlot = slots.some(slot => slot.status === 'blocked');
  const hasPressure = slots.some(slot => slot.status === 'near')
    || lanes.some(lane => lane.remainingSlots <= 1 && lane.required > 0);
  const status = compiledModules?.overflow || hasOversizedSlot
    ? 'blocked'
    : hasPressure
      ? 'attention'
      : 'healthy';

  return {
    status,
    options,
    aggregate: {
      encodedBytes,
      rawBytes,
      maximumLimitBytes,
      limitHeadroom: maximumLimitBytes - encodedBytes,
      utilization: maximumLimitBytes
        ? Math.min(100, (encodedBytes / maximumLimitBytes) * 100)
        : 0,
      slotsUsed: lanes.reduce((total, lane) => total + Math.min(lane.required, lane.maximum), 0),
      slotsRequired: lanes.reduce((total, lane) => total + lane.required, 0),
      maximumSlots: lanes.reduce((total, lane) => total + lane.maximum, 0),
    },
    lanes,
    slots,
    contributors,
    suggestions: buildSuggestions(compiledModules, lanes, slots, contributors, options),
    deduplication: compiledModules?.deduplication || null,
    compaction: compiledModules?.compaction || null,
  };
}
