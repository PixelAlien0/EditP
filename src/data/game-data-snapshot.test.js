import { describe, expect, it } from 'vitest';
import assetManifest from './bar-asset-manifest.json';
import barUpdateReport from './bar-update-report.json';
import factoryRosters from './factory-rosters.json';
import gameDataManifest from './game-data-manifest.json';
import tacticalIconManifest from './tactical-icon-manifest.json';
import unitCategories from './unit-categories.json';
import unitDefaults from './unit-defaults.json';
import unitpicManifest from './unitpic-manifest.json';
import units from './units.json';

const sortedKeys = value => Object.keys(value || {}).sort();

describe('bundled BAR game-data snapshot', () => {
  it('declares a versioned, commit-addressed snapshot contract', () => {
    expect(gameDataManifest.schemaVersion).toBe(2);
    expect(gameDataManifest.snapshotId).toBe(`bar-${gameDataManifest.sourceCommit.slice(0, 12)}`);
    expect(Object.values(gameDataManifest.files).every(file => file.schemaVersion === 2)).toBe(true);
  });

  it('uses one canonical unit catalog across names, defaults, categories, and artwork', () => {
    const unitIds = sortedKeys(units.names);
    expect(sortedKeys(units.descriptions)).toEqual(unitIds);
    expect(sortedKeys(unitDefaults)).toEqual(unitIds);
    expect(sortedKeys(unitCategories)).toEqual(unitIds);
    expect(sortedKeys(unitpicManifest.units)).toEqual(unitIds);
    expect(gameDataManifest.counts.units).toBe(unitIds.length);
  });

  it('pins every source-derived manifest to the same BAR commit', () => {
    expect(gameDataManifest.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(unitpicManifest.sourceCommit).toBe(gameDataManifest.sourceCommit);
    expect(tacticalIconManifest.sourceCommit).toBe(gameDataManifest.sourceCommit);
    expect(assetManifest.sourceCommit).toBe(gameDataManifest.sourceCommit);
  });

  it('ships an update report for the active snapshot', () => {
    expect(barUpdateReport.version).toBe(1);
    expect(barUpdateReport.current.snapshotId).toBe(gameDataManifest.snapshotId);
    expect(barUpdateReport.current.sourceCommit).toBe(gameDataManifest.sourceCommit);
    expect(barUpdateReport.datasets.length).toBeGreaterThan(0);
  });

  it('does not retain broken factory roster references', () => {
    const unitIds = new Set(Object.keys(unitDefaults));
    for (const [producerId, roster] of Object.entries(factoryRosters)) {
      expect(unitIds.has(producerId), `${producerId} is not a bundled definition`).toBe(true);
      for (const unitId of roster) {
        expect(unitIds.has(unitId), `${producerId} references missing ${unitId}`).toBe(true);
      }
    }
  });

  it('classifies every airborne definition as aircraft', () => {
    const missingAircraftTag = Object.entries(unitDefaults)
      .filter(([, defaults]) => Number(defaults.cruisealt) > 0)
      .map(([unitId]) => unitId)
      .filter(unitId => !unitCategories[unitId]?.includes('aircraft'));

    expect(missingAircraftTag).toEqual([]);
  });
});
