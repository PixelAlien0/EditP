import luaparse from 'luaparse';

export const MAX_TWEAK_MODULE_BYTES = 1024 * 1024;
export const MAX_TWEAK_PACKAGE_BYTES = 5 * 1024 * 1024;

const BSET_PATTERN = /^\s*!bset\s+(tweak(defs|units)(\d+)?)\s+([^\s]+)\s*$/i;
const FIELD_PATTERN = /^tweak(defs|units)(\d+)?$/i;
const SUPPORTED_UNIT_CUSTOM_PARAMS = new Set([
  'carried_unit', 'spawnrate', 'maxunits', 'controlradius', 'enabledocking',
  'decayrate', 'deathdecayrate', 'carrierdeaththroe', 'metalcost', 'energycost',
]);
const SUPPORTED_WEAPON_CUSTOM_PARAMS = new Set([
  'spawns_name', 'spawns_surface', 'metalcost', 'energycost', 'cluster_def', 'cluster_number',
]);
const SUPPORTED_UNIT_FIELDS = new Set([
  'metalcost', 'energycost', 'buildtime', 'health', 'maxvelocity', 'acceleration',
  'brakerate', 'turnrate', 'mass', 'sightdistance', 'radardistance', 'sonardistance',
  'workertime', 'metalmake', 'energymake', 'metalstorage', 'energystorage',
]);
const WEAPON_CUSTOM_TO_EDITOR_KEY = Object.freeze({
  spawns_name: 'spawns_name', spawns_surface: 'spawns_surface', metalcost: 'spawn_metal_cost',
  energycost: 'spawn_energy_cost', cluster_def: 'cluster_def', cluster_number: 'cluster_number',
});

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function hashText(value) {
  let left = 0x811c9dc5;
  let right = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    left = Math.imul(left ^ code, 0x01000193);
    right = Math.imul(right ^ code, 0x85ebca6b);
  }
  return `${(left >>> 0).toString(16).padStart(8, '0')}${(right >>> 0).toString(16).padStart(8, '0')}`;
}

function decodeBase64(payload) {
  const normalized = String(payload || '').trim().replace(/-/g, '+').replace(/_/g, '/');
  if (!normalized || /[^A-Za-z0-9+/=]/.test(normalized)) throw new Error('Payload is not valid Base64.');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

function looksLikeLua(value) {
  const source = String(value || '').trim();
  return /\b(UnitDefs|WeaponDefs|return|local|function|for|if|do)\b|^\s*\{/.test(source);
}

function scalarFromLua(value) {
  const source = String(value || '').trim();
  if (/^[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?$/i.test(source)) return Number(source);
  if (source === 'true') return true;
  if (source === 'false') return false;
  const quoted = source.match(/^(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')$/s);
  if (!quoted) return undefined;
  return (quoted[1] ?? quoted[2]).replace(/\\([\\"'])/g, '$1').replace(/\\n/g, '\n');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function createModule({ kind, rawLua, payload = '', fieldName = '', sourceName = '', order = 0, label = '' }) {
  const bytes = byteLength(rawLua);
  if (bytes > MAX_TWEAK_MODULE_BYTES) throw new Error('A tweak module cannot exceed 1 MB after decoding.');
  const contentHash = hashText(rawLua);
  return {
    id: `${kind}-${contentHash}`,
    kind,
    label: label || fieldName || `${kind === 'defs' ? 'Definitions' : 'Units'} module`,
    sourceName,
    originalFieldName: fieldName,
    rawLua,
    originalPayload: payload,
    contentHash,
    enabled: false,
    converted: false,
    stage: 'before-editor',
    order,
    attribution: '',
  };
}

export function parseTweakPackageInput(input, options = {}) {
  const source = String(input || '').trim();
  if (!source) return { modules: [], errors: [] };
  if (byteLength(source) > MAX_TWEAK_PACKAGE_BYTES * 1.5) {
    return { modules: [], errors: ['The selected package is larger than the 5 MB import limit.'] };
  }

  const modules = [];
  const errors = [];
  const commandLines = source.split(/\r?\n/).filter(line => line.trim());
  const allCommands = commandLines.every(line => BSET_PATTERN.test(line));

  if (allCommands) {
    commandLines.forEach((line, index) => {
      const match = line.match(BSET_PATTERN);
      try {
        const rawLua = decodeBase64(match[4]);
        modules.push(createModule({
          kind: match[2].toLowerCase(), rawLua, payload: match[4],
          fieldName: match[1].toLowerCase(), sourceName: options.sourceName || '', order: index,
        }));
      } catch (error) {
        errors.push(`Line ${index + 1}: ${error.message}`);
      }
    });
  } else {
    const fieldMatch = String(options.fieldName || '').match(FIELD_PATTERN);
    const kind = fieldMatch?.[1]?.toLowerCase() || options.kind;
    if (kind !== 'defs' && kind !== 'units') {
      return { modules: [], errors: ['Choose whether this raw module belongs to Definitions or Units.'] };
    }
    try {
      let rawLua = source;
      let payload = '';
      if (!looksLikeLua(source)) {
        rawLua = decodeBase64(source);
        payload = source;
      }
      modules.push(createModule({
        kind, rawLua, payload, fieldName: options.fieldName || '',
        sourceName: options.sourceName || '', order: options.order || 0,
      }));
    } catch (error) {
      errors.push(error.message);
    }
  }

  const totalBytes = modules.reduce((sum, module) => sum + byteLength(module.rawLua), 0);
  if (totalBytes > MAX_TWEAK_PACKAGE_BYTES) {
    return { modules: [], errors: ['Decoded tweak modules exceed the 5 MB package limit.'] };
  }
  const seen = new Set();
  const deduped = modules.filter(module => {
    if (seen.has(module.contentHash)) return false;
    seen.add(module.contentHash);
    return true;
  });
  if (deduped.length !== modules.length) errors.push(`${modules.length - deduped.length} duplicate module(s) were skipped.`);
  return { modules: deduped, errors };
}

export function analyzeTweakModule(module) {
  const source = String(module?.rawLua || '');
  let parseError = null;
  try {
    const parseSource = module?.kind === 'units' && /^\s*\{/.test(source) ? `return ${source}` : source;
    luaparse.parse(parseSource, { luaVersion: '5.1', locations: true, comments: false });
  } catch (error) {
    parseError = error.message;
  }

  const unitReferences = [...source.matchAll(/UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]/gi)].map(match => match[1].toLowerCase());
  const dotReferences = [...source.matchAll(/UnitDefs\.([a-z0-9_]+)/gi)].map(match => match[1].toLowerCase());
  const created = [];
  const cloneConversions = [];
  const clonePattern = /UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]\s*=\s*(?:[\w.]+\s*\(\s*)?UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]\s*\)?/gi;
  for (const match of source.matchAll(clonePattern)) {
    created.push(match[1].toLowerCase());
    cloneConversions.push({ type: 'clone', newId: match[1].toLowerCase(), baseId: match[2].toLowerCase() });
  }

  const buildMenuConversions = [];
  for (const match of source.matchAll(/table\.insert\s*\(\s*UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]\.buildoptions\s*,\s*["']([a-z0-9_]+)["']\s*\)/gi)) {
    buildMenuConversions.push({ type: 'build-add', builderId: match[1].toLowerCase(), unitId: match[2].toLowerCase() });
  }
  for (const match of source.matchAll(/\b(addBuild|removeBuild)\s*\(\s*["']([a-z0-9_]+)["']\s*,\s*["']([a-z0-9_]+)["']\s*\)/gi)) {
    buildMenuConversions.push({ type: match[1].toLowerCase() === 'addbuild' ? 'build-add' : 'build-remove', builderId: match[2].toLowerCase(), unitId: match[3].toLowerCase() });
  }

  const customParameters = [];
  const parameterConversions = [];
  const directCustomPattern = /UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]\.customparams(?:\.([a-z0-9_]+)|\s*\[\s*["']([a-z0-9_]+)["']\s*\])\s*=\s*([^,;\n]+)/gi;
  for (const match of source.matchAll(directCustomPattern)) {
    const key = (match[2] || match[3]).toLowerCase();
    customParameters.push(key);
    const value = scalarFromLua(match[4]);
    if (SUPPORTED_UNIT_CUSTOM_PARAMS.has(key) && value !== undefined) {
      parameterConversions.push({ type: 'unit-parameter', unitId: match[1].toLowerCase(), key: `customparams.${key}`, value });
    }
  }
  for (const match of source.matchAll(/customparams(?:\.([a-z0-9_]+)|\s*\[\s*["']([a-z0-9_]+)["']\s*\])\s*=/gi)) {
    customParameters.push((match[1] || match[2]).toLowerCase());
  }
  for (const tableMatch of source.matchAll(/customparams\s*=\s*\{([\s\S]*?)\}/gi)) {
    for (const keyMatch of tableMatch[1].matchAll(/\b([a-z_][a-z0-9_]*)\s*=/gi)) {
      customParameters.push(keyMatch[1].toLowerCase());
    }
  }
  const directUnitPattern = /UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]\.([a-z0-9_]+)\s*=\s*([^,;\n]+)/gi;
  for (const match of source.matchAll(directUnitPattern)) {
    const key = match[2].toLowerCase();
    const value = scalarFromLua(match[3]);
    if (SUPPORTED_UNIT_FIELDS.has(key) && value !== undefined) {
      parameterConversions.push({ type: 'unit-parameter', unitId: match[1].toLowerCase(), key, value });
    }
  }
  const directWeaponCustomPattern = /UnitDefs\s*\[\s*["']([a-z0-9_]+)["']\s*\]\.weapondefs(?:\s*\[\s*["']([a-z0-9_]+)["']\s*\]|\.([a-z0-9_]+))\.customparams(?:\.([a-z0-9_]+)|\s*\[\s*["']([a-z0-9_]+)["']\s*\])\s*=\s*([^,;\n]+)/gi;
  for (const match of source.matchAll(directWeaponCustomPattern)) {
    const customKey = (match[4] || match[5]).toLowerCase();
    const value = scalarFromLua(match[6]);
    if (SUPPORTED_WEAPON_CUSTOM_PARAMS.has(customKey) && value !== undefined) {
      parameterConversions.push({
        type: 'weapon-parameter', unitId: match[1].toLowerCase(),
        weaponDefKey: (match[2] || match[3]).toLowerCase(), key: WEAPON_CUSTOM_TO_EDITOR_KEY[customKey], value,
      });
    }
  }

  const warnings = [];
  if (parseError) warnings.push({ level: 'error', code: 'syntax', message: parseError });
  if (/for\s+[^\n]+\s+in\s+pairs\s*\(\s*UnitDefs\s*\)/i.test(source)) warnings.push({ level: 'warning', code: 'global-loop', message: 'Iterates over every UnitDef.' });
  if (/UnitDefs(?:\s*\[[^\]]+\]|\.[a-z0-9_]+)\s*=\s*nil/i.test(source)) warnings.push({ level: 'warning', code: 'deletion', message: 'Deletes one or more unit definitions.' });
  if (/\b(loadstring|loadfile|dofile|require)\s*\(/i.test(source)) warnings.push({ level: 'warning', code: 'runtime-code', message: 'Loads code dynamically at runtime.' });
  if (/\.(objectname|script|buildpic|collisionvolumetype|collisionvolumescales)\s*=/i.test(source)) warnings.push({ level: 'info', code: 'asset-swap', message: 'Changes model, script, artwork, or collision assets.' });
  if (/UnitDefs\s*\[[^"'\]]+\]/i.test(source)) warnings.push({ level: 'info', code: 'dynamic-id', message: 'Uses computed unit IDs that cannot be converted safely.' });

  const supportedWeaponParams = unique(customParameters.filter(key => SUPPORTED_WEAPON_CUSTOM_PARAMS.has(key)));
  return {
    parseError,
    decodedBytes: byteLength(source),
    createdUnits: unique(created),
    referencedUnits: unique([...unitReferences, ...dotReferences]),
    customParameters: unique(customParameters),
    weaponCustomParameters: supportedWeaponParams,
    weaponChanges: (source.match(/\.weapondefs|\[\s*["'][a-z0-9_]+["']\s*\]\.weapons/gi) || []).length,
    buildMenuOperations: buildMenuConversions.length,
    warnings,
    conversions: [...cloneConversions, ...buildMenuConversions, ...parameterConversions],
  };
}
