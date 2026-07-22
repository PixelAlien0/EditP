import { encodeLobbyBase64 } from './tweakSerializer.js';

export const MAX_DEFS_SLOTS = 9;
export const MAX_UNITS_SLOTS = 9;
export const GENERATED_SLOT_TARGET = 10000;

function normalizeImported(modules, kind, stage) {
  return (modules || [])
    .filter(module => module.enabled && !module.converted && module.kind === kind && module.stage === stage)
    .sort((left, right) => left.order - right.order || left.label.localeCompare(right.label))
    .map(module => ({
      id: module.id,
      label: module.label,
      kind,
      source: 'imported',
      lua: module.rawLua,
      atomic: true,
    }));
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

function splitGeneratedDefinitions(lua) {
  const source = String(lua || '').trim();
  const markers = [
    ['-- EDITP_BUILDMENU_BEGIN', '-- EDITP_BUILDMENU_END'],
    ['-- EDITP_DEATH_PROFILES_BEGIN', '-- EDITP_DEATH_PROFILES_END'],
  ];
  const blocks = [];
  let remainder = source;
  const cloneBlock = remainder.match(/^do\r?\n(?=[\s\S]*?local function clone_copy\b)[\s\S]*?^end\r?\n^end(?=\r?\n\r?\n|$)/m);
  if (cloneBlock) {
    blocks.push(cloneBlock[0].trim());
    remainder = `${remainder.slice(0, cloneBlock.index)}\n${remainder.slice(cloneBlock.index + cloneBlock[0].length)}`.trim();
  }
  markers.forEach(([begin, end]) => {
    const start = remainder.indexOf(begin);
    const finish = remainder.indexOf(end, start + begin.length);
    if (start < 0 || finish < 0) return;
    blocks.push(remainder.slice(start, finish + end.length).trim());
    remainder = `${remainder.slice(0, start)}\n${remainder.slice(finish + end.length)}`.trim();
  });
  if (remainder) {
    const commentsOnly = remainder.split(/\r?\n/).every(line => !line.trim() || line.trim().startsWith('--'));
    if (commentsOnly && blocks.length) blocks[0] = `${remainder}\n\n${blocks[0]}`;
    else blocks.unshift(remainder);
  }
  return blocks.length ? blocks : [source];
}

function packGeneratedBlocks(blocks, kind) {
  const packed = [];
  blocks.filter(Boolean).forEach(block => {
    const current = packed.at(-1);
    const combined = current
      ? kind === 'units'
        ? `{\n${current.trim().slice(1, -1).trim()}\n${block.trim().slice(1, -1).trim()}\n}`
        : `${current}\n\n${block}`
      : block;
    const encodedLength = encodeLobbyBase64(`${combined} `, { padding: false }).length;
    if (current && encodedLength <= GENERATED_SLOT_TARGET) packed[packed.length - 1] = combined;
    else packed.push(block);
  });
  return packed.map((lua, index) => ({
    id: `generated-${kind}-${index + 1}`,
    label: `Editor ${kind === 'defs' ? 'definitions' : 'unit patches'} ${index + 1}`,
    kind,
    source: 'generated',
    lua,
    atomic: true,
  }));
}

function makeGenerated(kind, lua) {
  if (!String(lua || '').trim() || (kind === 'units' && String(lua).trim() === '{}')) return [];
  const blocks = kind === 'units' ? splitSerializedUnitTable(lua) : splitGeneratedDefinitions(lua);
  return packGeneratedBlocks(blocks, kind);
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
  const imported = projectState.tweakModules || [];
  const defsBlocks = [
    ...normalizeImported(imported, 'defs', 'before-editor'),
    ...makeGenerated('defs', projectState.generatedTweakDefsLua),
    ...normalizeImported(imported, 'defs', 'after-editor'),
  ];
  const unitsBlocks = [
    ...normalizeImported(imported, 'units', 'before-editor'),
    ...makeGenerated('units', projectState.generatedTweakUnitsLua),
    ...normalizeImported(imported, 'units', 'after-editor'),
  ];
  const defs = finalizeSlots(defsBlocks, 'defs', maxDefsSlots, projectState.base64Options?.padding ?? true);
  const units = finalizeSlots(unitsBlocks, 'units', maxUnitsSlots, projectState.base64Options?.padding ?? true);
  const overflow = defs.overflow || units.overflow;
  const allSlots = [...defs.slots, ...units.slots];
  return {
    defs,
    units,
    overflow,
    slots: allSlots,
    aggregateBytes: allSlots.reduce((total, slot) => total + slot.encodedBytes, 0),
  };
}

export function buildLobbyCommands(compiledModules) {
  if (!compiledModules || compiledModules.overflow) return '';
  return compiledModules.slots.map(slot => slot.command).join('\n');
}
