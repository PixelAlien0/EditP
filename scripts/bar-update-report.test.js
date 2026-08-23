import { describe, expect, it } from 'vitest';
import { buildBarUpdateReport, diffRecords } from './bar-update-report.mjs';

describe('BAR update report', () => {
  it('classifies additions, removals, and semantic changes deterministically', () => {
    expect(diffRecords(
      { alpha: { hp: 100 }, beta: { hp: 200 } },
      { alpha: { hp: 125 }, gamma: { hp: 300 } },
    )).toMatchObject({
      addedCount: 1,
      removedCount: 1,
      changedCount: 1,
      added: ['gamma'],
      removed: ['beta'],
      changed: ['alpha'],
    });
  });

  it('separates gameplay changes from delivery-only refreshes', () => {
    const files = {
      'unit-defaults.json': { armtest: { health: 100 } },
      'units.json': { names: { armtest: 'Test' }, descriptions: { armtest: 'Unit' } },
      'factory-rosters.json': {},
      'explosion-profiles.json': {},
      'unitpic-manifest.json': { units: { armtest: '/old.webp' } },
      'tactical-icon-manifest.json': { icons: {} },
      'bar-asset-manifest.json': { categories: {} },
      'custom-parameter-discovery.json': { parameters: {} },
    };
    const current = { ...files, 'unitpic-manifest.json': { units: { armtest: '/new.webp' } } };
    const report = buildBarUpdateReport({
      currentManifest: { snapshotId: 'new', sourceCommit: 'b', counts: {} },
      previousManifest: { snapshotId: 'old', sourceCommit: 'a', counts: {} },
      currentRead: file => current[file],
      previousRead: file => files[file],
    });

    expect(report.summary.gameplay.changedDatasets).toBe(0);
    expect(report.summary.delivery.changedDatasets).toBe(1);
    expect(report.datasets.find(dataset => dataset.id === 'artwork')).toMatchObject({ changedCount: 1 });
  });
});
