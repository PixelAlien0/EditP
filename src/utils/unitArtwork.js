import unitpicManifest from '../data/unitpic-manifest.json';

export function getUnitIconUrl(id) {
  if (!id) return '/logo.svg';
  return unitpicManifest.units?.[id.toLowerCase()] || '/logo.svg';
}
