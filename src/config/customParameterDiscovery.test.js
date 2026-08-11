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
  it('discovers definitions and their literal BAR consumers deterministically', () => {
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
            shared_key = "unit",
        },
        weapondefs = {
            sample_weapon = {
                customparams = {
                    cluster_def = "child_weapon",
                    cluster_number = 6,
                    shared_key = "weapon",
                },
            },
        },
    },
}\n`);
    const gadgets = path.join(repository, 'luarules', 'gadgets');
    fs.mkdirSync(gadgets, { recursive: true });
    fs.writeFileSync(path.join(gadgets, 'sample_consumer.lua'), `local unitParams = UnitDefs[unitDefID].customParams
local group = unitParams.unitgroup or "utility"
if group == "weapon" or group == "builder" then return end
if unitParams.crashable then return end
if unitDef.customParams.unitgroup then return end
if weaponDef.customParams.cluster_def then return end
if weaponDef.customParams.cluster_number >= 2 then return end
if customParams.shared_key then return end
`);

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
    expect(result.version).toBe(3);
    expect(result.counts.scannedConsumerFiles).toBe(1);
    expect(result.parameters.unit.find(parameter => parameter.key === 'crashable')).toMatchObject({
      consumerCount: 1,
      consumerLayers: ['runtime-gadget'],
      consumerEvidence: [expect.objectContaining({
        path: 'luarules/gadgets/sample_consumer.lua', confidence: 'high', line: 4,
      })],
    });
    expect(result.parameters.unit.find(parameter => parameter.key === 'unitgroup')).toMatchObject({ consumerCount: 2 });
    expect(result.parameters.weapon.find(parameter => parameter.key === 'cluster_def')).toMatchObject({ consumerCount: 1 });
    expect(result.parameters.unit.find(parameter => parameter.key === 'unitgroup').valueDiscovery).toMatchObject({
      inferredType: 'string',
      enumCandidates: ['builder', 'utility', 'weapon'],
      enumConfidence: 'strong',
      defaultCandidates: ['utility'],
    });
    expect(result.parameters.weapon.find(parameter => parameter.key === 'cluster_number').valueDiscovery).toMatchObject({
      inferredType: 'number',
      numericRange: expect.objectContaining({ observedMin: 6, observedMax: 6, lowerBound: 2 }),
    });
    expect(result.counts.enumCandidateParameters).toBeGreaterThan(0);
    expect(result.unresolvedConsumers).toContainEqual(expect.objectContaining({ key: 'shared_key', occurrences: 1 }));
  });
});
