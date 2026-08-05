const STAT_PRESENTATION = Object.freeze({
  metalcost: { featured: true, group: 'Economy', unit: 'metal' },
  energycost: { featured: true, group: 'Economy', unit: 'energy' },
  buildtime: { featured: true, group: 'Economy', unit: 'work' },
  health: { featured: true, group: 'Durability', unit: 'HP' },
  mass: { group: 'Durability', unit: 'mass' },
  autoheal: { group: 'Durability', unit: 'HP/s' },
  sightdistance: { group: 'Sensors', unit: 'elmos' },
  radardistance: { group: 'Sensors', unit: 'elmos' },
  sonardistance: { group: 'Sensors', unit: 'elmos' },
  stealth: { group: 'Sensors' },
  sonarstealth: { group: 'Sensors' },
  workertime: { group: 'Economy', unit: 'work/s' },
  metalmake: { group: 'Production', unit: 'metal/s' },
  extractsmetal: { group: 'Production', unit: 'metal/s' },
  energymake: { group: 'Production', unit: 'energy/s' },
  metalstorage: { group: 'Storage & utility', unit: 'metal' },
  energystorage: { group: 'Storage & utility', unit: 'energy' },
  cloakcost: { group: 'Storage & utility', unit: 'energy/s' },
  cloakcostmoving: { group: 'Storage & utility', unit: 'energy/s' },
  builddistance: { group: 'Builder capabilities', unit: 'elmos' },
  'customparams.techlevel': { group: 'Classification', unit: 'tier' },
  'customparams.energyconv_capacity': { group: 'Production', unit: 'energy' },
  'customparams.energyconv_efficiency': { group: 'Production', unit: 'ratio' },
  'customparams.carried_unit': { group: 'Advanced behavior' },
  'customparams.spawnrate': { group: 'Advanced behavior', unit: 'seconds' },
  'customparams.maxunits': { group: 'Advanced behavior', unit: 'units' },
  'customparams.controlradius': { group: 'Advanced behavior', unit: 'elmos' },
  'customparams.enabledocking': { group: 'Advanced behavior' },
  'customparams.decayrate': { group: 'Advanced behavior', unit: 'HP/s' },
  'customparams.deathdecayrate': { group: 'Advanced behavior', unit: 'HP/s' },
  'customparams.carrierdeaththroe': { group: 'Advanced behavior' },
  'customparams.metalcost': { group: 'Advanced behavior', unit: 'metal' },
  'customparams.energycost': { group: 'Advanced behavior', unit: 'energy' },
  maxvelocity: { featured: true, group: 'Handling', unit: 'elmos/s' },
  acceleration: { featured: true, group: 'Handling', unit: 'elmos/s²' },
  brakerate: { featured: true, group: 'Handling', unit: 'elmos/s²' },
  turnrate: { featured: true, group: 'Handling', unit: 'turn/s' },
  maxslope: { group: 'Terrain access', unit: 'degrees' },
  maxwaterdepth: { group: 'Terrain access', unit: 'elmos' },
  minwaterdepth: { group: 'Terrain access', unit: 'elmos' },
  transportcapacity: { group: 'Transport' },
  cantbetransported: { group: 'Transport' },
  cruisealt: { group: 'Aircraft profile', unit: 'elmos' },
  explodeas: { group: 'Death & self-destruct' },
  selfdestructas: { group: 'Death & self-destruct' },
  selfdestructcountdown: { group: 'Death & self-destruct', unit: 'seconds' },
  canselfdestruct: { group: 'Death & self-destruct' },
  damagemodifier: { group: 'Durability', unit: 'multiplier' },
  crushresistance: { group: 'Durability', unit: 'mass' },
  blocking: { group: 'Collision & physics' },
  collide: { group: 'Collision & physics' },
  pushresistant: { group: 'Collision & physics' },
  upright: { group: 'Collision & physics' },
  waterline: { group: 'Terrain access', unit: 'elmos' },
  seismicsignature: { group: 'Sensors' },
  energyupkeep: { group: 'Production', unit: 'energy/s' },
  metalupkeep: { group: 'Production', unit: 'metal/s' },
  idleautoheal: { group: 'Durability', unit: 'HP/s' },
  idletime: { group: 'Durability', unit: 'seconds' },
  windgenerator: { group: 'Production', unit: 'energy/s' },
  tidalgenerator: { group: 'Production', unit: 'energy/s' },
  cancloak: { group: 'Cloaking' },
  initcloaked: { group: 'Cloaking' },
  mincloakdistance: { group: 'Cloaking', unit: 'elmos' },
  decloakonfire: { group: 'Cloaking' },
  decloakspherical: { group: 'Cloaking' },
  airsightdistance: { group: 'Sensors', unit: 'elmos' },
  radardistancejam: { group: 'Sensors', unit: 'elmos' },
  sonardistancejam: { group: 'Sensors', unit: 'elmos' },
  seismicdistance: { group: 'Sensors', unit: 'elmos' },
  builddistance: { group: 'Builder capabilities', unit: 'elmos', alwaysRelevant: true },
  builder: { group: 'Builder capabilities', alwaysRelevant: true },
  repairspeed: { group: 'Builder capabilities', unit: 'work/s' },
  reclaimspeed: { group: 'Builder capabilities', unit: 'work/s' },
  resurrectspeed: { group: 'Builder capabilities', unit: 'work/s' },
  capturespeed: { group: 'Builder capabilities', unit: 'work/s' },
  terraformspeed: { group: 'Builder capabilities', unit: 'work/s' },
  canrepair: { group: 'Builder capabilities' },
  canreclaim: { group: 'Builder capabilities' },
  canresurrect: { group: 'Builder capabilities' },
  cancapture: { group: 'Builder capabilities' },
  canassist: { group: 'Builder capabilities' },
  canbeassisted: { group: 'Builder capabilities' },
  maxreversevelocity: { group: 'Handling', unit: 'elmos/s' },
  turninplace: { group: 'Handling' },
  turninplaceanglelimit: { group: 'Handling', unit: 'degrees' },
  turninplacespeedlimit: { group: 'Handling', unit: 'elmos/s' },
  separationdistance: { group: 'Handling', unit: 'elmos' },
  maxbank: { group: 'Aircraft profile' },
  maxpitch: { group: 'Aircraft profile' },
  turnradius: { group: 'Aircraft profile', unit: 'elmos' },
  maxaileron: { group: 'Aircraft profile' },
  maxelevator: { group: 'Aircraft profile' },
  maxrudder: { group: 'Aircraft profile' },
  hoverattack: { group: 'Aircraft profile' },
  airstrafe: { group: 'Aircraft profile' },
  transportsize: { group: 'Transport' },
  transportmass: { group: 'Transport', unit: 'mass' },
  mintransportsize: { group: 'Transport' },
  mintransportmass: { group: 'Transport', unit: 'mass' },
  loadingradius: { group: 'Transport', unit: 'elmos' },
  unloadspread: { group: 'Transport', unit: 'elmos' },
  transportunloadmethod: { group: 'Transport' },
  releaseheld: { group: 'Transport' },
  holdsteady: { group: 'Transport' },
  transportbyenemy: { group: 'Transport' },
  canattack: { group: 'Combat behavior' },
  noautofire: { group: 'Combat behavior' },
  canmanualfire: { group: 'Combat behavior' },
  firestate: { group: 'Combat behavior' },
  movestate: { group: 'Combat behavior' },
  nochasecategory: { group: 'Combat behavior' },
  hightrajectory: { group: 'Combat behavior' },
  kamikaze: { group: 'Combat behavior' },
  kamikazedistance: { group: 'Combat behavior', unit: 'elmos' },
  footprintx: { group: 'Footprint & placement', unit: 'squares' },
  footprintz: { group: 'Footprint & placement', unit: 'squares' },
  yardmap: { group: 'Footprint & placement' },
  maxthisunit: { group: 'Classification', unit: 'units' },
  objectname: { group: 'Assets & collision' },
  script: { group: 'Assets & collision' },
  buildpic: { group: 'Assets & collision' },
  icontype: { group: 'Assets & collision' },
  collisionvolumetype: { group: 'Assets & collision' },
  collisionvolumescales: { group: 'Assets & collision' },
  collisionvolumeoffsets: { group: 'Assets & collision' },
  death_explosion_damage: { group: 'Death explosion profile', unit: 'damage' },
  death_explosion_aoe: { group: 'Death explosion profile', unit: 'elmos' },
  death_explosion_camerashake: { group: 'Death explosion profile' },
  death_explosion_impulsefactor: { group: 'Death explosion profile', unit: 'multiplier' },
  selfd_explosion_damage: { group: 'Self-destruct profile', unit: 'damage' },
  selfd_explosion_aoe: { group: 'Self-destruct profile', unit: 'elmos' },
  selfd_explosion_camerashake: { group: 'Self-destruct profile' },
  selfd_explosion_impulsefactor: { group: 'Self-destruct profile', unit: 'multiplier' },
});

export const UNIT_PARAMETER_GROUP_DESCRIPTIONS = Object.freeze({
  Additional: 'Additional engine fields and specialist unit behavior.',
  Economy: 'Construction costs, work requirements, and builder output.',
  Durability: 'Health, resistance, recovery, and physical weight.',
  Sensors: 'Vision, radar, sonar, stealth, and detection signatures.',
  Production: 'Resource generation, extraction, upkeep, and conversion.',
  'Storage & utility': 'Resource reserves, cloaking costs, and build reach.',
  Classification: 'Tech level, availability limits, and unit classification.',
  'Advanced behavior': 'BAR gadget contracts for carried and spawned units.',
  Handling: 'Acceleration, braking, turning, and movement response.',
  'Terrain access': 'Slope, water-depth, and terrain traversal constraints.',
  Transport: 'Cargo capacity, loading, unloading, and transport policy.',
  'Aircraft profile': 'Altitude, banking, strafing, and aircraft handling.',
  'Death & self-destruct': 'Explosion definitions and self-destruct policy.',
  'Collision & physics': 'Blocking, collision, push resistance, and posture.',
  Cloaking: 'Cloak availability, energy use, and reveal behavior.',
  'Builder capabilities': 'Repair, reclaim, capture, resurrection, and assist output.',
  'Combat behavior': 'Default orders, pursuit, manual fire, and kamikaze behavior.',
  'Footprint & placement': 'Occupied map cells, yard maps, and placement rules.',
  'Assets & collision': 'Models, scripts, build pictures, icons, and collision volumes.',
  'Death explosion profile': 'Damage, area, impulse, and camera response on death.',
  'Self-destruct profile': 'Damage, area, impulse, and camera response on self-destruct.',
});

export const UNIT_ENGINE_DEFAULTS_SOURCE = Object.freeze({
  repository: 'beyond-all-reason/RecoilEngine',
  commit: 'c5fa84d7bf0972c86614b4631b8cc93d09f181e8',
  file: 'rts/Sim/Units/UnitDef.cpp',
});

// Recoil fills these values after UnitDef Lua tables are loaded. Keep this metadata
// separate from BAR's explicit values so the editor never exports an inherited value.
const UNIT_ENGINE_DEFAULTS = Object.freeze({
  metalcost: 0, energycost: 0, buildtime: 100, health: 100,
  maxvelocity: 0, acceleration: 0.5, brakerate: { from: 'acceleration' }, turnrate: 0,
  mass: { from: 'metalcost', minimum: 1, maximum: 1000000 }, sightdistance: 0, radardistance: 0, sonardistance: 0,
  stealth: false, sonarstealth: false, workertime: 0, metalmake: 0, extractsmetal: 0,
  energymake: 0, metalstorage: 0, energystorage: 0, cloakcost: 0,
  cloakcostmoving: { from: 'cloakcost' }, builddistance: 128, autoheal: 0,
  maxslope: 0, maxwaterdepth: 10000000, minwaterdepth: -10000000,
  transportcapacity: 0, cantbetransported: { label: 'Movement-definition dependent' },
  cruisealt: 0, selfdestructcountdown: 5, canselfdestruct: true,
  damagemodifier: 1, crushresistance: { from: 'mass' }, blocking: true, collide: true,
  pushresistant: false, upright: false, waterline: 0, seismicsignature: -1,
  energyupkeep: 0, metalupkeep: 0, idleautoheal: 10, idletime: 600,
  windgenerator: 0, tidalgenerator: 0,
  cancloak: { from: 'cloakcost', transform: 'nonzero' }, initcloaked: false,
  mincloakdistance: 0, decloakonfire: true, decloakspherical: true,
  airsightdistance: { from: 'sightdistance', multiplier: 1.5 },
  radardistancejam: 0, sonardistancejam: 0, seismicdistance: 0,
  repairspeed: { from: 'workertime' }, reclaimspeed: { from: 'workertime' },
  resurrectspeed: { from: 'workertime' }, capturespeed: { from: 'workertime' },
  terraformspeed: { from: 'workertime' },
  canrepair: { label: 'Builder capability' }, canreclaim: { label: 'Builder capability' },
  canresurrect: false, cancapture: false, canassist: { label: 'Builder capability' },
  canbeassisted: true, builder: false, maxreversevelocity: 0, turninplace: true,
  turninplaceanglelimit: 0, turninplacespeedlimit: { label: 'Computed from speed and turn rate' },
  separationdistance: 0, maxbank: 0.8, maxpitch: 0.45, turnradius: 500,
  maxaileron: 0.015, maxelevator: 0.01, maxrudder: 0.004,
  hoverattack: false, airstrafe: true, transportsize: 0, transportmass: 100000,
  mintransportsize: 0, mintransportmass: 0, loadingradius: 220, unloadspread: 5,
  transportunloadmethod: 0, releaseheld: false, holdsteady: false, transportbyenemy: true,
  canattack: true, noautofire: false, canmanualfire: false,
  firestate: { label: 'Combat-control dependent' }, movestate: { label: 'Movement dependent' },
  nochasecategory: '', hightrajectory: 0, kamikaze: false, kamikazedistance: 0,
  footprintx: 1, footprintz: 1, yardmap: '', maxthisunit: { label: 'Engine unit cap' },
});

function formatDefaultLabel(value) {
  if (value === true) return 'Enabled';
  if (value === false) return 'Disabled';
  if (value === '') return 'Empty';
  return String(value);
}

export function resolveUnitParameterDefault(parameter, defaults = {}, seen = new Set()) {
  if (Object.prototype.hasOwnProperty.call(defaults, parameter.key)) {
    const value = defaults[parameter.key];
    return { value, label: formatDefaultLabel(value), source: 'unit' };
  }

  const rule = parameter.engineDefault;
  if (rule === undefined) return { value: undefined, label: 'Engine-defined', source: 'unknown' };
  if (rule === null || typeof rule !== 'object') {
    return { value: rule, label: formatDefaultLabel(rule), source: 'engine' };
  }
  if (rule.label && !rule.from) {
    return { value: undefined, label: rule.label, source: 'engine-derived' };
  }
  if (!rule.from || seen.has(parameter.key)) {
    return { value: undefined, label: 'Engine-defined', source: 'unknown' };
  }

  const dependency = STAT_KEYS.find(item => item.key === rule.from);
  if (!dependency) return { value: undefined, label: rule.label || 'Engine-defined', source: 'unknown' };
  const nextSeen = new Set(seen).add(parameter.key);
  const resolved = resolveUnitParameterDefault(dependency, defaults, nextSeen);
  if (resolved.value === undefined) {
    return { value: undefined, label: rule.label || `Derived from ${dependency.label}`, source: 'engine-derived' };
  }

  let value = resolved.value;
  if (rule.transform === 'nonzero') value = Number(value) !== 0;
  else if (rule.multiplier !== undefined) value = Number(value) * rule.multiplier;
  if (typeof value === 'number' && rule.minimum !== undefined) value = Math.max(rule.minimum, value);
  if (typeof value === 'number' && rule.maximum !== undefined) value = Math.min(rule.maximum, value);
  return { value, label: formatDefaultLabel(value), source: 'engine' };
}

export const STAT_KEYS = Object.freeze([
  { key: 'metalcost', label: 'Metal Cost', icon: '[MET]', type: 'number' },
  { key: 'energycost', label: 'Energy Cost', icon: '[ENG]', type: 'number' },
  { key: 'buildtime', label: 'Build Time', icon: '[TIM]', type: 'number' },
  { key: 'health', label: 'Health (HP)', icon: '[HP]', type: 'number' },
  { key: 'maxvelocity', label: 'Max Speed', icon: '[SPD]', type: 'number', patchKey: 'speed' },
  { key: 'acceleration', label: 'Acceleration', icon: '[ACC]', type: 'number', patchKey: 'maxAcc' },
  { key: 'brakerate', label: 'Brake Rate', icon: '[BRK]', type: 'number', patchKey: 'maxDec' },
  { key: 'turnrate', label: 'Turn Rate', icon: '[TRN]', type: 'number', patchKey: 'turnRate' },
  { key: 'mass', label: 'Mass', icon: '[MSS]', type: 'number' },
  { key: 'sightdistance', label: 'Sight Range', icon: '[SIG]', type: 'number' },
  { key: 'radardistance', label: 'Radar Range', icon: '[RAD]', type: 'number' },
  { key: 'sonardistance', label: 'Sonar Range', icon: '[SON]', type: 'number' },
  { key: 'stealth', label: 'Radar Stealth', icon: '[STL]', type: 'boolean' },
  { key: 'sonarstealth', label: 'Sonar Stealth', icon: '[SST]', type: 'boolean', patchKey: 'sonarStealth' },
  { key: 'workertime', label: 'Worker Power', icon: '[WRK]', type: 'number' },
  { key: 'metalmake', label: 'Metal Prod.', icon: '[PROD]', type: 'number' },
  { key: 'extractsmetal', label: 'Metal Extract', icon: '[EXT]', type: 'number' },
  { key: 'energymake', label: 'Energy Prod.', icon: '[ENM]', type: 'number' },
  { key: 'metalstorage', label: 'Metal Storage', icon: '[MS]', type: 'number' },
  { key: 'energystorage', label: 'Energy Storage', icon: '[ES]', type: 'number' },
  { key: 'cloakcost', label: 'Cloak Cost', icon: '[CLK]', type: 'number' },
  { key: 'cloakcostmoving', label: 'Cloak Move', icon: '[CLKM]', type: 'number' },
  { key: 'builddistance', label: 'Build Range', icon: '[RNG]', type: 'number', alwaysRelevant: true },
  { key: 'autoheal', label: 'Regen Rate', icon: '[REG]', type: 'number' },
  { key: 'customparams.techlevel', label: 'Tech Tier', icon: '[TCH]', type: 'number', nestedIn: 'customparams', patchKey: 'techlevel' },
  { key: 'customparams.energyconv_capacity', label: 'Conv. Capacity', icon: '[CAP]', type: 'number', nestedIn: 'customparams', patchKey: 'energyconv_capacity' },
  { key: 'customparams.energyconv_efficiency', label: 'Conv. Effic.', icon: '[EFF]', type: 'number', nestedIn: 'customparams', patchKey: 'energyconv_efficiency' },
  { key: 'maxslope', label: 'Max Slope', icon: '[SLP]', type: 'number' },
  { key: 'maxwaterdepth', label: 'Max Depth', icon: '[DEP]', type: 'number' },
  { key: 'minwaterdepth', label: 'Min Depth', icon: '[MIN]', type: 'number' },
  { key: 'transportcapacity', label: 'Trans. Cap.', icon: '[TRN]', type: 'number', patchKey: 'transportCapacity' },
  { key: 'cantbetransported', label: 'No Transport', icon: '[NTR]', type: 'boolean', patchKey: 'cantBeTransported' },
  { key: 'cruisealt', label: 'Cruise Altitude', icon: '[ALT]', type: 'number', patchKey: 'cruiseAltitude' },
  { key: 'explodeas', label: 'Death Explosion', icon: '[DEX]', type: 'string', patchKey: 'explodeAs' },
  { key: 'selfdestructas', label: 'Self-D Explosion', icon: '[SDX]', type: 'string', patchKey: 'selfDestructAs' },
  { key: 'selfdestructcountdown', label: 'Self-D Countdown', icon: '[SDT]', type: 'number', patchKey: 'selfDestructCountdown' },
  { key: 'canselfdestruct', label: 'Can Self-Destruct', icon: '[SDF]', type: 'boolean', patchKey: 'canSelfDestruct' },
  { key: 'damagemodifier', label: 'Incoming Damage', icon: '[DMG]', type: 'number', patchKey: 'damageModifier' },
  { key: 'crushresistance', label: 'Crush Resistance', icon: '[CRS]', type: 'number', patchKey: 'crushResistance' },
  { key: 'blocking', label: 'Blocks Movement', icon: '[BLK]', type: 'boolean' },
  { key: 'collide', label: 'Collision Enabled', icon: '[COL]', type: 'boolean' },
  { key: 'pushresistant', label: 'Push Resistant', icon: '[PSH]', type: 'boolean', patchKey: 'pushResistant' },
  { key: 'upright', label: 'Remain Upright', icon: '[UPR]', type: 'boolean' },
  { key: 'waterline', label: 'Waterline', icon: '[WTR]', type: 'number' },
  { key: 'seismicsignature', label: 'Seismic Signature', icon: '[SSG]', type: 'number', patchKey: 'seismicSignature' },
  { key: 'energyupkeep', label: 'Energy Upkeep', icon: '[EUP]', type: 'number', patchKey: 'energyUpkeep' },
  { key: 'metalupkeep', label: 'Metal Upkeep', icon: '[MUP]', type: 'number', patchKey: 'metalUpkeep' },
  { key: 'idleautoheal', label: 'Idle Regeneration', icon: '[IHL]', type: 'number', patchKey: 'idleAutoHeal' },
  { key: 'idletime', label: 'Idle Heal Delay', icon: '[IDL]', type: 'number', patchKey: 'idleTime' },
  { key: 'windgenerator', label: 'Wind Generation', icon: '[WND]', type: 'number', patchKey: 'windGenerator' },
  { key: 'tidalgenerator', label: 'Tidal Generation', icon: '[TID]', type: 'number', patchKey: 'tidalGenerator' },
  { key: 'cancloak', label: 'Can Cloak', icon: '[CCL]', type: 'boolean', patchKey: 'canCloak' },
  { key: 'initcloaked', label: 'Starts Cloaked', icon: '[ICL]', type: 'boolean', patchKey: 'initCloaked' },
  { key: 'mincloakdistance', label: 'Decloak Proximity', icon: '[DCL]', type: 'number', patchKey: 'minCloakDistance' },
  { key: 'decloakonfire', label: 'Decloak on Fire', icon: '[DCF]', type: 'boolean', patchKey: 'decloakOnFire' },
  { key: 'decloakspherical', label: 'Spherical Decloak', icon: '[DCS]', type: 'boolean', patchKey: 'decloakSpherical' },
  { key: 'airsightdistance', label: 'Air Sight Range', icon: '[AIR]', type: 'number', patchKey: 'airSightDistance' },
  { key: 'radardistancejam', label: 'Radar Jam Range', icon: '[RJM]', type: 'number', patchKey: 'radarDistanceJam' },
  { key: 'sonardistancejam', label: 'Sonar Jam Range', icon: '[SJM]', type: 'number', patchKey: 'sonarDistanceJam' },
  { key: 'seismicdistance', label: 'Seismic Range', icon: '[SEI]', type: 'number', patchKey: 'seismicDistance' },
  { key: 'repairspeed', label: 'Repair Speed', icon: '[RPR]', type: 'number', patchKey: 'repairSpeed' },
  { key: 'reclaimspeed', label: 'Reclaim Speed', icon: '[RCL]', type: 'number', patchKey: 'reclaimSpeed' },
  { key: 'resurrectspeed', label: 'Resurrect Speed', icon: '[RES]', type: 'number', patchKey: 'resurrectSpeed' },
  { key: 'capturespeed', label: 'Capture Speed', icon: '[CAP]', type: 'number', patchKey: 'captureSpeed' },
  { key: 'terraformspeed', label: 'Terraform Speed', icon: '[TER]', type: 'number', patchKey: 'terraformSpeed' },
  { key: 'canrepair', label: 'Can Repair', icon: '[RPR]', type: 'boolean', patchKey: 'canRepair' },
  { key: 'canreclaim', label: 'Can Reclaim', icon: '[RCL]', type: 'boolean', patchKey: 'canReclaim' },
  { key: 'canresurrect', label: 'Can Resurrect', icon: '[RES]', type: 'boolean', patchKey: 'canResurrect' },
  { key: 'cancapture', label: 'Can Capture', icon: '[CAP]', type: 'boolean', patchKey: 'canCapture' },
  { key: 'canassist', label: 'Can Assist', icon: '[AST]', type: 'boolean', patchKey: 'canAssist' },
  { key: 'canbeassisted', label: 'Can Be Assisted', icon: '[BAS]', type: 'boolean', patchKey: 'canBeAssisted' },
  { key: 'builder', label: 'Is Builder Capability', icon: '[BLD]', type: 'boolean', alwaysRelevant: true },
  { key: 'maxreversevelocity', label: 'Reverse Speed', icon: '[REV]', type: 'number', patchKey: 'rSpeed' },
  { key: 'turninplace', label: 'Turn in Place', icon: '[TIP]', type: 'boolean', patchKey: 'turnInPlace' },
  { key: 'turninplaceanglelimit', label: 'Turn-in-Place Angle', icon: '[TIA]', type: 'number', patchKey: 'turnInPlaceAngleLimit' },
  { key: 'turninplacespeedlimit', label: 'Turn-in-Place Speed', icon: '[TIS]', type: 'number', patchKey: 'turnInPlaceSpeedLimit' },
  { key: 'separationdistance', label: 'Separation Distance', icon: '[SEP]', type: 'number', patchKey: 'separationDistance' },
  { key: 'maxbank', label: 'Maximum Bank', icon: '[BNK]', type: 'number', patchKey: 'maxBank' },
  { key: 'maxpitch', label: 'Maximum Pitch', icon: '[PIT]', type: 'number', patchKey: 'maxPitch' },
  { key: 'turnradius', label: 'Turn Radius', icon: '[RAD]', type: 'number', patchKey: 'turnRadius' },
  { key: 'maxaileron', label: 'Aileron Rate', icon: '[AIL]', type: 'number', patchKey: 'maxAileron' },
  { key: 'maxelevator', label: 'Elevator Rate', icon: '[ELV]', type: 'number', patchKey: 'maxElevator' },
  { key: 'maxrudder', label: 'Rudder Rate', icon: '[RUD]', type: 'number', patchKey: 'maxRudder' },
  { key: 'hoverattack', label: 'Hover Attack', icon: '[HOV]', type: 'boolean', patchKey: 'hoverAttack' },
  { key: 'airstrafe', label: 'Air Strafing', icon: '[STR]', type: 'boolean', patchKey: 'airStrafe' },
  { key: 'transportsize', label: 'Transport Size', icon: '[TSZ]', type: 'number', patchKey: 'transportSize' },
  { key: 'transportmass', label: 'Transport Mass Limit', icon: '[TMS]', type: 'number', patchKey: 'transportMass' },
  { key: 'mintransportsize', label: 'Minimum Cargo Size', icon: '[MTS]', type: 'number', patchKey: 'minTransportSize' },
  { key: 'mintransportmass', label: 'Minimum Cargo Mass', icon: '[MTM]', type: 'number', patchKey: 'minTransportMass' },
  { key: 'loadingradius', label: 'Loading Radius', icon: '[LOD]', type: 'number', patchKey: 'loadingRadius' },
  { key: 'unloadspread', label: 'Unload Spread', icon: '[ULD]', type: 'number', patchKey: 'unloadSpread' },
  { key: 'transportunloadmethod', label: 'Unload Method', icon: '[ULM]', type: 'number', patchKey: 'transportUnloadMethod' },
  { key: 'releaseheld', label: 'Release Cargo on Death', icon: '[REL]', type: 'boolean', patchKey: 'releaseHeld' },
  { key: 'holdsteady', label: 'Hold Cargo Steady', icon: '[HLD]', type: 'boolean', patchKey: 'holdSteady' },
  { key: 'transportbyenemy', label: 'Enemy Transportable', icon: '[ETR]', type: 'boolean', patchKey: 'transportByEnemy' },
  { key: 'canattack', label: 'Can Attack', icon: '[ATK]', type: 'boolean', patchKey: 'canAttack' },
  { key: 'noautofire', label: 'Disable Auto Fire', icon: '[NAF]', type: 'boolean', patchKey: 'noAutoFire' },
  { key: 'canmanualfire', label: 'Manual Fire', icon: '[MNL]', type: 'boolean', patchKey: 'canManualFire' },
  { key: 'firestate', label: 'Default Fire State', icon: '[FST]', type: 'number', patchKey: 'fireState' },
  { key: 'movestate', label: 'Default Move State', icon: '[MST]', type: 'number', patchKey: 'moveState' },
  { key: 'nochasecategory', label: 'Do Not Chase', icon: '[NCH]', type: 'string', patchKey: 'noChaseCategory' },
  { key: 'hightrajectory', label: 'High-Trajectory Mode', icon: '[HTR]', type: 'number', patchKey: 'highTrajectory' },
  { key: 'kamikaze', label: 'Kamikaze', icon: '[KMZ]', type: 'boolean' },
  { key: 'kamikazedistance', label: 'Kamikaze Distance', icon: '[KMD]', type: 'number', patchKey: 'kamikazeDistance' },
  { key: 'footprintx', label: 'Footprint Width', icon: '[FPX]', type: 'number', patchKey: 'footprintx' },
  { key: 'footprintz', label: 'Footprint Depth', icon: '[FPZ]', type: 'number', patchKey: 'footprintz' },
  { key: 'yardmap', label: 'Yard Map', icon: '[YRD]', type: 'string', patchKey: 'yardmap' },
  { key: 'maxthisunit', label: 'Maximum Per Team', icon: '[MAX]', type: 'number', patchKey: 'maxthisunit' },
  { key: 'objectname', label: 'Unit Model', icon: '[OBJ]', type: 'string', patchKey: 'objectname', assetType: 'unitModel' },
  { key: 'script', label: 'Unit Script', icon: '[SCR]', type: 'string', patchKey: 'script', assetType: 'unitScript' },
  { key: 'buildpic', label: 'Build Picture', icon: '[PIC]', type: 'string', patchKey: 'buildpic', assetType: 'buildPicture' },
  { key: 'icontype', label: 'Tactical Icon', icon: '[ICO]', type: 'string', patchKey: 'icontype', assetType: 'iconType', alwaysRelevant: true },
  { key: 'collisionvolumetype', label: 'Collision Volume Type', icon: '[CVT]', type: 'string', patchKey: 'collisionvolumetype', assetType: 'collisionVolumeType' },
  { key: 'collisionvolumescales', label: 'Collision Volume Scales', icon: '[CVS]', type: 'string', patchKey: 'collisionvolumescales' },
  { key: 'collisionvolumeoffsets', label: 'Collision Volume Offsets', icon: '[CVO]', type: 'string', patchKey: 'collisionvolumeoffsets' },
  { key: 'death_explosion_damage', label: 'Death Explosion Damage', icon: '[XDM]', type: 'number', output: 'tweakdefs' },
  { key: 'death_explosion_aoe', label: 'Death Explosion AoE', icon: '[XAO]', type: 'number', output: 'tweakdefs' },
  { key: 'death_explosion_camerashake', label: 'Death Camera Shake', icon: '[XCS]', type: 'number', output: 'tweakdefs' },
  { key: 'death_explosion_impulsefactor', label: 'Death Impulse', icon: '[XIM]', type: 'number', output: 'tweakdefs' },
  { key: 'selfd_explosion_damage', label: 'Self-D Explosion Damage', icon: '[SDM]', type: 'number', output: 'tweakdefs' },
  { key: 'selfd_explosion_aoe', label: 'Self-D Explosion AoE', icon: '[SAO]', type: 'number', output: 'tweakdefs' },
  { key: 'selfd_explosion_camerashake', label: 'Self-D Camera Shake', icon: '[SCS]', type: 'number', output: 'tweakdefs' },
  { key: 'selfd_explosion_impulsefactor', label: 'Self-D Impulse', icon: '[SIM]', type: 'number', output: 'tweakdefs' },
].map((parameter, order) => ({
  group: 'Additional',
  order,
  unit: '',
  featured: false,
  ...parameter,
  ...(STAT_PRESENTATION[parameter.key] || {}),
  groupDescription: UNIT_PARAMETER_GROUP_DESCRIPTIONS[
    (STAT_PRESENTATION[parameter.key] || {}).group || 'Additional'
  ],
  engineDefault: UNIT_ENGINE_DEFAULTS[parameter.key],
})));

export function getApplicableUnitParameters(parameters, defaults = {}, tweaks = {}, options = {}) {
  const { showAll = false, activeKey = null } = options;
  if (showAll) return parameters;

  const isBuilderUnit = Boolean(
    tweaks.builder
    || defaults.builder
    || (tweaks.workertime !== undefined ? Number(tweaks.workertime) > 0 : Number(defaults.workertime) > 0)
    || tweaks.canrepair
    || defaults.canrepair
    || tweaks.canassist
    || defaults.canassist
  );

  return parameters.filter(parameter => (
    parameter.featured
    || parameter.alwaysRelevant
    || parameter.key === activeKey
    || (isBuilderUnit && ['builddistance', 'builder', 'repairspeed', 'reclaimspeed', 'terraformspeed', 'canrepair', 'canreclaim', 'canassist'].includes(parameter.key))
    || Object.prototype.hasOwnProperty.call(defaults, parameter.key)
    || Object.prototype.hasOwnProperty.call(tweaks, parameter.key)
  ));
}

export const MOBILITY_STAT_KEYS = new Set([
  'maxvelocity', 'acceleration', 'brakerate', 'turnrate', 'maxslope', 'maxwaterdepth',
  'minwaterdepth', 'transportcapacity', 'cantbetransported', 'cruisealt',
  'waterline', 'maxreversevelocity', 'turninplace', 'turninplaceanglelimit', 'turninplacespeedlimit',
  'separationdistance', 'maxbank', 'maxpitch', 'turnradius', 'maxaileron', 'maxelevator',
  'maxrudder', 'hoverattack', 'airstrafe', 'transportsize', 'transportmass', 'mintransportsize',
  'mintransportmass', 'loadingradius', 'unloadspread', 'transportunloadmethod', 'releaseheld',
  'holdsteady', 'transportbyenemy',
]);

export const WORKSPACE_TAB_DEFINITIONS = Object.freeze([
  { id: 'structure', label: 'Economy & Durability', description: 'Costs, health, production', panelId: 'workspace-panel-structure' },
  { id: 'mobility', label: 'Movement & Sensors', description: 'Speed, terrain, detection', panelId: 'workspace-panel-mobility' },
  { id: 'weapons', label: 'Weapons', description: 'Damage, targeting, projectiles', panelId: 'workspace-panel-weapons' },
]);

export const TARGET_CATEGORY_GROUPS = Object.freeze([
  { label: 'Unit types', categories: ['VTOL', 'SURFACE', 'UNDERWATER', 'SUB', 'SHIP', 'HOVER', 'LAND', 'FLOAT', 'SWIM', 'IMMOBILE', 'MINE'] },
  { label: 'Exclusions', categories: ['NOTAIR', 'NOTSUB', 'NOTSHIP', 'NOTHOVER', 'NOTLAND'] },
  { label: 'Special', categories: ['EMPABLE'] },
]);

export const UNIT_CATEGORIES = Object.freeze([
  'bots', 'vehicles', 'aircraft', 'ships', 'hovercraft', 'factories', 'defenses', 'buildings', 't1', 't2', 't3', 't4',
]);

export const WEAPON_SLOT_BOOLEAN_PARAMS = new Set([
  'canattackground', 'stockpile', 'avoidfriendly', 'collidefriendly',
  'impactonly', 'noexplode', 'burnblow', 'noselfdamage', 'paralyzer', 'waterweapon',
  'firesubmersed', 'collidefeature', 'collideneutral', 'collideground', 'tracks',
  'fixedlauncher', 'smoketrail', 'groundbounce', 'waterbounce', 'beamburst', 'sweepfire',
  'hardstop', 'explosionscar', 'alwaysvisible',
  'avoidfeature', 'avoidground', 'avoidneutral', 'collideenemy', 'collidenontarget',
  'collidecloaked', 'turret', 'commandfire', 'gravityaffected', 'submissile',
  'interceptsolo', 'largebeamlaser',
  'castshadow', 'smoketrailcastshadow', 'dyndamageinverted', 'shieldrepulser',
  'shieldsmart', 'shieldexterior', 'shieldvisible',
  'enabledocking', 'manualdrones', 'spawn_blocked_by_shield',
]);

export const WEAPON_SLOT_STRING_PARAMS = new Set([
  'weapontype', 'cegTag', 'model', 'explosiongenerator', 'rgbcolor', 'rgbcolor2',
  'soundstart', 'soundhit', 'soundhitwet', 'soundhitdry', 'texture1', 'texture2', 'texture3', 'colormap',
  'spawns_name', 'spawns_surface', 'spawns_mode', 'spawns_ceg', 'cluster_def',
  'carried_unit', 'dronetype', 'carrierdeaththroe', 'dockingpieces',
  'maxunits', 'startingdronecount', 'spawn_metal_cost', 'spawn_energy_cost',
  'droneairtime', 'dronedocktime', 'droneammo',
  'speceffect', 'speceffect_def', 'splitexplosionceg', 'waterpenceg',
  'speceffect_cegtag', 'speceffect_model',
]);

export const WEAPON_SLOT_MOUNT_PARAMS = new Set([
  'slaveto', 'maindir', 'maxangledif', 'weaponaimadjustpriority', 'fastautoretargeting',
  'fastquerypointupdate', 'burstcontrolwhenoutofarc', 'accurateleading',
]);

export const WEAPON_SLOT_PATHS = Object.freeze({
  damage: 'damage.default', damage_vs_commander: 'damage.commanders', damage_vs_vtol: 'damage.vtol',
  damage_vs_subs: 'damage.subs', damage_vs_shields: 'damage.shields', damage_vs_scavboss: 'damage.scavboss',
  damage_vs_raptorqueen: 'damage.raptorqueen', damage_vs_raptor: 'damage.raptor', damage_vs_mines: 'damage.mines', reload: 'reloadtime',
  velocity: 'weaponvelocity', aoe: 'areaofeffect', stockpilelimit: 'customparams.stockpilelimit',
  cegTag: 'cegtag', interceptedbyshieldtype: 'interceptedbyshieldtype', collisionSize: 'collisionsize',
  startvelocity: 'startvelocity', weaponacceleration: 'weaponacceleration', turnrate: 'turnrate',
  trajectoryheight: 'trajectoryheight', targetmoveerror: 'targetmoveerror', targetborder: 'targetborder',
  flighttime: 'flighttime',
  cylindertargeting: 'cylindertargeting', firetolerance: 'firetolerance', proximitypriority: 'proximitypriority',
  edgeeffectiveness: 'edgeeffectiveness', impulsefactor: 'impulsefactor', impulseboost: 'impulseboost',
  energypershot: 'energypershot', metalpershot: 'metalpershot', paralyzetime: 'paralyzetime',
  movingaccuracy: 'movingaccuracy', predictboost: 'predictboost', leadlimit: 'leadlimit', leadbonus: 'leadbonus',
  heightboostfactor: 'heightboostfactor', numbounce: 'numbounce', bounceslip: 'bounceslip',
  bouncerebound: 'bouncerebound', beamtime: 'beamtime', minintensity: 'minintensity', duration: 'duration',
  falloffrate: 'falloffrate', thickness: 'thickness', corethickness: 'corethickness',
  laserflaresize: 'laserflaresize', intensity: 'intensity',
  weaponTimer: 'weapontimer', windup: 'windup', firestarter: 'firestarter', explosionspeed: 'explosionspeed',
  camerashake: 'camerashake', cratermult: 'cratermult', craterboost: 'craterboost',
  crateraoe: 'craterareaofeffect', scarttl: 'scarttl', beamttl: 'beamttl', beamdecay: 'beamdecay',
  targetable: 'targetable', interceptor: 'interceptor', coverage: 'coverage',
  soundstartvolume: 'soundstartvolume', soundhitvolume: 'soundhitvolume', soundhitwetvolume: 'soundhitwetvolume',
  soundhitdryvolume: 'soundhitdryvolume', smokecolor: 'smokecolor', smokeperiod: 'smokeperiod',
  smokesize: 'smokesize', smoketime: 'smoketime', size: 'size', sizedecay: 'sizedecay',
  sizegrowth: 'sizegrowth', alphadecay: 'alphadecay', stages: 'stages', tilelength: 'tilelength',
  scrollspeed: 'scrollspeed', dyndamageexp: 'dyndamageexp', dyndamagemin: 'dyndamagemin',
  dyndamagerange: 'dyndamagerange', shieldrepulser: 'shield.repulser', shieldsmart: 'shield.smart',
  shieldexterior: 'shield.exterior', shieldvisible: 'shield.visible', shieldmaxspeed: 'shield.maxSpeed',
  shieldforce: 'shield.force', shieldradius: 'shield.radius', shieldpower: 'shield.power',
  shieldstartingpower: 'shield.startingPower', shieldpowerregen: 'shield.powerRegen',
  shieldpowerregenenergy: 'shield.powerRegenEnergy', shieldenergyuse: 'shield.energyUse',
  shieldrechargedelay: 'shield.rechargeDelay', shieldintercepttype: 'shield.interceptType',
  spawns_name: 'customparams.spawns_name', spawns_surface: 'customparams.spawns_surface',
  spawns_mode: 'customparams.spawns_mode', spawns_expire: 'customparams.spawns_expire',
  spawns_ceg: 'customparams.spawns_ceg', spawns_stun: 'customparams.spawns_stun',
  spawn_blocked_by_shield: 'customparams.spawn_blocked_by_shield',
  carried_unit: 'customparams.carried_unit', spawnrate: 'customparams.spawnrate',
  dronetype: 'customparams.dronetype', maxunits: 'customparams.maxunits',
  startingdronecount: 'customparams.startingdronecount', controlradius: 'customparams.controlradius',
  engagementrange: 'customparams.engagementrange', carrierdeaththroe: 'customparams.carrierdeaththroe',
  manualdrones: 'customparams.manualdrones',
  enabledocking: 'customparams.enabledocking', dockingpieces: 'customparams.dockingpieces',
  dockingradius: 'customparams.dockingradius', dockinghelperspeed: 'customparams.dockinghelperspeed',
  dockingarmor: 'customparams.dockingarmor', dockinghealrate: 'customparams.dockinghealrate',
  docktohealthreshold: 'customparams.docktohealthreshold',
  attackformationspread: 'customparams.attackformationspread',
  attackformationoffset: 'customparams.attackformationoffset',
  decayrate: 'customparams.decayrate', deathdecayrate: 'customparams.deathdecayrate',
  holdfireradius: 'customparams.holdfireradius',
  droneminimumidleradius: 'customparams.droneminimumidleradius',
  droneairtime: 'customparams.droneairtime', dronedocktime: 'customparams.dronedocktime',
  droneammo: 'customparams.droneammo',
  spawn_metal_cost: 'customparams.metalcost', spawn_energy_cost: 'customparams.energycost',
  cluster_def: 'customparams.cluster_def', cluster_number: 'customparams.cluster_number',
  speceffect: 'customparams.speceffect', spread_angle: 'customparams.spread_angle',
  max_range_reduction: 'customparams.max_range_reduction',
  cruise_min_height: 'customparams.cruise_min_height',
  cruise_max_height: 'customparams.cruise_max_height',
  lockon_dist: 'customparams.lockon_dist',
  guidance_lost_radius: 'customparams.guidance_lost_radius',
  speceffect_def: 'customparams.speceffect_def',
  speceffect_number: 'customparams.number',
  splitexplosionceg: 'customparams.splitexplosionceg',
  waterpenceg: 'customparams.waterpenceg',
  speceffect_cegtag: 'customparams.cegtag',
  speceffect_model: 'customparams.model',
  tracking_turn_radius: 'customparams.tracking_turn_radius',
});

export const SPAWNER_CARRIER_WEAPON_GROUPS = Object.freeze([
  {
    title: 'Explosion spawner',
    capabilities: ['bar-gadget'],
    description: 'Create units when this projectile explodes. These values are read by BAR’s Unit Explosion Spawner gadget.',
    params: [
      { key: 'spawns_name', label: 'Spawned Unit IDs', type: 'string' },
      { key: 'spawns_surface', label: 'Allowed Surface', type: 'string', options: ['', 'LAND', 'SEA', 'WATER', 'SUB', 'BOTH'] },
      { key: 'spawns_mode', label: 'Multiple-Unit Selection', type: 'string', options: ['', 'random', 'random_locked', 'sequential'] },
      { key: 'spawns_expire', label: 'Spawn Lifetime (seconds)', type: 'number' },
      { key: 'spawns_ceg', label: 'Additional Spawn CEG', type: 'string' },
      { key: 'spawns_stun', label: 'Spawn Stun Time (seconds)', type: 'number' },
      { key: 'spawn_blocked_by_shield', label: 'Shield Can Block Spawn', type: 'tri-state' },
    ],
  },
  {
    title: 'Carrier deployment',
    capabilities: ['bar-gadget', 'experimental'],
    description: 'Deploy and control carried units through BAR’s carrier weapon contract.',
    params: [
      { key: 'carried_unit', label: 'Carried Unit IDs (space-separated)', type: 'string' },
      { key: 'dronetype', label: 'Drone Types (per unit type)', type: 'string', options: ['', 'default', 'sub', 'sea', 'air', 'land'] },
      { key: 'spawnrate', label: 'Spawn Interval (seconds)', type: 'number' },
      { key: 'maxunits', label: 'Maximum Active Units per Type', type: 'string' },
      { key: 'startingdronecount', label: 'Initial Units per Type', type: 'string' },
      { key: 'spawn_metal_cost', label: 'Metal Cost per Type', type: 'string' },
      { key: 'spawn_energy_cost', label: 'Energy Cost per Type', type: 'string' },
      { key: 'controlradius', label: 'Control Radius', type: 'number' },
      { key: 'engagementrange', label: 'Engagement Range', type: 'number' },
      { key: 'manualdrones', label: 'Allow Direct Player Control', type: 'tri-state', valueType: 'number' },
      {
        key: 'carrierdeaththroe',
        label: 'Behavior When Carrier Dies',
        type: 'string',
        options: ['', 'death', 'control', 'capture', 'release', 'parasite'],
      },
    ],
  },
  {
    title: 'Carrier docking & endurance',
    capabilities: ['bar-gadget', 'experimental'],
    description: 'Recovery, formation, lifetime, and ammunition behavior for deployed units.',
    params: [
      { key: 'enabledocking', label: 'Enable Docking', type: 'tri-state', valueType: 'number' },
      { key: 'dockingpieces', label: 'Docking Piece Groups (comma-separated)', type: 'string' },
      { key: 'dockingradius', label: 'Docking Radius', type: 'number' },
      { key: 'dockinghelperspeed', label: 'Docking Helper Speed', type: 'number' },
      { key: 'dockingarmor', label: 'Docked Damage Multiplier', type: 'number' },
      { key: 'dockinghealrate', label: 'Docked Healing per Second', type: 'number' },
      { key: 'docktohealthreshold', label: 'Return-to-Dock Health (%)', type: 'number' },
      { key: 'attackformationspread', label: 'Attack Formation Spread', type: 'number' },
      { key: 'attackformationoffset', label: 'Attack Formation Offset (%)', type: 'number' },
      { key: 'decayrate', label: 'Undocked Health Decay / Second', type: 'number' },
      { key: 'deathdecayrate', label: 'Orphaned Health Decay / Second', type: 'number' },
      { key: 'holdfireradius', label: 'Hold-Fire Wander Radius', type: 'number' },
      { key: 'droneminimumidleradius', label: 'Minimum Idle Radius', type: 'number' },
      { key: 'droneairtime', label: 'Maximum Air Time per Type', type: 'string' },
      { key: 'dronedocktime', label: 'Minimum Dock Time per Type', type: 'string' },
      { key: 'droneammo', label: 'Drone Ammunition per Type', type: 'string' },
    ],
  },
]);
