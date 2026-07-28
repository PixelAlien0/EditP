import { useMemo } from 'react';
import { STAT_KEYS } from '../config/editorParameters.js';
import { getWeaponParameterDefinition } from '../config/weaponParameters.js';
import { isValidCustomParameterKey } from '../config/customParameters.js';
import { ensureSafeCarrierWeaponPatch } from '../utils/carrierRuntimeSafety.js';
import { buildLobbyCommands, compileLobbyModules } from '../utils/lobbyModules.js';
import { encodeLobbyBase64, serializeLuaTable } from '../utils/tweakSerializer.js';
import { compileTweakDefsLua } from '../utils/tweakdefsHelper.js';

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
  weaponLibrary,
  supportingWeaponDefs,
  tweakModules,
  base64Options,
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
        return donorSlot ? { ...donorSlot, slot: slot.slot } : slot;
      });
    };

    Object.entries(tweaks).forEach(([unitId, statPatch]) => {
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

          if (parameterDefinition?.compileTarget === 'mount') {
            setNestedValue(unitPatch, `weapons.${slotNumber}.${parameter}`, coerceWeaponMountValue(parameter, value));
            return;
          }

          let path = parameterDefinition?.path || parameter;
          let typedValue = value;
          if (parameterDefinition?.valueTransform === 'shield-mask') {
            typedValue = value === 'true' || value === true ? 1 : 0;
          } else if (parameterDefinition?.valueType === 'boolean') {
            typedValue = value === 'true' || value === true;
            if (parameter === 'toairweapon' && typedValue && !Object.hasOwn(statPatch, `weapon_slot_${slotNumber}_onlytargetcategory`)) {
              setNestedValue(unitPatch, `weapons.${slotNumber}.onlytargetcategory`, 'VTOL');
            }
          } else if (parameterDefinition?.valueType === 'string') {
            typedValue = value ? String(value) : '';
          } else {
            typedValue = Number.parseFloat(value);
            if (Number.isNaN(typedValue)) return;
          }
          setNestedValue(unitPatch, `weapondefs.${slot.defKey.toLowerCase()}.${path}`, typedValue);
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
          if (typeof value === 'string' && /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) typedValue = Number(value);
          else if (value === 'true' || value === 'false') typedValue = value === 'true';
          setNestedValue(unitPatch, `customparams.${customKey}`, typedValue);
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
    getInheritedCloneWeaponSwaps,
    includeTweaks,
    resolveCloneRootId,
    tweaks,
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
    compileFlags: { includeClones, includeRosters },
    weaponLibrary,
    deathExplosionTweaks,
    supportingWeaponDefs,
    tweaks,
  }), [
    activeFactoryRosters,
    buildMenuSteps,
    clones,
    deathExplosionTweaks,
    disabledUnitIds,
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
    () => generatedTweakUnitsLua === '{\n}' ? '' : encodeLobbyBase64(`${generatedTweakUnitsLua} `, base64Options),
    [base64Options, generatedTweakUnitsLua],
  );
  const tweakDefsB64 = useMemo(
    () => generatedTweakDefsLua.trim() ? encodeLobbyBase64(`${generatedTweakDefsLua} `, base64Options) : '',
    [base64Options, generatedTweakDefsLua],
  );
  const compiledLobbyModules = useMemo(() => compileLobbyModules({
    tweakModules,
    generatedTweakDefsLua,
    generatedTweakUnitsLua,
    base64Options,
  }), [base64Options, generatedTweakDefsLua, generatedTweakUnitsLua, tweakModules]);
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
