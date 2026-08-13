import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PARAMETER_BY_KEY,
  CUSTOM_PARAMETER_CATALOG,
  CUSTOM_PARAMETER_DISCOVERY,
  CUSTOM_PARAMETER_REGISTRY,
  coerceCustomParameterValue,
  getCustomParameterDefinition,
  getCustomParameterConsumers,
  getCustomParameterObservation,
  getCustomParameterPromotion,
  isValidCustomParameterKey,
  normalizeCustomParameterKey
} from './customParameters.js';
import {
  CUSTOM_PARAMETER_PROMOTION_ORDER,
  CUSTOM_PARAMETER_PROMOTION_VERSION,
  CUSTOM_PARAMETER_RUNTIME_EVIDENCE,
} from './customParameterPromotion.js';
import { ADVANCED_MECHANICS_RUNTIME_FIXTURES } from '../utils/fixtures/advancedMechanicsRuntimeFixtures.js';

describe('advanced custom parameter metadata', () => {
  it('defines unique, valid lowercase keys with an ownership label', () => {
    expect(new Set(CUSTOM_PARAMETER_CATALOG.map(parameter => parameter.key)).size).toBe(CUSTOM_PARAMETER_CATALOG.length);
    for (const parameter of CUSTOM_PARAMETER_CATALOG) {
      expect(isValidCustomParameterKey(parameter.key)).toBe(true);
      expect(parameter.owner).toBeTruthy();
      expect(CUSTOM_PARAMETER_BY_KEY.get(parameter.key)).toBe(parameter);
    }
  });

  it('merges documented metadata with the pinned BAR discovery snapshot', () => {
    expect(CUSTOM_PARAMETER_DISCOVERY.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.unitParameters).toBeGreaterThan(100);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.weaponParameters).toBeGreaterThan(50);
    expect(new Set(CUSTOM_PARAMETER_REGISTRY.map(parameter => parameter.id)).size).toBe(CUSTOM_PARAMETER_REGISTRY.length);

    const unitGroup = getCustomParameterDefinition('unitgroup', 'unit');
    expect(unitGroup).toMatchObject({ scope: 'unit', owner: 'BAR convention', observed: true });
    expect(getCustomParameterObservation('unitgroup', 'unit')?.occurrences).toBeGreaterThan(0);

    const cluster = getCustomParameterDefinition('cluster_def', 'weapon');
    expect(cluster).toMatchObject({ scope: 'weapon', editorKey: 'cluster_def' });
    const scavengerCandidate = getCustomParameterDefinition('scavcustomsquad', 'unit');
    expect(scavengerCandidate).toMatchObject({
      scope: 'unit',
      owner: 'BAR Scavenger system',
      editorSupported: true,
    });
    expect(scavengerCandidate.contractIds).toContain('scavenger-squad');
    expect(getCustomParameterDefinition('scavsquadrarity', 'unit')).toMatchObject({
      acceptedValues: ['basic', 'special'],
    });
    expect(getCustomParameterDefinition('scavsquadbehavior', 'unit')).toMatchObject({
      acceptedValues: ['raider', 'berserk', 'skirmisher', 'healer', 'artillery', 'kamikaze'],
    });
    expect(CUSTOM_PARAMETER_DISCOVERY.version).toBe(3);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.unitParametersWithConsumers).toBeGreaterThan(0);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.weaponParametersWithConsumers).toBeGreaterThan(0);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.inferredValueParameters).toBeGreaterThan(200);
    expect(CUSTOM_PARAMETER_DISCOVERY.counts.enumCandidateParameters).toBeGreaterThan(100);
    const areaMex = getCustomParameterDefinition('area_mex_def', 'unit');
    expect(areaMex).toMatchObject({
      type: 'string',
      valueDiscovery: {
        inferredType: 'string',
        typeConfidence: 'strong',
        enumConfidence: 'partial',
      },
    });
    expect(areaMex.suggestedValues).toEqual(expect.arrayContaining(['armmex', 'cormex', 'legmex']));
    expect(areaMex.acceptedValues).toBeUndefined();

    const consumerBacked = CUSTOM_PARAMETER_REGISTRY.filter(parameter => parameter.consumerCount > 0);
    expect(consumerBacked.length).toBeGreaterThan(0);
    for (const parameter of consumerBacked) {
      expect(parameter.consumerEvidence.length).toBeGreaterThan(0);
      expect(parameter.capabilities).toContain('bar-consumer-discovered');
      expect(parameter.promotion.evidence.some(item => item.kind === 'consumer-discovery')).toBe(true);
    }
    expect(getCustomParameterConsumers('airfactory', 'unit')).toEqual(expect.arrayContaining([
      expect.objectContaining({ path: 'luaui/widgets/cmd_fac_holdposition.lua', layer: 'interface' }),
    ]));
  });

  it('promotes contracts only as far as their recorded evidence permits', () => {
    expect(CUSTOM_PARAMETER_PROMOTION_VERSION).toBe(1);
    expect(getCustomParameterPromotion('airfactory', 'unit')?.id).toBe('observed');
    expect(getCustomParameterPromotion('energyconv_capacity', 'unit')?.id).toBe('runtime-tested');
    expect(getCustomParameterPromotion('scavcustomsquad', 'unit')?.id).toBe('runtime-tested');
    expect(getCustomParameterPromotion('unitgroup', 'unit')?.id).toBe('editor-supported');
    expect(getCustomParameterPromotion('cluster_def', 'weapon')?.id).toBe('runtime-tested');

    for (const parameter of CUSTOM_PARAMETER_REGISTRY) {
      expect(CUSTOM_PARAMETER_PROMOTION_ORDER).toContain(parameter.promotion.id);
      expect(parameter.promotion.evidence).toBeInstanceOf(Array);
      expect(parameter.promotion.nextRequirement).toBeTruthy();
    }
  });

  it('backs every runtime-tested promotion with an exact harness assertion', () => {
    const assertedKeysByFixture = new Map(ADVANCED_MECHANICS_RUNTIME_FIXTURES.map(fixture => [
      fixture.id,
      new Set((fixture.expectations?.paths || []).flatMap(assertion => {
        const match = assertion.path.match(/\.customparams\.([a-z0-9_]+)$/i);
        return match ? [match[1].toLowerCase()] : [];
      })),
    ]));

    for (const [key, fixtureIds] of Object.entries(CUSTOM_PARAMETER_RUNTIME_EVIDENCE)) {
      for (const fixtureId of fixtureIds) {
        expect(assertedKeysByFixture.get(fixtureId), `missing runtime fixture ${fixtureId}`).toBeDefined();
        expect(assertedKeysByFixture.get(fixtureId)?.has(key), `${fixtureId} does not assert ${key}`).toBe(true);
      }
    }
  });

  it('normalizes safe custom keys and rejects Lua paths or expressions', () => {
    expect(normalizeCustomParameterKey('  My_Key  ')).toBe('my_key');
    expect(isValidCustomParameterKey('my_key_2')).toBe(true);
    expect(isValidCustomParameterKey('weapondefs.bad')).toBe(false);
    expect(isValidCustomParameterKey('x[1]')).toBe(false);
  });

  it('coerces supported scalar values without evaluating input', () => {
    expect(coerceCustomParameterValue('12.5', 'number')).toBe(12.5);
    expect(coerceCustomParameterValue('not-a-number', 'number')).toBeUndefined();
    expect(coerceCustomParameterValue('true', 'boolean')).toBe(true);
    expect(coerceCustomParameterValue('1', 'boolean')).toBe(true);
    expect(coerceCustomParameterValue('0', 'boolean')).toBe(false);
    expect(coerceCustomParameterValue('maybe', 'boolean')).toBeUndefined();
    expect(coerceCustomParameterValue(' hello ', 'string')).toBe('hello');
  });
});
