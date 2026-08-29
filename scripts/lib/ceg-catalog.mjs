import fs from 'node:fs';
import path from 'node:path';
import fengari from 'fengari';

const {
  lua,
  lauxlib,
  lualib,
  to_jsstring: toJsString,
  to_luastring: toLuaString,
} = fengari;

const DEFAULT_INSTRUCTION_LIMIT = 2_000_000;

const CEG_BOOTSTRAP = `
local function deepCopy(value, seen)
  if type(value) ~= "table" then return value end
  seen = seen or {}
  if seen[value] then return seen[value] end
  local copy = {}
  seen[value] = copy
  for key, child in pairs(value) do
    copy[deepCopy(key, seen)] = deepCopy(child, seen)
  end
  return copy
end

local function mergeTable(target, source, deep)
  if type(target) ~= "table" or type(source) ~= "table" then return target end
  for key, value in pairs(source) do
    if deep and type(value) == "table" and type(target[key]) == "table" then
      mergeTable(target[key], value, true)
    else
      target[key] = value
    end
  end
  return target
end

table.copy = function(value) return deepCopy(value, {}) end
table.merge = function(target, source)
  return mergeTable(deepCopy(target, {}), source, true)
end
table.mergeInPlace = function(target, source)
  return mergeTable(target, source, true)
end
CopyTable = function(value, deep) return deep and deepCopy(value, {}) or value end
MergeTable = mergeTable
lowerkeys = function(value)
  if type(value) ~= "table" then return value end
  local result = {}
  for key, child in pairs(value) do
    result[type(key) == "string" and string.lower(key) or key] = child
  end
  return result
end
math.round = math.round or function(value) return math.floor(value + 0.5) end
Spring = { Echo = function(...) end }
VFS = {}
`;

function walkLuaFiles(directory, files = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walkLuaFiles(absolute, files);
    else if (entry.name.toLowerCase().endsWith('.lua')) files.push(absolute);
  }
  return files;
}

function luaError(L, context) {
  const raw = lua.lua_tostring(L, -1);
  const message = raw ? toJsString(raw) : 'Unknown Lua runtime error';
  lua.lua_pop(L, 1);
  return new Error(`${context}: ${message}`);
}

function runChunk(L, source, context, resultCount = 0, instructionLimit = DEFAULT_INSTRUCTION_LIMIT) {
  const bytes = toLuaString(source);
  const status = lauxlib.luaL_loadbuffer(L, bytes, bytes.length, toLuaString(`@${context}`));
  if (status !== lua.LUA_OK) throw luaError(L, `${context} failed to load`);
  lua.lua_sethook(L, hookState => (
    lauxlib.luaL_error(hookState, toLuaString(`Instruction budget exceeded in ${context}`))
  ), lua.LUA_MASKCOUNT, instructionLimit);
  const executionStatus = lua.lua_pcall(L, 0, resultCount, 0);
  lua.lua_sethook(L, null, 0, 0);
  if (executionStatus !== lua.LUA_OK) throw luaError(L, `${context} failed at runtime`);
}

export function evaluateCegDefinitionNames(source, sourceName = 'CEG source') {
  const L = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(L);
  try {
    runChunk(L, CEG_BOOTSTRAP, 'CEG discovery bootstrap');
    runChunk(L, source, sourceName, 1);
    if (lua.lua_type(L, -1) !== lua.LUA_TTABLE) return [];

    const names = [];
    const tableIndex = lua.lua_absindex(L, -1);
    lua.lua_pushnil(L);
    while (lua.lua_next(L, tableIndex) !== 0) {
      if (lua.lua_type(L, -2) === lua.LUA_TSTRING) {
        names.push(toJsString(lua.lua_tostring(L, -2)));
      }
      lua.lua_pop(L, 1);
    }
    return names;
  } finally {
    lua.lua_close(L);
  }
}

export function collectCegCatalog(effectsDirectory, { strict = false } = {}) {
  if (!fs.existsSync(effectsDirectory)) {
    throw new Error(`BAR effect sources were not found at ${effectsDirectory}.`);
  }

  const names = new Map();
  const failures = [];
  const files = walkLuaFiles(effectsDirectory).sort((left, right) => left.localeCompare(right));
  for (const file of files) {
    try {
      const source = fs.readFileSync(file, 'utf8');
      for (const name of evaluateCegDefinitionNames(source, path.relative(effectsDirectory, file))) {
        const clean = String(name).trim();
        if (clean) names.set(clean.toLowerCase(), clean);
      }
    } catch (error) {
      failures.push({ file: path.relative(effectsDirectory, file), message: error.message });
    }
  }

  if (strict && failures.length) {
    throw new AggregateError(
      failures.map(failure => new Error(`${failure.file}: ${failure.message}`)),
      `${failures.length} BAR CEG source files could not be evaluated.`,
    );
  }

  return {
    names: [...names.values()].sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' })),
    filesScanned: files.length,
    filesLoaded: files.length - failures.length,
    failures,
  };
}
