import { parseTweakPackageInput } from './tweakPackage.js';

export const LOBBY_SETUP_CATEGORIES = Object.freeze({
  GAME: 'game-settings',
  LOBBY: 'lobby-control',
  MAP: 'map-setup',
  IDENTITY: 'lobby-identity',
  UNKNOWN: 'unknown',
});

export const LOBBY_SETUP_CATEGORY_META = Object.freeze({
  [LOBBY_SETUP_CATEGORIES.GAME]: { label: 'Game settings', description: 'Rules, restrictions, multipliers, and BAR options.' },
  [LOBBY_SETUP_CATEGORIES.LOBBY]: { label: 'Lobby control', description: 'Preset, team size, balance, and host-side setup.' },
  [LOBBY_SETUP_CATEGORIES.MAP]: { label: 'Map & start boxes', description: 'Map selection and ordered start-box actions.' },
  [LOBBY_SETUP_CATEGORIES.IDENTITY]: { label: 'Lobby identity', description: 'Lobby name and welcome-message commands.' },
  [LOBBY_SETUP_CATEGORIES.UNKNOWN]: { label: 'Other commands', description: 'Recognized command syntax that needs manual review.' },
});

const TWEAK_FIELD_PATTERN = /^tweak(?:defs|units)(?:[1-9])?$/i;
const MAP_COMMANDS = new Set(['map', 'addbox', 'clearbox']);
const LOBBY_COMMANDS = new Set(['preset', 'teamsize', 'autobalance', 'balance']);
const IDENTITY_COMMANDS = new Set(['rename', 'welcome-message']);
const ORDERED_COMMANDS = new Set(['addbox', 'clearbox', 'balance']);

function textHash(value) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function classifyCommand(prefix, name) {
  if (prefix === '$' && IDENTITY_COMMANDS.has(name)) return LOBBY_SETUP_CATEGORIES.IDENTITY;
  if (prefix === '$') return LOBBY_SETUP_CATEGORIES.UNKNOWN;
  if (MAP_COMMANDS.has(name)) return LOBBY_SETUP_CATEGORIES.MAP;
  if (LOBBY_COMMANDS.has(name)) return LOBBY_SETUP_CATEGORIES.LOBBY;
  return prefix === '!' ? LOBBY_SETUP_CATEGORIES.GAME : LOBBY_SETUP_CATEGORIES.UNKNOWN;
}

function commandSafety(category) {
  if (category === LOBBY_SETUP_CATEGORIES.GAME) return 'review';
  if (category === LOBBY_SETUP_CATEGORIES.UNKNOWN) return 'unknown';
  return 'manual';
}

function createCommand({ prefix, name, key = '', value = '', raw, line }) {
  const normalizedName = String(name || '').toLowerCase();
  const normalizedKey = String(key || '').toLowerCase();
  const category = classifyCommand(prefix, normalizedName === 'bset' ? normalizedKey : normalizedName);
  return {
    id: `lobby-${line}-${textHash(raw)}`,
    prefix,
    name: normalizedName,
    key: normalizedKey,
    value: String(value || '').trim(),
    raw: raw.trim(),
    line,
    category,
    safety: commandSafety(category),
    enabled: true,
  };
}

function parseCommandLine(rawLine, line) {
  const raw = rawLine.trim();
  if (!raw) return null;

  const bset = raw.match(/^!bset\s+(\S+)(?:\s+([\s\S]*))?$/i);
  if (bset) {
    const key = bset[1].toLowerCase();
    const value = (bset[2] || '').trim();
    if (TWEAK_FIELD_PATTERN.test(key)) {
      return { type: 'slot', fieldName: key, payload: value, raw, line };
    }
    return { type: 'command', command: createCommand({ prefix: '!', name: 'bset', key, value, raw, line }) };
  }

  const command = raw.match(/^([!$])(\S+)(?:\s+([\s\S]*))?$/);
  if (!command) return { type: 'ignored', raw, line };
  return {
    type: 'command',
    command: createCommand({ prefix: command[1], name: command[2], value: command[3] || '', raw, line }),
  };
}

function commandIdentity(command) {
  const effectiveName = command.name === 'bset' ? command.key : command.name;
  if (ORDERED_COMMANDS.has(effectiveName)) return `${command.prefix}:${effectiveName}:${command.line}`;
  return `${command.prefix}:${effectiveName}`;
}

function resolveEffectiveCommands(commands) {
  const latest = new Map();
  commands.forEach(command => latest.set(commandIdentity(command), command));
  const effectiveIds = new Set([...latest.values()].map(command => command.id));
  return {
    effective: commands.filter(command => effectiveIds.has(command.id)),
    overwritten: commands.filter(command => !effectiveIds.has(command.id)),
  };
}

function resolveSlotCommands(slotCommands) {
  const latest = new Map();
  const resetFields = new Set();
  let overwrittenCount = 0;
  slotCommands.forEach(command => {
    if (latest.has(command.fieldName)) overwrittenCount += 1;
    if (command.payload === '0') resetFields.add(command.fieldName);
    latest.set(command.fieldName, command);
  });
  const effective = [...latest.values()].sort((left, right) => left.line - right.line);
  return {
    effective,
    populated: effective.filter(command => command.payload && command.payload !== '0'),
    cleared: effective.filter(command => command.payload === '0'),
    resetFields: [...resetFields],
    overwrittenCount,
  };
}

function hasForceAllUnits(commands) {
  return commands.some(command => {
    const name = command.name === 'bset' ? command.key : command.name;
    return name === 'forceallunits' && /^(?:1|true|on|enabled)$/i.test(command.value);
  });
}

export function parseLobbySetupBundle(input, options = {}) {
  const source = String(input || '').trim();
  if (!source) {
    return { isBundle: false, modules: [], lobbySetup: null, errors: [], notices: [], summary: null };
  }

  const parsedLines = source.split(/\r?\n/)
    .map((rawLine, index) => parseCommandLine(rawLine, index + 1))
    .filter(Boolean);
  const commands = parsedLines.filter(item => item.type === 'command').map(item => item.command);
  const slots = parsedLines.filter(item => item.type === 'slot');
  const ignored = parsedLines.filter(item => item.type === 'ignored');
  const commandResolution = resolveEffectiveCommands(commands);
  const slotResolution = resolveSlotCommands(slots);
  const hasNonTweakCommands = commands.length > 0;
  const hasBundleSemantics = hasNonTweakCommands
    || slotResolution.cleared.length > 0
    || slotResolution.overwrittenCount > 0
    || ignored.length > 0;

  if (!slots.length && !hasNonTweakCommands) {
    return { isBundle: false, modules: [], lobbySetup: null, errors: [], notices: [], summary: null };
  }

  const requirements = hasForceAllUnits(commandResolution.effective) ? ['forceallunits'] : [];
  const synthesized = slotResolution.populated
    .map(command => `!bset ${command.fieldName} ${command.payload}`)
    .join('\n');
  const moduleResult = synthesized
    ? parseTweakPackageInput(synthesized, { sourceName: options.sourceName || 'Lobby setup bundle' })
    : { modules: [], errors: [], notices: [], requirements: [] };
  const modules = moduleResult.modules.map(module => ({
    ...module,
    requirements: [...new Set([...(module.requirements || []), ...requirements])],
  }));
  const categoryCounts = Object.fromEntries(Object.values(LOBBY_SETUP_CATEGORIES).map(category => [category, 0]));
  commandResolution.effective.forEach(command => { categoryCounts[command.category] += 1; });
  const notices = [...moduleResult.notices];
  if (slotResolution.overwrittenCount) notices.push(`${slotResolution.overwrittenCount} earlier tweak-slot assignment${slotResolution.overwrittenCount === 1 ? ' was' : 's were'} replaced using last-command-wins order.`);
  if (commandResolution.overwritten.length) notices.push(`${commandResolution.overwritten.length} earlier lobby setting${commandResolution.overwritten.length === 1 ? ' was' : 's were'} replaced using last-command-wins order.`);
  if (slotResolution.cleared.length) notices.push(`${slotResolution.cleared.length} tweak slot${slotResolution.cleared.length === 1 ? ' is' : 's are'} explicitly cleared by this bundle.`);
  if (requirements.includes('forceallunits')) notices.push('This package requires Force-load all units. Enable it manually in the BAR lobby.');

  const importedAt = options.importedAt || new Date().toISOString();
  const lobbySetup = {
    version: 1,
    sourceName: options.sourceName || 'Pasted lobby setup',
    importedAt,
    commands: commandResolution.effective,
    slotClears: slotResolution.cleared.map(command => command.fieldName),
    slotResetFields: slotResolution.resetFields,
    requirements,
    ignoredLineCount: ignored.length,
    overwrittenCount: commandResolution.overwritten.length + slotResolution.overwrittenCount,
  };

  return {
    isBundle: hasBundleSemantics,
    modules,
    lobbySetup,
    errors: moduleResult.errors,
    notices,
    ignoredLines: ignored,
    overwrittenCommands: commandResolution.overwritten,
    slotCommands: slotResolution.effective,
    summary: {
      moduleCount: modules.length,
      commandCount: commandResolution.effective.length,
      categoryCounts,
      slotClearCount: slotResolution.cleared.length,
      slotResetCount: slotResolution.resetFields.length,
      overwrittenCount: commandResolution.overwritten.length + slotResolution.overwrittenCount,
      ignoredLineCount: ignored.length,
      manualCommandCount: commandResolution.effective.filter(command => command.safety !== 'review').length,
    },
  };
}

export function filterLobbySetupCategories(lobbySetup, enabledCategories) {
  if (!lobbySetup) return null;
  const enabled = new Set(enabledCategories || Object.values(LOBBY_SETUP_CATEGORIES));
  return {
    ...lobbySetup,
    commands: lobbySetup.commands.filter(command => enabled.has(command.category)),
  };
}
