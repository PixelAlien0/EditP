import { describe, expect, it } from 'vitest';
import { GAME_DATA_SNAPSHOT_SCHEMA_VERSION } from '../config/gameDataSchema.js';
import gameDataManifest from '../data/game-data-manifest.json';
import { formatSnapshotError, validateCoreGameDataSnapshot } from './gameDataSnapshot.js';

const COMMIT = 'e34440077024d3b122b89d07a314a2df7b1b181d';

function createFixture(overrides = {}) {
  return {
    manifest: {
      schemaVersion: GAME_DATA_SNAPSHOT_SCHEMA_VERSION,
      snapshotId: `bar-${COMMIT.slice(0, 12)}`,
      sourceCommit: COMMIT,
      counts: {
        units: 2,
        descriptions: 2,
        defaults: 2,
        categories: 2,
        rosters: 1,
        explosions: 1,
        artwork: 2,
      },
    },
    unitsDb: {
      names: { arma: 'A', armb: 'B' },
      descriptions: { arma: 'A unit', armb: 'B unit' },
    },
    defaultsDb: { arma: {}, armb: {} },
    unitCategories: { arma: ['bots'], armb: ['vehicles'] },
    factoryRosters: { arma: ['armb'] },
    artworkManifest: {
      sourceCommit: COMMIT,
      units: { arma: '/a.webp', armb: '/b.webp' },
    },
    explosionProfiles: { small: {} },
    ...overrides,
  };
}

describe('game-data snapshot runtime validation', () => {
  it('accepts a coherent snapshot', () => {
    const result = validateCoreGameDataSnapshot(createFixture());
    expect(result.isValid).toBe(true);
    expect(result.snapshotId).toBe('bar-e34440077024');
    expect(result.issues).toEqual([]);
  });

  it('accepts the schema emitted by the current snapshot generator', () => {
    expect(gameDataManifest.schemaVersion).toBe(GAME_DATA_SNAPSHOT_SCHEMA_VERSION);
    const result = validateCoreGameDataSnapshot(createFixture({
      manifest: {
        ...createFixture().manifest,
        schemaVersion: gameDataManifest.schemaVersion,
      },
    }));
    expect(result.isValid).toBe(true);
  });

  it('rejects genuinely unsupported snapshot schemas', () => {
    const fixture = createFixture();
    fixture.manifest.schemaVersion = GAME_DATA_SNAPSHOT_SCHEMA_VERSION + 1;
    const result = validateCoreGameDataSnapshot(fixture);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain(
      `Snapshot schema ${GAME_DATA_SNAPSHOT_SCHEMA_VERSION + 1} is not supported.`
    );
  });

  it('rejects mixed commits and missing catalog entries', () => {
    const fixture = createFixture({
      defaultsDb: { arma: {} },
      artworkManifest: {
        sourceCommit: '1111111111111111111111111111111111111111',
        units: { arma: '/a.webp', armb: '/b.webp' },
      },
    });
    const result = validateCoreGameDataSnapshot(fixture);
    expect(result.isValid).toBe(false);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.stringContaining('Unit defaults'),
      expect.stringContaining('different BAR commit'),
    ]));
    expect(formatSnapshotError(result)).toContain('failed its consistency check');
  });

  it('rejects a roster reference outside the snapshot', () => {
    const fixture = createFixture({ factoryRosters: { arma: ['missing_unit'] } });
    const result = validateCoreGameDataSnapshot(fixture);
    expect(result.isValid).toBe(false);
    expect(result.issues).toContain('Factory roster "arma" references missing unit "missing_unit".');
  });
});
