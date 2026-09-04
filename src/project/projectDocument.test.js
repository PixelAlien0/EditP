import { describe, expect, it } from 'vitest';
import {
  MAX_PROJECT_BYTES,
  PROJECT_DOCUMENT_VERSION,
  ProjectDocumentError,
  assertProjectSize,
  migrateProjectDocumentWithReport,
  normalizeProjectDocument,
  normalizeProjectDocumentWithReport,
} from './projectDocument.js';

describe('project documents', () => {
  it('migrates legacy projects to the current format and normalizes collections', () => {
    const project = normalizeProjectDocument({
      version: '1.0',
      tweaks: { ARMDFLY: { health: 1200 } },
      clones: [{ baseId: 'ARMDFLY', newId: 'MY_CLONE', name: 'Clone' }],
      disabledUnitIds: ['ARMDFLY', '../bad'],
      buildMenuSteps: [{ builderId: 'ARMLAB', add: ['MY_CLONE'], remove: [] }],
      unitCollections: [{ id: 'BALANCE', name: 'Balance pass', unitIds: ['ARMDFLY', 'MY_CLONE'] }],
    });

    expect(project.version).toBe(PROJECT_DOCUMENT_VERSION);
    expect(project.tweaks.armdfly.health).toBe(1200);
    expect(project.clones[0]).toMatchObject({ baseId: 'armdfly', newId: 'my_clone' });
    expect(project.disabledUnitIds).toEqual(['armdfly']);
    expect(project.buildMenuSteps[0].builderId).toBe('armlab');
    expect(project.unitCollections[0]).toMatchObject({
      id: 'balance',
      name: 'Balance pass',
      unitIds: ['armdfly', 'my_clone'],
    });
  });

  it('rejects oversized projects before changing state', () => {
    expect(() => assertProjectSize('x'.repeat(MAX_PROJECT_BYTES + 1)))
      .toThrow(ProjectDocumentError);
  });

  it('migrates unversioned historical field names through explicit steps', () => {
    const prepared = normalizeProjectDocumentWithReport({
      modifiedUnits: { ARMDFLY: { health: 1500 } },
      customUnits: [{ baseId: 'ARMDFLY', newId: 'OLD_CLONE', name: 'Old clone' }],
      disabledUnits: ['ARMDFLY'],
      rosterChanges: [{ builderId: 'ARMLAB', add: ['OLD_CLONE'] }],
      projectName: 'Recovered legacy project',
    });

    expect(prepared).toMatchObject({
      fromVersion: '1.0',
      toVersion: PROJECT_DOCUMENT_VERSION,
      migrated: true,
      assumedLegacyVersion: true,
    });
    expect(prepared.steps).toHaveLength(9);
    expect(prepared.document.tweaks.armdfly.health).toBe(1500);
    expect(prepared.document.clones[0].newId).toBe('old_clone');
    expect(prepared.document.buildMenuSteps[0].builderId).toBe('armlab');
  });

  it('rejects future project versions instead of silently relabelling them', () => {
    expect(() => migrateProjectDocumentWithReport({
      version: '2.0',
      projectName: 'Future project',
    })).toThrow(expect.objectContaining({
      code: 'PROJECT_VERSION_UNSUPPORTED',
    }));
  });

  it('rejects structurally corrupted fields before project state can be hydrated', () => {
    const corrupted = {
      version: '1.8',
      projectName: 'Do not partially load',
      tweaks: ['not', 'an', 'object'],
      clones: [],
    };
    expect(() => normalizeProjectDocumentWithReport(corrupted)).toThrow(expect.objectContaining({
      code: 'PROJECT_FIELD_INVALID',
    }));
    expect(corrupted.tweaks).toEqual(['not', 'an', 'object']);
  });

  it('reports entries removed during safe normalization', () => {
    const prepared = normalizeProjectDocumentWithReport({
      version: '1.8',
      projectName: 'Repairable',
      clones: [
        { baseId: 'armdfly', newId: 'valid_clone' },
        { baseId: '../bad', newId: 'invalid_clone' },
      ],
    });
    expect(prepared.document.clones).toHaveLength(1);
    expect(prepared.warnings).toContain('Clones: ignored 1 invalid or duplicate entry.');
  });

  it('migrates imported tweak modules into the current project version', () => {
    const project = normalizeProjectDocument({
      version: '1.5',
      tweakModules: [{
        id: 'defs-a', kind: 'defs', label: 'Imported definitions', rawLua: 'local a = true',
        enabled: true, stage: 'after-editor', order: 4, contentHash: 'abc',
        requirements: ['forceallunits', 'forceallunits'],
      }],
    });
    expect(project.version).toBe(PROJECT_DOCUMENT_VERSION);
    expect(project.tweakModules).toEqual([expect.objectContaining({
      id: 'defs-a', kind: 'defs', enabled: true, stage: 'after-editor', order: 4,
      requirements: ['forceallunits'],
    })]);
  });

  it('normalizes supporting WeaponDefs and removes duplicate destinations', () => {
    const project = normalizeProjectDocument({
      version: '1.6',
      supportingWeaponDefs: [
        {
          id: 'Support Child', ownerUnitId: 'ARMFLEA', key: 'CLUSTER_CHILD', label: 'Cluster Child',
          definition: { range: 420, damage: { default: 25 }, customparams: { cluster_def: 'NEXT_CHILD' } },
          role: 'dependency', mountedSlots: [2, 2], enabled: true, alwaysExport: true, mode: 'replace', referencedBy: ['MAIN_GUN'],
        },
        { id: 'duplicate', ownerUnitId: 'armflea', key: 'cluster_child', definition: { range: 1 } },
      ],
    });
    expect(project.version).toBe('1.9');
    expect(project.supportingWeaponDefs).toEqual([expect.objectContaining({
      id: 'support_child', ownerUnitId: 'armflea', key: 'cluster_child', role: 'dependency',
      mountedSlots: [2], dependencies: ['next_child'], referencedBy: ['main_gun'],
      alwaysExport: true,
      definition: { range: 420, damage: { default: 25 }, customparams: { cluster_def: 'NEXT_CHILD' } },
    })]);
  });

  it('preserves modules beyond lobby capacity so overflow can be reported explicitly', () => {
    const tweakModules = Array.from({ length: 19 }, (_, index) => ({
      id: `defs-${index + 1}`,
      kind: 'defs',
      label: `Definitions ${index + 1}`,
      rawLua: `local module_${index + 1} = true`,
      contentHash: `hash-${index + 1}`,
      enabled: true,
      stage: 'before-editor',
      order: index,
    }));
    const project = normalizeProjectDocument({ version: '1.6', tweakModules });
    expect(project.tweakModules).toHaveLength(19);
  });

  it('persists a normalized full lobby setup bundle without retaining invalid commands', () => {
    const project = normalizeProjectDocument({
      version: '1.7',
      lobbySetup: {
        sourceName: 'Community setup.txt',
        importedAt: '2026-07-22T00:00:00.000Z',
        commands: [
          { id: 'map', prefix: '!', name: 'MAP', value: 'Full Metal Plate', raw: '!map Full Metal Plate', line: 5, category: 'map-setup', safety: 'manual' },
          { prefix: '?', name: 'bad', category: 'unsafe' },
        ],
        slotClears: ['TWEAKDEFS9', 'tweakdefs10'],
        slotResetFields: ['tweakunits', 'tweakunits4'],
        requirements: ['forceallunits', 'forceallunits'],
        overwrittenCount: 2,
      },
    });
    expect(project.lobbySetup).toMatchObject({
      sourceName: 'Community setup.txt',
      slotClears: ['tweakdefs9', 'tweakdefs10'],
      slotResetFields: ['tweakunits', 'tweakunits4'],
      requirements: ['forceallunits'],
      overwrittenCount: 2,
    });
    expect(project.lobbySetup.commands).toEqual([expect.objectContaining({
      prefix: '!', name: 'map', category: 'map-setup', safety: 'manual',
    })]);
  });

  it('migrates export optimization profiles and rejects unknown profile names safely', () => {
    const migrated = normalizeProjectDocument({
      version: '1.8',
      projectName: 'Existing project',
    });
    const repaired = normalizeProjectDocument({
      version: '1.9',
      projectName: 'Unknown profile',
      exportOptimizationProfile: 'turbo',
    });

    expect(migrated.exportOptimizationProfile).toBe('balanced');
    expect(repaired.exportOptimizationProfile).toBe('balanced');
  });
});
