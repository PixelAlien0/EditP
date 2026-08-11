import { getGadgetContract } from './gadgetContracts.js';

export const CUSTOM_PARAMETER_BUNDLE_REGISTRY_VERSION = 1;

const freezeProfile = (id, label, description, values) => Object.freeze({
  id,
  label,
  description,
  values: Object.freeze(values),
});

const ENERGY_CONVERTER_PROFILES = Object.freeze([
  freezeProfile('basic', 'Basic converter', 'BAR-style early converter throughput.', {
    'customparams.energyconv_capacity': 70,
    'customparams.energyconv_efficiency': 0.01429,
  }),
  freezeProfile('advanced', 'Advanced converter', 'BAR-style advanced converter throughput.', {
    'customparams.energyconv_capacity': 600,
    'customparams.energyconv_efficiency': 0.01724,
  }),
  freezeProfile('epic', 'Epic converter', 'High-capacity profile used by epic conversion structures.', {
    'customparams.energyconv_capacity': 6000,
    'customparams.energyconv_efficiency': 0.02,
  }),
]);

const scavengerProfile = (id, label, description, values) => freezeProfile(id, label, description, {
  'customparams.scavcustomsquad': true,
  ...Object.fromEntries(Object.entries(values).map(([key, value]) => [`customparams.${key}`, value])),
});

const SCAVENGER_SQUAD_PROFILES = Object.freeze([
  scavengerProfile('fighter', 'Fighter screen', 'Six-unit basic berserk screen.', {
    scavsquadunitsamount: 6, scavsquadminanger: 15, scavsquadmaxanger: 140,
    scavsquadweight: 100, scavsquadrarity: 'basic', scavsquadbehavior: 'berserk',
    scavsquadbehaviordistance: 1000, scavsquadbehaviorchance: 1,
  }),
  scavengerProfile('scout', 'Scout raider', 'Single-unit basic raider scout.', {
    scavsquadunitsamount: 1, scavsquadminanger: 15, scavsquadmaxanger: 100,
    scavsquadweight: 100, scavsquadrarity: 'basic', scavsquadbehavior: 'raider',
    scavsquadbehaviordistance: 600, scavsquadbehaviorchance: 1,
  }),
  scavengerProfile('assault', 'Assault group', 'Two-unit basic close assault group.', {
    scavsquadunitsamount: 2, scavsquadminanger: 30, scavsquadmaxanger: 120,
    scavsquadweight: 150, scavsquadrarity: 'basic', scavsquadbehavior: 'berserk',
    scavsquadbehaviordistance: 1000, scavsquadbehaviorchance: 1,
  }),
  scavengerProfile('artillery', 'Artillery group', 'Two-unit basic long-range group.', {
    scavsquadunitsamount: 2, scavsquadminanger: 30, scavsquadmaxanger: 120,
    scavsquadweight: 150, scavsquadrarity: 'basic', scavsquadbehavior: 'artillery',
    scavsquadbehaviordistance: 1100, scavsquadbehaviorchance: 1,
  }),
  scavengerProfile('special', 'Special encounter', 'Two-unit special-rarity raider group.', {
    scavsquadunitsamount: 2, scavsquadminanger: 55, scavsquadmaxanger: 120,
    scavsquadweight: 150, scavsquadrarity: 'special', scavsquadbehavior: 'raider',
    scavsquadbehaviordistance: 1000, scavsquadbehaviorchance: 1,
  }),
]);

const bundle = ({ contractId, label, eyebrow, description, profiles, disablePatch }) => {
  const contract = getGadgetContract(contractId);
  if (!contract || contract.scope !== 'unit') throw new Error(`Unknown unit gadget contract: ${contractId}`);
  return Object.freeze({
    id: contractId,
    contractId,
    label,
    eyebrow,
    description,
    keys: contract.triggerKeys,
    requiredKeys: contract.requiredKeys,
    activationKeys: contract.activationKeys || Object.freeze([]),
    source: contract.source,
    profiles,
    defaultProfileId: profiles[0].id,
    disablePatch: disablePatch ? Object.freeze(disablePatch) : null,
  });
};

export const CUSTOM_PARAMETER_BUNDLES = Object.freeze([
  bundle({
    contractId: 'energy-converter',
    eyebrow: 'BAR energy conversion',
    label: 'Energy converter contract',
    description: 'Apply capacity and efficiency together so the runtime receives a complete conversion contract.',
    profiles: ENERGY_CONVERTER_PROFILES,
  }),
  bundle({
    contractId: 'scavenger-squad',
    eyebrow: 'BAR Scavenger system',
    label: 'Scavenger squad contract',
    description: 'Register this unit for Scavenger squad selection with a complete tested role profile.',
    profiles: SCAVENGER_SQUAD_PROFILES,
    disablePatch: {
      'customparams.scavcustomsquad': false,
      ...Object.fromEntries(getGadgetContract('scavenger-squad').triggerKeys
        .filter(key => key !== 'customparams.scavcustomsquad')
        .map(key => [key, undefined])),
    },
  }),
]);

export const CUSTOM_PARAMETER_BUNDLE_BY_ID = new Map(
  CUSTOM_PARAMETER_BUNDLES.map(entry => [entry.id, entry]),
);

export function getCustomParameterBundle(bundleId) {
  return CUSTOM_PARAMETER_BUNDLE_BY_ID.get(bundleId) || null;
}

function getProfile(bundleId, profileId) {
  const entry = getCustomParameterBundle(bundleId);
  if (!entry) return null;
  return entry.profiles.find(profile => profile.id === profileId) || null;
}

export function buildCustomParameterBundleProfilePatch(bundleId, profileId) {
  const profile = getProfile(bundleId, profileId);
  return profile ? { ...profile.values } : null;
}

export function buildCustomParameterBundleResetPatch(bundleId) {
  const entry = getCustomParameterBundle(bundleId);
  return entry ? Object.fromEntries(entry.keys.map(key => [key, undefined])) : null;
}

export function buildCustomParameterBundleDisablePatch(bundleId) {
  const entry = getCustomParameterBundle(bundleId);
  return entry?.disablePatch ? { ...entry.disablePatch } : null;
}

const hasValue = value => value !== undefined && value !== null && String(value).trim() !== '';
const isActiveValue = value => hasValue(value)
  && ![false, 0, '0', 'false', 'off', 'no'].includes(typeof value === 'string' ? value.trim().toLowerCase() : value);

export function getCustomParameterBundleState(entry, defaults = {}, tweaks = {}) {
  const effectiveValue = key => Object.prototype.hasOwnProperty.call(tweaks, key) ? tweaks[key] : defaults[key];
  const configuredCount = entry.keys.filter(key => hasValue(effectiveValue(key))).length;
  const modifiedCount = entry.keys.filter(key => Object.prototype.hasOwnProperty.call(tweaks, key)).length;
  const activationReady = entry.activationKeys.length === 0
    || entry.activationKeys.every(key => isActiveValue(effectiveValue(key)));
  const requiredReady = entry.requiredKeys.every(key => hasValue(effectiveValue(key)));
  const nonActivationConfigured = entry.keys
    .filter(key => !entry.activationKeys.includes(key))
    .some(key => hasValue(effectiveValue(key)));

  let status = 'inactive';
  if (activationReady && requiredReady) status = 'ready';
  else if (configuredCount > 0 && (nonActivationConfigured || entry.activationKeys.length === 0)) status = 'partial';

  return Object.freeze({ status, configuredCount, modifiedCount, totalCount: entry.keys.length });
}
