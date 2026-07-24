import { serializeLuaTable } from './tweakSerializer.js';

export const BUILDMENU_BEGIN = '-- EDITP_BUILDMENU_BEGIN';
export const BUILDMENU_END = '-- EDITP_BUILDMENU_END';
const LEGACY_BUILDMENU_BEGIN = '-- BMF_BUILDMENU_BEGIN';
const LEGACY_BUILDMENU_END = '-- BMF_BUILDMENU_END';
export const DEATH_PROFILE_BEGIN = '-- EDITP_DEATH_PROFILES_BEGIN';
export const DEATH_PROFILE_END = '-- EDITP_DEATH_PROFILES_END';
export const SUPPORTING_WEAPONDEFS_BEGIN = '-- EDITP_SUPPORTING_WEAPONDEFS_BEGIN';
export const SUPPORTING_WEAPONDEFS_END = '-- EDITP_SUPPORTING_WEAPONDEFS_END';
export const CARRIER_LINKAGE_BEGIN = '-- EDITP_CARRIER_LINKAGE_BEGIN';
export const CARRIER_LINKAGE_END = '-- EDITP_CARRIER_LINKAGE_END';


function escapeLuaString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

export function generateDeathProfilesBlockLua(profiles = []) {
  if (!profiles.length) return '';
  const calls = [];
  const sourceProfiles = {};
  for (const profile of profiles) {
    const unitId = String(profile.unitId || '').trim().toLowerCase();
    if (!unitId) continue;
    for (const kind of ['death', 'selfd']) {
      const sourceName = String(kind === 'death' ? profile.explodeAs || '' : profile.selfDestructAs || profile.explodeAs || '').trim();
      const values = profile[kind] || {};
      const patch = {};
      for (const key of ['damage', 'aoe', 'camerashake', 'impulsefactor']) {
        const value = Number(values[key]);
        if (Number.isFinite(value)) patch[key] = value;
      }
      if (!sourceName || Object.keys(patch).length === 0) continue;
      const sourceKey = sourceName.toLowerCase();
      const bundledSource = profile.sources?.[kind]?.definition;
      sourceProfiles[sourceKey] = bundledSource || {
        areaofeffect: patch.aoe ?? 0,
        camerashake: patch.camerashake ?? 0,
        impulsefactor: patch.impulsefactor ?? 0,
        damage: { default: patch.damage ?? 0 },
        customparams: { unitexplosion: 1 },
      };
      calls.push(`editp_death_profile(${JSON.stringify(unitId)}, ${JSON.stringify(kind)}, editp_profiles[${JSON.stringify(sourceKey)}], ${JSON.stringify(patch).replace(/"([^"\s]+)":/g, '$1 =')})`);
    }
  }
  if (!calls.length) return '';
  return `${DEATH_PROFILE_BEGIN}
local editp_profiles = ${serializeLuaTable(sourceProfiles)}

local function editp_copy_table(value)
  if type(value) ~= "table" then return value end
  local copy = {}
  for key, child in pairs(value) do copy[key] = editp_copy_table(child) end
  return copy
end

local function editp_death_profile(unit_name, kind, source, patch)
  local unit = UnitDefs and UnitDefs[unit_name]
  if not unit or type(source) ~= "table" then return end
  local profile_name = "editp_" .. kind
  local profile = editp_copy_table(source)
  if patch.damage ~= nil then
    profile.damage = profile.damage or {}
    profile.damage.default = patch.damage
  end
  if patch.aoe ~= nil then profile.areaofeffect = patch.aoe end
  if patch.camerashake ~= nil then profile.camerashake = patch.camerashake end
  if patch.impulsefactor ~= nil then profile.impulsefactor = patch.impulsefactor end
  unit.weapondefs = unit.weapondefs or {}
  unit.weapondefs[profile_name] = profile
  unit[kind == "death" and "explodeas" or "selfdestructas"] = profile_name
end

${calls.join('\n')}
${DEATH_PROFILE_END}`;
}

export function generateSupportingWeaponDefsBlockLua(definitions = []) {
  const entries = definitions
    .filter(definition => definition?.enabled !== false && definition?.ownerUnitId && definition?.key && definition?.definition)
    .map(definition => ({
      owner: String(definition.ownerUnitId).trim().toLowerCase(),
      key: String(definition.key).trim().toLowerCase(),
      mode: definition.mode === 'create-only' ? 'create-only' : 'replace',
      definition: definition.definition,
      mountedSlots: Array.isArray(definition.mountedSlots)
        ? [...new Set(definition.mountedSlots.map(Number).filter(slot => Number.isInteger(slot) && slot > 0))]
        : [],
    }))
    .filter(entry => entry.owner && entry.key && entry.definition && typeof entry.definition === 'object')
    .sort((left, right) => left.owner.localeCompare(right.owner) || left.key.localeCompare(right.key));
  if (!entries.length) return '';
  const payload = serializeLuaTable({ entries });
  return `${SUPPORTING_WEAPONDEFS_BEGIN}
local editp_supporting_weapondefs = ${payload}

for _, entry in ipairs(editp_supporting_weapondefs.entries) do
  local unit = UnitDefs and UnitDefs[entry.owner]
  if unit then
    unit.weapondefs = unit.weapondefs or {}
    if entry.mode == "replace" or unit.weapondefs[entry.key] == nil then
      unit.weapondefs[entry.key] = table.copy(entry.definition)
    end
    if type(entry.mountedSlots) == "table" and #entry.mountedSlots > 0 then
      unit.weapons = unit.weapons or {}
      for _, slot in ipairs(entry.mountedSlots) do
        unit.weapons[slot] = unit.weapons[slot] or {}
        unit.weapons[slot].def = string.upper(entry.key)
      end
    end
  end
end
${SUPPORTING_WEAPONDEFS_END}`;
}

function generateWeaponBlueprintOverridesLua(blueprint, weaponDefKey) {
  const overrides = blueprint?.overrides || {};
  const lines = [];
  const numberFields = {
    damage: 'damage.default',
    range: 'range',
    reload: 'reloadtime',
    velocity: 'weaponvelocity',
    aoe: 'areaofeffect',
    projectiles: 'projectiles',
    burst: 'burst',
    burstrate: 'burstrate',
    accuracy: 'accuracy',
    sprayangle: 'sprayangle',
    flighttime: 'flighttime'
  };

  Object.entries(numberFields).forEach(([key, path]) => {
    const value = Number(overrides[key]);
    if (!Number.isFinite(value)) return;
    if (path === 'damage.default') {
      lines.push(`      w.damage = w.damage or {}`);
      lines.push(`      w.damage.default = ${value}`);
    } else {
      lines.push(`      w.${path} = ${value}`);
    }
  });

  ['cegtag', 'explosiongenerator', 'model'].forEach(key => {
    if (typeof overrides[key] === 'string' && overrides[key].trim()) {
      lines.push(`      w.${key} = ${JSON.stringify(overrides[key].trim())}`);
    }
  });

  if (lines.length === 0) return [];
  return [
    `    if u.weapondefs and u.weapondefs[${JSON.stringify(weaponDefKey)}] then`,
    `      local w = u.weapondefs[${JSON.stringify(weaponDefKey)}]`,
    ...lines,
    `    end`
  ];
}

export function generateSingleCloneLua(clone, weaponLibrary = []) {
  let baseId = clone.baseId.trim();
  const newId = clone.newId.trim().toLowerCase();
  if (!baseId || !newId) return '';

  if (baseId.startsWith('scav_')) {
    baseId = baseId.slice(5);
  }

  const r = JSON.stringify(baseId);
  const i = JSON.stringify(newId);
  const lines = [
    `do`,
    `  local s = ${r}`,
    `  local n = ${i}`,
    `  if UnitDefs[s] and not UnitDefs[n] then`,
    `    UnitDefs[n] = clone_copy(UnitDefs[s])`,
    `    local u = UnitDefs[n]`,
    `    if UnitDefNames then UnitDefNames[n] = u end`,
    `    clone_clean(u)`,
    `    local srcBo = UnitDefs[s].buildoptions`,
    `    if type(srcBo) == "table" then`,
    `      local bo = {}`,
    `      for _, x in ipairs(srcBo) do`,
    `        if type(x) == "string" then`,
    `          bo[#bo + 1] = x`,
    `        end`,
    `      end`,
    `      u.buildoptions = bo`,
    `    end`
  ];
  
  const displayName = clone.displayName?.trim();
  const customTooltip = clone.customTooltip?.trim() || clone.description?.trim() || displayName;
  if (displayName) {
    lines.push(`    clone_set_name(u, ${JSON.stringify(displayName)}, ${JSON.stringify(customTooltip)})`);
  }
  
  if (clone.iconType) {
    lines.push(`    u.icontype = ${JSON.stringify(clone.iconType)}`);
  }
  
  if (clone.weaponSwaps) {
    Object.entries(clone.weaponSwaps).forEach(([slotNum, swap]) => {
      let srcUnit = swap.sourceUnitId.trim().toLowerCase();
      // strip scav_ prefix for weapon source too
      if (srcUnit.startsWith('scav_')) srcUnit = srcUnit.slice(5);
      const srcWep = swap.sourceWeaponDefKey.trim().toLowerCase();
      if (srcUnit && srcWep) {
        const blueprint = swap.libraryWeaponId
          ? weaponLibrary.find(item => item.id === swap.libraryWeaponId)
          : null;
        const targetWep = blueprint ? `editp_${blueprint.id.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}` : srcWep;
        lines.push(`    clone_swap_weapon(u, ${slotNum}, ${JSON.stringify(srcUnit)}, ${JSON.stringify(srcWep)}, ${JSON.stringify(targetWep)})`);
        if (blueprint) {
          lines.push(...generateWeaponBlueprintOverridesLua(blueprint, targetWep));
        }
      }
    });
  }
  lines.push(`  end`, `end`);
  return lines.join('\n');
}

export function traceAncestor(unitId, clones) {
  let currentId = unitId.trim().toLowerCase();
  const visited = new Set();
  for (let i = 0; i < 16; i++) {
    if (!currentId || visited.has(currentId)) {
      return currentId.trim();
    }
    visited.add(currentId);
    const parentClone = clones.find(c => c.newId.trim().toLowerCase() === currentId);
    if (!parentClone) {
      return currentId;
    }
    currentId = parentClone.baseId.trim().toLowerCase();
  }
  return currentId;
}

export function getBuildersOfUnit(unitId, buildOptions, clones = []) {
  const ancestorId = traceAncestor(unitId, clones).toLowerCase();
  if (!ancestorId) return [];
  
  const builders = [];
  for (const [builderId, options] of Object.entries(buildOptions)) {
    if (
      Array.isArray(options) &&
      options.some(opt => typeof opt === 'string' && opt.trim().toLowerCase() === ancestorId)
    ) {
      builders.push(builderId);
    }
  }
  return builders.sort((a, b) => a.localeCompare(b));
}

export function getClonesOfAncestor(ancestorId, clones) {
  const targetAncestor = traceAncestor(ancestorId, clones).toLowerCase();
  if (!targetAncestor) return [];
  
  const results = [];
  const visited = new Set();
  for (const clone of clones) {
    const cloneId = clone.newId.trim();
    if (
      cloneId &&
      traceAncestor(clone.baseId, clones).toLowerCase() === targetAncestor &&
      !visited.has(cloneId.toLowerCase())
    ) {
      visited.add(cloneId.toLowerCase());
      results.push(cloneId);
    }
  }
  return results;
}

function uniqueArray(arr) {
  const set = new Set();
  const result = [];
  for (const item of arr) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!set.has(lower)) {
      set.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

export function findStepIndex(steps, builderId) {
  const trimmed = builderId.trim();
  if (!trimmed) return -1;
  return steps.findIndex(s => s.builderId === trimmed);
}

export function updateBuildMenuSteps(steps, clones, config) {
  let result = [...steps];
  
  // 1. Add cloned units to original builders
  for (const clone of clones) {
    if (clone.addToOriginalBuilders === false) continue;
    const newId = clone.newId.trim().toLowerCase();
    if (!newId) continue;
    
    for (const builderId of clone.builderIds) {
      const trimmedBuilder = builderId.trim();
      if (!trimmedBuilder) continue;
      
      const stepIdx = findStepIndex(result, trimmedBuilder);
      const step = stepIdx !== -1 ? result[stepIdx] : null;
      const add = step ? [...step.add] : [];
      const remove = step ? [...step.remove] : [];
      
      const isRemoved = new Set(remove.map(r => r.trim().toLowerCase())).has(newId);
      const isAlreadyAdded = new Set(add.map(a => a.toLowerCase())).has(newId);
      
      if (!isRemoved && !isAlreadyAdded) {
        result = upsertStep(result, {
          builderId: trimmedBuilder,
          add: [...add, newId],
          remove
        });
      }
    }
  }
  
  // 2. Process disabled units
  const disabledUnitIds = config?.disabledUnitIds;
  const buildOptions = config?.unitBuildOptions;
  if (disabledUnitIds && disabledUnitIds.length > 0 && buildOptions) {
    result = applyDisabledUnitsToSteps(result, disabledUnitIds, buildOptions, clones);
  }
  
  return result;
}

function upsertStep(steps, newStep) {
  const idx = steps.findIndex(s => s.builderId === newStep.builderId);
  if (idx === -1) {
    return [...steps, newStep];
  }
  const next = [...steps];
  next[idx] = newStep;
  return next;
}

function applyDisabledUnitsToSteps(steps, disabledIds, buildOptions, clones) {
  let result = [...steps];
  
  for (const id of uniqueArray(disabledIds)) {
    const list = [id, ...getClonesOfAncestor(id, clones)];
    const lowerSet = new Set(list.map(x => x.trim().toLowerCase()).filter(Boolean));
    const builders = getBuildersOfUnit(id, buildOptions, clones);
    
    for (const builderId of builders) {
      const step = result.find(s => s.builderId === builderId);
      const add = step ? [...step.add] : [];
      const remove = step ? [...step.remove] : [];
      const removeSet = new Set(remove.map(r => r.trim().toLowerCase()));
      const nextRemove = [...remove];
      
      for (const item of list) {
        const itemLower = item.trim().toLowerCase();
        if (itemLower && !removeSet.has(itemLower)) {
          removeSet.add(itemLower);
          nextRemove.push(item.trim());
        }
      }
      
      const nextAdd = add.filter(a => !lowerSet.has(a.trim().toLowerCase()));
      result = upsertStep(result, {
        builderId,
        add: nextAdd,
        remove: nextRemove
      });
    }
  }
  
  return result;
}

export function sortClonesDependency(clones) {
  const items = clones.filter(c => c.newId.trim() && c.baseId.trim());
  const newIds = new Set(items.map(c => c.newId.trim().toLowerCase()));
  const cloneMap = new Map(items.map(c => [c.newId.trim().toLowerCase(), c]));
  const result = [];
  const visited = new Set();
  
  const visit = (c) => {
    const key = c.newId.trim().toLowerCase();
    if (visited.has(key)) return;
    
    const parentKey = c.baseId.trim().toLowerCase();
    if (newIds.has(parentKey)) {
      const parent = cloneMap.get(parentKey);
      if (parent) visit(parent);
    }
    
    visited.add(key);
    result.push(c);
  };
  
  for (const item of items) {
    visit(item);
  }
  return result;
}

export function generateClonesBlockLua(clones, weaponLibrary = []) {
  const sorted = sortClonesDependency(clones);
  if (sorted.length === 0) return '';
  
  const helpers = [
    `  local function clone_copy(value)`,
    `    if type(value) ~= "table" then return value end`,
    `    local copy = {}`,
    `    for key, child in pairs(value) do`,
    `      copy[clone_copy(key)] = clone_copy(child)`,
    `    end`,
    `    return copy`,
    `  end`,
    ``,
    `  local function clone_set_name(u, name, tooltip)`,
    `    if not u.customparams then u.customparams = {} end`,
    `    local c = u.customparams`,
    `    local l = {"en", "de", "fr", "es", "it", "ru", "zh", "cs", "hr", "lt"}`,
    `    for _, lang in ipairs(l) do`,
    `      c["i18n_" .. lang .. "_humanname"] = name`,
    `      c["i18n_" .. lang .. "_tooltip"] = tooltip`,
    `    end`,
    `  end`,
    ``,

    `  local function clone_clean(u)`,
    `    if u.maxthisunit then u.maxthisunit = nil end`,
    `    if u.customparams then`,
    `      u.customparams.raptorbuildmeta = nil`,
    `      u.customparams.unitgroup = nil`,
    `      u.customparams.subfolder = nil`,
    `    end`,
    `  end`,
    ``,
    `  local function clone_swap_weapon(u, slotNum, srcUnit, srcWep, destWep)`,
    `    destWep = destWep or srcWep`,
    `    if UnitDefs[srcUnit] and UnitDefs[srcUnit].weapondefs and UnitDefs[srcUnit].weapondefs[srcWep] then`,
    `      if not u.weapondefs then u.weapondefs = {} end`,
    `      u.weapondefs[destWep] = clone_copy(UnitDefs[srcUnit].weapondefs[srcWep])`,
    `    end`,
    `    if not u.weapons then u.weapons = {} end`,
    `    if not u.weapons[slotNum] then u.weapons[slotNum] = {} end`,
    `    u.weapons[slotNum].def = destWep:upper()`,
    `    if UnitDefs[srcUnit] and UnitDefs[srcUnit].weapons then`,
    `      local srcSlotIdx = nil`,
    `      for idx, w in ipairs(UnitDefs[srcUnit].weapons) do`,
    `        if w.def and w.def:lower() == srcWep then`,
    `          srcSlotIdx = idx`,
    `          break`,
    `        end`,
    `      end`,
    `      if srcSlotIdx and UnitDefs[srcUnit].weapons[srcSlotIdx] then`,
    `        for k, v in pairs(UnitDefs[srcUnit].weapons[srcSlotIdx]) do`,
    `          if k ~= "def" then`,
    `            if type(v) == "table" then`,
    `              u.weapons[slotNum][k] = table.copy(v)`,
    `            else`,
    `              u.weapons[slotNum][k] = v`,
    `            end`,
    `          end`,
    `        end`,
    `      end`,
    `    end`,
    `  end`
  ].join('\n');

  const cloneCodes = sorted.map(clone => generateSingleCloneLua(clone, weaponLibrary)).filter(Boolean);
  return helpers + '\n\n' + cloneCodes.join('\n\n');
}

function generateRemoveTableLua(removeSet) {
  if (removeSet.size === 0) return 'local remove = {}';
  const lines = ['local remove = {'];
  for (const id of [...removeSet].sort((a, b) => a.localeCompare(b))) {
    lines.push(`  ["${escapeLuaString(id)}"] = true,`);
  }
  lines.push('}');
  return lines.join('\n');
}

function generateAddListLua(addArr) {
  if (addArr.length === 0) return 'local addList = {}';
  const lines = ['local addList = {'];
  for (const id of addArr) {
    lines.push(`  "${escapeLuaString(id)}",`);
  }
  lines.push('}');
  return lines.join('\n');
}





export function generateSingleBuilderDeltaLua(step) {
  const builderId = step.builderId.trim();
  if (!builderId) return '';
  
  const targetStr = `UnitDefs[${JSON.stringify(builderId)}]`;

  // If a custom drag-and-drop sorted order exists
  if (step.order && step.order.length > 0) {
    const listLua = step.order.map(id => `    ${JSON.stringify(id)},`).join('\n');
    return [
      `if ${targetStr} and type(${targetStr}.buildoptions) == "table" then`,
      `  ${targetStr}.buildoptions = {`,
      listLua,
      `  }`,
      `end`
    ].join('\n');
  }

  const removeSet = new Set(step.remove.map(r => r.trim().toLowerCase()).filter(Boolean));
  const addArr = step.add.map(a => a.trim()).filter(Boolean);
  
  return [
    `if ${targetStr} and type(${targetStr}.buildoptions) == "table" then`,
    `  local ud = ${targetStr}`,
    `  local bo = ud.buildoptions`,
    `  ${generateRemoveTableLua(removeSet)}`,
    `  ${generateAddListLua(addArr)}`,
    `  local seen = {}`,
    `  local newBo = {}`,
    `  for _, u in ipairs(bo) do`,
    `    if type(u) == "string" then`,
    `      local ul = string.lower(u)`,
    `      if not remove[ul] then`,
    `        table.insert(newBo, u)`,
    `        seen[ul] = true`,
    `      end`,
    `    end`,
    `  end`,
    `  for _, u in ipairs(addList) do`,
    `    if type(u) == "string" then`,
    `      local ul = string.lower(u)`,
    `      if not seen[ul] then`,
    `        table.insert(newBo, u)`,
    `        seen[ul] = true`,
    `      end`,
    `    end`,
    `  end`,
    `  ud.buildoptions = newBo`,
    `end`
  ].join('\n');
}

export function generateBuildMenuBlockLua(steps) {
  const activeSteps = steps.filter(s => s.builderId.trim() && (s.add.some(x => x.trim().length > 0) || s.remove.some(x => x.trim().length > 0)));
  if (activeSteps.length === 0) return '';
  
  const stepCodes = activeSteps.map(generateSingleBuilderDeltaLua).filter(Boolean);
  return stepCodes.join('\n\n');
}

function removeExcludedCloneReferences(steps, clones) {
  const cloneIds = new Set(
    clones
      .map(clone => clone.newId?.trim().toLowerCase())
      .filter(Boolean)
  );
  if (cloneIds.size === 0) return steps;

  return steps
    .map(step => ({
      ...step,
      add: (step.add || []).filter(id => !cloneIds.has(id.trim().toLowerCase())),
      remove: (step.remove || []).filter(id => !cloneIds.has(id.trim().toLowerCase())),
      order: (step.order || []).filter(id => !cloneIds.has(id.trim().toLowerCase())),
    }))
    .filter(step => step.add.length > 0 || step.remove.length > 0 || step.order.length > 0);
}

export function stripBlock(luaScript, beginMarker, endMarker) {
  const trimScript = luaScript.replace(/\s+$/, '');
  const startIdx = trimScript.indexOf(beginMarker);
  const endIdx = trimScript.indexOf(endMarker);
  
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return trimScript;
  }
  
  const before = trimScript.slice(0, startIdx).replace(/\s+$/, '');
  const after = trimScript.slice(endIdx + endMarker.length).replace(/^\s*/, '');
  return [before, after].filter(s => s.length > 0).join('\n\n');
}

export function extractBlock(luaScript, beginMarker, endMarker) {
  const trimScript = luaScript.replace(/\s+$/, '');
  const startIdx = trimScript.indexOf(beginMarker);
  const endIdx = trimScript.indexOf(endMarker);
  
  if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) {
    return null;
  }
  return trimScript.slice(startIdx, endIdx + endMarker.length);
}

export function generateCarrierLinkagesBlockLua(tweaks = {}) {
  const entries = [];
  Object.entries(tweaks).forEach(([unitId, unitTweaks]) => {
    if (!unitTweaks) return;
    const targetChild = unitTweaks['customparams.spawns_name']
      ?? unitTweaks['customparams.spawns']
      ?? unitTweaks['customparams.carried_unit']
      ?? unitTweaks['customparams.spawn_name']
      ?? unitTweaks['customparams.spawn_unit'];

    if (!targetChild) return;

    const childUnits = String(targetChild)
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);

    if (childUnits.length === 0) return;

    const primaryChild = childUnits[0];
    const isGround = unitTweaks['customparams.carried_unit'] === '';

    entries.push({
      unitId: unitId.toLowerCase(),
      primaryChild,
      allChildren: childUnits,
      isGround,
      droneAmmo: String(unitTweaks['customparams.droneammo'] || unitTweaks['customparams.spawn_count'] || '4'),
      spawnMetal: String(unitTweaks['customparams.spawn_metal_cost'] || '100'),
      spawnEnergy: String(unitTweaks['customparams.spawn_energy_cost'] || '1000'),
      spawnInterval: String(unitTweaks['customparams.spawn_interval'] || unitTweaks['customparams.spawn_rate'] || '5'),
      returnHp: String(unitTweaks['customparams.drone_return_hp'] || '25'),
    });
  });

  if (entries.length === 0) return '';

  return `${CARRIER_LINKAGE_BEGIN}
local editp_carrier_linkages = ${serializeLuaTable({ entries })}

for _, entry in ipairs(editp_carrier_linkages.entries) do
  local u = UnitDefs and UnitDefs[entry.unitId]
  if u then
    u.customparams = u.customparams or {}
    u.customparams.carried_unit = entry.primaryChild
    local commaChildren = table.concat(entry.allChildren, ",")
    u.customparams.spawns_name = commaChildren
    u.customparams.spawn_name = commaChildren
    u.customparams.spawn_unit = commaChildren
    u.customparams.spawns = commaChildren
    u.customparams.spawn = commaChildren
    u.customparams.spawntype = entry.isGround and "ground" or "air"
    u.customparams.spawns_units = commaChildren
    u.customparams.spawns_types = entry.isGround and "ground" or "air"
    local countStr = tostring(entry.droneAmmo)
    local intervalStr = tostring(entry.spawnInterval)
    local metalStr = tostring(entry.spawnMetal)
    local energyStr = tostring(entry.spawnEnergy)

    u.customparams.droneammo = countStr
    u.customparams.spawn_count = countStr
    u.customparams.maxunits = countStr
    u.customparams.maxdrones = countStr
    u.customparams.max_units = countStr
    u.customparams.max_drones = countStr
    u.customparams.spawns_count = countStr
    u.customparams.spawns_max = countStr
    u.customparams.stockpilelimit = countStr
    u.customparams.stockpilemax = countStr
    u.customparams.maxstockpile = countStr
    u.customparams.stockpile_max = countStr
    u.customparams.stockpile_limit = countStr
    u.customparams.spawn_metal_cost = metalStr
    u.customparams.stockpilemetal = metalStr
    u.customparams.metalcost = metalStr
    u.customparams.spawn_energy_cost = energyStr
    u.customparams.stockpileenergy = energyStr
    u.customparams.energycost = energyStr
    u.customparams.spawn_interval = intervalStr
    u.customparams.spawn_rate = intervalStr
    u.customparams.spawnrate = intervalStr
    u.customparams.stockpiletime = intervalStr
    u.customparams.controlradius = (entry.isControllable == false) and "1200" or "5000"
    u.customparams.engagementrange = (entry.isControllable == false) and "1300" or "5000"
    u.customparams.carrierdeaththroe = (entry.isControllable == false) and "destroy" or "release"
    u.customparams.dronesusestockpile = "true"
    u.customparams.enabledocking = "true"
    u.customparams.is_controllable = (entry.isControllable == false) and "0" or "1"
    u.customparams.drone_controllable = (entry.isControllable == false) and "0" or "1"

    u.buildoptions = entry.allChildren

    if type(u.weapondefs) == "table" then
      for _, wDef in pairs(u.weapondefs) do
        if type(wDef) == "table" then
          wDef.customparams = wDef.customparams or {}
          if wDef.customparams.carried_unit or wDef.customparams.spawns_name or wDef.customparams.maxunits or wDef.customparams.droneammo or wDef.customparams.stockpilemax or wDef.customparams.stockpilelimit then
            wDef.customparams.carried_unit = entry.primaryChild
            wDef.customparams.spawns_name = commaChildren
            wDef.customparams.spawn_name = commaChildren
            wDef.customparams.spawn_unit = commaChildren
            wDef.customparams.spawns = commaChildren
            wDef.customparams.spawn = commaChildren
            wDef.customparams.maxunits = countStr
            wDef.customparams.maxdrones = countStr
            wDef.customparams.max_units = countStr
            wDef.customparams.max_drones = countStr
            wDef.customparams.droneammo = countStr
            wDef.customparams.spawn_count = countStr
            wDef.customparams.spawns_max = countStr
            wDef.customparams.stockpilelimit = countStr
            wDef.customparams.stockpilemax = countStr
            wDef.customparams.maxstockpile = countStr
            wDef.customparams.stockpile_max = countStr
            wDef.customparams.stockpile_limit = countStr
            wDef.customparams.stockpilemetal = metalStr
            wDef.customparams.metalcost = metalStr
            wDef.customparams.stockpileenergy = energyStr
            wDef.customparams.energycost = energyStr
            wDef.customparams.stockpiletime = intervalStr
            wDef.customparams.controlradius = (entry.isControllable == false) and "1200" or "5000"
            wDef.customparams.engagementrange = (entry.isControllable == false) and "1300" or "5000"
            wDef.customparams.carrierdeaththroe = (entry.isControllable == false) and "destroy" or "release"
            wDef.customparams.dronesusestockpile = "true"
            wDef.customparams.enabledocking = "true"
          end
        end
      end
    end
  end
end
${CARRIER_LINKAGE_END}`;
}

export function compileTweakDefsLua({ 
  currentTweakDefsLua, 
  customUnitClones, 
  buildMenuWizardSteps, 
  disabledUnitIds, 
  unitBuildOptions,
  projectMeta,
  compileFlags,
  weaponLibrary = [],
  deathExplosionTweaks = [],
  supportingWeaponDefs = [],
  tweaks = {},
}) {
  // Strip out any existing comments or headers that start with "-- Mod Name:" to avoid piling up duplicate headers
  const strippedText = currentTweakDefsLua
    .replace(/^-- Mod Name:.*[\r\n]*/gm, '')
    .replace(/^-- Author:.*[\r\n]*/gm, '')
    .replace(/^-- Description:.*[\r\n]*/gm, '')
    .replace(/^-- Generated with BAR Tweaksmith.*[\r\n]*/gm, '')
    .replace(/^-- Generated with BAR Editor.*[\r\n]*/gm, '')
    .replace(/^-- ----------------------------------------------------[\r\n]*/gm, '')
    .trim();

  const cleanBody = stripBlock(stripBlock(
    stripBlock(stripBlock(
      stripBlock(
        strippedText,
        LEGACY_BUILDMENU_BEGIN,
        LEGACY_BUILDMENU_END,
      ), BUILDMENU_BEGIN, BUILDMENU_END),
      DEATH_PROFILE_BEGIN,
      DEATH_PROFILE_END,
    ), SUPPORTING_WEAPONDEFS_BEGIN, SUPPORTING_WEAPONDEFS_END),
    CARRIER_LINKAGE_BEGIN, CARRIER_LINKAGE_END
  ).trim();
  
  const includeCloneDefinitions = compileFlags?.includeClones ?? true;
  const clonesBlock = includeCloneDefinitions
    ? generateClonesBlockLua(customUnitClones, weaponLibrary)
    : '';
  
  const menuConfig = { disabledUnitIds, unitBuildOptions };
  const safeBuildMenuSteps = includeCloneDefinitions
    ? buildMenuWizardSteps
    : removeExcludedCloneReferences(buildMenuWizardSteps, customUnitClones);
  const updatedSteps = updateBuildMenuSteps(
    safeBuildMenuSteps,
    includeCloneDefinitions ? customUnitClones : [],
    menuConfig
  );
  const buildMenuBlock = (compileFlags?.includeRosters ?? true)
    ? generateBuildMenuBlockLua(updatedSteps)
    : '';
  const deathProfileBlock = generateDeathProfilesBlockLua(deathExplosionTweaks);
  const supportingWeaponDefsBlock = generateSupportingWeaponDefsBlockLua(supportingWeaponDefs);
  const carrierLinkagesBlock = generateCarrierLinkagesBlockLua(tweaks);
  
  const parts = [];
  if (cleanBody.length > 0) parts.push(cleanBody);
  if (clonesBlock.length > 0) {
    parts.push(`do\n${clonesBlock}\nend`);
  }
  if (carrierLinkagesBlock.length > 0) parts.push(carrierLinkagesBlock);
  if (supportingWeaponDefsBlock.length > 0) parts.push(supportingWeaponDefsBlock);
  if (buildMenuBlock.length > 0) {
    parts.push(`${BUILDMENU_BEGIN}\n${buildMenuBlock}\n${BUILDMENU_END}`);
  }
  if (deathProfileBlock.length > 0) parts.push(deathProfileBlock);
  const headerLines = [];
  if (projectMeta) {
    headerLines.push(
      `-- Mod Name: ${projectMeta.name || 'BAR Editor Mod'}`,
      `-- Author: ${projectMeta.author || 'BAR Editor'}`,
      `-- Description: ${projectMeta.desc || ''}`,
      `-- Generated with BAR Editor on ${new Date().toISOString().slice(0, 10)}`,
      `-- ----------------------------------------------------`
    );
  }
  const headerStr = headerLines.length > 0 ? headerLines.join('\n') + '\n\n' : '';

  return headerStr + parts.join('\n\n');
}
