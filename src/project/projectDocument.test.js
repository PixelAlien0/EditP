import { describe, expect, it } from 'vitest';
import {
  MAX_PROJECT_BYTES,
  PROJECT_DOCUMENT_VERSION,
  ProjectDocumentError,
  assertProjectSize,
  normalizeProjectDocument,
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

  it('migrates imported tweak modules into version 1.6 projects', () => {
    const project = normalizeProjectDocument({
      version: '1.5',
      tweakModules: [{
        id: 'defs-a', kind: 'defs', label: 'Imported definitions', rawLua: 'local a = true',
        enabled: true, stage: 'after-editor', order: 4, contentHash: 'abc',
        requirements: ['forceallunits', 'forceallunits'],
      }],
    });
    expect(project.version).toBe('1.6');
    expect(project.tweakModules).toEqual([expect.objectContaining({
      id: 'defs-a', kind: 'defs', enabled: true, stage: 'after-editor', order: 4,
      requirements: ['forceallunits'],
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
});
