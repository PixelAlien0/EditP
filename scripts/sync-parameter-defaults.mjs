import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repository = process.env.BAR_REPOSITORY || path.join(os.tmpdir(), 'bar-parameter-audit')
const unitsRoot = path.join(repository, 'units')
const explosionsFile = path.join(repository, 'weapons', 'Unit_Explosions.lua')
const outputFile = path.resolve('src/data/unit-defaults.json')

if (!fs.existsSync(unitsRoot)) {
  throw new Error(`BAR unit sources were not found at ${unitsRoot}. Set BAR_REPOSITORY to a BAR checkout.`)
}

const UNIT_FIELDS = Object.freeze({
  acceleration: 'acceleration', maxacc: 'acceleration', brakerate: 'brakerate', maxdec: 'brakerate',
  cruisealtitude: 'cruisealt', cruisealt: 'cruisealt',
  explodeas: 'explodeas', selfdestructas: 'selfdestructas', selfdestructcountdown: 'selfdestructcountdown',
  canselfdestruct: 'canselfdestruct', damagemodifier: 'damagemodifier', crushresistance: 'crushresistance',
  blocking: 'blocking', collide: 'collide', pushresistant: 'pushresistant', upright: 'upright',
  waterline: 'waterline', seismicsignature: 'seismicsignature', energyupkeep: 'energyupkeep',
  metalupkeep: 'metalupkeep', idleautoheal: 'idleautoheal', idletime: 'idletime',
  windgenerator: 'windgenerator', tidalgenerator: 'tidalgenerator', cancloak: 'cancloak',
  initcloaked: 'initcloaked', mincloakdistance: 'mincloakdistance', decloakonfire: 'decloakonfire',
  decloakspherical: 'decloakspherical', airsightdistance: 'airsightdistance', radardistancejam: 'radardistancejam',
  sonardistancejam: 'sonardistancejam', seismicdistance: 'seismicdistance', repairspeed: 'repairspeed',
  reclaimspeed: 'reclaimspeed', resurrectspeed: 'resurrectspeed', capturespeed: 'capturespeed',
  terraformspeed: 'terraformspeed', canrepair: 'canrepair', canreclaim: 'canreclaim',
  canresurrect: 'canresurrect', cancapture: 'cancapture', canassist: 'canassist',
  canbeassisted: 'canbeassisted', maxreversevelocity: 'maxreversevelocity', turninplace: 'turninplace',
  turninplaceanglelimit: 'turninplaceanglelimit', turninplacespeedlimit: 'turninplacespeedlimit',
  separationdistance: 'separationdistance', maxbank: 'maxbank', maxpitch: 'maxpitch', turnradius: 'turnradius',
  maxaileron: 'maxaileron', maxelevator: 'maxelevator', maxrudder: 'maxrudder', hoverattack: 'hoverattack',
  airstrafe: 'airstrafe', transportsize: 'transportsize', transportmass: 'transportmass',
  mintransportsize: 'mintransportsize', mintransportmass: 'mintransportmass', loadingradius: 'loadingradius',
  unloadspread: 'unloadspread', transportunloadmethod: 'transportunloadmethod', releaseheld: 'releaseheld',
  holdsteady: 'holdsteady', transportbyenemy: 'transportbyenemy', canattack: 'canattack',
  noautofire: 'noautofire', canmanualfire: 'canmanualfire', firestate: 'firestate', movestate: 'movestate',
  nochasecategory: 'nochasecategory', hightrajectory: 'hightrajectory', kamikaze: 'kamikaze',
  kamikazedistance: 'kamikazedistance', footprintx: 'footprintx', footprintz: 'footprintz',
  yardmap: 'yardmap', maxthisunit: 'maxthisunit', objectname: 'objectname', script: 'script',
  buildpic: 'buildpic', icontype: 'icontype', collisionvolumetype: 'collisionvolumetype',
  collisionvolumescales: 'collisionvolumescales', collisionvolumeoffsets: 'collisionvolumeoffsets',
})

const RECOVERY_UNIT_FIELDS = Object.freeze({
  metalcost: 'metalcost', buildcostmetal: 'metalcost',
  energycost: 'energycost', buildcostenergy: 'energycost',
  buildtime: 'buildtime', health: 'health', maxdamage: 'health',
  sightdistance: 'sightdistance', radardistance: 'radardistance', sonardistance: 'sonardistance',
  workertime: 'workertime', metalmake: 'metalmake', extractsmetal: 'extractsmetal',
  energymake: 'energymake', metalstorage: 'metalstorage', energystorage: 'energystorage',
  cloakcost: 'cloakcost', cloakcostmoving: 'cloakcostmoving', builddistance: 'builddistance',
  autoheal: 'autoheal', maxslope: 'maxslope', maxwaterdepth: 'maxwaterdepth',
  minwaterdepth: 'minwaterdepth', transportcapacity: 'transportcapacity',
  maxvelocity: 'maxvelocity', speed: 'maxvelocity', mass: 'mass',
})

const PARSED_UNIT_FIELDS = Object.freeze({ ...UNIT_FIELDS, ...RECOVERY_UNIT_FIELDS })

const CUSTOM_PARAM_FIELDS = new Set([
  'armordef', 'restrictions_exclusion', 'crashable', 'fall_damage_multiplier',
  'water_fall_damage_multiplier', 'unitgroup', 'ignore_noair', 'attacksafetydistance',
  'overrange_distance', 'paralyzemultiplier', 'removestop', 'maxrange',
])

const WEAPON_CUSTOM_PARAM_FIELDS = Object.freeze({
  spawns_name: 'spawns_name', spawns_surface: 'spawns_surface', spawns_mode: 'spawns_mode',
  spawns_expire: 'spawns_expire', spawns_ceg: 'spawns_ceg', spawns_stun: 'spawns_stun',
  spawn_blocked_by_shield: 'spawn_blocked_by_shield', carried_unit: 'carried_unit',
  dronetype: 'dronetype', spawnrate: 'spawnrate', maxunits: 'maxunits',
  startingdronecount: 'startingdronecount', controlradius: 'controlradius',
  engagementrange: 'engagementrange', enabledocking: 'enabledocking',
  dockingpieces: 'dockingpieces', dockingradius: 'dockingradius',
  dockinghelperspeed: 'dockinghelperspeed', dockingarmor: 'dockingarmor',
  dockinghealrate: 'dockinghealrate', docktohealthreshold: 'docktohealthreshold',
  attackformationspread: 'attackformationspread', attackformationoffset: 'attackformationoffset',
  decayrate: 'decayrate', deathdecayrate: 'deathdecayrate',
  carrierdeaththroe: 'carrierdeaththroe', holdfireradius: 'holdfireradius',
  droneminimumidleradius: 'droneminimumidleradius', droneairtime: 'droneairtime',
  dronedocktime: 'dronedocktime', droneammo: 'droneammo',
  metalcost: 'spawn_metal_cost', buildcostmetal: 'spawn_metal_cost',
  energycost: 'spawn_energy_cost', buildcostenergy: 'spawn_energy_cost',
  cluster_def: 'cluster_def', cluster_number: 'cluster_number',
})

const WEAPON_FIELDS = Object.freeze({
  avoidfeature: 'avoidfeature', avoidground: 'avoidground', avoidneutral: 'avoidneutral',
  collideenemy: 'collideenemy', collidenontarget: 'collidenontarget', collidecloaked: 'collidecloaked',
  turret: 'turret', commandfire: 'commandfire', weapontimer: 'weaponTimer', windup: 'windup',
  gravityaffected: 'gravityaffected', submissile: 'submissile', firestarter: 'firestarter',
  explosionspeed: 'explosionspeed', camerashake: 'camerashake', cratermult: 'cratermult',
  craterboost: 'craterboost', craterareaofeffect: 'crateraoe', scarttl: 'scarttl', beamttl: 'beamttl',
  beamdecay: 'beamdecay', largebeamlaser: 'largebeamlaser', targetable: 'targetable',
  interceptor: 'interceptor', coverage: 'coverage', interceptsolo: 'interceptsolo',
  soundhitdry: 'soundhitdry', soundstartvolume: 'soundstartvolume', soundhitvolume: 'soundhitvolume',
  soundhitwetvolume: 'soundhitwetvolume', soundhitdryvolume: 'soundhitdryvolume', texture1: 'texture1',
  texture2: 'texture2', texture3: 'texture3', colormap: 'colormap', smokecolor: 'smokecolor',
  smokeperiod: 'smokeperiod', smokesize: 'smokesize', smoketime: 'smoketime', castshadow: 'castshadow',
  smoketrailcastshadow: 'smoketrailcastshadow', size: 'size', sizedecay: 'sizedecay',
  sizegrowth: 'sizegrowth', alphadecay: 'alphadecay', stages: 'stages', tilelength: 'tilelength',
  scrollspeed: 'scrollspeed', dyndamageinverted: 'dyndamageinverted', dyndamageexp: 'dyndamageexp',
  dyndamagemin: 'dyndamagemin', dyndamagerange: 'dyndamagerange',
})

const RECOVERY_WEAPON_FIELDS = Object.freeze({
  range: 'range', reloadtime: 'reload', weaponvelocity: 'velocity', velocity: 'velocity',
  flighttime: 'flighttime', areaofeffect: 'aoe', accuracy: 'accuracy', sprayangle: 'sprayangle',
  projectiles: 'projectiles', burst: 'burst', burstrate: 'burstrate',
  edgeeffectiveness: 'edgeeffectiveness', impulsefactor: 'impulsefactor', impulseboost: 'impulseboost',
  energypershot: 'energypershot', metalpershot: 'metalpershot', paralyzetime: 'paralyzetime',
})

const PARSED_WEAPON_FIELDS = Object.freeze({ ...WEAPON_FIELDS, ...RECOVERY_WEAPON_FIELDS })

const SHIELD_FIELDS = Object.freeze({
  repulser: 'shieldrepulser', smart: 'shieldsmart', exterior: 'shieldexterior', visible: 'shieldvisible',
  maxspeed: 'shieldmaxspeed', force: 'shieldforce', radius: 'shieldradius', power: 'shieldpower',
  startingpower: 'shieldstartingpower', powerregen: 'shieldpowerregen',
  powerregenenergy: 'shieldpowerregenenergy', energyuse: 'shieldenergyuse',
  rechargedelay: 'shieldrechargedelay', intercepttype: 'shieldintercepttype',
})

const MOUNT_FIELDS = Object.freeze({
  slaveto: 'slaveto', maindir: 'maindir', maxangledif: 'maxangledif',
  weaponaimadjustpriority: 'weaponaimadjustpriority', fastautoretargeting: 'fastautoretargeting',
  fastquerypointupdate: 'fastquerypointupdate', burstcontrolwhenoutofarc: 'burstcontrolwhenoutofarc',
  accurateleading: 'accurateleading',
})
const PARSED_MOUNT_FIELDS = Object.freeze({ ...MOUNT_FIELDS, def: 'defKey' })

const DAMAGE_FIELDS = Object.freeze({
  commanders: 'damage_vs_commander', vtol: 'damage_vs_vtol', subs: 'damage_vs_subs',
  shields: 'damage_vs_shields', scavboss: 'damage_vs_scavboss', raptorqueen: 'damage_vs_raptorqueen',
  raptor: 'damage_vs_raptor', mines: 'damage_vs_mines',
})
const PARSED_DAMAGE_FIELDS = Object.freeze({ ...DAMAGE_FIELDS, default: 'damage' })

function walk(directory, result = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) walk(absolute, result)
    else if (entry.name.endsWith('.lua')) result.push(absolute)
  }
  return result
}

function scalar(source) {
  const value = source.replace(/,\s*(?:--.*)?$/, '').trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value)
  const string = value.match(/^(["'])(.*)\1$/)
  return string ? string[2] : undefined
}

function parseUnitFile(file) {
  const source = fs.readFileSync(file, 'utf8')
  const lines = source.split(/\r?\n/).map(line => {
    const indentation = line.match(/^[\t ]*/)?.[0] || ''
    const columns = [...indentation].reduce((count, character) => (
      count + (character === '\t' ? 4 : 1)
    ), 0)
    return `${'\t'.repeat(Math.floor(columns / 4))}${line.slice(indentation.length)}`
  })
  const id = lines.map(line => line.match(/^\t([A-Za-z0-9_]+)\s*=\s*\{/i)?.[1]).find(Boolean)?.toLowerCase()
  if (!id) return null
  const values = {}
  const weaponDefs = {}
  const weaponMounts = {}
  let inWeaponDefs = false
  let inWeapons = false
  let currentWeapon = null
  let currentMount = null
  let inDamage = false
  let inShield = false
  let inCustomParams = false
  let inWeaponCustomParams = false

  for (const line of lines) {
    if (/^\t\tcustomparams\s*=\s*\{/i.test(line)) { inCustomParams = true; continue }
    if (inCustomParams && /^\t\t\},?/.test(line)) { inCustomParams = false; continue }
    if (inCustomParams) {
      const match = line.match(/^\t\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
      if (!match) continue
      const key = match[1].toLowerCase()
      const value = scalar(match[2])
      if (CUSTOM_PARAM_FIELDS.has(key) && value !== undefined) values[`customparams.${key}`] = value
      continue
    }
    if (/^\t\tweapons\s*=\s*\{/i.test(line)) { inWeapons = true; continue }
    if (inWeapons && /^\t\t\},?/.test(line)) { inWeapons = false; currentMount = null; continue }
    if (inWeapons) {
      const mount = line.match(/^\t\t\t\[(\d+)\]\s*=\s*\{/)
      if (mount) { currentMount = Number(mount[1]); weaponMounts[currentMount] = {}; continue }
      if (!currentMount) continue
      const match = line.match(/^\t\t\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
      if (!match) continue
      const target = PARSED_MOUNT_FIELDS[match[1].toLowerCase()]
      const value = scalar(match[2])
      if (target && value !== undefined) {
        weaponMounts[currentMount][target] = target === 'defKey'
          ? String(value).toLowerCase()
          : value
      }
      continue
    }
    if (/^\t\tweapondefs\s*=\s*\{/i.test(line)) { inWeaponDefs = true; continue }
    if (inWeaponDefs && /^\t\t\},?/.test(line)) { inWeaponDefs = false; currentWeapon = null; inDamage = false; inShield = false; inWeaponCustomParams = false; continue }

    if (inWeaponDefs) {
      const weapon = line.match(/^\t\t\t(?:\[?["']?)([A-Za-z0-9_-]+)(?:["']?\]?)\s*=\s*\{/)
      if (weapon) { currentWeapon = weapon[1].toLowerCase(); weaponDefs[currentWeapon] = {}; inWeaponCustomParams = false; continue }
      if (!currentWeapon) continue
      if (/^\t\t\t\tcustomparams\s*=\s*\{/i.test(line)) { inWeaponCustomParams = true; continue }
      if (/^\t\t\t\tdamage\s*=\s*\{/i.test(line)) { inDamage = true; continue }
      if (/^\t\t\t\tshield\s*=\s*\{/i.test(line)) { inShield = true; continue }
      if (inWeaponCustomParams && /^\t\t\t\t\},?/.test(line)) { inWeaponCustomParams = false; continue }
      if (inDamage && /^\t\t\t\t\},?/.test(line)) { inDamage = false; continue }
      if (inShield && /^\t\t\t\t\},?/.test(line)) { inShield = false; continue }
      if (inWeaponCustomParams) {
        const match = line.match(/^\t\t\t\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
        if (!match) continue
        const value = scalar(match[2])
        const target = WEAPON_CUSTOM_PARAM_FIELDS[match[1].toLowerCase()]
        if (target && value !== undefined) weaponDefs[currentWeapon][target] = value
        continue
      }
      if (inDamage) {
        const match = line.match(/^\t\t\t\t\t(?:\[?["']?)([A-Za-z0-9_-]+)(?:["']?\]?)\s*=\s*(.+)$/)
        if (!match) continue
        const value = scalar(match[2])
        const target = PARSED_DAMAGE_FIELDS[match[1].toLowerCase()]
        if (target && value !== undefined) weaponDefs[currentWeapon][target] = value
        continue
      }
      if (inShield) {
        const match = line.match(/^\t\t\t\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
        if (!match) continue
        const value = scalar(match[2])
        const target = SHIELD_FIELDS[match[1].toLowerCase()]
        if (target && value !== undefined) weaponDefs[currentWeapon][target] = value
        continue
      }
      const match = line.match(/^\t\t\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
      if (!match) continue
      const target = PARSED_WEAPON_FIELDS[match[1].toLowerCase()]
      const value = scalar(match[2])
      if (target && value !== undefined) weaponDefs[currentWeapon][target] = value
      continue
    }

    const match = line.match(/^\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (!match) continue
    const target = PARSED_UNIT_FIELDS[match[1].toLowerCase()]
    const value = scalar(match[2])
    if (target && value !== undefined) values[target] = value
  }
  const longYardmap = source.match(/\byardmap\s*=\s*\[(=*)\[([\s\S]*?)\]\1\]/i)
  if (longYardmap) values.yardmap = longYardmap[2].trim().replace(/\r?\n\s*/g, ' ')
  return { id, values, weaponDefs, weaponMounts }
}

function parseExplosionProfiles() {
  if (!fs.existsSync(explosionsFile)) return {}
  const lines = fs.readFileSync(explosionsFile, 'utf8').split(/\r?\n/)
  const profiles = {}
  const constants = {}
  let current = null
  let inDamage = false
  for (const line of lines) {
    const constant = line.match(/^local\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (constant) {
      const value = scalar(constant[2])
      if (value !== undefined) constants[constant[1].toLowerCase()] = value
      continue
    }
    const entry = line.match(/^\t(?:\[?["']?)([A-Za-z0-9_-]+)(?:["']?\]?)\s*=\s*\{/)
    if (entry) { current = entry[1].toLowerCase(); profiles[current] = {}; inDamage = false; continue }
    if (!current) continue
    if (/^\t\tdamage\s*=\s*\{/i.test(line)) { inDamage = true; continue }
    if (inDamage && /^\t\t\},?/.test(line)) { inDamage = false; continue }
    if (inDamage) {
      const match = line.match(/^\t\t\tdefault\s*=\s*(.+)$/i)
      const value = match ? scalar(match[1]) : undefined
      if (value !== undefined) profiles[current].damage = value
      continue
    }
    const match = line.match(/^\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (!match) continue
    const key = match[1].toLowerCase()
    const value = scalar(match[2]) ?? constants[match[2].replace(/,\s*$/, '').trim().toLowerCase()]
    if (value === undefined) continue
    if (key === 'areaofeffect') profiles[current].aoe = value
    else if (key === 'camerashake') profiles[current].camerashake = value
    else if (key === 'impulsefactor') profiles[current].impulsefactor = value
  }
  return profiles
}

const defaults = JSON.parse(fs.readFileSync(outputFile, 'utf8'))
const sources = new Map(walk(unitsRoot).map(parseUnitFile).filter(Boolean).map(unit => [unit.id, unit]))
const explosions = parseExplosionProfiles()
let resolved = 0
let added = 0

for (const [id, source] of sources) {
  if (defaults[id]) continue
  const hasCoreDefaults = ['metalcost', 'energycost', 'buildtime', 'health']
    .every(key => Number.isFinite(Number(source.values[key])))
  if (!hasCoreDefaults) continue

  const weaponSlots = Object.entries(source.weaponMounts)
    .map(([slot, mount]) => {
      const defKey = String(mount.defKey || '').toLowerCase()
      if (!defKey || !source.weaponDefs[defKey]) return null
      return {
        ...source.weaponDefs[defKey],
        ...mount,
        slot: Number(slot),
        defKey,
      }
    })
    .filter(Boolean)
    .sort((left, right) => left.slot - right.slot)

  defaults[id] = {
    ...source.values,
    ...(weaponSlots.length ? { weaponSlots } : {}),
  }
  added += 1
}

for (const [id, unit] of Object.entries(defaults)) {
  const source = sources.get(id) || (id.startsWith('scav_') ? sources.get(id.slice(5)) : null)
  if (!source) continue
  for (const key of new Set(Object.values(UNIT_FIELDS))) delete unit[key]
  for (const key of CUSTOM_PARAM_FIELDS) delete unit[`customparams.${key}`]
  for (const key of Object.keys(unit)) {
    if (key.startsWith('death_explosion_') || key.startsWith('selfd_explosion_')) delete unit[key]
  }
  Object.assign(unit, source.values)
  for (const slot of unit.weaponSlots || []) {
    for (const key of [...Object.values(WEAPON_FIELDS), ...Object.values(WEAPON_CUSTOM_PARAM_FIELDS), ...Object.values(DAMAGE_FIELDS), ...Object.values(SHIELD_FIELDS), ...Object.values(MOUNT_FIELDS)]) delete slot[key]
    Object.assign(slot, source.weaponDefs[String(slot.defKey).toLowerCase()] || {})
    Object.assign(slot, source.weaponMounts[slot.slot] || {})
  }

  const death = explosions[String(source.values.explodeas || '').toLowerCase()]
  if (death) for (const [key, value] of Object.entries(death)) unit[`death_explosion_${key}`] = value
  const selfd = explosions[String(source.values.selfdestructas || source.values.explodeas || '').toLowerCase()]
  if (selfd) for (const [key, value] of Object.entries(selfd)) unit[`selfd_explosion_${key}`] = value
  resolved += 1
}

fs.writeFileSync(outputFile, `${JSON.stringify(defaults, null, 2)}\n`)
console.log(`Updated expanded parameter defaults for ${resolved}/${Object.keys(defaults).length} units (${added} newly recovered).`)
