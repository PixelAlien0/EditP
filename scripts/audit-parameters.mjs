import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SPAWNER_CARRIER_WEAPON_GROUPS,
  STAT_KEYS,
  WEAPON_SLOT_BOOLEAN_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS,
  WEAPON_SLOT_PATHS,
  WEAPON_SLOT_STRING_PARAMS,
} from '../src/config/editorParameters.js';
import { CUSTOM_PARAMETER_CATALOG } from '../src/config/customParameters.js';
import { UNIT_BEHAVIOR_CONTROLS } from '../src/config/behaviorInterceptor.js';
import { getParameterHelp } from '../src/config/parameterGuidance.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSourcePath = path.join(projectRoot, 'src/components/editor/EditUnitsWorkspace.jsx');
const behaviorSourcePath = path.join(projectRoot, 'src/components/editor/BehaviorInterceptorEditor.jsx');
const defaultsPath = path.join(projectRoot, 'src/data/unit-defaults.json');

const UNIT_STRUCTURAL_KEYS = new Set([
  'weaponSlots',
  'weapon1def',
  'weapon1Damage',
  'weapon1Reload',
  'weapon1Range',
  'weapon1Velocity',
  'weapon1Flighttime',
  'weapon1Aoe',
  'weapon1Accuracy',
  'weapon1Sprayangle',
  'weapon1Projectiles',
  'weapon1Burst',
  'weapon1Burstrate',
]);
const WEAPON_STRUCTURAL_KEYS = new Set(['slot', 'defKey']);
const TARGET_MASK_KEYS = new Set(['onlytargetcategory', 'badtargetcategory']);
const NUMERIC_TEXT_CONTROLS = new Set(['hightrajectory']);
const VALID_PARAMETER_TYPES = new Set(['number', 'boolean', 'string', 'text', 'tri-state']);

function readText(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function unique(values) {
  return [...new Set(values)];
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  values.forEach(value => {
    if (seen.has(value)) repeated.add(value);
    seen.add(value);
  });
  return sorted(repeated);
}

function findSourceSection(source, startMarker, endMarker, label, blockers) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0 || end <= start) {
    blockers.push(`${label} could not be located; update the audit source markers.`);
    return '';
  }
  return source.slice(start, end);
}

function extractInlineWeaponParameters(source, blockers) {
  const section = findSourceSection(
    source,
    'const slotParams = [',
    'const activeSlotTweaks',
    'Edit Units weapon parameter catalog',
    blockers,
  );
  const parameters = [];
  const pattern = /\{\s*key:\s*'([^']+)'[\s\S]*?label:\s*'([^']+)'[\s\S]*?type:\s*'([^']+)'/g;
  let match;
  while ((match = pattern.exec(section)) !== null) {
    parameters.push({ key: match[1], label: match[2], type: match[3], owner: 'Edit Units workspace' });
  }
  if (parameters.length === 0) {
    blockers.push('No inline weapon controls were discovered in EditUnitsWorkspace.jsx.');
  }
  return parameters;
}

function extractBehaviorWeaponKeys(source) {
  const keys = new Set();
  const patterns = [
    /setWeapon\('([^']+)'/g,
    /weaponValue\('([^']+)'/g,
    /weaponModified\('([^']+)'/g,
    /parameterKey="([^"]+)"/g,
  ];
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(source)) !== null) keys.add(match[1]);
  });
  return keys;
}

function collectSnapshotKeys(defaultsDb) {
  const units = Object.values(defaultsDb);
  return {
    units,
    unitKeys: new Set(units.flatMap(unit => Object.keys(unit || {}))),
    weaponKeys: new Set(units.flatMap(unit => (
      Array.isArray(unit?.weaponSlots)
        ? unit.weaponSlots.flatMap(slot => Object.keys(slot || {}))
        : []
    ))),
  };
}

function buildWeaponCatalog(workspaceSource, behaviorSource, blockers) {
  const inlineParameters = extractInlineWeaponParameters(workspaceSource, blockers);
  const spawnerParameters = SPAWNER_CARRIER_WEAPON_GROUPS.flatMap(group => (
    group.params.map(parameter => ({
      ...parameter,
      owner: `Shared catalog: ${group.title}`,
    }))
  ));
  const behaviorKeys = extractBehaviorWeaponKeys(behaviorSource);
  const catalog = [...inlineParameters, ...spawnerParameters];
  const coveredKeys = new Set(catalog.map(parameter => parameter.key));
  behaviorKeys.forEach(key => coveredKeys.add(key));
  TARGET_MASK_KEYS.forEach(key => coveredKeys.add(key));
  return { catalog, coveredKeys, behaviorKeys };
}

function getExplicitHelpGaps(parameters) {
  return parameters
    .filter(parameter => {
      const help = getParameterHelp(parameter.key, parameter.label);
      return help === `${parameter.label}. Enter a value to create an override; clear or reset it to return to the inherited game value.`;
    })
    .map(parameter => parameter.key);
}

function formatList(values, limit = 16) {
  if (values.length === 0) return 'none';
  if (values.length <= limit) return values.join(', ');
  return `${values.slice(0, limit).join(', ')} (+${values.length - limit} more)`;
}

export function auditParameterCompleteness({
  defaultsDb,
  workspaceSource,
  behaviorSource,
} = {}) {
  const blockers = [];
  const warnings = [];
  const loadedDefaults = defaultsDb || JSON.parse(readText(defaultsPath));
  const workspace = workspaceSource ?? readText(workspaceSourcePath);
  const behavior = behaviorSource ?? readText(behaviorSourcePath);
  const snapshot = collectSnapshotKeys(loadedDefaults);
  const weaponCatalog = buildWeaponCatalog(workspace, behavior, blockers);

  const statKeys = STAT_KEYS.map(parameter => parameter.key);
  const customKeys = CUSTOM_PARAMETER_CATALOG.map(parameter => `customparams.${parameter.key}`);
  const unitCatalogKeys = new Set([...statKeys, ...customKeys]);
  const unitSnapshotFields = sorted(
    [...snapshot.unitKeys].filter(key => !UNIT_STRUCTURAL_KEYS.has(key)),
  );
  const weaponSnapshotFields = sorted(
    [...snapshot.weaponKeys].filter(key => !WEAPON_STRUCTURAL_KEYS.has(key)),
  );

  const duplicateUnitKeys = duplicates(statKeys);
  const duplicateCustomKeys = duplicates(customKeys);
  const duplicateWeaponKeys = duplicates(weaponCatalog.catalog.map(parameter => parameter.key));
  const invalidUnitMetadata = STAT_KEYS
    .filter(parameter => (
      !parameter.key
      || !parameter.label
      || !parameter.icon
      || !['number', 'boolean', 'string'].includes(parameter.type)
    ))
    .map(parameter => parameter.key || '(missing key)');
  const invalidCustomMetadata = CUSTOM_PARAMETER_CATALOG
    .filter(parameter => (
      !parameter.key
      || !parameter.label
      || !parameter.description
      || !['number', 'boolean', 'string'].includes(parameter.type)
    ))
    .map(parameter => parameter.key || '(missing key)');
  const invalidWeaponMetadata = weaponCatalog.catalog
    .filter(parameter => (
      !parameter.key
      || !parameter.label
      || !VALID_PARAMETER_TYPES.has(parameter.type)
    ))
    .map(parameter => parameter.key || '(missing key)');

  const uncoveredUnitSnapshotFields = unitSnapshotFields.filter(key => !unitCatalogKeys.has(key));
  const uncoveredWeaponSnapshotFields = weaponSnapshotFields.filter(key => !weaponCatalog.coveredKeys.has(key));
  const unitFieldsWithoutSourceOrDefault = STAT_KEYS
    .filter(parameter => (
      !snapshot.unitKeys.has(parameter.key)
      && parameter.engineDefault === undefined
      && parameter.output !== 'tweakdefs'
    ))
    .map(parameter => parameter.key);

  const behaviorUnitKeysOutsideCatalog = UNIT_BEHAVIOR_CONTROLS
    .map(control => control.key)
    .filter(key => !unitCatalogKeys.has(key));

  const typeSets = [
    ['boolean', WEAPON_SLOT_BOOLEAN_PARAMS],
    ['string', WEAPON_SLOT_STRING_PARAMS],
    ['mount', WEAPON_SLOT_MOUNT_PARAMS],
  ];
  const conflictingCompilerTypes = [];
  for (let left = 0; left < typeSets.length; left += 1) {
    for (let right = left + 1; right < typeSets.length; right += 1) {
      const overlap = sorted([...typeSets[left][1]].filter(key => typeSets[right][1].has(key)));
      overlap.forEach(key => conflictingCompilerTypes.push(
        `${key} (${typeSets[left][0]} and ${typeSets[right][0]})`,
      ));
    }
  }

  const weaponTypesByKey = new Map();
  weaponCatalog.catalog.forEach(parameter => {
    if (!weaponTypesByKey.has(parameter.key)) weaponTypesByKey.set(parameter.key, new Set());
    weaponTypesByKey.get(parameter.key).add(parameter.type);
  });
  const unclassifiedBooleanControls = sorted(
    [...weaponTypesByKey]
      .filter(([key, types]) => (
        [...types].some(type => type === 'boolean' || type === 'tri-state')
        && !WEAPON_SLOT_BOOLEAN_PARAMS.has(key)
        && !WEAPON_SLOT_MOUNT_PARAMS.has(key)
      ))
      .map(([key]) => key),
  );
  const unclassifiedStringControls = sorted(
    [...weaponTypesByKey]
      .filter(([key, types]) => (
        [...types].some(type => type === 'string' || type === 'text')
        && !WEAPON_SLOT_STRING_PARAMS.has(key)
        && !WEAPON_SLOT_MOUNT_PARAMS.has(key)
        && !TARGET_MASK_KEYS.has(key)
        && !NUMERIC_TEXT_CONTROLS.has(key)
      ))
      .map(([key]) => key),
  );

  const compilerOnlyKeys = sorted(unique([
    ...WEAPON_SLOT_BOOLEAN_PARAMS,
    ...WEAPON_SLOT_STRING_PARAMS,
    ...WEAPON_SLOT_MOUNT_PARAMS,
    ...Object.keys(WEAPON_SLOT_PATHS),
  ]).filter(key => !weaponCatalog.coveredKeys.has(key)));
  const editorOnlyWeaponKeys = sorted(
    [...weaponCatalog.coveredKeys].filter(key => (
      !snapshot.weaponKeys.has(key)
      && !WEAPON_SLOT_BOOLEAN_PARAMS.has(key)
      && !WEAPON_SLOT_STRING_PARAMS.has(key)
      && !WEAPON_SLOT_MOUNT_PARAMS.has(key)
      && !Object.hasOwn(WEAPON_SLOT_PATHS, key)
      && !TARGET_MASK_KEYS.has(key)
    )),
  );

  const explicitUnitHelpGaps = getExplicitHelpGaps(STAT_KEYS);
  const explicitWeaponHelpGaps = getExplicitHelpGaps(
    weaponCatalog.catalog.filter(parameter => parameter.label),
  );

  [
    ['duplicate unit parameter keys', duplicateUnitKeys],
    ['duplicate custom-parameter keys', duplicateCustomKeys],
    ['duplicate rendered weapon keys', duplicateWeaponKeys],
    ['invalid unit parameter metadata', invalidUnitMetadata],
    ['invalid custom-parameter metadata', invalidCustomMetadata],
    ['invalid weapon parameter metadata', invalidWeaponMetadata],
    ['snapshot unit fields without editor coverage', uncoveredUnitSnapshotFields],
    ['snapshot weapon fields without editor coverage', uncoveredWeaponSnapshotFields],
    ['unit fields without snapshot data or an engine default', unitFieldsWithoutSourceOrDefault],
    ['behavior controls outside the unit catalog', behaviorUnitKeysOutsideCatalog],
    ['conflicting weapon compiler types', conflictingCompilerTypes],
    ['boolean weapon controls without compiler typing', unclassifiedBooleanControls],
    ['string weapon controls without compiler typing', unclassifiedStringControls],
  ].forEach(([label, values]) => {
    if (values.length > 0) blockers.push(`${label}: ${formatList(values)}`);
  });

  if (compilerOnlyKeys.length > 0) {
    warnings.push(`compiler-only weapon fields: ${formatList(compilerOnlyKeys)}`);
  }
  if (editorOnlyWeaponKeys.length > 0) {
    warnings.push(`editor-only engine fields using identity-path compilation: ${formatList(editorOnlyWeaponKeys)}`);
  }
  if (explicitUnitHelpGaps.length > 0) {
    warnings.push(`unit parameters using generic help: ${formatList(explicitUnitHelpGaps)}`);
  }
  if (explicitWeaponHelpGaps.length > 0) {
    warnings.push(`weapon parameters using generic help: ${formatList(explicitWeaponHelpGaps)}`);
  }

  return {
    ok: blockers.length === 0,
    counts: {
      units: snapshot.units.length,
      unitParameters: STAT_KEYS.length,
      customParameters: CUSTOM_PARAMETER_CATALOG.length,
      renderedWeaponParameters: weaponCatalog.coveredKeys.size,
      snapshotUnitFields: unitSnapshotFields.length,
      snapshotWeaponFields: weaponSnapshotFields.length,
      behaviorWeaponFields: weaponCatalog.behaviorKeys.size,
    },
    blockers,
    warnings,
  };
}

function printReport(report) {
  const { counts } = report;
  console.log('BAR parameter completeness audit');
  console.log(`  Snapshot units: ${counts.units}`);
  console.log(`  Unit parameter metadata: ${counts.unitParameters}`);
  console.log(`  Advanced custom parameters: ${counts.customParameters}`);
  console.log(`  Editable weapon controls: ${counts.renderedWeaponParameters}`);
  console.log(`  Snapshot fields: ${counts.snapshotUnitFields} unit / ${counts.snapshotWeaponFields} weapon`);
  console.log(`  Secondary behavior/interceptor fields: ${counts.behaviorWeaponFields}`);

  report.warnings.forEach(warning => console.warn(`  Advisory: ${warning}`));
  report.blockers.forEach(blocker => console.error(`  ERROR: ${blocker}`));
  console.log(report.ok
    ? 'Parameter coverage is complete across snapshot, metadata, UI, and compiler schemas.'
    : `Parameter completeness failed with ${report.blockers.length} blocking issue(s).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditParameterCompleteness();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printReport(report);
  }
  if (!report.ok) process.exitCode = 1;
}
