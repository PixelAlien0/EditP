import assetManifest from '../data/bar-asset-manifest.json';
import { getBuildPictureOptions, getBuildPicturePreviewUrl } from './unitArtwork.js';

let tacticalIcons = null;
let tacticalIconLoad = null;
let soundManifest = null;
let soundManifestLoad = null;

export const ASSET_TYPE_LABELS = Object.freeze({
  unitModel: 'Unit models',
  unitScript: 'Unit scripts',
  buildPicture: 'Build pictures',
  iconType: 'Tactical icons',
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
  if (assetType === 'buildPicture') return getBuildPicturePreviewUrl(value);
  if (assetType === 'iconType') return getTacticalIcon(value)?.url || '';
  return '';
}

export function getSoundAudioUrls(soundName) {
  if (!soundName) return [];
  const clean = String(soundName).trim().replace(/\.(wav|ogg|mp3)$/i, '').toLowerCase();
  if (!clean) return [];

  const rawBase = 'https://raw.githubusercontent.com/Beyond-All-Reason/Beyond-All-Reason/master/';
  const mappedPath = soundManifest?.[clean];
  if (mappedPath) {
    return [`${rawBase}${mappedPath}`];
  }

  return [
    `${rawBase}sounds/weapons-mult/${clean}.wav`,
    `${rawBase}sounds/weapons-mult/${clean}.ogg`,
    `${rawBase}sounds/weapons/${clean}.wav`,
    `${rawBase}sounds/weapons/${clean}.ogg`,
    `${rawBase}sounds/unit/${clean}.wav`,
    `${rawBase}sounds/unit/${clean}.ogg`,
    `${rawBase}sounds/bombs/${clean}.wav`,
    `${rawBase}sounds/bombs/${clean}.ogg`,
    `${rawBase}sounds/${clean}.wav`,
    `${rawBase}sounds/${clean}.ogg`
  ];
}

export function getAssetOptionMetadata(assetType, value) {
  if (assetType !== 'iconType') return null;
  const icon = getTacticalIcon(value);
  return icon ? { bitmap: icon.bitmap, size: icon.size } : null;
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

function getTacticalIcon(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase();
  const exact = tacticalIcons?.[normalized];
  if (exact) return exact;
  const key = Object.keys(tacticalIcons || {}).find(name => name.toLowerCase() === normalized);
  return key ? tacticalIcons[key] : null;
}

export async function loadAssetPreviewCatalog(assetType) {
  if (assetType === 'iconType' && !tacticalIcons) {
    tacticalIconLoad ||= import('../data/tactical-icon-manifest.json')
      .then(module => {
        tacticalIcons = module.default.icons || {};
      });
    await tacticalIconLoad;
  }
  if (assetType === 'sound' && !soundManifest) {
    soundManifestLoad ||= import('../data/bar-sound-manifest.json')
      .then(module => {
        soundManifest = module.default || {};
      });
    await soundManifestLoad;
  }
}
