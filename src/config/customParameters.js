import discovery from '../data/custom-parameter-discovery.json' with { type: 'json' };
import { WEAPON_PARAMETER_CATALOG } from './weaponParameters.js';
import { GADGET_CONTRACT_REGISTRY } from './gadgetContracts.js';
import {
  buildCustomParameterPromotion,
  CUSTOM_PARAMETER_RUNTIME_EVIDENCE,
} from './customParameterPromotion.js';
import { normalizeCustomParameterKey } from './customParameterKey.js';

export { CUSTOM_PARAMETER_KEY_PATTERN, isValidCustomParameterKey, normalizeCustomParameterKey } from './customParameterKey.js';

export const CUSTOM_PARAMETER_REGISTRY_VERSION = 2;

const curatedUnitParameters = [
  {
    key: 'armordef', label: 'Armor Definition', type: 'string', owner: 'Package-specific', maturity: 'external',
    description: 'Optional armor-table identifier. Only has an effect when the loaded game or package consumes this key.'
  },
  {
    key: 'restrictions_exclusion', label: 'Restriction Exclusion', type: 'string', owner: 'BAR gadget', maturity: 'stable',
    description: 'Exempts this unit from a named BAR unit-restriction group, for example _noantinuke_.'
  },
  {
    key: 'crashable', label: 'Crashable', type: 'boolean', owner: 'BAR gadget', maturity: 'stable',
    description: 'Controls whether BAR aircraft-crash handling may turn the unit into a crashing wreck.'
  },
  {
    key: 'fall_damage_multiplier', label: 'Fall Damage Multiplier', type: 'number', owner: 'BAR gadget', maturity: 'stable', min: 0,
    description: 'Multiplies damage applied by BAR fall-impact handling. Zero disables that additional damage.'
  },
  {
    key: 'water_fall_damage_multiplier', label: 'Water Fall Damage Multiplier', type: 'number', owner: 'BAR gadget', maturity: 'stable', min: 0,
    description: 'Multiplies BAR fall-impact damage when the landing occurs in water.'
  },
  {
    key: 'unitgroup', label: 'Unit Group', type: 'string', owner: 'BAR convention', maturity: 'stable',
    description: 'BAR role classification used by UI, targeting, restrictions, and supporting gadgets.'
  },
  {
    key: 'ignore_noair', label: 'Ignore No-Air Restriction', type: 'boolean', owner: 'Package-specific', maturity: 'external',
    description: 'Package convention for bypassing a no-air restriction. It requires code that explicitly reads the key.'
  },
  {
    key: 'attacksafetydistance', label: 'Attack Safety Distance', type: 'number', owner: 'BAR gadget', maturity: 'stable', min: 0, unit: 'elmos',
    description: 'Minimum safety distance used by BAR attack behavior for units whose own attack may be dangerous.'
  },
  {
    key: 'overrange_distance', label: 'Overrange Distance', type: 'number', owner: 'BAR gadget', maturity: 'stable', min: 0, unit: 'elmos',
    description: 'Extra distance consumed by BAR overrange projectile behavior. This does not replace the WeaponDef range.'
  },
  {
    key: 'paralyzemultiplier', label: 'Paralyze Multiplier', type: 'number', owner: 'BAR gadget', maturity: 'stable', min: 0,
    description: 'BAR-specific multiplier for paralysis received or applied by supporting EMP logic.'
  },
  {
    key: 'removestop', label: 'Remove Stop Command', type: 'boolean', owner: 'BAR UI convention', maturity: 'stable',
    description: 'Asks BAR command UI logic to hide the Stop command for this unit.'
  },
  {
    key: 'maxrange', label: 'Reported Maximum Range', type: 'number', owner: 'BAR UI convention', maturity: 'stable', min: 0, unit: 'elmos',
    description: 'Range hint used by BAR presentation and supporting logic. It does not change a WeaponDef range by itself.'
  }
];

function titleFromKey(key) {
  return String(key || '')
    .split('_')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferredType(observation) {
  const types = new Set(observation?.valueTypes || []);
  if (types.size === 1 && types.has('boolean')) return 'boolean';
  if (types.size === 1 && types.has('number')) return 'number';
  return 'string';
}

function observationMap(scope) {
  return new Map((discovery.parameters?.[scope] || []).map(parameter => [parameter.key, parameter]));
}

function consumerOnlyMap(scope) {
  return new Map((discovery.consumerOnly || [])
    .filter(parameter => parameter.scope === scope)
    .map(parameter => [parameter.key, parameter]));
}

const unitObservations = observationMap('unit');
const weaponObservations = observationMap('weapon');
const unitConsumerOnly = consumerOnlyMap('unit');
const weaponConsumerOnly = consumerOnlyMap('weapon');

const contractByParameter = new Map();
for (const contract of GADGET_CONTRACT_REGISTRY) {
  for (const contractKey of contract.triggerKeys || []) {
    const key = String(contractKey).replace(/^customparams\./, '').toLowerCase();
    const id = `${contract.scope}:${key}`;
    if (!contractByParameter.has(id)) contractByParameter.set(id, []);
    contractByParameter.get(id).push(contract);
  }
}

function enrichDefinition(definition, scope, observation) {
  const observed = Boolean(observation && observation.declared !== false);
  const contracts = contractByParameter.get(`${scope}:${definition.key}`) || [];
  const consumerEvidence = Object.freeze((observation?.consumerEvidence || []).map(item => Object.freeze({
    ...item,
  })));
  const reviewed = Boolean(definition.reviewed || definition.curated || definition.editorSupported || contracts.length);
  const documented = Boolean(definition.documented || definition.curated || definition.editorSupported);
  const editorSupported = Boolean(definition.editorSupported);
  const runtimeFixtureIds = scope === 'weapon'
    ? CUSTOM_PARAMETER_RUNTIME_EVIDENCE[definition.key] || []
    : [];
  const promotion = buildCustomParameterPromotion({
    observed,
    reviewed,
    documented,
    editorSupported,
    runtimeFixtureIds,
    evidence: contracts.map(contract => ({
      kind: 'consumer',
      label: contract.label,
      contractId: contract.id,
      sourcePath: contract.source.path,
    })).concat(consumerEvidence.map(item => ({
      kind: 'consumer-discovery',
      label: `${item.layer}: ${item.path}`,
      sourcePath: item.path,
      confidence: item.confidence,
    }))),
  });
  return Object.freeze({
    ...definition,
    id: `${scope}:${definition.key}`,
    scope,
    path: `customparams.${definition.key}`,
    status: promotion.id,
    promotion,
    contractIds: Object.freeze(contracts.map(contract => contract.id)),
    capabilities: Object.freeze([...new Set([
      ...(definition.capabilities || [
        definition.owner === 'Package-specific' ? 'external-package' : 'bar-data',
      ]),
      ...(consumerEvidence.length > 0 ? ['bar-consumer-discovered'] : []),
    ])]),
    sourceCommit: discovery.sourceCommit,
    observed,
    occurrences: observation?.occurrences || 0,
    observedTypes: Object.freeze(observation?.valueTypes || []),
    sampleValues: Object.freeze(observation?.sampleValues || []),
    sampleUnitIds: Object.freeze(observation?.sampleUnitIds || []),
    sampleWeaponDefs: Object.freeze(observation?.sampleWeaponDefs || []),
    sourcePaths: Object.freeze(observation?.sourcePaths || []),
    consumerCount: observation?.consumerCount || 0,
    writerCount: observation?.writerCount || 0,
    consumerLayers: Object.freeze(observation?.consumerLayers || []),
    consumerEvidence,
  });
}

function consumerOnlyDefinition(consumer, scope) {
  return enrichDefinition({
    key: consumer.key,
    label: titleFromKey(consumer.key),
    type: 'string',
    owner: 'Detected BAR consumer',
    maturity: 'observed',
    capabilities: ['bar-consumer-discovered'],
    description: `Read by ${consumer.consumerCount} statically detected BAR source ${consumer.consumerCount === 1 ? 'access' : 'accesses'}, but not declared by a UnitDef in the pinned snapshot. Confirm its expected value type and activation conditions before editing it.`,
  }, scope, {
    ...consumer,
    occurrences: 0,
    valueTypes: [],
    sampleValues: [],
    sampleUnitIds: [],
    sampleWeaponDefs: [],
    sourcePaths: [],
  });
}

function discoveredDefinition(observation, scope) {
  const hasConsumer = (observation.consumerCount || 0) > 0;
  return enrichDefinition({
    key: observation.key,
    label: titleFromKey(observation.key),
    type: inferredType(observation),
    owner: 'Observed BAR definition',
    maturity: 'observed',
    status: 'discovered',
    capabilities: hasConsumer
      ? ['bar-data', 'bar-consumer-discovered']
      : ['bar-data', 'unverified-contract'],
    description: hasConsumer
      ? `Observed in ${observation.occurrences} BAR definition${observation.occurrences === 1 ? '' : 's'} and read by ${observation.consumerCount} statically detected BAR source ${observation.consumerCount === 1 ? 'access' : 'accesses'}. Its value semantics still require maintainer review.`
      : `Observed in ${observation.occurrences} BAR definition${observation.occurrences === 1 ? '' : 's'}. The editor preserves this key, but its runtime consumer has not been registered yet.`,
  }, scope, observation);
}

const curatedUnitByKey = new Map(curatedUnitParameters.map(parameter => [parameter.key, parameter]));
const unitRegistry = [
  ...curatedUnitParameters.map(parameter => enrichDefinition({
    ...parameter, curated: true, editorSupported: true,
  }, 'unit', unitObservations.get(parameter.key) || unitConsumerOnly.get(parameter.key))),
  ...[...unitObservations.values()]
    .filter(observation => !curatedUnitByKey.has(observation.key))
    .map(observation => discoveredDefinition(observation, 'unit')),
  ...[...unitConsumerOnly.values()]
    .filter(consumer => !curatedUnitByKey.has(consumer.key) && !unitObservations.has(consumer.key))
    .map(consumer => consumerOnlyDefinition(consumer, 'unit')),
].sort((left, right) => left.label.localeCompare(right.label, 'en'));

const weaponDefinitions = new Map();
for (const parameter of WEAPON_PARAMETER_CATALOG) {
  if (!String(parameter.path || '').startsWith('customparams.')) continue;
  const rawKey = parameter.path.slice('customparams.'.length).toLowerCase();
  if (weaponDefinitions.has(rawKey)) continue;
  weaponDefinitions.set(rawKey, {
    key: rawKey,
    editorKey: parameter.key,
    label: parameter.label,
    type: parameter.valueType === 'boolean' ? 'boolean' : parameter.valueType === 'number' ? 'number' : 'string',
    owner: 'BAR gadget',
    maturity: parameter.capabilities?.includes('experimental') ? 'experimental' : 'supported',
    reviewed: true,
    documented: true,
    editorSupported: true,
    capabilities: parameter.capabilities || ['bar-gadget'],
    description: parameter.description || `${parameter.label} is compiled into the WeaponDef custom-parameter table.`,
  });
}

const weaponRegistry = [
  ...[...weaponDefinitions.values()].map(parameter => enrichDefinition(
    parameter,
    'weapon',
    weaponObservations.get(parameter.key) || weaponConsumerOnly.get(parameter.key),
  )),
  ...[...weaponObservations.values()]
    .filter(observation => !weaponDefinitions.has(observation.key))
    .map(observation => discoveredDefinition(observation, 'weapon')),
  ...[...weaponConsumerOnly.values()]
    .filter(consumer => !weaponDefinitions.has(consumer.key) && !weaponObservations.has(consumer.key))
    .map(consumer => consumerOnlyDefinition(consumer, 'weapon')),
].sort((left, right) => left.label.localeCompare(right.label, 'en'));

export const CUSTOM_PARAMETER_DISCOVERY = Object.freeze({
  version: discovery.version,
  sourceRepository: discovery.sourceRepository,
  sourceCommit: discovery.sourceCommit,
  counts: Object.freeze({ ...discovery.counts }),
});

export const CUSTOM_PARAMETER_REGISTRY = Object.freeze([...unitRegistry, ...weaponRegistry]);
export const CUSTOM_PARAMETER_REGISTRY_BY_ID = new Map(
  CUSTOM_PARAMETER_REGISTRY.map(parameter => [parameter.id, parameter]),
);

// Compatibility surface for the existing UnitDef custom-parameter editor.
export const CUSTOM_PARAMETER_CATALOG = Object.freeze(unitRegistry);
export const CUSTOM_PARAMETER_BY_KEY = new Map(CUSTOM_PARAMETER_CATALOG.map(parameter => [parameter.key, parameter]));

export function getCustomParameterDefinition(key, scope = 'unit') {
  return CUSTOM_PARAMETER_REGISTRY_BY_ID.get(`${scope}:${normalizeCustomParameterKey(key)}`) || null;
}

export function getCustomParameterObservation(key, scope = 'unit') {
  const definition = getCustomParameterDefinition(key, scope);
  if (!definition?.observed) return null;
  return {
    occurrences: definition.occurrences,
    observedTypes: definition.observedTypes,
    sampleValues: definition.sampleValues,
    sampleUnitIds: definition.sampleUnitIds,
    sampleWeaponDefs: definition.sampleWeaponDefs,
    sourcePaths: definition.sourcePaths,
  };
}

export function getCustomParameterPromotion(key, scope = 'unit') {
  return getCustomParameterDefinition(key, scope)?.promotion || null;
}

export function getCustomParameterConsumers(key, scope = 'unit') {
  return getCustomParameterDefinition(key, scope)?.consumerEvidence || [];
}


export function coerceCustomParameterValue(value, type) {
  if (type === 'boolean') {
    if (value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true') return true;
    if (value === false || value === 0 || value === '0' || String(value).toLowerCase() === 'false') return false;
    return undefined;
  }
  if (type === 'number') {
    const number = Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  return String(value ?? '').trim();
}
