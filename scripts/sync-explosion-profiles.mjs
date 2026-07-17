import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const repository = process.env.BAR_REPOSITORY || path.join(os.tmpdir(), 'bar-parameter-audit')
const sourceFile = path.join(repository, 'weapons', 'Unit_Explosions.lua')
const outputFile = path.resolve('src/data/explosion-profiles.json')

if (!fs.existsSync(sourceFile)) {
  throw new Error(`BAR explosion definitions were not found at ${sourceFile}. Set BAR_REPOSITORY to a BAR checkout.`)
}

function scalar(source, constants = {}) {
  const value = source.replace(/,\s*(?:--.*)?$/, '').trim()
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(value)) return Number(value)
  const string = value.match(/^(["'])(.*)\1$/)
  if (string) return string[2]
  return constants[value.toLowerCase()]
}

function parseProfiles() {
  const profiles = {}
  const constants = {}
  let current = null
  let nested = null

  for (const line of fs.readFileSync(sourceFile, 'utf8').split(/\r?\n/)) {
    const constant = line.match(/^local\s+([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (constant) {
      const value = scalar(constant[2], constants)
      if (value !== undefined) constants[constant[1].toLowerCase()] = value
      continue
    }

    const entry = line.match(/^\t(?:\[?["']?)([A-Za-z0-9_-]+)(?:["']?\]?)\s*=\s*\{/)
    if (entry) {
      current = entry[1].toLowerCase()
      profiles[current] = {}
      nested = null
      continue
    }
    if (!current) continue

    const nestedStart = line.match(/^\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*\{/)
    if (nestedStart) {
      nested = nestedStart[1].toLowerCase()
      profiles[current][nested] = {}
      continue
    }
    if (nested && /^\t\t\},?/.test(line)) {
      nested = null
      continue
    }

    const match = nested
      ? line.match(/^\t\t\t(?:\[?["']?)([A-Za-z0-9_-]+)(?:["']?\]?)\s*=\s*(.+)$/)
      : line.match(/^\t\t([A-Za-z][A-Za-z0-9_]*)\s*=\s*(.+)$/)
    if (!match) continue
    const value = scalar(match[2], constants)
    if (value === undefined) continue
    const key = match[1].toLowerCase()
    if (nested) profiles[current][nested][key] = value
    else profiles[current][key] = value
  }

  return Object.fromEntries(Object.entries(profiles).filter(([, profile]) => (
    profile.areaofeffect !== undefined || profile.damage?.default !== undefined
  )))
}

const profiles = parseProfiles()
fs.writeFileSync(outputFile, `${JSON.stringify(profiles, null, 2)}\n`)
console.log(`Wrote ${Object.keys(profiles).length} BAR explosion profiles to ${outputFile}.`)
