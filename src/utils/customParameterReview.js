import {
  CUSTOM_PARAMETER_DISCOVERY,
  CUSTOM_PARAMETER_REGISTRY,
} from '../config/customParameters.js';

export const DISCOVERED_KEY_REVIEW_VERSION = 1;

export const DISCOVERED_KEY_REVIEW_DECISIONS = Object.freeze([
  Object.freeze({ id: 'pending', label: 'Pending review' }),
  Object.freeze({ id: 'candidate', label: 'Promotion candidate' }),
  Object.freeze({ id: 'needs-research', label: 'Needs source research' }),
  Object.freeze({ id: 'dismissed', label: 'Not editor-facing' }),
]);

const VALID_DECISIONS = new Set(DISCOVERED_KEY_REVIEW_DECISIONS.map(entry => entry.id));

function unique(values = []) {
  return [...new Set(values.filter(Boolean))];
}

function priorityFor(definition) {
  if (definition.promotion.rank > 0) return 20 - definition.promotion.rank;
  if (!definition.observed && definition.consumerCount > 0) return 92;
  if (definition.consumerCount > 0) return 96;
  return 70;
}

function confidenceFor(definition) {
  const types = unique(definition.observedTypes.filter(type => type !== 'dynamic'));
  const highConfidenceConsumer = definition.consumerEvidence.some(evidence => evidence.confidence === 'high');
  if (definition.observed && types.length === 1 && highConfidenceConsumer) return 'strong';
  if (definition.consumerCount > 0 || (definition.observed && types.length === 1)) return 'partial';
  return 'uncertain';
}

function issuesFor(definition) {
  const issues = [];
  const observedTypes = unique(definition.observedTypes);
  if (!definition.observed) issues.push('Consumer found without a declaration in the pinned UnitDef snapshot.');
  if (definition.consumerCount === 0) issues.push('No static BAR consumer has been resolved yet.');
  if (observedTypes.includes('dynamic')) issues.push('At least one declaration uses a dynamic value.');
  if (observedTypes.filter(type => type !== 'dynamic').length > 1) issues.push('Declarations use more than one scalar value type.');
  if (definition.writerCount > 0) issues.push('BAR source writes this key as well as reading it.');
  return issues;
}

function recommendationFor(definition) {
  if (definition.promotion.id !== 'observed') return definition.promotion.nextRequirement;
  if (!definition.observed && definition.consumerCount > 0) {
    return 'Confirm activation conditions and find a representative UnitDef or WeaponDef declaration.';
  }
  if (definition.consumerCount > 0) {
    return 'Read the detected consumer, confirm its value semantics, then document safe constraints.';
  }
  return 'Locate the runtime or interface consumer before exposing this key as an editor control.';
}

function fromDefinition(definition) {
  const declarationKind = definition.observed ? 'declared' : 'consumer-only';
  const evidencePaths = unique([
    ...definition.sourcePaths,
    ...definition.consumerEvidence.map(entry => entry.path),
  ]);
  return Object.freeze({
    id: definition.id,
    key: definition.key,
    label: definition.label,
    scope: definition.scope,
    promotion: definition.promotion,
    owner: definition.owner,
    type: definition.type,
    declarationKind,
    confidence: confidenceFor(definition),
    priority: priorityFor(definition),
    occurrences: definition.occurrences,
    consumerCount: definition.consumerCount,
    writerCount: definition.writerCount,
    consumerLayers: definition.consumerLayers,
    consumerEvidence: definition.consumerEvidence,
    observedTypes: definition.observedTypes,
    sampleValues: definition.sampleValues,
    sampleUnitIds: definition.sampleUnitIds,
    sampleWeaponDefs: definition.sampleWeaponDefs,
    sourcePaths: definition.sourcePaths,
    evidencePaths: Object.freeze(evidencePaths),
    issues: Object.freeze(issuesFor(definition)),
    recommendation: recommendationFor(definition),
    description: definition.description,
    contractIds: definition.contractIds,
    capabilities: definition.capabilities,
    searchText: [
      definition.key,
      definition.label,
      definition.owner,
      definition.scope,
      ...evidencePaths,
      ...definition.consumerLayers,
      ...definition.sampleValues,
    ].join(' ').toLowerCase(),
  });
}

function fromUnresolved(entry) {
  const paths = unique(entry.sourcePaths);
  return Object.freeze({
    id: `unresolved:${entry.key}`,
    key: entry.key,
    label: entry.key,
    scope: 'unresolved',
    promotion: Object.freeze({
      id: 'unresolved', rank: -1, label: 'Unresolved', shortLabel: 'Unresolved', tone: 'warning',
      description: 'Static discovery found this property name but could not prove whether it belongs to a UnitDef or WeaponDef custom-parameter table.',
      nextRequirement: 'Inspect every source occurrence and establish scope before adding it to the registry.',
      evidence: Object.freeze([]),
      runtimeFixtureIds: Object.freeze([]),
    }),
    owner: 'Unresolved BAR source access',
    type: 'unknown',
    declarationKind: 'unresolved',
    confidence: 'uncertain',
    priority: 100,
    occurrences: entry.occurrences || 0,
    consumerCount: 0,
    writerCount: 0,
    consumerLayers: Object.freeze([]),
    consumerEvidence: Object.freeze([]),
    observedTypes: Object.freeze([]),
    sampleValues: Object.freeze([]),
    sampleUnitIds: Object.freeze([]),
    sampleWeaponDefs: Object.freeze([]),
    sourcePaths: Object.freeze(paths),
    evidencePaths: Object.freeze(paths),
    issues: Object.freeze(['Scope could not be resolved automatically.']),
    recommendation: 'Inspect each source occurrence and classify the access as UnitDef, WeaponDef, or unrelated data.',
    description: 'This key remains quarantined from editing and validation until its scope is resolved.',
    contractIds: Object.freeze([]),
    capabilities: Object.freeze(['static-analysis']),
    searchText: [entry.key, ...paths, 'unresolved'].join(' ').toLowerCase(),
  });
}

export function buildDiscoveredKeyReviewQueue({
  registry = CUSTOM_PARAMETER_REGISTRY,
  unresolvedConsumers = CUSTOM_PARAMETER_DISCOVERY.unresolvedConsumers,
} = {}) {
  return Object.freeze([
    ...registry.map(fromDefinition),
    ...unresolvedConsumers.map(fromUnresolved),
  ].sort((left, right) => (
    right.priority - left.priority
    || right.consumerCount - left.consumerCount
    || right.occurrences - left.occurrences
    || left.key.localeCompare(right.key, 'en')
  )));
}

export function filterDiscoveredKeyReviewQueue(queue, {
  query = '', scope = 'all', stage = 'needs-review', evidence = 'all', localReviews = {},
} = {}) {
  const normalizedQuery = String(query).trim().toLowerCase();
  return queue.filter(entry => {
    if (scope !== 'all' && entry.scope !== scope) return false;
    if (stage === 'needs-review' && !['observed', 'unresolved'].includes(entry.promotion.id)) return false;
    if (stage !== 'all' && stage !== 'needs-review' && entry.promotion.id !== stage) return false;
    if (evidence === 'consumer-backed' && entry.consumerCount === 0) return false;
    if (evidence === 'no-consumer' && (entry.consumerCount > 0 || entry.scope === 'unresolved')) return false;
    if (evidence === 'consumer-only' && entry.declarationKind !== 'consumer-only') return false;
    if (evidence === 'unresolved' && entry.scope !== 'unresolved') return false;
    if (evidence === 'locally-reviewed' && !localReviews[entry.id]) return false;
    return !normalizedQuery || entry.searchText.includes(normalizedQuery);
  });
}

export function normalizeDiscoveredKeyReview(review) {
  if (!review || typeof review !== 'object') return null;
  const decision = VALID_DECISIONS.has(review.decision) ? review.decision : 'pending';
  const note = String(review.note || '').trim().slice(0, 2000);
  return Object.freeze({ decision, note, reviewedAt: String(review.reviewedAt || '') });
}

export function buildDiscoveredKeyReviewArtifact(entry, review = {}) {
  const normalizedReview = normalizeDiscoveredKeyReview(review) || { decision: 'pending', note: '', reviewedAt: '' };
  return {
    version: DISCOVERED_KEY_REVIEW_VERSION,
    sourceRepository: CUSTOM_PARAMETER_DISCOVERY.sourceRepository,
    sourceCommit: CUSTOM_PARAMETER_DISCOVERY.sourceCommit,
    key: entry.key,
    scope: entry.scope,
    registryId: entry.scope === 'unresolved' ? null : entry.id,
    currentPromotion: entry.promotion.id,
    declarationKind: entry.declarationKind,
    inferredType: entry.type,
    observedTypes: [...entry.observedTypes],
    samples: [...entry.sampleValues],
    occurrences: entry.occurrences,
    consumers: entry.consumerEvidence.map(evidence => ({ ...evidence })),
    sourcePaths: [...entry.sourcePaths],
    issues: [...entry.issues],
    recommendation: entry.recommendation,
    review: normalizedReview,
  };
}
