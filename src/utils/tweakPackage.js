import luaparse from 'luaparse';
import {
  STAT_KEYS,
  WEAPON_SLOT_BOOLEAN_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS,
  WEAPON_SLOT_PATHS,
  WEAPON_SLOT_STRING_PARAMS,
} from '../config/editorParameters.js';

export const MAX_TWEAK_MODULE_BYTES = 1024 * 1024;
export const MAX_TWEAK_PACKAGE_BYTES = 5 * 1024 * 1024;

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
const DIRECT_WEAPON_FIELDS = new Set([
  'range', 'accuracy', 'sprayangle', 'burst', 'burstrate', 'projectiles', 'stockpile',
  'stockpiletime', 'flighttime', 'wobble', 'dance', 'tolerance', 'firetolerance',
  'edgeeffectiveness', 'impulsefactor', 'impulseboost', 'energypershot', 'metalpershot',
  'paralyzer', 'paralyzetime', 'movingaccuracy', 'predictboost', 'leadlimit', 'leadbonus',
  'heightmod', 'heightboostfactor', 'hightrajectory', 'trajectoryheight', 'tracks',
  'turnrate', 'startvelocity', 'weaponacceleration', 'weaponvelocity', 'reloadtime',
  'areaofeffect', 'weapontype', 'cegtag', 'model', 'explosiongenerator', 'rgbcolor',
  'rgbcolor2', 'soundstart', 'soundhit', 'soundhitwet', 'soundhitdry', 'texture1',
  'texture2', 'texture3', 'colormap', 'interceptedbyshieldtype', 'collisionsize',
  'numbounce', 'bounceslip', 'bouncerebound', 'beamtime', 'minintensity', 'duration',
  'falloffrate', 'thickness', 'corethickness', 'laserflaresize', 'intensity',
  'weapontimer', 'windup', 'firestarter', 'explosionspeed', 'camerashake', 'cratermult',
  'craterboost', 'craterareaofeffect', 'scarttl', 'beamttl', 'beamdecay', 'targetable',
  'interceptor', 'coverage', 'soundstartvolume', 'soundhitvolume', 'soundhitwetvolume',
  'soundhitdryvolume', 'smokecolor', 'smokeperiod', 'smokesize', 'smoketime', 'size',
  'sizedecay', 'sizegrowth', 'alphadecay', 'stages', 'tilelength', 'scrollspeed',
  'dyndamageexp', 'dyndamagemin', 'dyndamagerange',
]);
const UNIT_FIELD_TO_EDITOR_KEY = new Map();
const UNIT_CUSTOM_TO_EDITOR_KEY = new Map();
STAT_KEYS.forEach(parameter => {
  if (parameter.output === 'tweakdefs') return;
  const sourceKey = String(parameter.patchKey || parameter.key).toLowerCase();
  if (parameter.nestedIn === 'customparams') UNIT_CUSTOM_TO_EDITOR_KEY.set(sourceKey, parameter.key);
  else {
    UNIT_FIELD_TO_EDITOR_KEY.set(String(parameter.key).toLowerCase(), parameter.key);
    UNIT_FIELD_TO_EDITOR_KEY.set(sourceKey, parameter.key);
  }
});
const WEAPON_PATH_TO_EDITOR_KEY = new Map(Object.entries(WEAPON_SLOT_PATHS).map(([editorKey, path]) => [path.toLowerCase(), editorKey]));
const UNSUPPORTED_LITERAL = Symbol('unsupported-lua-literal');

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

function labelFromLua(rawLua, fallback) {
  const comment = String(rawLua || '').match(/^\s*--\s*([^\r\n]+)/);
  return comment?.[1]?.trim().slice(0, 160) || fallback;
}

function literalFromAst(node) {
  if (!node) return UNSUPPORTED_LITERAL;
  if (node.type === 'StringLiteral') {
    if (typeof node.value === 'string') return node.value;
    const decoded = scalarFromLua(node.raw);
    return typeof decoded === 'string' ? decoded : UNSUPPORTED_LITERAL;
  }
  if (node.type === 'NumericLiteral' || node.type === 'BooleanLiteral') return node.value;
  if (node.type === 'NilLiteral') return UNSUPPORTED_LITERAL;
  if (node.type === 'UnaryExpression' && node.operator === '-') {
    const value = literalFromAst(node.argument);
    return typeof value === 'number' ? -value : UNSUPPORTED_LITERAL;
  }
  if (node.type !== 'TableConstructorExpression') return UNSUPPORTED_LITERAL;
  const result = {};
  let arrayIndex = 1;
  node.fields.forEach(field => {
    let key;
    if (field.type === 'TableKeyString') key = field.key.name;
    else if (field.type === 'TableKey') key = literalFromAst(field.key);
    else if (field.type === 'TableValue') key = arrayIndex++;
    if ((typeof key !== 'string' && typeof key !== 'number') || key === UNSUPPORTED_LITERAL) return;
    const value = literalFromAst(field.value);
    if (value !== UNSUPPORTED_LITERAL) result[String(key).toLowerCase()] = value;
  });
  return result;
}

function getLiteralPath(object, path) {
  return path.split('.').reduce((value, key) => (
    value && typeof value === 'object' ? value[key.toLowerCase()] : undefined
  ), object);
}

function isLiteralScalar(value) {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function literalStringArray(value) {
  if (!value || typeof value !== 'object') return null;
  const entries = Object.entries(value)
    .map(([key, item]) => [Number(key), item])
    .filter(([key, item]) => Number.isInteger(key) && key > 0 && typeof item === 'string')
    .sort(([left], [right]) => left - right);
  if (!entries.length || entries.some(([key], index) => key !== index + 1)) return null;
  return entries.map(([, item]) => item.toLowerCase());
}

function parseLiteralUnitTable(source) {
  try {
    const wrapped = /^\s*\{/.test(source) ? `return ${source}` : source;
    const ast = luaparse.parse(wrapped, { luaVersion: '5.1', comments: false });
    const returnStatement = ast.body.find(statement => statement.type === 'ReturnStatement');
    const root = literalFromAst(returnStatement?.arguments?.[0]);
    return root && typeof root === 'object' && root !== UNSUPPORTED_LITERAL ? root : null;
  } catch {
    return null;
  }
}

function extractLiteralUnitConversions(source) {
  const table = parseLiteralUnitTable(source);
  if (!table) return { conversions: [], unitCount: 0, unitIds: [], weaponDefCount: 0 };
  const conversions = [];
  let weaponDefCount = 0;
  Object.entries(table).forEach(([unitId, unitPatch]) => {
    if (!unitPatch || typeof unitPatch !== 'object') return;
    const buildOptions = literalStringArray(unitPatch.buildoptions);
    if (buildOptions) conversions.push({ type: 'build-roster', builderId: unitId, unitIds: buildOptions, origin: 'literal-table' });
    Object.entries(unitPatch).forEach(([sourceKey, value]) => {
      const editorKey = UNIT_FIELD_TO_EDITOR_KEY.get(sourceKey);
      if (editorKey && isLiteralScalar(value)) conversions.push({ type: 'unit-parameter', unitId, key: editorKey, value, origin: 'literal-table' });
    });
    const customParams = unitPatch.customparams;
    if (customParams && typeof customParams === 'object') {
      Object.entries(customParams).forEach(([sourceKey, value]) => {
        const editorKey = UNIT_CUSTOM_TO_EDITOR_KEY.get(sourceKey);
        if (editorKey && isLiteralScalar(value)) conversions.push({ type: 'unit-parameter', unitId, key: editorKey, value, origin: 'literal-table' });
      });
    }

    const mounts = unitPatch.weapons && typeof unitPatch.weapons === 'object' ? unitPatch.weapons : {};
    const defSlots = new Map();
    Object.entries(mounts).forEach(([slotKey, mount]) => {
      if (!mount || typeof mount !== 'object') return;
      const slot = Number(slotKey);
      if (!Number.isInteger(slot) || slot < 1) return;
      const defKey = typeof mount.def === 'string' ? mount.def.toLowerCase() : '';
      if (defKey) defSlots.set(defKey, [...(defSlots.get(defKey) || []), slot]);
      ['onlytargetcategory', 'badtargetcategory', ...WEAPON_SLOT_MOUNT_PARAMS].forEach(key => {
        const value = mount[key.toLowerCase()];
        if (isLiteralScalar(value)) conversions.push({ type: 'weapon-parameter', unitId, weaponDefKey: defKey, slot, key, value, origin: 'literal-table' });
      });
    });

    const weaponDefs = unitPatch.weapondefs && typeof unitPatch.weapondefs === 'object' ? unitPatch.weapondefs : {};
    Object.entries(weaponDefs).forEach(([weaponDefKey, weaponDef]) => {
      if (!weaponDef || typeof weaponDef !== 'object') return;
      weaponDefCount += 1;
      const values = new Map();
      WEAPON_PATH_TO_EDITOR_KEY.forEach((editorKey, path) => {
        const value = getLiteralPath(weaponDef, path);
        if (isLiteralScalar(value)) values.set(editorKey, value);
      });
      Object.entries(weaponDef).forEach(([sourceKey, value]) => {
        if (!isLiteralScalar(value)) return;
        const editorKey = WEAPON_PATH_TO_EDITOR_KEY.get(sourceKey)
          || (WEAPON_SLOT_BOOLEAN_PARAMS.has(sourceKey) || WEAPON_SLOT_STRING_PARAMS.has(sourceKey) || DIRECT_WEAPON_FIELDS.has(sourceKey) ? sourceKey : null);
        if (editorKey) values.set(editorKey, value);
      });
      const slots = defSlots.get(weaponDefKey.toLowerCase()) || [null];
      values.forEach((value, key) => slots.forEach(slot => conversions.push({
        type: 'weapon-parameter', unitId, weaponDefKey: weaponDefKey.toLowerCase(),
        ...(slot ? { slot } : {}), key, value, origin: 'literal-table',
      })));
    });
  });
  return { conversions, unitCount: Object.keys(table).length, unitIds: Object.keys(table), weaponDefCount };
}

function extractHelperCloneConversions(source) {
  const conversions = [];
  const pattern = /\bSET\s*\(\s*["']([a-z0-9_]+)["']\s*\)([\s\S]*?)\bADD\s*\(\s*["']([a-z0-9_]+)["']\s*\)/gi;
  for (const match of source.matchAll(pattern)) {
    const body = match[2];
    const name = body.match(/\bNAME\s*\(\s*["']([^"']+)["']\s*\)/i)?.[1];
    const description = body.match(/\bDESC\s*\(\s*["']([^"']+)["']\s*\)/i)?.[1];
    conversions.push({
      type: 'clone', baseId: match[1].toLowerCase(), newId: match[3].toLowerCase(),
      ...(name ? { displayName: name } : {}), ...(description ? { description } : {}), origin: 'helper-clone',
    });
  }
  return conversions;
}

function walkAst(node, visitor, ancestors = []) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(item => walkAst(item, visitor, ancestors));
    return;
  }
  visitor(node, ancestors);
  const nextAncestors = [...ancestors, node];
  Object.entries(node).forEach(([key, value]) => {
    if (key === 'loc' || key === 'range' || key === 'raw') return;
    if (value && typeof value === 'object') walkAst(value, visitor, nextAncestors);
  });
}

function unitDefsIndexParameter(node, parameterNames) {
  if (node?.type !== 'IndexExpression' || node.base?.type !== 'Identifier' || node.base.name !== 'UnitDefs') return null;
  return node.index?.type === 'Identifier' && parameterNames.has(node.index.name) ? node.index.name : null;
}

function helperCallName(node) {
  return node?.type === 'CallExpression' && node.base?.type === 'Identifier' ? node.base.name : null;
}

function analyzeHelperRecipes(ast) {
  if (!ast) return { helpers: [], recipes: [] };
  const helperMap = new Map();
  walkAst(ast, node => {
    if (node.type !== 'FunctionDeclaration' || node.identifier?.type !== 'Identifier') return;
    const parameters = node.parameters.filter(parameter => parameter.type === 'Identifier').map(parameter => parameter.name);
    if (!parameters.length) return;
    const parameterNames = new Set(parameters);
    const unitReads = new Set();
    const copiedReads = new Set();
    const outputParameters = new Set();
    let loops = 0;
    let assignments = 0;
    let touchesWeapons = false;
    let touchesAssets = false;
    walkAst(node.body, child => {
      if (child.type === 'ForGenericStatement' || child.type === 'ForNumericStatement' || child.type === 'WhileStatement' || child.type === 'RepeatStatement') loops += 1;
      if (child.type === 'AssignmentStatement') {
        assignments += child.variables?.length || 0;
        child.variables?.forEach(variable => {
          const output = unitDefsIndexParameter(variable, parameterNames);
          if (output) outputParameters.add(output);
        });
      }
      const unitParameter = unitDefsIndexParameter(child, parameterNames);
      if (unitParameter) unitReads.add(unitParameter);
      if (child.type === 'CallExpression' && (
        child.base?.type === 'Identifier' && /^(?:copy|deepcopy)$/i.test(child.base.name)
        || child.base?.type === 'MemberExpression' && child.base.indexer === '.' && child.base.identifier?.name === 'copy'
      )) {
        child.arguments?.forEach(argument => {
          const copied = unitDefsIndexParameter(argument, parameterNames);
          if (copied) copiedReads.add(copied);
        });
      }
      if (child.type === 'MemberExpression') {
        const key = String(child.identifier?.name || '').toLowerCase();
        if (key === 'weapondefs' || key === 'weapons') touchesWeapons = true;
        if (['objectname', 'script', 'buildpic', 'collisionvolumescales', 'collisionvolumeoffsets', 'collisionvolumetype'].includes(key)) touchesAssets = true;
      }
    });
    const outputParameter = parameters.find(parameter => outputParameters.has(parameter)) || null;
    const donorParameter = parameters.find(parameter => copiedReads.has(parameter) && parameter !== outputParameter)
      || parameters.find(parameter => unitReads.has(parameter) && parameter !== outputParameter)
      || null;
    if (!outputParameter) return;
    helperMap.set(node.identifier.name, {
      name: node.identifier.name,
      parameters,
      donorParameter,
      outputParameter,
      mode: donorParameter ? 'clone-factory' : 'definition-factory',
      computed: loops > 0 || assignments > 3,
      loops,
      assignments,
      touchesWeapons,
      touchesAssets,
    });
  });

  const recipes = [];
  const visitExecutable = node => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach(visitExecutable);
      return;
    }
    if (node.type === 'FunctionDeclaration') return;
    const name = helperCallName(node);
    const helper = name ? helperMap.get(name) : null;
    if (helper) {
      const values = helper.parameters.map((parameter, index) => {
        const value = literalFromAst(node.arguments?.[index]);
        return value === UNSUPPORTED_LITERAL ? null : value;
      });
      const argumentMap = Object.fromEntries(helper.parameters.map((parameter, index) => [parameter, values[index]]));
      const newId = argumentMap[helper.outputParameter];
      const sourceId = helper.donorParameter ? argumentMap[helper.donorParameter] : null;
      if (typeof newId === 'string') {
        const displayParameter = helper.parameters.find(parameter => /(?:human|display).*name/i.test(parameter));
        const descriptionParameter = helper.parameters.find(parameter => /tooltip|description|desc/i.test(parameter));
        recipes.push({
          helperName: helper.name,
          mode: helper.mode,
          newId: newId.toLowerCase(),
          sourceId: typeof sourceId === 'string' ? sourceId.toLowerCase() : null,
          displayName: displayParameter && typeof argumentMap[displayParameter] === 'string' ? argumentMap[displayParameter] : '',
          description: descriptionParameter && typeof argumentMap[descriptionParameter] === 'string' ? argumentMap[descriptionParameter] : '',
          arguments: argumentMap,
          computed: helper.computed,
          touchesWeapons: helper.touchesWeapons,
          touchesAssets: helper.touchesAssets,
        });
      }
    }
    Object.entries(node).forEach(([key, value]) => {
      if (key === 'loc' || key === 'range' || key === 'raw') return;
      if (value && typeof value === 'object') visitExecutable(value);
    });
  };
  visitExecutable(ast.body);
  const callCounts = recipes.reduce((counts, recipe) => counts.set(recipe.helperName, (counts.get(recipe.helperName) || 0) + 1), new Map());
  return {
    helpers: [...helperMap.values()].map(helper => ({ ...helper, callCount: callCounts.get(helper.name) || 0 })),
    recipes,
  };
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function createModule({ kind, rawLua, payload = '', fieldName = '', sourceName = '', order = 0, label = '', requirements = [] }) {
  const bytes = byteLength(rawLua);
  if (bytes > MAX_TWEAK_MODULE_BYTES) throw new Error('A tweak module cannot exceed 1 MB after decoding.');
  const contentHash = hashText(rawLua);
  return {
    id: `${kind}-${contentHash}`,
    kind,
    label: labelFromLua(rawLua, label || fieldName || `${kind === 'defs' ? 'Definitions' : 'Units'} module`),
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
    requirements,
  };
}

export function parseTweakPackageInput(input, options = {}) {
  const source = String(input || '').trim();
  if (!source) return { modules: [], errors: [], notices: [], requirements: [] };
  if (byteLength(source) > MAX_TWEAK_PACKAGE_BYTES * 1.5) {
    return { modules: [], errors: ['The selected package is larger than the 5 MB import limit.'], notices: [], requirements: [] };
  }

  const modules = [];
  const errors = [];
  const notices = [];
  const requirements = [];
  if (/^\s*!bset\s+forceallunits\s+(?:1|true|on)\s*$/im.test(source)) requirements.push('forceallunits');
  const commandMatches = [...source.matchAll(/^\s*!bset\s+(tweak(defs|units)(\d+)?)\s+([^\s]+)\s*$/gim)];

  if (commandMatches.length) {
    commandMatches.forEach((match, index) => {
      const lineNumber = source.slice(0, match.index).split(/\r?\n/).length;
      try {
        const rawLua = decodeBase64(match[4]);
        modules.push(createModule({
          kind: match[2].toLowerCase(), rawLua, payload: match[4],
          fieldName: match[1].toLowerCase(), sourceName: options.sourceName || '', order: index, requirements,
        }));
      } catch (error) {
        errors.push(`Line ${lineNumber}: ${error.message}`);
      }
    });
    const fieldGroups = modules.reduce((groups, module) => {
      groups[module.originalFieldName] = [...(groups[module.originalFieldName] || []), module];
      return groups;
    }, {});
    Object.entries(fieldGroups).forEach(([fieldName, matches]) => {
      if (matches.length > 1) notices.push(`${fieldName} appears ${matches.length} times and will be reassigned to unique numbered slots.`);
    });
    const legacyFields = modules.filter(module => !/\d+$/.test(module.originalFieldName));
    if (legacyFields.length) notices.push(`${legacyFields.length} unnumbered legacy field${legacyFields.length === 1 ? '' : 's'} will be normalized to the 1–9 slot format.`);
    if (requirements.includes('forceallunits')) notices.push('This package requires Force-load all units. Enable it manually in the BAR lobby.');
  } else {
    const fieldMatch = String(options.fieldName || '').match(FIELD_PATTERN);
    const kind = fieldMatch?.[1]?.toLowerCase() || options.kind;
    if (kind !== 'defs' && kind !== 'units') {
      return { modules: [], errors: ['Choose whether this raw module belongs to Definitions or Units.'], notices, requirements };
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
    return { modules: [], errors: ['Decoded tweak modules exceed the 5 MB package limit.'], notices, requirements };
  }
  const seen = new Set();
  const deduped = modules.filter(module => {
    if (seen.has(module.contentHash)) return false;
    seen.add(module.contentHash);
    return true;
  });
  if (deduped.length !== modules.length) errors.push(`${modules.length - deduped.length} duplicate module(s) were skipped.`);
  return { modules: deduped, errors, notices, requirements };
}

export function analyzeTweakModule(module) {
  const source = String(module?.rawLua || '');
  let parseError = null;
  let ast = null;
  try {
    const parseSource = module?.kind === 'units' && /^\s*\{/.test(source) ? `return ${source}` : source;
    ast = luaparse.parse(parseSource, { luaVersion: '5.1', locations: true, comments: false });
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
  const helperCloneConversions = module?.kind === 'defs' ? extractHelperCloneConversions(source) : [];
  helperCloneConversions.forEach(conversion => created.push(conversion.newId));
  const helperAnalysis = module?.kind === 'defs' ? analyzeHelperRecipes(ast) : { helpers: [], recipes: [] };
  helperAnalysis.recipes.forEach(recipe => created.push(recipe.newId));

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
  const literalTable = module?.kind === 'units'
    ? extractLiteralUnitConversions(source)
    : { conversions: [], unitCount: 0, unitIds: [], weaponDefCount: 0 };
  const conversions = [...cloneConversions, ...helperCloneConversions, ...buildMenuConversions, ...parameterConversions, ...literalTable.conversions];
  const dedupedConversions = [...new Map(conversions.map(conversion => [JSON.stringify(conversion), conversion])).values()];
  const conversionUnitReferences = dedupedConversions.flatMap(conversion => {
    if (conversion.type === 'clone') return [conversion.baseId];
    if (conversion.type === 'build-add' || conversion.type === 'build-remove') return [conversion.builderId, conversion.unitId];
    if (conversion.type === 'build-roster') return [conversion.builderId, ...(conversion.unitIds || [])];
    if (conversion.type === 'unit-parameter' || conversion.type === 'weapon-parameter') return [conversion.unitId];
    return [];
  });
  return {
    parseError,
    decodedBytes: byteLength(source),
    createdUnits: unique(created),
    referencedUnits: unique([
      ...unitReferences, ...dotReferences, ...literalTable.unitIds,
      ...helperAnalysis.recipes.map(recipe => recipe.sourceId),
      ...conversionUnitReferences,
    ]).filter(unitId => !created.includes(unitId)),
    customParameters: unique(customParameters),
    weaponCustomParameters: supportedWeaponParams,
    weaponChanges: (source.match(/\.weapondefs|\[\s*["'][a-z0-9_]+["']\s*\]\.weapons/gi) || []).length + literalTable.weaponDefCount,
    buildMenuOperations: dedupedConversions.filter(conversion => (
      conversion.type === 'build-add' || conversion.type === 'build-remove' || conversion.type === 'build-roster'
    )).length,
    literalUnitTables: literalTable.unitCount,
    literalWeaponDefinitions: literalTable.weaponDefCount,
    helpers: helperAnalysis.helpers,
    recipes: helperAnalysis.recipes,
    warnings,
    conversions: dedupedConversions,
  };
}

function compareModuleLoadOrder(left, right) {
  const kindDifference = (left.kind === 'defs' ? 0 : 1) - (right.kind === 'defs' ? 0 : 1);
  if (kindDifference) return kindDifference;
  const stageDifference = (left.stage === 'after-editor' ? 1 : 0) - (right.stage === 'after-editor' ? 1 : 0);
  if (stageDifference) return stageDifference;
  return Number(left.order || 0) - Number(right.order || 0);
}

export function analyzeTweakPackage(modules, options = {}) {
  const moduleList = Array.isArray(modules) ? modules : [];
  const knownUnitIds = new Set([...(options.knownUnitIds || [])].map(unitId => String(unitId).toLowerCase()));
  const analyses = new Map(moduleList.map(module => [module.id, analyzeTweakModule(module)]));
  const creators = new Map();
  moduleList.forEach(module => {
    analyses.get(module.id).createdUnits.forEach(unitId => {
      creators.set(unitId, [...(creators.get(unitId) || []), module.id]);
    });
  });
  const collisions = [...creators.entries()]
    .filter(([, moduleIds]) => moduleIds.length > 1)
    .map(([unitId, moduleIds]) => ({ unitId, moduleIds }));
  const edgeMap = new Map();
  const unresolved = [];
  moduleList.forEach(module => {
    const analysis = analyses.get(module.id);
    analysis.referencedUnits.forEach(unitId => {
      const providers = (creators.get(unitId) || []).filter(moduleId => moduleId !== module.id);
      if (providers.length) {
        providers.forEach(providerId => {
          const key = `${module.id}:${providerId}`;
          const edge = edgeMap.get(key) || { from: module.id, to: providerId, unitIds: [] };
          edge.unitIds.push(unitId);
          edgeMap.set(key, edge);
        });
      } else if (!knownUnitIds.has(unitId) && !analysis.createdUnits.includes(unitId)) {
        unresolved.push({ moduleId: module.id, unitId });
      }
    });
  });
  const edges = [...edgeMap.values()].map(edge => ({ ...edge, unitIds: unique(edge.unitIds) }));
  const orderedModules = [...moduleList].sort(compareModuleLoadOrder);
  const loadIndex = new Map(orderedModules.map((module, index) => [module.id, index]));
  const orderingIssues = edges.filter(edge => loadIndex.get(edge.to) > loadIndex.get(edge.from));
  const adjacency = edges.reduce((map, edge) => {
    map.set(edge.from, [...(map.get(edge.from) || []), edge.to]);
    return map;
  }, new Map());
  const cycleKeys = new Set();
  const visit = (moduleId, trail = []) => {
    const cycleStart = trail.indexOf(moduleId);
    if (cycleStart >= 0) {
      const cycle = [...trail.slice(cycleStart), moduleId];
      const normalized = [...new Set(cycle)].sort().join(':');
      cycleKeys.add(normalized);
      return;
    }
    if (trail.length >= moduleList.length) return;
    (adjacency.get(moduleId) || []).forEach(nextId => visit(nextId, [...trail, moduleId]));
  };
  moduleList.forEach(module => visit(module.id));
  const cycles = [...cycleKeys].map(key => key.split(':'));
  const moduleReports = moduleList.map(module => ({
    moduleId: module.id,
    dependencies: edges.filter(edge => edge.from === module.id),
    dependents: edges.filter(edge => edge.to === module.id),
    unresolved: unresolved.filter(item => item.moduleId === module.id),
    collisions: collisions.filter(item => item.moduleIds.includes(module.id)),
  }));
  return {
    analyses,
    edges,
    unresolved,
    collisions,
    orderingIssues,
    cycles,
    moduleReports,
    recipes: moduleList.flatMap(module => analyses.get(module.id).recipes.map(recipe => ({ ...recipe, moduleId: module.id }))),
  };
}
