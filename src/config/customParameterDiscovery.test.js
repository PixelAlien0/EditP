import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { discoverCustomParameters } from '../../scripts/sync-custom-parameter-registry.mjs';

const temporaryDirectories = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach(directory => fs.rmSync(directory, { recursive: true, force: true }));
});

describe('BAR custom-parameter discovery', () => {
  it('separates literal UnitDef and WeaponDef custom parameters deterministically', () => {
    const repository = fs.mkdtempSync(path.join(os.tmpdir(), 'editp-custom-params-'));
    temporaryDirectories.push(repository);
    const units = path.join(repository, 'units');
    fs.mkdirSync(units, { recursive: true });
    fs.writeFileSync(path.join(units, 'sample.lua'), `return {
    sample_unit = {
        customparams = {
            unitgroup = "weapon",
            crashable = true,
            computed_key = SOME_VALUE,
        },
        weapondefs = {
            sample_weapon = {
                customparams = {
                    cluster_def = "child_weapon",
                    cluster_number = 6,
                },
            },
        },
    },
}\n`);

    const result = discoverCustomParameters({ repository, sourceCommit: 'a'.repeat(40) });
    expect(result.parameters.unit).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'crashable', valueTypes: ['boolean'] }),
      expect.objectContaining({ key: 'computed_key', valueTypes: ['dynamic'] }),
      expect.objectContaining({ key: 'unitgroup', sampleValues: ['weapon'] }),
    ]));
    expect(result.parameters.weapon).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'cluster_def', sampleWeaponDefs: ['sample_weapon'] }),
      expect.objectContaining({ key: 'cluster_number', valueTypes: ['number'] }),
    ]));
  });
});
