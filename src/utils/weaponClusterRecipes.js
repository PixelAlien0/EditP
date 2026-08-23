const cleanId = value => String(value || '').trim().toLowerCase();

const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export const WEAPON_CLUSTER_RECIPES = Object.freeze({
  'napalm-blossom': Object.freeze({
    id: 'napalm-blossom',
    label: 'Napalm Blossom',
    supportingKey: 'editp_napalm_blossom',
    clusterCount: 7,
    kind: 'combat',
    flight: 'Flame curls',
    pattern: 'Short radial bloom',
    description: 'Slow flame tongues curl out from the impact and ignite a compact area.',
  }),
  'meteor-rain': Object.freeze({
    id: 'meteor-rain',
    label: 'Meteor Rain',
    supportingKey: 'editp_meteor_rain',
    clusterCount: 8,
    kind: 'combat',
    flight: 'Heavy ballistic',
    pattern: 'Falling rain',
    description: 'Impact-fired meteor fragments that arc outward, lose height quickly, and saturate the surrounding ground.',
  }),
  'emp-starburst': Object.freeze({
    id: 'emp-starburst',
    label: 'EMP Starburst',
    supportingKey: 'editp_emp_starburst',
    clusterCount: 6,
    kind: 'combat',
    flight: 'Drifting EMP',
    pattern: 'Staggered star',
    description: 'A short-lived ring of paralyzing fragments that trades raw damage for a compact EMP lockdown.',
  }),
  'razor-halo': Object.freeze({
    id: 'razor-halo',
    label: 'Razor Halo',
    supportingKey: 'editp_razor_halo',
    clusterCount: 12,
    kind: 'combat',
    flight: 'Laser shards',
    pattern: 'Fast wide halo',
    description: 'Twelve fast, low-area shrapnel rounds form a wide kinetic halo around the impact point.',
  }),
  'seismic-crown': Object.freeze({
    id: 'seismic-crown',
    label: 'Seismic Crown',
    supportingKey: 'editp_seismic_crown',
    clusterCount: 5,
    kind: 'combat',
    flight: 'Bomb fragments',
    pattern: 'Tight heavy crown',
    description: 'Five heavy fragments fall into a tight crown with strong terrain and impulse character.',
  }),
  'pursuit-swarm': Object.freeze({
    id: 'pursuit-swarm',
    label: 'Pursuit Swarm',
    supportingKey: 'editp_pursuit_swarm',
    clusterCount: 9,
    kind: 'combat',
    flight: 'Guided missiles',
    pattern: 'Homing swarm',
    description: 'Guided child missiles accelerate away from the impact and continue tracking the inherited target.',
  }),
  'plasma-rosette': Object.freeze({
    id: 'plasma-rosette',
    label: 'Plasma Rosette',
    supportingKey: 'editp_plasma_rosette',
    clusterCount: 10,
    kind: 'combat',
    flight: 'Plasma petals',
    pattern: 'Rotating rosette',
    description: 'A balanced flower of medium plasma fragments with readable spacing and dependable splash damage.',
  }),
  'thunder-web': Object.freeze({
    id: 'thunder-web',
    label: 'Thunder Web',
    supportingKey: 'editp_thunder_web',
    clusterCount: 7,
    kind: 'combat',
    flight: 'Dancing EMP',
    pattern: 'Unstable web',
    description: 'Electrical fragments lace the impact zone with light paralysis and bright lightning hits.',
  }),
  'gravity-sink': Object.freeze({
    id: 'gravity-sink',
    label: 'Gravity Sink',
    supportingKey: 'editp_gravity_sink',
    clusterCount: 6,
    kind: 'combat',
    flight: 'Slow imploders',
    pattern: 'Inward sink',
    description: 'Wide, low-damage fragments use negative impulse to pull nearby units toward the impact.',
  }),
  'flak-constellation': Object.freeze({
    id: 'flak-constellation',
    label: 'Flak Constellation',
    supportingKey: 'editp_flak_constellation',
    clusterCount: 11,
    kind: 'combat',
    flight: 'Timed airburst',
    pattern: 'Broad AA field',
    description: 'A broad constellation of flak bursts weighted toward airborne targets.',
  }),
  'breach-needles': Object.freeze({
    id: 'breach-needles',
    label: 'Breach Needles',
    supportingKey: 'editp_breach_needles',
    clusterCount: 4,
    kind: 'combat',
    flight: 'Rail needles',
    pattern: 'Narrow penetration',
    description: 'Four extremely fast, precise shards concentrate damage with almost no splash.',
  }),
  'starfire-choir': Object.freeze({
    id: 'starfire-choir',
    label: 'Starfire Choir',
    supportingKey: 'editp_starfire_choir',
    clusterCount: 8,
    kind: 'combat',
    flight: 'Rising rockets',
    pattern: 'Delayed high arc',
    description: 'A rising chorus of accelerating missiles creates a dramatic delayed second strike.',
  }),
  'blue-nova': Object.freeze({
    id: 'blue-nova',
    label: 'Blue Nova',
    supportingKey: 'editp_blue_nova',
    clusterCount: 9,
    kind: 'visual',
    flight: 'Blue laser rays',
    pattern: 'Clean radial nova',
    description: 'Visual only: a clean blue laser-hit bloom with zero damage, impulse, or terrain deformation.',
  }),
  'spark-veil': Object.freeze({
    id: 'spark-veil',
    label: 'Spark Veil',
    supportingKey: 'editp_spark_veil',
    clusterCount: 14,
    kind: 'visual',
    flight: 'Jittering sparks',
    pattern: 'Fine particle veil',
    description: 'Visual only: a fine veil of plasma sparks with zero damage, impulse, or terrain deformation.',
  }),
  'scav-mirage': Object.freeze({
    id: 'scav-mirage',
    label: 'Scav Mirage',
    supportingKey: 'editp_scav_mirage',
    clusterCount: 6,
    kind: 'visual',
    flight: 'Wobbling wisps',
    pattern: 'Slow mirage spiral',
    description: 'Visual only: eerie Scavenger mist blooms around the impact without changing combat.',
  }),
  'aqua-prism': Object.freeze({
    id: 'aqua-prism',
    label: 'Aqua Prism',
    supportingKey: 'editp_aqua_prism',
    clusterCount: 8,
    kind: 'visual',
    flight: 'Aqua prisms',
    pattern: 'Angular refraction',
    description: 'Visual only: cool aqua laser facets radiate from the impact without changing combat.',
  }),
  'verdant-echo': Object.freeze({
    id: 'verdant-echo',
    label: 'Verdant Echo',
    supportingKey: 'editp_verdant_echo',
    clusterCount: 10,
    kind: 'visual',
    flight: 'Arcing motes',
    pattern: 'Layered green echo',
    description: 'Visual only: layered green energy blooms leave a restrained luminous echo.',
  }),
  'crimson-petals': Object.freeze({
    id: 'crimson-petals',
    label: 'Crimson Petals',
    supportingKey: 'editp_crimson_petals',
    clusterCount: 12,
    kind: 'visual',
    flight: 'Red light petals',
    pattern: 'Compact flower',
    description: 'Visual only: compact red laser impacts scatter like petals around the target.',
  }),
  'golden-flicker': Object.freeze({
    id: 'golden-flicker',
    label: 'Golden Flicker',
    supportingKey: 'editp_golden_flicker',
    clusterCount: 15,
    kind: 'visual',
    flight: 'Golden pulses',
    pattern: 'Rapid shimmer',
    description: 'Visual only: small golden flashes create a dense celebratory shimmer.',
  }),
  'acid-aurora': Object.freeze({
    id: 'acid-aurora',
    label: 'Acid Aurora',
    supportingKey: 'editp_acid_aurora',
    clusterCount: 7,
    kind: 'visual',
    flight: 'Acid flame curls',
    pattern: 'Rising aurora',
    description: 'Visual only: vivid acidic light curls through the impact zone with no damage.',
  }),
  'raptor-embers': Object.freeze({
    id: 'raptor-embers',
    label: 'Raptor Embers',
    supportingKey: 'editp_raptor_embers',
    clusterCount: 9,
    kind: 'visual',
    flight: 'Falling embers',
    pattern: 'Raptor scatter',
    description: 'Visual only: hot Raptor sparks and embers punctuate the impact without applying damage.',
  }),
  'black-ash': Object.freeze({
    id: 'black-ash',
    label: 'Black Ash',
    supportingKey: 'editp_black_ash',
    clusterCount: 5,
    kind: 'visual',
    flight: 'Heavy ash',
    pattern: 'Slow descending plume',
    description: 'Visual only: dark combustion plumes give heavy impacts a smoky afterimage.',
  }),
  'dust-halo': Object.freeze({
    id: 'dust-halo',
    label: 'Dust Halo',
    supportingKey: 'editp_dust_halo',
    clusterCount: 14,
    kind: 'visual',
    flight: 'Ground skimmers',
    pattern: 'Wide flat ring',
    description: 'Visual only: a broad ring of earth-toned dust marks the impact without deforming terrain.',
  }),
  'void-pulse': Object.freeze({
    id: 'void-pulse',
    label: 'Void Pulse',
    supportingKey: 'editp_void_pulse',
    clusterCount: 6,
    kind: 'visual',
    flight: 'Accelerating wisps',
    pattern: 'Pulsing void spiral',
    description: 'Visual only: compact Scavenger haze creates a muted, otherworldly pulse.',
  }),
});

function buildNapalmBlossomDefinition({ recipe, childDamage, childAoe }) {
  return {
    name: `${recipe.label} flame`,
    weapontype: 'Flame',
    range: 260,
    reloadtime: 1,
    weaponvelocity: 230,
    duration: 0.75,
    sizegrowth: 0.45,
    areaofeffect: childAoe,
    edgeeffectiveness: 0.35,
    accuracy: 0,
    sprayangle: 0,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 100,
    impulsefactor: 0.123,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:fire-explosion-small',
    cegtag: 'burnflame-xs',
    soundhitdry: 'flamhit1',
    soundhitwet: 'sizzle',
    damage: { default: childDamage },
    customparams: { area_onhit: 1 },
  };
}

function buildMeteorRainDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} fragment`,
    weapontype: 'Cannon',
    range: 520,
    reloadtime: 1,
    weaponvelocity: 245,
    areaofeffect: Math.round(clamp(parentAoe * 0.55, 64, 150)),
    edgeeffectiveness: 0.4,
    accuracy: 850,
    sprayangle: 650,
    gravityaffected: true,
    mygravity: 0.32,
    model: 'meteor.s3o',
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 70,
    impulsefactor: 0.2,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:genericshellexplosion-meteor',
    cegtag: 'meteortrail',
    soundhitdry: 'xplonuk4',
    soundhitwet: 'sizzle',
    damage: {
      default: Math.round(clamp(parentDamage * 0.12, 18, 220)),
      commanders: Math.round(clamp(parentDamage * 0.025, 5, 40)),
    },
  };
}

function buildEmpStarburstDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} pulse`,
    weapontype: 'EmgCannon',
    range: 400,
    reloadtime: 1,
    weaponvelocity: 390,
    areaofeffect: Math.round(clamp(parentAoe * 0.7, 56, 144)),
    edgeeffectiveness: 0.55,
    accuracy: 260,
    sprayangle: 1080,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    craterboost: 0,
    cratermult: 0,
    paralyzer: true,
    paralyzetime: 6,
    explosiongenerator: 'custom:laserhit-emp',
    soundstart: 'hackshotxl3',
    soundhitwet: 'sizzle',
    damage: {
      default: Math.round(clamp(parentDamage * 0.055, 12, 100)),
    },
  };
}

function buildRazorHaloDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} shard`,
    weapontype: 'LaserCannon',
    range: 460,
    reloadtime: 1,
    weaponvelocity: 1250,
    duration: 0.08,
    thickness: 1.4,
    rgbcolor: '1 0.72 0.78',
    areaofeffect: Math.round(clamp(parentAoe * 0.25, 16, 56)),
    edgeeffectiveness: 0.15,
    accuracy: 160,
    sprayangle: 1450,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0.35,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:genericshellexplosion-tiny-aa',
    damage: {
      default: Math.round(clamp(parentDamage * 0.07, 10, 130)),
    },
  };
}

function buildSeismicCrownDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} bomb`,
    weapontype: 'AircraftBomb',
    range: 340,
    reloadtime: 1,
    weaponvelocity: 170,
    areaofeffect: Math.round(clamp(parentAoe * 0.85, 80, 200)),
    edgeeffectiveness: 0.6,
    accuracy: 520,
    sprayangle: 760,
    gravityaffected: true,
    mygravity: 0.24,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 1.4,
    craterboost: 0.6,
    cratermult: 0.8,
    explosiongenerator: 'custom:genericshellexplosion-small',
    damage: {
      default: Math.round(clamp(parentDamage * 0.09, 20, 180)),
    },
  };
}

function buildPursuitSwarmDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} missile`,
    weapontype: 'MissileLauncher',
    range: 650,
    reloadtime: 1,
    startvelocity: 160,
    weaponacceleration: 140,
    weaponvelocity: 760,
    flighttime: 2.4,
    tracks: true,
    turnrate: 42000,
    tolerance: 10000,
    areaofeffect: Math.round(clamp(parentAoe * 0.3, 24, 64)),
    edgeeffectiveness: 0.25,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    craterboost: 0,
    cratermult: 0,
    smoketrail: true,
    smokeperiod: 4,
    smokesize: 1.4,
    smoketime: 8,
    model: 'cormissilefighter.s3o',
    cegtag: 'missiletrailfighter',
    explosiongenerator: 'custom:genericshellexplosion-tiny-air',
    soundstart: 'Rocklit3',
    soundhitdry: 'xplosml2',
    soundhitwet: 'splshbig',
    damage: {
      default: Math.round(clamp(parentDamage * 0.065, 12, 120)),
    },
  };
}

function buildPlasmaRosetteDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} petal`,
    weapontype: 'LaserCannon',
    range: 480,
    reloadtime: 1,
    weaponvelocity: 520,
    duration: 0.32,
    thickness: 3.2,
    rgbcolor: '0.72 0.42 1',
    areaofeffect: Math.round(clamp(parentAoe * 0.5, 40, 104)),
    edgeeffectiveness: 0.4,
    accuracy: 260,
    sprayangle: 980,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 20,
    impulsefactor: 0.123,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:plasmahit-medium',
    cegtag: 'Heavy-Plasma',
    damage: {
      default: Math.round(clamp(parentDamage * 0.075, 14, 150)),
    },
  };
}

function buildThunderWebDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} arc`,
    weapontype: 'EmgCannon',
    range: 430,
    reloadtime: 1,
    weaponvelocity: 460,
    wobble: 2400,
    dance: 18,
    areaofeffect: Math.round(clamp(parentAoe * 0.58, 48, 120)),
    edgeeffectiveness: 0.5,
    accuracy: 380,
    sprayangle: 860,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    craterboost: 0,
    cratermult: 0,
    paralyzer: true,
    paralyzetime: 2.5,
    explosiongenerator: 'custom:genericshellexplosion-small-lightning',
    damage: {
      default: Math.round(clamp(parentDamage * 0.06, 12, 115)),
    },
  };
}

function buildGravitySinkDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} fragment`,
    weapontype: 'Cannon',
    range: 360,
    reloadtime: 1,
    weaponvelocity: 300,
    areaofeffect: Math.round(clamp(parentAoe * 0.95, 96, 220)),
    edgeeffectiveness: 0.8,
    accuracy: 520,
    sprayangle: 620,
    gravityaffected: true,
    mygravity: 0.14,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: -1.8,
    impulseboost: -24,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:shockwaveceg',
    damage: {
      default: Math.round(clamp(parentDamage * 0.035, 8, 70)),
    },
  };
}

function buildFlakConstellationDefinition({ recipe, parentDamage, parentAoe }) {
  const baseDamage = Math.round(clamp(parentDamage * 0.045, 8, 85));
  return {
    name: `${recipe.label} burst`,
    weapontype: 'Cannon',
    range: 560,
    reloadtime: 1,
    weaponvelocity: 880,
    areaofeffect: Math.round(clamp(parentAoe * 0.72, 64, 144)),
    edgeeffectiveness: 0.7,
    accuracy: 720,
    sprayangle: 1250,
    gravityaffected: false,
    burnblow: true,
    selfexplode: true,
    flighttime: 0.65,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:flak',
    cegtag: 'flaktrailaa',
    damage: {
      default: baseDamage,
      vtol: Math.round(baseDamage * 2.5),
    },
  };
}

function buildBreachNeedlesDefinition({ recipe, parentDamage }) {
  return {
    name: `${recipe.label} shard`,
    weapontype: 'LaserCannon',
    range: 720,
    reloadtime: 1,
    weaponvelocity: 1800,
    duration: 0.04,
    thickness: 0.8,
    rgbcolor: '0.9 0.95 1',
    areaofeffect: 12,
    edgeeffectiveness: 0.05,
    accuracy: 35,
    sprayangle: 140,
    gravityaffected: false,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0.08,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: 'custom:genericshellexplosion-sniper',
    cegtag: 'railgun',
    damage: {
      default: Math.round(clamp(parentDamage * 0.16, 28, 300)),
    },
  };
}

function buildStarfireChoirDefinition({ recipe, parentDamage, parentAoe }) {
  return {
    name: `${recipe.label} missile`,
    weapontype: 'MissileLauncher',
    range: 760,
    reloadtime: 1,
    startvelocity: 80,
    weaponacceleration: 105,
    weaponvelocity: 620,
    flighttime: 3.2,
    tracks: false,
    trajectoryheight: 1.25,
    wobble: 420,
    dance: 6,
    areaofeffect: Math.round(clamp(parentAoe * 0.42, 40, 96)),
    edgeeffectiveness: 0.35,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 45,
    impulsefactor: 0.1,
    craterboost: 0,
    cratermult: 0,
    smoketrail: true,
    smokeperiod: 6,
    smokesize: 1.8,
    smoketime: 12,
    cegtag: 'starfire-small',
    explosiongenerator: 'custom:ministarfire-explosion',
    damage: {
      default: Math.round(clamp(parentDamage * 0.08, 16, 155)),
    },
  };
}

function buildVisualRecipeDefinition({ recipe, parentAoe, effect, trail, projectile = {} }) {
  return {
    name: `${recipe.label} visual`,
    range: 400,
    reloadtime: 1,
    areaofeffect: Math.round(clamp(parentAoe * 0.45, 32, 96)),
    edgeeffectiveness: 0,
    ...projectile,
    avoidfeature: false,
    avoidfriendly: false,
    collidefriendly: false,
    noselfdamage: true,
    firestarter: 0,
    impulsefactor: 0,
    impulseboost: 0,
    craterboost: 0,
    cratermult: 0,
    explosiongenerator: effect,
    ...(trail ? { cegtag: trail } : {}),
    damage: { default: 0 },
  };
}

function buildBlueNovaDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:laserhit-large-blue',
    trail: 'blob_trail_blue',
    projectile: {
      weapontype: 'LaserCannon',
      weaponvelocity: 980,
      duration: 0.18,
      thickness: 2.6,
      rgbcolor: '0.2 0.55 1',
      accuracy: 40,
      sprayangle: 1150,
      gravityaffected: false,
    },
  });
}

function buildSparkVeilDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:plasmahit-sparkonly',
    projectile: {
      weapontype: 'EmgCannon',
      weaponvelocity: 620,
      accuracy: 780,
      sprayangle: 1550,
      wobble: 1200,
      dance: 8,
      gravityaffected: false,
    },
  });
}

function buildScavMirageDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:scav_mist_explosion',
    trail: 'scaspawn-greentrail',
    projectile: {
      weapontype: 'MissileLauncher',
      startvelocity: 90,
      weaponacceleration: 45,
      weaponvelocity: 310,
      flighttime: 2.2,
      tracks: false,
      wobble: 3200,
      dance: 28,
      trajectoryheight: 0.35,
    },
  });
}

function buildAquaPrismDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:laserhit-large-aqua',
    projectile: {
      weapontype: 'LaserCannon',
      weaponvelocity: 720,
      duration: 0.45,
      thickness: 4,
      rgbcolor: '0.2 1 0.9',
      accuracy: 180,
      sprayangle: 680,
      gravityaffected: false,
    },
  });
}

function buildVerdantEchoDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:laserhit-large-green',
    projectile: {
      weapontype: 'Cannon',
      weaponvelocity: 280,
      accuracy: 360,
      sprayangle: 820,
      gravityaffected: true,
      mygravity: 0.18,
    },
  });
}

function buildCrimsonPetalsDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:laserhit-medium-red',
    projectile: {
      weapontype: 'LaserCannon',
      weaponvelocity: 1120,
      duration: 0.1,
      thickness: 1.7,
      rgbcolor: '1 0.16 0.22',
      accuracy: 120,
      sprayangle: 1320,
      gravityaffected: false,
    },
  });
}

function buildGoldenFlickerDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:laserhit-small-yellow',
    projectile: {
      weapontype: 'EmgCannon',
      weaponvelocity: 1350,
      accuracy: 960,
      sprayangle: 1850,
      gravityaffected: false,
    },
  });
}

function buildAcidAuroraDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:acid-explosion-small',
    projectile: {
      weapontype: 'Flame',
      weaponvelocity: 190,
      duration: 1.1,
      sizegrowth: 0.7,
      accuracy: 260,
      sprayangle: 760,
      gravityaffected: false,
    },
  });
}

function buildRaptorEmbersDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:raptorspike-small-sparks-burn',
    projectile: {
      weapontype: 'AircraftBomb',
      weaponvelocity: 205,
      accuracy: 620,
      sprayangle: 920,
      gravityaffected: true,
      mygravity: 0.28,
    },
  });
}

function buildBlackAshDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:burnblackbig',
    projectile: {
      weapontype: 'Cannon',
      weaponvelocity: 145,
      accuracy: 210,
      sprayangle: 520,
      gravityaffected: true,
      mygravity: 0.42,
    },
  });
}

function buildDustHaloDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:dirtpoof',
    projectile: {
      weapontype: 'Cannon',
      range: 300,
      weaponvelocity: 440,
      accuracy: 60,
      sprayangle: 1750,
      gravityaffected: true,
      mygravity: 0.035,
    },
  });
}

function buildVoidPulseDefinition(options) {
  return buildVisualRecipeDefinition({
    ...options,
    effect: 'custom:scavmist',
    projectile: {
      weapontype: 'MissileLauncher',
      startvelocity: 35,
      weaponacceleration: 180,
      weaponvelocity: 680,
      flighttime: 1.5,
      tracks: false,
      wobble: 850,
      dance: 12,
      trajectoryheight: 0.8,
    },
  });
}

const RECIPE_BUILDERS = Object.freeze({
  'napalm-blossom': buildNapalmBlossomDefinition,
  'meteor-rain': buildMeteorRainDefinition,
  'emp-starburst': buildEmpStarburstDefinition,
  'razor-halo': buildRazorHaloDefinition,
  'seismic-crown': buildSeismicCrownDefinition,
  'pursuit-swarm': buildPursuitSwarmDefinition,
  'plasma-rosette': buildPlasmaRosetteDefinition,
  'thunder-web': buildThunderWebDefinition,
  'gravity-sink': buildGravitySinkDefinition,
  'flak-constellation': buildFlakConstellationDefinition,
  'breach-needles': buildBreachNeedlesDefinition,
  'starfire-choir': buildStarfireChoirDefinition,
  'blue-nova': buildBlueNovaDefinition,
  'spark-veil': buildSparkVeilDefinition,
  'scav-mirage': buildScavMirageDefinition,
  'aqua-prism': buildAquaPrismDefinition,
  'verdant-echo': buildVerdantEchoDefinition,
  'crimson-petals': buildCrimsonPetalsDefinition,
  'golden-flicker': buildGoldenFlickerDefinition,
  'acid-aurora': buildAcidAuroraDefinition,
  'raptor-embers': buildRaptorEmbersDefinition,
  'black-ash': buildBlackAshDefinition,
  'dust-halo': buildDustHaloDefinition,
  'void-pulse': buildVoidPulseDefinition,
});

export function buildWeaponClusterRecipeApplication({
  recipeId,
  ownerUnitId,
  slotNumber,
  sourceSlot = {},
  unitTweaks = {},
}) {
  const recipe = WEAPON_CLUSTER_RECIPES[recipeId];
  const owner = cleanId(ownerUnitId);
  const slot = Number(slotNumber);
  if (!recipe) throw new Error(`Unknown cluster recipe: ${recipeId}`);
  if (!owner) throw new Error('A target UnitDef is required.');
  if (!Number.isInteger(slot) || slot < 1) throw new Error('A valid weapon slot is required.');

  const prefix = `weapon_slot_${slot}_`;
  const parentDamage = finiteNumber(unitTweaks[`${prefix}damage`] ?? sourceSlot.damage, 100);
  const parentAoe = finiteNumber(unitTweaks[`${prefix}aoe`] ?? sourceSlot.aoe, 96);
  const childDamage = Math.round(clamp(parentDamage * 0.1, 8, 180));
  const childAoe = Math.round(clamp(parentAoe * 0.65, 48, 120));

  const buildDefinition = RECIPE_BUILDERS[recipe.id];
  if (!buildDefinition) throw new Error(`Cluster recipe has no builder: ${recipe.id}`);
  const definition = buildDefinition({ recipe, parentDamage, parentAoe, childDamage, childAoe });

  const supportingDefinition = {
    id: `support_recipe_${recipe.id.replaceAll('-', '_')}_${owner}`,
    ownerUnitId: owner,
    key: recipe.supportingKey,
    label: recipe.label,
    definition,
    enabled: true,
    mode: 'replace',
    role: 'cluster-child',
    mountedSlots: [],
    dependencies: [],
    referencedBy: [`weapon slot ${slot}`],
    sourceName: `BAR Editor recipe: ${recipe.label}`,
  };

  return {
    recipe,
    supportingDefinition,
    tweakPatch: {
      [`${prefix}cluster_def`]: recipe.supportingKey,
      [`${prefix}cluster_number`]: recipe.clusterCount,
    },
  };
}

export function applyWeaponClusterRecipe(project, options) {
  const application = buildWeaponClusterRecipeApplication({
    ...options,
    unitTweaks: project.tweaks?.[options.ownerUnitId] || {},
  });
  const destination = `${application.supportingDefinition.ownerUnitId}:${application.supportingDefinition.key}`;
  const currentDefinitions = project.supportingWeaponDefs || [];
  const existingIndex = currentDefinitions.findIndex(definition => (
    `${cleanId(definition.ownerUnitId)}:${cleanId(definition.key)}` === destination
  ));
  const supportingWeaponDefs = [...currentDefinitions];
  if (existingIndex >= 0) {
    supportingWeaponDefs[existingIndex] = {
      ...supportingWeaponDefs[existingIndex],
      ...application.supportingDefinition,
      id: supportingWeaponDefs[existingIndex].id || application.supportingDefinition.id,
    };
  } else {
    supportingWeaponDefs.push(application.supportingDefinition);
  }

  const unitId = options.ownerUnitId;
  return {
    supportingWeaponDefs,
    tweaks: {
      ...project.tweaks,
      [unitId]: {
        ...(project.tweaks?.[unitId] || {}),
        ...application.tweakPatch,
      },
    },
    includeTweaks: true,
  };
}
