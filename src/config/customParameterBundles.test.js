import { describe, expect, it } from 'vitest';
import {
  CUSTOM_PARAMETER_BUNDLES,
  CUSTOM_PARAMETER_BUNDLE_REGISTRY_VERSION,
  buildCustomParameterBundleDisablePatch,
  buildCustomParameterBundleProfilePatch,
  buildCustomParameterBundleResetPatch,
  getCustomParameterBundle,
  getCustomParameterBundleState,
} from './customParameterBundles.js';

describe('custom parameter contract bundles', () => {
  it('keeps a versioned, unique unit-contract registry', () => {
    expect(CUSTOM_PARAMETER_BUNDLE_REGISTRY_VERSION).toBe(1);
    expect(new Set(CUSTOM_PARAMETER_BUNDLES.map(bundle => bundle.id)).size).toBe(CUSTOM_PARAMETER_BUNDLES.length);
    expect(CUSTOM_PARAMETER_BUNDLES.map(bundle => bundle.id)).toEqual(['energy-converter', 'scavenger-squad']);
  });

  it('builds complete deterministic profile patches', () => {
    expect(buildCustomParameterBundleProfilePatch('energy-converter', 'advanced')).toEqual({
      'customparams.energyconv_capacity': 600,
      'customparams.energyconv_efficiency': 0.01724,
    });
    const squad = buildCustomParameterBundleProfilePatch('scavenger-squad', 'fighter');
    expect(squad['customparams.scavcustomsquad']).toBe(true);
    expect(squad['customparams.scavsquadunitsamount']).toBe(6);
    expect(Object.keys(squad)).toHaveLength(9);
  });

  it('reports inactive, partial, and ready effective states', () => {
    const converter = getCustomParameterBundle('energy-converter');
    expect(getCustomParameterBundleState(converter).status).toBe('inactive');
    expect(getCustomParameterBundleState(converter, {}, {
      'customparams.energyconv_capacity': 70,
    }).status).toBe('partial');
    expect(getCustomParameterBundleState(converter, {
      'customparams.energyconv_capacity': 70,
      'customparams.energyconv_efficiency': 0.01429,
    }).status).toBe('ready');
  });

  it('restores all keys and cleanly disables activation contracts', () => {
    const squad = getCustomParameterBundle('scavenger-squad');
    expect(Object.keys(buildCustomParameterBundleResetPatch('scavenger-squad'))).toEqual(squad.keys);
    const disabled = buildCustomParameterBundleDisablePatch('scavenger-squad');
    expect(disabled['customparams.scavcustomsquad']).toBe(false);
    expect(disabled['customparams.scavsquadweight']).toBeUndefined();
  });
});
