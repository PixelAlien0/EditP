import assetManifest from '../data/bar-asset-manifest.json';
import { getBuildPictureOptions, getBuildPicturePreviewUrl } from './unitArtwork.js';

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
  const bundled = assetManifest.categories?.[assetType] || [];
  if (assetType !== 'buildPicture') return bundled;
  return [...new Map([...bundled, ...getBuildPictureOptions()].map(value => [value.toLowerCase(), value])).values()]
    .sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base' }));
}

export function getAssetPreviewUrl(assetType, value) {
  return assetType === 'buildPicture' ? getBuildPicturePreviewUrl(value) : '';
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
