import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { COMPILER_REGRESSION_FIXTURES } from '../../tests/fixtures/compilerRegressionProjects.js';
import { createSanitizedReferenceModules } from '../../tests/fixtures/sanitizedReferencePackage.js';
import { validateCompiledLobbyModules } from './compilerValidation.js';
import { buildLobbyCommands, compileLobbyModules } from './lobbyModules.js';

function commandHash(compiled) {
  return createHash('sha256').update(buildLobbyCommands(compiled), 'utf8').digest('hex');
}

describe('canonical compiler semantic validation', () => {
  it.each(COMPILER_REGRESSION_FIXTURES)('keeps $id semantically valid and byte-stable', fixture => {
    const compiled = compileLobbyModules(fixture.projectState);
    const validation = validateCompiledLobbyModules(compiled);

    expect(validation).toMatchObject({
      status: 'ready',
      isValid: true,
      canExport: true,
      counts: { blocker: 0, warning: 0, info: 0 },
    });
    expect(compiled.defs.required).toBe(fixture.expected.defsSlots);
    expect(compiled.units.required).toBe(fixture.expected.unitsSlots);
    expect(compiled.canonicalBlocks.all.map(block => block.category)).toEqual(fixture.expected.categories);
    expect(commandHash(compiled)).toBe(fixture.expected.commandSha256);
  });

  it('accepts the sanitized nine-by-nine BAR package as structurally sound', () => {
    const compiled = compileLobbyModules({
      tweakModules: createSanitizedReferenceModules(),
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
      base64Options: { padding: false },
    });

    const validation = validateCompiledLobbyModules(compiled);
    expect(validation.isValid).toBe(true);
    expect(validation.checkedBlockCount).toBe(18);
    expect(validation.checkedSlotCount).toBe(18);
  });

  it('does not fabricate a generated unit block for a formatted empty table', () => {
    const compiled = compileLobbyModules({
      tweakModules: [
        {
          id: 'valid-defs', kind: 'defs', stage: 'before-editor', order: 0,
          label: 'Valid definitions',
          rawLua: 'UnitDefs["editp_lab_test"] = table.copy(UnitDefs["armflea"], true)',
          enabled: true, converted: false,
        },
      ],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '{\n}',
    });

    expect(compiled.canonicalBlocks.units).toEqual([]);
    expect(compiled.units.required).toBe(0);
    expect(validateCompiledLobbyModules(compiled)).toMatchObject({
      status: 'ready',
      isValid: true,
      canExport: true,
      counts: { blocker: 0 },
    });
  });

  it('blocks invalid Lua and a non-table Units payload', () => {
    const compiled = compileLobbyModules({
      tweakModules: [
        {
          id: 'bad-defs', kind: 'defs', stage: 'before-editor', order: 0,
          label: 'Bad definitions', rawLua: 'if UnitDefs.armflash then', enabled: true, converted: false,
        },
        {
          id: 'bad-units', kind: 'units', stage: 'before-editor', order: 0,
          label: 'Bad units', rawLua: '"armflash"', enabled: true, converted: false,
        },
      ],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
    });

    const validation = validateCompiledLobbyModules(compiled);
    expect(validation).toMatchObject({ status: 'blocked', isValid: false, canExport: false });
    expect(validation.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'lua-syntax',
      'units-table-shape',
      'slot-lua-syntax',
    ]));
  });

  it('blocks encoded lobby fields above 16,384 characters', () => {
    const compiled = compileLobbyModules({
      tweakModules: [{
        id: 'oversized-defs', kind: 'defs', stage: 'before-editor', order: 0,
        label: 'Oversized definitions',
        rawLua: `local payload = "${'x'.repeat(13000)}"`,
        enabled: true, converted: false,
      }],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
    });

    const validation = validateCompiledLobbyModules(compiled);
    expect(validation.canExport).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'lobby-field-size-limit', level: 'blocker' }),
    ]));
  });

  it('detects payload tampering, duplicate coverage, and inconsistent metadata', () => {
    const compiled = compileLobbyModules(COMPILER_REGRESSION_FIXTURES[0].projectState);
    const tampered = structuredClone(compiled);
    tampered.slots[0].encoded = 'tampered';
    tampered.slots[0].command = '!bset tweakdefs1 tampered';
    tampered.slots[0].blockIds.push(tampered.slots[0].blockIds[0]);
    tampered.slots[0].blockCount = tampered.slots[0].blockIds.length;
    tampered.canonicalBlocks.units[0].metadata.unitId = 'wrong_unit';
    tampered.canonicalBlocks.all = [
      ...tampered.canonicalBlocks.defs,
      ...tampered.canonicalBlocks.units,
    ];

    const validation = validateCompiledLobbyModules(tampered);
    expect(validation.isValid).toBe(false);
    expect(validation.issues.map(issue => issue.code)).toEqual(expect.arrayContaining([
      'encoded-payload-mismatch',
      'duplicate-block-coverage',
      'generated-unit-identity',
    ]));
  });

  it('accepts exact duplicate provenance and rejects unsafe deduplication claims', () => {
    const duplicateLua = 'local exact_duplicate = true';
    const compiled = compileLobbyModules({
      tweakModules: [
        {
          id: 'duplicate-a', kind: 'defs', stage: 'before-editor', order: 0,
          label: 'Duplicate A', rawLua: duplicateLua, enabled: true, converted: false,
        },
        {
          id: 'duplicate-b', kind: 'defs', stage: 'before-editor', order: 1,
          label: 'Duplicate B', rawLua: duplicateLua, enabled: true, converted: false,
        },
      ],
      generatedTweakDefsLua: '',
      generatedTweakUnitsLua: '',
    });
    expect(validateCompiledLobbyModules(compiled).isValid).toBe(true);

    const tampered = structuredClone(compiled);
    tampered.canonicalBlocks.defs[1].lua = 'local different_behavior = true';
    tampered.canonicalBlocks.all = [
      ...tampered.canonicalBlocks.defs,
      ...tampered.canonicalBlocks.units,
    ];
    const validation = validateCompiledLobbyModules(tampered);
    expect(validation.isValid).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'unsafe-deduplication', level: 'blocker' }),
    ]));
  });

  it('accepts guarded compaction evidence and blocks tampered savings claims', () => {
    const compiled = compileLobbyModules(COMPILER_REGRESSION_FIXTURES[0].projectState);
    expect(compiled.compaction.appliedSlotCount).toBeGreaterThan(0);
    expect(validateCompiledLobbyModules(compiled).isValid).toBe(true);

    const tampered = structuredClone(compiled);
    const compactedSlot = tampered.slots.find(slot => slot.compaction?.applied);
    compactedSlot.compaction.rawBytesSaved += 1;
    tampered.compaction.rawBytesSaved += 1;
    const validation = validateCompiledLobbyModules(tampered);

    expect(validation.isValid).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'compaction-byte-count', level: 'blocker' }),
    ]));
  });
});
