function normalizeContractKey(key) {
  return String(key || '').replace(/^customparams\./, '').toLowerCase();
}

function assertedKeys(fixture) {
  return new Set((fixture?.expectations?.paths || []).flatMap(expectation => {
    const segments = String(expectation.path || '').toLowerCase().split('.').filter(Boolean);
    const customParamsIndex = segments.lastIndexOf('customparams');
    if (customParamsIndex >= 0 && segments[customParamsIndex + 1]) {
      return [segments[customParamsIndex + 1]];
    }
    return segments.length ? [segments.at(-1)] : [];
  }));
}

export function buildRuntimeContractFixtureReport(contracts = [], fixtures = []) {
  const contractIds = new Set(contracts.map(contract => contract.id));
  const fixtureIds = new Set();
  const duplicateFixtureIds = [];
  const unknownContractLinks = [];
  const fixturesByContract = new Map(contracts.map(contract => [contract.id, []]));

  fixtures.forEach(fixture => {
    if (fixtureIds.has(fixture.id)) duplicateFixtureIds.push(fixture.id);
    fixtureIds.add(fixture.id);
    (fixture.contractIds || []).forEach(contractId => {
      if (!contractIds.has(contractId)) {
        unknownContractLinks.push({ fixtureId: fixture.id, contractId });
        return;
      }
      fixturesByContract.get(contractId).push(fixture);
    });
  });

  const contractsReport = contracts.map(contract => {
    const linkedFixtures = fixturesByContract.get(contract.id) || [];
    const asserted = new Set(linkedFixtures.flatMap(fixture => [...assertedKeys(fixture)]));
    const requiredKeys = [...new Set([
      ...(contract.activationKeys || []),
      ...(contract.requiredKeys || []),
    ].map(normalizeContractKey))];
    const triggerKeys = [...new Set((contract.triggerKeys || []).map(normalizeContractKey))];
    const missingRequiredKeys = requiredKeys.filter(key => !asserted.has(key));
    const assertedTriggerKeys = triggerKeys.filter(key => asserted.has(key));
    return Object.freeze({
      contractId: contract.id,
      fixtureIds: Object.freeze(linkedFixtures.map(fixture => fixture.id)),
      requiredKeys: Object.freeze(requiredKeys),
      missingRequiredKeys: Object.freeze(missingRequiredKeys),
      assertedTriggerKeys: Object.freeze(assertedTriggerKeys),
      triggerKeyCount: triggerKeys.length,
      coverage: triggerKeys.length ? assertedTriggerKeys.length / triggerKeys.length : 1,
      covered: linkedFixtures.length > 0 && missingRequiredKeys.length === 0,
    });
  });

  return Object.freeze({
    contracts: Object.freeze(contractsReport),
    coveredContractCount: contractsReport.filter(contract => contract.covered).length,
    totalContractCount: contractsReport.length,
    uncoveredContractIds: Object.freeze(contractsReport.filter(contract => !contract.covered).map(contract => contract.contractId)),
    duplicateFixtureIds: Object.freeze(duplicateFixtureIds),
    unknownContractLinks: Object.freeze(unknownContractLinks),
  });
}
