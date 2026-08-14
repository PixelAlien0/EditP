import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { lua, lauxlib, lualib, to_luastring, to_jsstring } from 'fengari';

const gadgetSource = readFileSync(
  resolve(process.cwd(), 'runtime/prerequisites/LuaRules/Gadgets/unit_build_prerequisites.lua'),
  'utf8',
);

function runLua(source) {
  const state = lauxlib.luaL_newstate();
  lualib.luaL_openlibs(state);
  const status = lauxlib.luaL_dostring(state, to_luastring(source));
  if (status !== lua.LUA_OK) {
    const message = to_jsstring(lua.lua_tostring(state, -1));
    lua.lua_close(state);
    throw new Error(message);
  }
  lua.lua_close(state);
}

describe('BAR EditP prerequisite runtime gadget', () => {
  it('enforces strict, persistent, and any-mode team unlocks in synced Lua', () => {
    const harness = `
gadget = {}
gadgetHandler = { IsSyncedCode = function() return true end }
CMD = { STOP = 0 }
commandEdits = {}
blockedUnits = {}
GG = { BuildBlocking = {
  AddBlockedUnit = function(unitDefID, teamID, reason)
    blockedUnits[teamID] = blockedUnits[teamID] or {}
    blockedUnits[teamID][unitDefID] = reason
  end,
  RemoveBlockedUnit = function(unitDefID, teamID, _reason)
    blockedUnits[teamID] = blockedUnits[teamID] or {}
    blockedUnits[teamID][unitDefID] = nil
    return true
  end,
} }
Spring = {
  Echo = function() end,
  GetAllUnits = function() return { 90 } end,
  GetUnitDefID = function(unitID) if unitID == 90 then return 6 end return nil end,
  GetUnitTeam = function(unitID) if unitID == 90 then return 7 end return nil end,
  GetUnitHealth = function(unitID)
    if unitID == 90 then return 100, 100, 0, 0, 1 end
    return nil, nil, nil, nil, 0
  end,
  GetTeamList = function() return { 7, 8 } end,
  FindUnitCmdDesc = function(unitID, cmdID)
    if unitID == 90 and (cmdID == -2 or cmdID == -3 or cmdID == -5) then return -cmdID end
    return nil
  end,
  GetUnitCmdDescs = function(_unitID, startIndex)
    return { { tooltip = "Build target " .. tostring(startIndex), disabled = false } }
  end,
  EditUnitCmdDesc = function(_unitID, cmdDescID, changes)
    commandEdits[cmdDescID] = changes
  end,
}
UnitDefs = {
  [1] = { name = "tech_lab", humanName = "Tech Lab", customParams = {} },
  [2] = { name = "Strict Target", customParams = {
    editp_prerequisite_units = "tech_lab",
    editp_prerequisite_mode = "all",
  } },
  [3] = { name = "Persistent Target", customParams = {
    editp_prerequisite_units = "tech_lab",
    editp_prerequisite_persistent = 1,
  } },
  [4] = { name = "Alternative", customParams = {} },
  [5] = { name = "Any Target", customParams = {
    editp_prerequisite_units = "tech_lab alternative",
    editp_prerequisite_mode = "any",
  } },
  [6] = { name = "builder", humanName = "Builder", customParams = {}, buildOptions = { 2, 3, 5 } },
}
UnitDefNames = {
  tech_lab = { id = 1 },
  strict_target = { id = 2 },
  persistent_target = { id = 3 },
  alternative = { id = 4 },
  any_target = { id = 5 },
  builder = { id = 6 },
}
`;
    const assertions = `
gadget:Initialize()
assert(commandEdits[2].disabled == false)
assert(string.find(commandEdits[2].tooltip, "LOCKED", 1, true) ~= nil)
assert(string.find(commandEdits[2].tooltip, "Tech Lab", 1, true) ~= nil)
assert(blockedUnits[7][2] == "editp_prerequisite")
assert(gadget:AllowCommand(90, 1, 7, -2) == false)
assert(gadget:AllowUnitCreation(2, 90, 7) == false)
assert(gadget:AllowUnitCreation(2, nil, 7) == true)
gadget:UnitFinished(100, 1, 7)
assert(commandEdits[2].disabled == false)
assert(commandEdits[2].tooltip == "Build target 2")
assert(blockedUnits[7][2] == nil)
assert(gadget:AllowCommand(90, 1, 7, -2) == true)
assert(gadget:AllowCommand(90, 1, 8, -2) == false)
assert(gadget:AllowCommand(90, 1, 7, -3) == true)
gadget:UnitDestroyed(100, 1, 7)
assert(commandEdits[2].disabled == false)
assert(blockedUnits[7][2] == "editp_prerequisite")
assert(gadget:AllowCommand(90, 1, 7, -2) == false)
assert(gadget:AllowCommand(90, 1, 7, -3) == true)
gadget:UnitFinished(101, 4, 7)
assert(gadget:AllowCommand(90, 1, 7, -5) == true)
gadget:UnitGiven(101, 4, 8, 7)
assert(gadget:AllowCommand(90, 1, 7, -5) == false)
assert(gadget:AllowCommand(90, 1, 8, -5) == true)
`;
    expect(() => runLua(`${harness}\n${gadgetSource}\n${assertions}`)).not.toThrow();
  });
});
