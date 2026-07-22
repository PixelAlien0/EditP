let unitpicUrls = {};
let buildPictureUrls = {};
let normalizedBuildPictureUrls = new Map();

export function setUnitArtworkManifest(manifest) {
  unitpicUrls = manifest?.units && typeof manifest.units === 'object' ? manifest.units : {};
  buildPictureUrls = manifest?.pictures && typeof manifest.pictures === 'object' ? manifest.pictures : {};
  normalizedBuildPictureUrls = new Map(
    Object.entries(buildPictureUrls).map(([picturePath, assetUrl]) => [picturePath.toLowerCase(), assetUrl]),
  );
}

export function getUnitIconUrl(id) {
  if (!id) return '/logo.svg';
  return unitpicUrls[id.toLowerCase()] || '/logo.svg';
}

export function getBuildPictureOptions() {
  return Object.keys(buildPictureUrls);
}

export function getBuildPicturePreviewUrl(value) {
  const normalized = String(value || '').trim().replaceAll('\\', '/').toLowerCase();
  if (!normalized) return '';
  return normalizedBuildPictureUrls.get(normalized) || '';
}
