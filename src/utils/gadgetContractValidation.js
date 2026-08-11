import {
  GADGET_CONTRACT_REGISTRY,
  GADGET_CONTRACT_STATUS,
} from '../config/gadgetContracts.js';
import {
  SPECIAL_PROJECTILE_PARAMETERS,
  getSpecialProjectileBehavior,
} from '../config/specialProjectileBehaviors.js';

const WEAPON_CONTRACTS = GADGET_CONTRACT_REGISTRY.filter(contract => contract.scope === 'weapon');
const UNIT_CONTRACTS = GADGET_CONTRACT_REGISTRY.filter(contract => contract.scope === 'unit');
const CARRIER_LIST_KEYS = Object.freeze([
  'maxunits', 'startingdronecount', 'spawn_metal_cost', 'spawn_energy_cost',
  'droneairtime', 'dronedocktime', 'droneammo',
]);

function clean(value) {
  return String(value ?? '').trim();
}

function cleanId(value) {
  return clean(value).toLowerCase();
}

function hasValue(value) {
  return value !== undefined && value !== null && clean(value) !== '';
}

function hasActiveValue(value) {
  if (!hasValue(value)) return false;
  if (value === false || value === 0) return false;
  return !['false', 'off', 'no', '0'].includes(cleanId(value));
}

function numberValue(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function valueList(value) {
  return clean(value).split(/[\s,]+/).filter(Boolean);
}

function fieldLabel(key) {
  return key
    .replace('customparams.', '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, character => character.toUpperCase());
}

function resultStatus(contract, problems) {
  if (problems.some(problem => problem.kind === 'conflict')) return 'conflicting';
  if (problems.some(problem => problem.kind === 'missing' || problem.kind === 'invalid')) return 'incomplete';
  if (problems.some(problem => problem.kind === 'unknown')) return 'unknown';
  return contract.maturity === 'experimental' ? 'experimental' : 'ready';
}

function makeResult({ contract, unitId, unitName, slotNumber = null, values, problems }) {
  const status = resultStatus(contract, problems);
  return {
    id: `${unitId}:${contract.id}${slotNumber === null ? '' : `:${slotNumber}`}`,
    contractId: contract.id,
    label: contract.label,
    description: contract.description,
    scope: contract.scope,
    slotNumber,
    unitId,
    unitName,
    status,
    statusLabel: GADGET_CONTRACT_STATUS[status].label,
    tone: GADGET_CONTRACT_STATUS[status].tone,
    source: contract.source,
    values,
    problems,
  };
}

function validateRequired(contract, values, problems) {
  contract.requiredKeys.forEach(key => {
    if (!hasValue(values[key])) {
      problems.push({
        kind: 'missing',
        level: 'error',
        key,
        message: `${contract.label} requires ${fieldLabel(key)}.`,
        suggestedFix: `Set ${fieldLabel(key)} or clear the other ${contract.label} fields.`,
      });
    }
  });
}

function explicitContractKeys(contract, patch, slotNumber = null) {
  return contract.triggerKeys.filter(key => {
    const patchKey = slotNumber === null ? key : `weapon_slot_${slotNumber}_${key}`;
    return Object.prototype.hasOwnProperty.call(patch, patchKey) && hasActiveValue(patch[patchKey]);
  });
}

function validateOrphanedCompanions(contract, values, patch, slotNumber, problems) {
  const activationKeys = contract.activationKeys || [];
  if (activationKeys.length === 0) return false;
  const active = activationKeys.some(key => hasActiveValue(values[key]));
  if (active) return false;
  const configured = explicitContractKeys(contract, patch, slotNumber)
    .filter(key => !activationKeys.includes(key));
  if (configured.length === 0) return false;

  const activationKey = activationKeys[0];
  problems.push({
    kind: 'missing',
    level: 'warning',
    key: activationKey,
    companionKeys: configured,
    message: `${configured.map(fieldLabel).join(', ')} ${configured.length === 1 ? 'is' : 'are'} configured, but ${fieldLabel(activationKey)} is not active, so BAR will ignore this partial ${contract.label} setup.`,
    suggestedFix: `Set ${fieldLabel(activationKey)} or reset the inactive companion fields.`,
  });
  return true;
}

function validateUnitReferences({ key, value, knownUnitIds, problems }) {
  const missing = valueList(value)
    .map(cleanId)
    .filter(unitId => unitId && !knownUnitIds.has(unitId));
  if (missing.length > 0) {
    problems.push({
      kind: 'unknown',
      level: 'warning',
      key,
      message: `Referenced UnitDef${missing.length === 1 ? '' : 's'} ${missing.map(id => `"${id}"`).join(', ')} ${missing.length === 1 ? 'is' : 'are'} not present in this BAR snapshot or project.`,
    });
  }
}

function validateExplosionSpawner(values, context, problems) {
  validateUnitReferences({ key: 'spawns_name', value: values.spawns_name, ...context, problems });
  const spawnedUnits = valueList(values.spawns_name);
  if (spawnedUnits.length > 1 && !hasValue(values.spawns_mode)) {
    problems.push({
      kind: 'missing', level: 'warning', key: 'spawns_mode',
      message: 'Multiple spawned UnitDefs require a selection mode: random, random_locked, or sequential.',
    });
  }
}

function validateCarrier(values, context, problems) {
  validateUnitReferences({ key: 'carried_unit', value: values.carried_unit, ...context, problems });
  const carriedUnits = valueList(values.carried_unit);
  if (hasValue(values.spawns_name)) {
    problems.push({
      kind: 'advisory', level: 'warning', key: 'carried_unit',
      message: 'Carrier and explosion spawning share this weapon slot. BAR can run both contracts, but verify the combined lifecycle in-game.',
    });
  }
  const missingRecommended = context.contract.recommendedKeys.filter(key => !hasValue(values[key]));
  if (missingRecommended.length > 0) {
    problems.push({
      kind: 'missing', level: 'warning', key: missingRecommended[0],
      message: `Carrier runtime defaults will be used for ${missingRecommended.map(fieldLabel).join(', ')}. Set them explicitly for predictable behavior.`,
    });
  }
  if (carriedUnits.length > 1) {
    CARRIER_LIST_KEYS.forEach(key => {
      if (!hasValue(values[key])) return;
      const entries = valueList(values[key]);
      if (entries.length !== 1 && entries.length !== carriedUnits.length) {
        problems.push({
          kind: 'missing', level: 'error', key,
          message: `${fieldLabel(key)} has ${entries.length} values for ${carriedUnits.length} carried UnitDefs. Use one shared value or one value per type.`,
        });
      }
    });
  }

  const dockingKeys = [
    'dockingpieces', 'dockingradius', 'dockinghelperspeed', 'dockingarmor',
    'dockinghealrate', 'docktohealthreshold', 'dronedocktime',
  ];
  const configuredDockingKeys = dockingKeys.filter(key => (
    context.explicitKeys.has(key) && hasActiveValue(values[key])
  ));
  if (configuredDockingKeys.length > 0 && !hasActiveValue(values.enabledocking)) {
    problems.push({
      kind: 'conflict',
      level: 'warning',
      key: 'enabledocking',
      companionKeys: configuredDockingKeys,
      message: `${configuredDockingKeys.map(fieldLabel).join(', ')} ${configuredDockingKeys.length === 1 ? 'is' : 'are'} configured while docking is disabled. BAR will not use the docking setup.`,
      suggestedFix: 'Enable docking or reset the docking-only fields.',
    });
  }
}

function validateCluster(values, context, problems) {
  const clusterKey = cleanId(values.cluster_def);
  if (clusterKey && context.explicitKeys.has('cluster_def')
    && !context.knownWeaponDefs.has(clusterKey)
    && !context.supportingWeaponDefs.has(`${cleanId(context.unitId)}:${clusterKey}`)) {
    problems.push({
      kind: 'unknown', level: 'warning', key: 'cluster_def',
      message: `Supporting WeaponDef "${values.cluster_def}" is not present in the BAR snapshot or project library.`,
    });
  }
  if (hasValue(values.cluster_number)) {
    const count = numberValue(values.cluster_number);
    if (!Number.isInteger(count) || count < 3 || count > 24) {
      problems.push({
        kind: 'invalid', level: 'warning', key: 'cluster_number',
        message: 'BAR clamps cluster count to the supported range of 3 through 24.',
      });
    }
  }
}

function validateSectorFire(values) {
  const mode = cleanId(values.speceffect);
  if (mode !== 'sector_fire') return;
}

function validateSpecialProjectileBehavior(values, context, problems) {
  const behavior = getSpecialProjectileBehavior(values.speceffect);
  if (!behavior || behavior.id === 'sector_fire') return;

  behavior.requiredParameterKeys.forEach(key => {
    if (hasValue(values[key])) return;
    problems.push({
      kind: 'missing',
      level: 'error',
      key,
      message: `${behavior.label} requires ${fieldLabel(key)}.`,
      suggestedFix: `Set ${fieldLabel(key)} or choose a different Behavior Mode.`,
    });
  });

  if (behavior.id === 'cruise') {
    const minimum = numberValue(values.cruise_min_height);
    const maximum = numberValue(values.cruise_max_height);
    if (minimum !== null && maximum !== null && minimum > maximum) {
      problems.push({
        kind: 'invalid',
        level: 'error',
        key: 'cruise_min_height',
        companionKeys: ['cruise_max_height'],
        message: 'Minimum Ground Clearance must not exceed Maximum Ground Clearance.',
        suggestedFix: 'Lower the minimum clearance or raise the maximum clearance.',
      });
    }
  }

  if (behavior.id === 'split') {
    const count = numberValue(values.speceffect_number);
    if (count !== null && (!Number.isInteger(count) || count < 1)) {
      problems.push({
        kind: 'invalid',
        level: 'error',
        key: 'speceffect_number',
        message: 'Submunition Count must be a whole number of at least 1.',
        suggestedFix: 'Use a positive whole-number submunition count.',
      });
    }
  }

  if (['split', 'cannonwaterpen'].includes(behavior.id) && hasValue(values.speceffect_def)) {
    const weaponKey = cleanId(values.speceffect_def);
    const localKey = `${cleanId(context.unitId)}:${weaponKey}`;
    if (!context.knownWeaponDefs.has(weaponKey) && !context.supportingWeaponDefs.has(localKey)) {
      problems.push({
        kind: 'unknown',
        level: 'warning',
        key: 'speceffect_def',
        message: `Supporting WeaponDef "${values.speceffect_def}" is not present in the BAR snapshot or project library.`,
        suggestedFix: 'Select an existing WeaponDef or create an enabled supporting WeaponDef for this unit.',
      });
    }
  }

  const activeKeys = new Set(behavior.parameterKeys);
  const irrelevant = SPECIAL_PROJECTILE_PARAMETERS
    .filter(parameter => parameter.key !== 'speceffect')
    .map(parameter => parameter.key)
    .filter(key => context.explicitKeys.has(key) && hasActiveValue(values[key]) && !activeKeys.has(key));
  if (irrelevant.length > 0) {
    problems.push({
      kind: 'conflict',
      level: 'warning',
      key: irrelevant[0],
      companionKeys: irrelevant,
      message: `${irrelevant.map(fieldLabel).join(', ')} ${irrelevant.length === 1 ? 'does' : 'do'} not belong to ${behavior.label} and will not affect that behavior.`,
      suggestedFix: 'Reset fields from other behavior modes or select the matching Behavior Mode.',
    });
  }
}

function validateInterception(values, _context, problems) {
  const interceptor = numberValue(values.interceptor) || 0;
  const targetable = numberValue(values.targetable) || 0;
  const coverage = numberValue(values.coverage) || 0;
  if (interceptor > 0 && coverage <= 0) {
    problems.push({
      kind: 'missing', level: 'error', key: 'coverage',
      message: 'An interceptor mask requires positive Acquisition Coverage.',
    });
  }
  if (values.interceptsolo === true && interceptor <= 0) {
    problems.push({
      kind: 'conflict', level: 'warning', key: 'interceptsolo',
      message: 'Exclusive Interception has no effect without a positive interceptor mask.',
    });
  }
  if (coverage > 0 && interceptor <= 0 && targetable <= 0) {
    problems.push({
      kind: 'missing', level: 'warning', key: 'coverage',
      message: 'Acquisition Coverage is set without an interceptor or targetable channel.',
    });
  }
}

function validateEnergyConverter(values, _context, problems) {
  ['customparams.energyconv_capacity', 'customparams.energyconv_efficiency'].forEach(key => {
    if (!hasValue(values[key])) return;
    const number = numberValue(values[key]);
    if (number === null || number <= 0) {
      problems.push({
        kind: 'invalid', level: 'error', key,
        message: `${fieldLabel(key)} must be a positive number.`,
      });
    }
  });
}

function validateScavengerSquad(values, _context, problems) {
  const amount = numberValue(values['customparams.scavsquadunitsamount']);
  const weight = numberValue(values['customparams.scavsquadweight']);
  const minAnger = numberValue(values['customparams.scavsquadminanger']);
  const maxAnger = numberValue(values['customparams.scavsquadmaxanger']);
  const chance = numberValue(values['customparams.scavsquadbehaviorchance']);
  if (!Number.isInteger(amount) || amount < 1) {
    problems.push({ kind: 'invalid', level: 'error', key: 'customparams.scavsquadunitsamount', message: 'Scavenger Squad Amount must be a whole number of at least 1.' });
  }
  if (!Number.isFinite(weight) || weight <= 0) {
    problems.push({ kind: 'invalid', level: 'error', key: 'customparams.scavsquadweight', message: 'Scavenger Selection Weight must be greater than 0.' });
  }
  if (minAnger !== null && maxAnger !== null && minAnger > maxAnger) {
    problems.push({ kind: 'invalid', level: 'error', key: 'customparams.scavsquadminanger', message: 'Scavenger Minimum Anger must not exceed Maximum Anger.' });
  }
  if (chance === null || chance < 0 || chance > 1) {
    problems.push({ kind: 'invalid', level: 'error', key: 'customparams.scavsquadbehaviorchance', message: 'Scavenger Behavior Chance must be between 0 and 1.' });
  }
}

const CONTRACT_VALIDATORS = Object.freeze({
  'explosion-spawner': validateExplosionSpawner,
  'carrier-spawner': validateCarrier,
  'cluster-projectile': validateCluster,
  'sector-fire': validateSectorFire,
  'special-projectile-behavior': validateSpecialProjectileBehavior,
  'projectile-interception': validateInterception,
  'energy-converter': validateEnergyConverter,
  'scavenger-squad': validateScavengerSquad,
});

function weaponSlotNumbers(defaults, patch) {
  const numbers = new Set((defaults?.weaponSlots || []).map(slot => Number(slot.slot)).filter(Number.isFinite));
  Object.keys(patch || {}).forEach(key => {
    const match = key.match(/^weapon_slot_(\d+)_/);
    if (match) numbers.add(Number(match[1]));
  });
  return [...numbers].sort((left, right) => left - right);
}

function effectiveWeaponValues(contract, slotNumber, defaults, patch) {
  const slot = (defaults?.weaponSlots || []).find(entry => Number(entry.slot) === slotNumber) || {};
  const keys = new Set([
    ...contract.triggerKeys,
    ...contract.requiredKeys,
    ...(contract.recommendedKeys || []),
    ...(contract.id === 'explosion-spawner' ? ['carried_unit'] : []),
    ...(contract.id === 'carrier-spawner' ? ['spawns_name'] : []),
  ]);
  return Object.fromEntries([...keys].map(key => {
    const patchKey = `weapon_slot_${slotNumber}_${key}`;
    return [key, Object.prototype.hasOwnProperty.call(patch, patchKey) ? patch[patchKey] : slot[key]];
  }));
}

function contractIsActive(contract, values, patch, slotNumber = null) {
  return (contract.activationKeys || contract.triggerKeys).some(key => {
    const patchKey = slotNumber === null ? key : `weapon_slot_${slotNumber}_${key}`;
    const value = Object.prototype.hasOwnProperty.call(patch, patchKey)
      ? patch[patchKey]
      : values[key];
    return hasActiveValue(value);
  });
}

export function evaluateGadgetContracts({
  unitId,
  unitName = unitId,
  defaults = {},
  patch = {},
  knownUnitIds = new Set(),
  knownWeaponDefs = new Set(),
  supportingWeaponDefs = new Set(),
} = {}) {
  const normalizedContext = {
    unitId: cleanId(unitId),
    knownUnitIds: knownUnitIds instanceof Set ? knownUnitIds : new Set(knownUnitIds),
    knownWeaponDefs: knownWeaponDefs instanceof Set ? knownWeaponDefs : new Set(knownWeaponDefs),
    supportingWeaponDefs: supportingWeaponDefs instanceof Set ? supportingWeaponDefs : new Set(supportingWeaponDefs),
  };
  const results = [];

  UNIT_CONTRACTS.forEach(contract => {
    const values = Object.fromEntries(contract.triggerKeys.map(key => [
      key,
      Object.prototype.hasOwnProperty.call(patch, key) ? patch[key] : defaults[key],
    ]));
    const problems = [];
    const active = contractIsActive(contract, values, patch);
    const partial = validateOrphanedCompanions(contract, values, patch, null, problems);
    if (!active && !partial) return;
    if (active) {
      validateRequired(contract, values, problems);
      CONTRACT_VALIDATORS[contract.id]?.(values, { ...normalizedContext, contract }, problems);
    }
    results.push(makeResult({ contract, unitId: normalizedContext.unitId, unitName, values, problems }));
  });

  weaponSlotNumbers(defaults, patch).forEach(slotNumber => {
    WEAPON_CONTRACTS.forEach(contract => {
      const values = effectiveWeaponValues(contract, slotNumber, defaults, patch);
      let active;
      if (contract.id === 'sector-fire') {
        // spread_angle and max_range_reduction are not unique activation
        // markers. Ordinary weapons and copied WeaponDefs can carry them while
        // using a different special behavior. BAR only enters this gadget's
        // sector path when speceffect explicitly selects sector_fire.
        active = cleanId(values.speceffect) === 'sector_fire';
      } else if (contract.id === 'special-projectile-behavior') {
        const behavior = getSpecialProjectileBehavior(values.speceffect);
        active = Boolean(behavior && behavior.id !== 'sector_fire');
      } else {
        active = contractIsActive(contract, values, patch, slotNumber);
      }
      const problems = [];
      const partial = validateOrphanedCompanions(contract, values, patch, slotNumber, problems);
      if (!active && !partial) return;
      if (active) {
        validateRequired(contract, values, problems);
        CONTRACT_VALIDATORS[contract.id]?.(
          values,
          {
            ...normalizedContext,
            contract,
            slotNumber,
            explicitKeys: new Set(
              Object.keys(patch)
                .filter(key => key.startsWith(`weapon_slot_${slotNumber}_`))
                .map(key => key.replace(`weapon_slot_${slotNumber}_`, '')),
            ),
          },
          problems,
        );
      }
      results.push(makeResult({
        contract,
        unitId: normalizedContext.unitId,
        unitName,
        slotNumber,
        values,
        problems,
      }));
    });
  });

  return results;
}

export function gadgetContractResultsToIssues(results = []) {
  return results.flatMap(result => result.problems.map((problem, index) => ({
    id: `gadget-contract-${result.id}-${problem.key}-${index}`,
    source: 'gadget-contract',
    group: 'contracts',
    contractId: result.contractId,
    contractStatus: result.status,
    unitId: result.unitId,
    unitName: result.unitName,
    key: result.slotNumber === null
      ? problem.key
      : `weapon_slot_${result.slotNumber}_${problem.key}`,
    level: problem.level,
    title: `${result.unitName} · ${result.label}`,
    message: problem.message,
    companionKeys: problem.companionKeys || [],
    suggestedFix: problem.suggestedFix || null,
    contractSource: result.source,
    action: { type: 'unit', unitId: result.unitId, label: 'Open contract' },
  })));
}
