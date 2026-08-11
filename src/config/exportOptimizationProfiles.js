export const EXPORT_OPTIMIZATION_PROFILE_IDS = Object.freeze({
  SAFE: 'safe',
  BALANCED: 'balanced',
  MAXIMUM: 'maximum',
});

export const DEFAULT_EXPORT_OPTIMIZATION_PROFILE = EXPORT_OPTIMIZATION_PROFILE_IDS.BALANCED;

export const EXPORT_OPTIMIZATION_PROFILES = Object.freeze([
  Object.freeze({
    id: EXPORT_OPTIMIZATION_PROFILE_IDS.SAFE,
    label: 'Safe',
    useCase: 'Development and troubleshooting',
    description: 'Keeps generated Lua straightforward and readable.',
    benefit: 'Best for inspecting output and isolating runtime problems.',
    policy: Object.freeze({
      exportEnglishOnly: false,
      compactLuaFormatting: false,
      compactGenerated: false,
      deduplicate: false,
    }),
  }),
  Object.freeze({
    id: EXPORT_OPTIMIZATION_PROFILE_IDS.BALANCED,
    label: 'Balanced',
    useCase: 'Recommended for most projects',
    description: 'Uses deterministic helpers, safe deduplication, and equivalence-guarded compaction.',
    benefit: 'Reduces lobby payload while retaining complete multilingual tooltips.',
    policy: Object.freeze({
      exportEnglishOnly: false,
      compactLuaFormatting: true,
      compactGenerated: true,
      deduplicate: true,
    }),
  }),
  Object.freeze({
    id: EXPORT_OPTIMIZATION_PROFILE_IDS.MAXIMUM,
    label: 'Maximum',
    useCase: 'Projects near lobby limits',
    description: 'Applies every proven optimization and keeps only English tooltip strings.',
    benefit: 'Produces the smallest supported payload without rewriting imported raw Lua.',
    policy: Object.freeze({
      exportEnglishOnly: true,
      compactLuaFormatting: true,
      compactGenerated: true,
      deduplicate: true,
    }),
  }),
]);

const PROFILE_BY_ID = new Map(EXPORT_OPTIMIZATION_PROFILES.map(profile => [profile.id, profile]));

export function normalizeExportOptimizationProfile(value) {
  return PROFILE_BY_ID.has(value) ? value : DEFAULT_EXPORT_OPTIMIZATION_PROFILE;
}

export function getExportOptimizationProfile(value) {
  return PROFILE_BY_ID.get(normalizeExportOptimizationProfile(value));
}

export function getExportOptimizationPolicy(value) {
  return getExportOptimizationProfile(value).policy;
}
