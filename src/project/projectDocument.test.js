import { describe, expect, it } from 'vitest';
import {
  MAX_PROJECT_BYTES,
  PROJECT_DOCUMENT_VERSION,
  ProjectDocumentError,
  assertProjectSize,
  normalizeProjectDocument,
} from './projectDocument.js';

describe('project documents', () => {
  it('normalizes legacy projects while preserving format 1.4', () => {
    const project = normalizeProjectDocument({
      version: '1.0',
      tweaks: { ARMDFLY: { health: 1200 } },
      clones: [{ baseId: 'ARMDFLY', newId: 'MY_CLONE', name: 'Clone' }],
      disabledUnitIds: ['ARMDFLY', '../bad'],
      buildMenuSteps: [{ builderId: 'ARMLAB', add: ['MY_CLONE'], remove: [] }],
    });

    expect(project.version).toBe(PROJECT_DOCUMENT_VERSION);
    expect(project.tweaks.armdfly.health).toBe(1200);
    expect(project.clones[0]).toMatchObject({ baseId: 'armdfly', newId: 'my_clone' });
    expect(project.disabledUnitIds).toEqual(['armdfly']);
    expect(project.buildMenuSteps[0].builderId).toBe('armlab');
  });

  it('rejects oversized projects before changing state', () => {
    expect(() => assertProjectSize('x'.repeat(MAX_PROJECT_BYTES + 1)))
      .toThrow(ProjectDocumentError);
  });
});
