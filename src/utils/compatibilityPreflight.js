const LEVEL_ORDER = Object.freeze({ blocker: 0, warning: 1, info: 2, pass: 3 });

const GROUP_META = Object.freeze({
  project: { label: 'Project values', order: 0 },
  delivery: { label: 'Lobby delivery', order: 1 },
  modules: { label: 'Imported modules', order: 2 },
  dependencies: { label: 'Dependencies', order: 3 },
  contracts: { label: 'BAR runtime contracts', order: 4 },
  workspaces: { label: 'Cross-workspace links', order: 5 },
  assets: { label: 'Assets & runtime', order: 6 },
});

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function activeModuleIds(modules) {
  return new Set((modules || [])
    .filter(module => module.enabled && !module.converted)
    .map(module => module.id));
}

function moduleName(modules, moduleId) {
  return modules.find(module => module.id === moduleId)?.label || moduleId || 'Imported module';
}

function issueTouchesActiveModules(issue, activeIds) {
  const ids = issue?.moduleIds || [issue?.moduleId].filter(Boolean);
  return ids.length > 0 && ids.every(moduleId => activeIds.has(moduleId));
}

function stableItems(items) {
  const deduped = [...new Map(items.map(item => [item.id, item])).values()];
  return deduped.sort((left, right) => (
    LEVEL_ORDER[left.level] - LEVEL_ORDER[right.level]
    || GROUP_META[left.group].order - GROUP_META[right.group].order
    || left.title.localeCompare(right.title)
  ));
}

export function levenshteinDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const matrix = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

export function findBestFuzzyMatch(target, candidatesSet, maxDist = 3) {
  const normTarget = String(target).toLowerCase();
  let bestCandidate = null;
  let minDistance = Infinity;

  for (const cand of candidatesSet) {
    const normCand = String(cand).toLowerCase();
    if (Math.abs(normCand.length - normTarget.length) > maxDist) continue;
    const dist = levenshteinDistance(normTarget, normCand);
    if (dist <= maxDist && dist < minDistance) {
      minDistance = dist;
      bestCandidate = cand;
    }
  }
  return bestCandidate ? { candidate: bestCandidate, distance: minDistance } : null;
}

export function buildCompatibilityPreflight({
  validationIssues = [],
  compiledModules,
  compilerValidation,
  tweakModules = [],
  packageAnalysis,
  lobbySetup,
  supportingWeaponDefs = [],
  knownUnitIds = [],
  gadgetContractResults = [],
} = {}) {
  const items = [];
  const add = (item) => items.push({ action: null, detail: '', ...item });
  const activeIds = activeModuleIds(tweakModules);
  const activeModules = tweakModules.filter(module => activeIds.has(module.id));
  const knownIds = new Set((knownUnitIds || []).map(unitId => String(unitId).toLowerCase()));

  const projectIssues = validationIssues.filter(issue => !['tweakdefs_slots', 'tweakunits_slots'].includes(issue.key));
  if (projectIssues.length === 0) {
    add({ id: 'project-values-clear', group: 'project', level: 'pass', title: 'Editor values validated', detail: 'No incompatible parameter values or unresolved editor references were detected.' });
  } else {
    projectIssues.forEach((issue, index) => add({
      id: `project-${issue.unitId || 'project'}-${issue.key || index}-${index}`,
      group: issue.group && GROUP_META[issue.group] ? issue.group : 'project',
      level: issue.level === 'error' ? 'blocker' : issue.level === 'info' ? 'info' : 'warning',
      title: issue.title || `${issue.unitName || issue.unitId || 'Project'} · ${String(issue.key || 'validation').replaceAll('_', ' ')}`,
      detail: issue.message,
      action: issue.action || (issue.unitId && issue.unitId !== 'project' ? { type: 'unit', unitId: issue.unitId, label: 'Open unit' } : null),
    }));
  }

  const completeContracts = gadgetContractResults.filter(result => result.problems.length === 0);
  completeContracts.forEach(result => add({
    id: `contract-${result.id}`,
    group: 'contracts',
    level: result.status === 'experimental' ? 'info' : 'pass',
    title: `${result.unitName} · ${result.label}`,
    detail: `${result.slotNumber === null ? 'Unit contract' : `Weapon slot ${result.slotNumber}`} matches registry v${result.source.commit.slice(0, 8)} for the pinned BAR snapshot${result.status === 'experimental' ? '; runtime behavior remains experimental' : ''}.`,
    action: { type: 'unit', unitId: result.unitId, label: 'Open unit' },
  }));
  if (gadgetContractResults.length === 0) {
    add({
      id: 'contracts-none', group: 'contracts', level: 'pass',
      title: 'No structured BAR gadget contracts detected',
      detail: 'The current edited project does not activate a registered spawner, carrier, cluster, sector-fire, interception, or converter contract.',
    });
  }

  const deliveryGroups = [
    ['defs', 'Definitions'],
    ['units', 'Units'],
  ];
  deliveryGroups.forEach(([key, label]) => {
    const group = compiledModules?.[key] || { required: 0, maximum: 9, overflow: false, slots: [] };
    if (group.overflow) {
      add({
        id: `delivery-${key}-overflow`, group: 'delivery', level: 'blocker',
        title: `${label} exceed BAR's numbered fields`,
        detail: `${group.required} slots are required, but BAR provides exactly ${group.maximum || 9}. Disable modules or reduce generated blocks before copying commands.`,
        action: { type: 'tweak-lab', label: 'Review modules' },
      });
    } else {
      const nearCapacity = group.required >= Math.max(1, (group.maximum || 9) - 1);
      add({
        id: `delivery-${key}-capacity`, group: 'delivery', level: nearCapacity ? 'warning' : 'pass',
        title: `${label} slots ${group.required} / ${group.maximum || 9}`,
        detail: nearCapacity
          ? 'The package fits, but little numbered-field capacity remains for additional modules.'
          : 'Generated and imported blocks fit within BAR’s numbered lobby fields.',
      });
    }
  });
  const advisorySlots = (compiledModules?.slots || []).filter(slot => slot.compatibility === 'advisory');
  if (advisorySlots.length) {
    add({
      id: 'delivery-size-advisory', group: 'delivery', level: 'warning',
      title: `${advisorySlots.length} large lobby ${advisorySlots.length === 1 ? 'field' : 'fields'}`,
      detail: `${advisorySlots.map(slot => `${slot.fieldName} (${slot.encodedBytes.toLocaleString()} B)`).join(', ')} exceed the editor’s 12,000-character legacy advisory. BAR does not publish this as a hard limit; test the lobby path you plan to use.`,
    });
  }
  if (!compiledModules?.overflow && (compiledModules?.slots || []).length > 0) {
    add({
      id: 'delivery-order', group: 'delivery', level: 'pass', title: 'Definition order is deterministic',
      detail: 'All tweakdefs fields are emitted before tweakunits fields, with stable before-editor and after-editor module ordering.',
    });
  }
  if (compilerValidation?.issues?.length) {
    compilerValidation.issues.forEach(issue => add({
      id: issue.id,
      group: 'delivery',
      level: issue.level,
      title: issue.fieldName
        ? `${issue.fieldName} · ${issue.code.replaceAll('-', ' ')}`
        : `Compiler · ${issue.code.replaceAll('-', ' ')}`,
      detail: issue.message,
      action: issue.source === 'imported' ? { type: 'tweak-lab', label: 'Inspect module' } : null,
    }));
  } else if (compilerValidation?.isValid) {
    add({
      id: 'delivery-semantic-clear',
      group: 'delivery',
      level: 'pass',
      title: 'Compiled Lua is structurally valid',
      detail: `${compilerValidation.checkedBlockCount} canonical blocks and ${compilerValidation.checkedSlotCount} lobby slots passed Lua 5.1 syntax, ownership, packing, numbering, and payload-integrity checks.`,
    });
  }
  if (compiledModules?.deduplication?.removedBlockCount > 0) {
    const deduplication = compiledModules.deduplication;
    add({
      id: 'delivery-safe-deduplication',
      group: 'delivery',
      level: 'info',
      title: `${deduplication.removedBlockCount} exact ${deduplication.removedBlockCount === 1 ? 'duplicate' : 'duplicates'} safely collapsed`,
      detail: `${deduplication.rawBytesSaved.toLocaleString()} raw bytes and ${deduplication.encodedBytesSaved.toLocaleString()} encoded bytes were removed${deduplication.slotsSaved ? `, saving ${deduplication.slotsSaved} numbered ${deduplication.slotsSaved === 1 ? 'slot' : 'slots'}` : ''}. Original block provenance remains available for validation.`,
    });
  }

  const analyses = packageAnalysis?.analyses || new Map();
  const activeBlockingIssues = (packageAnalysis?.blockingIssues || []).filter(issue => issueTouchesActiveModules(issue, activeIds));
  activeBlockingIssues.forEach((issue, index) => {
    const labels = unique((issue.moduleIds || []).map(moduleId => moduleName(tweakModules, moduleId)));
    const content = issue.code === 'syntax'
      ? { title: 'Lua syntax cannot be parsed', detail: `${labels.join(', ')} contains invalid Lua and cannot be considered loadable.` }
      : issue.code === 'duplicate-unit-id'
        ? { title: `Duplicate UnitDef ${issue.unitId}`, detail: `${labels.join(' and ')} create the same destination ID. The result depends on overwrite order.` }
        : { title: 'Dependency crosses compiler lanes', detail: `${labels.join(' and ')} cannot be placed in a safe provider-before-consumer order.` };
    add({
      id: `module-blocker-${issue.code}-${issue.unitId || index}-${labels.join('-')}`,
      group: issue.code === 'syntax' ? 'modules' : 'dependencies', level: 'blocker',
      ...content, action: { type: 'tweak-lab', label: 'Open Tweak Lab' },
    });
  });

  activeModules.forEach(module => {
    const analysis = analyses.get(module.id);
    if (!analysis) return;
    analysis.warnings
      .filter(warning => warning.code !== 'syntax')
      .forEach(warning => add({
        id: `module-warning-${module.id}-${warning.code}`, group: warning.code === 'asset-swap' ? 'assets' : 'modules',
        level: warning.level === 'error' ? 'blocker' : 'warning',
        title: `${module.label} · ${warning.code.replaceAll('-', ' ')}`,
        detail: warning.message,
        action: { type: 'tweak-lab', label: 'Inspect source' },
      }));
    if (analysis.unknownCustomParameters.length) {
      add({
        id: `module-unknown-params-${module.id}`, group: 'modules', level: 'info',
        title: `${module.label} uses unrecognized custom parameters`,
        detail: analysis.unknownCustomParameters.slice(0, 8).join(', ') + (analysis.unknownCustomParameters.length > 8 ? ` and ${analysis.unknownCustomParameters.length - 8} more` : ''),
        action: { type: 'tweak-lab', label: 'Inspect module' },
      });
    }
  });

  if (activeModules.length === 0) {
    add({ id: 'modules-none', group: 'modules', level: 'pass', title: 'No raw pass-through modules enabled', detail: 'The current output is generated entirely from structured editor state.' });
  } else if (!activeBlockingIssues.some(issue => issue.code === 'syntax')) {
    add({
      id: 'modules-syntax-clear', group: 'modules', level: 'pass',
      title: `${activeModules.length} raw ${activeModules.length === 1 ? 'module parses' : 'modules parse'}`,
      detail: 'Static Lua 5.1 parsing completed. This confirms syntax only, not engine behavior.',
    });
  }

  const activeReports = (packageAnalysis?.moduleReports || []).filter(report => activeIds.has(report.moduleId));
  activeReports.forEach(report => {
    const label = moduleName(tweakModules, report.moduleId);
    if (report.unresolved.length) add({
      id: `dependencies-unresolved-${report.moduleId}`, group: 'dependencies', level: 'warning',
      title: `${label} has ${report.unresolved.length} unresolved UnitDef ${report.unresolved.length === 1 ? 'reference' : 'references'}`,
      detail: report.unresolved.slice(0, 8).map(item => item.unitId).join(', ') + (report.unresolved.length > 8 ? ` and ${report.unresolved.length - 8} more` : ''),
      action: { type: 'tweak-lab', label: 'Review dependencies' },
    });
    if (report.orderingIssues.length) add({
      id: `dependencies-order-${report.moduleId}`, group: 'dependencies', level: 'warning',
      title: `${label} loads before a detected provider`,
      detail: 'Apply the safe recommended order in Tweak Package Lab, or verify that the dependency is supplied externally.',
      action: { type: 'tweak-lab', label: 'Apply safe order' },
    });
    if (report.typeIssues.length) add({
      id: `modules-types-${report.moduleId}`, group: 'modules', level: 'warning',
      title: `${label} has ${report.typeIssues.length} literal type ${report.typeIssues.length === 1 ? 'mismatch' : 'mismatches'}`,
      detail: report.typeIssues.slice(0, 4).map(issue => `${issue.field}: ${issue.actualType} → ${issue.expectedType}`).join(' · '),
      action: { type: 'tweak-lab', label: 'Review values' },
    });
    report.runtimeRisks.forEach(risk => add({
      id: `runtime-${report.moduleId}-${risk.code}`, group: 'assets', level: 'warning',
      title: `${label} · ${risk.code.replaceAll('-', ' ')}`,
      detail: `${risk.message} ${risk.count} detected ${risk.count === 1 ? 'location' : 'locations'}.`,
      action: { type: 'tweak-lab', label: 'Inspect lines' },
    }));
    if (report.assetReferences.length) add({
      id: `assets-${report.moduleId}`, group: 'assets', level: 'warning',
      title: `${label} has ${report.assetReferences.length} unverified asset ${report.assetReferences.length === 1 ? 'path' : 'paths'}`,
      detail: 'Static analysis found model, script, picture, sound, or effect paths. Confirm them against the same BAR release used by the lobby.',
      action: { type: 'tweak-lab', label: 'Review assets' },
    });
  });

  // Fuzzy UnitDef Typo Spell-Checker & Un-guarded Nil-Indexing Analysis
  if (knownIds.size > 0) {
    activeModules.forEach(module => {
      const code = module.rawLua || '';
      if (!code) return;
      const label = module.label || 'Module';

      // 1. Scan for string literals in Lua code (e.g. 'oor_doomt3', 'raptor_turret_basic_t3s_v1')
      const literalMatches = unique([...code.matchAll(/['"]([a-z0-9_]{4,35})['"]/gi)].map(m => m[1].toLowerCase()));
      literalMatches.forEach(literal => {
        // Skip common keywords / non-unit strings
        if (['deflector', 'forti', 'gantry', 'subfolder', 'unitgroup', 'buildert3', 'nanotct2', 'nanotct3'].includes(literal)) return;

        if (!knownIds.has(literal)) {
          const match = findBestFuzzyMatch(literal, knownIds, 3);
          if (match && match.candidate !== literal) {
            add({
              id: `fuzzy-typo-${module.id}-${literal}`,
              group: 'modules',
              level: 'warning',
              title: `${label} · UnitDef Typo "${literal}"`,
              detail: `The unit ID "${literal}" was not found in BAR catalog. Did you mean "${match.candidate}"?`,
              action: { type: 'tweak-lab', label: `Fix "${literal}" → "${match.candidate}"`, target: literal, replacement: match.candidate },
            });
          }
        }
      });

      // 2. Scan for un-guarded nil indexing patterns like a['key'] = b(a['other_key'], ...)
      const unguardedAccess = [...code.matchAll(/([a-zA-Z0-9_]+)\[['"]([a-zA-Z0-9_]+)['"]\]\s*=/g)];
      unguardedAccess.forEach(match => {
        const [, varName, key] = match;
        if (!knownIds.has(key) && !code.includes(`if ${varName}[`)) {
          add({
            id: `nil-risk-${module.id}-${key}`,
            group: 'modules',
            level: 'warning',
            title: `${label} · Crash Risk (Un-guarded nil index "${key}")`,
            detail: `Code accesses ${varName}['${key}'] without verifying if the unit exists. If '${key}' is missing, this causes an immediate game crash.`,
            action: { type: 'tweak-lab', label: 'Inspect source' },
          });
        }
      });
    });
  }

  const activeCycles = (packageAnalysis?.cycles || []).filter(cycle => cycle.every(moduleId => activeIds.has(moduleId)));
  activeCycles.forEach((cycle, index) => add({
    id: `dependencies-cycle-${index}-${cycle.join('-')}`, group: 'dependencies', level: 'warning',
    title: 'Circular module dependency detected',
    detail: cycle.map(moduleId => moduleName(tweakModules, moduleId)).join(' → '),
    action: { type: 'tweak-lab', label: 'Review order' },
  }));

  const activeRequirements = unique([
    ...(lobbySetup?.requirements || []),
    ...activeModules.flatMap(module => module.requirements || []),
  ]);
  if (activeRequirements.includes('forceallunits')) {
    add({
      id: 'requirement-forceallunits', group: 'dependencies', level: 'warning',
      title: 'Force-load all units is required',
      detail: 'Enable Force-load all units manually in the BAR lobby before starting. BAR Editor intentionally does not write this lobby option.',
    });
  } else {
    add({ id: 'requirements-clear', group: 'dependencies', level: 'pass', title: 'No manual lobby dependency declared', detail: 'The imported package does not declare Force-load all units or another external lobby requirement.' });
  }

  if (lobbySetup?.commands?.length) {
    add({
      id: 'lobby-setup-preserved', group: 'delivery', level: 'info',
      title: `${lobbySetup.commands.length} imported lobby ${lobbySetup.commands.length === 1 ? 'setting is' : 'settings are'} preserved separately`,
      detail: 'These settings are retained for inspection but are not silently mixed into the numbered tweak command copy.',
      action: { type: 'tweak-lab', label: 'Review lobby setup' },
    });
  }

  const enabledSupportingDefs = supportingWeaponDefs.filter(definition => definition.enabled !== false);
  const destinations = new Map();
  enabledSupportingDefs.forEach(definition => {
    const destination = `${String(definition.ownerUnitId || '').toLowerCase()}:${String(definition.key || '').toLowerCase()}`;
    destinations.set(destination, [...(destinations.get(destination) || []), definition]);
    if (!definition.ownerUnitId || !definition.key || !definition.definition || typeof definition.definition !== 'object') {
      add({
        id: `support-invalid-${definition.id}`, group: 'dependencies', level: 'blocker',
        title: 'Supporting WeaponDef is incomplete',
        detail: `${definition.label || definition.id} needs an owner UnitDef, a definition key, and a literal object before export.`,
        action: { type: 'tweak-lab', label: 'Repair definition' },
      });
    } else if (knownIds.size && !knownIds.has(String(definition.ownerUnitId).toLowerCase())) {
      add({
        id: `support-owner-${definition.id}`, group: 'dependencies', level: 'warning',
        title: `Unknown WeaponDef owner ${definition.ownerUnitId}`,
        detail: `${definition.label || definition.key} targets an owner that is not present in the loaded BAR snapshot or current clone set.`,
        action: { type: 'tweak-lab', label: 'Review definition' },
      });
    }
  });
  [...destinations.entries()].filter(([, definitions]) => definitions.length > 1).forEach(([destination, definitions]) => add({
    id: `support-duplicate-${destination}`, group: 'dependencies', level: 'blocker',
    title: `Duplicate supporting WeaponDef ${destination}`,
    detail: `${definitions.length} enabled library entries write to the same owner and key. Keep one definition or use distinct keys.`,
    action: { type: 'tweak-lab', label: 'Resolve duplicate' },
  }));
  if (enabledSupportingDefs.length && !items.some(item => item.id.startsWith('support-'))) {
    add({
      id: 'support-clear', group: 'dependencies', level: 'pass',
      title: `${enabledSupportingDefs.length} supporting WeaponDef ${enabledSupportingDefs.length === 1 ? 'destination is' : 'destinations are'} unique`,
      detail: 'Every enabled auxiliary definition has one owner-and-key destination.',
    });
  }

  const orderedItems = stableItems(items);
  const counts = orderedItems.reduce((summary, item) => ({ ...summary, [item.level]: summary[item.level] + 1 }), {
    blocker: 0, warning: 0, info: 0, pass: 0,
  });
  const status = counts.blocker ? 'blocked' : counts.warning ? 'review' : 'ready';
  const groups = Object.entries(GROUP_META).map(([id, meta]) => ({
    id,
    ...meta,
    items: orderedItems.filter(item => item.group === id),
  })).filter(group => group.items.length > 0);

  return {
    status,
    canCopyLobbyCommands: counts.blocker === 0,
    counts,
    items: orderedItems,
    groups,
    activeModuleCount: activeModules.length,
    checkedSlotCount: compiledModules?.slots?.length || 0,
  };
}

export { GROUP_META as COMPATIBILITY_GROUPS };
