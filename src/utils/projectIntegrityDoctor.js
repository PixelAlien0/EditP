function cleanId(value) {
  return String(value || '').trim().toLowerCase();
}

function stableUnique(values) {
  return [...new Set((values || []).map(cleanId).filter(Boolean))];
}

function sameValues(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function finding({ id, category, severity = 'warning', title, detail, action = null, repair = null }) {
  return Object.freeze({
    id: `integrity-${id}`,
    category,
    severity,
    title,
    detail,
    action,
    repair,
  });
}

function knownUnitIds(project, allUnitsList) {
  return new Set([
    ...(allUnitsList || []).map(unit => cleanId(unit?.id)),
    ...(project.clones || []).map(clone => cleanId(clone?.newId)),
  ].filter(Boolean));
}

function normalizeRosterStep(step, knownIds, activeFactoryRosters) {
  const builderId = cleanId(step?.builderId);
  if (!builderId || !knownIds.has(builderId)) return null;
  const add = stableUnique(step.add).filter(unitId => knownIds.has(unitId));
  const addSet = new Set(add);
  const remove = stableUnique(step.remove)
    .filter(unitId => knownIds.has(unitId) && !addSet.has(unitId));
  const removedSet = new Set(remove);
  const effectiveRoster = new Set([
    ...((activeFactoryRosters?.[builderId] || []).map(cleanId).filter(unitId => !removedSet.has(unitId))),
    ...add,
  ]);
  const order = stableUnique(step.order).filter(unitId => effectiveRoster.has(unitId));
  if (add.length === 0 && remove.length === 0 && order.length === 0) return null;
  return { ...step, builderId, add, remove, order };
}

function cleanRosterSteps(project, context) {
  const knownIds = knownUnitIds(project, context.allUnitsList);
  const normalized = (project.buildMenuSteps || [])
    .map(step => normalizeRosterStep(step, knownIds, context.activeFactoryRosters))
    .filter(Boolean);
  return normalized;
}

function synchronizeCloneProducers(project, context, initialSteps = project.buildMenuSteps || []) {
  const knownIds = knownUnitIds(project, context.allUnitsList);
  const nextSteps = initialSteps.map(step => ({
    ...step,
    add: [...(step.add || [])],
    remove: [...(step.remove || [])],
    order: [...(step.order || [])],
  }));
  const rosterBuildersByClone = new Map();
  const removedBuildersByClone = new Map();
  nextSteps.forEach(step => {
    const builderId = cleanId(step.builderId);
    (step.add || []).forEach(unitId => {
      const cloneId = cleanId(unitId);
      if (!rosterBuildersByClone.has(cloneId)) rosterBuildersByClone.set(cloneId, []);
      rosterBuildersByClone.get(cloneId).push(builderId);
    });
    (step.remove || []).forEach(unitId => {
      const cloneId = cleanId(unitId);
      if (!removedBuildersByClone.has(cloneId)) removedBuildersByClone.set(cloneId, new Set());
      removedBuildersByClone.get(cloneId).add(builderId);
    });
  });

  const clones = (project.clones || []).map(clone => {
    const cloneId = cleanId(clone.newId);
    const explicitlyRemoved = removedBuildersByClone.get(cloneId) || new Set();
    const declared = stableUnique(clone.builderIds)
      .filter(builderId => knownIds.has(builderId) && !explicitlyRemoved.has(builderId));
    const roster = stableUnique(rosterBuildersByClone.get(cloneId)).filter(builderId => knownIds.has(builderId));
    const builders = stableUnique([...declared, ...roster]);
    builders.forEach(builderId => {
      let step = nextSteps.find(entry => cleanId(entry.builderId) === builderId);
      if (!step) {
        step = { builderId, add: [], remove: [], order: [] };
        nextSteps.push(step);
      }
      if (!step.add.some(unitId => cleanId(unitId) === cloneId)) step.add.push(cloneId);
      step.remove = step.remove.filter(unitId => cleanId(unitId) !== cloneId);
    });
    return sameValues(stableUnique(clone.builderIds), builders)
      ? clone
      : { ...clone, builderIds: builders };
  });

  return {
    clones,
    buildMenuSteps: nextSteps.filter(step => (
      step.add.length > 0 || step.remove.length > 0 || step.order.length > 0
    )),
  };
}

function invalidWeaponSwapSlots(project, context) {
  const blueprintIds = new Set((project.weaponLibrary || []).map(blueprint => cleanId(blueprint.id)));
  const invalid = [];
  (project.clones || []).forEach(clone => {
    const cloneId = cleanId(clone.newId);
    const rootId = cleanId(context.resolveCloneRootId?.(cloneId) || clone.baseId);
    const rootSlots = context.defaultsDb?.[rootId]?.weaponSlots || [];
    Object.entries(clone.weaponSwaps || {}).forEach(([slotNumber, swap]) => {
      const slotExists = rootSlots.some(slot => Number(slot.slot) === Number(slotNumber));
      const libraryId = cleanId(swap?.libraryWeaponId);
      const libraryExists = !libraryId || blueprintIds.has(libraryId);
      const donorExists = context.defaultsDb?.[cleanId(swap?.sourceUnitId)]?.weaponSlots?.some(
        slot => cleanId(slot.defKey) === cleanId(swap?.sourceWeaponDefKey)
      );
      if (!slotExists || !libraryExists || !donorExists) {
        invalid.push({ cloneId, slotNumber: String(slotNumber), slotExists, libraryExists, donorExists });
      }
    });
  });
  return invalid;
}

function collectSpawnedUnitIds(project) {
  const spawned = new Set();
  Object.values(project.tweaks || {}).forEach(unitTweaks => {
    Object.entries(unitTweaks || {}).forEach(([key, value]) => {
      const normalizedKey = cleanId(key);
      if (normalizedKey === 'customparams.carried_unit'
        || /^weapon_slot_\d+_(?:spawns_name|carried_unit)$/.test(normalizedKey)) {
        stableUnique(String(value || '').split(/[\s,;]+/)).forEach(unitId => spawned.add(unitId));
      }
    });
  });
  return spawned;
}

export function analyzeProjectIntegrity({ project = {}, context = {} } = {}) {
  const findings = [];
  const knownIds = knownUnitIds(project, context.allUnitsList);
  const cleanedSteps = cleanRosterSteps(project, context);
  if (!sameValues(project.buildMenuSteps || [], cleanedSteps)) {
    const missingProducers = (project.buildMenuSteps || []).filter(step => !knownIds.has(cleanId(step.builderId))).length;
    findings.push(finding({
      id: 'build-menu-cleanup', category: 'Build menus', severity: 'error',
      title: 'Build Menu graph contains stale operations',
      detail: `${missingProducers ? `${missingProducers} missing producer ${missingProducers === 1 ? 'entry' : 'entries'}, plus ` : ''}unknown units, contradictory add/remove operations, and stale ordering can be pruned without changing valid roster choices.`,
      action: { type: 'build-menu', label: 'Review Build Menus' },
      repair: { id: 'clean-build-menus', label: 'Clean Build Menus', safety: 'safe' },
    }));
  }

  const synchronized = synchronizeCloneProducers({ ...project, buildMenuSteps: cleanedSteps }, context, cleanedSteps);
  const spawnedUnitIds = collectSpawnedUnitIds(project);
  if (!sameValues(project.clones || [], synchronized.clones)
    || !sameValues(cleanedSteps, synchronized.buildMenuSteps)) {
    findings.push(finding({
      id: 'producer-sync', category: 'Clone production', severity: 'error',
      title: 'Clone producer assignments are out of sync',
      detail: 'The Doctor can preserve every valid assignment from Clone Identity and Build Menus, then write the union back to both workspaces.',
      action: { type: 'build-menu', label: 'Review producers' },
      repair: { id: 'sync-clone-producers', label: 'Synchronize producers', safety: 'safe' },
    }));
  }

  const invalidSwaps = invalidWeaponSwapSlots(project, context);
  if (invalidSwaps.length > 0) {
    findings.push(finding({
      id: 'invalid-weapon-swaps', category: 'Weapons', severity: 'error',
      title: `${invalidSwaps.length} weapon ${invalidSwaps.length === 1 ? 'substitution is' : 'substitutions are'} unresolved`,
      detail: 'The affected slots reference a missing chassis slot, deleted library weapon, or unavailable donor. Restoring those slots removes only the broken substitution and returns to the inherited chassis weapon.',
      action: { type: 'unit', unitId: invalidSwaps[0].cloneId, label: 'Review weapon' },
      repair: { id: 'restore-invalid-weapon-swaps', label: 'Restore affected slots', safety: 'safe' },
    }));
  }

  const staleDisabled = stableUnique(project.disabledUnitIds).filter(unitId => !knownIds.has(unitId));
  const staleDescriptions = Object.keys(project.unitDescriptions || {}).filter(unitId => !knownIds.has(cleanId(unitId)));
  if (staleDisabled.length > 0 || staleDescriptions.length > 0) {
    findings.push(finding({
      id: 'stale-unit-records', category: 'Project records',
      title: 'Deleted units still have project records',
      detail: `${staleDisabled.length} disabled-state and ${staleDescriptions.length} description ${staleDescriptions.length === 1 ? 'record' : 'records'} no longer resolve to a BAR unit or project clone.`,
      repair: { id: 'remove-stale-unit-records', label: 'Remove stale records', safety: 'safe' },
    }));
  }

  const missingSupportingOwners = (project.supportingWeaponDefs || [])
    .filter(definition => definition.enabled !== false && !knownIds.has(cleanId(definition.ownerUnitId)));
  if (missingSupportingOwners.length > 0) {
    findings.push(finding({
      id: 'supporting-owners', category: 'Supporting WeaponDefs', severity: 'error',
      title: `${missingSupportingOwners.length} supporting ${missingSupportingOwners.length === 1 ? 'definition has' : 'definitions have'} no owner`,
      detail: 'Definitions whose owning UnitDef was deleted can be disabled so they stop contributing invalid Lua while remaining available for inspection.',
      action: { type: 'tweak-lab', label: 'Inspect WeaponDefs' },
      repair: { id: 'disable-ownerless-supporting-defs', label: 'Disable ownerless definitions', safety: 'safe' },
    }));
  }

  (project.clones || []).forEach(clone => {
    const cloneId = cleanId(clone.newId);
    const hasProduction = synchronized.clones
      .find(entry => cleanId(entry.newId) === cloneId)?.builderIds?.length > 0;
    if (!hasProduction && !spawnedUnitIds.has(cloneId)) {
      findings.push(finding({
        id: `clone-${cloneId}-unassigned`, category: 'Clone production',
        title: `${clone.displayName || clone.newId} has no normal production path`,
        detail: 'Choosing a producer changes gameplay intent, so this requires a manual assignment rather than an automatic repair.',
        action: { type: 'build-menu', unitId: cloneId, label: 'Assign producer' },
      }));
    }
  });

  const severityOrder = { error: 0, warning: 1, info: 2 };
  const ordered = findings.sort((left, right) => (
    severityOrder[left.severity] - severityOrder[right.severity]
    || left.category.localeCompare(right.category)
    || left.title.localeCompare(right.title)
  ));
  return Object.freeze({
    status: ordered.some(item => item.severity === 'error') ? 'repair' : ordered.length ? 'review' : 'healthy',
    findings: Object.freeze(ordered),
    repairableCount: ordered.filter(item => item.repair?.safety === 'safe').length,
    reviewCount: ordered.filter(item => !item.repair).length,
  });
}

export function repairProjectIntegrity(project = {}, context = {}, requestedRepairIds = []) {
  const requested = new Set(requestedRepairIds);
  const before = analyzeProjectIntegrity({ project, context });
  const permitted = new Set(before.findings
    .filter(item => item.repair?.safety === 'safe' && (requested.size === 0 || requested.has(item.repair.id)))
    .map(item => item.repair.id));
  let next = { ...project };
  const applied = [];

  if (permitted.has('clean-build-menus')) {
    next.buildMenuSteps = cleanRosterSteps(next, context);
    applied.push('clean-build-menus');
  }
  if (permitted.has('sync-clone-producers')) {
    const synchronized = synchronizeCloneProducers(next, context, next.buildMenuSteps || []);
    next = { ...next, ...synchronized };
    applied.push('sync-clone-producers');
  }
  if (permitted.has('restore-invalid-weapon-swaps')) {
    const invalid = new Set(invalidWeaponSwapSlots(next, context).map(item => `${item.cloneId}:${item.slotNumber}`));
    next.clones = (next.clones || []).map(clone => {
      const cloneId = cleanId(clone.newId);
      const weaponSwaps = Object.fromEntries(Object.entries(clone.weaponSwaps || {})
        .filter(([slotNumber]) => !invalid.has(`${cloneId}:${slotNumber}`)));
      return sameValues(weaponSwaps, clone.weaponSwaps || {}) ? clone : { ...clone, weaponSwaps };
    });
    applied.push('restore-invalid-weapon-swaps');
  }
  if (permitted.has('remove-stale-unit-records')) {
    const knownIds = knownUnitIds(next, context.allUnitsList);
    next.disabledUnitIds = stableUnique(next.disabledUnitIds).filter(unitId => knownIds.has(unitId));
    next.unitDescriptions = Object.fromEntries(Object.entries(next.unitDescriptions || {})
      .filter(([unitId]) => knownIds.has(cleanId(unitId))));
    applied.push('remove-stale-unit-records');
  }
  if (permitted.has('disable-ownerless-supporting-defs')) {
    const knownIds = knownUnitIds(next, context.allUnitsList);
    next.supportingWeaponDefs = (next.supportingWeaponDefs || []).map(definition => (
      definition.enabled !== false && !knownIds.has(cleanId(definition.ownerUnitId))
        ? { ...definition, enabled: false }
        : definition
    ));
    applied.push('disable-ownerless-supporting-defs');
  }

  return {
    project: next,
    applied,
    before,
    after: analyzeProjectIntegrity({ project: next, context }),
  };
}
