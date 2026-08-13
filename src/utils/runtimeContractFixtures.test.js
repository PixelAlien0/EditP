import { describe, expect, it } from 'vitest';
import { buildRuntimeContractFixtureReport } from './runtimeContractFixtures.js';

describe('runtime contract fixture coverage', () => {
  it('reports missing required keys and unknown links without executing fixture code', () => {
    const report = buildRuntimeContractFixtureReport([{
      id: 'sample',
      triggerKeys: ['customparams.enabled', 'customparams.amount'],
      activationKeys: ['customparams.enabled'],
      requiredKeys: ['customparams.enabled', 'customparams.amount'],
    }], [{
      id: 'incomplete',
      contractIds: ['sample', 'missing-contract'],
      expectations: { paths: [{ path: 'unit.customparams.enabled', equals: true }] },
    }]);

    expect(report.uncoveredContractIds).toEqual(['sample']);
    expect(report.unknownContractLinks).toEqual([{ fixtureId: 'incomplete', contractId: 'missing-contract' }]);
    expect(report.contracts[0]).toMatchObject({
      assertedTriggerKeys: ['enabled'],
      missingRequiredKeys: ['amount'],
      coverage: 0.5,
      covered: false,
    });
  });
});
