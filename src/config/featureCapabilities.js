export const CAPABILITY_DEFINITIONS = Object.freeze({
  'engine-native': Object.freeze({
    label: 'Recoil native',
    shortLabel: 'Engine',
    tone: 'neutral',
    description: 'Written directly to a Recoil UnitDef or WeaponDef field.',
  }),
  'bar-gadget': Object.freeze({
    label: 'BAR gadget',
    shortLabel: 'Gadget',
    tone: 'info',
    description: 'Requires behavior supplied by a BAR LuaRules gadget.',
  }),
  'bar-data': Object.freeze({
    label: 'Observed in BAR data',
    shortLabel: 'BAR data',
    tone: 'neutral',
    description: 'This key is present in the pinned BAR definition snapshot.',
  }),
  'unverified-contract': Object.freeze({
    label: 'Unverified runtime contract',
    shortLabel: 'Unverified',
    tone: 'warning',
    description: 'The key is observed in BAR data, but its runtime consumer has not been registered in the editor.',
  }),
  'bar-consumer-discovered': Object.freeze({
    label: 'BAR consumer discovered',
    shortLabel: 'Consumer',
    tone: 'info',
    description: 'Static analysis found BAR source code that reads this key. Semantics still require maintainer review.',
  }),
  'external-package': Object.freeze({
    label: 'External package contract',
    shortLabel: 'External',
    tone: 'warning',
    description: 'This key only works when the loaded game or mod package explicitly consumes it.',
  }),
  'editor-generated': Object.freeze({
    label: 'Editor generated',
    shortLabel: 'Generated',
    tone: 'accent',
    description: 'BAR Editor generates supporting Lua or definitions for this feature.',
  }),
  'supporting-definition': Object.freeze({
    label: 'Supporting definition',
    shortLabel: 'Dependency',
    tone: 'warning',
    description: 'Requires a referenced supporting definition to be present at load time.',
  }),
  'local-only': Object.freeze({
    label: 'Local only',
    shortLabel: 'Local',
    tone: 'success',
    description: 'Stored in this browser or project and does not contact a game server.',
  }),
  'static-analysis': Object.freeze({
    label: 'Static analysis',
    shortLabel: 'Analysis',
    tone: 'info',
    description: 'Inspects source without executing imported community Lua.',
  }),
  'read-only': Object.freeze({
    label: 'Reference only',
    shortLabel: 'Reference',
    tone: 'neutral',
    description: 'Provides validated lookup information without changing the project.',
  }),
  'account-publishing': Object.freeze({
    label: 'Account publishing',
    shortLabel: 'Account',
    tone: 'info',
    description: 'Anyone can browse; publishing, reporting, and owner deletion require a signed-in community account.',
  }),
  'validated-export': Object.freeze({
    label: 'Preflight checked',
    shortLabel: 'Preflight',
    tone: 'success',
    description: 'Runs compiler and BAR compatibility checks before lobby export.',
  }),
  experimental: Object.freeze({
    label: 'Experimental',
    shortLabel: 'Experimental',
    tone: 'warning',
    description: 'Supported by the editor, but runtime behavior can depend on BAR gadget details.',
  }),
  development: Object.freeze({
    label: 'In development',
    shortLabel: 'Dev',
    tone: 'warning',
    description: 'Not yet considered ready for normal projects.',
  }),
  locked: Object.freeze({
    label: 'Temporarily locked',
    shortLabel: 'Locked',
    tone: 'danger',
    description: 'Unavailable until its editing and validation workflow is repaired.',
  }),
});

export const FEATURE_CAPABILITIES = Object.freeze({
  'workspace.edit': Object.freeze(['engine-native', 'editor-generated']),
  'workspace.collections': Object.freeze(['local-only']),
  'workspace.build-menus': Object.freeze(['editor-generated']),
  'workspace.review': Object.freeze(['validated-export']),
  'tool.command-palette': Object.freeze(['local-only']),
  'tool.checkpoints': Object.freeze(['local-only']),
  'tool.collections': Object.freeze(['local-only']),
  'tool.carrier-workbench': Object.freeze(['bar-gadget', 'experimental']),
  'tool.preset-gallery': Object.freeze(['local-only']),
  'tool.tweak-package-lab': Object.freeze(['static-analysis']),
  'tool.ai-package-audit': Object.freeze(['static-analysis', 'read-only']),
  'tool.weapondef-library': Object.freeze(['editor-generated', 'validated-export']),
  'tool.reference-library': Object.freeze(['read-only']),
  'tool.update-center': Object.freeze(['read-only']),
  'tool.community-gallery': Object.freeze(['account-publishing']),
});

export function getCapabilityDefinition(capabilityId) {
  return CAPABILITY_DEFINITIONS[capabilityId] || null;
}

export function getFeatureCapabilityIds(featureId) {
  return FEATURE_CAPABILITIES[featureId] || [];
}

export function resolveCapabilityDefinitions({ featureId, capabilityIds } = {}) {
  const ids = capabilityIds || getFeatureCapabilityIds(featureId);
  return [...new Set(ids)]
    .map(id => {
      const definition = getCapabilityDefinition(id);
      return definition ? { id, ...definition } : null;
    })
    .filter(Boolean);
}
