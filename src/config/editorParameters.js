export const STAT_KEYS = Object.freeze([
  { key: 'metalcost', label: 'Metal Cost', icon: '[MET]', type: 'number' },
  { key: 'energycost', label: 'Energy Cost', icon: '[ENG]', type: 'number' },
  { key: 'buildtime', label: 'Build Time', icon: '[TIM]', type: 'number' },
  { key: 'health', label: 'Health (HP)', icon: '[HP]', type: 'number' },
  { key: 'maxvelocity', label: 'Max Speed', icon: '[SPD]', type: 'number', patchKey: 'speed' },
  { key: 'acceleration', label: 'Acceleration', icon: '[ACC]', type: 'number' },
  { key: 'brakerate', label: 'Brake Rate', icon: '[BRK]', type: 'number', patchKey: 'brakeRate' },
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
  { key: 'builddistance', label: 'Build Range', icon: '[RNG]', type: 'number' },
  { key: 'autoheal', label: 'Regen Rate', icon: '[REG]', type: 'number' },
  { key: 'customparams.techlevel', label: 'Tech Tier', icon: '[TCH]', type: 'number', nestedIn: 'customparams', patchKey: 'techlevel' },
  { key: 'customparams.energyconv_capacity', label: 'Conv. Capacity', icon: '[CAP]', type: 'number', nestedIn: 'customparams', patchKey: 'energyconv_capacity' },
  { key: 'customparams.energyconv_efficiency', label: 'Conv. Effic.', icon: '[EFF]', type: 'number', nestedIn: 'customparams', patchKey: 'energyconv_efficiency' },
  { key: 'maxslope', label: 'Max Slope', icon: '[SLP]', type: 'number' },
  { key: 'maxwaterdepth', label: 'Max Depth', icon: '[DEP]', type: 'number' },
  { key: 'minwaterdepth', label: 'Min Depth', icon: '[MIN]', type: 'number' },
  { key: 'transportcapacity', label: 'Trans. Cap.', icon: '[TRN]', type: 'number', patchKey: 'transportCapacity' },
  { key: 'cantbetransported', label: 'No Transport', icon: '[NTR]', type: 'boolean', patchKey: 'cantBeTransported' },
  { key: 'cruisealt', label: 'Cruise Altitude', icon: '[ALT]', type: 'number' },
  { key: 'airsubalt', label: 'Sub-Altitude', icon: '[SUB]', type: 'number' },
]);

export const MOBILITY_STAT_KEYS = new Set([
  'maxvelocity', 'acceleration', 'brakerate', 'turnrate', 'maxslope', 'maxwaterdepth',
  'minwaterdepth', 'transportcapacity', 'cantbetransported', 'cruisealt', 'airsubalt',
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
  'canattackground', 'toairweapon', 'stockpile', 'avoidfriendly', 'collidefriendly',
  'impactonly', 'noexplode', 'burnblow', 'noselfdamage', 'paralyzer', 'waterweapon',
  'firesubmersed', 'collidefeature', 'collideneutral', 'collideground', 'tracks',
  'fixedlauncher', 'smoketrail', 'groundbounce', 'waterbounce', 'beamburst', 'sweepfire',
  'hardstop', 'explosionscar', 'alwaysvisible',
]);

export const WEAPON_SLOT_STRING_PARAMS = new Set([
  'weapontype', 'cegTag', 'model', 'explosiongenerator', 'rgbcolor', 'rgbcolor2',
  'soundstart', 'soundhit', 'soundhitwet',
]);

export const WEAPON_SLOT_PATHS = Object.freeze({
  damage: 'damage.default', damage_vs_light: 'damage.light', damage_vs_medium: 'damage.medium',
  damage_vs_heavy: 'damage.heavy', damage_vs_commander: 'damage.commander', reload: 'reloadtime',
  velocity: 'weaponvelocity', aoe: 'areaofeffect', stockpilelimit: 'customparams.stockpilelimit',
  cegTag: 'cegtag', interceptedbyshieldtype: 'interceptedbyshieldtype', collisionSize: 'collisionsize',
  startvelocity: 'startvelocity', weaponacceleration: 'weaponacceleration', turnrate: 'turnrate',
  trajectoryheight: 'trajectoryheight', targetmoveerror: 'targetmoveerror', targetborder: 'targetborder',
  cylindertargeting: 'cylindertargeting', firetolerance: 'firetolerance', proximitypriority: 'proximitypriority',
  edgeeffectiveness: 'edgeeffectiveness', impulsefactor: 'impulsefactor', impulseboost: 'impulseboost',
  energypershot: 'energypershot', metalpershot: 'metalpershot', paralyzetime: 'paralyzetime',
  movingaccuracy: 'movingaccuracy', predictboost: 'predictboost', leadlimit: 'leadlimit', leadbonus: 'leadbonus',
  heightboostfactor: 'heightboostfactor', numbounce: 'numbounce', bounceslip: 'bounceslip',
  bouncerebound: 'bouncerebound', beamtime: 'beamtime', minintensity: 'minintensity', duration: 'duration',
  falloffrate: 'falloffrate', thickness: 'thickness', corethickness: 'corethickness',
  laserflaresize: 'laserflaresize', intensity: 'intensity',
});
