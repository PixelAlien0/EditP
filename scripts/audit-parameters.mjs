import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STAT_KEYS } from '../src/config/editorParameters.js';
import {
  WEAPON_EDITABLE_PARAMETER_CATALOG,
  WEAPON_COMPATIBILITY_PARAMETERS,
  WEAPON_PARAMETER_CATALOG,
  WEAPON_SLOT_BOOLEAN_PARAMS,
  WEAPON_SLOT_MOUNT_PARAMS,
  WEAPON_SLOT_PATHS,
  WEAPON_SLOT_STRING_PARAMS,
} from '../src/config/weaponParameters.js';
import {
  CUSTOM_PARAMETER_CATALOG,
  CUSTOM_PARAMETER_DISCOVERY,
  CUSTOM_PARAMETER_REGISTRY,
} from '../src/config/customParameters.js';
import {
  CUSTOM_PARAMETER_PROMOTION_ORDER,
  CUSTOM_PARAMETER_RUNTIME_EVIDENCE,
} from '../src/config/customParameterPromotion.js';
import gameDataManifest from '../src/data/game-data-manifest.json' with { type: 'json' };
import { UNIT_BEHAVIOR_CONTROLS } from '../src/config/behaviorInterceptor.js';
import { getParameterHelp } from '../src/config/parameterGuidance.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
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

function buildWeaponCatalog() {
  const catalog = WEAPON_EDITABLE_PARAMETER_CATALOG;
  const compilerCatalog = WEAPON_PARAMETER_CATALOG;
  const coveredKeys = new Set(catalog.map(parameter => parameter.key));
  const compilerKeys = new Set(compilerCatalog.map(parameter => parameter.key));
  const behaviorKeys = new Set(
    catalog.filter(parameter => parameter.surface === 'behavior').map(parameter => parameter.key),
  );
  return { catalog, compilerCatalog, coveredKeys, compilerKeys, behaviorKeys };
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
} = {}) {
  const blockers = [];
  const warnings = [];
  const loadedDefaults = defaultsDb || JSON.parse(readText(defaultsPath));
  const snapshot = collectSnapshotKeys(loadedDefaults);
  const weaponCatalog = buildWeaponCatalog();

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
  const duplicateRegistryIds = duplicates(CUSTOM_PARAMETER_REGISTRY.map(parameter => parameter.id));
  const duplicateWeaponKeys = duplicates(WEAPON_PARAMETER_CATALOG.map(parameter => parameter.key));
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
  const invalidRegistryMetadata = CUSTOM_PARAMETER_REGISTRY
    .filter(parameter => (
      !parameter.id
      || !parameter.key
      || !parameter.scope
      || !parameter.label
      || !parameter.owner
      || !parameter.description
      || !['number', 'boolean', 'string'].includes(parameter.type)
    ))
    .map(parameter => parameter.id || parameter.key || '(missing id)');
  const invalidPromotionMetadata = CUSTOM_PARAMETER_REGISTRY
    .filter(parameter => (
      !parameter.promotion
      || !CUSTOM_PARAMETER_PROMOTION_ORDER.includes(parameter.promotion.id)
      || !Number.isInteger(parameter.promotion.rank)
      || !parameter.promotion.label
      || !parameter.promotion.description
      || !parameter.promotion.nextRequirement
      || !Array.isArray(parameter.promotion.evidence)
      || !Array.isArray(parameter.promotion.runtimeFixtureIds)
    ))
    .map(parameter => parameter.id || parameter.key || '(missing id)');
  const missingRuntimeEvidence = Object.keys(CUSTOM_PARAMETER_RUNTIME_EVIDENCE)
    .filter(key => !CUSTOM_PARAMETER_REGISTRY.some(parameter => (
      parameter.scope === 'weapon'
      && parameter.key === key
      && parameter.promotion.id === 'runtime-tested'
    )));
  const brokenPromotionChains = CUSTOM_PARAMETER_REGISTRY
    .filter(parameter => {
      const kinds = new Set(parameter.promotion.evidence.map(item => item.kind));
      return (parameter.promotion.rank >= 1 && !kinds.has('review'))
        || (parameter.promotion.rank >= 2 && !kinds.has('documentation'))
        || (parameter.promotion.rank >= 3 && !kinds.has('editor'))
        || (parameter.promotion.rank >= 4 && !kinds.has('runtime'));
    })
    .map(parameter => parameter.id);
  const discoveryCommitMismatch = CUSTOM_PARAMETER_DISCOVERY.sourceCommit !== gameDataManifest.sourceCommit
    ? [`${CUSTOM_PARAMETER_DISCOVERY.sourceCommit || 'missing'} != ${gameDataManifest.sourceCommit}`]
    : [];
  const registryObservedCount = CUSTOM_PARAMETER_REGISTRY.filter(parameter => parameter.observed).length;
  const discoveryCoverageMismatch = registryObservedCount !== CUSTOM_PARAMETER_DISCOVERY.counts.totalParameters
    ? [`registry ${registryObservedCount}, discovery ${CUSTOM_PARAMETER_DISCOVERY.counts.totalParameters}`]
    : [];
  const invalidWeaponMetadata = WEAPON_PARAMETER_CATALOG
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

  const unclassifiedBooleanControls = sorted(
    weaponCatalog.catalog
      .filter(parameter => (
        parameter.valueType === 'boolean'
        && !WEAPON_SLOT_BOOLEAN_PARAMS.has(parameter.key)
        && !WEAPON_SLOT_MOUNT_PARAMS.has(parameter.key)
      ))
      .map(parameter => parameter.key),
  );
  const unclassifiedStringControls = sorted(
    weaponCatalog.catalog
      .filter(parameter => (
        parameter.valueType === 'string'
        && !WEAPON_SLOT_STRING_PARAMS.has(parameter.key)
        && !WEAPON_SLOT_MOUNT_PARAMS.has(parameter.key)
      ))
      .map(parameter => parameter.key),
  );

  const compilerOnlyKeys = sorted(unique([
    ...WEAPON_SLOT_BOOLEAN_PARAMS,
    ...WEAPON_SLOT_STRING_PARAMS,
    ...WEAPON_SLOT_MOUNT_PARAMS,
    ...Object.keys(WEAPON_SLOT_PATHS),
  ]).filter(key => !weaponCatalog.compilerKeys.has(key)));
  const editorOnlyWeaponKeys = sorted(
    [...weaponCatalog.coveredKeys].filter(key => (
      !snapshot.weaponKeys.has(key)
      && !WEAPON_SLOT_BOOLEAN_PARAMS.has(key)
      && !WEAPON_SLOT_STRING_PARAMS.has(key)
      && !WEAPON_SLOT_MOUNT_PARAMS.has(key)
      && !Object.hasOwn(WEAPON_SLOT_PATHS, key)
    )),
  );

  const explicitUnitHelpGaps = getExplicitHelpGaps(STAT_KEYS);
  const explicitWeaponHelpGaps = getExplicitHelpGaps(
    weaponCatalog.catalog.filter(parameter => parameter.label),
  );

  [
    ['duplicate unit parameter keys', duplicateUnitKeys],
    ['duplicate custom-parameter keys', duplicateCustomKeys],
    ['duplicate custom-parameter registry IDs', duplicateRegistryIds],
    ['duplicate rendered weapon keys', duplicateWeaponKeys],
    ['invalid unit parameter metadata', invalidUnitMetadata],
    ['invalid custom-parameter metadata', invalidCustomMetadata],
    ['invalid custom-parameter registry metadata', invalidRegistryMetadata],
    ['invalid custom-parameter promotion metadata', invalidPromotionMetadata],
    ['runtime evidence without a promoted weapon contract', missingRuntimeEvidence],
    ['custom-parameter promotions with incomplete evidence chains', brokenPromotionChains],
    ['custom-parameter discovery commit mismatch', discoveryCommitMismatch],
    ['custom-parameter discovery coverage mismatch', discoveryCoverageMismatch],
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
      customParameterRegistry: CUSTOM_PARAMETER_REGISTRY.length,
      discoveredCustomParameters: CUSTOM_PARAMETER_DISCOVERY.counts.totalParameters,
      customParameterPromotion: Object.fromEntries(CUSTOM_PARAMETER_PROMOTION_ORDER.map(stageId => [
        stageId,
        CUSTOM_PARAMETER_REGISTRY.filter(parameter => parameter.promotion.id === stageId).length,
      ])),
      renderedWeaponParameters: weaponCatalog.coveredKeys.size,
      snapshotUnitFields: unitSnapshotFields.length,
      snapshotWeaponFields: weaponSnapshotFields.length,
      behaviorWeaponFields: weaponCatalog.behaviorKeys.size,
      compatibilityWeaponFields: WEAPON_COMPATIBILITY_PARAMETERS.length,
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
  console.log(`  Contract promotion: ${CUSTOM_PARAMETER_PROMOTION_ORDER.map(stageId => `${stageId} ${counts.customParameterPromotion[stageId]}`).join(' / ')}`);
  console.log(`  Editable weapon controls: ${counts.renderedWeaponParameters}`);
  console.log(`  Snapshot fields: ${counts.snapshotUnitFields} unit / ${counts.snapshotWeaponFields} weapon`);
  console.log(`  Secondary behavior/interceptor fields: ${counts.behaviorWeaponFields}`);
  console.log(`  Legacy compatibility fields: ${counts.compatibilityWeaponFields}`);

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
