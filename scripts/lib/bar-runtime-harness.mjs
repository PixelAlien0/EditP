import fengari from 'fengari';
import { serializeLuaTable } from '../../src/utils/tweakSerializer.js';

const {
  lua,
  lauxlib,
  lualib,
  to_jsstring: toJsString,
  to_luastring: toLuaString,
} = fengari;

const DEFAULT_INSTRUCTION_LIMIT = 1_000_000;
const DEFAULT_MAX_SNAPSHOT_DEPTH = 20;

const RUNTIME_BOOTSTRAP = `
local function editp_deep_copy(value, seen)
  if type(value) ~= "table" then return value end
  seen = seen or {}
  if seen[value] then return seen[value] end
  local copy = {}
  seen[value] = copy
  for key, child in pairs(value) do
    copy[editp_deep_copy(key, seen)] = editp_deep_copy(child, seen)
  end
  return copy
end

local function editp_deep_merge(target, patch)
  for key, value in pairs(patch) do
    if type(value) == "table" and type(target[key]) == "table" then
      editp_deep_merge(target[key], value)
    else
      target[key] = editp_deep_copy(value)
    end
  end
  return target
end

table.copy = function(value)
  return editp_deep_copy(value, {})
end
UnitDefNames = UnitDefs
WeaponDefNames = WeaponDefs
Spring = {
  Echo = function(...) end,
  GetModOptions = function() return {} end,
}
VFS = {
  Include = function(path)
    error("VFS.Include is unavailable in the isolated BAR compatibility harness: " .. tostring(path))
  end,
}
Game = { gameSpeed = 30 }

__EDITP_APPLY_UNIT_PATCHES = function(patches)
  if type(patches) ~= "table" then
    error("tweakunits payload did not return a table")
  end
  for unitId, patch in pairs(patches) do
    if type(unitId) ~= "string" or type(patch) ~= "table" then
      error("tweakunits payload contains a non-literal UnitDef patch")
    end
    local target = UnitDefs[unitId]
    if type(target) ~= "table" then
      target = {}
      UnitDefs[unitId] = target
    end
    editp_deep_merge(target, patch)
    UnitDefNames[unitId] = target
  end
end

io = nil
os = nil
package = nil
require = nil
dofile = nil
loadfile = nil
`;

function luaError(L, context) {
  const raw = lua.lua_tostring(L, -1);
  const message = raw ? toJsString(raw) : 'Unknown Lua runtime error';
  lua.lua_pop(L, 1);
  return new Error(`${context}: ${message}`);
}

function runLuaChunk(L, source, context, {
  instructionLimit = DEFAULT_INSTRUCTION_LIMIT,
  resultCount = 0,
} = {}) {
  const sourceBytes = toLuaString(source);
  const status = lauxlib.luaL_loadbuffer(
    L,
    sourceBytes,
    sourceBytes.length,
    toLuaString(`@${context}`),
  );
  if (status !== lua.LUA_OK) throw luaError(L, `${context} failed to load`);

  if (instructionLimit > 0) {
    lua.lua_sethook(L, hookState => (
      lauxlib.luaL_error(
        hookState,
        toLuaString(`Instruction budget exceeded in ${context}`),
      )
    ), lua.LUA_MASKCOUNT, instructionLimit);
  }
  const executionStatus = lua.lua_pcall(L, 0, resultCount, 0);
  lua.lua_sethook(L, null, 0, 0);
  if (executionStatus !== lua.LUA_OK) throw luaError(L, `${context} failed at runtime`);
}

function luaValueToJs(L, index, depth, maxDepth, visited) {
  if (depth > maxDepth) return '[snapshot depth exceeded]';
  const valueType = lua.lua_type(L, index);
  if (valueType === lua.LUA_TNIL) return null;
  if (valueType === lua.LUA_TBOOLEAN) return Boolean(lua.lua_toboolean(L, index));
  if (valueType === lua.LUA_TNUMBER) return lua.lua_tonumber(L, index);
  if (valueType === lua.LUA_TSTRING) return toJsString(lua.lua_tostring(L, index));
  if (valueType !== lua.LUA_TTABLE) return `[${toJsString(lua.lua_typename(L, valueType))}]`;

  const absoluteIndex = lua.lua_absindex(L, index);
  const pointer = lua.lua_topointer(L, absoluteIndex);
  if (visited.has(pointer)) return '[circular]';
  visited.add(pointer);
  const entries = [];
  lua.lua_pushnil(L);
  while (lua.lua_next(L, absoluteIndex) !== 0) {
    const key = luaValueToJs(L, -2, depth + 1, maxDepth, visited);
    const value = luaValueToJs(L, -1, depth + 1, maxDepth, visited);
    entries.push([key, value]);
    lua.lua_pop(L, 1);
  }
  visited.delete(pointer);

  const numericKeys = entries
    .map(([key]) => key)
    .filter(key => Number.isInteger(key) && key > 0);
  const isArray = numericKeys.length === entries.length
    && numericKeys.length > 0
    && Math.max(...numericKeys) === numericKeys.length;
  if (isArray) {
    const result = Array.from({ length: numericKeys.length });
    entries.forEach(([key, value]) => { result[key - 1] = value; });
    return result;
  }
  return Object.fromEntries(entries.map(([key, value]) => [String(key), value]));
}

function readGlobal(L, name, maxDepth) {
  lua.lua_getglobal(L, toLuaString(name));
  const value = luaValueToJs(L, -1, 0, maxDepth, new Set());
  lua.lua_pop(L, 1);
  return value;
}

function normalizeSeed(seed) {
  return seed && typeof seed === 'object' ? structuredClone(seed) : {};
}

export function executeCompiledBarModules(compiledModules, {
  unitDefs = {},
  weaponDefs = {},
  allowImportedModules = false,
  instructionLimit = DEFAULT_INSTRUCTION_LIMIT,
  maxSnapshotDepth = DEFAULT_MAX_SNAPSHOT_DEPTH,
} = {}) {
  if (!compiledModules || !Array.isArray(compiledModules.slots)) {
    throw new TypeError('Compiled lobby modules are required.');
  }
  if (compiledModules.overflow) {
    throw new Error('Cannot execute a package that exceeds BAR’s numbered lobby fields.');
  }
  if (!allowImportedModules && compiledModules.slots.some(slot => slot.source === 'imported')) {
    throw new Error('Imported Lua is disabled in the runtime harness unless allowImportedModules is explicitly enabled.');
  }

  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  const execution = [];
  try {
    runLuaChunk(
      L,
      `UnitDefs = ${serializeLuaTable(normalizeSeed(unitDefs))}\nWeaponDefs = ${serializeLuaTable(normalizeSeed(weaponDefs))}`,
      'BAR mock seed',
      { instructionLimit },
    );
    runLuaChunk(L, RUNTIME_BOOTSTRAP, 'BAR mock bootstrap', { instructionLimit });

    for (const slot of compiledModules.slots) {
      const source = slot.kind === 'units'
        ? `__EDITP_APPLY_UNIT_PATCHES(${slot.lua})`
        : slot.lua;
      runLuaChunk(L, source, slot.fieldName, { instructionLimit });
      execution.push({
        fieldName: slot.fieldName,
        kind: slot.kind,
        source: slot.source,
        encodedBytes: slot.encodedBytes,
        blockIds: [...(slot.blockIds || [])],
      });
    }

    return {
      status: 'passed',
      unitDefs: readGlobal(L, 'UnitDefs', maxSnapshotDepth),
      weaponDefs: readGlobal(L, 'WeaponDefs', maxSnapshotDepth),
      execution,
      summary: {
        definitionsSlots: execution.filter(item => item.kind === 'defs').length,
        unitsSlots: execution.filter(item => item.kind === 'units').length,
        unitCount: Object.keys(readGlobal(L, 'UnitDefs', 1) || {}).length,
        weaponCount: Object.keys(readGlobal(L, 'WeaponDefs', 1) || {}).length,
      },
    };
  } finally {
    lua.lua_close(L);
  }
}

function readPath(root, path) {
  return String(path || '').split('.').filter(Boolean).reduce(
    (value, segment) => value?.[segment],
    root,
  );
}

export function evaluateRuntimeExpectations(result, expectations = {}) {
  const issues = [];
  const checkExists = (rootName, root, ids, expected) => {
    (ids || []).forEach(id => {
      const exists = root?.[id] !== undefined && root?.[id] !== null;
      if (exists !== expected) {
        issues.push({
          code: expected ? `${rootName}-missing` : `${rootName}-unexpected`,
          path: `${rootName}.${id}`,
          message: expected
            ? `${rootName}.${id} was not created.`
            : `${rootName}.${id} should not exist.`,
        });
      }
    });
  };
  checkExists('UnitDefs', result?.unitDefs, expectations.unitsExist, true);
  checkExists('UnitDefs', result?.unitDefs, expectations.unitsMissing, false);
  checkExists('WeaponDefs', result?.weaponDefs, expectations.weaponsExist, true);
  checkExists('WeaponDefs', result?.weaponDefs, expectations.weaponsMissing, false);

  (expectations.paths || []).forEach(expectation => {
    const root = expectation.root === 'WeaponDefs' ? result?.weaponDefs : result?.unitDefs;
    const actual = readPath(root, expectation.path);
    if (JSON.stringify(actual) !== JSON.stringify(expectation.equals)) {
      issues.push({
        code: 'value-mismatch',
        path: `${expectation.root || 'UnitDefs'}.${expectation.path}`,
        message: `Expected ${JSON.stringify(expectation.equals)}, received ${JSON.stringify(actual)}.`,
      });
    }
  });

  Object.entries(expectations.buildMenus || {}).forEach(([builderId, expectation]) => {
    const options = result?.unitDefs?.[builderId]?.buildoptions;
    if (!Array.isArray(options)) {
      issues.push({
        code: 'build-menu-missing',
        path: `UnitDefs.${builderId}.buildoptions`,
        message: `${builderId} has no runtime buildoptions array.`,
      });
      return;
    }
    (expectation.includes || []).forEach(unitId => {
      if (!options.includes(unitId)) {
        issues.push({
          code: 'build-menu-unit-missing',
          path: `UnitDefs.${builderId}.buildoptions`,
          message: `${unitId} was not added to ${builderId}.`,
        });
      }
    });
    (expectation.excludes || []).forEach(unitId => {
      if (options.includes(unitId)) {
        issues.push({
          code: 'build-menu-unit-unexpected',
          path: `UnitDefs.${builderId}.buildoptions`,
          message: `${unitId} should have been removed from ${builderId}.`,
        });
      }
    });
  });
  return issues;
}

export function assertRuntimeCompatibility(result, expectations) {
  const issues = evaluateRuntimeExpectations(result, expectations);
  if (issues.length) {
    throw new AggregateError(
      issues.map(issue => new Error(`${issue.path}: ${issue.message}`)),
      `BAR runtime compatibility failed with ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}.`,
    );
  }
  return result;
}
