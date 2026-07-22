import { describe, expect, it } from 'vitest';
import { buildCompatibilityPreflight } from './compatibilityPreflight.js';
import { compileLobbyModules } from './lobbyModules.js';
import { parseLobbySetupBundle } from './lobbySetupBundle.js';
import { analyzeTweakModule, analyzeTweakPackage, parseTweakPackageInput } from './tweakPackage.js';
import { encodeLobbyBase64 } from './tweakSerializer.js';
import {
  createSanitizedLobbyBundle,
  createSanitizedReferenceModules,
  SANITIZED_REFERENCE_FIXTURES,
  SANITIZED_REFERENCE_POLICY,
} from '../../tests/fixtures/sanitizedReferencePackage.js';

const KNOWN_BAR_REFERENCES = [
  'armlab', 'armflea', 'armck', 'armfav', 'armrock',
];

describe('sanitized real-world reference fixtures', () => {
  it('contains exactly nine neutral modules in each BAR delivery lane', () => {
    expect(SANITIZED_REFERENCE_POLICY).toMatchObject({
      namespace: 'editp_fixture_',
      sourceCodeCopied: false,
      maximumDefsSlots: 9,
      maximumUnitsSlots: 9,
    });
    expect(SANITIZED_REFERENCE_FIXTURES.defs).toHaveLength(9);
    expect(SANITIZED_REFERENCE_FIXTURES.units).toHaveLength(9);

    const fixtures = [...SANITIZED_REFERENCE_FIXTURES.defs, ...SANITIZED_REFERENCE_FIXTURES.units];
    expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(18);
    fixtures.forEach(fixture => {
      expect(fixture.id).toMatch(/^sanitized-(defs|units)-[1-9]$/);
      expect(fixture.originalFieldName).toMatch(/^tweak(defs|units)[1-9]$/);
      expect(fixture.rawLua.length).toBeGreaterThan(20);
      expect(fixture.rawLua.length).toBeLessThan(4_000);
      expect(fixture.rawLua).not.toMatch(/https?:\/\/|discord|github|copyright|@[a-z0-9]/i);
      expect(fixture.rawLua).not.toMatch(/!bset|\$rename|forceallunits/i);
    });
  });

  it('parses every fixture statically and preserves its declared analyzer signal', () => {
    const fixtures = [...SANITIZED_REFERENCE_FIXTURES.defs, ...SANITIZED_REFERENCE_FIXTURES.units];
    fixtures.forEach(fixture => {
      const parsed = parseTweakPackageInput(fixture.rawLua, { kind: fixture.kind });
      expect(parsed.errors, fixture.label).toEqual([]);
      expect(parsed.modules, fixture.label).toHaveLength(1);
      const analysis = analyzeTweakModule(parsed.modules[0]);
      expect(analysis.parseError, fixture.label).toBeNull();

      const expected = fixture.expected;
      if (expected.createdUnits) {
        expect(analysis.createdUnits, fixture.label).toEqual(expect.arrayContaining(expected.createdUnits));
      }
      if (expected.buildMenuOperations != null) {
        expect(analysis.buildMenuOperations, fixture.label).toBeGreaterThanOrEqual(expected.buildMenuOperations);
      }
      if (expected.literalUnitTables != null) {
        expect(analysis.literalUnitTables, fixture.label).toBe(expected.literalUnitTables);
      }
      if (expected.literalWeaponDefinitions != null) {
        expect(analysis.literalWeaponDefinitions, fixture.label).toBe(expected.literalWeaponDefinitions);
      }
      if (expected.helperRecipes != null) {
        expect(analysis.recipes.length, fixture.label).toBeGreaterThanOrEqual(expected.helperRecipes);
      }
      if (expected.supportingWeaponDefs != null) {
        expect(analysis.supportingWeaponDefs.length, fixture.label).toBeGreaterThanOrEqual(expected.supportingWeaponDefs);
      }
      if (expected.minimumTypeIssues != null) {
        expect(analysis.typeIssues.length, fixture.label).toBeGreaterThanOrEqual(expected.minimumTypeIssues);
      }
      if (expected.minimumAssetReferences != null) {
        expect(analysis.assetReferences.length, fixture.label).toBeGreaterThanOrEqual(expected.minimumAssetReferences);
      }
      if (expected.warningCodes) {
        expect(analysis.warnings.map(warning => warning.code), fixture.label)
          .toEqual(expect.arrayContaining(expected.warningCodes));
      }
    });
  });

  it('exercises package dependencies, risky runtime patterns, and compatibility review', () => {
    const modules = createSanitizedReferenceModules();
    const packageAnalysis = analyzeTweakPackage(modules, { knownUnitIds: KNOWN_BAR_REFERENCES });
    const warningCodes = [...packageAnalysis.analyses.values()]
      .flatMap(analysis => analysis.warnings.map(warning => warning.code));

    expect(packageAnalysis.analyses.size).toBe(18);
    expect(warningCodes).toEqual(expect.arrayContaining([
      'asset-swap', 'global-loop', 'dynamic-id', 'deletion', 'runtime-code',
    ]));
    expect(packageAnalysis.moduleReports.some(report => report.typeIssues.length >= 2)).toBe(true);
    expect(packageAnalysis.moduleReports.some(report => report.assetReferences.length >= 3)).toBe(true);

    const compiledModules = compileLobbyModules({
      tweakModules: modules,
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });
    const preflight = buildCompatibilityPreflight({
      compiledModules,
      tweakModules: modules,
      packageAnalysis,
      knownUnitIds: KNOWN_BAR_REFERENCES,
    });
    expect(preflight.activeModuleCount).toBe(18);
    expect(preflight.status).toBe('review');
    expect(preflight.canCopyLobbyCommands).toBe(true);
    expect(preflight.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ group: 'assets', level: 'warning' }),
      expect.objectContaining({ group: 'modules', level: 'warning' }),
    ]));
  });

  it('fills all nine defs and all nine units slots without inventing a tenth field', () => {
    const compiled = compileLobbyModules({
      tweakModules: createSanitizedReferenceModules(),
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    expect(compiled.overflow).toBe(false);
    expect(compiled.defs).toMatchObject({ required: 9, maximum: 9, overflow: false });
    expect(compiled.units).toMatchObject({ required: 9, maximum: 9, overflow: false });
    expect(compiled.defs.slots.map(slot => slot.fieldName)).toEqual(
      Array.from({ length: 9 }, (_, index) => `tweakdefs${index + 1}`),
    );
    expect(compiled.units.slots.map(slot => slot.fieldName)).toEqual(
      Array.from({ length: 9 }, (_, index) => `tweakunits${index + 1}`),
    );
    expect(compiled.slots.some(slot => /10$/.test(slot.fieldName))).toBe(false);
  });

  it('round-trips as a full sanitized lobby bundle with no embedded source payloads', () => {
    const input = createSanitizedLobbyBundle(encodeLobbyBase64);
    const result = parseLobbySetupBundle(input, {
      sourceName: 'sanitized-reference-fixture.txt',
      importedAt: '2026-07-22T00:00:00.000Z',
    });

    expect(result.isBundle).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.modules).toHaveLength(18);
    expect(result.modules.filter(module => module.kind === 'defs')).toHaveLength(9);
    expect(result.modules.filter(module => module.kind === 'units')).toHaveLength(9);
    expect(result.lobbySetup.commands).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'preset', value: 'coop' }),
      expect.objectContaining({ name: 'bset', key: 'maxunits', value: '3000' }),
      expect.objectContaining({ name: 'rename', value: 'BAR Editor synthetic fixture' }),
    ]));
  });
});
