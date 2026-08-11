import {
  getWeaponBlueprintEffectiveValues,
  validateWeaponBlueprint,
} from './weaponBlueprint.js';
import {
  BUILTIN_ARMOR_PROFILES,
  getArmorProfileFromDamageKey,
  isValidArmorProfile,
  normalizeArmorProfile,
} from '../config/armorProfiles.js';
import { resolveSupportingWeaponDefReachability } from './supportingWeaponDefReachability.js';

function cleanId(value) {
  return String(value || '').trim().toLowerCase();
}

function idList(value) {
  return String(value || '').trim().toLowerCase().split(/[\s,]+/).filter(Boolean);
}

function stableUnique(values) {
  return [...new Set(values.map(cleanId).filter(Boolean))].sort();
}

function sameIds(left, right) {
  const a = stableUnique(left);
  const b = stableUnique(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function issue({ id, level = 'warning', unitId = 'project', unitName = 'Project graph', key, title, message, action }) {
  return {
    id: `cross-workspace-${id}`,
    source: 'cross-workspace',
    group: 'workspaces',
    level,
    unitId,
    unitName,
    key: key || id,
    title,
    message,
    action: action || null,
  };
}

function effectiveRoster(builderId, activeFactoryRosters, step) {
  const removed = new Set((step?.remove || []).map(cleanId));
  return stableUnique([
    ...(activeFactoryRosters?.[builderId] || []).filter(unitId => !removed.has(cleanId(unitId))),
    ...(step?.add || []),
  ]);
}

function blueprintSourceExists(blueprint, defaultsDb) {
  const sourceId = cleanId(blueprint?.sourceUnitId);
  const weaponKey = cleanId(blueprint?.sourceWeaponDefKey);
  return Boolean(defaultsDb?.[sourceId]?.weaponSlots?.some(slot => cleanId(slot.defKey) === weaponKey));
}

function validateCarrierLists({ unitId, unitName, patch, issues }) {
  Object.entries(patch || {}).forEach(([key, value]) => {
    const match = key.match(/^(weapon_slot_\d+_|customparams\.)carried_unit$/);
    if (!match || !cleanId(value)) return;
    const prefix = match[1];
    const carriedUnits = idList(value);
    const companionKeys = [
      'maxunits',
      'startingdronecount',
      'spawn_metal_cost',
      'spawn_energy_cost',
      'droneairtime',
      'dronedocktime',
      'droneammo',
    ];
    const capacityKey = `${prefix}maxunits`;
    if (patch[capacityKey] === undefined || String(patch[capacityKey]).trim() === '') {
      issues.push(issue({
        id: `${unitId}-${capacityKey}-missing`,
        level: 'error', unitId, unitName, key: capacityKey,
        title: `${unitName} · incomplete carrier roster`,
        message: 'A carried-unit roster requires Maximum Active Units per Type before it can compile safely.',
        action: { type: 'unit', unitId, label: 'Open carrier settings' },
      }));
    }
    if (carriedUnits.length < 2) return;
    companionKeys.forEach(companionKey => {
      const patchKey = `${prefix}${companionKey}`;
      if (patch[patchKey] === undefined || String(patch[patchKey]).trim() === '') return;
      const values = idList(patch[patchKey]);
      if (values.length !== 1 && values.length !== carriedUnits.length) {
        issues.push(issue({
          id: `${unitId}-${patchKey}-alignment`,
          level: 'error', unitId, unitName, key: patchKey,
          title: `${unitName} · carrier list mismatch`,
          message: `${companionKey.replaceAll('_', ' ')} has ${values.length} values for ${carriedUnits.length} carried-unit types. Use one shared value or one value per type.`,
          action: { type: 'unit', unitId, label: 'Repair carrier roster' },
        }));
      }
    });
  });
}

export function buildCrossWorkspaceValidation({
  tweaks = {},
  clones = [],
  buildMenuSteps = [],
  activeFactoryRosters = {},
  weaponLibrary = [],
  supportingWeaponDefs = [],
  allUnitsList = [],
  defaultsDb = {},
  disabledUnitIds = [],
  includeTweaks = true,
  includeClones = true,
  includeRosters = true,
  resolveCloneRootId = unitId => cleanId(unitId),
} = {}) {
  const issues = [];
  const knownUnitIds = new Set([
    ...allUnitsList.map(unit => cleanId(unit?.id)),
    ...clones.map(clone => cleanId(clone?.newId)),
  ].filter(Boolean));
  const cloneMap = new Map(clones.map(clone => [cleanId(clone.newId), clone]));
  const disabledIds = new Set(disabledUnitIds.map(cleanId));
  const rosterBuildersByUnit = new Map();
  const spawnedUnitIds = new Set();
  const assignedArmorProfiles = new Set();
  const usedArmorDamageProfiles = new Set();

  Object.entries(tweaks || {}).forEach(([unitId, patch]) => {
    const rawArmorProfile = patch?.['customparams.armordef'];
    if (rawArmorProfile !== undefined && String(rawArmorProfile).trim()) {
      const profile = normalizeArmorProfile(rawArmorProfile);
      if (!isValidArmorProfile(profile) || profile !== String(rawArmorProfile).trim().toLowerCase()) {
        const unitName = allUnitsList.find(unit => cleanId(unit.id) === cleanId(unitId))?.name || unitId;
        issues.push(issue({
          id: `armor-${cleanId(unitId)}-invalid`, level: 'error', unitId: cleanId(unitId), unitName,
          key: 'customparams.armordef', title: `${unitName} · invalid armor profile`,
          message: 'Armor Profile must begin with a letter or underscore and contain only lowercase letters, numbers, and underscores.',
          action: { type: 'unit', unitId: cleanId(unitId), label: 'Repair armor profile' },
        }));
      } else {
        assignedArmorProfiles.add(profile);
      }
    }
    Object.entries(patch || {}).forEach(([key, value]) => {
      const damageKey = key.match(/^weapon_slot_\d+_(damage_profile__.+)$/)?.[1];
      const damageProfile = getArmorProfileFromDamageKey(damageKey);
      if (damageProfile && value !== undefined && String(value).trim() !== '') {
        usedArmorDamageProfiles.add(damageProfile);
        if (!Number.isFinite(Number(value)) || Number(value) < 0) {
          const unitName = allUnitsList.find(unit => cleanId(unit.id) === cleanId(unitId))?.name || unitId;
          issues.push(issue({
            id: `armor-${cleanId(unitId)}-${damageProfile}-damage`, level: 'error', unitId: cleanId(unitId), unitName,
            key, title: `${unitName} · invalid armor damage`,
            message: `damage.${damageProfile} must be a non-negative number.`,
            action: { type: 'unit', unitId: cleanId(unitId), label: 'Repair weapon damage' },
          }));
        }
      }
      if (key === 'customparams.carried_unit'
        || /^weapon_slot_\d+_(?:spawns_name|carried_unit)$/.test(key)) {
        idList(value).forEach(unitId => spawnedUnitIds.add(unitId));
      }
    });
  });

  weaponLibrary.forEach(blueprint => {
    Object.keys(getWeaponBlueprintEffectiveValues(blueprint)).forEach(key => {
      const profile = getArmorProfileFromDamageKey(key);
      if (profile) usedArmorDamageProfiles.add(profile);
    });
  });

  usedArmorDamageProfiles.forEach(profile => {
    if (assignedArmorProfiles.has(profile) || BUILTIN_ARMOR_PROFILES.includes(profile)) return;
    issues.push(issue({
      id: `armor-${profile}-unassigned`, unitName: 'Armor profiles', key: `damage.${profile}`,
      title: `${profile} · no matching project unit`,
      message: `Weapons define damage.${profile}, but no edited unit currently declares customparams.armordef = "${profile}". The loaded game or a raw module may still provide consumers.`,
      action: { type: 'unit', label: 'Assign armor profile' },
    }));
  });

  buildMenuSteps.forEach(step => {
    const builderId = cleanId(step.builderId);
    (step.add || []).forEach(unitId => {
      const normalized = cleanId(unitId);
      rosterBuildersByUnit.set(normalized, [...(rosterBuildersByUnit.get(normalized) || []), builderId]);
    });
  });

  clones.forEach(clone => {
    const cloneId = cleanId(clone.newId);
    const cloneName = clone.displayName || clone.newId;
    const declaredBuilders = stableUnique(clone.builderIds || []);
    const rosterBuilders = stableUnique(rosterBuildersByUnit.get(cloneId) || []);
    if (!knownUnitIds.has(cleanId(clone.baseId))) {
      issues.push(issue({
        id: `clone-${cloneId}-base`, level: 'error', unitId: cloneId, unitName: cloneName,
        key: 'clone_base', title: `${cloneName} · missing clone source`,
        message: `Base UnitDef "${clone.baseId}" is unavailable in the loaded BAR snapshot and project clone graph.`,
        action: { type: 'unit', unitId: cloneId, label: 'Open clone' },
      }));
    }
    if (declaredBuilders.length === 0
      && rosterBuilders.length === 0
      && !spawnedUnitIds.has(cloneId)) {
      issues.push(issue({
        id: `clone-${cloneId}-unassigned`, unitId: cloneId, unitName: cloneName,
        key: 'builder_assignments', title: `${cloneName} · no production path`,
        message: 'This clone is not assigned to a builder or factory, so it will not appear in a normal build menu.',
        action: { type: 'build-menu', unitId: cloneId, label: 'Assign producer' },
      }));
    } else if (!sameIds(declaredBuilders, rosterBuilders)) {
      issues.push(issue({
        id: `clone-${cloneId}-builder-sync`, level: 'error', unitId: cloneId, unitName: cloneName,
        key: 'builder_assignments', title: `${cloneName} · producer assignments disagree`,
        message: `Clone Identity lists ${declaredBuilders.length || 0} producer assignments while Build Menus contains ${rosterBuilders.length || 0}. Re-save the assignments from either workspace.`,
        action: { type: 'build-menu', builderId: declaredBuilders[0] || rosterBuilders[0], unitId: cloneId, label: 'Repair Build Menu' },
      }));
    }
  });

  buildMenuSteps.forEach((step, stepIndex) => {
    const builderId = cleanId(step.builderId);
    const builderName = allUnitsList.find(unit => cleanId(unit.id) === builderId)?.name || step.builderId || 'Unknown producer';
    if (!knownUnitIds.has(builderId)) {
      issues.push(issue({
        id: `roster-${builderId || stepIndex}-builder`, level: 'error', unitName: builderName,
        key: 'build_menu_builder', title: `${builderName} · missing producer`,
        message: 'This Build Menu change targets a producer that is not present in the BAR snapshot or project clones.',
        action: { type: 'build-menu', builderId, label: 'Review Build Menus' },
      }));
    }
    const addIds = (step.add || []).map(cleanId);
    const removeIds = (step.remove || []).map(cleanId);
    const both = stableUnique(addIds.filter(unitId => removeIds.includes(unitId)));
    if (both.length) {
      issues.push(issue({
        id: `roster-${builderId}-conflict`, level: 'error', unitName: builderName,
        key: 'build_menu_conflict', title: `${builderName} · contradictory roster operations`,
        message: `${both.join(', ')} ${both.length === 1 ? 'is' : 'are'} both added and removed.`,
        action: { type: 'build-menu', builderId, label: 'Repair roster' },
      }));
    }
    stableUnique([...addIds, ...removeIds]).forEach(unitId => {
      if (knownUnitIds.has(unitId)) return;
      issues.push(issue({
        id: `roster-${builderId}-${unitId}-unknown`, level: 'error', unitName: builderName,
        key: 'build_menu_reference', title: `${builderName} · unknown roster unit`,
        message: `Build Menu operation references "${unitId}", which is not available in the current project.`,
        action: { type: 'build-menu', builderId, label: 'Repair roster' },
      }));
    });
    addIds.filter(unitId => disabledIds.has(unitId)).forEach(unitId => {
      issues.push(issue({
        id: `roster-${builderId}-${unitId}-disabled`, unitName: builderName,
        key: 'build_menu_disabled_unit', title: `${builderName} · disabled unit in roster`,
        message: `"${unitId}" is added to this roster but is also disabled project-wide.`,
        action: { type: 'build-menu', builderId, label: 'Review roster' },
      }));
    });
    const roster = effectiveRoster(builderId, activeFactoryRosters, step);
    const staleOrder = stableUnique((step.order || []).filter(unitId => !roster.includes(cleanId(unitId))));
    if (staleOrder.length) {
      issues.push(issue({
        id: `roster-${builderId}-order`, unitName: builderName,
        key: 'build_menu_order', title: `${builderName} · stale production order`,
        message: `${staleOrder.join(', ')} ${staleOrder.length === 1 ? 'is' : 'are'} ordered but not present in the effective roster.`,
        action: { type: 'build-menu', builderId, label: 'Repair ordering' },
      }));
    }
  });

  const blueprintMap = new Map();
  const blueprintUsage = new Map();
  weaponLibrary.forEach(blueprint => {
    const blueprintId = cleanId(blueprint.id);
    if (blueprintMap.has(blueprintId)) {
      issues.push(issue({
        id: `weapon-${blueprintId}-duplicate`, level: 'error', unitName: blueprint.name || blueprintId,
        key: 'weapon_library_id', title: `${blueprint.name || blueprintId} · duplicate weapon ID`,
        message: 'Two saved custom weapons share the same project identifier.',
        action: { type: 'weapon-lab', blueprintId, label: 'Open Weapon Lab' },
      }));
    }
    blueprintMap.set(blueprintId, blueprint);
    blueprintUsage.set(blueprintId, []);
  });

  clones.forEach(clone => {
    const cloneId = cleanId(clone.newId);
    const rootId = cleanId(resolveCloneRootId(cloneId));
    const rootSlots = defaultsDb?.[rootId]?.weaponSlots || [];
    Object.entries(clone.weaponSwaps || {}).forEach(([slotNumber, swap]) => {
      const libraryId = cleanId(swap?.libraryWeaponId);
      if (!rootSlots.some(slot => Number(slot.slot) === Number(slotNumber))) {
        issues.push(issue({
          id: `weapon-${cloneId}-${slotNumber}-slot`, level: 'error', unitId: cloneId, unitName: clone.displayName || clone.newId,
          key: `weapon_slot_${slotNumber}`, title: `${clone.displayName || clone.newId} · missing weapon slot`,
          message: `Weapon substitution targets slot ${slotNumber}, which does not exist on the clone's root chassis.`,
          action: { type: 'unit', unitId: cloneId, label: 'Open weapons' },
        }));
      }
      if (libraryId) {
        if (!blueprintMap.has(libraryId)) {
          issues.push(issue({
            id: `weapon-${cloneId}-${slotNumber}-missing-library`, level: 'error', unitId: cloneId, unitName: clone.displayName || clone.newId,
            key: `weapon_slot_${slotNumber}`, title: `${clone.displayName || clone.newId} · missing custom weapon`,
            message: `Slot ${slotNumber} references deleted or unavailable weapon blueprint "${swap.libraryWeaponId}".`,
            action: { type: 'unit', unitId: cloneId, label: 'Replace weapon' },
          }));
        } else {
          blueprintUsage.get(libraryId).push({ cloneId, slotNumber });
        }
      }
      const sourceExists = defaultsDb?.[cleanId(swap?.sourceUnitId)]?.weaponSlots?.some(
        slot => cleanId(slot.defKey) === cleanId(swap?.sourceWeaponDefKey)
      );
      if (!sourceExists) {
        issues.push(issue({
          id: `weapon-${cloneId}-${slotNumber}-source`, level: 'error', unitId: cloneId, unitName: clone.displayName || clone.newId,
          key: `weapon_slot_${slotNumber}`, title: `${clone.displayName || clone.newId} · unavailable donor weapon`,
          message: `The donor ${swap?.sourceUnitId || 'unit'}:${swap?.sourceWeaponDefKey || 'weapon'} is not present in the loaded BAR snapshot.`,
          action: { type: 'unit', unitId: cloneId, label: 'Choose another weapon' },
        }));
      }
    });
  });

  weaponLibrary.forEach(blueprint => {
    const blueprintId = cleanId(blueprint.id);
    const used = (blueprintUsage.get(blueprintId) || []).length > 0;
    validateWeaponBlueprint(blueprint).forEach((problem, index) => {
      issues.push(issue({
        id: `weapon-${blueprintId}-${problem.field}-${index}`,
        level: used ? 'error' : 'warning', unitName: blueprint.name || blueprintId,
        key: `weapon_blueprint_${problem.field}`, title: `${blueprint.name || blueprintId} · invalid blueprint`,
        message: problem.message,
        action: { type: 'weapon-lab', blueprintId, label: 'Repair weapon' },
      }));
    });
    if (!blueprintSourceExists(blueprint, defaultsDb)) {
      issues.push(issue({
        id: `weapon-${blueprintId}-source`, level: used ? 'error' : 'warning', unitName: blueprint.name || blueprintId,
        key: 'weapon_blueprint_source', title: `${blueprint.name || blueprintId} · source no longer resolves`,
        message: `Source ${blueprint.sourceUnitId || 'unit'}:${blueprint.sourceWeaponDefKey || 'weapon'} is missing from the current BAR snapshot.`,
        action: { type: 'weapon-lab', blueprintId, label: 'Choose a new source' },
      }));
    }
    if (!used) {
      issues.push(issue({
        id: `weapon-${blueprintId}-unused`, level: 'info', unitName: blueprint.name || blueprintId,
        key: 'weapon_blueprint_usage', title: `${blueprint.name || blueprintId} · stored but not equipped`,
        message: 'This custom weapon remains safely in project storage but does not contribute to generated Lua.',
        action: { type: 'weapon-lab', blueprintId, label: 'Open Weapon Lab' },
      }));
    }
  });

  const supportingReachability = resolveSupportingWeaponDefReachability({
    definitions: supportingWeaponDefs,
    tweaks,
    clones,
    weaponLibrary,
  });
  supportingWeaponDefs.filter(definition => definition.enabled !== false).forEach(definition => {
    const destination = `${cleanId(definition.ownerUnitId)}:${cleanId(definition.key)}`;
    if (!supportingReachability.includedDestinations.has(destination)) {
      issues.push(issue({
        id: `support-${cleanId(definition.id) || destination}-unused`, level: 'info', unitId: cleanId(definition.ownerUnitId),
        unitName: definition.label || definition.key, key: 'supporting_weapondef_usage',
        title: `${definition.label || definition.key} · no detected consumer`,
        message: 'This definition remains in the project library but is omitted from generated Lua until a structured consumer references it.',
        action: { type: 'tweak-lab', label: 'Inspect WeaponDefs' },
      }));
    }
  });

  Object.entries(tweaks).forEach(([unitId, patch]) => {
    const unitName = allUnitsList.find(unit => cleanId(unit.id) === cleanId(unitId))?.name
      || cloneMap.get(cleanId(unitId))?.displayName || unitId;
    validateCarrierLists({ unitId: cleanId(unitId), unitName, patch, issues });
  });

  if (!includeTweaks && Object.keys(tweaks).length > 0) {
    issues.push(issue({
      id: 'export-tweaks-disabled', unitName: 'Export settings', key: 'include_tweaks',
      title: 'Parameter changes are excluded from export',
      message: `${Object.keys(tweaks).length} edited ${Object.keys(tweaks).length === 1 ? 'unit is' : 'units are'} stored but Parameter tweaks is disabled.`,
      action: { type: 'review-settings', label: 'Review export settings' },
    }));
  }
  if (!includeClones && clones.length > 0) {
    issues.push(issue({
      id: 'export-clones-disabled', level: buildMenuSteps.some(step => (step.add || []).some(id => cloneMap.has(cleanId(id)))) ? 'error' : 'warning',
      unitName: 'Export settings', key: 'include_clones', title: 'Custom units are excluded from export',
      message: `${clones.length} custom ${clones.length === 1 ? 'unit is' : 'units are'} stored, but clone compilation is disabled.`,
      action: { type: 'review-settings', label: 'Review export settings' },
    }));
  }
  if (!includeRosters && buildMenuSteps.length > 0) {
    issues.push(issue({
      id: 'export-rosters-disabled', unitName: 'Export settings', key: 'include_rosters',
      title: 'Build Menu changes are excluded from export',
      message: `${buildMenuSteps.length} roster ${buildMenuSteps.length === 1 ? 'operation is' : 'operations are'} stored but Build menus is disabled.`,
      action: { type: 'review-settings', label: 'Review export settings' },
    }));
  }

  return [...new Map(issues.map(entry => [entry.id, entry])).values()];
}
