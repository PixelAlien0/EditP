import { describe, expect, it } from 'vitest';
import {
  CAPABILITY_DEFINITIONS,
  FEATURE_CAPABILITIES,
  resolveCapabilityDefinitions,
} from './featureCapabilities.js';

describe('feature capability metadata', () => {
  it('resolves every feature label to a declared capability', () => {
    for (const [featureId, capabilityIds] of Object.entries(FEATURE_CAPABILITIES)) {
      const resolved = resolveCapabilityDefinitions({ featureId });
      expect(resolved.map(capability => capability.id), featureId).toEqual(capabilityIds);
    }
  });

  it('keeps labels and descriptions complete for accessible explanations', () => {
    for (const [id, capability] of Object.entries(CAPABILITY_DEFINITIONS)) {
      expect(capability.label, id).toBeTruthy();
      expect(capability.shortLabel, id).toBeTruthy();
      expect(capability.description, id).toBeTruthy();
      expect(capability.tone, id).toMatch(/^(neutral|accent|success|warning|danger|info)$/);
    }
  });

  it('deduplicates repeated capability IDs and ignores unknown metadata', () => {
    expect(resolveCapabilityDefinitions({
      capabilityIds: ['bar-gadget', 'bar-gadget', 'not-real'],
    }).map(capability => capability.id)).toEqual(['bar-gadget']);
  });
});
