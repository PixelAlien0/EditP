import manifest from '../data/bar-model-manifest.json';

const normalizeUnitId = value => String(value || '').trim().toLowerCase();
const normalizeModelPath = value => String(value || '').trim().replace(/\\/g, '/').toLowerCase();

export const BAR_MODEL_MANIFEST = manifest;
export const BAR_MODEL_ENTRIES = Object.freeze(Object.values(manifest.entries));

export function getBarModelEntry(unitId) {
  return manifest.entries[normalizeUnitId(unitId)] || null;
}

export function getBarModelEntryByPath(modelPath) {
  const unitId = manifest.aliases[normalizeModelPath(modelPath)];
  return unitId ? getBarModelEntry(unitId) : null;
}

export function getBarModelEntryForReference(reference) {
  if (!reference) return null;
  if (reference.category === 'unit') return getBarModelEntry(reference.value);
  if (reference.category === 'unitModel') return getBarModelEntryByPath(reference.value);
  return null;
}
