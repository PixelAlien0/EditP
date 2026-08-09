const ENERGY_ORB = Object.freeze({
  color: '#77d9ff',
  opacity: 0.76,
  emissiveIntensity: 1.5,
  pulseSpeed: 1.45,
  pulseAmount: 0.035,
  rotationSpeed: 0.28,
});

const SHIELD_ORB = Object.freeze({
  color: '#c6a8ff',
  opacity: 0.68,
  emissiveIntensity: 1.32,
  pulseSpeed: 1.05,
  pulseAmount: 0.025,
  rotationSpeed: 0.2,
});

const energyNodes = (...names) => names.map(name => ({ name, ...ENERGY_ORB }));
const shieldNodes = (...names) => names.map(name => ({ name, ...SHIELD_ORB }));

const EFFECTS_BY_MODEL = Object.freeze({
  'units/armfus.s3o': Object.freeze({
    nodeEffects: energyNodes('ball1', 'ball2'),
  }),
  'units/armckfus.s3o': Object.freeze({
    nodeEffects: energyNodes('ball1', 'ball2'),
  }),
  'units/freefusion.s3o': Object.freeze({
    nodeEffects: energyNodes('fusionsphere'),
  }),
  'units/armafus.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.095, ...ENERGY_ORB }],
  }),
  'units/armafust3.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.095, ...ENERGY_ORB }],
  }),
  'units/corafus.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.09, ...ENERGY_ORB }],
  }),
  'units/corafust3.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.09, ...ENERGY_ORB }],
  }),
  'units/legafus.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.085, ...ENERGY_ORB }],
  }),
  'units/legafust3.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.085, ...ENERGY_ORB }],
  }),
  'units/armgate.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'shield', radiusFactor: 0.075, ...SHIELD_ORB }],
  }),
  'units/armfgate.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'emit', radiusFactor: 0.075, ...SHIELD_ORB }],
  }),
  'units/armgatet3.s3o': Object.freeze({
    proceduralEffects: [{ anchor: 'shield', radiusFactor: 0.085, ...SHIELD_ORB }],
  }),
  'units/leggatet3.s3o': Object.freeze({
    nodeEffects: shieldNodes(
      'bigshield_1',
      'bigshield_2',
      'bigshield_3',
      'smallshield_1',
      'smallshield_2',
      'smallshield_3',
    ),
  }),
});

const normalize = value => String(value || '').trim().replace(/\\/g, '/').toLowerCase();

export function getBarModelEffectProfile(modelPath) {
  return EFFECTS_BY_MODEL[normalize(modelPath)] || null;
}

export function getBarModelNodeEffect(profile, nodeName) {
  if (!profile) return null;
  const normalizedName = normalize(nodeName);
  return profile.nodeEffects?.find(effect => normalize(effect.name) === normalizedName) || null;
}

export const BAR_MODEL_EFFECT_PATHS = Object.freeze(Object.keys(EFFECTS_BY_MODEL));
