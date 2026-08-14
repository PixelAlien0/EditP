import { describe, expect, it } from 'vitest';
import gameDataManifest from '../data/game-data-manifest.json';
import {
  GADGET_CONTRACT_REGISTRY,
  GADGET_CONTRACT_REGISTRY_VERSION,
} from './gadgetContracts.js';
import {
  ADVANCED_MECHANICS_RUNTIME_FIXTURES,
  RUNTIME_CONTRACT_FIXTURE_VERSION,
} from '../utils/fixtures/advancedMechanicsRuntimeFixtures.js';
import { buildRuntimeContractFixtureReport } from '../utils/runtimeContractFixtures.js';

describe('BAR gadget contract registry', () => {
  it('is versioned and pinned to the bundled BAR snapshot', () => {
    expect(GADGET_CONTRACT_REGISTRY_VERSION).toBe(3);
    expect(GADGET_CONTRACT_REGISTRY.length).toBeGreaterThanOrEqual(8);
    GADGET_CONTRACT_REGISTRY.forEach(contract => {
      if (contract.source.kind === 'bar') {
        expect(contract.source.commit).toBe(gameDataManifest.sourceCommit);
        expect(contract.source.repository).toBe('beyond-all-reason/Beyond-All-Reason');
      } else {
        expect(contract.source.kind).toBe('project');
        expect(contract.source.repository).toBe('PixelAlien0/EditP');
      }
      expect(contract.source.path).toMatch(/\.lua$/);
    });
  });

  it('keeps contract identifiers unique while allowing one consumer to own multiple contracts', () => {
    expect(new Set(GADGET_CONTRACT_REGISTRY.map(contract => contract.id)).size)
      .toBe(GADGET_CONTRACT_REGISTRY.length);
    expect(GADGET_CONTRACT_REGISTRY.filter(
      contract => contract.source.path === 'luarules/gadgets/unit_custom_weapons_behaviours.lua'
    ).map(contract => contract.id)).toEqual([
      'sector-fire',
      'special-projectile-behavior',
    ]);
  });

  it('backs every registered gadget contract with an executable fixture and required-key assertions', () => {
    expect(RUNTIME_CONTRACT_FIXTURE_VERSION).toBe(1);
    const report = buildRuntimeContractFixtureReport(
      GADGET_CONTRACT_REGISTRY,
      ADVANCED_MECHANICS_RUNTIME_FIXTURES,
    );

    expect(report.duplicateFixtureIds).toEqual([]);
    expect(report.unknownContractLinks).toEqual([]);
    expect(report.uncoveredContractIds).toEqual([]);
    expect(report.coveredContractCount).toBe(report.totalContractCount);
    report.contracts.forEach(contract => {
      expect(contract.fixtureIds.length, `${contract.contractId} has no runtime fixture`).toBeGreaterThan(0);
      expect(contract.missingRequiredKeys, `${contract.contractId} misses required runtime assertions`).toEqual([]);
      expect(contract.coverage).toBeGreaterThan(0);
    });
  });
});
