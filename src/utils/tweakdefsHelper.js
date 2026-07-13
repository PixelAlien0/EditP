// Markers
export const CLONE_BEGIN = '-- BMF_CLONE_UNITS_BEGIN';
export const CLONE_END = '-- BMF_CLONE_UNITS_END';
export const BUILDMENU_BEGIN = '-- BMF_BUILDMENU_BEGIN';
export const BUILDMENU_END = '-- BMF_BUILDMENU_END';
export const ENV_BEGIN = '-- BMF_ENVIRONMENT_BEGIN';
export const ENV_END = '-- BMF_ENVIRONMENT_END';


function escapeLuaString(str) {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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

  // Scavenger (scav_*) units don't exist in UnitDefs at tweakdefs time — they
  // are generated at runtime by their respective gadgets. Strip the prefix to
  // get the real base unit as clone source.
  // Raptor (raptor_*) units DO exist in UnitDefs at tweakdefs time (modular
  // bot defs are loaded into UnitDefs).  The clone helper will additionally
  // strip raptor-specific properties (maxthisunit, customparams) that would
  // otherwise prevent the clone from appearing in player build menus.
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
    `    UnitDefs[n] = table.copy(UnitDefs[s])`,
    `    local u = UnitDefs[n]`,
    `    bmf_cleanClone(u)`,
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
    lines.push(`    bmf_i18n(u, ${JSON.stringify(displayName)}, ${JSON.stringify(customTooltip)})`);
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
        const targetWep = blueprint ? `bmf_${blueprint.id.replace(/[^a-z0-9_]/gi, '_').toLowerCase()}` : srcWep;
        lines.push(`    bmf_swap(u, ${slotNum}, ${JSON.stringify(srcUnit)}, ${JSON.stringify(srcWep)}, ${JSON.stringify(targetWep)})`);
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
  let currentId = unitId.trim();
  const visited = new Set();
  for (let i = 0; i < 16; i++) {
    if (!currentId || visited.has(currentId)) {
      return currentId.trim();
    }
    visited.add(currentId);
    const parentClone = clones.find(c => c.newId === currentId);
    if (!parentClone) {
      return currentId;
    }
    currentId = parentClone.baseId.trim();
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
    `  local function bmf_i18n(u, name, tooltip)`,
    `    if not u.customparams then u.customparams = {} end`,
    `    local c = u.customparams`,
    `    local l = {"en", "de", "fr", "es", "it", "ru", "zh", "cs", "hr", "lt"}`,
    `    for _, lang in ipairs(l) do`,
    `      c["i18n_" .. lang .. "_humanname"] = name`,
    `      c["i18n_" .. lang .. "_tooltip"] = tooltip`,
    `    end`,
    `  end`,
    ``,

    `  local function bmf_cleanClone(u)`,
    `    if u.maxthisunit then u.maxthisunit = nil end`,
    `    if u.customparams then`,
    `      u.customparams.raptorbuildmeta = nil`,
    `      u.customparams.unitgroup = nil`,
    `      u.customparams.subfolder = nil`,
    `    end`,
    `  end`,
    ``,
    `  local function bmf_swap(u, slotNum, srcUnit, srcWep, destWep)`,
    `    destWep = destWep or srcWep`,
    `    if UnitDefs[srcUnit] and UnitDefs[srcUnit].weapondefs and UnitDefs[srcUnit].weapondefs[srcWep] then`,
    `      if not u.weapondefs then u.weapondefs = {} end`,
    `      u.weapondefs[destWep] = table.copy(UnitDefs[srcUnit].weapondefs[srcWep])`,
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

export function generateEnvironmentBlockLua(env) {
  if (!env || Object.keys(env).length === 0) return '';
  const lines = ['do'];
  let hasAny = false;
  const gravity = env.gravity;
  if (gravity !== undefined && gravity !== '') {
    lines.push(`  if Spring and Spring.SetModOptions then`);
    lines.push(`    local mo = Spring.GetModOptions() or {}`);
    lines.push(`    mo.gravity = ${JSON.stringify(String(gravity))}`);
    lines.push(`    Spring.SetModOptions(mo)`);
    lines.push(`  end`);
    hasAny = true;
  }
  const windmin = env.windmin;
  const windmax = env.windmax;
  if ((windmin !== undefined && windmin !== '') || (windmax !== undefined && windmax !== '')) {
    lines.push(`  if Spring and Spring.SetModOptions then`);
    lines.push(`    local mo = Spring.GetModOptions() or {}`);
    if (windmin !== undefined && windmin !== '') lines.push(`    mo.windmin = ${JSON.stringify(String(windmin))}`);
    if (windmax !== undefined && windmax !== '') lines.push(`    mo.windmax = ${JSON.stringify(String(windmax))}`);
    lines.push(`    Spring.SetModOptions(mo)`);
    lines.push(`  end`);
    hasAny = true;
  }
  const tidalmaker = env.tidalmaker;
  if (tidalmaker !== undefined && tidalmaker !== '') {
    lines.push(`  if Spring and Spring.SetModOptions then`);
    lines.push(`    local mo = Spring.GetModOptions() or {}`);
    lines.push(`    mo.tidalmaker = ${JSON.stringify(String(tidalmaker))}`);
    lines.push(`    Spring.SetModOptions(mo)`);
    lines.push(`  end`);
    hasAny = true;
  }
  if (!hasAny) return '';
  lines.push('end');
  return lines.join('\n');
}

export function compileTweakDefsLua({ 
  currentTweakDefsLua, 
  customUnitClones, 
  buildMenuWizardSteps, 
  disabledUnitIds, 
  unitBuildOptions,
  projectMeta,
  compileFlags,
  environmentSettings,
  weaponLibrary = []
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

  const cleanBody = stripBlock(stripBlock(strippedText, CLONE_BEGIN, CLONE_END), BUILDMENU_BEGIN, BUILDMENU_END).trim();
  
  const clonesBlock = (compileFlags?.includeClones ?? true)
    ? generateClonesBlockLua(customUnitClones, weaponLibrary)
    : '';
  
  const menuConfig = { disabledUnitIds, unitBuildOptions };
  const updatedSteps = updateBuildMenuSteps(buildMenuWizardSteps, customUnitClones, menuConfig);
  const buildMenuBlock = (compileFlags?.includeRosters ?? true)
    ? generateBuildMenuBlockLua(updatedSteps)
    : '';
  
  const envBlock = generateEnvironmentBlockLua(environmentSettings);
  
  const parts = [];
  if (cleanBody.length > 0) parts.push(cleanBody);
  if (envBlock.length > 0) parts.push(envBlock);
  if (clonesBlock.length > 0) {
    parts.push(clonesBlock);
  }
  if (buildMenuBlock.length > 0) {
    parts.push(buildMenuBlock);
  }
  
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
