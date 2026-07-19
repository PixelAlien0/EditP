import assetManifest from '../data/bar-asset-manifest.json';

export const ASSET_TYPE_LABELS = Object.freeze({
  unitModel: 'Unit models',
  unitScript: 'Unit scripts',
  buildPicture: 'Build pictures',
  iconType: 'Icon types',
  collisionVolumeType: 'Collision volume types',
  projectileModel: 'Projectile models',
  sound: 'Sounds',
  ceg: 'CEGs',
  texture: 'Textures'
});

export function getAssetOptions(assetType) {
  return assetManifest.categories?.[assetType] || [];
}

export function isKnownBarAsset(assetType, value) {
  if (!value) return false;
  const normalized = String(value).trim().toLowerCase();
  return getAssetOptions(assetType).some(asset => asset.toLowerCase() === normalized);
}

export function getAssetManifestMetadata() {
  return {
    version: assetManifest.version,
    sourceRepository: assetManifest.sourceRepository,
    sourceCommit: assetManifest.sourceCommit
  };
}
