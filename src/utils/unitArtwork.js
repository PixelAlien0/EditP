let unitpicUrls = {};

export function setUnitArtworkManifest(manifest) {
  unitpicUrls = manifest?.units && typeof manifest.units === 'object' ? manifest.units : {};
}

export function getUnitIconUrl(id) {
  if (!id) return '/logo.svg';
  return unitpicUrls[id.toLowerCase()] || '/logo.svg';
}
