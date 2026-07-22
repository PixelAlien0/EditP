import { STAT_KEYS } from './editorParameters.js';


const PARAMETER_RELATIONSHIPS = [
  { section: 'structure', title: 'Construction economy', description: 'Cost and build work combine to determine how expensive and slow a unit is to field.', keys: ['metalcost', 'energycost', 'buildtime', 'workertime'] },
  { section: 'structure', title: 'Durability and physics', description: 'Health, mass, and regeneration shape survivability and impulse response.', keys: ['health', 'mass', 'autoheal'] },
  { section: 'structure', title: 'Detection profile', description: 'Visual, radar, sonar, and stealth values determine when this unit can see or be seen.', keys: ['sightdistance', 'radardistance', 'sonardistance', 'stealth', 'sonarstealth'] },
  { section: 'structure', title: 'Resource production', description: 'Production, extraction, and storage should be balanced as one economy package.', keys: ['metalmake', 'extractsmetal', 'energymake', 'metalstorage', 'energystorage'] },
  { section: 'structure', title: 'Cloak economy', description: 'Cloak drain is safest to tune alongside energy income and storage.', keys: ['cloakcost', 'cloakcostmoving', 'energymake', 'energystorage'] },
  { section: 'structure', title: 'Converter output', description: 'Conversion capacity and efficiency jointly control the converter’s useful output.', keys: ['customparams.energyconv_capacity', 'customparams.energyconv_efficiency', 'energymake'] },
  { section: 'structure', title: 'Carrier deployment', description: 'Payload, spawn timing, limits, control range, docking, decay, and replacement costs form one carrier system.', keys: ['customparams.carried_unit', 'customparams.spawnrate', 'customparams.maxunits', 'customparams.controlradius', 'customparams.enabledocking', 'customparams.decayrate', 'customparams.deathdecayrate', 'customparams.carrierdeaththroe', 'customparams.metalcost', 'customparams.energycost'] },
  { section: 'structure', title: 'Engagement behaviour', description: 'Attack permission, automatic fire, manual fire, default states, and chase exclusions form the unit engagement policy.', keys: ['canattack', 'noautofire', 'canmanualfire', 'firestate', 'movestate', 'nochasecategory'] },
  { section: 'mobility', title: 'Movement response', description: 'Top speed, acceleration, braking, and turning determine the complete handling profile.', keys: ['maxvelocity', 'acceleration', 'brakerate', 'turnrate'] },
  { section: 'mobility', title: 'Terrain access', description: 'Slope and water-depth limits decide which parts of a map the unit can traverse.', keys: ['maxslope', 'maxwaterdepth', 'minwaterdepth'] },
  { section: 'mobility', title: 'Transport behavior', description: 'Capacity, transport eligibility, and mass interact with carrying roles.', keys: ['transportcapacity', 'cantbetransported'] },
  { section: 'mobility', title: 'Aircraft altitude', description: 'Cruise altitude should be tuned together with aircraft speed and maneuvering.', keys: ['cruisealt', 'maxvelocity', 'turnradius', 'maxbank', 'maxpitch'] },
  { section: 'weapons', title: 'Damage throughput', description: 'Damage, reload, projectile count, and burst timing combine into sustained DPS.', keys: ['damage', 'reload', 'projectiles', 'burst', 'burstrate'] },
  { section: 'weapons', title: 'Armor damage profile', description: 'BAR armor-class values override base damage for matching targets.', keys: ['damage', 'damage_vs_vtol', 'damage_vs_subs', 'damage_vs_commander', 'damage_vs_shields', 'damage_vs_scavboss', 'damage_vs_raptorqueen', 'damage_vs_raptor', 'damage_vs_mines'] },
  { section: 'weapons', title: 'Range and projectile travel', description: 'Range must be reachable within projectile speed, acceleration, and lifetime limits.', keys: ['range', 'velocity', 'flighttime', 'startvelocity', 'weaponacceleration', 'burnblow'] },
  { section: 'weapons', title: 'Accuracy and leading', description: 'Spread, movement error, prediction, and firing tolerance jointly determine practical hit rate.', keys: ['accuracy', 'sprayangle', 'movingaccuracy', 'targetmoveerror', 'predictboost', 'leadlimit', 'leadbonus', 'tolerance', 'firetolerance'] },
  { section: 'weapons', title: 'Splash behavior', description: 'Area, edge damage, impact rules, and self-damage define how explosions apply damage.', keys: ['aoe', 'edgeeffectiveness', 'impactonly', 'noexplode', 'noselfdamage'] },
  { section: 'weapons', title: 'Guidance and trajectory', description: 'Tracking, turn rate, arc, and flight motion determine whether guided shots can connect.', keys: ['tracks', 'turnrate', 'trajectoryheight', 'wobble', 'dance', 'flighttime'] },
  { section: 'weapons', title: 'Collision and bounce', description: 'Collision masks and bounce retention control how a projectile interacts with the world.', keys: ['collidefriendly', 'collidefeature', 'collideneutral', 'collideground', 'collisionSize', 'groundbounce', 'waterbounce', 'numbounce', 'bounceslip', 'bouncerebound'] },
  { section: 'weapons', title: 'Unit engagement behaviour', description: 'Attack permission, automatic fire, manual fire, default states, and chase exclusions determine how the active weapon is used.', keys: ['canattack', 'noautofire', 'canmanualfire', 'firestate', 'movestate', 'nochasecategory', 'commandfire'] },
  { section: 'weapons', title: 'Target eligibility', description: 'Ground, air, water, and category masks jointly decide which targets are valid or preferred.', keys: ['canattackground', 'toairweapon', 'waterweapon', 'firesubmersed', 'onlytargetcategory', 'badtargetcategory'] },
  { section: 'weapons', title: 'Stockpile and shot cost', description: 'Ammunition timing, limits, and per-shot resources determine firing availability.', keys: ['stockpile', 'stockpiletime', 'stockpilelimit', 'energypershot', 'metalpershot'] },
  { section: 'weapons', title: 'Beam behavior', description: 'Beam duration, burst mode, sweep behavior, and falloff shape delivered damage.', keys: ['beamtime', 'beamburst', 'sweepfire', 'minintensity', 'duration', 'hardstop', 'falloffrate'] },
  { section: 'weapons', title: 'Projectile presentation', description: 'Trail, model, impact effect, colors, thickness, and intensity form one visual language.', keys: ['cegTag', 'model', 'explosiongenerator', 'rgbcolor', 'rgbcolor2', 'thickness', 'corethickness', 'laserflaresize', 'intensity'] },
  { section: 'weapons', title: 'Weapon audio', description: 'Fire, impact, and water-impact sounds should be authored as a coordinated set.', keys: ['soundstart', 'soundhit', 'soundhitwet'] },
  { section: 'weapons', title: 'Spawn and cluster behavior', description: 'Spawned units, resource costs, and cluster submunitions depend on valid unit and weapon-definition IDs.', keys: ['spawns_name', 'spawns_surface', 'spawn_metal_cost', 'spawn_energy_cost', 'cluster_def', 'cluster_number'] },
  { section: 'weapons', title: 'Projectile interception', description: 'Targetable and interceptor bitmasks must share a channel; coverage controls the acquisition radius and exclusive interception prevents duplicate commitments.', keys: ['targetable', 'interceptor', 'coverage', 'interceptsolo', 'commandfire'] }
];

const PARAMETER_LABEL_OVERRIDES = {
  aoe: 'Splash AoE', cegTag: 'Visual Effect / Trail', collisionSize: 'Collision Size',
  canattackground: 'Can Target Ground', toairweapon: 'Anti-Air Only',
  onlytargetcategory: 'Allow Targets', badtargetcategory: 'De-prioritise Targets',
  soundstart: 'Fire Sound', soundhit: 'Hit Sound', soundhitwet: 'Water Hit Sound'
};

const PARAMETER_HELP = {
  metalcost: 'Metal required to build the unit.', energycost: 'Energy required to build the unit.', buildtime: 'Base work required to finish construction.', health: 'Maximum hit points before destruction.',
  maxvelocity: 'Maximum movement speed.', acceleration: 'How quickly the unit reaches speed.', brakerate: 'How quickly the unit slows down.', mass: 'Affects collision and impulse reactions.',
  sightdistance: 'Visual detection range.', radardistance: 'Radar detection range.', sonardistance: 'Underwater detection range.', stealth: 'Prevents radar detection.', sonarstealth: 'Prevents sonar detection.',
  workertime: 'Build, repair, reclaim, and terraform power.', metalmake: 'Passive metal production.', extractsmetal: 'Metal extraction amount.', energymake: 'Passive energy production.',
  metalstorage: 'Maximum stored metal.', energystorage: 'Maximum stored energy.', cloakcost: 'Energy used per second while cloaked.', cloakcostmoving: 'Energy used per second while moving while cloaked.',
  builddistance: 'Maximum building and repair range.', maxslope: 'Steepest terrain the unit can use.', maxwaterdepth: 'Deepest water the unit can enter.', minwaterdepth: 'Minimum water depth required.',
  transportcapacity: 'Number of transport slots provided.', cantbetransported: 'Prevents the unit from being carried.', cruisealt: 'Preferred aircraft altitude.',
  'customparams.techlevel': 'Technology tier used by BAR content and filters.', 'customparams.energyconv_capacity': 'Energy-converter capacity custom parameter.', 'customparams.energyconv_efficiency': 'Energy-converter efficiency custom parameter.',
  'customparams.carried_unit': 'Unit ID deployed by BAR carrier behavior.', 'customparams.spawnrate': 'Seconds between carrier deployment attempts.', 'customparams.maxunits': 'Maximum number of active carried units.',
  'customparams.controlradius': 'Experimental radius within which deployed units remain under carrier control.', 'customparams.enabledocking': 'Experimental docking behavior for returning carried units.',
  'customparams.decayrate': 'Health decay applied to deployed units.', 'customparams.deathdecayrate': 'Decay applied after the carrier is destroyed.', 'customparams.carrierdeaththroe': 'Carrier death behavior, such as release.',
  'customparams.metalcost': 'Metal charged for each carrier-deployed unit.', 'customparams.energycost': 'Energy charged for each carrier-deployed unit.',
  footprintx: 'Unit footprint width in 16-elmo map squares. Yard-map rows should use this width.', footprintz: 'Unit footprint depth in 16-elmo map squares. Yard-map row count should match this depth.',
  yardmap: 'Building occupancy map. Separate rows with spaces; each row should match the footprint width.', maxthisunit: 'Maximum number of this UnitDef that one team may own at once.',
  objectname: '3D model path already present in BAR or the loaded mod.', script: 'Unit animation script path already present in BAR or the loaded mod.',
  buildpic: 'Build-menu artwork name already present in BAR or the loaded mod.', icontype: 'Strategic icon type registered by BAR or the loaded mod.',
  collisionvolumetype: 'Collision shape such as Box, CylY, Ell, Footprint, or Sphere.', collisionvolumescales: 'Collision volume dimensions as three space-separated numbers.',
  collisionvolumeoffsets: 'Collision volume X Y Z offset as three space-separated numbers.',
  canattack: 'Allows the unit to receive and execute ordinary attack orders.', noautofire: 'Stops the unit from automatically firing while preserving explicit weapon control.',
  canmanualfire: 'Makes the unit eligible for the manual-fire command when a weapon supports it.', firestate: 'Initial fire posture: hold fire, return fire, or fire at will.',
  movestate: 'Initial pursuit posture: hold position, maneuver, or roam.', nochasecategory: 'Space-separated categories the unit should not automatically pursue.',
  damage: 'Base damage against targets without a specific armor class.', reload: 'Seconds between firing cycles.', range: 'Maximum firing range in elmos.', velocity: 'Projectile speed.',
  flighttime: 'How long a guided projectile retains fuel and guidance.', aoe: 'Explosion diameter that can damage nearby units.', accuracy: 'Base shot spread; lower is more accurate.',
  sprayangle: 'Spread between projectiles in a burst.', heightmod: 'How range changes with target elevation.', randomdecay: 'Legacy projectile spread behavior; use with caution.',
  hightrajectory: 'Cannon arc mode: low, high, or player-toggleable.', projectiles: 'Projectiles released per firing event.', burst: 'Shots fired in one burst.', burstrate: 'Delay between shots inside a burst.',
  canattackground: 'Allows force-firing at a ground position.', toairweapon: 'Legacy anti-air convenience flag. Prefer target categories for precise control.', stockpile: 'Requires ammunition to be stockpiled before firing.',
  avoidfriendly: 'Makes projectiles try to avoid friendly units.', collidefriendly: 'Allows projectile collision with friendly units.', interceptedbyshieldtype: 'Shield interception bitmask. Zero means shields do not intercept it.',
  stockpiletime: 'Seconds required to produce one stockpiled round.', stockpilelimit: 'Custom maximum number of stockpiled rounds.', weapontype: 'Engine projectile behavior class.',
  cegTag: 'Continuous effect emitted by the projectile while it travels.', model: '3D projectile model file.', explosiongenerator: 'Custom explosion effect spawned on impact.',
  edgeeffectiveness: 'Fraction of base damage retained at the outer edge of splash range.', impactonly: 'Deals damage only through direct impact, not splash.',
  noexplode: 'Projectile continues after impact. Can multiply damage while inside a collision volume.', burnblow: 'Explodes when it reaches maximum range.', noselfdamage: 'Prevents the firing unit from taking its own explosion damage.',
  impulsefactor: 'Multiplier for knockback impulse.', impulseboost: 'Flat knockback added before the multiplier.', energypershot: 'Energy consumed each time the weapon fires.', metalpershot: 'Metal consumed each time the weapon fires.',
  spawns_name: 'Unit ID created when this weapon fires.', spawns_surface: 'Surface restriction for the spawned unit, such as LAND.', spawn_metal_cost: 'Metal charged for each spawned unit.', spawn_energy_cost: 'Energy charged for each spawned unit.',
  cluster_def: 'WeaponDef key released as cluster submunitions.', cluster_number: 'Number of submunitions released by the cluster projectile.',
  paralyzer: 'Turns damage into paralysis rather than hit-point loss.', paralyzetime: 'Maximum paralysis duration.', mygravity: 'Overrides map gravity for ballistic weapons.', heightboostfactor: 'Terrain-height effect on cannon range.',
  startvelocity: 'Projectile speed immediately after launch.', weaponacceleration: 'Speed gained per second until maximum velocity.', tracks: 'Enables homing guidance.', turnrate: 'How quickly a guided projectile can turn.',
  trajectoryheight: 'Guided missile arc height.', wobble: 'Random direction variation during flight.', dance: 'Random positional variation during flight.', fixedlauncher: 'Uses the firing piece orientation at launch.',
  smoketrail: 'Emits the weapon type’s smoke trail.', waterweapon: 'Can target underwater units and pass through water.', firesubmersed: 'Allows the weapon to fire while underwater.',
  movingaccuracy: 'Shot spread while the firing unit is moving.', targetmoveerror: 'Random error based on target movement.', predictboost: 'How strongly the weapon predicts target movement.',
  leadlimit: 'Maximum distance used when leading a target; -1 is unlimited.', leadbonus: 'Experience bonus added to lead limit.', targetborder: 'Aim point from far edge to near edge of the target.',
  cylindertargeting: 'Uses cylindrical instead of spherical range behavior.', tolerance: 'Aim error allowed before the weapon may fire.', firetolerance: 'Final angle check that stops sideways shots.',
  proximitypriority: 'Target-priority multiplier based on distance.', collidefeature: 'Whether projectiles collide with map features.', collideneutral: 'Whether projectiles collide with neutral units.',
  collideground: 'Whether projectiles collide with terrain.', collisionSize: 'Projectile collision size; engine effect varies by weapon type.', groundbounce: 'Enables bouncing off terrain.',
  waterbounce: 'Enables bouncing off water.', numbounce: 'Number of bounces before explosion; -1 permits unlimited bounces.', bounceslip: 'Horizontal velocity kept after a bounce.',
  bouncerebound: 'Vertical velocity kept after a bounce.', beamtime: 'Beam duration; damage is distributed across this time.', beamburst: 'Uses burst behavior instead of continuous beam timing.',
  sweepfire: 'Allows a beam to continue while aiming at a new target.', minintensity: 'Minimum beam damage retained at maximum range.', duration: 'Visual laser length multiplier.',
  hardstop: 'Stops a laser projectile sharply instead of fading out.', falloffrate: 'Laser fade rate after maximum range.', thickness: 'Beam or laser width.',
  corethickness: 'Width of the beam’s bright core.', laserflaresize: 'Size of the firing flare.', intensity: 'Visual transparency/intensity for sprite projectiles.',
  rgbcolor: 'Primary projectile RGB color, for example “1 0.2 0.2”.', rgbcolor2: 'Secondary/core projectile RGB color.', explosionscar: 'Leaves an explosion scar on terrain.',
  alwaysvisible: 'Renders the projectile even outside line of sight.', soundstart: 'Sound asset played when firing.', soundhit: 'Sound asset played on impact.', soundhitwet: 'Sound asset played on water impact.',
  onlytargetcategory: 'Categories this slot is allowed to target.', badtargetcategory: 'Categories this slot de-prioritizes but can still target.',
  explodeas: 'WeaponDef used when the unit is destroyed normally.', selfdestructas: 'WeaponDef used when the unit completes a self-destruct.', selfdestructcountdown: 'Seconds between issuing self-destruct and detonation.',
  death_explosion_damage: 'Default damage for an isolated copy of this unit’s normal death explosion.', death_explosion_aoe: 'Damage diameter for this unit’s isolated normal death explosion.',
  death_explosion_camerashake: 'Camera-shake strength generated by normal destruction.', death_explosion_impulsefactor: 'Knockback multiplier generated by normal destruction.',
  selfd_explosion_damage: 'Default damage for an isolated copy of this unit’s self-destruct explosion.', selfd_explosion_aoe: 'Damage diameter for this unit’s isolated self-destruct explosion.',
  selfd_explosion_camerashake: 'Camera-shake strength generated by self-destruction.', selfd_explosion_impulsefactor: 'Knockback multiplier generated by self-destruction.',
  damagemodifier: 'Multiplier applied to incoming damage; lower values make the unit tougher.', energyupkeep: 'Energy consumed continuously while the unit is active.', metalupkeep: 'Metal consumed continuously while the unit is active.',
  avoidfeature: 'Makes aiming avoid terrain features when checking a safe firing line.', cratermult: 'Multiplier controlling terrain deformation strength.', crateraoe: 'Diameter of terrain deformation, separate from damage AoE.',
  targetable: 'Bitmask describing which interceptor channels can target this projectile.', interceptor: 'Bitmask describing which targetable projectile channels this weapon intercepts.', coverage: 'Radius in which an interceptor searches for projectiles.',
  interceptsolo: 'When enabled, other interceptors will not target a projectile after this interceptor commits to it.', commandfire: 'Makes the weapon respond to manual-fire orders instead of automatic attack.',
  gravity: 'Global map gravity override.', windmin: 'Minimum map wind strength.', windmax: 'Maximum map wind strength.', tidalmaker: 'Global tidal energy yield.'
};

export const PARAMETER_SECTION_GUIDANCE = {
  structure: 'Unit attributes apply to the selected unit. A changed field becomes a project override; Reset removes only that override.',
  mobility: 'Movement changes affect how the selected unit travels. Use small changes first, then validate in-game.',
  weapons: 'Values apply to the selected weapon slot. Inherited means the untouched BAR definition is used. Advanced fields are engine-specific; hover ? for behavior and constraints.'
};

export function getRelationshipLabel(key) {
  return STAT_KEYS.find(item => item.key === key)?.label
    || PARAMETER_LABEL_OVERRIDES[key]
    || key.replace(/^customparams\./, '').replaceAll('_', ' ').replace(/\b\w/g, character => character.toUpperCase());
}

export function getParameterRelationship(section, key) {
  if (!key) return null;
  const matches = PARAMETER_RELATIONSHIPS.filter(group => group.section === section && group.keys.includes(key));
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return {
    section,
    title: `${getRelationshipLabel(key)} connects ${matches.length} systems`,
    description: matches.map(group => group.title).join(' · '),
    keys: [...new Set(matches.flatMap(group => group.keys))]
  };
}

export function getParameterHelp(key, label) {
  if (key === 'turnrate' && label === 'Turn Rate') return 'How quickly the unit rotates.';
  if (PARAMETER_HELP[key]) return PARAMETER_HELP[key];
  if (key.startsWith('damage_vs_')) return `Damage against the ${key.replace('damage_vs_', '')} armor class.`;
  return `${label}. Enter a value to create an override; clear or reset it to return to the inherited game value.`;
}

