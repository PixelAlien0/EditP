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
    expect(project.forceAllUnits).toBe(false);
    expect(project.unitCollections[0]).toMatchObject({
      id: 'balance',
      name: 'Balance pass',
      unitIds: ['armdfly', 'my_clone'],
    });
  });

  it('preserves the force-load game setup option without enabling it for older projects', () => {
    expect(normalizeProjectDocument({ version: '1.5' }).forceAllUnits).toBe(false);
    expect(normalizeProjectDocument({ version: '1.6', forceAllUnits: true }).forceAllUnits).toBe(true);
  });

  it('rejects oversized projects before changing state', () => {
    expect(() => assertProjectSize('x'.repeat(MAX_PROJECT_BYTES + 1)))
      .toThrow(ProjectDocumentError);
  });
});
