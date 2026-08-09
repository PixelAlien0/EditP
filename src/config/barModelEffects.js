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

const proceduralOrb = (anchor, diameterRatio, appearance = ENERGY_ORB) => ({
  anchor,
  sizeBasis: 'footprint',
  diameterRatio,
  ...appearance,
});

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
    proceduralEffects: [proceduralOrb('emit', 0.46)],
  }),
  'units/armafust3.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('emit', 0.52)],
  }),
  'units/corafus.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('emit', 0.42)],
  }),
  'units/corafust3.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('emit', 0.48)],
  }),
  'units/legafus.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('emit', 0.4)],
  }),
  'units/legafust3.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('emit', 0.46)],
  }),
  'units/armgate.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('shield', 0.3, SHIELD_ORB)],
  }),
  'units/armfgate.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('emit', 0.28, SHIELD_ORB)],
  }),
  'units/armgatet3.s3o': Object.freeze({
    proceduralEffects: [proceduralOrb('shield', 0.34, SHIELD_ORB)],
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
