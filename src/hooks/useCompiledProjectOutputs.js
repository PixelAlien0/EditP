import { useMemo } from 'react';
import { STAT_KEYS } from '../config/editorParameters.js';
import { getWeaponParameterDefinition } from '../config/weaponParameters.js';
import { isValidCustomParameterKey } from '../config/customParameters.js';
import { ensureSafeCarrierWeaponPatch } from '../utils/carrierRuntimeSafety.js';
import { buildLobbyCommands, compileLobbyModules } from '../utils/lobbyModules.js';
import { encodeLobbyBase64, serializeLuaTable } from '../utils/tweakSerializer.js';
import { compileTweakDefsLua } from '../utils/tweakdefsHelper.js';
import { getWeaponBlueprintDefinitionKey } from '../utils/weaponBlueprint.js';

function setNestedValue(object, path, value) {
  const keys = path.split('.');
  let target = object;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!target[key]) target[key] = {};
    target = target[key];
  }
  target[keys.at(-1)] = value;
}

function coerceWeaponMountValue(parameter, value) {
  if (['fastautoretargeting', 'fastquerypointupdate'].includes(parameter)) {
    return value === 'true' || value === true;
  }
  if (['onlytargetcategory', 'badtargetcategory', 'maindir'].includes(parameter)) {
    return value ? String(value) : '';
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : value;
}

function getLegacyWeaponPath(parameter) {
  return {
    damage: 'damage.default',
    reload: 'reloadtime',
    range: 'range',
    velocity: 'weaponvelocity',
    flighttime: 'flighttime',
    aoe: 'areaofeffect',
    accuracy: 'accuracy',
    sprayangle: 'sprayangle',
    projectiles: 'projectiles',
    burst: 'burst',
    burstrate: 'burstrate',
  }[parameter] || null;
}

export function useCompiledProjectOutputs({
  tweaks,
  allUnitsList,
  clones,
  defaultsDb,
  explosionProfiles,
  resolveCloneRootId,
  getInheritedCloneWeaponSwaps,
  includeTweaks,
  includeClones,
  includeRosters,
  includeHeader,
  tweakDefsLua,
  buildMenuSteps,
  disabledUnitIds,
  activeFactoryRosters,
  projectName,
  projectAuthor,
  projectDesc,
  unitDescriptions = {},
  weaponLibrary,
  supportingWeaponDefs,
  tweakModules,
  exportEnglishOnly = false,
  compactLuaFormatting = false,
}) {
  const generatedTweakUnitsLua = useMemo(() => {
    if (!includeTweaks) return '{\n}';
    const patches = {};
    const unitsById = new Map(allUnitsList.map(unit => [unit.id, unit]));

    const getActiveWeaponSlots = unitId => {
      const unit = unitsById.get(unitId);
      if (!unit) return [];
      const baseId = unit.isClone ? resolveCloneRootId(unitId) : unitId;
      const defaults = defaultsDb[baseId];
      if (!defaults) return [];
      let slots = structuredClone(defaults.weaponSlots || []);
      if (!unit.isClone || slots.length === 0) return slots;

      const swaps = getInheritedCloneWeaponSwaps(unitId);
      if (!swaps) return slots;
      return slots.map(slot => {
        const swap = swaps[String(slot.slot)];
        if (!swap) return slot;
        const donorDefaults = defaultsDb[resolveCloneRootId(swap.sourceUnitId)];
        const donorSlot = donorDefaults?.weaponSlots?.find(candidate => (
          candidate.defKey === swap.sourceWeaponDefKey.toLowerCase()
        ));
        if (!donorSlot) return slot;
        const blueprint = swap.libraryWeaponId
          ? weaponLibrary.find(item => item.id === swap.libraryWeaponId)
          : null;
        return {
          ...donorSlot,
          defKey: blueprint
            ? getWeaponBlueprintDefinitionKey(blueprint)
            : donorSlot.defKey,
          slot: slot.slot,
        };
      });
    };

    const editedUnitIds = new Set([
      ...Object.keys(tweaks),
      ...Object.keys(unitDescriptions),
    ]);

    editedUnitIds.forEach(unitId => {
      const statPatch = tweaks[unitId] || {};
      const unit = unitsById.get(unitId);
      const defaults = defaultsDb[unit?.isClone ? resolveCloneRootId(unitId) : unitId];
      if (!defaults) return;
      const unitPatch = {};

      Object.entries(statPatch).forEach(([key, value]) => {
        if (key.startsWith('weapon_slot_')) {
          const match = key.match(/^weapon_slot_(\d+)_(.+)$/);
          if (!match) return;
          const slotNumber = Number.parseInt(match[1], 10);
          const parameter = match[2];
          const slot = getActiveWeaponSlots(unitId).find(candidate => candidate.slot === slotNumber);
          if (!slot?.defKey) return;
          const parameterDefinition = getWeaponParameterDefinition(parameter);
          const canonicalTweakKey = parameterDefinition?.replacementKey
            ? `weapon_slot_${slotNumber}_${parameterDefinition.replacementKey}`
            : null;
          if (canonicalTweakKey && Object.hasOwn(statPatch, canonicalTweakKey)) return;

          if (parameterDefinition?.compileTarget === 'mount') {
            const mountPath = parameterDefinition.path || parameter;
            const mountValue = parameterDefinition.valueTransform === 'anti-air-category'
              ? (value === 'true' || value === true ? 'VTOL' : '')
              : coerceWeaponMountValue(mountPath, value);
            setNestedValue(unitPatch, `weapons.${slotNumber}.${mountPath}`, mountValue);
            return;
          }

          let path = parameterDefinition?.path || parameter;
          let typedValue = value;
          if (parameterDefinition?.valueTransform === 'shield-mask') {
            typedValue = value === 'true' || value === true ? 1 : 0;
          } else if (parameterDefinition?.valueType === 'boolean') {
            typedValue = value === 'true' || value === true;
          } else if (parameterDefinition?.valueType === 'string') {
            typedValue = value ? String(value) : '';
          } else {
            typedValue = typeof value === 'boolean' ? (value ? 1 : 0) : Number.parseFloat(value);
            if (Number.isNaN(typedValue)) return;
          }
          setNestedValue(unitPatch, `weapondefs.${slot.defKey.toLowerCase()}.${path}`, typedValue);
          // BAR's shield gadgets do not derive their rendered/coverage sphere
          // from the engine WeaponDef. They cache matching UnitDef customParams
          // at load time, so both values must move together.
          if (parameterDefinition?.unitMirrorPath) {
            setNestedValue(unitPatch, parameterDefinition.unitMirrorPath, typedValue);
          }
          return;
        }

        if (key.startsWith('weapon1')) {
          const slot = getActiveWeaponSlots(unitId).find(candidate => candidate.slot === 1);
          const path = getLegacyWeaponPath(key.slice(7).toLowerCase());
          const typedValue = Number.parseFloat(value);
          if (slot?.defKey && path && !Number.isNaN(typedValue)) {
            setNestedValue(unitPatch, `weapondefs.${slot.defKey.toLowerCase()}.${path}`, typedValue);
          }
          return;
        }

        const config = STAT_KEYS.find(parameter => parameter.key === key);
        if (!config && key.startsWith('customparams.')) {
          const customKey = key.slice('customparams.'.length);
          if (!isValidCustomParameterKey(customKey)) return;
          let typedValue = value;
          if (typeof value === 'string') {
            const stripped = value.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
            if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(stripped.trim())) {
              typedValue = Number(stripped.trim());
            } else if (stripped === 'true' || stripped === 'false') {
              typedValue = stripped === 'true';
            } else {
              typedValue = stripped;
            }
          }
          setNestedValue(unitPatch, `customparams.${customKey}`, typedValue);

          const lowerKey = customKey.toLowerCase();
          if (lowerKey === 'canfly') unitPatch.canfly = Boolean(typedValue);
          else if (lowerKey === 'canmove') unitPatch.canmove = Boolean(typedValue);
          else if (lowerKey === 'movetype') unitPatch.movetype = String(typedValue);
          else if (lowerKey === 'cruisealtitude' || lowerKey === 'cruisealt') {
            unitPatch.cruisealtitude = Number(typedValue);
            unitPatch.cruiseAltitude = Number(typedValue);
          } else if (lowerKey === 'verticalspeed') unitPatch.verticalspeed = Number(typedValue);
          else if (lowerKey === 'upright') unitPatch.upright = Boolean(typedValue);
          else if (lowerKey === 'airhoverfactor') unitPatch.airhoverfactor = Number(typedValue);
          else if (lowerKey === 'hoverattack') unitPatch.hoverAttack = Boolean(typedValue);
          else if (lowerKey === 'nochasecategory') {
            unitPatch.nochasecategory = String(typedValue);
          } else if (lowerKey === 'badtargetcategory') {
            unitPatch.badtargetcategory = String(typedValue);
          } else if (lowerKey === 'noautorange') {
            unitPatch.noautorange = Boolean(typedValue);
          } else if (lowerKey === 'pitchtolerance' || lowerKey === 'tolerance') {
            const numVal = Number(typedValue);
            if (!Number.isNaN(numVal)) {
              getActiveWeaponSlots(unitId).forEach(slot => {
                const weaponKey = String(slot.defKey || '').toLowerCase();
                if (weaponKey) {
                  setNestedValue(unitPatch, `weapondefs.${weaponKey}.${lowerKey}`, numVal);
                }
              });
            }
          }

          return;
        }
        if (!config || config.output === 'tweakdefs') return;
        if (key === 'explodeas' && Object.keys(statPatch).some(statKey => statKey.startsWith('death_explosion_'))) return;
        if (key === 'selfdestructas' && Object.keys(statPatch).some(statKey => statKey.startsWith('selfd_explosion_'))) return;

        let typedValue = value;
        if (config.type === 'number') {
          typedValue = Number.parseFloat(value);
          if (Number.isNaN(typedValue)) return;
        } else if (config.type === 'boolean') {
          typedValue = value === 'true' || value === true;
        }

        const patchKey = config.patchKey ?? config.key;
        if (config.nestedIn) setNestedValue(unitPatch, `${config.nestedIn}.${patchKey}`, typedValue);
        else if (patchKey.includes('.')) setNestedValue(unitPatch, patchKey, typedValue);
        else unitPatch[patchKey] = typedValue;
      });

      const description = unitDescriptions[unitId];
      if (typeof description === 'string' && description.trim()) {
        unitPatch.description = description.trim();
        const tooltipLanguages = exportEnglishOnly
          ? ['en']
          : ['en', 'de', 'fr', 'es', 'it', 'ru', 'zh', 'cs', 'hr', 'lt'];
        tooltipLanguages.forEach(language => {
          setNestedValue(unitPatch, `customparams.i18n_${language}_tooltip`, description.trim());
        });
      }

      getActiveWeaponSlots(unitId).forEach(slot => {
        const weaponKey = String(slot.defKey || '').toLowerCase();
        const weaponPatch = unitPatch.weapondefs?.[weaponKey];
        if (weaponPatch) unitPatch.weapondefs[weaponKey] = ensureSafeCarrierWeaponPatch(weaponPatch, slot);
      });

      if (Object.keys(unitPatch).length > 0) patches[unitId] = unitPatch;
    });

    return Object.keys(patches).length > 0 ? serializeLuaTable(patches) : '{\n}';
  }, [
    allUnitsList,
    defaultsDb,
    exportEnglishOnly,
    getInheritedCloneWeaponSwaps,
    includeTweaks,
    resolveCloneRootId,
    tweaks,
    unitDescriptions,
    weaponLibrary,
  ]);

  const deathExplosionTweaks = useMemo(() => {
    if (!includeTweaks) return [];
    const unitsById = new Map(allUnitsList.map(unit => [unit.id, unit]));
    return Object.entries(tweaks).flatMap(([unitId, unitTweaks]) => {
      const unit = unitsById.get(unitId);
      const baseId = unit?.isClone ? resolveCloneRootId(unitId) : unitId;
      const defaults = defaultsDb[baseId] || {};
      const readProfile = prefix => Object.fromEntries(
        ['damage', 'aoe', 'camerashake', 'impulsefactor']
          .map(key => [key, unitTweaks[`${prefix}_explosion_${key}`]])
          .filter(([, value]) => value !== undefined),
      );
      const death = readProfile('death');
      const selfd = readProfile('selfd');
      if (Object.keys(death).length === 0 && Object.keys(selfd).length === 0) return [];
      const explodeAs = unitTweaks.explodeas ?? defaults.explodeas;
      const selfDestructAs = unitTweaks.selfdestructas ?? defaults.selfdestructas ?? defaults.explodeas;
      return [{
        unitId,
        explodeAs,
        selfDestructAs,
        sources: {
          death: { name: explodeAs, definition: explosionProfiles[String(explodeAs || '').toLowerCase()] },
          selfd: { name: selfDestructAs, definition: explosionProfiles[String(selfDestructAs || '').toLowerCase()] },
        },
        death,
        selfd,
      }];
    });
  }, [allUnitsList, defaultsDb, explosionProfiles, includeTweaks, resolveCloneRootId, tweaks]);

  const generatedTweakDefsLua = useMemo(() => compileTweakDefsLua({
    currentTweakDefsLua: tweakDefsLua,
    customUnitClones: clones,
    buildMenuWizardSteps: buildMenuSteps,
    disabledUnitIds,
    unitBuildOptions: activeFactoryRosters,
    projectMeta: includeHeader ? { name: projectName, author: projectAuthor, desc: projectDesc } : null,
    compileFlags: { includeClones, includeRosters, exportEnglishOnly, compactLuaFormatting },
    weaponLibrary,
    deathExplosionTweaks,
    supportingWeaponDefs,
    tweaks,
  }), [
    activeFactoryRosters,
    buildMenuSteps,
    clones,
    compactLuaFormatting,
    deathExplosionTweaks,
    disabledUnitIds,
    exportEnglishOnly,
    includeClones,
    includeHeader,
    includeRosters,
    projectAuthor,
    projectDesc,
    projectName,
    supportingWeaponDefs,
    tweakDefsLua,
    tweaks,
    weaponLibrary,
  ]);

  const tweakUnitsB64 = useMemo(
    () => generatedTweakUnitsLua === '{\n}' ? '' : encodeLobbyBase64(`${generatedTweakUnitsLua} `),
    [generatedTweakUnitsLua],
  );
  const tweakDefsB64 = useMemo(
    () => generatedTweakDefsLua.trim() ? encodeLobbyBase64(`${generatedTweakDefsLua} `) : '',
    [generatedTweakDefsLua],
  );
  const compiledLobbyModules = useMemo(() => compileLobbyModules({
    tweakModules,
    generatedTweakDefsLua,
    generatedTweakUnitsLua,
  }), [generatedTweakDefsLua, generatedTweakUnitsLua, tweakModules]);
  const lobbyCommands = useMemo(() => buildLobbyCommands(compiledLobbyModules), [compiledLobbyModules]);

  return {
    generatedTweakUnitsLua,
    generatedTweakDefsLua,
    tweakUnitsB64,
    tweakDefsB64,
    compiledLobbyModules,
    lobbyCommands,
    totalBytesUsed: compiledLobbyModules.aggregateBytes,
    lobbyByteLimit: 12000,
  };
}
