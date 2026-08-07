import { serializeLuaTable } from './tweakSerializer.js';
import { getWeaponParameterDefinition } from '../config/weaponParameters.js';
import { getWeaponBlueprintDefinitionKey } from './weaponBlueprint.js';

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
export const CLONES_BEGIN = '-- EDITP_CLONES_BEGIN';
export const CLONES_END = '-- EDITP_CLONES_END';


export const UNIT_TWEAKS_BEGIN = '-- EDITP_UNIT_TWEAKS_BEGIN';
export const UNIT_TWEAKS_END = '-- EDITP_UNIT_TWEAKS_END';

function escapeLuaString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function cleanHeaderValue(value, fallback = '') {
  const normalized = String(value ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return normalized || fallback;
}

function compareCanonicalText(left, right) {
  const leftText = String(left ?? '');
  const rightText = String(right ?? '');
  return leftText < rightText ? -1 : leftText > rightText ? 1 : 0;
}

// Legacy inspection helper. Project weapon/unit patches are canonically emitted
// by useCompiledProjectOutputs as tweakunits and must never be added to
// Definitions Lua as well.
export function generateUnitTweaksBlockLua(tweaks = {}, options = {}) {
  if (!tweaks || typeof tweaks !== 'object') return '';
  const compact = Boolean(options?.compactLuaFormatting);

  const entries = Object.entries(tweaks)
    .filter(([unitId, unitTweaks]) => {
      return unitId && unitTweaks && typeof unitTweaks === 'object' && Object.keys(unitTweaks).length > 0;
    })
    .sort(([leftId], [rightId]) => compareCanonicalText(
      String(leftId).trim().toLowerCase(),
      String(rightId).trim().toLowerCase(),
    ));
  if (entries.length === 0) return '';

  const luaLines = [];
  entries.forEach(([unitId, unitTweaks]) => {
    const cleanUnitId = unitId.trim().toLowerCase();
    const weaponTweaksBySlot = new Map();
    const sets = [];

    Object.entries(unitTweaks)
      .sort(([leftKey], [rightKey]) => compareCanonicalText(leftKey, rightKey))
      .forEach(([key, val]) => {
        if (val === undefined || val === null) return;
        if (key.startsWith('weapon_slot_')) {
          const match = key.match(/^weapon_slot_(\d+)_(.+)$/);
          if (match) {
            const slotNum = match[1];
            const rawParam = match[2];
            let param = rawParam;
            if (rawParam === 'velocity') param = 'weaponvelocity';
            else if (rawParam === 'reload') param = 'reloadtime';
            else if (rawParam === 'aoe') param = 'areaofeffect';
            
            const valExpr = typeof val === 'boolean'
              ? (val ? 'true' : 'false')
              : (typeof val === 'number' ? val : (compact && !isNaN(val) && String(val).trim() !== '' ? val : JSON.stringify(val)));

            if (compact) {
              if (!weaponTweaksBySlot.has(slotNum)) weaponTweaksBySlot.set(slotNum, []);
              weaponTweaksBySlot.get(slotNum).push({ param, valExpr });
            } else {
              sets.push(`    if u.weapons and u.weapons[${slotNum}] and u.weapons[${slotNum}].def then
      local wKey = string.lower(u.weapons[${slotNum}].def)
      if u.weapondefs and u.weapondefs[wKey] then
        u.weapondefs[wKey].${param} = ${valExpr}
      end
    end`);
            }
          }
        }
      });

    if (compact) {
      weaponTweaksBySlot.forEach((params, slotNum) => {
        const paramAssignments = params.map(p => `        w.${p.param} = ${p.valExpr}`).join('\n');
        sets.push(`    if u.weapons and u.weapons[${slotNum}] and u.weapons[${slotNum}].def then
      local w = u.weapondefs and u.weapondefs[string.lower(u.weapons[${slotNum}].def)]
      if w then
${paramAssignments}
      end
    end`);
      });
    }

    if (sets.length > 0) {
      luaLines.push(`  local u = UnitDefs and UnitDefs[${JSON.stringify(cleanUnitId)}]
  if u then
${sets.join('\n')}
  end`);
    }
  });

  if (luaLines.length === 0) return '';

  return `${UNIT_TWEAKS_BEGIN}
do
${luaLines.join('\n')}
end
${UNIT_TWEAKS_END}`;
}

export function generateDeathProfilesBlockLua(profiles = []) {
  if (!profiles.length) return '';
  const calls = [];
  const sourceProfiles = {};
  const orderedProfiles = [...profiles].sort((left, right) => compareCanonicalText(
    String(left?.unitId || '').trim().toLowerCase(),
    String(right?.unitId || '').trim().toLowerCase(),
  ));
  for (const profile of orderedProfiles) {
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
          .sort((left, right) => left - right)
        : [],
    }))
    .filter(entry => entry.owner && entry.key && entry.definition && typeof entry.definition === 'object')
    .sort((left, right) => compareCanonicalText(left.owner, right.owner) || compareCanonicalText(left.key, right.key));
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

function normalizeBlueprintOverrideValue(parameter, value) {
  if (value === undefined || value === null || value === '') return undefined;
  if (parameter.valueType === 'boolean') {
    if (value === true || value === 'true' || value === 1 || value === '1') return true;
    if (value === false || value === 'false' || value === 0 || value === '0') return false;
    return undefined;
  }
  if (parameter.valueType === 'number') {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : undefined;
  }
  return String(value);
}

function generateNestedAssignment(target, path, value) {
  const pathParts = String(path || '').split('.').filter(Boolean);
  if (!pathParts.length) return [];
  const lines = [];
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const parent = [target, ...pathParts.slice(0, index + 1)].join('.');
    lines.push(`      ${parent} = ${parent} or {}`);
  }
  const serializedValue = typeof value === 'string'
    ? JSON.stringify(value)
    : value === true
      ? 'true'
      : value === false
        ? 'false'
        : String(value);
  lines.push(`      ${[target, ...pathParts].join('.')} = ${serializedValue}`);
  return lines;
}

export function generateWeaponBlueprintOverridesLua(blueprint, weaponDefKey, slotNum) {
  const overrides = blueprint?.overrides || {};
  const weaponLines = [];
  const mountLines = [];
  const unitMirrorLines = [];
  Object.entries(overrides)
    .map(([rawKey, value]) => [rawKey === 'cegtag' ? 'cegTag' : rawKey, value])
    .sort(([leftKey], [rightKey]) => compareCanonicalText(leftKey, rightKey))
    .forEach(([key, rawValue]) => {
      const parameter = getWeaponParameterDefinition(key);
      if (!parameter || parameter.deprecated) return;
      const value = normalizeBlueprintOverrideValue(parameter, rawValue);
      if (value === undefined) return;
      const target = parameter.compileTarget === 'mount' ? 'm' : 'w';
      const assignments = generateNestedAssignment(target, parameter.path, value);
      if (target === 'm') mountLines.push(...assignments);
      else weaponLines.push(...assignments);
      if (parameter.unitMirrorPath) {
        unitMirrorLines.push(...generateNestedAssignment('u', parameter.unitMirrorPath, value));
      }
    });

  if (weaponLines.length === 0 && mountLines.length === 0 && unitMirrorLines.length === 0) return [];
  const lines = [];
  if (weaponLines.length > 0) {
    lines.push(
      `    if u.weapondefs and u.weapondefs[${JSON.stringify(weaponDefKey)}] then`,
      `      local w = u.weapondefs[${JSON.stringify(weaponDefKey)}]`,
      ...weaponLines,
      `    end`,
    );
  }
  if (mountLines.length > 0) {
    lines.push(
      `    if u.weapons and u.weapons[${Number(slotNum)}] then`,
      `      local m = u.weapons[${Number(slotNum)}]`,
      ...mountLines,
      `    end`,
    );
  }
  lines.push(...unitMirrorLines);
  return [
    ...lines,
  ];
}

export function generateSingleCloneLua(clone, weaponLibrary = []) {
  const baseId = clone.baseId.trim().toLowerCase();
  const newId = clone.newId.trim().toLowerCase();
  if (!baseId || !newId) return '';

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
    `    clone_preserve_visuals(u, UnitDefs[s])`,
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
    Object.entries(clone.weaponSwaps)
      .sort(([leftSlot], [rightSlot]) => Number(leftSlot) - Number(rightSlot) || compareCanonicalText(leftSlot, rightSlot))
      .forEach(([slotNum, swap]) => {
      const srcUnit = swap.sourceUnitId.trim().toLowerCase();
      const srcWep = swap.sourceWeaponDefKey.trim().toLowerCase();
      if (srcUnit && srcWep) {
        const blueprint = swap.libraryWeaponId
          ? weaponLibrary.find(item => item.id === swap.libraryWeaponId)
          : null;
        const targetWep = blueprint ? getWeaponBlueprintDefinitionKey(blueprint) : srcWep;
        lines.push(`    clone_swap_weapon(u, ${slotNum}, ${JSON.stringify(srcUnit)}, ${JSON.stringify(srcWep)}, ${JSON.stringify(targetWep)})`);
        if (blueprint) {
          lines.push(...generateWeaponBlueprintOverridesLua(blueprint, targetWep, slotNum));
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
  return builders.sort(compareCanonicalText);
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
  const items = clones
    .filter(c => c.newId.trim() && c.baseId.trim())
    .sort((left, right) => compareCanonicalText(
      left.newId.trim().toLowerCase(),
      right.newId.trim().toLowerCase(),
    ));
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

export function generateClonesBlockLua(clones, weaponLibrary = [], options = {}) {
  const sorted = sortClonesDependency(clones);
  if (sorted.length === 0) return '';
  
  const exportEnglishOnly = Boolean(options?.exportEnglishOnly);
  const langArray = exportEnglishOnly
    ? '{"en"}'
    : '{"en", "de", "fr", "es", "it", "ru", "zh", "cs", "hr", "lt"}';

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
    `    local l = ${langArray}`,
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
    `      u.customparams.subfolder = nil`,
    `    end`,
    `  end`,
    ``,
    `  local function clone_preserve_visuals(u, source)`,
    `    local fields = {`,
    `      "objectname", "script", "buildpic", "icontype",`,
    `      "sfxtypes", "sounds", "featuredefs", "corpse",`,
    `      "explodeas", "selfdestructas", "weapondefs", "weapons"`,
    `    }`,
    `    for _, field in ipairs(fields) do`,
    `      if source[field] ~= nil then`,
    `        u[field] = clone_copy(source[field])`,
    `      end`,
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
    `              u.weapons[slotNum][k] = clone_copy(v)`,
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
  for (const id of [...removeSet].sort(compareCanonicalText)) {
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

export function generateBuildMenuBlockLua(steps, options = {}) {
  const compact = Boolean(options?.compactLuaFormatting);
  const activeSteps = steps
    .filter(s => s.builderId.trim() && (s.add.some(x => x.trim().length > 0) || s.remove.some(x => x.trim().length > 0) || (s.order && s.order.length > 0)))
    .sort((left, right) => compareCanonicalText(
      left.builderId.trim().toLowerCase(),
      right.builderId.trim().toLowerCase(),
    ));
  if (activeSteps.length === 0) return '';

  if (compact) {
    const helperFunc = `local function editp_modify_bo(builderId, addList, removeList, orderedList)
  local ud = UnitDefs and UnitDefs[builderId]
  if ud and type(ud.buildoptions) == "table" then
    if orderedList then
      ud.buildoptions = orderedList
      return
    end
    local removeMap = {}
    if removeList then for _, r in ipairs(removeList) do removeMap[r] = true end end
    local seen = {}
    local newBo = {}
    for _, u in ipairs(ud.buildoptions) do
      if type(u) == "string" then
        local ul = string.lower(u)
        if not removeMap[ul] then table.insert(newBo, u) seen[ul] = true end
      end
    end
    if addList then
      for _, u in ipairs(addList) do
        if type(u) == "string" then
          local ul = string.lower(u)
          if not seen[ul] then table.insert(newBo, u) seen[ul] = true end
        end
      end
    end
    ud.buildoptions = newBo
  end
end`;
    const calls = activeSteps.map(step => {
      const builderId = step.builderId.trim().toLowerCase();
      const addList = step.add.map(a => a.trim().toLowerCase()).filter(Boolean);
      const removeList = step.remove.map(r => r.trim().toLowerCase()).filter(Boolean);
      const orderList = (step.order || []).map(id => id.trim().toLowerCase()).filter(Boolean);
      const addStr = addList.length > 0 ? `{${addList.map(x => JSON.stringify(x)).join(', ')}}` : 'nil';
      const remStr = removeList.length > 0 ? `{${removeList.map(x => JSON.stringify(x)).join(', ')}}` : 'nil';
      const orderStr = orderList.length > 0 ? `{${orderList.map(x => JSON.stringify(x)).join(', ')}}` : 'nil';
      return `editp_modify_bo(${JSON.stringify(builderId)}, ${addStr}, ${remStr}, ${orderStr})`;
    });
    return `${helperFunc}\n${calls.join('\n')}`;
  }

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

export function generateCarrierLinkagesBlockLua(tweaksOrEntries = {}) {
  let entries = [];
  if (Array.isArray(tweaksOrEntries)) {
    entries = [...tweaksOrEntries].sort((left, right) => compareCanonicalText(
      String(left?.unitId || '').trim().toLowerCase(),
      String(right?.unitId || '').trim().toLowerCase(),
    ));
  } else if (tweaksOrEntries && typeof tweaksOrEntries === 'object') {
    entries = Object.entries(tweaksOrEntries)
      .sort(([leftId], [rightId]) => compareCanonicalText(
        String(leftId).trim().toLowerCase(),
        String(rightId).trim().toLowerCase(),
      ))
      .map(([unitId, unitTweaks]) => {
        if (!unitTweaks || typeof unitTweaks !== 'object') return null;
        // Canonical carrier edits live in weapon_slot_<n>_* and are compiled
        // by tweakunits. Only recognize the explicit legacy UnitDef-level
        // workbench shape here so the same linkage is never emitted twice.
        const primaryChild = unitTweaks['customparams.carried_unit'] || '';
        if (!primaryChild) return null;

        const spawnsNameVal = unitTweaks.editp_carrier_roster
          || unitTweaks['customparams.spawns_name']
          || primaryChild;

        const allChildren = String(spawnsNameVal)
          .split(/[\s,]+/)
          .map(s => s.trim().toLowerCase())
          .filter(Boolean);
        const payloadCount = Math.max(1, allChildren.length);
        const alignNumericValues = (rawValue, fallback, minimum = 0) => {
          const parsed = String(rawValue ?? '')
            .trim()
            .split(/\s+/)
            .map(value => Number(value))
            .filter(Number.isFinite)
            .map(value => Math.max(minimum, Math.round(value)));
          return Array.from({ length: payloadCount }, (_, index) => (
            parsed[index] ?? parsed[parsed.length - 1] ?? fallback
          ));
        };

        const deathBehavior = String(unitTweaks['customparams.carrierdeaththroe'] || 'death').toLowerCase();
        const rawDroneAmmo = unitTweaks['customparams.droneammo'];
        const maxUnitsList = alignNumericValues(unitTweaks['customparams.maxunits'], 1, 1);
        const maxUnitsStr = maxUnitsList.join(' ');
        const droneAmmoStr = alignNumericValues(rawDroneAmmo, 0, 0).join(' ');

        const startingCountStr = alignNumericValues(
          unitTweaks['customparams.startingdronecount'],
          0,
          0,
        ).map((value, index) => Math.min(value, maxUnitsList[index])).join(' ');

        const manualDroneValue = unitTweaks['customparams.manualdrones'];
        const manualDrones = manualDroneValue !== undefined
          && !['false', '0', 'off', 'no'].includes(String(manualDroneValue).trim().toLowerCase());
        const requestedDroneAirTime = Number(unitTweaks['customparams.droneairtime']);
        const droneAirTime = Number.isFinite(requestedDroneAirTime) && requestedDroneAirTime > 0
          ? requestedDroneAirTime
          : (deathBehavior === 'death' ? null : 31536000);
        const spawnMetal = Number(unitTweaks['customparams.spawn_metal_cost'] || unitTweaks['customparams.metalcost'] || 100);
        const spawnEnergy = Number(unitTweaks['customparams.spawn_energy_cost'] || unitTweaks['customparams.energycost'] || 1000);
        const spawnInterval = Number(unitTweaks['customparams.spawn_interval'] || unitTweaks['customparams.spawnrate'] || 5);
        const dockToHealThreshold = Number(unitTweaks['customparams.docktohealthreshold'] ?? 30);
        const dockingValue = unitTweaks['customparams.enabledocking'];
        const dockingEnabled = dockingValue === undefined
          ? true
          : !['false', '0'].includes(String(dockingValue).toLowerCase());

        return {
          unitId,
          primaryChild,
          allChildren,
          targetWeaponDef: String(unitTweaks.editp_carrier_weapondef || '').trim().toLowerCase(),
          spawnsSurface: String(unitTweaks['customparams.spawns_surface'] || '').trim().toUpperCase(),
          deathBehavior: ['death', 'control', 'capture', 'release', 'parasite'].includes(deathBehavior)
            ? deathBehavior
            : 'death',
          dockingEnabled,
          droneAmmo: droneAmmoStr,
          droneAmmoStr,
          maxUnits: maxUnitsStr,
          maxUnitsStr,
          startingDroneCount: startingCountStr,
          startingCountStr,
          manualDrones,
          droneAirTime,
          spawnMetal: Number.isFinite(spawnMetal) ? spawnMetal : 100,
          spawnEnergy: Number.isFinite(spawnEnergy) ? spawnEnergy : 1000,
          spawnInterval: Number.isFinite(spawnInterval) ? spawnInterval : 5,
          dockToHealThreshold: Number.isFinite(dockToHealThreshold)
            ? Math.max(0, Math.min(100, dockToHealThreshold))
            : 30,
        };
      })
      .filter(Boolean);
  }

  if (entries.length === 0) return '';

  return `${CARRIER_LINKAGE_BEGIN}
local editp_carrier_linkages = ${serializeLuaTable({ entries })}

local function editp_find_carrier_weapondef(unitDef, requestedKey)
  if type(unitDef.weapondefs) ~= "table" then return nil end
  if requestedKey and requestedKey ~= "" then
    local requested = unitDef.weapondefs[string.lower(requestedKey)]
    if type(requested) == "table" then return requested end
  end
  for _, candidate in pairs(unitDef.weapondefs) do
    if type(candidate) == "table"
      and type(candidate.customparams) == "table"
      and candidate.customparams.carried_unit then
      return candidate
    end
  end
  local firstMount = type(unitDef.weapons) == "table" and unitDef.weapons[1] or nil
  local firstKey = firstMount and firstMount.def and string.lower(firstMount.def) or nil
  return firstKey and unitDef.weapondefs[firstKey] or nil
end

for _, entry in ipairs(editp_carrier_linkages.entries) do
  local u = UnitDefs and UnitDefs[entry.unitId]
  if u then
    local maxUnitsStr = tostring(entry.maxUnits)
    local startingCountStr = tostring(entry.startingDroneCount)
    local intervalStr = tostring(entry.spawnInterval)
    local metalStr = tostring(entry.spawnMetal)
    local energyStr = tostring(entry.spawnEnergy)
    local wDef = editp_find_carrier_weapondef(u, entry.targetWeaponDef)
    if wDef then
      wDef.customparams = wDef.customparams or {}
      wDef.customparams.carried_unit = table.concat(entry.allChildren, " ")
      wDef.customparams.maxunits = maxUnitsStr
      wDef.customparams.droneammo = tostring(entry.droneAmmoStr or entry.maxUnitsStr)
      wDef.customparams.startingdronecount = startingCountStr
      wDef.customparams.spawnrate = intervalStr
      wDef.customparams.metalcost = metalStr
      wDef.customparams.energycost = energyStr
      wDef.customparams.carrierdeaththroe = entry.deathBehavior
      wDef.customparams.manualdrones = entry.manualDrones and "1" or nil
      wDef.customparams.droneairtime = entry.droneAirTime and tostring(entry.droneAirTime) or nil
      wDef.customparams.enabledocking = entry.dockingEnabled and "1" or "0"
      wDef.customparams.docktohealthreshold = entry.dockToHealThreshold
      if entry.spawnsSurface and entry.spawnsSurface ~= "" then
        wDef.customparams.spawns_surface = entry.spawnsSurface
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
  const normalizedCurrentLua = String(currentTweakDefsLua || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  // Remove both legacy and current generated headers before rebuilding them.
  const strippedText = normalizedCurrentLua
    .replace(/^--[^\n]*\n(?=-- Author:)/, '')
    .replace(/^-- Mod Name:.*[\r\n]*/gm, '')
    .replace(/^-- Author:.*[\r\n]*/gm, '')
    .replace(/^-- Description:.*[\r\n]*/gm, '')
    .replace(/^-- Generated with BAR Tweaksmith.*[\r\n]*/gm, '')
    .replace(/^-- Generated with BAR Editor.*[\r\n]*/gm, '')
    .replace(/^-- ----------------------------------------------------[\r\n]*/gm, '')
    .trim();

  const cleanBody = stripBlock(stripBlock(stripBlock(stripBlock(
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
  ), UNIT_TWEAKS_BEGIN, UNIT_TWEAKS_END), CLONES_BEGIN, CLONES_END).trim();
  
  const includeCloneDefinitions = compileFlags?.includeClones ?? true;
  const orderedClones = sortClonesDependency(customUnitClones || []);
  const clonesBlock = includeCloneDefinitions
    ? generateClonesBlockLua(orderedClones, weaponLibrary, { exportEnglishOnly: compileFlags?.exportEnglishOnly })
    : '';
  
  const menuConfig = { disabledUnitIds, unitBuildOptions };
  const safeBuildMenuSteps = includeCloneDefinitions
    ? buildMenuWizardSteps
    : removeExcludedCloneReferences(buildMenuWizardSteps, orderedClones);
  const updatedSteps = updateBuildMenuSteps(
    safeBuildMenuSteps,
    includeCloneDefinitions ? orderedClones : [],
    menuConfig
  );
  const buildMenuBlock = (compileFlags?.includeRosters ?? true)
    ? generateBuildMenuBlockLua(updatedSteps, { compactLuaFormatting: compileFlags?.compactLuaFormatting })
    : '';
  const deathProfileBlock = generateDeathProfilesBlockLua(deathExplosionTweaks);
  const supportingWeaponDefsBlock = generateSupportingWeaponDefsBlockLua(supportingWeaponDefs);
  const carrierLinkagesBlock = generateCarrierLinkagesBlockLua(tweaks);
  
  const parts = [];
  if (cleanBody.length > 0) parts.push(cleanBody);
  if (clonesBlock.length > 0) {
    parts.push(`${CLONES_BEGIN}\ndo\n${clonesBlock}\nend\n${CLONES_END}`);
  }
  if (carrierLinkagesBlock.length > 0) parts.push(carrierLinkagesBlock);
  if (supportingWeaponDefsBlock.length > 0) parts.push(supportingWeaponDefsBlock);
  if (buildMenuBlock.length > 0) {
    parts.push(`${BUILDMENU_BEGIN}\n${buildMenuBlock}\n${BUILDMENU_END}`);
  }
  if (deathProfileBlock.length > 0) parts.push(deathProfileBlock);
  const headerLines = [];
  if (projectMeta) {
    const projectTitle = cleanHeaderValue(projectMeta.name, 'BAR Editor Mod');
    headerLines.push(
      `--${projectTitle}`,
      `-- Author: ${cleanHeaderValue(projectMeta.author, 'BAR Editor')}`,
      `-- Description: ${cleanHeaderValue(projectMeta.desc)}`,
      `-- Generated with BAR Editor`,
      `-- ----------------------------------------------------`
    );
  }
  const headerStr = headerLines.length > 0 ? headerLines.join('\n') + '\n\n' : '';

  return (headerStr + parts.join('\n\n')).replace(/\r\n?/g, '\n').trimEnd();
}
