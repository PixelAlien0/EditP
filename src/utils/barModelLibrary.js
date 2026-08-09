import manifest from '../data/bar-model-manifest.json';

const normalizeUnitId = value => String(value || '').trim().toLowerCase();
const normalizeModelPath = value => String(value || '').trim().replace(/\\/g, '/').toLowerCase();

export const BAR_MODEL_MANIFEST = manifest;

function hydrateEntry(unitId, entry) {
  if (!entry) return null;
  const textures = entry.textureFamily ? manifest.materials?.[entry.textureFamily] || null : null;
  return {
    ...entry,
    unitId,
    model: `${manifest.delivery.publicPrefix}/${unitId}.glb?snapshot=${manifest.sourceCommit.slice(0, 12)}`,
    sourceUrl: `${manifest.delivery.upstreamOrigin}/glb/${unitId}.glb`,
    textures,
    materialMode: textures ? 'bar-pbr' : 'native',
  };
}

export const BAR_MODEL_ENTRIES = Object.freeze(Object.entries(manifest.entries)
  .map(([unitId, entry]) => Object.freeze(hydrateEntry(unitId, entry))));

export function getBarModelEntry(unitId) {
  const normalized = normalizeUnitId(unitId);
  const canonicalId = manifest.unitAliases?.[normalized] || normalized;
  return hydrateEntry(canonicalId, manifest.entries[canonicalId]);
}

export function getBarModelEntryByPath(modelPath) {
  const unitId = manifest.aliases[normalizeModelPath(modelPath)];
  return unitId ? hydrateEntry(unitId, manifest.entries[unitId]) : null;
}

export function getBarModelFallbackByPath(modelPath) {
  return manifest.unsupported?.[normalizeModelPath(modelPath)] || null;
}

export function getBarModelEntryForReference(reference) {
  if (!reference) return null;
  if (reference.category === 'unit') return getBarModelEntry(reference.value);
  if (reference.category === 'unitModel') return getBarModelEntryByPath(reference.value);
  return null;
}
