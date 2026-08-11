import {
  getCustomParameterDefinition,
  normalizeCustomParameterKey,
} from '../config/customParameters.js';
import { getCustomParameterEditor } from '../config/customParameterEditors.js';

export const CONSUMER_BACKED_VALIDATION_VERSION = 1;

const present = value => value !== undefined && value !== null;
const clean = value => String(value ?? '').trim();
const normalizedSet = values => new Set([...(values || [])].map(value => clean(value).toLowerCase()).filter(Boolean));

function reliableType(definition) {
  if (definition.curated || definition.documented || definition.editorSupported) return definition.type;
  const observed = [...new Set((definition.observedTypes || []).filter(type => type !== 'dynamic'))];
  return observed.length === 1 ? observed[0] : null;
}

function valueKind(value) {
  if (typeof value === 'boolean') return 'Boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'text';
  return Array.isArray(value) ? 'list' : typeof value;
}

function validBoolean(value) {
  if (typeof value === 'boolean') return true;
  if (value === 0 || value === 1) return true;
  return ['true', 'false', '0', '1'].includes(clean(value).toLowerCase());
}

function consumerSource(definition) {
  const evidence = definition.consumerEvidence?.[0];
  if (!evidence) return null;
  return {
    path: evidence.path,
    line: evidence.line || 0,
    layer: evidence.layer,
    confidence: evidence.confidence,
  };
}

function sourceSuffix(source) {
  if (!source?.path) return '';
  const filename = source.path.split('/').at(-1);
  return ` BAR consumer: ${filename}${source.line ? `:${source.line}` : ''}.`;
}

function issueFactory({ definition, unitId, unitName, projectKey }) {
  const source = consumerSource(definition);
  return (level, code, message, extra = {}) => ({
    id: `consumer-parameter-${unitId}-${projectKey}-${code}`,
    source: 'consumer-backed-parameter',
    group: 'contracts',
    unitId,
    unitName,
    key: projectKey,
    level,
    code,
    title: `${unitName} · ${definition.label}`,
    message: `${message}${sourceSuffix(source)}`,
    consumerCount: definition.consumerCount,
    consumerSource: source,
    parameterId: definition.id,
    contractIds: definition.contractIds,
    ...extra,
  });
}

export function validateConsumerBackedCustomParameter({
  unitId,
  unitName = unitId,
  projectKey,
  parameterKey,
  scope = 'unit',
  value,
  knownUnitIds = new Set(),
  knownWeaponDefs = new Set(),
  supportingWeaponDefs = new Set(),
} = {}) {
  const definition = getCustomParameterDefinition(normalizeCustomParameterKey(parameterKey), scope);
  if (!definition || definition.consumerCount <= 0 || !present(value)) return [];

  const makeIssue = issueFactory({ definition, unitId, unitName, projectKey });
  const issues = [];
  const text = clean(value);
  if (!text) {
    issues.push(makeIssue('error', 'blank', `${definition.label} is blank. Reset the override or provide a value.`));
    return issues;
  }

  const type = reliableType(definition);
  let numericValue = null;
  if (type === 'number') {
    numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      issues.push(makeIssue('error', 'type', `${definition.label} expects a number, but this edit contains ${valueKind(value)}.`));
    }
  } else if (type === 'boolean' && !validBoolean(value)) {
    issues.push(makeIssue('error', 'type', `${definition.label} expects true or false, but this edit contains “${text}”.`));
  } else if (type === 'string' && (typeof value === 'object' || typeof value === 'function')) {
    issues.push(makeIssue('error', 'type', `${definition.label} expects text, but this edit contains ${valueKind(value)}.`));
  }

  if (numericValue !== null && Number.isFinite(numericValue)) {
    if (definition.min !== undefined && numericValue < definition.min) {
      issues.push(makeIssue('error', 'minimum', `${definition.label} must be at least ${definition.min}.`));
    }
    if (definition.max !== undefined && numericValue > definition.max) {
      issues.push(makeIssue('error', 'maximum', `${definition.label} must not exceed ${definition.max}.`));
    }
    if (definition.step === 1 && !Number.isInteger(numericValue)) {
      issues.push(makeIssue('error', 'integer', `${definition.label} must be a whole number.`));
    }
  }

  if (definition.acceptedValues?.length) {
    const accepted = definition.acceptedValues.map(option => clean(option).toLowerCase());
    if (!accepted.includes(text.toLowerCase())) {
      issues.push(makeIssue(
        'error',
        'enum',
        `${definition.label} must be one of: ${definition.acceptedValues.join(', ')}.`,
      ));
    }
  }

  const editor = getCustomParameterEditor(definition);
  const references = text.split(/[\s,]+/).map(reference => reference.toLowerCase()).filter(Boolean);
  if ((editor.kind === 'reference' || editor.kind === 'reference-list') && editor.referenceType === 'unit') {
    const known = normalizedSet(knownUnitIds);
    const missing = references.filter(reference => !known.has(reference));
    if (missing.length) {
      issues.push(makeIssue(
        'warning',
        'unit-reference',
        `${definition.label} references unknown UnitDef${missing.length === 1 ? '' : 's'} ${missing.map(id => `“${id}”`).join(', ')}.`,
      ));
    }
  }
  if ((editor.kind === 'reference' || editor.kind === 'reference-list') && editor.referenceType === 'weapon') {
    const known = normalizedSet(knownWeaponDefs);
    const supporting = normalizedSet(supportingWeaponDefs);
    const owner = clean(unitId).toLowerCase();
    const missing = references.filter(reference => !known.has(reference) && !supporting.has(`${owner}:${reference}`));
    if (missing.length) {
      issues.push(makeIssue(
        'warning',
        'weapon-reference',
        `${definition.label} references unknown WeaponDef${missing.length === 1 ? '' : 's'} ${missing.map(id => `“${id}”`).join(', ')}.`,
      ));
    }
  }

  return issues;
}

function parameterCandidate(projectKey) {
  if (projectKey.startsWith('customparams.')) {
    return { scope: 'unit', parameterKey: projectKey.slice('customparams.'.length) };
  }
  const weapon = projectKey.match(/^weapon_slot_\d+_(.+)$/);
  if (weapon && getCustomParameterDefinition(weapon[1], 'weapon')) {
    return { scope: 'weapon', parameterKey: weapon[1] };
  }
  return null;
}

export function validateConsumerBackedPatch({ patch = {}, ...context } = {}) {
  return Object.entries(patch).flatMap(([projectKey, value]) => {
    const candidate = parameterCandidate(projectKey);
    if (!candidate) return [];
    return validateConsumerBackedCustomParameter({
      ...context,
      ...candidate,
      projectKey,
      value,
    });
  });
}
