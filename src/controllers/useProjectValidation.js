import { useMemo } from 'react';
import {
  getSpecialProjectileBehavior,
  isSupportedSpecialProjectileBehavior,
} from '../config/specialProjectileBehaviors.js';
import { buildCrossWorkspaceValidation } from '../utils/crossWorkspaceValidation.js';
import {
  evaluateGadgetContracts,
  gadgetContractResultsToIssues,
} from '../utils/gadgetContractValidation.js';

export function getValidationWarning(key, value) {
  if (value === undefined || value === '') return null;
  const normalizedKey = key.toLowerCase();
  const normalizedValue = String(value).trim().toLowerCase();
  if (normalizedKey.includes('spawns_surface') && !['land', 'sea'].includes(normalizedValue)) {
    return { level: 'error', message: 'BAR supports LAND or SEA for this field' };
  }
  if (normalizedKey.includes('spawns_mode') && !['random', 'random_locked', 'sequential'].includes(normalizedValue)) {
    return { level: 'error', message: 'Use random, random_locked, or sequential' };
  }
  if (normalizedKey.includes('carrierdeaththroe') && !['death', 'control', 'capture', 'release', 'parasite'].includes(normalizedValue)) {
    return { level: 'error', message: 'Use death, control, capture, release, or parasite' };
  }
  if (/(?:^|_)speceffect$/.test(normalizedKey)
    && !isSupportedSpecialProjectileBehavior(normalizedValue)) {
    return { level: 'error', message: 'Select one of BAR’s supported special projectile behaviors' };
  }

  const carrierListKey = normalizedKey.match(
    /(?:^|[_.])(maxunits|startingdronecount|spawn_metal_cost|spawn_energy_cost|droneairtime|dronedocktime|droneammo)$/
  )?.[1];
  if (carrierListKey) {
    const values = normalizedValue.split(/\s+/).filter(Boolean).map(Number);
    if (values.length === 0 || values.some(item => !Number.isFinite(item))) {
      return { level: 'error', message: 'Enter one number per carried unit, separated by spaces' };
    }
    const requiresInteger = ['maxunits', 'startingdronecount', 'droneammo'].includes(carrierListKey);
    if (requiresInteger && values.some(item => !Number.isInteger(item))) {
      return { level: 'error', message: 'Every list value must be a whole number' };
    }
    const minimum = carrierListKey === 'maxunits' ? 1 : 0;
    if (values.some(item => item < minimum)) {
      return {
        level: 'error',
        message: carrierListKey === 'maxunits'
          ? 'Every capacity must be at least 1'
          : 'List values cannot be negative',
      };
    }
    return null;
  }

  if ((key === 'collisionvolumescales' || key === 'collisionvolumeoffsets')
    && !/^\s*-?\d*\.?\d+(?:\s+-?\d*\.?\d+){2}\s*$/.test(String(value))) {
    return { level: 'error', message: 'Enter three numbers: X Y Z' };
  }

  const number = parseFloat(value);
  if (Number.isNaN(number)) return null;
  const isKey = pattern => normalizedKey.includes(pattern.toLowerCase());

  if (isKey('reload') || isKey('stockpiletime')) {
    if (number <= 0) return { level: 'error', message: 'Value must be positive' };
    if (number < 0.03) return { level: 'warning', message: 'Below engine limit (0.033s)' };
  }
  if (isKey('burstrate') && number < 0) {
    return { level: 'error', message: 'Burst rate cannot be negative' };
  }
  if (isKey('range') || isKey('sightdistance') || isKey('radardistance') || isKey('sonardistance') || isKey('builddistance')) {
    if (number < 0) return { level: 'error', message: 'Range cannot be negative' };
    if (number > 10000) return { level: 'warning', message: 'Exceeds standard map scale (10000)' };
  }
  if ((isKey('metalcost') || isKey('energycost')) && number < 0) {
    return { level: 'error', message: 'Cost cannot be negative' };
  }
  if (isKey('buildtime') && number <= 0) {
    return { level: 'error', message: 'Build time must be positive' };
  }
  if (isKey('health') && number <= 0) {
    return { level: 'error', message: 'Health must be positive' };
  }
  if (isKey('maxvelocity')) {
    if (number < 0) return { level: 'error', message: 'Speed cannot be negative' };
    if (number > 400) return { level: 'warning', message: 'High speed may glitch (>400)' };
  }
  if (isKey('stockpilelimit') && number < 0) {
    return { level: 'error', message: 'Limit cannot be negative' };
  }
  if (key === 'targetable' || key === 'interceptor' || key === 'interceptedbyshieldtype') {
    if (!Number.isInteger(number) || number < 0) {
      return { level: 'error', message: 'Bitmask must be a non-negative whole number' };
    }
  }
  if (key === 'coverage' && number < 0) {
    return { level: 'error', message: 'Coverage cannot be negative' };
  }
  if (isKey('spawnrate') && number <= 0) {
    return { level: 'error', message: 'Spawn rate must be positive' };
  }
  if (isKey('maxunits') && (!Number.isInteger(number) || number < 1)) {
    return { level: 'error', message: 'Maximum units must be a positive integer' };
  }
  if ((isKey('startingdronecount') || isKey('droneammo'))
    && (!Number.isInteger(number) || number < 0)) {
    return { level: 'error', message: 'Enter a non-negative whole number' };
  }
  if (isKey('docktohealthreshold') && (number < 0 || number > 100)) {
    return { level: 'error', message: 'Docking threshold is a health percentage from 0 to 100' };
  }
  if (isKey('dockingarmor') && (number < 0 || number > 1)) {
    return { level: 'error', message: 'Docked damage multiplier must be between 0 and 1' };
  }
  if ((isKey('spawns_expire') || isKey('spawns_stun') || isKey('dockinghealrate')
    || isKey('dockingradius') || isKey('dockinghelperspeed') || isKey('engagementrange')
    || isKey('droneairtime') || isKey('dronedocktime')) && number < 0) {
    return { level: 'error', message: 'Value cannot be negative' };
  }
  if ((key === 'footprintx' || key === 'footprintz')
    && (!Number.isInteger(number) || number < 1)) {
    return { level: 'error', message: 'Footprint must be a positive whole number' };
  }
  if (key === 'maxthisunit' && (!Number.isInteger(number) || number < 1)) {
    return { level: 'error', message: 'Team limit must be a positive whole number' };
  }
  if (isKey('cluster_number')) {
    if (!Number.isInteger(number) || number < 1) {
      return { level: 'error', message: 'Cluster count must be a positive integer' };
    }
    if (number > 64) return { level: 'warning', message: 'Large cluster counts can be expensive' };
  }
  if (isKey('speceffect_number')) {
    if (!Number.isInteger(number) || number < 1) {
      return { level: 'error', message: 'Submunition count must be a positive integer' };
    }
    if (number > 64) return { level: 'warning', message: 'Large split counts can be expensive' };
  }
  if ((isKey('cruise_min_height') || isKey('cruise_max_height') || isKey('lockon_dist')
    || isKey('guidance_lost_radius')) && number < 0) {
    return { level: 'error', message: 'Value cannot be negative' };
  }
  if (isKey('tracking_turn_radius') && number <= 0) {
    return { level: 'error', message: 'Tracking turn radius must be positive' };
  }
  if (isKey('spread_angle')) {
    if (number <= 0) return { level: 'error', message: 'Sector angle must be greater than 0°' };
    if (number > 180) return { level: 'warning', message: 'Angles above 180° can fire behind the weapon' };
  }
  if (isKey('max_range_reduction') && (number < 0 || number > 1)) {
    return { level: 'error', message: 'Sector depth must be between 0 and 1' };
  }
  if ((isKey('controlradius') || isKey('engagementrange') || isKey('decayrate'))) {
    const rawStr = String(value).trim();
    if (rawStr.includes(' ')) {
      const nums = rawStr.split(/\s+/).map(v => parseFloat(v));
      if (nums.some(n => Number.isNaN(n) || n < 0)) {
        return { level: 'error', message: 'Value cannot be negative' };
      }
      return null;
    }
    if (number < 0) {
      return { level: 'error', message: 'Value cannot be negative' };
    }
  }
  return null;
}

export function useProjectValidation({
  tweaks,
  clones,
  unitNames,
  compiledLobbyModules,
  allUnitsList,
  defaultsDb,
  resolveCloneRootId,
  supportingWeaponDefs,
  buildMenuSteps,
  activeFactoryRosters,
  weaponLibrary,
  disabledUnitIds,
  includeTweaks,
  includeClones,
  includeRosters,
  activeCollectionUnitIds,
  selectedUnitId,
}) {
  const gadgetContractContext = useMemo(() => ({
    knownUnitIds: new Set([
      ...allUnitsList.map(unit => String(unit.id || '').toLowerCase()),
      ...clones.map(clone => String(clone.newId || '').toLowerCase()),
    ].filter(Boolean)),
    knownWeaponDefs: new Set(
      Object.values(defaultsDb)
        .flatMap(unit => unit?.weaponSlots || [])
        .map(slot => String(slot.defKey || '').toLowerCase())
        .filter(Boolean)
    ),
    supportingWeaponDefs: new Set(
      supportingWeaponDefs
        .filter(definition => definition.enabled !== false)
        .map(definition => `${definition.ownerUnitId}:${definition.key}`.toLowerCase())
    ),
  }), [allUnitsList, clones, defaultsDb, supportingWeaponDefs]);

  const gadgetContractResults = useMemo(() => Object.entries(tweaks).flatMap(([unitId, patch]) => (
    evaluateGadgetContracts({
      unitId,
      unitName: unitNames[unitId]
        || clones.find(clone => clone.newId.toLowerCase() === unitId.toLowerCase())?.displayName
        || unitId,
      defaults: defaultsDb[resolveCloneRootId(unitId)] || {},
      patch,
      ...gadgetContractContext,
    })
  )), [clones, defaultsDb, gadgetContractContext, resolveCloneRootId, tweaks, unitNames]);

  const selectedGadgetContracts = useMemo(() => {
    if (!selectedUnitId) return [];
    return evaluateGadgetContracts({
      unitId: selectedUnitId,
      unitName: unitNames[selectedUnitId]
        || clones.find(clone => clone.newId.toLowerCase() === selectedUnitId.toLowerCase())?.displayName
        || selectedUnitId,
      defaults: defaultsDb[resolveCloneRootId(selectedUnitId)] || {},
      patch: tweaks[selectedUnitId] || {},
      ...gadgetContractContext,
    });
  }, [clones, defaultsDb, gadgetContractContext, resolveCloneRootId, selectedUnitId, tweaks, unitNames]);

  const validationIssues = useMemo(() => {
    const issues = [];
    const knownUnitIds = new Set(allUnitsList.map(unit => unit.id.toLowerCase()));
    const knownWeaponDefs = new Set(
      Object.values(defaultsDb)
        .flatMap(unit => unit?.weaponSlots || [])
        .map(slot => String(slot.defKey || '').toLowerCase())
        .filter(Boolean)
    );
    const enabledSupportingWeaponDefs = supportingWeaponDefs.filter(
      definition => definition.enabled !== false
    );
    const supportingDestinations = new Set(
      enabledSupportingWeaponDefs.map(
        definition => `${definition.ownerUnitId}:${definition.key}`.toLowerCase()
      )
    );

    Object.entries(tweaks).forEach(([unitId, patch]) => {
      const unitName = unitNames[unitId]
        || clones.find(clone => clone.newId.toLowerCase() === unitId.toLowerCase())?.displayName
        || unitId;
      Object.entries(patch).forEach(([key, value]) => {
        const warning = getValidationWarning(key, value);
        if (warning) issues.push({ unitId, unitName, key, value, ...warning });

        const referenceId = String(value || '').trim().toLowerCase();
        if (key === 'customparams.carried_unit'
          || /^weapon_slot_\d+_(?:spawns_name|carried_unit)$/.test(key)) {
          const referencedUnitIds = referenceId.split(/[\s,]+/).filter(Boolean);
          const missingUnitIds = referencedUnitIds.filter(id => !knownUnitIds.has(id));
          if (missingUnitIds.length > 0) {
            issues.push({
              unitId,
              unitName,
              key,
              value,
              level: 'warning',
              message: `Referenced unit${missingUnitIds.length > 1 ? 's' : ''} ${missingUnitIds.map(id => `"${id}"`).join(', ')} ${missingUnitIds.length > 1 ? 'are' : 'is'} not present in the current BAR definition catalog or project clones.`,
            });
          }
        }

        const localSupportingWeaponDef = supportingDestinations.has(
          `${unitId}:${referenceId}`.toLowerCase()
        );
        if (/^weapon_slot_\d+_(?:cluster_def|speceffect_def)$/.test(key)
          && referenceId
          && !knownWeaponDefs.has(referenceId)
          && !localSupportingWeaponDef) {
          issues.push({
            unitId,
            unitName,
            key,
            value,
            level: 'warning',
            message: `Referenced WeaponDef "${value}" is not present in the loaded BAR definitions. Raw imported modules may define it later.`,
          });
        }
      });

      Object.entries(patch).forEach(([key, value]) => {
        const modeMatch = key.match(/^weapon_slot_(\d+)_speceffect$/);
        if (!modeMatch) return;
        const behavior = getSpecialProjectileBehavior(value);
        if (!behavior) return;

        const slotNumber = Number(modeMatch[1]);
        const rootDefaults = defaultsDb[resolveCloneRootId(unitId)];
        const defaultSlot = rootDefaults?.weaponSlots?.find(
          slot => Number(slot.slot) === slotNumber
        ) || {};
        behavior.requiredParameterKeys.forEach(parameterKey => {
          const patchKey = `weapon_slot_${slotNumber}_${parameterKey}`;
          const effectiveValue = patch[patchKey] ?? defaultSlot[parameterKey];
          if (effectiveValue === undefined || String(effectiveValue).trim() === '') {
            issues.push({
              unitId,
              unitName,
              key: patchKey,
              level: 'error',
              message: `${behavior.label} requires ${parameterKey.replaceAll('_', ' ')}.`,
            });
          }
        });

        if (behavior.id === 'cruise') {
          const minimum = Number(
            patch[`weapon_slot_${slotNumber}_cruise_min_height`]
              ?? defaultSlot.cruise_min_height
          );
          const maximum = Number(
            patch[`weapon_slot_${slotNumber}_cruise_max_height`]
              ?? defaultSlot.cruise_max_height
          );
          if (Number.isFinite(minimum) && Number.isFinite(maximum) && minimum > maximum) {
            issues.push({
              unitId,
              unitName,
              key: `weapon_slot_${slotNumber}_cruise_max_height`,
              level: 'error',
              message: 'Maximum cruise clearance must be at least the minimum clearance.',
            });
          }
        }
      });
    });

    const checkedSupportingDestinations = new Set();
    enabledSupportingWeaponDefs.forEach(definition => {
      const destination = `${definition.ownerUnitId}:${definition.key}`.toLowerCase();
      const unitName = unitNames[definition.ownerUnitId] || definition.ownerUnitId;
      if (checkedSupportingDestinations.has(destination)) {
        issues.push({
          unitId: definition.ownerUnitId,
          unitName,
          key: `supporting_weapondef_${definition.key}`,
          level: 'error',
          message: `Supporting WeaponDef "${definition.key}" is defined more than once for ${definition.ownerUnitId}.`,
        });
      }
      checkedSupportingDestinations.add(destination);
      if (!knownUnitIds.has(definition.ownerUnitId)) {
        issues.push({
          unitId: definition.ownerUnitId,
          unitName: definition.ownerUnitId,
          key: `supporting_weapondef_${definition.key}`,
          level: 'error',
          message: `Supporting WeaponDef owner "${definition.ownerUnitId}" is not present in the BAR catalog or project clones.`,
        });
      }
      (definition.dependencies || []).forEach(dependency => {
        const localDependency = `${definition.ownerUnitId}:${dependency}`.toLowerCase();
        const baseHasDependency = defaultsDb[
          resolveCloneRootId(definition.ownerUnitId)
        ]?.weaponSlots?.some(slot => slot.defKey?.toLowerCase() === dependency);
        if (!supportingDestinations.has(localDependency) && !baseHasDependency) {
          issues.push({
            unitId: definition.ownerUnitId,
            unitName,
            key: `supporting_weapondef_${definition.key}`,
            level: 'warning',
            message: `Supporting WeaponDef "${definition.key}" references missing dependency "${dependency}".`,
          });
        }
      });
    });

    if (compiledLobbyModules.defs.overflow) {
      issues.push({
        unitId: 'project',
        unitName: 'Lobby package',
        key: 'tweakdefs_slots',
        level: 'error',
        message: `${compiledLobbyModules.defs.required} Definitions slots required; BAR provides 9.`,
      });
    }
    if (compiledLobbyModules.units.overflow) {
      issues.push({
        unitId: 'project',
        unitName: 'Lobby package',
        key: 'tweakunits_slots',
        level: 'error',
        message: `${compiledLobbyModules.units.required} Units slots required; BAR provides 9.`,
      });
    }
    issues.push(...gadgetContractResultsToIssues(gadgetContractResults));
    issues.push(...buildCrossWorkspaceValidation({
      tweaks,
      clones,
      buildMenuSteps,
      activeFactoryRosters,
      weaponLibrary,
      supportingWeaponDefs,
      allUnitsList,
      defaultsDb,
      disabledUnitIds,
      includeTweaks,
      includeClones,
      includeRosters,
      resolveCloneRootId,
    }));
    return issues;
  }, [
    activeFactoryRosters,
    allUnitsList,
    buildMenuSteps,
    clones,
    compiledLobbyModules,
    defaultsDb,
    disabledUnitIds,
    gadgetContractResults,
    includeClones,
    includeRosters,
    includeTweaks,
    resolveCloneRootId,
    supportingWeaponDefs,
    tweaks,
    unitNames,
    weaponLibrary,
  ]);

  const scopedValidationIssues = useMemo(
    () => activeCollectionUnitIds
      ? validationIssues.filter(issue => activeCollectionUnitIds.has(issue.unitId))
      : validationIssues,
    [activeCollectionUnitIds, validationIssues]
  );

  return {
    validationIssues,
    scopedValidationIssues,
    gadgetContractResults,
    selectedGadgetContracts,
  };
}
